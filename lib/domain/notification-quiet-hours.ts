import { pushTag } from './crop-alerts/push.ts';
import { farmMinutesOfDay } from './today/today-text.ts';
import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from './units.ts';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, localDateTimeUtc } from './water-management.ts';
import type { WeatherAlertCriterionSettings } from './weather/weather-alerts.ts';

/**
 * Les heures de silence des notifications (6 undecies,
 * docs/heures-de-silence-contract.md, section 3 ; D-320) : une plage de nuit
 * par ferme, éteinte tant que la ferme ne l'allume pas. Dans la plage, la fin
 * d'un arrosage démarré et, case cochée, le gel partent sans attendre ; le
 * rappel du soir ne part pas ; tout le reste est retenu et part à la fin de la
 * plage. La règle vit ici, en un seul endroit : chaque envoyeur l'appelle,
 * jamais ne la recopie. Elle ne touche que le message sur le téléphone :
 * l'alerte enregistrée, elle, naît à son heure (S9).
 */

/** Le réglage d'une ferme ; une colonne vide vaut son défaut (contrat, section 4). */
export type QuietHoursSettings = {
  /** Choix 2 : éteinte tant que la ferme ne l'allume pas (D-028). */
  enabled: boolean;
  /** « 22:00 » : de 20 h à 23 h 45, au quart d'heure, heure de Paris (choix 3, D-004). */
  start: string;
  /** « 06:00 » : de 4 h à 9 h, au quart d'heure, heure de Paris. */
  end: string;
  /** « Laisser passer les alertes de gel », cochée par défaut (choix 5). */
  frostPasses: boolean;
};

/** Les défauts d'une ferme qui n'a rien écrit : éteinte, 22 h à 6 h proposée à l'allumage, le gel qui passe. */
export const DEFAULT_QUIET_HOURS: Readonly<QuietHoursSettings> = { enabled: false, start: '22:00', end: '06:00', frostPasses: true };

const QUARTER_HOUR_MINUTES = 15;
const FIRST_START_MINUTES = 20 * MINUTES_PER_HOUR;
const LAST_START_MINUTES = 23 * MINUTES_PER_HOUR + 3 * QUARTER_HOUR_MINUTES;
const FIRST_END_MINUTES = 4 * MINUTES_PER_HOUR;
const LAST_END_MINUTES = 9 * MINUTES_PER_HOUR;
/**
 * S7 : une retenue ne dure jamais plus d'une plage, la plus longue allant de
 * 20 h à 9 h, treize heures de l'horloge de Paris. Comptée sur l'horloge, comme
 * la fin (S1) : la nuit du passage à l'heure d'hiver, cette plage dure
 * quatorze heures réelles sans être un défaut.
 */
const MAXIMUM_HOLD_MINUTES = 13 * MINUTES_PER_HOUR;

/** « 20:00 », « 20:15 », … : chaque quart d'heure de `first` à `last`, compris. */
function quarterHours(first: number, last: number): readonly string[] {
  return Array.from({ length: (last - first) / QUARTER_HOUR_MINUTES + 1 }, (_, index) => clockTime(first + index * QUARTER_HOUR_MINUTES));
}

/** Les débuts offerts : de 20 h à 23 h 45, au quart d'heure (S1). */
export const QUIET_START_TIMES = quarterHours(FIRST_START_MINUTES, LAST_START_MINUTES);
/** Les fins offertes : de 4 h à 9 h, au quart d'heure (S1). */
export const QUIET_END_TIMES = quarterHours(FIRST_END_MINUTES, LAST_END_MINUTES);

export function isQuietStartTime(value: unknown): value is string {
  return typeof value === 'string' && QUIET_START_TIMES.includes(value);
}

export function isQuietEndTime(value: unknown): value is string {
  return typeof value === 'string' && QUIET_END_TIMES.includes(value);
}

