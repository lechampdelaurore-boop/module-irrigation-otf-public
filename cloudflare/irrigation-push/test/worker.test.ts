import assert from 'node:assert/strict';
import test from 'node:test';
import type { PushSubscription, VapidKeys } from '@block65/webcrypto-web-push';
import { handlePushApiRequest, type PushApiDependencies } from '../src/api.ts';
import type { IrrigationPushNotification, IrrigationPushSendRequest } from '../src/contract.ts';
import { deliverWebPush } from '../src/delivery.ts';
import {
  compareAlarmRevisions,
  deliveryRetryDelay,
  immediateDeliveryStatus,
  shouldRetryDelivery,
} from '../src/domain.ts';

const authorization = { authorization: 'Bearer test-service-token' };
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
  expirationTime: null,
  keys: { p256dh: 'abcdefgh_12345678', auth: 'abcdefgh-12345678' },
} satisfies PushSubscription;
const notification: IrrigationPushNotification = {
  title: 'Irrigation terminée',
  body: 'Rampe 1 · maximum',
  tag: 'irrigation-finished-event-equipment-1',
  data: { url: '/irrigation?season=2026#irrigation-event-equipment-1' },
};
const weatherNotification: IrrigationPushNotification = {
  title: 'Alerte météo',
  body: 'Température minimale prévue 4 °C mardi 3 novembre (seuil : sous 5 °C). Prévision du 2 novembre, 06 h 15.',
  tag: 'weather-alert:critere-1:v1:2026-11-03',
  data: { url: '/irrigation?season=2026&week=2026-11-02#weather' },
};
const vapid = {
  subject: 'https://example.com',
  publicKey: 'public',
  privateKey: 'private',
} satisfies VapidKeys;
const build = async () => ({ method: 'POST' }) as RequestInit;

test('l’API interne refuse tout appel sans secret partagé', async () => {
  const response = await handlePushApiRequest(
    new Request('https://worker.test/v1/alarms/schedule', {
      method: 'POST',
      body: '{}',
    }),
    fakeDependencies(),
  );
  assert.equal(response.status, 401);
});

test('les abonnements sont adressés au seul espace irrigation demandé', async () => {
  const recipients: string[] = [];
  const dependencies = fakeDependencies({
    onRecipient: (recipientKey) => recipients.push(recipientKey),
  });
  const response = await handlePushApiRequest(
    new Request('https://worker.test/v1/subscriptions/upsert', {
      method: 'POST',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ recipientKey: 'workspace-a', subscription }),
    }),
    dependencies,
  );
  assert.equal(response.status, 204);
  assert.deepEqual(recipients, ['workspace-a']);
});

test('les révisions empêchent une ancienne alarme de remplacer la nouvelle', () => {
  assert.equal(compareAlarmRevisions('2000-new', '1000-old'), 1);
  assert.equal(compareAlarmRevisions('2000-new', '2000-new'), 0);
  assert.equal(compareAlarmRevisions('1000-old', '2000-new'), -1);
});

test('les tentatives transitoires suivent une attente bornée', () => {
  assert.equal(shouldRetryDelivery(1, 1, 12), true);
  assert.equal(shouldRetryDelivery(0, 1, 12), false);
  assert.equal(shouldRetryDelivery(1, 12, 12), false);
  assert.equal(deliveryRetryDelay(1, 15_000, 900_000), 15_000);
  assert.equal(deliveryRetryDelay(20, 15_000, 900_000), 900_000);
});

test('l’envoi immédiat exige le secret partagé', async () => {
  const response = await handlePushApiRequest(
    new Request('https://worker.test/v1/notifications/send', { method: 'POST', body: '{}' }),
    fakeDependencies({ onSend: () => assert.fail('aucun envoi sans secret') }),
  );
  assert.equal(response.status, 401);
});

test('l’envoi immédiat part vers le seul destinataire demandé et rend le résultat', async () => {
  const sent: IrrigationPushSendRequest[] = [];
  const response = await handlePushApiRequest(
    new Request('https://worker.test/v1/notifications/send', {
      method: 'POST',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        notificationId: 'weather-alert:critere-1:v1:2026-11-03',
        recipientKey: 'workspace-a',
        revision: '1793600100000-a1',
        notification: { ...weatherNotification, title: '  Alerte   météo ' },
      }),
    }),
    fakeDependencies({ onSend: (request) => sent.push(request) }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'sent', subscriptions: 1, delivered: 1, alreadyDelivered: 0, expired: 0, transient: 0, permanent: 0,
  });
  assert.deepEqual(sent, [{
    notificationId: 'weather-alert:critere-1:v1:2026-11-03',
    recipientKey: 'workspace-a',
    revision: '1793600100000-a1',
    notification: { ...weatherNotification, title: 'Alerte météo' },
  }]);
});

