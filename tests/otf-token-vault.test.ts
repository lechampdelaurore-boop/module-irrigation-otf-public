import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OtfVaultError,
  decodeOtfMasterKey,
  openOtfSecret,
  otfSealKey,
  otfVaultState,
  sealOtfSecret,
  type OtfVaultBinding,
  type OtfVaultKeyring,
} from '../lib/domain/otf/token-vault.ts';

/**
 * Le coffre des jetons (4.3, PR 2 ; docs/tranche-4-contract.md, F355, F356,
 * F397 à F400) : AES-256-GCM, un vecteur aléatoire par chiffrement, des
 * données associées qui lient chaque chiffré à sa ligne et à son rôle,
 * l'empreinte de la clé qui l'a fait, et des erreurs qui ne portent jamais
 * une valeur.
 */

const ACCESS_TOKEN = 'jeton-d-acces-seme-8812';
const REFRESH_TOKEN = 'jeton-de-renouvellement-seme-5530';
const CODE_VERIFIER = 'verificateur-seme-0f3c9a71b2d84e65';

/** Une clé maîtresse comme le porteur la tire : 32 octets aléatoires en base64. */
function masterKeyText(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
}

async function keyring(current: string, previous?: string): Promise<OtfVaultKeyring> {
  const state = await otfVaultState({ current, previous });
  assert.equal(state.status, 'ready');
  return state.keyring;
}

const FARM_7_ACCESS: OtfVaultBinding = { role: 'access-token', otfFarmId: '7' };
const FARM_7_REFRESH: OtfVaultBinding = { role: 'refresh-token', otfFarmId: '7' };
const FARM_8_ACCESS: OtfVaultBinding = { role: 'access-token', otfFarmId: '8' };
const ALICE_REQUEST: OtfVaultBinding = { role: 'code-verifier', ownerUserId: 'alice', requestId: 'demande-1' };

async function rejection(promise: Promise<unknown>): Promise<OtfVaultError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof OtfVaultError, String(error));
    return error;
  }
  assert.fail('le coffre aurait dû refuser');
}

test('la clé maîtresse se lit en base64, standard ou base64url, avec ou sans remplissage ni blancs autour', () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const standard = Buffer.from(bytes).toString('base64');
  const url = Buffer.from(bytes).toString('base64url');
  for (const text of [standard, standard.replace(/=+$/, ''), url, `  ${standard}\n`, `${standard}\r\n`]) {
    assert.deepEqual(decodeOtfMasterKey(text), bytes, JSON.stringify(text.length));
  }
});

test('une clé maîtresse d’une autre longueur ou d’une autre forme est illisible', () => {
  const hex = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  for (const text of [
    '',
    '   ',
    Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64'),
    Buffer.from(crypto.getRandomValues(new Uint8Array(33))).toString('base64'),
    hex, // 64 caractères hexadécimaux : 48 octets lus en base64, pas 32
    'cle-du-coffre-qui-n-est-pas-du-base64!',
    `${masterKeyText()} ${masterKeyText()}`,
  ]) {
    assert.equal(decodeOtfMasterKey(text), null, text.length.toString());
  }
});

test('l’état du coffre : endormi sans clé, hors d’usage dès qu’un secret posé est illisible, prêt sinon (F398)', async () => {
  const key = masterKeyText();
  assert.deepEqual(await otfVaultState({ current: undefined, previous: undefined }), { status: 'dormant' });
  assert.deepEqual(await otfVaultState({ current: '', previous: '  ' }), { status: 'dormant' });
  assert.deepEqual(await otfVaultState({ current: 'pas-une-cle', previous: undefined }), { status: 'unavailable', unreadable: ['OTF_TOKEN_MASTER_KEY'] });
  assert.deepEqual(await otfVaultState({ current: key, previous: 'pas-une-cle' }), { status: 'unavailable', unreadable: ['OTF_TOKEN_MASTER_KEY_PREVIOUS'] });
  // L'ancienne clé sans la nouvelle : une rotation mal posée, rien ne s'ouvre.
  assert.deepEqual(await otfVaultState({ current: undefined, previous: key }), { status: 'unavailable', unreadable: ['OTF_TOKEN_MASTER_KEY'] });

  const alone = await keyring(key);
  assert.equal(alone.previous, null);
  assert.match(alone.current.fingerprint, /^[0-9a-f]{16}$/);
  const rotating = await keyring(masterKeyText(), key);
  assert.equal(rotating.previous?.fingerprint, alone.current.fingerprint, 'la même clé a la même empreinte');
  assert.notEqual(rotating.current.fingerprint, alone.current.fingerprint);
  // La même valeur posée sous les deux noms n'est pas une rotation.
  assert.equal((await keyring(key, key)).previous, null);
});

