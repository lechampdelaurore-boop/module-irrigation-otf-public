import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import worker, { IrrigationAlarm, PushDevice, PushRecipient } from '../src/index.ts';
import { MemoryNamespace } from './support/durable-objects.ts';

/**
 * Un appareil, une personne (docs/tranche-4-contract.md, F371 à F378 ;
 * constats A, C3 et D1 de la revue de l'isolation du 18 novembre 2026).
 *
 * Ces tests font tourner le vrai code du Worker, ses trois classes de
 * Durable Objects comprises, sur une mémoire de test à la place de
 * Cloudflare. Seul le fournisseur de notifications (Google, Apple, Mozilla)
 * est imité : il note l'adresse de chaque appareil qui reçoit quelque chose.
 */

const TOKEN = 'jeton-de-test';
const base64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

type Device = {
  endpoint: string;
  expirationTime: null;
  keys: { p256dh: string; auth: string };
};

type Service = Awaited<ReturnType<typeof createService>>;

async function generatePair(name: 'ECDSA' | 'ECDH', usages: string[]) {
  return (await crypto.subtle.generateKey({ name, namedCurve: 'P-256' }, true, usages)) as CryptoKeyPair;
}

async function createService() {
  const vapid = await generatePair('ECDSA', ['sign', 'verify']);
  const env = {
    IRRIGATION_PUSH_SERVICE_TOKEN: TOKEN,
    VAPID_SUBJECT: 'https://module-irrigation-otf.lechampdelaurore.workers.dev',
    VAPID_PUBLIC_KEY: base64Url(new Uint8Array(await crypto.subtle.exportKey('raw', vapid.publicKey) as ArrayBuffer)),
    VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', vapid.privateKey) as JsonWebKey).d,
  } as unknown as Env;
  const alarms = new MemoryNamespace(IrrigationAlarm, () => env);
  const recipients = new MemoryNamespace(PushRecipient, () => env);
  const devices = new MemoryNamespace(PushDevice, () => env);
  Object.assign(env, { IRRIGATION_ALARMS: alarms, PUSH_RECIPIENTS: recipients, PUSH_DEVICES: devices });

  /** Les appareils qui ont reçu quelque chose, dans l'ordre. */
  const received: string[] = [];
  /** La réponse du fournisseur pour un appareil : 201 sauf mention contraire. */
  const providerStatus = new Map<string, number>();
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const endpoint = String(input);
    const status = providerStatus.get(endpoint) ?? 201;
    if (status < 300) received.push(endpoint);
    return new Response(null, { status });
  }) as typeof fetch;

  return { env, alarms, recipients, devices, received, providerStatus };
}

async function createDevice(name: string): Promise<Device> {
  const pair = await generatePair('ECDH', ['deriveBits']);
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${name}`,
    expirationTime: null,
    keys: {
      p256dh: base64Url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer)),
      auth: base64Url(crypto.getRandomValues(new Uint8Array(16))),
    },
  };
}

async function call(service: Service, path: string, body: unknown) {
  const response = await worker.fetch(new Request(`https://push.test${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), service.env);
  assert.ok(response.status < 300, `${path} a répondu ${response.status}`);
  return response.status === 204 ? null : await response.json() as Record<string, unknown>;
}

function register(service: Service, device: Device, recipientKey: string, personKey: string, intent: 'activate' | 'refresh' = 'activate') {
  return call(service, '/v1/subscriptions/upsert', { recipientKey, personKey, intent, subscription: device });
}

function unregister(service: Service, device: Device, recipientKey: string) {
  return call(service, '/v1/subscriptions/remove', { recipientKey, endpoint: device.endpoint });
}

let revision = 1_793_600_000_000;
function send(service: Service, recipientKey: string, notificationId = 'crop-frost:2026-11-18:suite') {
  revision += 1;
  return call(service, '/v1/notifications/send', {
    notificationId,
    recipientKey,
    revision: String(revision),
    notification: {
      title: 'Gel prévu',
      body: 'Courgettes, planche N01 : -2 °C prévus cette nuit.',
      tag: notificationId,
      data: { url: '/irrigation/alertes-cultures' },
    },
  });
}

