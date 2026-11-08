import { pageHref } from '../features/pages.ts';
import { addDaysToDateKey, FARM_TIME_ZONE, isValidDateKey, weekStartDateKey } from '../water-management.ts';

/**
 * Les alertes météo paramétrables (docs/weather-alerts-contract.md, D-050).
 *
 * Un critère de l'exploitation surveille un champ prévu — température
 * minimale, température maximale ou pluie du jour — dans un sens et sous un
 * seuil, sur un horizon de 1 à 7 jours, aujourd'hui compris. L'alerte est une
 * information : rien ici ne touche le besoin, l'objectif, le planning ni la
 * dose (D-010, D-028).
 *
 * Ce module ne fait que des calculs : la validation d'un critère,
 * l'évaluation sur les prévisions les plus récentes, la règle de répétition
 * (une seule alerte par version de critère et par jour visé) et le texte de
 * la notification. L'enregistrement et l'envoi sont faits ailleurs.
 */

type WeatherAlertField = 'minimum-temperature' | 'maximum-temperature' | 'precipitation';
type WeatherAlertDirection = 'below' | 'above';
type WeatherAlertUnit = '°C' | 'mm';

type WeatherAlertFieldDefinition = {
  /** Le nom du champ dans les phrases : « Température minimale prévue 2 °C ». */
  label: string;
  unit: WeatherAlertUnit;
  /** Bornes du seuil, comprises, dans l'unité du champ. */
  minimum: number;
  maximum: number;
};

/** Les champs offerts au départ : seulement ceux déjà lus chaque matin (question 1 du contrat). */
const WEATHER_ALERT_FIELDS: Readonly<Record<WeatherAlertField, WeatherAlertFieldDefinition>> = {
  'minimum-temperature': { label: 'Température minimale', unit: '°C', minimum: -30, maximum: 50 },
  'maximum-temperature': { label: 'Température maximale', unit: '°C', minimum: -30, maximum: 50 },
  precipitation: { label: 'Pluie', unit: 'mm', minimum: 0, maximum: 300 },
};

/** L'horizon en jours, aujourd'hui compris : de 1 à 7, 3 par défaut (question 7). */
const WEATHER_ALERT_HORIZON_DAYS = { minimum: 1, maximum: 7, default: 3 } as const;

/** Les jours qu'une évaluation doit lire : l'horizon le plus long, aujourd'hui compris. */
export const WEATHER_ALERT_MAXIMUM_HORIZON_DAYS = WEATHER_ALERT_HORIZON_DAYS.maximum;

/**
 * Le libellé facultatif, repris dans le titre de la notification. Le Worker
 * Web Push refuse un titre de plus de 80 caractères ; « Alerte météo · » en
 * prend 15.
 */
export const WEATHER_ALERT_LABEL_MAX_LENGTH = 60;

const NOTIFICATION_TITLE = 'Alerte météo';
const NOTIFICATION_TITLE_SEPARATOR = ' · ';

/** Ce que l'utilisateur règle ; la version et l'identifiant sont donnés par l'enregistrement. */
export type WeatherAlertCriterionSettings = {
  field: WeatherAlertField;
  direction: WeatherAlertDirection;
  /** Le seuil, dans l'unité du champ. */
  threshold: number;
  horizonDays: number;
  active: boolean;
  label: string | null;
};

export type WeatherAlertCriterion = WeatherAlertCriterionSettings & {
  id: string;
  /** Chaque modification fait une nouvelle version (D-006) ; les jours visés repartent de zéro. */
  version: number;
};

export type WeatherAlertCriterionInput = {
  field?: unknown;
  direction?: unknown;
  threshold?: unknown;
  horizonDays?: unknown;
  active?: unknown;
  label?: unknown;
};

type WeatherAlertCriterionRefusal = {
  input: keyof WeatherAlertCriterionInput;
  message: string;
};

export type WeatherAlertCriterionValidation =
  | { ok: true; settings: WeatherAlertCriterionSettings }
  | { ok: false; refusals: WeatherAlertCriterionRefusal[] };

