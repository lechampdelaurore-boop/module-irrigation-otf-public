import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import type { BedIrrigationNeed, IrrigationNeedPriority } from '../irrigation-needs.ts';
import { durationSecondsForTarget, millimetersForDurationSeconds } from '../irrigation-timer.ts';
import { remainingPlannedApplications } from '../planned-irrigation.ts';
import { cubicMetersFromMillimeters, millisecondsFromMinutes, millisecondsFromSeconds, secondsForMillimeters, secondsFromMilliseconds } from '../units.ts';
import { buildDailyWaterLedger, dateKeyInTimeZone, irrigationVolumeIncomplete, latestApplicableLimit, localDateStartUtc, splitVolumeAcrossLocalDays } from '../water-management.ts';
import type { KeptSuggestion, OvercommittedDay, PlanSuggestion, PlanSuggestionCause, PlanningInputs, StoredPlanSuggestion } from './contract.ts';
import { PRIORITY_RANK, remainingNeedExcludingMm } from './demand.ts';
import { protectedIntervalsBetween } from './protected-slots.ts';
import type { PlanningSettings } from './settings.ts';
import { datesBetween } from './supply.ts';

/**
 * Les suggestions sur les arrosages validés (docs/replanning-contract.md,
 * règles 11 à 17 ; docs/planning-contract.md, « Les suggestions sur les
 * arrosages validés »). Le moteur ne modifie ni n'annule jamais une
 * irrigation validée : à chaque calcul, pour chaque arrosage encore à venir
 * et non démarré, il calcule la dose utile avec ses propres règles et suggère
 * « Annuler » ou « Réduire à X mm » ; le maraîcher décide (D-028). Une
 * irrigation que la 2.11 empêche de démarrer, qu'une limite journalière
 * posée après coup ferait refuser, ou qui tombe dans un créneau protégé
 * (docs/protected-slots-contract.md, règles 9 et 10), reçoit la sienne. Rien
 * ici n'écrit : des fonctions pures sur les entrées du calcul.
 */

const EPSILON = 1e-9;
/** Un reste sous un centième de millimètre est un résidu d'arrondi, pas un besoin. */
const NEGLIGIBLE_MM = 0.01;
/** La bissection sur la fraction de dose d'un niveau : quarante pas la fixent au-delà du millionième. */
const FRACTION_STEPS = 40;
/** Les doses s'affichent au dixième de millimètre : deux doses égales à ce dixième sont la même dose. */
const DISPLAYED_TENTHS = 10;

export type SuggestionBounds = {
  horizonStart: Date;
  weekEndAt: Date;
  /** Le dernier jour de planning, qui tolère une dose sous le minimum ; absent quand la semaine n'a plus de jour. */
  lastDay: string | undefined;
};

/** Un arrosage validé examiné : ses planches et leurs taux viennent de lui, pas de la couverture du jour. */
type Candidate = {
  event: IrrigationEventRecord;
  startMs: number;
  endMs: number;
  durationSeconds: number;
  /** Les planches qu'il arrose vraiment. */
  watered: IrrigationEventRecord['equipment']['applications'];
  /** La plus haute priorité de ses planches ; normale quand aucune n'a de besoin. */
  priority: IrrigationNeedPriority;
};

type Verdict = { suggestion: 'cancel' } | { suggestion: 'reduce'; doseMm: number; durationSeconds: number };

