import { millimetersText } from '../display-numbers.ts';
import type { SectionHelp } from '../features/help.ts';
import { SIMPLE_WORDS } from '../simple-words.ts';
import { HOURS_PER_DAY, millisecondsFromHours } from '../units.ts';
import {
  dayShape,
  HIGH_DEMAND_SHARE_OF_DAILY_MAXIMUM,
  hoursOfDay,
  readDayShape,
  type DayShape,
  type HourlyEt0Nature,
  type RecordedDayShape,
} from '../weather/hourly-et0.ts';
import { farmHourText } from './today-text.ts';

/**
 * « Soif du jour, heure par heure » dans le pli « Le détail »
 * d'« Aujourd'hui » (docs/et0-horaire-contract.md, § 4.5 et § 7 ; D-350) :
 * une phrase, une petite courbe de la journée, les heures de forte
 * évaporation et un « ? ». Une information seulement : rien ici n'entre dans
 * la jauge, l'objectif, le besoin ni une alerte (question 1).
 *
 * La forme est celle du lieu de la ferme, lue avec la source de la ligne du
 * jour de la ferme (§ 9) : jamais la forme d'un autre modèle. Sans forme
 * écrite pour cette source, la forme théorique du soleil, et la phrase le dit.
 * Sans ET0 du jour, aucune courbe ni aucun millimètre, jamais 0 (scénario 8).
 */

export const DAY_CURVE_TITLE = `${SIMPLE_WORDS.thirstOfDay}, heure par heure`;

/** Une forme lue il y a plus de 6 heures un jour de prévision est dite « ancienne » (§ 4.5). */
const DAY_SHAPE_OLD_AFTER_HOURS = 6;

const percent = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });

export type TodayDayCurveInputs = {
  /** Le jour de la ferme. */
  date: string;
  /** Le fuseau et la position du lieu de la météo de la ferme. */
  timeZone: string;
  location: { latitude: number; longitude: number };
  /** L'ET0 du jour de la ferme, et la source de sa ligne ; `null` quand elle manque. */
  et0: { mm: number; source: string } | null;
  /** Les formes écrites du lieu pour ce jour, toutes sources : seule celle de la source de l'ET0 sert. */
  recorded: readonly (RecordedDayShape & { source: string; fetchedAt: string })[];
};

type TodayDayCurveBar = {
  /** « 14 h » : l'heure d'horloge du début, au lieu. */
  hour: string;
  /** La hauteur de la barre, de 0 à 100 : la part de l'heure rapportée à la plus forte du jour. */
  heightPercent: number;
  /** L'infobulle : « 14 h : 13,6 % de la journée, environ 0,3 mm ». */
  title: string;
  /** L'heure en cours. */
  current: boolean;
  /** Une heure de la plage de forte évaporation. */
  strong: boolean;
};

export type TodayDayCurve =
  | { state: 'missing'; text: string; help: SectionHelp }
  | {
      state: 'shown';
      nature: HourlyEt0Nature;
      sentence: string;
      /** « Évaporation la plus forte entre 11 h et 16 h » ; `null` sans plage. */
      strongest: string | null;
      /** « Courbe ancienne : lue à 6 h 15. » ; `null` pour une forme récente ou théorique. */
      old: string | null;
      bars: TodayDayCurveBar[];
      /** Ce que dit la courbe, pour un lecteur d'écran. */
      label: string;
      help: SectionHelp;
    };

const NATURE_WORDS: Record<HourlyEt0Nature, { name: string; text: string }> = {
  'provider-hourly': {
    name: 'forme du fournisseur',
    text: 'La forme du fournisseur : l’ET0 heure par heure que le fournisseur météo donne pour votre lieu, avec le même modèle que l’ET0 du jour.',
  },
  'computed-hourly': {
    name: 'calculée à l’heure',
    text: 'Calculée à l’heure : l’ET0 de chaque heure, calculée par la formule FAO-56 avec la température, l’humidité, le vent et le soleil prévus pour votre lieu.',
  },
  theoretical: {
    name: 'forme théorique du soleil',
    text: 'La forme théorique du soleil : la courbe suit la hauteur du soleil et reste symétrique autour de midi au soleil ; la vraie évaporation culmine un peu plus tard, avec le vent et la chaleur de l’après-midi. Elle sert quand le fournisseur ne donne pas les heures.',
  },
};

const WHAT_IT_IS_NOT = 'Elle ne change pas le besoin de vos planches ni l’objectif ; elle montre à quelle heure la journée consomme.';
const STRONGEST_HELP = `Les heures où l’évaporation atteint ${percent.format(HIGH_DEMAND_SHARE_OF_DAILY_MAXIMUM)} ou plus de l’heure la plus forte du jour. Une information, jamais une interdiction : arroser en pleine chaleur reste votre choix.`;