test('une notification peut ouvrir une page du module (3.8)', async () => {
  const sent: IrrigationPushSendRequest[] = [];
  const pageNotification = { ...weatherNotification, data: { url: '/irrigation/alertes-meteo?season=2026&week=2026-11-02' } };
  const response = await handlePushApiRequest(
    new Request('https://worker.test/v1/notifications/send', {
      method: 'POST',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        notificationId: 'weather-alert:critere-1:v1:2026-11-03',
        recipientKey: 'workspace-a',
        revision: '1793600100000-a1',
        notification: pageNotification,
      }),
    }),
    fakeDependencies({ onSend: (request) => sent.push(request) }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(sent.map((request) => request.notification.data.url), ['/irrigation/alertes-meteo?season=2026&week=2026-11-02']);
});

test('l’envoi immédiat garde les limites de texte et la liste blanche des adresses', async () => {
  const invalid = [
    { title: 'x'.repeat(81) },
    { body: 'x'.repeat(161) },
    { tag: 'avec espace' },
    { data: { url: 'https://ailleurs.example/irrigation' } },
    { data: { url: '/autre-page' } },
    { data: { url: '/irrigation/a/b' } },
    { data: { url: '/irrigation/' } },
  ];
  for (const change of invalid) {
    const response = await handlePushApiRequest(
      new Request('https://worker.test/v1/notifications/send', {
        method: 'POST',
        headers: { ...authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          notificationId: 'weather-alert:critere-1:v1:2026-11-03',
          recipientKey: 'workspace-a',
          revision: '1793600100000-a1',
          notification: { ...weatherNotification, ...change },
        }),
      }),
      fakeDependencies({ onSend: () => assert.fail(`envoyée malgré ${JSON.stringify(change)}`) }),
    );
    assert.equal(response.status, 400, JSON.stringify(change));
  }
  for (const missing of ['notificationId', 'recipientKey', 'revision']) {
    const body: Record<string, unknown> = {
      notificationId: 'weather-alert:critere-1:v1:2026-11-03',
      recipientKey: 'workspace-a',
      revision: '1793600100000-a1',
      notification: weatherNotification,
    };
    delete body[missing];
    const response = await handlePushApiRequest(
      new Request('https://worker.test/v1/notifications/send', {
        method: 'POST',
        headers: { ...authorization, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      fakeDependencies({ onSend: () => assert.fail(`envoyée sans ${missing}`) }),
    );
    assert.equal(response.status, 400, missing);
  }
});

test('le résultat d’un envoi immédiat distingue envoyée, aucun appareil, nouvelle tentative et échec', () => {
  const none = { subscriptions: 0, delivered: 0, alreadyDelivered: 0, expired: 0, transient: 0, permanent: 0 };
  assert.equal(immediateDeliveryStatus(none), 'no-subscriber');
  assert.equal(immediateDeliveryStatus({ ...none, subscriptions: 2, expired: 2 }), 'no-subscriber');
  assert.equal(immediateDeliveryStatus({ ...none, subscriptions: 2, delivered: 1, transient: 1 }), 'sent');
  assert.equal(immediateDeliveryStatus({ ...none, subscriptions: 1, alreadyDelivered: 1 }), 'sent');
  assert.equal(immediateDeliveryStatus({ ...none, subscriptions: 2, transient: 1, permanent: 1 }), 'retrying');
  assert.equal(immediateDeliveryStatus({ ...none, subscriptions: 1, permanent: 1 }), 'failed');
});

for (const [status, expected] of [
  [201, 'delivered'],
  [410, 'expired'],
  [429, 'transient'],
  [503, 'transient'],
  [400, 'permanent'],
] as const) {
  test(`la réponse ${status} du fournisseur est classée ${expected}`, async () => {
    const disposition = await deliverWebPush(subscription, notification, vapid, {
      build: build as never,
      send: async () => new Response(null, { status }),
    });
    assert.equal(disposition, expected);
  });
}

test('chaque notification part en priorité haute, valable une heure', async () => {
  const messages: unknown[] = [];
  await deliverWebPush(subscription, notification, vapid, {
    build: (async (message: unknown) => {
      messages.push(message);
      return { method: 'POST' };
    }) as never,
    send: async () => new Response(null, { status: 201 }),
  });
  assert.deepEqual(
    (messages[0] as { options: unknown }).options,
    { ttl: 3600, urgency: 'high' },
    'en priorité normale, un téléphone en veille peut retenir l’alerte jusqu’au déverrouillage',
  );
});

function fakeDependencies(options: {
  onRecipient?: (recipientKey: string) => void;
  onSend?: (request: IrrigationPushSendRequest) => void;
} = {}): PushApiDependencies {
  return {
    serviceToken: 'test-service-token',
    async sendNow(request) {
      options.onSend?.(request);
      return { status: 'sent', subscriptions: 1, delivered: 1, alreadyDelivered: 0, expired: 0, transient: 0, permanent: 0 };
    },
    getAlarm: () => ({
      async schedule() { return { status: 'scheduled' }; },
      async cancel() { return { status: 'canceled' }; },
    }),
    getRecipient: (recipientKey) => ({
      async upsert() { options.onRecipient?.(recipientKey); },
      async remove() { options.onRecipient?.(recipientKey); },
    }),
  };
}
