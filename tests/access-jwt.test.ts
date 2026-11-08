import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accessCertificatesUrl,
  base64UrlToBytes,
  bytesToBase64Url,
  createJwksFetcher,
  verifyAccessJwt,
  type AccessJwk,
  type AccessJwks,
} from '../lib/services/access-jwt.ts';

const TEAM = 'https://ferme.cloudflareaccess.com';
const AUD = 'aud-module-irrigation';
const NOW = new Date('2026-09-18T12:00:00Z');
const nowSeconds = Math.floor(NOW.getTime() / 1000);

type KeyPair = { privateKey: CryptoKey; jwk: AccessJwk };

async function generateKey(kid: string): Promise<KeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as AccessJwk;
  return { privateKey: pair.privateKey, jwk: { ...jwk, kid, alg: 'RS256', kty: 'RSA' } };
}

async function sign(key: KeyPair, payload: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid: key.jwk.kid, typ: 'JWT' }) {
  const encode = (value: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.privateKey, new TextEncoder().encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return { sub: 'utilisateur-access-1', email: 'ferme@exemple.test', name: 'La Ferme', aud: [AUD], iss: TEAM, iat: nowSeconds - 60, exp: nowSeconds + 3600, ...overrides };
}

const staticJwks = (keys: AccessJwk[]) => async () => ({ keys }) satisfies AccessJwks;

test('un jeton Access valide donne le sujet et le courriel', async () => {
  const key = await generateKey('cle-1');
  const result = await verifyAccessJwt(await sign(key, validPayload()), { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.payload.sub, 'utilisateur-access-1');
    assert.equal(result.payload.email, 'ferme@exemple.test');
  }
});

test('l’émetteur est comparé sans tenir compte d’une barre oblique finale', async () => {
  const key = await generateKey('cle-1');
  const result = await verifyAccessJwt(await sign(key, validPayload({ iss: `${TEAM}/` })), { teamDomain: `${TEAM}/`, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.equal(result.ok, true);
});

test('une audience différente est refusée', async () => {
  const key = await generateKey('cle-1');
  const result = await verifyAccessJwt(await sign(key, validPayload({ aud: ['autre-application'] })), { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.deepEqual(result, { ok: false, reason: 'wrong_audience' });
});

test('un autre domaine Access est refusé', async () => {
  const key = await generateKey('cle-1');
  const result = await verifyAccessJwt(await sign(key, validPayload({ iss: 'https://autre.cloudflareaccess.com' })), { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.deepEqual(result, { ok: false, reason: 'wrong_issuer' });
});

test('un jeton expiré est refusé au-delà de la tolérance d’horloge', async () => {
  const key = await generateKey('cle-1');
  const expired = await verifyAccessJwt(await sign(key, validPayload({ exp: nowSeconds - 120 })), { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.deepEqual(expired, { ok: false, reason: 'expired' });
  const withinSkew = await verifyAccessJwt(await sign(key, validPayload({ exp: nowSeconds - 30 })), { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.equal(withinSkew.ok, true);
});

test('un jeton pas encore valide est refusé', async () => {
  const key = await generateKey('cle-1');
  const result = await verifyAccessJwt(await sign(key, validPayload({ nbf: nowSeconds + 600 })), { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.deepEqual(result, { ok: false, reason: 'not_yet_valid' });
});

test('une charge utile modifiée invalide la signature', async () => {
  const key = await generateKey('cle-1');
  const token = await sign(key, validPayload());
  const [header, , signature] = token.split('.');
  const tampered = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(validPayload({ sub: 'intrus' }))));
  const result = await verifyAccessJwt(`${header}.${tampered}.${signature}`, { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.deepEqual(result, { ok: false, reason: 'bad_signature' });
});

test('une signature d’une autre clé est refusée', async () => {
  const key = await generateKey('cle-1');
  const other = await generateKey('cle-1');
  const result = await verifyAccessJwt(await sign(other, validPayload()), { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.deepEqual(result, { ok: false, reason: 'bad_signature' });
});

test('un algorithme autre que RS256, y compris none, est refusé', async () => {
  const key = await generateKey('cle-1');
  const none = await sign(key, validPayload(), { alg: 'none', kid: 'cle-1' });
  const result = await verifyAccessJwt(none, { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.deepEqual(result, { ok: false, reason: 'unsupported_alg' });
});

test('un jeton mal formé ou sans sujet est refusé', async () => {
  const key = await generateKey('cle-1');
  assert.deepEqual(await verifyAccessJwt('abc.def', { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) }), { ok: false, reason: 'malformed' });
  assert.deepEqual(await verifyAccessJwt('..', { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) }), { ok: false, reason: 'malformed' });
  const noSubject = await verifyAccessJwt(await sign(key, validPayload({ sub: '' })), { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks: staticJwks([key.jwk]) });
  assert.deepEqual(noSubject, { ok: false, reason: 'missing_subject' });
});

test('une clé inconnue déclenche une relecture forcée puis un refus explicite', async () => {
  const key = await generateKey('cle-2');
  const calls: boolean[] = [];
  const fetchJwks = async ({ forceRefresh }: { forceRefresh: boolean }) => { calls.push(forceRefresh); return { keys: [] } satisfies AccessJwks; };
  const result = await verifyAccessJwt(await sign(key, validPayload()), { teamDomain: TEAM, audience: AUD, now: NOW, fetchJwks });
  assert.deepEqual(result, { ok: false, reason: 'unknown_key' });
  assert.deepEqual(calls, [false, true]);
});

test('le cache de clés ne relit le domaine Access qu’à expiration ou sur demande', async () => {
  const key = await generateKey('cle-1');
  let clock = 0;
  const urls: string[] = [];
  const fetcher = createJwksFetcher({
    teamDomain: TEAM,
    ttlMs: 1000,
    now: () => clock,
    fetchImpl: async (url) => { urls.push(url); return { ok: true, status: 200, json: async () => ({ keys: [key.jwk] }) }; },
  });
  await fetcher({ forceRefresh: false });
  await fetcher({ forceRefresh: false });
  assert.equal(urls.length, 1);
  assert.equal(urls[0], accessCertificatesUrl(TEAM));
  clock = 2000;
  await fetcher({ forceRefresh: false });
  assert.equal(urls.length, 2);
  await fetcher({ forceRefresh: true });
  assert.equal(urls.length, 3);
});

test('une réponse en erreur du domaine Access est signalée, jamais assimilée à une liste vide', async () => {
  const fetcher = createJwksFetcher({ teamDomain: TEAM, fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) });
  await assert.rejects(() => fetcher({ forceRefresh: false }), /503/);
});

test('l’encodage base64url est réversible', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  assert.deepEqual(base64UrlToBytes(bytesToBase64Url(bytes)), bytes);
});
