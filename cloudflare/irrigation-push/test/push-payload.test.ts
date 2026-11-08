import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { PUSH_DELIVERY_OPTIONS } from '../src/delivery.ts';

/**
 * Les tests de livraison remplacent la construction du message par un leurre,
 * afin de vérifier les décisions du Worker sans dépendre du réseau. Le vrai
 * chiffrement n'y est donc jamais exercé, alors que c'est lui qui décide si une
 * notification arrive lisible sur le téléphone. Ce test appelle la bibliothèque
 * pour de bon, avec des clés engendrées à la volée : une rupture de son API ou
 * de son format devient visible en CI au lieu de se découvrir par une alerte
 * silencieuse (mise à jour majeure du 20 septembre 2026).
 */
const base64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');

// Les types Cloudflare déclarent des retours élargis, une clé seule ou une
// paire : la courbe demandée ici produit toujours une paire et un JWK.
async function generatePair(name: 'ECDSA' | 'ECDH', usages: string[]) {
  return (await crypto.subtle.generateKey({ name, namedCurve: 'P-256' }, true, usages)) as CryptoKeyPair;
}

async function vapidKeys() {
  const pair = await generatePair('ECDSA', ['sign', 'verify']);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey) as JsonWebKey;
  return {
    subject: 'https://module-irrigation-otf.lechampdelaurore.workers.dev',
    publicKey: base64Url(publicRaw),
    privateKey: privateJwk.d,
  };
}

async function browserSubscription(endpoint: string) {
  const pair = await generatePair('ECDH', ['deriveBits']);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer);
  return {
    endpoint,
    expirationTime: null,
    keys: {
      p256dh: base64Url(publicRaw),
      auth: base64Url(crypto.getRandomValues(new Uint8Array(16))),
    },
  };
}

test('le message poussé est chiffré pour de bon et respecte le protocole attendu par les navigateurs', async () => {
  const subscription = await browserSubscription('https://fcm.googleapis.com/fcm/send/identifiant-exemple');
  const payload = await buildPushPayload(
    { data: JSON.stringify({ titre: 'Irrigation terminée', planche: 'N01' }), options: { ttl: 3600 } },
    subscription,
    await vapidKeys(),
  );

  assert.equal(payload.method, 'post');
  // RFC 8291 : le corps est chiffré en aes128gcm, jamais en clair.
  assert.equal(payload.headers['content-encoding'], 'aes128gcm');
  assert.equal(payload.headers['content-type'], 'application/octet-stream');
  assert.equal(payload.headers.ttl, '3600');
  assert.ok(payload.body.byteLength > 0, 'le corps chiffré ne peut pas être vide');
  assert.equal(payload.headers['content-length'], String(payload.body.byteLength));
  // RFC 8292 : jeton VAPID signé, avec la clé publique annoncée au navigateur.
  assert.match(payload.headers.authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
});

test('le jeton VAPID vise le serveur de notification et expire dans moins de vingt-quatre heures', async () => {
  const payload = await buildPushPayload(
    { data: 'ping', options: { ttl: 60 } },
    await browserSubscription('https://updates.push.services.mozilla.com/wpush/v2/identifiant-exemple'),
    await vapidKeys(),
  );

  const jeton = payload.headers.authorization.slice('vapid t='.length).split(',')[0];
  const charge = JSON.parse(Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8')) as {
    aud: string;
    exp: number;
    sub: string;
  };

  assert.equal(charge.aud, 'https://updates.push.services.mozilla.com', 'le jeton est lié au serveur du navigateur');
  assert.equal(charge.sub, 'https://module-irrigation-otf.lechampdelaurore.workers.dev');
  const heures = (charge.exp - Math.floor(Date.now() / 1000)) / 3600;
  assert.ok(heures > 0 && heures <= 24, `Validité observée : ${heures} h ; RFC 8292 impose au plus vingt-quatre heures`);
});

test('les options du Worker deviennent les en-têtes TTL et Urgency du protocole', async () => {
  const payload = await buildPushPayload(
    { data: 'ping', options: { ...PUSH_DELIVERY_OPTIONS } },
    await browserSubscription('https://fcm.googleapis.com/fcm/send/identifiant-exemple'),
    await vapidKeys(),
  );

  assert.equal(payload.headers.ttl, '3600');
  // RFC 8030, section 5.3 : « high » fait passer le message pendant la veille du téléphone.
  assert.equal(payload.headers.urgency, 'high');
});