/**
 * Valide un critère saisi. Un seuil absent, non numérique ou hors des bornes
 * du champ est refusé avec un message qui dit pourquoi ; l'horizon absent vaut
 * 3 jours ; un critère est actif sauf mention contraire ; un libellé vide
 * n'est pas un libellé.
 */
export function validateWeatherAlertCriterion(input: WeatherAlertCriterionInput): WeatherAlertCriterionValidation {
  const refusals: WeatherAlertCriterionRefusal[] = [];

  const field = isWeatherAlertField(input.field) ? input.field : null;
  if (field === null) {
    refusals.push({
      input: 'field',
      message: 'Choisissez ce que surveille l’alerte : température minimale, température maximale ou pluie.',
    });
  }

  const direction = input.direction === 'below' || input.direction === 'above' ? input.direction : null;
  if (direction === null) {
    refusals.push({ input: 'direction', message: 'Choisissez « en dessous de » ou « au-dessus de ».' });
  }

  const threshold = readThreshold(input.threshold, field, refusals);
  const horizonDays = readHorizonDays(input.horizonDays, refusals);

  let active = true;
  if (input.active !== undefined && input.active !== null) {
    if (typeof input.active === 'boolean') active = input.active;
    else refusals.push({ input: 'active', message: 'L’alerte est active ou non.' });
  }

  const label = readLabel(input.label, refusals);

  if (refusals.length > 0 || field === null || direction === null || threshold === null || horizonDays === null || label === undefined) {
    return { ok: false, refusals };
  }
  return { ok: true, settings: { field, direction, threshold, horizonDays, active, label } };
}

/**
 * Une modification du critère en fait une nouvelle version, qui peut alerter
 * de nouveau ; l'activer ou le désactiver ne le modifie pas : ses jours déjà
 * alertés restent alertés.
 */
export function weatherAlertCriterionNeedsNewVersion(
  previous: WeatherAlertCriterionSettings,
  next: WeatherAlertCriterionSettings,
): boolean {
  return previous.field !== next.field
    || previous.direction !== next.direction
    || previous.threshold !== next.threshold
    || previous.horizonDays !== next.horizonDays
    || previous.label !== next.label;
}

/** La prévision d'un jour, telle qu'elle a été lue ; une valeur absente reste `null` (D-003). */
export type WeatherAlertForecastDay = {
  /** Le jour civil à la ferme, `AAAA-MM-JJ` (D-004). */
  date: string;
  minimumTemperatureCelsius: number | null;
  maximumTemperatureCelsius: number | null;
  precipitationMm: number | null;
  /** L'instant de la lecture de cette prévision. */
  forecastedAt: string;
};

/** Un jour visé : la prévision y franchit le seuil. */
export type WeatherAlertCrossing = {
  date: string;
  value: number;
  forecastedAt: string;
};

export type WeatherAlertEvaluation = {
  /** Les jours visés nouveaux, dans l'ordre du temps : ceux qui ont déjà eu leur alerte en sont exclus. */
  crossings: WeatherAlertCrossing[];
  /** Les jours de l'horizon sans valeur prévue : rien n'y est évalué, et l'écran le dit. */
  unavailableDates: string[];
};

/**
 * Évalue un critère sur les prévisions, le jour `today` à la ferme.
 *
 * - Seuls les jours de `today` à `today + horizon − 1` comptent.
 * - Pour chaque jour, la prévision la plus récente fait foi.
 * - « En dessous de » et « au-dessus de » sont stricts (question 4).
 * - Une valeur absente ne déclenche rien et n'est jamais lue comme 0.
 * - Un jour déjà alerté pour cette version du critère ne l'est plus
 *   (`alertedDates`), même si la prévision a changé depuis (question 3).
 * - Un critère inactif n'est jamais évalué.
 */
