import { pageHref } from '../features/pages.ts';
import { HOURS_PER_DAY, MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, SECONDS_PER_HOUR } from '../units.ts';
import { dateKeyInTimeZone, FARM_TIME_ZONE, isValidDateKey, weekStartDateKey } from '../water-management.ts';
import type { CropAlertNotification } from './frost.ts';
import { fitPushBody, PUSH_BODY_MAX_LENGTH, pushTag } from './push.ts';
import { bedsText, celsiusText, dayText, hourText, listText } from './text.ts';

/**
 * Les aspersions à reconsidérer (docs/weather-crop-alerts-contract.md,
 * « Les aspersions à reconsidérer ») : un créneau d'aspersion posé sur une
 * planche sous abri, qui commence de jour, signalé quand la maximale prévue
 * du jour est sous le seuil de l'exploitation (temps frais) ou que le
 * rayonnement moyen du jour l'est (ciel couvert). Le jugement se fait au
 * jour ; le logiciel ne réduit ni n'annule rien (D-010, D-028).
 */

/** Un créneau du planning, tel que le service le décrit. */
export type SprinklerSlot = {
  /** Ce que l'alerte ne répète pas : le créneau tant qu'il n'est pas modifié. */
  slotKey: string;
  startAt: string;
  /** Le matériel est de nature aspersion. */
  sprinkler: boolean;
  beds: { bedName: string; underShelter: boolean }[];
};

/** La prévision d'un jour pour l'aspersion ; une valeur absente reste `null` (D-003). */
export type SprinklerForecastDay = {
  date: string;
  maximumTemperatureCelsius: number | null;
  solarEnergyMegajoulesPerSquareMeter: number | null;
  forecastedAt: string;
};

export type SprinklerThresholds = {
  maxTemperatureCelsius: number;
  radiationWattsPerSquareMeter: number;
};

type SprinklerFlag = {
  slotKey: string;
  date: string;
  startAt: string;
  /** Les planches sous abri du créneau. */
  bedNames: string[];
  maximumCelsius: number | null;
  radiationWattsPerSquareMeter: number | null;
  cool: boolean;
  overcast: boolean;
  alreadyAlerted: boolean;
};

export type SprinklerEvaluation = {
  flags: SprinklerFlag[];
  /** Les jours d'un créneau jugé sans énergie solaire prévue : l'écran dit « ensoleillement non prévu ». */
  sunshineUnavailableDates: string[];
};

/** La clé qui empêche une seconde alerte : le créneau et son jour. */
export function sprinklerAlertKey(slotKey: string, date: string): string {
  return `${slotKey}|${date}`;
}

const DEGREES_TO_RADIANS = Math.PI / 180;
const JOULES_PER_MEGAJOULE = 1_000_000;

/**
 * Le lever et le coucher du soleil d'un jour, en instants UTC, et la durée du
 * jour, calculés comme pour l'ET0 (FAO-56, équations 24, 25, 32 et 34) :
 * l'angle horaire au coucher donne la durée, l'heure solaire de midi est
 * corrigée de la longitude et de l'équation du temps.
 */
export function daylight(date: string, location: { latitude: number; longitude: number }) {
  if (!isValidDateKey(date)) throw new Error('Jour invalide.');
  const dayOfYear = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.UTC(Number(date.slice(0, 4)), 0, 0)) / MILLISECONDS_PER_DAY);
  const latitude = location.latitude * DEGREES_TO_RADIANS;
  const declination = 0.409 * Math.sin(2 * Math.PI * dayOfYear / 365 - 1.39);
  const sunsetHourAngle = Math.acos(Math.min(1, Math.max(-1, -Math.tan(latitude) * Math.tan(declination))));
  const dayLengthHours = HOURS_PER_DAY / Math.PI * sunsetHourAngle;
  const b = 2 * Math.PI * (dayOfYear - 81) / 364;
  const equationOfTimeHours = 0.1645 * Math.sin(2 * b) - 0.1255 * Math.cos(b) - 0.025 * Math.sin(b);
  const solarNoonUtcHours = 12 - location.longitude / 15 - equationOfTimeHours;
  const midnight = Date.parse(`${date}T00:00:00Z`);
  return {
    sunrise: new Date(midnight + (solarNoonUtcHours - dayLengthHours / 2) * MILLISECONDS_PER_HOUR).toISOString(),
    sunset: new Date(midnight + (solarNoonUtcHours + dayLengthHours / 2) * MILLISECONDS_PER_HOUR).toISOString(),
    dayLengthSeconds: dayLengthHours * SECONDS_PER_HOUR,
  };
}

/** Le rayonnement moyen du jour : l'énergie solaire prévue divisée par la durée du jour. */
function meanRadiationWattsPerSquareMeter(energyMegajoules: number, dayLengthSeconds: number): number | null {
  return dayLengthSeconds > 0 ? energyMegajoules * JOULES_PER_MEGAJOULE / dayLengthSeconds : null;
}

/**
 * Juge les créneaux. Seuls comptent ceux d'un matériel d'aspersion, posés
 * sur au moins une planche sous abri, qui commencent entre le lever et le
 * coucher du soleil de leur jour à la ferme. Une valeur prévue absente ne
 * déclenche rien ; une seule des deux suffit à signaler.
 */
