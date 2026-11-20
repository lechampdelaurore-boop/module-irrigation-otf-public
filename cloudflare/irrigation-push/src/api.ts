import {
  validateIrrigationPushAlarmCancellation,
  validateIrrigationPushAlarmRequest,
  validateIrrigationPushRecipientForget,
  validateIrrigationPushSendRequest,
  validateIrrigationPushSubscriptionRequest,
  validateIrrigationPushUnsubscriptionRequest,
  type IrrigationPushAlarmRequest,
  type IrrigationPushRegistration,
  type IrrigationPushSendRequest,
} from './contract.ts';

const MAX_REQUEST_BYTES = 32_768;

type AlarmApiStub = {
  schedule: (request: IrrigationPushAlarmRequest) => Promise<unknown>;
  cancel: (revision: string) => Promise<unknown>;
};

/**
 * Un appareil, désigné par son adresse d'abonnement : toute inscription et
 * tout retrait passent par lui, jamais directement par la liste d'un espace
 * (docs/tranche-4-contract.md, F371 à F377).
 */
type DeviceApiStub = {
  register: (registration: IrrigationPushRegistration) => Promise<unknown>;
  unregister: (recipientKey: string, endpoint: string) => Promise<void>;
};

/** La liste des appareils d'un espace : son oubli entier, quand l'espace est effacé (F654). */
type RecipientApiStub = {
  forgetAll: (recipientKey: string) => Promise<{ forgotten: number }>;
};

export type PushApiDependencies = {
  serviceToken: string;
  sendNow: (request: IrrigationPushSendRequest) => Promise<unknown>;
  getAlarm: (eventEquipmentId: string) => AlarmApiStub;
  getDevice: (endpoint: string) => DeviceApiStub;
  getRecipient: (recipientKey: string) => RecipientApiStub;
};

export async function handlePushApiRequest(
  request: Request,
  dependencies: PushApiDependencies,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
  }
  if (!await isAuthorized(request, dependencies.serviceToken)) {
    return json({ error: 'unauthorized' }, 401);
  }

  const input = await readJson(request);
  if (input === null) return json({ error: 'invalid_json' }, 400);
  const pathname = new URL(request.url).pathname;
  if (pathname === '/v1/alarms/schedule') {
    const schedule = validateIrrigationPushAlarmRequest(input);
    if (!schedule) return json({ error: 'invalid_schedule' }, 400);
    return json(
      await dependencies.getAlarm(schedule.eventEquipmentId).schedule(schedule),
      200,
    );
  }
  if (pathname === '/v1/notifications/send') {
    const send = validateIrrigationPushSendRequest(input);
    if (!send) return json({ error: 'invalid_notification' }, 400);
    return json(await dependencies.sendNow(send), 200);
  }
  if (pathname === '/v1/alarms/cancel') {
    const cancellation = validateIrrigationPushAlarmCancellation(input);
    if (!cancellation) return json({ error: 'invalid_cancellation' }, 400);
    return json(
      await dependencies.getAlarm(cancellation.eventEquipmentId)
        .cancel(cancellation.revision),
      200,
    );
  }
  if (pathname === '/v1/subscriptions/upsert') {
    const registration = validateIrrigationPushSubscriptionRequest(input);
    if (!registration) return json({ error: 'invalid_subscription' }, 400);
    return json(
      await dependencies.getDevice(registration.subscription.endpoint).register(registration),
      200,
    );
  }
  if (pathname === '/v1/subscriptions/remove') {
    const registration = validateIrrigationPushUnsubscriptionRequest(input);
    if (!registration) return json({ error: 'invalid_subscription' }, 400);
    await dependencies.getDevice(registration.endpoint)
      .unregister(registration.recipientKey, registration.endpoint);
    return new Response(null, { status: 204 });
  }
  if (pathname === '/v1/recipients/forget') {
    const forget = validateIrrigationPushRecipientForget(input);
    if (!forget) return json({ error: 'invalid_recipient' }, 400);
    return json(await dependencies.getRecipient(forget.recipientKey).forgetAll(forget.recipientKey), 200);
  }
  return json({ error: 'not_found' }, 404);
}

async function isAuthorized(request: Request, expectedToken: string) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ') || !expectedToken) return false;
  const suppliedToken = header.slice('Bearer '.length);
  const encoder = new TextEncoder();
  const [suppliedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(suppliedToken)),
    crypto.subtle.digest('SHA-256', encoder.encode(expectedToken)),
  ]);
  const supplied = new Uint8Array(suppliedHash);
  const expected = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) {
    difference |= supplied[index] ^ expected[index];
  }
  return difference === 0;
}

async function readJson(request: Request): Promise<unknown | null> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) return null;
  const body = await request.text();
  if (!body || body.length > MAX_REQUEST_BYTES) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...headers },
  });
}