/** Ce que reçoit chaque appareil pendant `action`. */
async function receivedDuring(service: Service, action: () => Promise<unknown>): Promise<string[]> {
  const before = service.received.length;
  await action();
  return service.received.slice(before);
}

/** Les espaces dont la liste contient cet appareil, lus dans le stockage de chacun. */
function spacesListing(service: Service, device: Device, recipientKeys: string[]): string[] {
  return recipientKeys.filter((recipientKey) => {
    const recipient = service.recipients.get(service.recipients.idFromName(recipientKey)) as unknown as {
      ctx: { storage: { sql: { exec: (query: string, ...values: string[]) => { toArray: () => unknown[] } } } };
    };
    return recipient.ctx.storage.sql
      .exec('SELECT endpoint FROM push_subscriptions WHERE endpoint = ?', device.endpoint)
      .toArray().length > 0;
  });
}

/** Inscrit l'appareil directement dans la liste d'un espace, comme avant le correctif. */
async function registerAsBeforeTheFix(service: Service, device: Device, recipientKey: string) {
  await service.recipients.get(service.recipients.idFromName(recipientKey)).upsert(device);
}

test('le même appareil inscrit par Alice dans A, puis par Bob dans B : un envoi à A ne lui parvient pas (constat A, C3)', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-partage');
  assert.deepEqual(await register(service, telephone, 'espace-a', 'alice'), { status: 'registered' });
  assert.deepEqual(await register(service, telephone, 'espace-b', 'bob'), { status: 'registered' });
  assert.deepEqual(spacesListing(service, telephone, ['espace-a', 'espace-b']), ['espace-b'], 'retiré de la liste de A dès l’inscription dans B');

  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), [], 'l’appareil de Bob ne reçoit rien de A');
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-b')), [telephone.endpoint]);
});

test('un envoi à A sans appareil dit « aucun appareil » une fois l’appareil passé à Bob', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-partage');
  await register(service, telephone, 'espace-a', 'alice');
  await register(service, telephone, 'espace-b', 'bob');
  const result = await send(service, 'espace-a');
  assert.equal(result?.status, 'no-subscriber');
  assert.equal(result?.delivered, 0);
});

test('une page ouverte par Bob sur l’appareil d’Alice ne le lui prend pas : rien ne change pour Alice (F372)', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-alice');
  await register(service, telephone, 'espace-a', 'alice');
  assert.deepEqual(await register(service, telephone, 'espace-b', 'bob', 'refresh'), { status: 'other-person' });

  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), [telephone.endpoint], 'Alice reçoit toujours ses alertes');
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-b')), [], 'Bob ne reçoit rien sur le téléphone d’Alice');
});

test('le geste « Activer » de Bob prend l’appareil ; la page d’Alice ne le reprend ensuite qu’à son propre geste', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-alice');
  await register(service, telephone, 'espace-a', 'alice');
  await register(service, telephone, 'espace-b', 'bob', 'activate');
  assert.deepEqual(await register(service, telephone, 'espace-a', 'alice', 'refresh'), { status: 'other-person' });
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), []);

  await register(service, telephone, 'espace-a', 'alice', 'activate');
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), [telephone.endpoint]);
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-b')), []);
});

test('une même personne, deux fermes : l’appareil reçoit les notifications de ses deux espaces (F373)', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-alice');
  await register(service, telephone, 'alice-ferme-7', 'alice');
  assert.deepEqual(await register(service, telephone, 'alice-ferme-8', 'alice', 'refresh'), { status: 'registered' });

  assert.deepEqual(await receivedDuring(service, () => send(service, 'alice-ferme-7')), [telephone.endpoint]);
  assert.deepEqual(await receivedDuring(service, () => send(service, 'alice-ferme-8')), [telephone.endpoint]);
});

