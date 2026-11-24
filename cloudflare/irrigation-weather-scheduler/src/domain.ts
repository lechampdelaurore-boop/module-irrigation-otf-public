const PARIS_TIME_ZONE = 'Europe/Paris';

export function isParisDailyWeatherWindow(date: Date) {
  return isParisTime(date, 6, 15);
}

/**
 * Les déclencheurs du planificateur : les deux du matin, chacun déclaré deux
 * fois en UTC pour tenir son heure de Paris en été comme en hiver, et celui
 * du rappel du soir, chaque heure (amélioration n° 2, F705) : chaque ferme
 * règle son heure, et le site trie les fermes dues. Ils doivent rester
 * identiques à `wrangler.jsonc` et au registre des tâches du site
 * (lib/domain/operations/task-registry.ts) : un test le vérifie de chaque côté.
 */
export const WEATHER_CRON = '15 4,5 * * *';
export const OPERATOR_WATCH_CRON = '0 7,8 * * *';
export const EVENING_REMINDER_CRON = '5 * * * *';
/**
 * La relecture des prévisions pour les alertes (C1, D-303) : 9 h 30, 12 h 30,
 * 15 h 30, 18 h 30 et 21 h 30 à Paris, soit en UTC 8 h 30, 11 h 30, 14 h 30,
 * 17 h 30 et 20 h 30 en hiver, une heure plus tôt en été ; les dix créneaux
 * sont déclarés, et seul celui qui tombe à la bonne heure de Paris lance.
 */
export const INTRADAY_WEATHER_CRON = '30 7,8,10,11,13,14,16,17,19,20 * * *';
const INTRADAY_WEATHER_PARIS_HOURS: readonly number[] = [9, 12, 15, 18, 21];

export type ScheduledJob = 'weather' | 'operator-watch' | 'evening-reminder' | 'weather-intraday';

/**
 * Ce qu'un déclenchement doit lancer (4.5, docs/tranche-4-contract.md, F566,
 * F608) : la météo et les calculs du matin à 6 h 15 ; la veille de
 * l'exploitant à 9 h, un déclencheur distinct de ce qu'elle surveille (R5) ;
 * le passage du rappel du soir chaque heure (amélioration n° 2) ; la
 * relecture des prévisions pour les alertes cinq fois dans la journée (C1).
 * Rien pour le créneau UTC qui ne tombe pas à la bonne heure de Paris, ni pour
 * une expression inconnue.
 */
export function scheduledJob(cron: string, date: Date): ScheduledJob | null {
  if (cron === WEATHER_CRON) return isParisDailyWeatherWindow(date) ? 'weather' : null;
  if (cron === OPERATOR_WATCH_CRON) return isParisTime(date, 9, 0) ? 'operator-watch' : null;
  // Chaque heure : l'heure de Paris n'importe pas ici, le site lit l'heure réglée de chaque ferme.
  if (cron === EVENING_REMINDER_CRON) return 'evening-reminder';
  if (cron === INTRADAY_WEATHER_CRON) return isParisIntradayWeatherWindow(date) ? 'weather-intraday' : null;
  return null;
}

function isParisIntradayWeatherWindow(date: Date) {
  return INTRADAY_WEATHER_PARIS_HOURS.some((hour) => isParisTime(date, hour, 30));
}

function isParisTime(date: Date, expectedHour: number, expectedMinute: number) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PARIS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour === expectedHour && minute === expectedMinute;
}

export function schedulerRetryDelayMs(response: Pick<Response, 'status' | 'headers'>, attempt: number) {
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After'));
    return Math.min(2_000, Math.max(250, Number.isFinite(retryAfter) ? retryAfter * 1_000 : 1_000));
  }
  return Math.min(2_000, 250 * (2 ** Math.max(0, attempt - 1)));
}

export function schedulerResponseRetriable(status: number) {
  return status === 429 || status >= 500;
}

/**
 * Le temps laissé à la route du site pour répondre (correctif météo, PR 3,
 * D-166). La route enchaîne la météo puis les calculs du matin (planning, eau
 * des cultures, réserve du sol) : 15 à plus de 25 secondes mesurées le
 * 19 novembre 2026. Vingt-cinq secondes l'abandonnaient en route.
 */
export const SITE_SYNC_TIMEOUT_MS = 90_000;

/**
 * Le temps laissé à la veille (4.5, F608) : elle lit le registre des tâches
 * et envoie au plus une notification, quelques secondes ; trente laissent de
 * la marge sans bloquer le planificateur.
 */
export const OPERATOR_WATCH_TIMEOUT_MS = 30_000;

/**
 * Le temps laissé au passage du rappel du soir (amélioration n° 2) : il lit
 * les fermes dues et confie au plus un rappel par ferme au Worker de
 * notification ; trente secondes, comme la veille.
 */
export const EVENING_REMINDER_TIMEOUT_MS = 30_000;

/**
 * Le temps laissé à la relecture de la journée (C1, D-303) : un appel de
 * prévisions par lieu, puis l'évaluation des alertes des fermes relues, sans
 * les calculs du matin ; soixante secondes, moins que le matin.
 */
export const INTRADAY_WEATHER_TIMEOUT_MS = 60_000;

/**
 * Une erreur d'appel se retente seulement si la route n'a sans doute rien
 * commencé. Un délai dépassé veut dire que la route a reçu la demande et
 * travaille encore : la relancer refaisait toute la synchronisation une
 * seconde fois chaque matin (D-166).
 */
export function schedulerErrorRetriable(error: unknown) {
  const name = error instanceof Error ? error.name : null;
  return name !== 'TimeoutError' && name !== 'AbortError';
}
