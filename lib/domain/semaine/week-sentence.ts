import { farmObjectiveScopeText, farmObjectivePartial } from '../farm-objective.ts';
import { mmText } from '../figure-origin.ts';
import { SIMPLE_WORDS } from '../simple-words.ts';
import { percentFromFraction } from '../units.ts';
import type { TodayWeek } from '../today/week.ts';
import type { WeekState } from './week-heading.ts';

/**
 * La phrase et le bilan de la page « Semaine » (simplification, lot S4, PR 2,
 * docs/simplification-s4-contract.md, sections 4.2 à 4.4). Ils disent des
 * faits, jamais un jugement : l'objectif est fixé en millimètres par
 * semaine, « il n'existe pas de niveaux qualitatifs » (AGENTS.md, S4-c).
 *
 * Rien ne se calcule de nouveau : l'eau reçue, l'eau visée et ce qui manque
 * sont la ligne de la ferme d'« Eau de la semaine » d'« Aujourd'hui »
 * (`todayWeek`, T4), le volume arrosé est sa tuile « Eau utilisée ». La
 * pluie annoncée n'est jamais ajoutée à ce qui a été reçu (D-006) ; l'ET0
 * n'est pas dans la phrase (D-010) ; une valeur inconnue se dit inconnue,
 * jamais zéro (D-003).
 */

/** Ce que la phrase et le bilan lisent de la ligne de la ferme. */
export type WeekFarmRow = Pick<TodayWeek['farm'], 'objectiveMm' | 'irrigationMm' | 'rainMm' | 'receivedMm' | 'remainingMm' | 'objectiveBeds'>;

const RAIN_EPSILON_MM = 0.05;

function mm(value: number): string {
  return mmText(Math.round(value * 10) / 10);
}

/** « (7 planches de 10 ont un objectif) » quand une partie seulement en a un ; un seul « sur » par phrase (F443). */
function scopeNote(row: WeekFarmRow): string {
  const { withObjective, total } = row.objectiveBeds;
  if (!farmObjectivePartial(row.objectiveBeds)) return '';
  return ` (${withObjective} planche${withObjective > 1 ? 's' : ''} de ${total} ${withObjective > 1 ? 'ont' : 'a'} un objectif)`;
}

/** « 12 mm reçus sur 23 mm visés », ou, la pluie inconnue, « 8 mm irrigués sur 23 mm visés, pluie inconnue ». */
function receivedOnObjective(row: WeekFarmRow, objectiveMm: number): string {
  return row.receivedMm === null
    ? `${mm(row.irrigationMm)} irrigués sur ${mm(objectiveMm)} visés${scopeNote(row)}, pluie inconnue`
    : `${mm(row.receivedMm)} reçus sur ${mm(objectiveMm)} visés${scopeNote(row)}`;
}

/**
 * La pluie annoncée d'une semaine à venir : « 14 mm de pluie annoncés. » ;
 * « Au moins 5 mm de pluie annoncés. » quand des jours n'ont pas de
 * prévision ; « Pluie annoncée non disponible. » quand aucun n'en a. Rien
 * pour une ferme toute sous abri, où la pluie ne compte pas (D-032).
 */
export function announcedRainText(forecastRainMm: readonly (number | null)[], rainMatters: boolean): string | null {
  if (!rainMatters) return null;
  const known = forecastRainMm.filter((value): value is number => value !== null && Number.isFinite(value));
  if (known.length === 0) return SIMPLE_WORDS.rainAnnouncedUnknown;
  const total = known.reduce((sum, value) => sum + Math.max(0, value), 0);
  const text = `${mm(total)} ${SIMPLE_WORDS.rainAnnounced}.`;
  return known.length < forecastRainMm.length ? `Au moins ${text}` : `${text.charAt(0).toLocaleUpperCase('fr-FR')}${text.slice(1)}`;
}

/** « 1 arrosage reste à valider. », « 2 arrosages restent à valider. » : le nombre du plan. */
export function toValidateText(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 arrosage reste à valider.' : `${count} arrosages restent à valider.`;
}