export function buildPlanSuggestions(inputs: PlanningInputs, settings: PlanningSettings, bounds: SuggestionBounds): { suggestions: PlanSuggestion[]; overcommittedDays: OvercommittedDay[] } {
  const needsByBed = new Map(inputs.needs.map((need) => [need.bedId, need]));
  const toCandidate = (event: IrrigationEventRecord) => upcomingCandidate(event, bounds, needsByBed);
  const candidates = inputs.events.flatMap((event) => toCandidate(event) ?? []).sort(compareCandidates);
  const merged = new Map<string, PlanSuggestion>();
  const keep = (suggestion: PlanSuggestion) => {
    const current = merged.get(suggestion.eventEquipmentId);
    merged.set(suggestion.eventEquipmentId, current ? stronger(current, suggestion) : suggestion);
  };

  // Règles 12 à 15 : la dose utile, dans l'ordre du temps. Chaque arrosage compte ceux qui le précèdent, pas lui-même ni ceux qui le suivent.
  const windowStart = new Date(Math.max(inputs.now.getTime(), localDateStartUtc(inputs.weekStart, inputs.timeZone).getTime()));
  const countedByCandidate = candidates.map((candidate) => countedMillimetersByBed(candidate.event, windowStart, bounds.weekEndAt));
  for (let index = 0; index < candidates.length; index += 1) {
    const excluded = new Map<string, number>();
    for (let later = index; later < candidates.length; later += 1) {
      for (const [bedId, mm] of countedByCandidate[later]) excluded.set(bedId, (excluded.get(bedId) ?? 0) + mm);
    }
    const suggestion = usefulDoseSuggestion(candidates[index], excluded, needsByBed, settings, bounds, inputs.timeZone);
    if (suggestion) keep(suggestion);
  }

  // Règle 16 : un matériel retiré, ou reposé ailleurs, n'arrosera pas (2.11, D-044) ; reposé au même endroit, l'arrosage compte de nouveau et la suggestion disparaît.
  for (const { event, block } of inputs.blockedIrrigations ?? []) {
    const candidate = toCandidate(event);
    if (!candidate) continue;
    const equipmentName = event.equipment.equipmentSnapshot.name;
    const cause: PlanSuggestionCause = block.code === 'equipment_stored'
      ? { kind: 'equipment-stored', equipmentName, removedAt: block.removedAt }
      : { kind: 'equipment-moved', equipmentName };
    keep(suggestionFor(candidate, settings, { suggestion: 'cancel' }, [cause]));
  }

  // Règle 16 : une limite journalière posée après coup.
  const limited = dailyLimitSuggestions(candidates, inputs, settings, bounds);
  for (const suggestion of limited.suggestions) keep(suggestion);

  // Un créneau protégé posé après coup, ou un arrosage validé avant lui (docs/protected-slots-contract.md, règles 9 et 10).
  for (const candidate of candidates) {
    const suggestion = protectedSlotSuggestion(candidate, inputs, settings);
    if (suggestion) keep(suggestion);
  }

  return {
    suggestions: [...merged.values()].sort((left, right) => Date.parse(left.plannedStartAt) - Date.parse(right.plannedStartAt) || left.eventId.localeCompare(right.eventId)),
    overcommittedDays: limited.days,
  };
}

/**
 * « Garder » fait taire une suggestion (règle 17) : elle ne revient que si
 * un calcul suivant en fait une autre — une autre dose, au dixième de
 * millimètre affiché, ou « Annuler » après « Réduire ».
 */
export function markKeptSuggestions(suggestions: readonly PlanSuggestion[], kept: readonly KeptSuggestion[]): StoredPlanSuggestion[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    kept: kept.some((entry) => entry.eventEquipmentId === suggestion.eventEquipmentId && entry.suggestion === suggestion.suggestion
      && (suggestion.suggestion === 'cancel' || sameDisplayedDose(entry.doseMm, suggestion.doseMm))),
  }));
}

function sameDisplayedDose(left: number | null, right: number | null): boolean {
  return left !== null && right !== null && Math.round(left * DISPLAYED_TENTHS) === Math.round(right * DISPLAYED_TENTHS);
}

// ---------------------------------------------------------------------------
// Les arrosages examinés
// ---------------------------------------------------------------------------

/**
 * Un arrosage validé encore à venir et non démarré : planifié, dans la
 * semaine du plan, après le calcul. Un arrosage en cours n'en est pas
 * (règle 12), un arrosage en retard non plus : le retard a sa propre règle.
 */
function upcomingCandidate(event: IrrigationEventRecord, bounds: SuggestionBounds, needsByBed: ReadonlyMap<string, BedIrrigationNeed>): Candidate | null {
  const equipment = event.equipment;
  if (event.status !== 'planned' || equipment.status !== 'planned') return null;
  if (equipment.actualStartAt !== null || equipment.timerState !== null || equipment.remainingCanceledAt !== null || equipment.canceledAt !== null) return null;
  const startMs = Date.parse(equipment.plannedStartAt ?? '');
  const endMs = Date.parse(equipment.plannedEndAt ?? '');
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  if (startMs < bounds.horizonStart.getTime() || startMs >= bounds.weekEndAt.getTime()) return null;
  const watered = equipment.applications.filter((application) => application.plannedAmountMm > 0 && application.rateMmPerHour > 0);
  if (watered.length === 0) return null;
  const priorities = watered.flatMap((application) => needsByBed.get(application.otfBedId)?.priority ?? []);
  const priority = priorities.length === 0 ? 'normal' : priorities.reduce((best, candidate) => (PRIORITY_RANK[candidate] < PRIORITY_RANK[best] ? candidate : best));
  const durationSeconds = equipment.plannedDurationSeconds > 0 ? equipment.plannedDurationSeconds : Math.max(1, Math.round(secondsFromMilliseconds(endMs - startMs)));
  return { event, startMs, endMs, durationSeconds, watered, priority };
}