test('au vingt et unième espace d’une même personne, le plus ancien perd l’appareil, dans sa liste aussi', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-alice');
  const spaces = Array.from({ length: 21 }, (_, index) => `alice-ferme-${index + 1}`);
  for (const space of spaces) await register(service, telephone, space, 'alice', 'refresh');

  assert.deepEqual(spacesListing(service, telephone, spaces), spaces.slice(1));
  assert.deepEqual(await receivedDuring(service, () => send(service, 'alice-ferme-1')), []);
  assert.deepEqual(await receivedDuring(service, () => send(service, 'alice-ferme-21')), [telephone.endpoint]);
});

test('« Désactiver » : l’appareil quitte l’espace et reste à sa personne ; une vieille inscription ne le reprend pas (F376)', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-alice');
  await register(service, telephone, 'espace-a', 'alice');
  await unregister(service, telephone, 'espace-a');
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), []);

  await registerAsBeforeTheFix(service, telephone, 'espace-b');
  const result = await send(service, 'espace-b');
  assert.equal(result?.reassigned, 1);
  assert.deepEqual(service.received, []);
  assert.deepEqual(spacesListing(service, telephone, ['espace-a', 'espace-b']), []);
  assert.deepEqual(await register(service, telephone, 'espace-b', 'bob', 'refresh'), { status: 'other-person' });
});

test('un appareil inscrit avant le correctif dans un seul espace continue de recevoir sans rien refaire (F375)', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-ancien');
  await registerAsBeforeTheFix(service, telephone, 'espace-a');
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), [telephone.endpoint]);
  assert.deepEqual(await register(service, telephone, 'espace-a', 'alice', 'refresh'), { status: 'registered' });
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), [telephone.endpoint]);
});

test('un appareil inscrit avant le correctif dans deux espaces n’en sert plus qu’un (F375)', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-ancien');
  await registerAsBeforeTheFix(service, telephone, 'espace-a');
  await registerAsBeforeTheFix(service, telephone, 'espace-b');

  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), [telephone.endpoint]);
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-b')), [], 'le premier espace qui envoie le garde');
  assert.deepEqual(spacesListing(service, telephone, ['espace-a', 'espace-b']), ['espace-a']);

  // À la première page ouverte, l'appareil est à la personne qui l'ouvre, dans son seul espace.
  assert.deepEqual(await register(service, telephone, 'espace-b', 'bob', 'refresh'), { status: 'registered' });
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), []);
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-b')), [telephone.endpoint]);
});

test('deux inscriptions simultanées du même appareil par deux personnes ne le laissent qu’à une seule', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-partage');
  // Les deux arrivent à l'appareil au même instant : l'une attend que l'autre ait fini.
  const appareil = service.devices.get(service.devices.idFromName(telephone.endpoint));
  await Promise.all([
    appareil.register({ recipientKey: 'espace-a', personKey: 'alice', intent: 'activate', subscription: telephone }),
    appareil.register({ recipientKey: 'espace-b', personKey: 'bob', intent: 'activate', subscription: telephone }),
  ]);
  const listed = spacesListing(service, telephone, ['espace-a', 'espace-b']);
  assert.equal(listed.length, 1, `inscrit dans ${listed.join(' et ')}`);
  const other = listed[0] === 'espace-a' ? 'espace-b' : 'espace-a';
  assert.deepEqual(await receivedDuring(service, () => send(service, other)), []);
  assert.deepEqual(await receivedDuring(service, () => send(service, listed[0])), [telephone.endpoint]);
});

test('une alarme de fin d’arrosage d’Alice ne part pas vers l’appareil passé à Bob entre-temps', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-partage');
  await register(service, telephone, 'espace-a', 'alice');
  await call(service, '/v1/alarms/schedule', {
    eventEquipmentId: 'arrosage-alice-1',
    recipientKey: 'espace-a',
    revision: '1793600000000-1',
    dueAt: new Date().toISOString(),
    notification: { title: 'Irrigation terminée', body: 'Rampe 1 · Maximum', tag: 'irrigation-finished-1', data: { url: '/irrigation/arrosages' } },
  });
  await register(service, telephone, 'espace-b', 'bob');
  assert.deepEqual(await receivedDuring(service, () => service.alarms.fireAlarms()), []);
});