export type WeekSentenceInput = {
  state: WeekState;
  /** La ligne de la ferme ; `null` sans planche de la saison. */
  farm: WeekFarmRow | null;
  /** La pluie prévue de chaque jour de la semaine, pour une semaine à venir. */
  forecastRainMm: readonly (number | null)[];
  /** La pluie compte pour au moins une planche (une ferme toute sous abri : non). */
  rainMatters: boolean;
  /** Les créneaux du plan qui attendent leur validation (semaine en cours, case Planning). */
  toValidate: number;
};

/** La phrase de la page (section 4.2), un cas par état de la semaine. */
export function weekSentence({ state, farm, forecastRainMm, rainMatters, toValidate }: WeekSentenceInput): string {
  const parts: string[] = [];
  const objectiveMm = farm?.objectiveMm ?? null;
  if (farm === null || objectiveMm === null) {
    parts.push(SIMPLE_WORDS.weekNoGoal);
  } else if (state === 'upcoming') {
    parts.push(`${mm(objectiveMm)} visés${scopeNote(farm)}.`);
  } else if (state === 'past') {
    const missed = farm.remainingMm !== null && farm.remainingMm > RAIN_EPSILON_MM ? ` : ${SIMPLE_WORDS.weekMissed} ${mm(farm.remainingMm)}` : '';
    parts.push(`${receivedOnObjective(farm, objectiveMm)}${farm.remainingMm === null ? '' : missed}.`);
  } else {
    parts.push(`${receivedOnObjective(farm, objectiveMm)}.`);
    // Jamais « il manque » négatif : atteint ou dépassé, la phrase s'arrête aux chiffres.
    if (farm.remainingMm === null) parts.push('Ce qui manque est inconnu.');
    else if (farm.remainingMm > RAIN_EPSILON_MM) parts.push(`${SIMPLE_WORDS.stillMissing} ${mm(farm.remainingMm)} d’ici dimanche.`);
  }
  if (state === 'upcoming') {
    const rain = announcedRainText(forecastRainMm, rainMatters);
    if (rain) parts.push(rain);
  }
  if (state === 'current') {
    const waiting = toValidateText(toValidate);
    if (waiting) parts.push(waiting);
  }
  return parts.join(' ');
}

export type WeekBilan = {
  /** La barre, reçus sur visés ; `null` sans objectif (section 4.4). */
  bar: null | {
    irrigationPercent: number;
    rainPercent: number;
    /** La pluie est inconnue : la barre ne dit que l'irrigation, hachurée. */
    unknown: boolean;
    /** « 12 mm reçus sur 23 mm visés ». */
    label: string;
  };
  /** « 12 mm » reçus ; `null` : l'eau reçue est inconnue, jamais zéro (D-003). */
  received: { value: string | null; detail: string | null };
  /** « 23 mm » visés ; `null` : aucune eau visée cette semaine. */
  objective: { value: string | null; detail: string };
  /** « 1,4 m³ » arrosés, « au moins 1,4 m³ » quand une surface mouillée manque. */
  watered: { value: string | null };
};

/**
 * Le bilan (sections 4.3 et 4.4) : la barre, pleine au-delà de 100 % (le
 * chiffre dit le dépassement), et trois chiffres, reçus, visés, arrosés.
 * Le troisième dit ce que le module sait, les m³ arrosés, jamais d'où
 * l'eau vient (S4-d).
 */
export function weekBilan(week: Pick<TodayWeek, 'farm' | 'tiles'>): WeekBilan {
  const { farm, tiles } = week;
  const objectiveMm = farm.objectiveMm;
  const percent = (value: number) => (objectiveMm === null || objectiveMm <= 0 ? 0 : Math.round(percentFromFraction(Math.min(1, Math.max(0, value / objectiveMm))) * 10) / 10);
  const irrigationPercent = percent(farm.irrigationMm);
  return {
    bar: objectiveMm === null ? null : {
      irrigationPercent,
      rainPercent: farm.rainMm === null ? 0 : Math.max(0, Math.round((percent(farm.irrigationMm + farm.rainMm) - irrigationPercent) * 10) / 10),
      unknown: farm.rainMm === null,
      label: receivedOnObjective(farm, objectiveMm),
    },
    received: { value: tiles.received, detail: tiles.receivedDetail },
    objective: {
      value: tiles.objective,
      detail: farmObjectiveScopeText(farm.objectiveBeds),
    },
    watered: { value: tiles.water },
  };
}