function compareCandidates(left: Candidate, right: Candidate): number {
  return left.startMs - right.startMs || left.event.id.localeCompare(right.event.id);
}

/** Ce que la 3.3 a déduit du besoin pour cet arrosage, planche par planche : la même lecture que `plannedIrrigationMm`. */
function countedMillimetersByBed(event: IrrigationEventRecord, windowStart: Date, weekEndAt: Date): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of remainingPlannedApplications([event], windowStart, weekEndAt)) result.set(row.bedId, (result.get(row.bedId) ?? 0) + row.amountMm);
  return result;
}

/** Les planches qui commandent l'arrosage : leur taux atteint la part R13 du plus fort (D-025), la mieux arrosée d'abord. */
function commandingApplications(candidate: Candidate, settings: PlanningSettings): Candidate['watered'] {
  const strongest = candidate.watered.reduce((best, application) => Math.max(best, application.rateMmPerHour), 0);
  return candidate.watered
    .filter((application) => application.rateMmPerHour + EPSILON >= settings.commandingRateShare * strongest)
    .sort((left, right) => right.rateMmPerHour - left.rateMmPerHour || left.otfBedId.localeCompare(right.otfBedId));
}

/** La dose prévue de référence d'un arrosage : celle de sa planche la mieux arrosée parmi celles qui le commandent. */
function referenceDoseMm(candidate: Candidate, settings: PlanningSettings): number {
  return commandingApplications(candidate, settings)[0]?.plannedAmountMm ?? 0;
}

function suggestionFor(candidate: Candidate, settings: PlanningSettings, verdict: Verdict, causes: PlanSuggestionCause[], plannedDoseMm = referenceDoseMm(candidate, settings)): PlanSuggestion {
  const equipment = candidate.event.equipment;
  const reduced = verdict.suggestion === 'reduce' ? verdict : null;
  return {
    eventId: candidate.event.id,
    eventEquipmentId: equipment.id,
    equipmentId: equipment.equipmentId,
    equipmentName: equipment.equipmentSnapshot.name,
    kind: equipment.equipmentSnapshot.kind,
    priority: candidate.priority,
    plannedStartAt: new Date(candidate.startMs).toISOString(),
    plannedEndAt: new Date(candidate.endMs).toISOString(),
    plannedDurationSeconds: candidate.durationSeconds,
    plannedDoseMm,
    suggestion: verdict.suggestion,
    doseMm: reduced?.doseMm ?? null,
    durationSeconds: reduced?.durationSeconds ?? null,
    endAt: reduced ? new Date(candidate.startMs + millisecondsFromSeconds(reduced.durationSeconds)).toISOString() : null,
    causes,
  };
}

/** De deux suggestions sur le même arrosage, la plus forte : « Annuler » avant « Réduire », la dose la plus basse entre deux réductions ; les raisons s'ajoutent. */
function stronger(left: PlanSuggestion, right: PlanSuggestion): PlanSuggestion {
  const leftWins = left.suggestion === right.suggestion ? (left.doseMm ?? 0) <= (right.doseMm ?? 0) : left.suggestion === 'cancel';
  const [winner, loser] = leftWins ? [left, right] : [right, left];
  return { ...winner, causes: [...winner.causes, ...loser.causes] };
}

// ---------------------------------------------------------------------------
// La dose utile (règles 12 à 15)
// ---------------------------------------------------------------------------

/**
 * La dose utile d'un arrosage validé (règle 12) : parmi les planches qui le
 * commandent (R13), celle qui fixe la dose est la mieux arrosée, à taux égal
 * celle du besoin le plus élevé ou le plus faible (R11) ; sa dose est son
 * besoin d'avant l'arrosage — le réel, la pluie selon R2, les arrosages
 * validés qui précèdent —, plafonné (R5), et aucune planche ne reçoit plus
 * que la dose maximale. Sous la dose minimale, « Annuler » (règle 13), sauf
 * le dernier jour quand il reste quelque chose ; une dose prévue qui dépasse
 * la dose utile d'au moins la dose minimale, « Réduire » (règle 14) ; un
 * arrosage devenu insuffisant n'est jamais allongé (règle 15). Une planche
 * sans besoin calculable ne compte pas ; si aucune ne l'a, rien n'est suggéré.
 */
