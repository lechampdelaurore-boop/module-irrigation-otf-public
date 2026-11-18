import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import {
  irrigationPushPersonKey,
  irrigationPushRegistrationIntent,
  type IrrigationPushRegistration,
} from '../lib/domain/irrigation-push-contract.ts';
import { deviceStatusAfterRefresh } from '../lib/domain/irrigation-notifications.ts';
import { registerIrrigationPushSubscription } from '../lib/services/irrigation-push-service.ts';

/**
 * Un appareil, une personne, côté module (docs/tranche-4-contract.md,
 * section 5 quater, F371 à F374). Le module dit au service de notification
 * qui inscrit l'appareil (une empreinte, jamais l'identifiant) et par quel
 * geste : le bouton « Activer » ou la simple ouverture d'une page. Le service
 * lui-même est éprouvé dans `cloudflare/irrigation-push/test/`.
 */

const KEYS = ['DEMO_MODE', 'IRRIGATION_PUSH_SERVICE_URL', 'IRRIGATION_PUSH_SERVICE_TOKEN'] as const;
const savedEnv = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
const savedFetch = globalThis.fetch;

afterEach(() => {
  for (const key of KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  globalThis.fetch = savedFetch;
});

const registration: IrrigationPushRegistration = {
  recipientKey: 'espace-de-test',
  personKey: 'a'.repeat(64),
  intent: 'refresh',
  subscription: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/appareil-1',
    expirationTime: null,
    keys: { p256dh: 'abcdefgh_12345678', auth: 'abcdefgh-12345678' },
  },
};

/** Un service de notification joué par un faux réseau, qui garde ce qu'il reçoit. */
function pushService(answer: () => Response): { url: string; body: unknown }[] {
  delete process.env.DEMO_MODE;
  process.env.IRRIGATION_PUSH_SERVICE_URL = 'https://irrigation-otf-push.exemple.workers.dev';
  process.env.IRRIGATION_PUSH_SERVICE_TOKEN = 'jeton-de-test-sans-valeur';
  const received: { url: string; body: unknown }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    received.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return answer();
  }) as typeof fetch;
  return received;
}

test('l’empreinte d’une personne est la même pour ses fermes, différente d’une personne à l’autre (F371)', async () => {
  const alice = await irrigationPushPersonKey('alice-sub·ferme·12');
  assert.match(alice, /^[0-9a-f]{64}$/u);
  assert.equal(await irrigationPushPersonKey('alice-sub·ferme·34'), alice, 'deux fermes de la même personne');
  assert.equal(await irrigationPushPersonKey('alice-sub'), alice, 'son espace sans ferme');
  assert.notEqual(await irrigationPushPersonKey('bob-sub·ferme·12'), alice, 'une autre personne, même ferme');
  assert.equal(
    alice,
    createHash('sha256').update('irrigation-push-person:alice-sub').digest('hex'),
    'SHA-256 de l’identifiant préfixé',
  );
  assert.ok(!alice.includes('alice'), 'l’identifiant ne passe jamais tel quel');
});

test('une clé d’espace mal formée n’a pas d’empreinte', async () => {
  await assert.rejects(irrigationPushPersonKey('alice-sub·ferme·une ferme'));
  await assert.rejects(irrigationPushPersonKey('·ferme·12'));
});

test('seul « activate » exact prend un appareil ; tout le reste n’est qu’un renouvellement (F372)', () => {
  assert.equal(irrigationPushRegistrationIntent('activate'), 'activate');
  for (const value of ['refresh', undefined, null, 'ACTIVATE', 'activate ', 'prendre', 1, { intent: 'activate' }]) {
    assert.equal(irrigationPushRegistrationIntent(value), 'refresh', String(value));
  }
});

test('à l’ouverture d’une page, l’appareil d’une autre personne se montre « pas encore activé » (F374)', () => {
  assert.equal(deviceStatusAfterRefresh({ ok: true }), 'enabled');
  assert.equal(deviceStatusAfterRefresh({ ok: false, reason: 'other-person' }), 'default');
  assert.equal(deviceStatusAfterRefresh({ ok: false }), 'unavailable');
});

test('l’inscription porte l’espace, l’empreinte, le geste et l’abonnement, rien d’autre', async () => {
  const received = pushService(() => Response.json({ status: 'registered' }));
  assert.deepEqual(await registerIrrigationPushSubscription({ ...registration, intent: 'activate' }), { status: 'ok' });
  assert.deepEqual(received, [{
    url: 'https://irrigation-otf-push.exemple.workers.dev/v1/subscriptions/upsert',
    body: { ...registration, intent: 'activate' },
  }]);
});

test('le service dit « autre personne » : le module le rapporte, sans erreur', async () => {
  pushService(() => Response.json({ status: 'other-person' }));
  assert.deepEqual(await registerIrrigationPushSubscription(registration), { status: 'other-person' });
});

test('un service d’avant le correctif répond sans corps : l’appareil est inscrit comme avant', async () => {
  pushService(() => new Response(null, { status: 204 }));
  assert.deepEqual(await registerIrrigationPushSubscription(registration), { status: 'ok' });
});

test('une réponse illisible ou un refus du service est un échec, jamais une inscription', async () => {
  for (const answer of [
    () => Response.json({}),
    () => Response.json({ status: 'inscrit' }),
    () => new Response('pas du JSON', { status: 200 }),
  ]) {
    pushService(answer);
    assert.deepEqual(await registerIrrigationPushSubscription(registration), {
      status: 'failed',
      message: 'Réponse du service d’alerte illisible.',
    });
  }
  pushService(() => new Response('', { status: 400 }));
  assert.deepEqual(await registerIrrigationPushSubscription(registration), {
    status: 'failed',
    message: 'Le service d’alerte a répondu 400.',
  });
});

test('la page renouvelle à son ouverture et ne prend l’appareil que par « Activer » (F372)', () => {
  const hook = readFileSync(
    new URL('../app/irrigation/irrigation-manager/use-irrigation-notifications.ts', import.meta.url),
    'utf8',
  );
  const calls = [...hook.matchAll(/registerIrrigationPushSubscriptionAction\(\s*subscription\.toJSON\(\),\s*'(\w+)',?\s*\)/gu)];
  assert.deepEqual(calls.map((call) => call[1]), ['refresh', 'activate']);
  const enable = hook.indexOf('const enableNotifications');
  assert.ok(enable > 0);
  assert.ok((calls[0].index ?? 0) < enable, 'le renouvellement est fait à l’ouverture');
  assert.ok((calls[1].index ?? 0) > enable, '« activate » n’est donné que par le bouton');
});