/** Un réglage qu'on peut écrire : un début et une fin dans les bornes de S1, deux cases. */
export function isValidQuietHours(settings: QuietHoursSettings): boolean {
  return typeof settings.enabled === 'boolean' && typeof settings.frostPasses === 'boolean'
    && isQuietStartTime(settings.start) && isQuietEndTime(settings.end);
}

/**
 * Ce qui va partir sur le téléphone. La veille de l'exploitant n'y est pas :
 * elle ne va pas à une ferme mais à la personne du déploiement (choix 7).
 */
export type QuietHoursNotification =
  /** La fin d'un arrosage démarré, minuteur ou irrigation enregistrée : passe toujours (S3). */
  | { kind: 'irrigation-finished' }
  /** Le retard d'une irrigation planifiée non démarrée (S4). */
  | { kind: 'irrigation-late' }
  /** Le message du matin, ou les suggestions du planning (S4, S6). */
  | { kind: 'morning-message' }
  /** Le rappel du soir (S5). */
  | { kind: 'evening-reminder' }
  /** Une alerte par culture : gel, séchage ou aspersions (S3, S4). */
  | { kind: 'crop-alert'; alert: 'frost' | 'drying' | 'sprinkler' }
  /** Une alerte météo, lue d'après son critère (S3, S4). */
  | { kind: 'weather-alert'; criterion: Pick<WeatherAlertCriterionSettings, 'field' | 'direction'> };

/** Un défaut à journaliser sans nommer ni ferme ni personne : un réglage hors des bornes (S17), une retenue trop longue (S7). */
export type QuietHoursDefect = 'invalid-setting' | 'hold-too-long';

export type QuietHoursDecision =
  /** Part tout de suite ; `defect` quand c'est un défaut qui la fait partir. */
  | { action: 'send'; defect: QuietHoursDefect | null }
  /** Retenue : part à `until`, la fin de la plage, instant UTC (S4). */
  | { action: 'hold'; until: string }
  /** Le rappel du soir dans la plage : ni envoyé ni retenu (S5). */
  | { action: 'skip' };

const SEND: QuietHoursDecision = { action: 'send', defect: null };

/**
 * S3 : sont du gel l'alerte par culture de gel et l'alerte météo d'un critère
 * sur la température minimale, « en dessous de » un seuil. Aucune autre, même
 * pour un seuil bas : le module ne devine pas l'intention de la ferme.
 */
function isFrost(notification: QuietHoursNotification): boolean {
  if (notification.kind === 'crop-alert') return notification.alert === 'frost';
  if (notification.kind === 'weather-alert') {
    return notification.criterion.field === 'minimum-temperature' && notification.criterion.direction === 'below';
  }
  return false;
}

/** La plage d'un réglage, en minutes depuis minuit à Paris : 22 h à 6 h vaut 1 320 et 360. */
export type QuietWindow = { startMinutes: number; endMinutes: number };

/** La plage d'un réglage ; `null` hors des bornes de S1. */
function windowOf(settings: QuietHoursSettings): QuietWindow | null {
  if (!isQuietStartTime(settings.start) || !isQuietEndTime(settings.end)) return null;
  return { startMinutes: minutesOf(settings.start), endMinutes: minutesOf(settings.end) };
}

/**
 * S1 et S7 : la fin de la plage qu'attend un envoi à l'instant `at`, ou
 * `null` quand il tombe hors de la plage. L'envoi est dans la plage si son
 * heure de Paris est au début ou après (début inclus), ou avant la fin (fin
 * exclue). La fin visée est celle du lendemain s'il tombe après le début,
 * celle du jour s'il tombe avant la fin ; elle se prend sur l'horloge de
 * Paris, jamais en ajoutant des heures UTC : les nuits du changement d'heure
 * ne la décalent pas. `'too-long'` quand l'attente dépasserait treize heures
 * de l'horloge de Paris (S7), ce qu'aucune plage dans les bornes ne fait.
 */
