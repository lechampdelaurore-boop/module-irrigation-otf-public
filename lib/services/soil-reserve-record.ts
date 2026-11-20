import { saveSoilDaysForWorkspace } from '@/db/soil-reserve/days';
import { logJsonLine } from '../adapters/log';
import type { IrrigationSnapshot } from '../domain/domain';
import { emptyGaugeComparison, engineComparisonEntry, type GaugeComparison } from '../domain/soil-reserve/gauge-comparison';
import { SHARED_ENGINE_VERSION } from '../domain/soil-reserve/gauge-engine';
import { GAUGE_ENGINE } from '../domain/soil-reserve/gauge-switch';
import { soilDayRecord, type SoilDayRecord } from '../domain/soil-reserve/records';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../domain/water-management';
import { listFarmsWithFeature } from './feature-selection-service';
import { getIrrigationSnapshot } from './irrigation-service';
import { soilReserveDaysForUser } from './soil-reserve-view';

/**
 * L'état du jour de la jauge enregistré chaque matin (docs/soil-reserve-contract.md,
 * « Découpage et preuve de fin », 5 ter, PR 3d) : après la météo du matin et
 * l'ETM du jour, la jauge de chaque planche est recalculée et l'état des sept
 * jours d'avant est enregistré, avec ce qui l'a produit. Sept jours, comme
 * l'ETM : la réanalyse d'un jour arrive quelques jours après lui. Aujourd'hui
 * et les jours à venir ne s'enregistrent pas : ils sont prévus et changent
 * chaque matin. Un état recalculé remplace le précédent du même jour ; aucune
 * observation, aucune saisie n'est touchée. La jauge ne relit pas ces états :
 * ils gardent la trace de ce qui a été affiché.
 *
 * Tant que l'ancien calcul de la jauge et le moteur commun coexistent
 * (docs/shared-engine-adapter-contract.md, « L'interrupteur et la preuve
 * d'égalité »), le matin rejoue aussi l'autre calcul sur chaque planche et
 * écrit une seule ligne au journal : planches et jours comparés, écarts
 * au-delà de 0,01 mm par grandeur, le plus grand écart ; aucune donnée de la
 * ferme. La comparaison n'écrit rien en base et n'arrête jamais l'enregistrement.
 */

const SOIL_RECORD_PAST_DAYS = 7;

export async function recordSoilDaysForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  now?: Date;
  /** Le bilan de la comparaison du matin, auquel s'ajoutent les planches de la ferme. */
  comparison?: GaugeComparison;
}): Promise<number> {
  const now = input.now ?? new Date();
  const computed = await soilReserveDaysForUser({ ...input, now });
  if (!computed) return 0;
  const from = addDaysToDateKey(computed.today, -SOIL_RECORD_PAST_DAYS);
  const records = [...computed.daysByBed]
    .flatMap(([bedId, days]) => days
      .filter((day) => day.date >= from && day.date < computed.today)
      .map((day) => soilDayRecord(bedId, day)))
    .filter((record): record is SoilDayRecord => record !== null);
  await saveSoilDaysForWorkspace(computed.workspaceId, records, now);
  return records.length;
}

/** Après la météo et l'ETM du matin, pour chaque ferme ; un échec d'une ferme n'arrête pas les autres. */
export async function recordSoilDaysForAllWorkspaces({
  now = new Date(),
  log = (line: string) => console.error(line),
  logComparison = logEngineComparison,
}: {
  now?: Date;
  log?: (line: string) => void;
  logComparison?: (entry: Record<string, unknown>) => void;
} = {}): Promise<{ recorded: number; failed: number }> {
  const season = Number(dateKeyInTimeZone(now, FARM_TIME_ZONE).slice(0, 4));
  let recorded = 0;
  let failed = 0;
  const comparison = emptyGaugeComparison();
  // Seules les fermes qui ont coché Réserve du sol enregistrent l'état du jour (3.8, R1, P5).
  for (const { ownerUserId } of await listFarmsWithFeature('sol')) {
    try {
      const snapshot = await getIrrigationSnapshot(ownerUserId, { season, context: 'morning' });
      await recordSoilDaysForUser({ ownerUserId, season, snapshot, now, comparison });
      recorded += 1;
    } catch (error) {
      failed += 1;
      log(JSON.stringify({ event: 'soil_reserve_day_record_failed', season, error: error instanceof Error ? error.message : 'unknown', failedAt: now.toISOString() }));
    }
  }
  try {
    logComparison(engineComparisonEntry(comparison, GAUGE_ENGINE, SHARED_ENGINE_VERSION));
  } catch {
    // Le journal de la comparaison ne fait jamais échouer le matin.
  }
  return { recorded, failed };
}

/** Sans écart ni échec, une information ; sinon un avertissement, à lire avant de basculer l'interrupteur. */
function logEngineComparison(entry: Record<string, unknown>): void {
  logJsonLine(entry.daysWithGap === 0 && entry.failures === 0 ? 'info' : 'warn', entry);
}