test('l’empreinte ne dit rien de la clé : ni un morceau de son texte, ni de ses octets', async () => {
  const key = masterKeyText();
  const { fingerprint } = (await keyring(key)).current;
  const hex = Buffer.from(key, 'base64').toString('hex');
  assert.equal(hex.includes(fingerprint), false);
  assert.equal(key.includes(fingerprint), false);
});

test('chaque rôle se chiffre et s’ouvre ; deux chiffrements d’une même valeur diffèrent ; le chiffré ne montre ni la valeur ni la clé', async () => {
  const key = masterKeyText();
  const ring = await keyring(key);
  for (const [secret, binding] of [[ACCESS_TOKEN, FARM_7_ACCESS], [REFRESH_TOKEN, FARM_7_REFRESH], [CODE_VERIFIER, ALICE_REQUEST]] as const) {
    const sealed = await sealOtfSecret(ring, secret, binding);
    assert.match(sealed, new RegExp(`^v1\\.${ring.current.fingerprint}\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22,}$`));
    assert.equal(sealed.includes(secret), false);
    assert.equal(sealed.includes(key), false);
    assert.deepEqual(await openOtfSecret(ring, sealed, binding), { secret, resealNeeded: false });
    assert.notEqual(await sealOtfSecret(ring, secret, binding), sealed, 'un vecteur neuf à chaque chiffrement');
  }
});

test('un chiffré déplacé sur une autre ferme, ou pris pour un autre rôle, ne s’ouvre pas (F355, F370)', async () => {
  const ring = await keyring(masterKeyText());
  const sealed = await sealOtfSecret(ring, ACCESS_TOKEN, FARM_7_ACCESS);
  assert.equal((await rejection(openOtfSecret(ring, sealed, FARM_8_ACCESS))).problem, 'broken');
  assert.equal((await rejection(openOtfSecret(ring, sealed, FARM_7_REFRESH))).problem, 'broken');
  assert.equal((await rejection(openOtfSecret(ring, sealed, { ...ALICE_REQUEST, requestId: '7' }))).problem, 'broken');
});

test('un code_verifier est lié à la personne et à la demande : ni une autre personne, ni une autre demande ne l’ouvrent', async () => {
  const ring = await keyring(masterKeyText());
  const sealed = await sealOtfSecret(ring, CODE_VERIFIER, ALICE_REQUEST);
  assert.equal((await rejection(openOtfSecret(ring, sealed, { ...ALICE_REQUEST, ownerUserId: 'bob' }))).problem, 'broken');
  assert.equal((await rejection(openOtfSecret(ring, sealed, { ...ALICE_REQUEST, requestId: 'demande-2' }))).problem, 'broken');
  // Les données associées sont une liste : déplacer un caractère d'un champ à l'autre ne les reproduit pas.
  assert.equal((await rejection(openOtfSecret(ring, sealed, { role: 'code-verifier', ownerUserId: 'alice","demande-1', requestId: '' }))).problem, 'invalid-binding');
  assert.equal((await rejection(openOtfSecret(ring, sealed, { role: 'code-verifier', ownerUserId: 'alic', requestId: 'edemande-1' }))).problem, 'broken');
});