export function evaluateWeatherAlertCriterion({
  criterion,
  forecasts,
  today,
  alertedDates,
}: {
  criterion: WeatherAlertCriterionSettings;
  forecasts: readonly WeatherAlertForecastDay[];
  today: string;
  alertedDates: ReadonlySet<string>;
}): WeatherAlertEvaluation {
  if (!isValidDateKey(today)) throw new Error('Jour invalide.');
  if (!criterion.active) return { crossings: [], unavailableDates: [] };

  const latestByDate = latestForecastByDate(forecasts);
  const crossings: WeatherAlertCrossing[] = [];
  const unavailableDates: string[] = [];

  for (let offset = 0; offset < criterion.horizonDays; offset += 1) {
    const date = addDaysToDateKey(today, offset);
    const forecast = latestByDate.get(date);
    const value = forecast ? forecastValue(forecast, criterion.field) : null;
    if (forecast === undefined || value === null) {
      unavailableDates.push(date);
      continue;
    }
    if (!crossesThreshold(value, criterion) || alertedDates.has(date)) continue;
    crossings.push({ date, value, forecastedAt: forecast.forecastedAt });
  }

  return { crossings, unavailableDates };
}

export type WeatherAlertNotification = {
  title: string;
  body: string;
  /** Un par version de critère et premier jour visé : le Worker ne double jamais une notification. */
  tag: string;
  url: string;
};

/**
 * La notification d'un critère franchi : une seule pour tous ses jours visés
 * nouveaux, qui nomme le premier et compte les autres. Le mot « prévue »
 * figure toujours : une alerte ne parle jamais d'une observation.
 */
export function weatherAlertNotification(
  criterion: WeatherAlertCriterion,
  crossings: readonly WeatherAlertCrossing[],
  timeZone = FARM_TIME_ZONE,
): WeatherAlertNotification | null {
  if (crossings.length === 0) return null;
  const sorted = [...crossings].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const definition = WEATHER_ALERT_FIELDS[criterion.field];
  const others = sorted.length - 1;
  const othersText = others === 0 ? '' : `, et ${others} autre${others > 1 ? 's' : ''} jour${others > 1 ? 's' : ''}`;
  const body = `${definition.label} prévue ${formatValue(first.value, definition.unit)} ${formatDayLabel(first.date)}${othersText}`
    + ` (seuil : ${directionWord(criterion.direction)} ${formatValue(criterion.threshold, definition.unit)}).`
    + ` Prévision du ${formatForecastInstant(first.forecastedAt, timeZone)}.`;
  return {
    title: criterion.label ? `${NOTIFICATION_TITLE}${NOTIFICATION_TITLE_SEPARATOR}${criterion.label}` : NOTIFICATION_TITLE,
    body,
    tag: `weather-alert:${criterion.id}:v${criterion.version}:${first.date}`,
    url: alertWeekUrl('alertes-meteo', first.date),
  };
}

/** L'alerte à enregistrer pour un jour visé ; elle ne change plus ensuite (D-006). */
export type WeatherAlertDraft = {
  criterionId: string;
  criterionVersion: number;
  targetDate: string;
  forecastValue: number;
  unit: WeatherAlertUnit;
  forecastedAt: string;
};

/**
 * Le résultat de l'envoi d'une alerte : en attente tant que le service de
 * notification n'a pas répondu ; envoyée dès qu'un appareil l'a reçue ;
 * aucun appareil abonné ; nouvelle tentative du service après un échec
 * passager ; échec du service de notification.
 */
export type WeatherAlertDeliveryStatus = 'pending' | 'sent' | 'no-subscriber' | 'retrying' | 'failed';

/** Une alerte par jour visé, même quand une seule notification les annonce tous. */
export function weatherAlertDrafts(
  criterion: WeatherAlertCriterion,
  crossings: readonly WeatherAlertCrossing[],
): WeatherAlertDraft[] {
  const unit = WEATHER_ALERT_FIELDS[criterion.field].unit;
  return [...crossings]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((crossing) => ({
      criterionId: criterion.id,
      criterionVersion: criterion.version,
      targetDate: crossing.date,
      forecastValue: crossing.value,
      unit,
      forecastedAt: crossing.forecastedAt,
    }));
}

/**
 * L'adresse qu'ouvre le clic sur une alerte : la page de la case qui l'envoie,
 * sur la semaine du jour visé (question 6 ; 3.8, P31). La saison est l'année
 * du lundi de cette semaine.
 */
