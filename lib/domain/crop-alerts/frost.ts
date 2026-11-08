import type { CropSeries, ImplantationTask } from '../domain.ts';
import { alertWeekUrl } from '../weather/weather-alerts.ts';
import { addDaysToDateKey, isValidDateKey } from '../water-management.ts';
import { cultivationPresence, isPresentOn, type CultivationPresence } from './presence.ts';
import { fitPushBody, PUSH_BODY_MAX_LENGTH, pushTag } from './push.ts';
import { celsiusText, dayText, listText, lowerFirst } from './text.ts';
import {
  DEFAULT_FROST_MARGINS,
  frostAlertThresholdCelsius,
  frostMarginCelsius,
  resolveFrostThreshold,
  type FrostMargins,
  type CropAlertCommonEntry,
  type FrostLinkRevision,
} from './thresholds.ts';

/**
 * Le gel par culture (docs/weather-crop-alerts-contract.md, « Le gel par
 * culture », « La répétition et le regroupement ») : sur l'horizon de
 * l'exploitation, aujourd'hui compris, chaque espèce présente dont le seuil
 * d'alerte appliqué (dégâts + marge + curseur de microclimat) est atteint ou
 * dépassé par la minimale prévue la plus récente. Une information : rien
 * ici ne touche le besoin, l'objectif, le planning ni la dose (D-010, D-028).
 */

/** Ce que l'alerte nomme et ne répète pas : une espèce, ou l'exception d'une série. */
export type FrostSubject = {
  subjectKey: string;
  subjectVersion: string;
  plantId: string;
  /** Le nom de l'espèce d'Ouvre ta ferme, suivi de la série pour une exception. */
  name: string;
  damageCelsius: number;
  source: 'common' | 'farm';
  periods: (CultivationPresence & { underShelter: boolean })[];
};

/** Une espèce présente sans seuil de gel : elle ne déclenche rien, l'écran la liste. */
export type FrostWithoutThreshold = {
  plantId: string;
  name: string;
  /** `missing` : aucun rattachement saisi ; `none` : rattachée sans seuil. */
  reason: 'missing' | 'none';
};

/**
 * Les sujets du gel de la ferme : chaque culture des séries, avec son seuil.
 * Une culture sans implantation n'a pas de période ; une culture sans seuil
 * présente aujourd'hui est listée à part.
 */
