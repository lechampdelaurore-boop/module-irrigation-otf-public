import { millimetersNumber } from '../display-numbers.ts';
import { addDaysToDateKey, isValidDateKey } from '../water-management.ts';
import { shortDayText } from './today-text.ts';

/**
 * La fenêtre « Noter la pluie » (simplification, lot S2, PR 4,
 * docs/simplification-s2-contract.md, section 7) : la pluie du pluviomètre
 * notée d'un geste, par l'action existante `saveManualRainfallAction`.
 * Aucune règle de pluie ne change : la mesure, 0 mm compris, prime sur la
 * réanalyse et la prévision, et fait recalculer le plan de sa semaine (3.7,
 * règle 4). Ce fichier dit les jours proposés, le jour par défaut, la
 * lecture du chiffre, le mot du bouton et la mesure déjà notée ; la fenêtre
 * les dessine sans rien décider.
 */

/** Sept jours en arrière au plus, jamais un jour futur (l'action le refuse). */
const DAYS_BACK = 7;
/** Les bornes de l'action : de 0 à 1 000 mm. */
const RAIN_MAX_MM = 1000;

export const RAIN_ENTRY_TITLE = 'Noter la pluie';
/** Sous le champ : 0 est une vraie mesure (D-003). */
export const RAIN_ZERO_HINT = 'Pas de pluie ? Notez 0 : c’est une vraie mesure, elle compte.';

export type RainEntryDay = {
  /** `AAAA-MM-JJ`, le jour civil à la ferme. */
  date: string;
  /** « Aujourd’hui », « Hier », « Avant-hier », « Ven. 20 nov. ». */
  label: string;
  /** La mesure déjà notée ce jour-là ; `null` : aucune. */
  measuredMm: number | null;
};

export type RainEntry = {
  days: RainEntryDay[];
  /** Hier, sinon aujourd'hui quand hier n'est pas de la saison (S2-e). */
  defaultDate: string;
};

function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

/**
 * Les jours proposés : aujourd'hui, hier, avant-hier, puis les jours d'avant
 * jusqu'à sept jours en arrière, dans la saison du jour (l'année civile) ;
 * par défaut hier : la pluie lue le matin est tombée la veille (S2-e).
 */
export function rainEntry(input: { today: string; measured: ReadonlyMap<string, number> }): RainEntry {
  const season = input.today.slice(0, 4);
  const days: RainEntryDay[] = [];
  for (let back = 0; back <= DAYS_BACK; back += 1) {
    const date = addDaysToDateKey(input.today, -back);
    if (date.slice(0, 4) !== season) break;
    const label = back === 0 ? 'Aujourd’hui' : back === 1 ? 'Hier' : back === 2 ? 'Avant-hier' : capitalized(shortDayText(date));
    days.push({ date, label, measuredMm: input.measured.get(date) ?? null });
  }
  return { days, defaultDate: days[1]?.date ?? input.today };
}

/**
 * Les gardes de `saveManualRainfallAction`, inchangées et dites ici pour se
 * tester sans session : une date valide, jamais dans le futur, de 0 à
 * 1 000 mm. `null` : la mesure s'enregistre.
 */
export function manualRainfallRefusal(input: { date: string; precipitationMm: number; today: string }): string | null {
  if (!isValidDateKey(input.date) || input.date > input.today) {
    return 'Une mesure réelle doit concerner une date valide, aujourd’hui ou dans le passé.';
  }
  if (!Number.isFinite(input.precipitationMm) || input.precipitationMm < 0 || input.precipitationMm > RAIN_MAX_MM) {
    return 'La pluie mesurée doit être comprise entre 0 et 1 000 mm.';
  }
  return null;
}

export type RainReading =
  | { ok: true; mm: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'out-of-range' };

/**
 * Le chiffre tapé : « 8,5 » ou « 8.5 » → 8,5 ; un champ vide n'est jamais 0
 * (D-003) ; hors de 0 à 1 000, refusé comme l'action le refuse.
 */
export function readRainMm(text: string): RainReading {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };
  if (!/^\d+([.,]\d+)?$/u.test(trimmed)) return { ok: false, reason: 'invalid' };
  const mm = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(mm) || mm < 0 || mm > RAIN_MAX_MM) return { ok: false, reason: 'out-of-range' };
  return { ok: true, mm };
}

/** Le motif d'un chiffre refusé, sous le champ ; `null` pour un champ vide, qui laisse seulement le bouton inactif. */
export function rainReadingProblem(reading: RainReading): string | null {
  if (reading.ok || reading.reason === 'empty') return null;
  return reading.reason === 'invalid' ? 'Tapez un nombre de millimètres, par exemple 8,5.' : `La pluie se note de 0 à ${millimetersNumber(RAIN_MAX_MM)} mm.`;
}

/** « pour hier », « pour aujourd’hui », « pour le ven. 20 nov. ». */
function forDay(day: RainEntryDay): string {
  if (day.label === 'Aujourd’hui' || day.label === 'Hier' || day.label === 'Avant-hier') return `pour ${day.label.toLocaleLowerCase('fr-FR')}`;
  return `pour le ${shortDayText(day.date)}`;
}

/**
 * « 8 mm déjà notés pour hier », « 0 mm déjà noté » (le singulier sous 2) :
 * jamais d'écrasement sans le dire ; `null` sans mesure ce jour-là.
 */
export function rainAlreadyText(day: RainEntryDay): string | null {
  if (day.measuredMm === null) return null;
  return `${millimetersNumber(day.measuredMm)} mm déjà ${day.measuredMm < 2 ? 'noté' : 'notés'} ${forDay(day)}.`;
}

/**
 * Le bouton dit le chiffre : « Enregistrer 8 mm », ou « Remplacer par 5 mm »
 * quand une mesure existe ce jour-là ; « Enregistrer » seul, inactif, tant
 * que le chiffre n'est pas lisible.
 */
export function rainButton(day: RainEntryDay, reading: RainReading): { label: string; enabled: boolean } {
  if (!reading.ok) return { label: 'Enregistrer', enabled: false };
  const mm = `${millimetersNumber(reading.mm)} mm`;
  return { label: day.measuredMm === null ? `Enregistrer ${mm}` : `Remplacer par ${mm}`, enabled: true };
}

const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** « Pluie enregistrée : 8 mm le lundi 15 juin. Le plan se recalcule. » */
export function rainSavedText(date: string, mm: number, planning: boolean): string {
  const said = `Pluie enregistrée : ${millimetersNumber(mm)} mm le ${longDay.format(new Date(`${date}T12:00:00.000Z`))}.`;
  return planning ? `${said} Le plan se recalcule.` : said;
}
