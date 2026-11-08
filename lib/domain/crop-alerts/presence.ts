import type { CropCultivation, CropSeries, ImplantationTask } from '../domain.ts';
import { implantationOfSeries, lastHarvestOfSeries } from '../series/occupation.ts';
import { weekEndDateKeyFromWeekKey, weekStartDateKeyFromWeekKey } from '../week-keys.ts';

/**
 * La culture présente (docs/weather-crop-alerts-contract.md, « Vocabulaire »
 * et « Quelles cultures comptent ») : une culture d'une série, semée ou
 * plantée, qui n'a pas dépassé la dernière de ses semaines de récolte (D-057).
 * Contrairement au suivi par série, une série en bloc compte : une plante gèle
 * où qu'elle soit.
 */

export type CultivationPresence = {
  seriesId: string;
  seriesName: string;
  plantId: string;
  plantName: string;
  /** Lundi de la semaine d'implantation, réalisée sinon prévue. */
  start: string;
  /** Dimanche de la dernière semaine de récolte, réalisée sinon attendue ; `null` : la culture court. */
  end: string | null;
};

/** La période d'une culture, ou `null` quand aucune tâche ne la met au champ. */
export function cultivationPresence(
  series: CropSeries,
  cultivation: CropCultivation,
  tasks: readonly ImplantationTask[],
): CultivationPresence | null {
  const single = { ...series, cultivations: [cultivation] };
  const implantation = implantationOfSeries(single, tasks);
  const start = implantation === null ? null : weekStartDateKeyFromWeekKey(implantation.week);
  if (start === null) return null;
  const lastHarvest = lastHarvestOfSeries(single);
  return {
    seriesId: series.id,
    seriesName: series.name,
    plantId: cultivation.plantId,
    plantName: cultivation.plantName,
    start,
    end: lastHarvest === null ? null : weekEndDateKeyFromWeekKey(lastHarvest.week),
  };
}

/** Une culture est présente un jour donné entre le lundi de son implantation et le dimanche de sa dernière récolte, compris. */
export function isPresentOn(presence: Pick<CultivationPresence, 'start' | 'end'>, date: string): boolean {
  return presence.start <= date && (presence.end === null || presence.end >= date);
}
