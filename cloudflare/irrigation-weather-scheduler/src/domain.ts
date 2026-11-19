const PARIS_TIME_ZONE = 'Europe/Paris';

export function isParisDailyWeatherWindow(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PARIS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour === 6 && minute === 15;
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
 * Une erreur d'appel se retente seulement si la route n'a sans doute rien
 * commencé. Un délai dépassé veut dire que la route a reçu la demande et
 * travaille encore : la relancer refaisait toute la synchronisation une
 * seconde fois chaque matin (D-166).
 */
export function schedulerErrorRetriable(error: unknown) {
  const name = error instanceof Error ? error.name : null;
  return name !== 'TimeoutError' && name !== 'AbortError';
}
