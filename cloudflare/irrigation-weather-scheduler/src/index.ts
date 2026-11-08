import {
  isParisDailyWeatherWindow,
  schedulerResponseRetriable,
  schedulerRetryDelayMs,
} from './domain.ts';

const MAX_ATTEMPTS = 3;

export default {
  async scheduled(controller, env, ctx): Promise<void> {
    const scheduledAt = new Date(controller.scheduledTime);
    if (!isParisDailyWeatherWindow(scheduledAt)) {
      console.info(JSON.stringify({
        event: 'weather_scheduler_dst_slot_skipped',
        scheduledAt: scheduledAt.toISOString(),
      }));
      return;
    }
    ctx.waitUntil(triggerSiteWeatherSync(env, 'cron'));
  },

  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/run') {
      return new Response('Not found', { status: 404 });
    }
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')
        || !await secureEqual(authorization.slice(7), env.WEATHER_SYNC_SERVICE_TOKEN)) {
      return new Response('Unauthorized', { status: 401 });
    }
    const result = await triggerSiteWeatherSync(env, 'manual');
    return Response.json(result.body, { status: result.status });
  },
} satisfies ExportedHandler<Env>;

async function triggerSiteWeatherSync(env: Env, trigger: 'cron' | 'manual') {
  const endpoint = new URL('/api/internal/weather-sync', env.IRRIGATION_SITE_URL);
  let lastStatus = 502;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      // Liaison de service : un Worker ne peut pas joindre un autre Worker du
      // même compte par son adresse publique workers.dev ; l’appel reste interne.
      const response = await env.IRRIGATION_SITE.fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          'x-irrigation-weather-sync-token': env.WEATHER_SYNC_SERVICE_TOKEN,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(25_000),
      });
      lastStatus = response.status;
      if (response.ok || response.status === 409) {
        const body = await safeJson(response);
        console.info(JSON.stringify({
          event: 'weather_scheduler_completed',
          trigger,
          attempt,
          status: response.status,
          completedAt: new Date().toISOString(),
        }));
        return { status: response.status, body };
      }
      if (!schedulerResponseRetriable(response.status) || attempt === MAX_ATTEMPTS) break;
      const delayMs = schedulerRetryDelayMs(response, attempt);
      console.warn(JSON.stringify({
        event: 'weather_scheduler_retry_scheduled',
        trigger,
        attempt,
        status: response.status,
        delayMs,
      }));
      await wait(delayMs);
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) break;
      const delayMs = Math.min(2_000, 250 * (2 ** (attempt - 1)));
      console.warn(JSON.stringify({
        event: 'weather_scheduler_network_retry',
        trigger,
        attempt,
        delayMs,
        error: error instanceof Error ? error.name : 'unknown',
      }));
      await wait(delayMs);
    }
  }
  console.error(JSON.stringify({
    event: 'weather_scheduler_failed',
    trigger,
    status: lastStatus,
    failedAt: new Date().toISOString(),
  }));
  return { status: lastStatus, body: { error: 'Weather synchronization failed' } };
}

async function secureEqual(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = providedBytes.length ^ expectedBytes.length;
  for (let index = 0; index < Math.max(providedBytes.length, expectedBytes.length); index += 1) {
    difference |= (providedBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return { status: response.status };
  }
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