function usefulDoseSuggestion(
  candidate: Candidate,
  excluded: ReadonlyMap<string, number>,
  needsByBed: ReadonlyMap<string, BedIrrigationNeed>,
  settings: PlanningSettings,
  bounds: SuggestionBounds,
  timeZone: string,
): PlanSuggestion | null {
  const dose = settings.doses[candidate.event.equipment.equipmentSnapshot.kind];
  const assessed = commandingApplications(candidate, settings).flatMap((application) => {
    const need = needsByBed.get(application.otfBedId);
    if (!need) return [];
    const excludedMm = excluded.get(application.otfBedId) ?? 0;
    const beforeMm = remainingNeedExcludingMm(need, settings, excludedMm);
    return beforeMm === null ? [] : [{ application, need, excludedMm, beforeMm }];
  });
  if (assessed.length === 0) return null;
  const inNeed = assessed.filter((entry) => entry.beforeMm > NEGLIGIBLE_MM);
  const reference = (inNeed.length > 0 ? inNeed : assessed).reduce((best, entry) => {
    const gap = entry.application.rateMmPerHour - best.application.rateMmPerHour;
    if (gap > EPSILON) return entry;
    if (gap < -EPSILON) return best;
    if (settings.collectiveDoseRule === 'highest-need') return entry.beforeMm > best.beforeMm + EPSILON ? entry : best;
    return entry.beforeMm < best.beforeMm - EPSILON ? entry : best;
  });
  let usefulMm = 0;
  if (inNeed.length > 0) {
    let seconds = durationSecondsForTarget(Math.min(reference.beforeMm, dose.maximumMm), reference.application.rateMmPerHour);
    for (const application of candidate.watered) {
      const cap = Math.max(1, Math.floor(secondsForMillimeters(dose.maximumMm, application.rateMmPerHour)));
      if (cap < seconds) seconds = cap;
    }
    usefulMm = millimetersForDurationSeconds(reference.application.rateMmPerHour, seconds);
  }
  const { need } = reference;
  const plannedMm = reference.application.plannedAmountMm;
  const lastDay = bounds.lastDay !== undefined && dateKeyInTimeZone(new Date(candidate.startMs), timeZone) >= bounds.lastDay;
  const cause: PlanSuggestionCause = {
    kind: 'useful-dose',
    bedId: need.bedId,
    bedName: need.bedName,
    objectiveMm: need.manualOverrideMm ?? need.objectiveMm ?? 0,
    manual: need.manualOverrideMm !== null,
    actualRainMm: need.sheltered ? 0 : Math.max(0, need.actualRainMm ?? 0),
    forecastRainMm: need.sheltered ? 0 : settings.forecastRainShare * Math.max(0, need.forecastRainMm ?? 0),
    actualIrrigationMm: Math.max(0, need.actualIrrigationMm),
    earlierPlannedMm: Math.max(0, need.plannedIrrigationMm - reference.excludedMm),
    needBeforeMm: reference.beforeMm,
    usefulMm,
    plannedMm,
    minimumMm: dose.minimumMm,
    lastDay,
  };
  const tooSmall = usefulMm < dose.minimumMm - EPSILON && !(lastDay && usefulMm > NEGLIGIBLE_MM);
  if (tooSmall) return suggestionFor(candidate, settings, { suggestion: 'cancel' }, [cause], plannedMm);
  if (plannedMm - usefulMm >= dose.minimumMm - EPSILON) {
    // La durée suit la dose au prorata, la fin suit le début, comme un ajustement 3.6.
    const durationSeconds = Math.max(1, Math.round(candidate.durationSeconds * usefulMm / plannedMm));
    return suggestionFor(candidate, settings, { suggestion: 'reduce', doseMm: usefulMm, durationSeconds }, [cause], plannedMm);
  }
  return null;
}

// ---------------------------------------------------------------------------
// La limite journalière posée après coup (règle 16)
// ---------------------------------------------------------------------------