export function frostSubjects(input: {
  series: readonly CropSeries[];
  tasks: readonly ImplantationTask[];
  revisions: readonly FrostLinkRevision[];
  common: ReadonlyMap<string, CropAlertCommonEntry>;
  /** Les séries posées sur au moins une planche sous abri. */
  shelteredSeriesIds: ReadonlySet<string>;
  today: string;
}): { subjects: FrostSubject[]; withoutThreshold: FrostWithoutThreshold[] } {
  const subjects = new Map<string, FrostSubject>();
  const without = new Map<string, FrostWithoutThreshold>();
  for (const series of input.series) {
    for (const cultivation of series.cultivations) {
      const presence = cultivationPresence(series, cultivation, input.tasks);
      if (presence === null) continue;
      const threshold = resolveFrostThreshold({ plantId: cultivation.plantId, seriesId: series.id, revisions: input.revisions, common: input.common });
      if (threshold.status !== 'threshold' || threshold.damageCelsius === null || threshold.source === null) {
        if (isPresentOn(presence, input.today) && threshold.status !== 'threshold') {
          without.set(`${cultivation.plantId}:${threshold.status}`, { plantId: cultivation.plantId, name: cultivation.plantName, reason: threshold.status });
        }
        continue;
      }
      const exception = threshold.subjectKey !== cultivation.plantId;
      const subject = subjects.get(threshold.subjectKey) ?? {
        subjectKey: threshold.subjectKey,
        subjectVersion: threshold.subjectVersion,
        plantId: cultivation.plantId,
        name: exception ? `${cultivation.plantName} (série ${series.name})` : cultivation.plantName,
        damageCelsius: threshold.damageCelsius,
        source: threshold.source,
        periods: [],
      };
      subject.periods.push({ ...presence, underShelter: input.shelteredSeriesIds.has(series.id) });
      subjects.set(threshold.subjectKey, subject);
    }
  }
  return {
    subjects: [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    withoutThreshold: [...without.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.reason.localeCompare(b.reason)),
  };
}

/** La minimale prévue d'un jour, telle qu'elle a été lue ; absente, elle reste `null` (D-003). */
export type FrostForecastDay = {
  date: string;
  minimumTemperatureCelsius: number | null;
  forecastedAt: string;
};

type FrostCrossing = {
  subjectKey: string;
  subjectVersion: string;
  plantId: string;
  name: string;
  damageCelsius: number;
  marginCelsius: number;
  offsetCelsius: number;
  alertThresholdCelsius: number;
  /** Une des séries présentes ce jour-là est sous abri : la prévision est celle de l'extérieur. */
  underShelter: boolean;
  /** Ce jour a déjà eu son alerte pour cette version du sujet : rien ne part. */
  alreadyAlerted: boolean;
};

type FrostDay = {
  date: string;
  minimumCelsius: number;
  forecastedAt: string;
  crossings: FrostCrossing[];
};

export type FrostEvaluation = {
  /** Les jours visés, dans l'ordre du temps, avec toutes les espèces concernées. */
  days: FrostDay[];
  /** Les jours de l'horizon sans minimale prévue : rien n'y est évalué, et l'écran le dit. */
  unavailableDates: string[];
};

/** La clé qui empêche une seconde alerte : le sujet, sa version et le jour visé. */
export function frostAlertKey(subjectKey: string, subjectVersion: string, date: string): string {
  return `${subjectKey}|${subjectVersion}|${date}`;
}

/**
 * Évalue le gel le jour `today` à la ferme, sur `horizonDays` jours,
 * aujourd'hui compris. La minimale la plus récente de chaque jour fait foi ;
 * il y a alerte quand elle est inférieure ou égale au seuil appliqué. Le
 * curseur de microclimat et les marges n'entrent pas dans la clé : les
 * changer ne renvoie pas un jour déjà alerté.
 */
export function evaluateFrost(input: {
  subjects: readonly FrostSubject[];
  forecasts: readonly FrostForecastDay[];
  today: string;
  horizonDays: number;
  offsetCelsius: number;
  /** Les marges de la ferme (précision P44) ; celles du contrat sans réglage. */
  margins?: FrostMargins;
  alertedKeys: ReadonlySet<string>;
}): FrostEvaluation {
  const margins = input.margins ?? DEFAULT_FROST_MARGINS;
  if (!isValidDateKey(input.today)) throw new Error('Jour invalide.');
  const latest = new Map<string, FrostForecastDay>();
  for (const forecast of input.forecasts) {
    const known = latest.get(forecast.date);
    if (known === undefined || Date.parse(forecast.forecastedAt) > Date.parse(known.forecastedAt)) latest.set(forecast.date, forecast);
  }
  const days: FrostDay[] = [];
  const unavailableDates: string[] = [];
  for (let offset = 0; offset < input.horizonDays; offset += 1) {
    const date = addDaysToDateKey(input.today, offset);
    const forecast = latest.get(date);
    const minimum = forecast?.minimumTemperatureCelsius;
    if (forecast === undefined || typeof minimum !== 'number' || !Number.isFinite(minimum)) {
      unavailableDates.push(date);
      continue;
    }
    const crossings: FrostCrossing[] = [];
    for (const subject of input.subjects) {
      const present = subject.periods.filter((period) => isPresentOn(period, date));
      if (present.length === 0) continue;
      const alertThresholdCelsius = frostAlertThresholdCelsius(subject.damageCelsius, input.offsetCelsius, margins);
      if (!(minimum <= alertThresholdCelsius + 1e-9)) continue;
      crossings.push({
        subjectKey: subject.subjectKey,
        subjectVersion: subject.subjectVersion,
        plantId: subject.plantId,
        name: subject.name,
        damageCelsius: subject.damageCelsius,
        marginCelsius: frostMarginCelsius(subject.damageCelsius, margins),
        offsetCelsius: input.offsetCelsius,
        alertThresholdCelsius,
        underShelter: present.some((period) => period.underShelter),
        alreadyAlerted: input.alertedKeys.has(frostAlertKey(subject.subjectKey, subject.subjectVersion, date)),
      });
    }
    if (crossings.length > 0) days.push({ date, minimumCelsius: minimum, forecastedAt: forecast.forecastedAt, crossings });
  }
  return { days, unavailableDates };
}

/** Une notification, avec les jours visés qu'elle annonce : leurs alertes en reçoivent le résultat. */
export type CropAlertNotification = { title: string; body: string; tag: string; url: string; targetDates: string[] };

/** Au plus cinq noms dans une notification, puis « et N autres ». */
const NAMES_PER_NOTIFICATION = 5;
/** Au plus trois jours visés notifiés un par un, puis une notification qui résume le reste. */
const DAYS_NOTIFIED_ONE_BY_ONE = 3;
const FROST_TITLE = 'Alerte gel';
const SHELTER_NOTE = ' Sous abri, la température diffère : la prévision est celle de l’extérieur.';
/** La note d'abri raccourcie quand le texte entier dépasserait la limite du service d'envoi. */
const SHORT_SHELTER_NOTE = ' Sous abri, la température diffère.';

/**
 * Les notifications d'une évaluation : seules les espèces nouvellement
 * concernées partent ; une notification par jour visé, au plus trois, puis
 * une dernière pour le reste. Le mot « prévu » figure toujours.
 */
export function frostNotifications(evaluation: FrostEvaluation): CropAlertNotification[] {
  const days = evaluation.days
    .map((day) => ({ ...day, crossings: day.crossings.filter((crossing) => !crossing.alreadyAlerted) }))
    .filter((day) => day.crossings.length > 0);
  const notifications = days.slice(0, DAYS_NOTIFIED_ONE_BY_ONE).map((day) => ({
    title: FROST_TITLE,
    body: frostDayBody(day),
    tag: pushTag(`crop-frost:${day.date}`, day.crossings.map((crossing) => crossing.subjectKey)),
    url: alertWeekUrl('alertes-cultures', day.date),
    targetDates: [day.date],
  }));
  const rest = days.slice(DAYS_NOTIFIED_ONE_BY_ONE);
  if (rest.length > 0) {
    const names = new Set(rest.flatMap((day) => day.crossings.map((crossing) => crossing.subjectKey)));
    notifications.push({
      title: FROST_TITLE,
      body: fitPushBody(`Gel prévu aussi ${listText(rest.map((day) => `${dayText(day.date)} (${celsiusText(day.minimumCelsius)})`))}, pour ${names.size} culture${names.size > 1 ? 's' : ''} présente${names.size > 1 ? 's' : ''}.`),
      tag: `crop-frost:${rest[0].date}:suite`,
      url: alertWeekUrl('alertes-cultures', rest[0].date),
      targetDates: rest.map((day) => day.date),
    });
  }
  return notifications;
}

/**
 * « Gel prévu mardi 10 novembre : 2 °C. Tomate (1 culture présente). », avec
 * la note d'abri quand une série présente est sous abri. Pour tenir dans la
 * limite du service d'envoi, la note se raccourcit, puis s'efface devant les
 * noms des cultures ; le texte ne se coupe qu'en dernier recours.
 */
function frostDayBody(day: FrostDay): string {
  const main = `Gel prévu ${dayText(day.date)} : ${celsiusText(day.minimumCelsius)}. ${namesText(day.crossings)}.`;
  const notes = day.crossings.some((crossing) => crossing.underShelter) ? [SHELTER_NOTE, SHORT_SHELTER_NOTE, ''] : [''];
  const fitting = notes.map((note) => `${main}${note}`).find((body) => body.length <= PUSH_BODY_MAX_LENGTH);
  return fitPushBody(fitting ?? main);
}

/** « Tomate, courgette, haricot (3 cultures présentes) », au plus cinq noms. */
function namesText(crossings: readonly FrostCrossing[]): string {
  const names = crossings.map((crossing, index) => (index === 0 ? crossing.name : lowerFirst(crossing.name)));
  const shown = names.slice(0, NAMES_PER_NOTIFICATION);
  const others = names.length - shown.length;
  const listed = others > 0 ? `${shown.join(', ')} et ${others} autre${others > 1 ? 's' : ''}` : shown.join(', ');
  return `${listed} (${names.length} culture${names.length > 1 ? 's' : ''} présente${names.length > 1 ? 's' : ''})`;
}

/** L'alerte enregistrée pour une espèce et un jour visé ; elle ne change plus (D-006). */
export type FrostAlertDraft = {
  subjectKey: string;
  subjectVersion: string;
  plantId: string;
  name: string;
  damageCelsius: number;
  marginCelsius: number;
  offsetCelsius: number;
  targetDate: string;
  forecastCelsius: number;
  forecastedAt: string;
};

/** Une alerte par espèce nouvellement concernée et par jour visé. */
export function frostDrafts(evaluation: FrostEvaluation): FrostAlertDraft[] {
  return evaluation.days.flatMap((day) => day.crossings
    .filter((crossing) => !crossing.alreadyAlerted)
    .map((crossing) => ({
      subjectKey: crossing.subjectKey,
      subjectVersion: crossing.subjectVersion,
      plantId: crossing.plantId,
      name: crossing.name,
      damageCelsius: crossing.damageCelsius,
      marginCelsius: crossing.marginCelsius,
      offsetCelsius: crossing.offsetCelsius,
      targetDate: day.date,
      forecastCelsius: day.minimumCelsius,
      forecastedAt: day.forecastedAt,
    })));
}