export function quietHoldEnd(window: QuietWindow, at: Date): Date | 'too-long' | null {
  const minutes = farmMinutesOfDay(at);
  const today = dateKeyInTimeZone(at, FARM_TIME_ZONE);
  let endDay: string;
  let heldMinutes: number;
  if (minutes >= window.startMinutes) {
    endDay = addDaysToDateKey(today, 1);
    heldMinutes = MINUTES_PER_DAY - minutes + window.endMinutes;
  } else if (minutes < window.endMinutes) {
    endDay = today;
    heldMinutes = window.endMinutes - minutes;
  } else {
    return null;
  }
  if (heldMinutes > MAXIMUM_HOLD_MINUTES) return 'too-long';
  return localDateTimeUtc(endDay, {
    hour: Math.floor(window.endMinutes / MINUTES_PER_HOUR),
    minute: window.endMinutes % MINUTES_PER_HOUR,
    second: 0,
  }, FARM_TIME_ZONE);
}

/**
 * La règle, pour une notification qui partirait à l'instant `at` (pour une
 * alarme programmée d'avance, son échéance), avec le réglage de sa ferme :
 *
 * - la fin d'un arrosage démarré part toujours, sans lire le réglage (S3) ;
 * - réglage éteint ou absent, rien ne change (S2) ;
 * - réglage hors des bornes, plage ignorée comme éteinte, défaut dit (S17) ;
 * - le gel passe tant que sa case est cochée (S3) ;
 * - hors de la plage, tout part ;
 * - dans la plage, le rappel du soir ne part pas (S5), le reste est retenu
 *   jusqu'à la fin (S4, S6), jamais plus d'une plage (S7).
 */
export function quietHoursDecision(settings: QuietHoursSettings, notification: QuietHoursNotification, at: Date): QuietHoursDecision {
  if (notification.kind === 'irrigation-finished') return SEND;
  if (!settings.enabled) return SEND;
  const window = windowOf(settings);
  if (!window) return { action: 'send', defect: 'invalid-setting' };
  if (settings.frostPasses && isFrost(notification)) return SEND;
  const end = quietHoldEnd(window, at);
  if (end === null) return SEND;
  if (notification.kind === 'evening-reminder') return { action: 'skip' };
  if (end === 'too-long') return { action: 'send', defect: 'hold-too-long' };
  return { action: 'hold', until: end.toISOString() };
}

/**
 * La limite d'un identifiant du service de notification
 * (`validateIrrigationPushAlarmRequest`) : 128 caractères.
 */
const ALARM_ID_MAX_LENGTH = 128;

/**
 * S10 : l'identifiant d'alarme d'une alerte retenue, qui partait par l'envoi
 * immédiat et part, retenue, par une alarme à échéance : « quiet: », l'espace,
 * puis l'étiquette de la notification. Sans l'espace, deux fermes qui retiennent
 * la même nuit une alerte de même étiquette se disputeraient la même alarme du
 * Worker, qui n'en garde qu'une par identifiant (F744, D-293) ; deux
 * notifications de même étiquette d'une même ferme n'en font qu'une, comme
 * aujourd'hui (S4). Une étiquette trop longue pour la limite du Worker est
 * remplacée par son empreinte. Le message du matin et le retard d'une
 * irrigation gardent leur propre alarme, qui porte déjà l'espace ou l'arrosage
 * (le démarrage remplace l'alarme de retard par celle de la fin).
 */
export function quietHoldAlarmId(workspaceId: string, tag: string): string {
  const prefix = `quiet:${workspaceId}`;
  const plain = `${prefix}:${tag}`;
  return plain.length <= ALARM_ID_MAX_LENGTH ? plain : pushTag(prefix, [tag]);
}

/** « 22:00 » → 1 320. */
function minutesOf(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * MINUTES_PER_HOUR + minute;
}

/** 1 320 → « 22:00 ». */
function clockTime(minutes: number): string {
  return `${String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, '0')}:${String(minutes % MINUTES_PER_HOUR).padStart(2, '0')}`;
}