test('les nouvelles tentatives de deux espaces sous le même identifiant restent séparées (D1)', async () => {
  const service = await createService();
  const telephoneAlice = await createDevice('telephone-alice');
  const telephoneBob = await createDevice('telephone-bob');
  await register(service, telephoneAlice, 'espace-a', 'alice');
  await register(service, telephoneBob, 'espace-b', 'bob');
  service.providerStatus.set(telephoneAlice.endpoint, 503);
  service.providerStatus.set(telephoneBob.endpoint, 503);

  assert.equal((await send(service, 'espace-a', 'crop-frost:2026-11-18:suite'))?.status, 'retrying');
  assert.equal((await send(service, 'espace-b', 'crop-frost:2026-11-18:suite'))?.status, 'retrying');
  service.providerStatus.clear();

  const fired = await receivedDuring(service, () => service.alarms.fireAlarms());
  assert.deepEqual(fired.sort(), [telephoneAlice.endpoint, telephoneBob.endpoint].sort(), 'chaque espace retente vers son appareil');
  assert.deepEqual(service.alarms.names().sort(), [
    'send:espace-a:crop-frost:2026-11-18:suite',
    'send:espace-b:crop-frost:2026-11-18:suite',
  ]);
});

test('sans pouvoir vérifier l’appareil, rien n’est envoyé : l’envoi se retentera', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-alice');
  await register(service, telephone, 'espace-a', 'alice');
  const devices = service.env.PUSH_DEVICES;
  Object.assign(service.env, {
    PUSH_DEVICES: {
      idFromName: (name: string) => devices.idFromName(name),
      get: () => ({ admit: async () => { throw new Error('appareil injoignable'); } }),
    },
  });
  const result = await send(service, 'espace-a');
  assert.equal(result?.status, 'retrying');
  assert.equal(result?.transient, 1);
  assert.deepEqual(service.received, []);
});

test('un appareil expiré quitte la liste et le service l’oublie', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-perdu');
  await register(service, telephone, 'espace-a', 'alice');
  assert.deepEqual(service.devices.storedKeys(telephone.endpoint), ['holder']);
  service.providerStatus.set(telephone.endpoint, 410);
  const result = await send(service, 'espace-a');
  assert.equal(result?.status, 'no-subscriber');
  assert.equal(result?.expired, 1);
  assert.deepEqual(service.devices.storedKeys(telephone.endpoint), []);
});

// L'effacement d'une ferme et les appareils muets (docs/tranche-4-contract.md, 10 bis.19, F654 et F655).

function forgetSpace(service: Service, recipientKey: string) {
  return call(service, '/v1/recipients/forget', { recipientKey });
}

function recipientSql(service: Service, recipientKey: string) {
  const recipient = service.recipients.get(service.recipients.idFromName(recipientKey)) as unknown as {
    ctx: DurableObjectState & { storage: { sql: { exec: (query: string, ...values: unknown[]) => { toArray: () => Record<string, unknown>[] } } } };
  };
  return recipient.ctx;
}

test('un espace effacé : chacun de ses appareils le quitte, les autres espaces les gardent, une fiche sans espace est oubliée (F654)', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-alice');
  const tablette = await createDevice('tablette-alice');
  const ordinateur = await createDevice('ordinateur-bob');
  await register(service, telephone, 'espace-a', 'alice');
  await register(service, telephone, 'espace-b', 'alice');
  await register(service, tablette, 'espace-a', 'alice');
  await register(service, ordinateur, 'espace-c', 'bob');

  assert.deepEqual(await forgetSpace(service, 'espace-a'), { forgotten: 2 });
  assert.deepEqual(spacesListing(service, telephone, ['espace-a', 'espace-b']), ['espace-b']);
  assert.deepEqual(spacesListing(service, tablette, ['espace-a']), []);
  assert.deepEqual(service.devices.storedKeys(tablette.endpoint), [], 'la tablette ne servait que l’espace effacé : sa fiche, et l’empreinte d’Alice, sont oubliées');
  assert.deepEqual(service.devices.storedKeys(telephone.endpoint), ['holder'], 'le téléphone sert encore l’espace B');

  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), [], 'plus rien ne part de l’espace effacé');
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-b')), [telephone.endpoint]);
  assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-c')), [ordinateur.endpoint], 'l’espace de Bob n’a rien perdu');
  assert.deepEqual(await forgetSpace(service, 'espace-a'), { forgotten: 0 }, 'un second oubli n’a plus rien à faire');
});