export function alertWeekUrl(page: 'alertes-meteo' | 'alertes-cultures', targetDate: string): string {
  if (!isValidDateKey(targetDate)) throw new Error('Jour invalide.');
  const monday = weekStartDateKey(targetDate);
  return pageHref(page, { season: Number(monday.slice(0, 4)), week: monday });
}

/** Les choix de l'écran : le champ, son nom et son unité, dans l'ordre du contrat. */
export const WEATHER_ALERT_FIELD_CHOICES = (Object.keys(WEATHER_ALERT_FIELDS) as WeatherAlertField[])
  .map((field) => ({ field, label: WEATHER_ALERT_FIELDS[field].label, unit: WEATHER_ALERT_FIELDS[field].unit }));

export { WEATHER_ALERT_HORIZON_DAYS };

/**
 * Le critère en une phrase, telle que l'écran la montre : le seuil n'est
 * jamais compris (question 4), l'horizon compte aujourd'hui.
 */
export function weatherAlertCriterionSummary(criterion: WeatherAlertCriterionSettings): string {
  const definition = WEATHER_ALERT_FIELDS[criterion.field];
  const threshold = formatValue(criterion.threshold, definition.unit);
  const direction = criterion.direction === 'below' ? 'en dessous de' : 'au-dessus de';
  const horizon = criterion.horizonDays === 1
    ? 'aujourd’hui seulement'
    : `sur ${criterion.horizonDays} jours, aujourd’hui compris`;
  return `${definition.label} prévue ${direction} ${threshold} (${threshold} non compris), ${horizon}`;
}

/**
 * Ce qu'un critère franchit un jour, en une phrase courte : « Température
 * minimale prévue 1,2 °C », précédée de son libellé quand il en a un (page
 * « Aujourd'hui », audit ergonomique, point 1, 3.8 quater lot 2).
 */
export function weatherAlertCrossingText(criterion: Pick<WeatherAlertCriterionSettings, 'field' | 'label'>, value: number): string {
  const definition = WEATHER_ALERT_FIELDS[criterion.field];
  const fact = `${definition.label} prévue ${formatValue(value, definition.unit)}`;
  return criterion.label ? `${criterion.label} : ${fact.charAt(0).toLocaleLowerCase('fr-FR')}${fact.slice(1)}` : fact;
}

/** Le résultat d'un envoi, dit à l'écran. */
export function weatherAlertDeliveryLabel(status: WeatherAlertDeliveryStatus): string {
  switch (status) {
    case 'pending': return 'Envoi en cours';
    case 'sent': return 'Envoyée';
    case 'no-subscriber': return 'Aucun appareil abonné';
    case 'retrying': return 'Nouvelle tentative du service de notification';
    case 'failed': return 'Échec du service de notification';
  }
}

/** La valeur prévue avec son unité, comme dans la notification. */
export function formatWeatherAlertValue(value: number, unit: WeatherAlertUnit): string {
  return formatValue(value, unit);
}

/** Le message de l'écran des critères quand des jours de l'horizon n'ont pas de prévision. */
export function unavailableForecastMessage(dates: readonly string[]): string | null {
  if (dates.length === 0) return null;
  const days = [...dates].sort().map((date) => `le ${formatDayLabel(date)}`);
  const listed = days.length === 1 ? days[0] : `${days.slice(0, -1).join(', ')} et ${days[days.length - 1]}`;
  return `Prévision indisponible pour ${listed}.`;
}

function isWeatherAlertField(value: unknown): value is WeatherAlertField {
  return typeof value === 'string' && Object.hasOwn(WEATHER_ALERT_FIELDS, value);
}