/**
 * Quand les irrigations d'un jour — réalisées, en cours, validées — dépassent
 * sa limite journalière, le jour est signalé : ces irrigations seront
 * refusées au démarrage (2.8). Les arrosages validés à venir sont réduits
 * jusqu'à la limite en suivant la conduite en pénurie (R9) à l'envers : la
 * priorité haute est servie d'abord, puis la normale, puis la basse ; dans
 * le niveau entamé, chaque arrosage garde la même fraction de sa dose, la
 * plus grande qui tienne sous la limite ; une réduction sous la dose
 * minimale devient « Annuler », et les autres se recalculent sans elle. Un
 * arrosage au volume invérifiable — une aspersion sur une planche sans
 * passe-pied — est signalé de même : « Annuler », ou renseigner le passe-pied
 * dans Ouvre ta ferme.
 */
function dailyLimitSuggestions(candidates: readonly Candidate[], inputs: PlanningInputs, settings: PlanningSettings, bounds: SuggestionBounds): { suggestions: PlanSuggestion[]; days: OvercommittedDay[] } {
  const suggestions: PlanSuggestion[] = [];
  const days: OvercommittedDay[] = [];
  if (inputs.dailyLimits.length === 0 || !(bounds.weekEndAt > bounds.horizonStart)) return { suggestions, days };
  const { timeZone } = inputs;
  const committedByDate = new Map(buildDailyWaterLedger(inputs.events, inputs.now, timeZone)
    .map((row) => [row.date, row.realizedCubicMeters + row.plannedCubicMeters + (row.estimatedOngoingCubicMeters ?? 0)]));
  for (const date of datesBetween(bounds.horizonStart, bounds.weekEndAt, timeZone)) {
    const limit = latestApplicableLimit(inputs.dailyLimits, date);
    if (!limit?.enabled || limit.maxCubicMetersPerDay === null) continue;
    const committed = committedByDate.get(date) ?? 0;
    if (committed <= limit.maxCubicMetersPerDay + EPSILON) continue;
    days.push({ date, limitCubicMeters: limit.maxCubicMetersPerDay, committedCubicMeters: committed });
    const cause: PlanSuggestionCause = { kind: 'daily-limit', date, limitCubicMeters: limit.maxCubicMetersPerDay, committedCubicMeters: committed };
    const reducible: Candidate[] = [];
    for (const candidate of candidates) {
      if (!splitVolumeAcrossLocalDays({ startAt: new Date(candidate.startMs), endAt: new Date(candidate.endMs), cubicMeters: 1, timeZone }).has(date)) continue;
      if (irrigationVolumeIncomplete(candidate.watered, 'planned')) suggestions.push(suggestionFor(candidate, settings, { suggestion: 'cancel' }, [{ kind: 'volume-unknown', date }]));
      else reducible.push(candidate);
    }
    const fullVolume = (candidate: Candidate) => dayVolume(candidate, date, candidate.durationSeconds, timeZone);
    // Ce que la limite laisse aux arrosages réductibles, une fois le reste du jour compté ; négatif quand le reste seul la dépasse.
    let budget = limit.maxCubicMetersPerDay - (committed - reducible.reduce((sum, candidate) => sum + fullVolume(candidate), 0));
    for (const level of ['high', 'normal', 'low'] as const) {
      const group = reducible.filter((candidate) => candidate.priority === level);
      if (group.length === 0) continue;
      const total = group.reduce((sum, candidate) => sum + fullVolume(candidate), 0);
      if (total <= budget + EPSILON) {
        budget -= total;
        continue;
      }
      let active = [...group];
      for (;;) {
        const fraction = largestFractionWithin(active, date, budget, timeZone);
        const dropped = active.filter((candidate) => reducedDose(candidate, fraction, settings).doseMm < settings.doses[candidate.event.equipment.equipmentSnapshot.kind].minimumMm - EPSILON);
        for (const candidate of dropped) suggestions.push(suggestionFor(candidate, settings, { suggestion: 'cancel' }, [cause]));
        active = active.filter((candidate) => !dropped.includes(candidate));
        if (dropped.length === 0 || active.length === 0) {
          for (const candidate of active) suggestions.push(suggestionFor(candidate, settings, { suggestion: 'reduce', ...reducedDose(candidate, fraction, settings) }, [cause]));
          break;
        }
      }
      budget = 0;
    }
  }
  return { suggestions, days };
}

