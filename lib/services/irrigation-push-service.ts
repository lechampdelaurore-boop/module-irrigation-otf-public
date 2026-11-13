import { env } from 'cloudflare:workers';
import type {
  IrrigationPushAlarmRequest,
  IrrigationPushSendRequest,
  IrrigationPushSubscription,
} from '../domain/irrigation-push-contract';
import { isDemoDeployment } from './deployment-mode';

const REQUEST_TIMEOUT_MS = 8_000;

export type IrrigationPushServiceResult =
  | { status: 'ok' }
  | { status: 'disabled' }
  | { status: 'failed'; message: string };

export function getIrrigationPushPublicKey(): string | null {
  // La démonstration n'envoie aucune notification (docs/demo-guided-contract.md, C7).
  if (isDemoDeployment()) return null;
  const value = readServerSetting('IRRIGATION_PUSH_VAPID_PUBLIC_KEY');
  return value?.trim() || null;
}

export async function scheduleIrrigationPushAlarm(
  request: IrrigationPushAlarmRequest,
): Promise<IrrigationPushServiceResult> {
  return callPushService('/v1/alarms/schedule', request);
}

export async function cancelIrrigationPushAlarm(request: {
  eventEquipmentId: string;
  revision: string;
}): Promise<IrrigationPushServiceResult> {
  return callPushService('/v1/alarms/cancel', request);
}

export async function registerIrrigationPushSubscription(
  recipientKey: string,
  subscription: IrrigationPushSubscription,
): Promise<IrrigationPushServiceResult> {
  return callPushService('/v1/subscriptions/upsert', {
    recipientKey,
    subscription,
  });
}

export async function unregisterIrrigationPushSubscription(
  recipientKey: string,
  endpoint: string,
): Promise<IrrigationPushServiceResult> {
  return callPushService('/v1/subscriptions/remove', {
    recipientKey,
    endpoint,
  });
}

/**
 * L'envoi immédiat d'une notification (alertes météo) : le Worker la délivre
 * tout de suite et dit ce qu'il en est (docs/push-worker-contract.md,
 * « Envoi immédiat ») ; une réponse illisible compte comme un échec.
 */
export type IrrigationPushSendResult =
  | { status: 'sent' | 'no-subscriber' | 'retrying' | 'failed' }
  | { status: 'disabled' }
  | { status: 'unreachable'; message: string };

export async function sendIrrigationPushNotification(
  request: IrrigationPushSendRequest,
): Promise<IrrigationPushSendResult> {
  let status: unknown = null;
  const result = await callPushService('/v1/notifications/send', request, async (response) => {
    const body = await response.json().catch(() => null) as { status?: unknown } | null;
    status = body?.status ?? null;
  });
  if (result.status !== 'ok') return result.status === 'disabled' ? result : { status: 'unreachable', message: result.message };
  return status === 'sent' || status === 'no-subscriber' || status === 'retrying' || status === 'failed'
    ? { status }
    : { status: 'unreachable', message: 'Réponse du service d’alerte illisible.' };
}

async function callPushService(
  pathname: string,
  payload: unknown,
  readResponse?: (response: Response) => Promise<void>,
): Promise<IrrigationPushServiceResult> {
  if (isDemoDeployment()) return { status: 'disabled' };
  const baseUrl = readPushServiceBaseUrl();
  const token = readServerSetting('IRRIGATION_PUSH_SERVICE_TOKEN')?.trim();
  if (!baseUrl || !token) return { status: 'disabled' };

  try {
    // Liaison de service quand elle existe : un Worker ne joint pas un autre
    // Worker du même compte par son adresse publique workers.dev. Sans liaison
    // (hébergement Sites, développement local), l’appel réseau ordinaire reste.
    const transport = env.IRRIGATION_PUSH ?? { fetch: (input: string, init?: RequestInit) => fetch(input, init) };
    const response = await transport.fetch(new URL(pathname, baseUrl).toString(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok) {
      await readResponse?.(response);
      return { status: 'ok' };
    }
    return {
      status: 'failed',
      message: `Le service d’alerte a répondu ${response.status}.`,
    };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error
        ? 'Le service d’alerte ne répond pas.'
        : 'Le service d’alerte est indisponible.',
    };
  }
}

function readPushServiceBaseUrl(): URL | null {
  const configured = readServerSetting('IRRIGATION_PUSH_SERVICE_URL')?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localDevelopment =
      process.env.NODE_ENV !== 'production' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
    if (url.protocol !== 'https:' && !localDevelopment) return null;
    url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    url.search = '';
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function readServerSetting(
  key:
    | 'IRRIGATION_PUSH_SERVICE_URL'
    | 'IRRIGATION_PUSH_SERVICE_TOKEN'
    | 'IRRIGATION_PUSH_VAPID_PUBLIC_KEY',
): string | undefined {
  const workerValue = env[key];
  return process.env[key] ?? workerValue;
}