test('90 jours sans réponse du service : l’abonnement est oublié comme un abonnement expiré ; une réussite remet le compte à zéro ; sans envoi, rien ne bouge (F655)', async () => {
  const service = await createService();
  const day = 24 * 60 * 60 * 1000;
  const start = Date.parse('2026-11-20T08:00:00.000Z');
  const realNow = Date.now;
  let now = start;
  Date.now = () => now;
  try {
    const telephone = await createDevice('telephone-muet');
    const refuse = await createDevice('appareil-refuse');
    const fidele = await createDevice('tablette-fidele');
    const hiver = await createDevice('telephone-hiver');
    await register(service, telephone, 'espace-a', 'alice');
    await register(service, refuse, 'espace-a', 'alice');
    await register(service, fidele, 'espace-a', 'alice');
    await register(service, hiver, 'espace-b', 'alice');
    service.providerStatus.set(telephone.endpoint, 503);
    service.providerStatus.set(refuse.endpoint, 403);

    await send(service, 'espace-a');
    now = start + 45 * day;
    service.providerStatus.delete(telephone.endpoint);
    assert.deepEqual(await receivedDuring(service, () => send(service, 'espace-a')), [telephone.endpoint, fidele.endpoint], 'le téléphone répond de nouveau');
    service.providerStatus.set(telephone.endpoint, 503);
    now = start + 46 * day;
    await send(service, 'espace-a');

    now = start + 90 * day - 1;
    let result = await send(service, 'espace-a');
    assert.equal(result?.expired, 0, 'l’appareil refusé manque depuis presque 90 jours : gardé');
    now = start + 90 * day;
    result = await send(service, 'espace-a');
    assert.equal(result?.expired, 1, 'l’appareil refusé depuis 90 jours est oublié');
    assert.deepEqual(spacesListing(service, refuse, ['espace-a']), []);
    assert.deepEqual(service.devices.storedKeys(refuse.endpoint), []);
    assert.deepEqual(spacesListing(service, telephone, ['espace-a']), ['espace-a'], 'le téléphone a répondu au 45e jour : son compte est reparti du 46e');

    now = start + 136 * day;
    result = await send(service, 'espace-a');
    assert.equal(result?.expired, 1);
    assert.deepEqual(spacesListing(service, telephone, ['espace-a']), []);
    assert.deepEqual(spacesListing(service, fidele, ['espace-a']), ['espace-a']);
    assert.deepEqual(spacesListing(service, hiver, ['espace-b']), ['espace-b'], 'rien ne lui a été envoyé : jamais « sans réponse »');
  } finally {
    Date.now = realNow;
  }
});

test('une liste d’avant le 20 novembre 2026 reçoit la colonne à son réveil, ses abonnements intacts (F655)', async () => {
  const service = await createService();
  const telephone = await createDevice('telephone-ancien');
  await register(service, telephone, 'espace-a', 'alice');
  const ctx = recipientSql(service, 'espace-a');
  ctx.storage.sql.exec('ALTER TABLE push_subscriptions DROP COLUMN failing_since');
  new PushRecipient(ctx, service.env);
  new PushRecipient(ctx, service.env);
  assert.deepEqual(
    ctx.storage.sql.exec('SELECT endpoint, failing_since FROM push_subscriptions').toArray().map((row) => ({ ...row })),
    [{ endpoint: telephone.endpoint, failing_since: null }],
  );
});