export function evaluateSprinklers(input: {
  slots: readonly SprinklerSlot[];
  forecasts: readonly SprinklerForecastDay[];
  thresholds: SprinklerThresholds;
  location: { latitude: number; longitude: number };
  alertedKeys: ReadonlySet<string>;
  timeZone?: string;
}): SprinklerEvaluation {
  const latest = new Map<string, SprinklerForecastDay>();
  for (const forecast of input.forecasts) {
    const known = latest.get(forecast.date);
    if (known === undefined || Date.parse(forecast.forecastedAt) > Date.parse(known.forecastedAt)) latest.set(forecast.date, forecast);
  }
  const flags: SprinklerFlag[] = [];
  const sunshineUnavailable = new Set<string>();
  for (const slot of input.slots) {
    const sheltered = slot.beds.filter((bed) => bed.underShelter);
    if (!slot.sprinkler || sheltered.length === 0) continue;
    const date = dateKeyInTimeZone(slot.startAt, input.timeZone ?? FARM_TIME_ZONE);
    const sun = daylight(date, input.location);
    if (slot.startAt < sun.sunrise || slot.startAt >= sun.sunset) continue;
    const forecast = latest.get(date);
    const maximum = finite(forecast?.maximumTemperatureCelsius);
    const energy = finite(forecast?.solarEnergyMegajoulesPerSquareMeter);
    if (energy === null) sunshineUnavailable.add(date);
    const radiation = energy === null ? null : meanRadiationWattsPerSquareMeter(energy, sun.dayLengthSeconds);
    const cool = maximum !== null && maximum < input.thresholds.maxTemperatureCelsius;
    const overcast = radiation !== null && radiation < input.thresholds.radiationWattsPerSquareMeter;
    if (!cool && !overcast) continue;
    flags.push({
      slotKey: slot.slotKey,
      date,
      startAt: slot.startAt,
      bedNames: sheltered.map((bed) => bed.bedName),
      maximumCelsius: maximum,
      radiationWattsPerSquareMeter: radiation,
      cool,
      overcast,
      alreadyAlerted: input.alertedKeys.has(sprinklerAlertKey(slot.slotKey, date)),
    });
  }
  return {
    flags: flags.sort((a, b) => a.startAt.localeCompare(b.startAt)),
    sunshineUnavailableDates: [...sunshineUnavailable].sort(),
  };
}

/**
 * Une notification par jour pour ses créneaux nouvellement signalés :
 * « Aspersion à reconsidérer : jeudi 12 novembre 10 h, planche 4 (sous abri).
 * Maximale prévue 18 °C (seuil : sous 24 °C), ciel couvert prévu (rayonnement
 * moyen 220 W/m², seuil : sous 400). » Le clic ouvre le planning du jour.
 */
export function sprinklerNotifications(
  evaluation: SprinklerEvaluation,
  thresholds: SprinklerThresholds,
  timeZone = FARM_TIME_ZONE,
): CropAlertNotification[] {
  const byDate = new Map<string, SprinklerFlag[]>();
  for (const flag of evaluation.flags) {
    if (flag.alreadyAlerted) continue;
    byDate.set(flag.date, [...(byDate.get(flag.date) ?? []), flag]);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, flags]) => {
    const slots = flags.map((flag) => `${hourText(flag.startAt, timeZone)}, ${bedsText(flag.bedNames)} (sous abri)`);
    const first = flags[0];
    const monday = weekStartDateKey(date);
    const head = `Aspersion à reconsidérer : ${dayText(date)} ${listText(slots)}.`;
    const full = `${head} ${weatherText(first, thresholds)}`;
    return {
      title: 'Alerte aspersion',
      body: fitPushBody(full.length <= PUSH_BODY_MAX_LENGTH ? full : `${head} ${weatherText(first, thresholds, false)}`),
      tag: pushTag(`crop-sprinkler:${date}`, flags.map((flag) => flag.slotKey)),
      // Le planning de la semaine, où l'on refuse ou déplace le créneau (3.8, P31).
      url: pageHref('planning', { season: Number(monday.slice(0, 4)), week: monday }),
      targetDates: [date],
    };
  });
}

/**
 * « Maximale prévue 18 °C (seuil : sous 24 °C), ciel couvert prévu (rayonnement
 * moyen 220 W/m², seuil : sous 400). » ; sans les seuils quand le texte entier
 * dépasserait la limite du service d'envoi : « Maximale prévue 18 °C, ciel
 * couvert prévu (rayonnement moyen 220 W/m²). »
 */
function weatherText(flag: SprinklerFlag, thresholds: SprinklerThresholds, withThresholds = true): string {
  const parts: string[] = [];
  if (flag.cool && flag.maximumCelsius !== null) {
    const threshold = withThresholds ? ` (seuil : sous ${celsiusText(thresholds.maxTemperatureCelsius)})` : '';
    parts.push(`maximale prévue ${celsiusText(flag.maximumCelsius)}${threshold}`);
  }
  if (flag.overcast && flag.radiationWattsPerSquareMeter !== null) {
    const threshold = withThresholds ? `, seuil : sous ${thresholds.radiationWattsPerSquareMeter}` : '';
    parts.push(`ciel couvert prévu (rayonnement moyen ${Math.round(flag.radiationWattsPerSquareMeter)} W/m²${threshold})`);
  }
  const text = parts.join(', ');
  return `${text.charAt(0).toLocaleUpperCase('fr-FR')}${text.slice(1)}.`;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
