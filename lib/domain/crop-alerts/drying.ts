import type { CropSeries } from '../domain.ts';
import { pageHref } from '../features/pages.ts';
import { addDaysToDateKey, isValidDateKey } from '../water-management.ts';
import { isWeekKey, weekEndDateKeyFromWeekKey, weekStartDateKeyFromWeekKey } from '../week-keys.ts';
import type { CropAlertNotification } from './frost.ts';
import { fitPushBody, pushTag } from './push.ts';
import { bedsText, dayText, lowerFirst, upperFirst } from './text.ts';
import { resolveDryingDays, type CropAlertCommonEntry, type DryingRevision, type FrostLinkRevision } from './thresholds.ts';

/**
 * L'arrêt d'arrosage avant récolte, le « séchage »
 * (docs/weather-crop-alerts-contract.md, « L'arrêt d'arrosage avant
 * récolte ») : une échéance du plan de culture, pas une prévision météo. La
 * date d'arrêt est le lundi de la première semaine de récolte encore attendue
 * de la série, moins le délai de l'espèce ; l'alerte part ce jour-là, ou le
 * premier matin qui la voit si elle est passée mais que la récolte n'a pas
 * commencé ; une seule fois par série. Elle ne touche ni l'objectif ni la
 * proposition (D-010, D-028).
 */

export type DryingDeadline = {
  seriesId: string;
  seriesName: string;
  season: number;
  plantId: string;
  plantName: string;
  dryingDays: number;
  /** Le lundi de la première semaine de récolte encore attendue. */
  harvestStart: string;
  /** Le premier jour sans arrosage. */
  stopDate: string;
  /** Les planches de la série ; aucune pour une série en bloc. */
  bedNames: string[];
};

export type DryingEvaluation = {
  /** Les séries dont la date d'arrêt est venue et qui n'ont pas encore eu leur alerte. */
  due: DryingDeadline[];
  /** Les dates d'arrêt à venir, pour l'écran. */
  upcoming: DryingDeadline[];
};

/**
 * Évalue le séchage le jour `today` à la ferme. Une culture déjà récoltée
 * (une semaine de récolte réalisée), sans semaine de récolte encore attendue
 * ou sans délai n'a pas d'échéance (D-003). Une série qui porte plusieurs
 * cultures à délai garde la plus proche.
 */
export function evaluateDrying(input: {
  series: readonly CropSeries[];
  bedNamesBySeries: ReadonlyMap<string, readonly string[]>;
  frostRevisions: readonly FrostLinkRevision[];
  dryingRevisions: readonly DryingRevision[];
  common: ReadonlyMap<string, CropAlertCommonEntry>;
  today: string;
  alertedSeriesIds: ReadonlySet<string>;
}): DryingEvaluation {
  if (!isValidDateKey(input.today)) throw new Error('Jour invalide.');
  const due: DryingDeadline[] = [];
  const upcoming: DryingDeadline[] = [];
  for (const series of input.series) {
    let deadline: DryingDeadline | null = null;
    for (const cultivation of series.cultivations) {
      const dryingDays = resolveDryingDays({
        plantId: cultivation.plantId,
        seriesId: series.id,
        frostRevisions: input.frostRevisions,
        dryingRevisions: input.dryingRevisions,
        common: input.common,
      });
      if (dryingDays === null || dryingDays <= 0) continue;
      if (cultivation.harvestWeeks.some(isWeekKey)) continue;
      const harvestStart = cultivation.harvestWeeksExpected
        .filter((week) => isWeekKey(week) && (weekEndDateKeyFromWeekKey(week) ?? '') >= input.today)
        .map((week) => weekStartDateKeyFromWeekKey(week) as string)
        .sort()[0];
      if (harvestStart === undefined) continue;
      const stopDate = addDaysToDateKey(harvestStart, -dryingDays);
      if (deadline !== null && deadline.stopDate <= stopDate) continue;
      deadline = {
        seriesId: series.id,
        seriesName: series.name,
        season: series.season,
        plantId: cultivation.plantId,
        plantName: cultivation.plantName,
        dryingDays,
        harvestStart,
        stopDate,
        bedNames: [...(input.bedNamesBySeries.get(series.id) ?? [])],
      };
    }
    if (deadline === null) continue;
    if (deadline.stopDate > input.today) upcoming.push(deadline);
    else if (!input.alertedSeriesIds.has(series.id)) due.push(deadline);
  }
  const order = (a: DryingDeadline, b: DryingDeadline) => a.stopDate.localeCompare(b.stopDate) || a.seriesName.localeCompare(b.seriesName, 'fr');
  return { due: due.sort(order), upcoming: upcoming.sort(order) };
}

/**
 * La notification des séries échues le même matin, toutes ensemble : par
 * espèce et par jour de récolte, « ail, planches 12 et 14 ; récolte attendue
 * à partir du lundi 20 juillet ».
 */
export function dryingNotification(due: readonly DryingDeadline[]): CropAlertNotification | null {
  if (due.length === 0) return null;
  const groups = new Map<string, DryingDeadline[]>();
  for (const deadline of due) {
    const key = `${deadline.plantName}|${deadline.harvestStart}`;
    groups.set(key, [...(groups.get(key) ?? []), deadline]);
  }
  const sentences = [...groups.values()].map((deadlines, index) => {
    const first = deadlines[0];
    const beds = deadlines.flatMap((deadline) => deadline.bedNames);
    const blocks = deadlines.filter((deadline) => deadline.bedNames.length === 0).map((deadline) => `série ${deadline.seriesName} en bloc`);
    const places = [beds.length > 0 ? bedsText(beds) : null, ...blocks].filter((place): place is string => place !== null).join(', ');
    const name = index === 0 ? lowerFirst(first.plantName) : upperFirst(first.plantName);
    return `${name}, ${places} ; récolte attendue à partir du ${dayText(first.harvestStart)}.`;
  });
  const first = due[0];
  return {
    title: 'Alerte récolte',
    body: fitPushBody(`Cessez d’arroser avant la récolte : ${sentences.join(' ')}`),
    tag: pushTag('crop-drying', due.map((deadline) => deadline.seriesId)),
    // La page des alertes cultures, que la case qui l'envoie garantit (3.8, P31).
    url: pageHref('alertes-cultures', { season: first.season }),
    targetDates: [...new Set(due.map((deadline) => deadline.stopDate))].sort(),
  };
}