/** La durée d'une fraction de dose : au prorata, à la seconde inférieure, pour rester sous la limite. */
function durationAt(candidate: Candidate, fraction: number): number {
  return Math.max(1, Math.floor(candidate.durationSeconds * fraction));
}

/** Une fraction de la dose : la durée au prorata, et la dose qui suit la durée. */
function reducedDose(candidate: Candidate, fraction: number, settings: PlanningSettings): { doseMm: number; durationSeconds: number } {
  const durationSeconds = durationAt(candidate, fraction);
  return { doseMm: referenceDoseMm(candidate, settings) * durationSeconds / candidate.durationSeconds, durationSeconds };
}

/** La plus grande fraction de dose, commune au niveau, dont les volumes du jour tiennent dans ce qui reste de la limite. */
function largestFractionWithin(group: readonly Candidate[], date: string, budget: number, timeZone: string): number {
  if (budget <= 0) return 0;
  const volumeAt = (fraction: number) => group.reduce((sum, candidate) => sum + dayVolume(candidate, date, durationAt(candidate, fraction), timeZone), 0);
  if (volumeAt(1) <= budget + EPSILON) return 1;
  let low = 0;
  let high = 1;
  for (let step = 0; step < FRACTION_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (volumeAt(middle) <= budget + EPSILON) low = middle;
    else high = middle;
  }
  return low;
}

/** Le volume d'un arrosage sur un jour civil, pour une durée donnée : ses millimètres au prorata, sur les surfaces mouillées connues, répartis sur ses jours. */
function dayVolume(candidate: Candidate, date: string, durationSeconds: number, timeZone: string): number {
  if (durationSeconds <= 0) return 0;
  const cubicMeters = candidate.watered.reduce((sum, application) => (application.wettedAreaSquareMeters === null
    ? sum
    : sum + cubicMetersFromMillimeters(application.plannedAmountMm * durationSeconds / candidate.durationSeconds, application.wettedAreaSquareMeters)), 0);
  return splitVolumeAcrossLocalDays({ startAt: new Date(candidate.startMs), endAt: new Date(candidate.startMs + millisecondsFromSeconds(durationSeconds)), cubicMeters, timeZone }).get(date) ?? 0;
}

// ---------------------------------------------------------------------------
// Les créneaux protégés (docs/protected-slots-contract.md, règles 9 et 10)
// ---------------------------------------------------------------------------

/**
 * Un arrosage validé qui tombe dans un créneau protégé — créneau posé après
 * coup, ou arrosage validé avant — compte comme avant jusqu'au geste du
 * maraîcher (règle 9). Si peu qu'il y entre, le moteur suggère « Réduire à
 * X mm » quand la partie avant le premier créneau protégé porte la dose
 * minimale de sa nature, sans tolérance du dernier jour (règle 5) — la durée
 * suit la dose, la fin suit le début —, et « Annuler » sinon, ou quand il
 * commence dedans (règle 10).
 */
function protectedSlotSuggestion(candidate: Candidate, inputs: PlanningInputs, settings: PlanningSettings): PlanSuggestion | null {
  const crossed = protectedIntervalsBetween(inputs.protectedSlots, new Date(candidate.startMs), new Date(candidate.endMs), inputs.timeZone);
  if (crossed.length === 0) return null;
  const slotNames = [...new Set(crossed.flatMap((interval) => interval.names))];
  const minimumMm = settings.doses[candidate.event.equipment.equipmentSnapshot.kind].minimumMm;
  // À la minute entière inférieure : « Appliquer » arrondit la durée à la minute, et la fin réduite ne doit pas entrer dans le créneau.
  const wholeMinutes = Math.floor((crossed[0].startMs - candidate.startMs) / millisecondsFromMinutes(1));
  const beforeSeconds = Math.min(candidate.durationSeconds, secondsFromMilliseconds(millisecondsFromMinutes(wholeMinutes)));
  const partBeforeMm = beforeSeconds > 0 ? referenceDoseMm(candidate, settings) * beforeSeconds / candidate.durationSeconds : null;
  const cause: PlanSuggestionCause = { kind: 'protected-slot', slotNames, partBeforeMm, minimumMm };
  if (partBeforeMm === null || partBeforeMm < minimumMm - EPSILON) return suggestionFor(candidate, settings, { suggestion: 'cancel' }, [cause]);
  return suggestionFor(candidate, settings, { suggestion: 'reduce', doseMm: partBeforeMm, durationSeconds: beforeSeconds }, [cause]);
}
