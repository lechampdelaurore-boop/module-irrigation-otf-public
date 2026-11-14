import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { bytesToBase64Url, verifyAccessJwt, type AccessJwk } from '../lib/services/access-jwt.ts';
import { installSimulatedDate, realNow, runOnSimulatedDay, uninstallSimulatedDate } from '../lib/services/demo-clock.ts';

/**
 * D-112 : au jour simulé de la démonstration (avril, juin, juillet ou
 * octobre), un jeton Cloudflare Access émis aujourd'hui paraissait « pas
 * encore valide » et l'invité était renvoyé vers la connexion. Le jeton se
 * vérifie à l'heure réelle.
 */

const TEAM = 'https://ferme.cloudflareaccess.com';
const AUD = 'aud-demonstration';
const RealDate = globalThis.Date;

afterEach(() => uninstallSimulatedDate());

async function signedTokenIssuedNow(): Promise<{ token: string; jwk: AccessJwk }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const exported = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as AccessJwk;
  const jwk: AccessJwk = { ...exported, kid: 'cle-demo', alg: 'RS256', kty: 'RSA' };
  const issuedAt = Math.floor(RealDate.now() / 1000);
  const encode = (value: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
  const signingInput = `${encode({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })}.${encode({
    sub: 'invite-1',
    email: 'invite@exemple.test',
    aud: [AUD],
    iss: TEAM,
    iat: issuedAt,
    nbf: issuedAt,
    exp: issuedAt + 3600,
  })}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(signingInput));
  return { token: `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`, jwk };
}

test('hors démonstration, l’heure réelle est l’heure de l’horloge', () => {
  assert.ok(Math.abs(realNow() - RealDate.now()) < 1000);
});

test('au jour simulé, realNow() rend l’heure réelle et un jeton émis aujourd’hui reste valide', async () => {
  const { token, jwk } = await signedTokenIssuedNow();
  installSimulatedDate();
  const seen = await runOnSimulatedDay('2026-04-14', async () => {
    const options = { teamDomain: TEAM, audience: AUD, fetchJwks: async () => ({ keys: [jwk] }) };
    return {
      simulatedGapMs: RealDate.now() - Date.now(),
      realGapMs: Math.abs(realNow() - RealDate.now()),
      atRealTime: await verifyAccessJwt(token, { ...options, now: new Date(realNow()) }),
      atSimulatedTime: await verifyAccessJwt(token, options),
    };
  });
  assert.ok(seen.simulatedGapMs > 24 * 3600 * 1000, 'le 14 avril 2026 est bien loin derrière l’heure réelle');
  assert.ok(seen.realGapMs < 1000);
  assert.equal(seen.atRealTime.ok, true);
  assert.deepEqual(seen.atSimulatedTime, { ok: false, reason: 'not_yet_valid' }, 'la panne d’avant D-112');
});
