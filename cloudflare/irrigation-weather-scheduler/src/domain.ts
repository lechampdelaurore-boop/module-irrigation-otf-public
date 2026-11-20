const PARIS_TIME_ZONE = 'Europe/Paris';

export function isParisDailyWeatherWindow(date: Date) {
  return isParisTime(date, 6, 15);
}

/**
 * Les deux déclencheurs du planificateur, chacun déclaré deux fois en UTC
 * pour tenir son heure de Paris en été comme en hiver. Ils doivent rester
 * identiques à `wrangler.jsonc` et au registre des tâches du site
 * (lib/domain/operations/task-registry.ts) : un test le vérifie de chaque côté.
 */
export const WEATHER_CRON = '15 4,5 * * *';
export const OPERATOR_WATCH_CRON = '0 7,8 * * *';

export type ScheduledJob = 'weather' | 'operator-watch';

/**
 * Ce qu'un déclenchement doit lancer (4.5, docs/tranche-4-contract.md, F566,
 * F608) : la météo et les calculs du matin à 6 h 15 ; la veille de
 * l'exploitant à 9 h, un déclencheur distinct de ce qu'elle surveille (R5).
 * Rien pour le créneau UTC qui ne tombe pas à la bonne heure de Paris, ni pour
 * une expression inconnue.
 */
export function scheduledJob(cron: string, date: Date): ScheduledJob | null {
  if (cron === WEATHER_CRON) return isParisDailyWeatherWindow(date) ? 'weather' : null;
  if (cron === OPERATOR_WATCH_CRON) return isParisTime(date, 9, 0) ? 'operator-watch' : null;
  return null;
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
 * Une erreur d'appel se retente seulement si la route n'a sans doute rien
 * commencé. Un délai dépassé veut dire que la route a reçu la demande et
 * travaille encore : la relancer refaisait toute la synchronisation une
 * seconde fois chaque matin (D-166).
 */
export function schedulerErrorRetriable(error: unknown) {
  const name = error instanceof Error ? error.name : null;
  return name !== 'TimeoutError' && name !== 'AbortError';
}
