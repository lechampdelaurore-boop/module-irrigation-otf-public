import {
  EVENING_REMINDER_TIMEOUT_MS,
  OPERATOR_WATCH_TIMEOUT_MS,
  SITE_SYNC_TIMEOUT_MS,
  scheduledJob,
  schedulerErrorRetriable,
  schedulerResponseRetriable,
  schedulerRetryDelayMs,
  type ScheduledJob,
} from './domain.ts';

const MAX_ATTEMPTS = 3;

/**
 * Chaque tâche du planificateur : la route interne du site qu'elle appelle, le
 * temps qu'elle lui laisse, et le préfixe de ses lignes de journal (les noms
 * de la météo restent ceux d'avant la 4.5).
 */
const SITE_ROUTES: Record<ScheduledJob, { path: string; timeoutMs: number; event: string }> = {
  weather: { path: '/api/internal/weather-sync', timeoutMs: SITE_SYNC_TIMEOUT_MS, event: 'weather_scheduler' },
  'operator-watch': { path: '/api/internal/operator-watch', timeoutMs: OPERATOR_WATCH_TIMEOUT_MS, event: 'operator_watch_scheduler' },
  'evening-reminder': { path: '/api/internal/evening-reminder', timeoutMs: EVENING_REMINDER_TIMEOUT_MS, event: 'evening_reminder_scheduler' },
};

/** Les relances à la main, par le jeton de service : une adresse par tâche. */
const MANUAL_PATHS: Record<string, ScheduledJob> = {
  '/run': 'weather',
  '/run-watch': 'operator-watch',
  '/run-evening': 'evening-reminder',
};

const FAILURE_BODIES: Record<ScheduledJob, string> = {
  weather: 'Weather synchronization failed',
  'operator-watch': 'Operator watch failed',
  'evening-reminder': 'Evening reminder failed',
};

export default {
  async scheduled(controller, env, ctx): Promise<void> {
    const scheduledAt = new Date(controller.scheduledTime);
    const job = scheduledJob(controller.cron, scheduledAt);
    if (!job) {
      console.info(JSON.stringify({
        event: 'weather_scheduler_dst_slot_skipped',
        cron: controller.cron,
        scheduledAt: scheduledAt.toISOString(),
      }));
      return;
    }
    ctx.waitUntil(triggerSiteRoute(env, job, 'cron'));
  },

  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const job: ScheduledJob | null = MANUAL_PATHS[url.pathname] ?? null;
    if (request.method !== 'POST' || !job) {
      return new Response('Not found', { status: 404 });
    }
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')
        || !await secureEqual(authorization.slice(7), env.WEATHER_SYNC_SERVICE_TOKEN)) {
      return new Response('Unauthorized', { status: 401 });
    }
    const result = await triggerSiteRoute(env, job, 'manual');
    return Response.json(result.body, { status: result.status });
  },
} satisfies ExportedHandler<Env>;

async function triggerSiteRoute(env: Env, job: ScheduledJob, trigger: 'cron' | 'manual') {
  const route = SITE_ROUTES[job];
  const endpoint = new URL(route.path, env.IRRIGATION_SITE_URL);
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
        signal: AbortSignal.timeout(route.timeoutMs),
      });
      lastStatus = response.status;
      if (response.ok || response.status === 409) {
        const body = await safeJson(response);
        console.info(JSON.stringify({
          event: `${route.event}_completed`,
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
        event: `${route.event}_retry_scheduled`,
        trigger,
        attempt,
        status: response.status,
        delayMs,
      }));
      await wait(delayMs);
    } catch (error) {
      if (!schedulerErrorRetriable(error)) {
        // La route a reçu la demande et travaille encore : pas de seconde exécution (D-166).
        console.warn(JSON.stringify({
          event: `${route.event}_timeout_not_retried`,
          trigger,
          attempt,
          timeoutMs: route.timeoutMs,
          error: error instanceof Error ? error.name : 'unknown',
        }));
        lastStatus = 504;
        break;
      }
      if (attempt === MAX_ATTEMPTS) break;
      const delayMs = Math.min(2_000, 250 * (2 ** (attempt - 1)));
      console.warn(JSON.stringify({
        event: `${route.event}_network_retry`,
        trigger,
        attempt,
        delayMs,
        error: error instanceof Error ? error.name : 'unknown',
      }));
      await wait(delayMs);
    }
  }
  console.error(JSON.stringify({
    event: `${route.event}_failed`,
    trigger,
    status: lastStatus,
    failedAt: new Date().toISOString(),
  }));
  return { status: lastStatus, body: { error: FAILURE_BODIES[job] } };
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
