import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { plannedIrrigationLateness } from '../planned-irrigation.ts';
import { millisecondsFromMinutes } from '../units.ts';
import type { PlanChanges } from './changes.ts';
import type { PlanSuggestionCause, StoredPlanSuggestion } from './contract.ts';
import { waterDeficitValue } from './water-deficit-summary.ts';

/**
 * La présentation du suivi et de la replanification (3.7,
 * docs/replanning-contract.md, « L'écran ») : les suggestions sur les
 * arrosages validés et leurs raisons, le signal « en retard » ou « non
 * faite », celui d'une irrigation faite pendant un créneau protégé
 * (docs/protected-slots-contract.md, règle 11), et le pli « Ce qui a
 * changé ». Des libellés et des listes, testés ; aucune règle dans les
 * composants.
 */

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const cubicMeters = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MINUTES_PER_HOUR = 60;
/** Sous cinq litres, l'écart du manque d'eau est un arrondi, pas un changement. */
const NEGLIGIBLE_CUBIC_METERS = 0.005;

export type DateFormats = {
  dateTime: (iso: string) => string;
  time: (iso: string) => string;
  day: (dateKey: string) => string;
};

export function suggestionLabel(suggestion: Pick<StoredPlanSuggestion, 'suggestion' | 'doseMm'>): string {
  return suggestion.suggestion === 'reduce' && suggestion.doseMm !== null ? `Réduire à ${mm.format(suggestion.doseMm)} mm` : 'Annuler';
}

/** Sur quoi la suggestion repose (règle 17) : les termes du besoin, le matériel et la date du retrait, la limite et ce que le jour porte. */
export function suggestionCauseLabel(cause: PlanSuggestionCause, format: DateFormats): string {
  switch (cause.kind) {
    case 'useful-dose': {
      const terms = [`${cause.manual ? 'besoin posé à la main' : 'objectif'} ${mm.format(cause.objectiveMm)} mm`];
      if (cause.actualRainMm > 0) terms.push(`pluie au pluviomètre ${mm.format(cause.actualRainMm)} mm`);
      if (cause.forecastRainMm > 0) terms.push(`pluie prévue comptée ${mm.format(cause.forecastRainMm)} mm`);
      if (cause.actualIrrigationMm > 0) terms.push(`déjà arrosé ${mm.format(cause.actualIrrigationMm)} mm`);
      if (cause.earlierPlannedMm > 0) terms.push(`arrosages validés avant celui-ci ${mm.format(cause.earlierPlannedMm)} mm`);
      const need = `besoin utile ${mm.format(cause.usefulMm)} mm pour ${mm.format(cause.plannedMm)} mm prévus`;
      const threshold = cause.usefulMm < cause.minimumMm
        ? `, sous la dose minimale de ${mm.format(cause.minimumMm)} mm${cause.lastDay ? ' (dernier jour de la semaine)' : ''}`
        : '';
      return `${cause.bedName} : ${terms.join(', ')} ; ${need}${threshold}`;
    }
    case 'equipment-stored':
      return `${cause.equipmentName} stocké depuis le ${format.dateTime(cause.removedAt)} : l’irrigation ne peut pas démarrer`;
    case 'equipment-moved':
      return `${cause.equipmentName} reposé ailleurs : l’irrigation ne peut pas démarrer`;
    case 'daily-limit':
      return `limite journalière du ${format.day(cause.date)} : ${cubicMeters.format(cause.limitCubicMeters)} m³ pour ${cubicMeters.format(cause.committedCubicMeters)} m³ engagés`;
    case 'volume-unknown':
      return `volume invérifiable le ${format.day(cause.date)} sous une limite journalière`;
    case 'protected-slot': {
      const where = `cet arrosage tombe dans ${protectedSlotsPhrase(cause.slotNames)}`;
      if (cause.partBeforeMm === null) return `${where} et y commence : rien ne tient avant`;
      const before = `${where} ; la partie avant porte ${mm.format(cause.partBeforeMm)} mm`;
      return cause.partBeforeMm < cause.minimumMm ? `${before}, sous la dose minimale de ${mm.format(cause.minimumMm)} mm` : before;
    }
  }
}

/** Le signal d'une irrigation réelle faite pendant un créneau protégé (règle 11) : enregistrée telle quelle, sans suggestion ; nul quand elle n'y tombe pas. */
export function protectedSlotRealSignal(slotNames: readonly string[]): string | null {
  return slotNames.length === 0 ? null : `Faite pendant ${protectedSlotsPhrase(slotNames)}`;
}

/** « le créneau protégé « Lavage » », ou « les créneaux protégés « Lavage », « Passage » ». */
export function protectedSlotsPhrase(slotNames: readonly string[]): string {
  const quoted = slotNames.map((name) => `« ${name} »`).join(', ');
  return slotNames.length > 1 ? `les créneaux protégés ${quoted}` : `le créneau protégé ${quoted}`;
}

/** Les suggestions à montrer, et celles que « Garder » a tues, repliées. */
export function splitSuggestions(suggestions: readonly StoredPlanSuggestion[]): { active: StoredPlanSuggestion[]; kept: StoredPlanSuggestion[] } {
  return {
    active: suggestions.filter((suggestion) => !suggestion.kept),
    kept: suggestions.filter((suggestion) => suggestion.kept),
  };
}