function curveHelp(nature: HourlyEt0Nature | null): SectionHelp {
  return {
    entries: [
      ...(nature ? [{ title: `D’où vient la courbe : ${NATURE_WORDS[nature].name}`, text: NATURE_WORDS[nature].text }] : []),
      { title: 'Ce que la courbe n’est pas', text: WHAT_IT_IS_NOT },
      { title: 'Évaporation la plus forte', text: STRONGEST_HELP },
      { title: 'Le total du jour', text: 'Le total est l’ET0 du jour de votre ferme, celle de vos calculs ; la courbe le répartit seulement entre les heures.' },
    ],
  };
}

/** La forme écrite de la source de l'ET0, si elle a bien une part par heure du jour ; sinon la forme théorique. */
function shapeOfDay(input: TodayDayCurveInputs): { shape: DayShape; fetchedAt: string | null } | null {
  const hours = hoursOfDay(input.date, input.timeZone);
  const recorded = input.et0
    ? input.recorded.find((record) => record.date === input.date && record.source === input.et0?.source)
    : undefined;
  if (recorded && recorded.shares.length === hours.length && recorded.shares.every((share) => Number.isFinite(share) && share >= 0)) {
    return { shape: { date: input.date, timeZone: input.timeZone, nature: recorded.nature, hours, shares: recorded.shares }, fetchedAt: recorded.fetchedAt };
  }
  const theoretical = dayShape({ date: input.date, timeZone: input.timeZone, location: input.location });
  return theoretical ? { shape: theoretical, fetchedAt: null } : null;
}

/** « 16 h » : l'heure d'horloge qui suit une heure du jour. */
function nextHourText(localHour: number): string {
  return `${(localHour + 1) % HOURS_PER_DAY} h`;
}

export function todayDayCurve(input: TodayDayCurveInputs, now: Date): TodayDayCurve | null {
  if (!input.et0) return { state: 'missing', text: 'Pas de courbe : l’ET0 du jour manque.', help: curveHelp(null) };
  const found = shapeOfDay(input);
  // Une journée sans soleil ni heure du fournisseur (nuit polaire) : rien à dessiner.
  if (!found) return null;
  const { shape, fetchedAt } = found;
  const totalMm = input.et0.mm;
  const reading = readDayShape(shape, totalMm, now);
  const remaining = reading.remainingMm ?? 0;
  const theoretical = shape.nature === 'theoretical' ? ', d’après la forme théorique du soleil' : '';
  const sentence = millimetersText(remaining) === millimetersText(0)
    ? `La soif du jour est passée : ${millimetersText(totalMm)} aujourd’hui${theoretical}.`
    : `D’ici ce soir, il reste environ ${millimetersText(remaining)} à consommer sur ${millimetersText(totalMm)}${theoretical}.`;
  const maximum = Math.max(...shape.shares);
  const strong = reading.highDemand;
  const instant = now.getTime();
  const bars = shape.hours.map((hour, index): TodayDayCurveBar => {
    const share = shape.shares[index];
    return {
      hour: `${hour.localHour} h`,
      heightPercent: maximum > 0 ? Math.round((share / maximum) * 100) : 0,
      title: `${hour.localHour} h : ${percent.format(share)} de la journée, environ ${millimetersText(share * totalMm)}`,
      current: Date.parse(hour.startsAt) <= instant && instant < Date.parse(hour.endsAt),
      strong: strong !== null && index >= strong.firstHourIndex && index <= strong.lastHourIndex,
    };
  });
  const strongest = strong
    ? `Évaporation la plus forte entre ${shape.hours[strong.firstHourIndex].localHour} h et ${nextHourText(shape.hours[strong.lastHourIndex].localHour)}`
    : null;
  const old = fetchedAt !== null && instant - Date.parse(fetchedAt) > millisecondsFromHours(DAY_SHAPE_OLD_AFTER_HOURS)
    ? `Courbe ancienne : lue à ${farmHourText(fetchedAt, input.timeZone)}.`
    : null;
  const current = bars.find((bar) => bar.current);
  const label = [
    `Courbe de la journée, ${NATURE_WORDS[shape.nature].name}`,
    strongest ? strongest.toLocaleLowerCase('fr-FR') : null,
    current ? `il est ${current.hour}` : null,
  ].filter((part): part is string => part !== null).join(' ; ');
  return { state: 'shown', nature: shape.nature, sentence, strongest, old, bars, label: `${label}.`, help: curveHelp(shape.nature) };
}