function readThreshold(
  value: unknown,
  field: WeatherAlertField | null,
  refusals: WeatherAlertCriterionRefusal[],
): number | null {
  const unit = field === null ? null : WEATHER_ALERT_FIELDS[field].unit;
  const inUnit = unit === null ? '' : `, en ${unit}`;
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    refusals.push({ input: 'threshold', message: `Indiquez un seuil${inUnit}.` });
    return null;
  }
  const threshold = typeof value === 'number' ? value
    : typeof value === 'string' ? decimalFromText(value)
      : Number.NaN;
  if (!Number.isFinite(threshold)) {
    refusals.push({ input: 'threshold', message: `Le seuil doit être un nombre${inUnit}.` });
    return null;
  }
  if (field === null) return null;
  const definition = WEATHER_ALERT_FIELDS[field];
  if (threshold < definition.minimum || threshold > definition.maximum) {
    refusals.push({
      input: 'threshold',
      message: `Le seuil de ${lowerFirst(definition.label)} va de ${formatValue(definition.minimum, definition.unit)} à ${formatValue(definition.maximum, definition.unit)}.`,
    });
    return null;
  }
  return threshold;
}

function readHorizonDays(value: unknown, refusals: WeatherAlertCriterionRefusal[]): number | null {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return WEATHER_ALERT_HORIZON_DAYS.default;
  }
  const horizon = typeof value === 'number' ? value
    : typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value)
      : Number.NaN;
  if (!Number.isInteger(horizon) || horizon < WEATHER_ALERT_HORIZON_DAYS.minimum || horizon > WEATHER_ALERT_HORIZON_DAYS.maximum) {
    refusals.push({
      input: 'horizonDays',
      message: `L’horizon est un nombre entier de jours, de ${WEATHER_ALERT_HORIZON_DAYS.minimum} à ${WEATHER_ALERT_HORIZON_DAYS.maximum}, aujourd’hui compris.`,
    });
    return null;
  }
  return horizon;
}

/** `undefined` quand le libellé est refusé, `null` quand il n'y en a pas. */
function readLabel(value: unknown, refusals: WeatherAlertCriterionRefusal[]): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    refusals.push({ input: 'label', message: 'Le libellé est un texte.' });
    return undefined;
  }
  const label = value.trim().replace(/\s+/gu, ' ');
  if (label === '') return null;
  if (label.length > WEATHER_ALERT_LABEL_MAX_LENGTH) {
    refusals.push({ input: 'label', message: `Le libellé ne dépasse pas ${WEATHER_ALERT_LABEL_MAX_LENGTH} caractères.` });
    return undefined;
  }
  return label;
}

/** Un nombre saisi avec une virgule ou un point décimal, signe compris ; `NaN` sinon. */
function decimalFromText(value: string): number {
  const text = value.trim().replace(',', '.');
  return /^[-+]?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
}

function latestForecastByDate(forecasts: readonly WeatherAlertForecastDay[]): Map<string, WeatherAlertForecastDay> {
  const latest = new Map<string, WeatherAlertForecastDay>();
  for (const forecast of forecasts) {
    const known = latest.get(forecast.date);
    if (known === undefined || Date.parse(forecast.forecastedAt) > Date.parse(known.forecastedAt)) {
      latest.set(forecast.date, forecast);
    }
  }
  return latest;
}

function forecastValue(forecast: WeatherAlertForecastDay, field: WeatherAlertField): number | null {
  const value = field === 'minimum-temperature' ? forecast.minimumTemperatureCelsius
    : field === 'maximum-temperature' ? forecast.maximumTemperatureCelsius
      : forecast.precipitationMm;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function crossesThreshold(value: number, criterion: Pick<WeatherAlertCriterionSettings, 'direction' | 'threshold'>): boolean {
  return criterion.direction === 'below' ? value < criterion.threshold : value > criterion.threshold;
}

function directionWord(direction: WeatherAlertDirection): string {
  return direction === 'below' ? 'sous' : 'au-dessus de';
}

function formatValue(value: number, unit: WeatherAlertUnit): string {
  const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
  return `${number} ${unit}`;
}

/** « jeudi 5 novembre » : le jour civil à la ferme, lu tel quel. */
function formatDayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

/** « 2 novembre, 06 h 15 » : l'heure de lecture, à la ferme. */
function formatForecastInstant(instant: string, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
  }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return `${parts.day} ${parts.month}, ${parts.hour} h ${parts.minute}`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('fr-FR') + text.slice(1);
}