/**
 * Le signal d'une irrigation planifiée (règles 18 à 20) : « En retard »
 * une tolérance R14 après son heure, « Non faite » tout son créneau passé ;
 * nul autrement. Le logiciel ne l'annule jamais : elle se démarre encore,
 * ou s'annule à la main.
 */
export function latenessLabel(event: IrrigationEventRecord, toleranceMinutes: number, now: Date): string | null {
  const lateness = plannedIrrigationLateness(event, toleranceMinutes, now);
  if (lateness === 'missed') {
    return 'Non faite : le créneau est passé sans démarrage. Elle ne compte plus dans les calculs ; démarrez-la, annulez-la, ou recalculez le plan pour replacer le besoin.';
  }
  if (lateness === 'late') {
    const minutes = Math.floor((now.getTime() - Date.parse(event.equipment.plannedStartAt ?? '')) / millisecondsFromMinutes(1));
    return `En retard : non démarrée ${delayLabel(minutes)} après l’heure prévue. Elle compte encore pour la part de son créneau à venir.`;
  }
  return null;
}

function delayLabel(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

export type PlanChangeLine = { kind: 'proposal' | 'suggestion' | 'unplaced' | 'placed' | 'deficit'; text: string };

export function planChangesTitle(changes: Pick<PlanChanges, 'previousComputedAt'>, format: DateFormats): string {
  return `Ce qui a changé depuis le calcul du ${format.dateTime(changes.previousComputedAt)}`;
}

/** Les lignes du pli « Ce qui a changé » (règle 25) : une lecture, rien à modifier ; vide quand rien n'a changé. */
export function planChangesLines(changes: PlanChanges, format: DateFormats): PlanChangeLine[] {
  const lines: PlanChangeLine[] = [];
  const slot = (value: { startAt: string; endAt: string; doseMm: number }) => `${format.dateTime(value.startAt)} → ${format.time(value.endAt)}, ${mm.format(value.doseMm)} mm`;
  for (const proposal of changes.proposals) {
    const who = `${proposal.equipmentName} · ${proposal.settingName}`;
    const { before, after } = proposal;
    if (proposal.change === 'appeared' && after) lines.push({ kind: 'proposal', text: `Proposition apparue : ${who}, ${slot(after)}` });
    else if (proposal.change === 'removed' && before) lines.push({ kind: 'proposal', text: `Proposition retirée : ${who}, ${slot(before)}` });
    else if (proposal.change === 'moved' && before && after) lines.push({ kind: 'proposal', text: `Proposition déplacée : ${who}, de ${slot(before)} à ${slot(after)}` });
    else if (proposal.change === 'dose-changed' && before && after) lines.push({ kind: 'proposal', text: `Dose changée : ${who}, ${format.dateTime(after.startAt)}, de ${mm.format(before.doseMm)} à ${mm.format(after.doseMm)} mm` });
    else if (before && after) lines.push({ kind: 'proposal', text: `Proposition déplacée et dose changée : ${who}, de ${slot(before)} à ${slot(after)}` });
  }
  for (const suggestion of changes.newSuggestions) {
    lines.push({ kind: 'suggestion', text: `Suggestion nouvelle : ${suggestionLabel(suggestion).toLocaleLowerCase('fr-FR')} ${suggestion.equipmentName}, ${format.dateTime(suggestion.plannedStartAt)}` });
  }
  for (const bed of changes.bedsNowUnplaced) {
    lines.push({ kind: 'unplaced', text: `Désormais non servie : ${bed.bedName} (${bed.plotName}), manque ${mm.format(bed.deficitMm)} mm` });
  }
  for (const bed of changes.bedsNowPlaced) {
    lines.push({ kind: 'placed', text: `De nouveau servie : ${bed.bedName} (${bed.plotName})` });
  }
  const unknownBefore = changes.unknownWaterChainsBefore ?? 0;
  const unknownAfter = changes.unknownWaterChainsAfter ?? 0;
  if (unknownBefore > 0 || unknownAfter > 0) {
    // Une eau inconnue d'un côté : le manque s'y écrit comme la carte, sans écart chiffré (point ouvert 59, D-090).
    const volume = (value: number) => `${cubicMeters.format(value)} m³`;
    const before = waterDeficitValue(changes.waterDeficitBeforeCubicMeters, unknownBefore, volume);
    const after = waterDeficitValue(changes.waterDeficitAfterCubicMeters, unknownAfter, volume);
    if (before !== after) lines.push({ kind: 'deficit', text: `Manque d’eau : ${before.startsWith('au ') ? 'd’' : 'de '}${before} à ${after}` });
    return lines;
  }
  const delta = changes.waterDeficitAfterCubicMeters - changes.waterDeficitBeforeCubicMeters;
  if (Math.abs(delta) >= NEGLIGIBLE_CUBIC_METERS) {
    lines.push({ kind: 'deficit', text: `Manque d’eau : de ${cubicMeters.format(changes.waterDeficitBeforeCubicMeters)} à ${cubicMeters.format(changes.waterDeficitAfterCubicMeters)} m³ (${delta > 0 ? '+' : '−'}${cubicMeters.format(Math.abs(delta))} m³)` });
  }
  return lines;
}
