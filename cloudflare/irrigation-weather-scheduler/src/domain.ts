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