test('la rotation : l’ancienne clé ouvre ce qu’elle a chiffré et le dit, la nouvelle chiffre ; sans l’ancienne, ses chiffrés sont perdus (F356)', async () => {
  const oldKey = masterKeyText();
  const newKey = masterKeyText();
  const before = await keyring(oldKey);
  const sealedBefore = await sealOtfSecret(before, REFRESH_TOKEN, FARM_7_REFRESH);

  const rotating = await keyring(newKey, oldKey);
  assert.equal(otfSealKey(rotating, sealedBefore), 'previous');
  assert.deepEqual(await openOtfSecret(rotating, sealedBefore, FARM_7_REFRESH), { secret: REFRESH_TOKEN, resealNeeded: true });
  const resealed = await sealOtfSecret(rotating, REFRESH_TOKEN, FARM_7_REFRESH);
  assert.equal(otfSealKey(rotating, resealed), 'current');

  const after = await keyring(newKey);
  assert.deepEqual(await openOtfSecret(after, resealed, FARM_7_REFRESH), { secret: REFRESH_TOKEN, resealNeeded: false });
  assert.equal(otfSealKey(after, sealedBefore), 'unknown');
  assert.equal((await rejection(openOtfSecret(after, sealedBefore, FARM_7_REFRESH))).problem, 'unknown-key');
});

test('un chiffré altéré ne s’ouvre pas ; une forme inconnue est refusée sans rien essayer', async () => {
  const ring = await keyring(masterKeyText());
  const sealed = await sealOtfSecret(ring, ACCESS_TOKEN, FARM_7_ACCESS);
  const last = sealed.at(-1) === 'A' ? 'B' : 'A';
  assert.equal((await rejection(openOtfSecret(ring, `${sealed.slice(0, -1)}${last}`, FARM_7_ACCESS))).problem, 'broken');
  const [version, fingerprint, iv, data] = sealed.split('.');
  const otherIv = `${iv.at(0) === 'A' ? 'B' : 'A'}${iv.slice(1)}`;
  assert.equal((await rejection(openOtfSecret(ring, [version, fingerprint, otherIv, data].join('.'), FARM_7_ACCESS))).problem, 'broken');
  for (const malformed of ['', ACCESS_TOKEN, `v2${sealed.slice(2)}`, sealed.replace(`.${fingerprint}.`, '.ABCDEF0123456789.'), `${sealed}.x`, `${sealed.slice(0, -4)}x`]) {
    assert.equal(otfSealKey(ring, malformed), 'malformed', malformed.slice(0, 24));
    assert.equal((await rejection(openOtfSecret(ring, malformed, FARM_7_ACCESS))).problem, 'malformed');
  }
});

test('le coffre ne chiffre ni une valeur vide, ni pour une ferme ou une demande illisible', async () => {
  const ring = await keyring(masterKeyText());
  assert.equal((await rejection(sealOtfSecret(ring, '', FARM_7_ACCESS))).problem, 'empty-secret');
  for (const binding of [
    { role: 'access-token', otfFarmId: '' },
    { role: 'refresh-token', otfFarmId: '7/8' },
    { role: 'code-verifier', ownerUserId: ' ', requestId: 'demande-1' },
    { role: 'code-verifier', ownerUserId: 'alice', requestId: '' },
  ] as OtfVaultBinding[]) {
    assert.equal((await rejection(sealOtfSecret(ring, ACCESS_TOKEN, binding))).problem, 'invalid-binding', JSON.stringify(binding));
  }
});

test('aucune erreur du coffre ne porte un jeton, une clé ni un chiffré', async () => {
  const oldKey = masterKeyText();
  const newKey = masterKeyText();
  const ring = await keyring(oldKey);
  const sealed = await sealOtfSecret(ring, ACCESS_TOKEN, FARM_7_ACCESS);
  const errors = [
    await rejection(openOtfSecret(ring, sealed, FARM_8_ACCESS)),
    await rejection(openOtfSecret(await keyring(newKey), sealed, FARM_7_ACCESS)),
    await rejection(openOtfSecret(ring, `${sealed}x`, FARM_7_ACCESS)),
    await rejection(openOtfSecret(ring, ACCESS_TOKEN, FARM_7_ACCESS)),
    await rejection(sealOtfSecret(ring, ACCESS_TOKEN, { role: 'access-token', otfFarmId: ACCESS_TOKEN.replace(/-/g, ' ') })),
  ];
  for (const error of errors) {
    const text = `${error.name} ${error.message} ${String(error.stack)} ${JSON.stringify(error)}`;
    for (const value of [ACCESS_TOKEN, oldKey, newKey, sealed]) assert.equal(text.includes(value), false, `${error.problem} : ${value.slice(0, 6)}…`);
  }
});
