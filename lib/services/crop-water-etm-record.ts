import { saveEtmDaysForWorkspace } from '@/db/crop-water/etm-days';
import type { IrrigationSnapshot } from '../domain/domain';
import { etmDayRecord, type EtmDayRecord } from '../domain/crop-water/records';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../domain/water-management';
import { getCropWaterDaysForUser } from './crop-water-week';
import { listFarmsWithFeature } from './feature-selection-service';
import { getIrrigationSnapshot } from './irrigation-service';

/**
 * L'ETM enregistrée chaque jour (docs/crop-water-need-contract.md, « La
 * traçabilité », 5 quater, PR 3d) : chaque matin, après la synchronisation
 * de la météo, l'ETM de chaque planche est recalculée et enregistrée pour
 * aujourd'hui et les sept jours d'avant, avec ce qui l'a produite. Sept jours,
 * parce que la réanalyse d'un jour arrive quelques jours après lui : une ETM
 * d'abord calculée sur la prévision est remplacée par celle de la réanalyse.
 * Les jours à venir ne s'enregistrent pas : leur prévision change chaque
 * matin, l'écran les calcule à la demande. Une ETM recalculée remplace la
 * précédente ; aucune irrigation, aucun cumul n'est touché. Un jour bloqué
 * par une valeur hors bornes ne s'écrit pas : la dernière valeur valide reste.
 */

const ETM_RECORD_PAST_DAYS = 7;

/** Les jours que l'enregistrement du matin recalcule : les sept d'avant et aujourd'hui, dans la saison du jour. */
export function etmRecordDates(today: string, season: number): string[] {
  const dates: string[] = [];
  for (let offset = -ETM_RECORD_PAST_DAYS; offset <= 0; offset += 1) {
    const date = addDaysToDateKey(today, offset);
    // Une saison est une année civile : les jours de l'année d'avant restent à la leur.
    if (Number(date.slice(0, 4)) === season) dates.push(date);
  }
  return dates;
}

export async function recordEtmDaysForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  now?: Date;
}): Promise<number> {
  const now = input.now ?? new Date();
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const computed = await getCropWaterDaysForUser({ ...input, dates: etmRecordDates(today, input.season), now });
  if (!computed) return 0;
  const records = computed.beds
    .flatMap((bed) => bed.days.map((day) => etmDayRecord(bed.bedId, day)))
    .filter((record): record is EtmDayRecord => record !== null);
  await saveEtmDaysForWorkspace(computed.workspaceId, input.season, records, now);
  return records.length;
}

/** Après la météo du matin, pour chaque ferme ; un échec d'une ferme n'arrête pas les autres. */
export async function recordEtmDaysForAllWorkspaces({
  now = new Date(),
  log = (line: string) => console.error(line),
}: { now?: Date; log?: (line: string) => void } = {}): Promise<{ recorded: number; failed: number }> {
  const season = Number(dateKeyInTimeZone(now, FARM_TIME_ZONE).slice(0, 4));
  let recorded = 0;
  let failed = 0;
  // Seules les fermes qui ont coché Besoin par culture enregistrent l'ETM du matin (3.8, R1, P5).
  for (const { ownerUserId } of await listFarmsWithFeature('cultures')) {
    try {
      const snapshot = await getIrrigationSnapshot(ownerUserId, { season });
      await recordEtmDaysForUser({ ownerUserId, season, snapshot, now });
      recorded += 1;
    } catch (error) {
      failed += 1;
      log(JSON.stringify({ event: 'crop_water_etm_record_failed', season, error: error instanceof Error ? error.message : 'unknown', failedAt: now.toISOString() }));
    }
  }
  return { recorded, failed };
}
