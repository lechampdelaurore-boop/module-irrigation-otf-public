import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { replaceSealedFarmTokens } from '../../db/otf-farm-connection-repository';
import { farmSpaceKey } from '../../lib/domain/farm-space';
import { OtfVaultError, otfSealKey, otfVaultState, sealOtfSecret, type OtfVaultKeyring } from '../../lib/domain/otf/token-vault';
import { currentOtfVault, keepOtfFarmTokens, openOtfFarmTokens, resealOtfVaultAtMorning, type OtfFarmTokens } from '../../lib/services/otf-token-vault';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Le coffre des jetons dans la base (4.3, PR 2 ; docs/tranche-4-contract.md,
 * F351, F355, F356, F365, F370, F397 à F403) : la base ne voit que des
 * chiffrés ; un raccordement ne se lit que par sa personne et sa ferme ; un
 * chiffré déplacé ne s'ouvre pas ; la rotation déchiffre l'ancien et
 * rechiffre, à l'usage et au calcul du matin ; aucun jeton ni aucune clé
 * semés ici n'arrivent à un journal, une erreur ou une réponse.
 */

const ALICE_7 = farmSpaceKey('alice', '7');
const ALICE_8 = farmSpaceKey('alice', '8');
const BOB_7 = farmSpaceKey('bob', '7');
const BOB_9 = farmSpaceKey('bob', '9');

const SEEDED = {
  access7: 'jeton-d-acces-ferme-7-seme-2291',
  refresh7: 'jeton-de-renouvellement-ferme-7-seme-7720',
  access8: 'jeton-d-acces-ferme-8-seme-6405',
  refresh8: 'jeton-de-renouvellement-ferme-8-seme-1186',
};
const EXPIRES_AT_MS = Date.parse('2026-11-19T02:00:00.000Z');
const CONNECTED_AT = '2026-11-19T01:00:00.000Z';

const tokens = (accessToken: string, refreshToken: string): OtfFarmTokens => ({ accessToken, refreshToken, accessExpiresAtMs: EXPIRES_AT_MS });

let database: TestDatabase;
let lines: string[] = [];
const keysSeen: string[] = [];

beforeEach(() => {
  database = installTestDatabase();
  lines = [];
  mock.method(console, 'info', (line: unknown) => { lines.push(String(line)); });
  mock.method(console, 'warn', (line: unknown) => { lines.push(String(line)); });
});

afterEach(() => {
  mock.restoreAll();
  delete process.env.OTF_TOKEN_MASTER_KEY;
  delete process.env.OTF_TOKEN_MASTER_KEY_PREVIOUS;
  delete process.env.DEMO_MODE;
  // Aucune ligne de journal d'aucun test ne porte un jeton semé ni une clé maîtresse.
  for (const line of lines) {
    for (const value of [...Object.values(SEEDED), ...keysSeen]) assert.equal(line.includes(value), false, `journal : ${line.slice(0, 80)}`);
  }
  database.dispose();
});

function masterKeyText(): string {
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  keysSeen.push(key);
  return key;
}

async function keyring(current: string, previous?: string): Promise<OtfVaultKeyring> {
  const state = await otfVaultState({ current, previous });
  assert.equal(state.status, 'ready');
  return state.keyring;
}

type ConnectionRow = Record<string, string | number | null>;

function connectionRow(otfFarmId: string): ConnectionRow | undefined {
  const row = database.sqlite.prepare('SELECT * FROM otf_farm_connections WHERE otf_farm_id = ?').get(otfFarmId);
  return row ? { ...(row as ConnectionRow) } : undefined;
}

/** Toute la table, colonne par colonne, en un seul texte. */
function wholeTable(): string {
  return JSON.stringify(database.sqlite.prepare('SELECT * FROM otf_farm_connections').all());
}

async function rejection(promise: Promise<unknown>): Promise<OtfVaultError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof OtfVaultError, String(error));
    return error;
  }
  assert.fail('le coffre aurait dû refuser');
}

test('les jetons entrent dans la base chiffrés : aucune colonne ne porte un jeton ni la clé', async () => {
  const key = masterKeyText();
  const ring = await keyring(key);
  assert.equal(await keepOtfFarmTokens(ring, { spaceKey: ALICE_7, farmName: 'Ferme des essais', tokens: tokens(SEEDED.access7, SEEDED.refresh7), connectedAt: CONNECTED_AT }), true);

  const row = connectionRow('7');
  assert.equal(row?.owner_user_id, 'alice');
  assert.equal(row?.farm_name, 'Ferme des essais');
  assert.equal(row?.state, 'linked');
  assert.equal(row?.access_expires_at_ms, EXPIRES_AT_MS);
  assert.equal(row?.connected_at, CONNECTED_AT);
  assert.match(String(row?.access_token_sealed), new RegExp(`^v1\\.${ring.current.fingerprint}\\.`));
  assert.match(String(row?.refresh_token_sealed), new RegExp(`^v1\\.${ring.current.fingerprint}\\.`));
  for (const value of [SEEDED.access7, SEEDED.refresh7, key]) assert.equal(wholeTable().includes(value), false);
});

test('un raccordement ne s’ouvre que pour sa personne et sa ferme ensemble (F365)', async () => {
  const ring = await keyring(masterKeyText());
  await keepOtfFarmTokens(ring, { spaceKey: ALICE_7, farmName: 'Ferme 7', tokens: tokens(SEEDED.access7, SEEDED.refresh7), connectedAt: CONNECTED_AT });

  assert.deepEqual(await openOtfFarmTokens(ring, ALICE_7), tokens(SEEDED.access7, SEEDED.refresh7));
  assert.equal(await openOtfFarmTokens(ring, BOB_7), null, 'une autre personne sur la même ferme');
  assert.equal(await openOtfFarmTokens(ring, ALICE_8), null, 'la même personne sur une autre ferme');
  assert.equal(await openOtfFarmTokens(ring, 'alice'), null, 'l’espace sans ferme de la même personne');
});

test('une ferme, un raccordement : une autre personne est refusée sans rien changer, la même remplace ses jetons (F351)', async () => {
  const ring = await keyring(masterKeyText());
  await keepOtfFarmTokens(ring, { spaceKey: ALICE_7, farmName: 'Ferme 7', tokens: tokens(SEEDED.access7, SEEDED.refresh7), connectedAt: CONNECTED_AT });
  const before = connectionRow('7');

  assert.equal(await keepOtfFarmTokens(ring, { spaceKey: BOB_7, farmName: 'Ferme 7 de Bob', tokens: tokens(SEEDED.access8, SEEDED.refresh8), connectedAt: '2026-11-19T01:30:00.000Z' }), false);
  assert.deepEqual(connectionRow('7'), before);
  assert.equal(await openOtfFarmTokens(ring, BOB_7), null);

  assert.equal(await keepOtfFarmTokens(ring, { spaceKey: ALICE_7, farmName: 'Ferme 7 renommée', tokens: tokens(SEEDED.access8, SEEDED.refresh8), connectedAt: '2026-11-19T01:30:00.000Z' }), true);
  assert.deepEqual(await openOtfFarmTokens(ring, ALICE_7), tokens(SEEDED.access8, SEEDED.refresh8));
  assert.equal(connectionRow('7')?.farm_name, 'Ferme 7 renommée');
  assert.equal(connectionRow('7')?.connected_at, '2026-11-19T01:30:00.000Z');
});

test('un chiffré recopié sur la ligne d’une autre ferme, ou d’un rôle à l’autre, ne s’ouvre pas (F355, F370)', async () => {
  const ring = await keyring(masterKeyText());
  await keepOtfFarmTokens(ring, { spaceKey: ALICE_7, farmName: 'Ferme 7', tokens: tokens(SEEDED.access7, SEEDED.refresh7), connectedAt: CONNECTED_AT });
  await keepOtfFarmTokens(ring, { spaceKey: BOB_9, farmName: 'Ferme 9', tokens: tokens(SEEDED.access8, SEEDED.refresh8), connectedAt: CONNECTED_AT });

  // Quelqu'un qui écrit dans la base recopie les chiffrés de la ferme 7 sur la ligne de la ferme 9.
  database.sqlite.exec(`UPDATE otf_farm_connections SET
    access_token_sealed = (SELECT access_token_sealed FROM otf_farm_connections WHERE otf_farm_id = '7'),
    refresh_token_sealed = (SELECT refresh_token_sealed FROM otf_farm_connections WHERE otf_farm_id = '7')
    WHERE otf_farm_id = '9'`);
  assert.equal((await rejection(openOtfFarmTokens(ring, BOB_9))).problem, 'broken');

  // … ou échange le jeton d'accès et celui de renouvellement d'une même ferme.
  database.sqlite.exec(`UPDATE otf_farm_connections SET access_token_sealed = refresh_token_sealed, refresh_token_sealed = access_token_sealed WHERE otf_farm_id = '7'`);
  assert.equal((await rejection(openOtfFarmTokens(ring, ALICE_7))).problem, 'broken');
});

test('la rotation à l’usage : l’ancienne clé ouvre, la nouvelle rechiffre, et la ligne ne dépend plus de l’ancienne (F356)', async () => {
  const oldKey = masterKeyText();
  const newKey = masterKeyText();
  await keepOtfFarmTokens(await keyring(oldKey), { spaceKey: ALICE_7, farmName: 'Ferme 7', tokens: tokens(SEEDED.access7, SEEDED.refresh7), connectedAt: CONNECTED_AT });
  const sealedBefore = connectionRow('7');

  const rotating = await keyring(newKey, oldKey);
  assert.deepEqual(await openOtfFarmTokens(rotating, ALICE_7), tokens(SEEDED.access7, SEEDED.refresh7));
  const sealedAfter = connectionRow('7');
  assert.notEqual(sealedAfter?.access_token_sealed, sealedBefore?.access_token_sealed);
  assert.equal(otfSealKey(rotating, String(sealedAfter?.access_token_sealed)), 'current');
  assert.equal(otfSealKey(rotating, String(sealedAfter?.refresh_token_sealed)), 'current');
  assert.equal(sealedAfter?.access_expires_at_ms, EXPIRES_AT_MS);
  assert.equal(sealedAfter?.connected_at, CONNECTED_AT);

  // L'ancienne clé retirée, la ferme s'ouvre toujours.
  assert.deepEqual(await openOtfFarmTokens(await keyring(newKey), ALICE_7), tokens(SEEDED.access7, SEEDED.refresh7));
});

test('sans l’ancienne clé, ses chiffrés sont perdus, sans rien deviner ni effacer : la ferme se relie de nouveau', async () => {
  await keepOtfFarmTokens(await keyring(masterKeyText()), { spaceKey: ALICE_7, farmName: 'Ferme 7', tokens: tokens(SEEDED.access7, SEEDED.refresh7), connectedAt: CONNECTED_AT });
  const before = connectionRow('7');
  assert.equal((await rejection(openOtfFarmTokens(await keyring(masterKeyText()), ALICE_7))).problem, 'unknown-key');
  assert.deepEqual(connectionRow('7'), before);
});

test('le rechiffrement n’écrase jamais des jetons rangés entre la lecture et l’écriture', async () => {
  const ring = await keyring(masterKeyText());
  await keepOtfFarmTokens(ring, { spaceKey: ALICE_7, farmName: 'Ferme 7', tokens: tokens(SEEDED.access7, SEEDED.refresh7), connectedAt: CONNECTED_AT });
  const read = connectionRow('7');
  // Un renouvellement range de nouveaux jetons entre-temps.
  await keepOtfFarmTokens(ring, { spaceKey: ALICE_7, farmName: 'Ferme 7', tokens: tokens(SEEDED.access8, SEEDED.refresh8), connectedAt: CONNECTED_AT });
  const renewed = connectionRow('7');

  const stale = { accessTokenSealed: String(read?.access_token_sealed), refreshTokenSealed: String(read?.refresh_token_sealed) };
  const resealed = {
    accessTokenSealed: await sealOtfSecret(ring, SEEDED.access7, { role: 'access-token', otfFarmId: '7' }),
    refreshTokenSealed: await sealOtfSecret(ring, SEEDED.refresh7, { role: 'refresh-token', otfFarmId: '7' }),
  };
  assert.equal(await replaceSealedFarmTokens('7', stale, resealed), false);
  assert.deepEqual(connectionRow('7'), renewed);
  assert.deepEqual(await openOtfFarmTokens(ring, ALICE_7), tokens(SEEDED.access8, SEEDED.refresh8));
});

test('la rotation au calcul du matin rechiffre les fermes non lues, compte celles qui restent et dit quand l’ancienne clé peut partir', async () => {
  const oldKey = masterKeyText();
  const newKey = masterKeyText();
  await keepOtfFarmTokens(await keyring(oldKey), { spaceKey: ALICE_7, farmName: 'Ferme 7', tokens: tokens(SEEDED.access7, SEEDED.refresh7), connectedAt: CONNECTED_AT });
  await keepOtfFarmTokens(await keyring(newKey), { spaceKey: ALICE_8, farmName: 'Ferme 8', tokens: tokens(SEEDED.access8, SEEDED.refresh8), connectedAt: CONNECTED_AT });
  // Une ferme chiffrée par une clé qui n'est plus posée.
  await keepOtfFarmTokens(await keyring(masterKeyText()), { spaceKey: BOB_9, farmName: 'Ferme 9', tokens: tokens(SEEDED.access8, SEEDED.refresh8), connectedAt: CONNECTED_AT });
  const lost = connectionRow('9');

  process.env.OTF_TOKEN_MASTER_KEY = newKey;
  process.env.OTF_TOKEN_MASTER_KEY_PREVIOUS = oldKey;
  assert.deepEqual(await resealOtfVaultAtMorning(), {
    status: 'done', connections: 3, resealed: 1, withPreviousKey: 0, unreadable: 1, previousKeyRemovable: true,
  });
  const rotating = await keyring(newKey, oldKey);
  assert.equal(otfSealKey(rotating, String(connectionRow('7')?.access_token_sealed)), 'current');
  assert.deepEqual(connectionRow('9'), lost, 'une ferme illisible est laissée telle quelle');
  assert.deepEqual(await openOtfFarmTokens(await keyring(newKey), ALICE_7), tokens(SEEDED.access7, SEEDED.refresh7));

  const morning = lines.map((line) => JSON.parse(line) as Record<string, unknown>).filter((entry) => entry.event === 'otf_vault_morning');
  assert.deepEqual(morning, [{ event: 'otf_vault_morning', status: 'done', connections: 3, resealed: 1, withPreviousKey: 0, unreadable: 1, previousKeyRemovable: true, previousKey: true }]);

  // Le lendemain, plus rien à rechiffrer ; l'ancienne clé retirée, rien ne change.
  assert.equal((await resealOtfVaultAtMorning()).status, 'done');
  delete process.env.OTF_TOKEN_MASTER_KEY_PREVIOUS;
  assert.deepEqual(await resealOtfVaultAtMorning(), {
    status: 'done', connections: 3, resealed: 0, withPreviousKey: 0, unreadable: 1, previousKeyRemovable: false,
  });
});

test('une ligne de l’ancienne clé qui ne s’ouvre pas n’arrête pas la rotation des autres fermes', async () => {
  const oldKey = masterKeyText();
  const newKey = masterKeyText();
  const old = await keyring(oldKey);
  await keepOtfFarmTokens(old, { spaceKey: ALICE_7, farmName: 'Ferme 7', tokens: tokens(SEEDED.access7, SEEDED.refresh7), connectedAt: CONNECTED_AT });
  await keepOtfFarmTokens(old, { spaceKey: ALICE_8, farmName: 'Ferme 8', tokens: tokens(SEEDED.access8, SEEDED.refresh8), connectedAt: CONNECTED_AT });
  database.sqlite.exec(`UPDATE otf_farm_connections SET access_token_sealed = (SELECT access_token_sealed FROM otf_farm_connections WHERE otf_farm_id = '8') WHERE otf_farm_id = '7'`);

  const report = await resealOtfVaultAtMorning({ status: 'ready', keyring: await keyring(newKey, oldKey) });
  assert.deepEqual(report, { status: 'done', connections: 2, resealed: 1, withPreviousKey: 0, unreadable: 1, previousKeyRemovable: true });
  assert.deepEqual(await openOtfFarmTokens(await keyring(newKey), ALICE_8), tokens(SEEDED.access8, SEEDED.refresh8));
});

test('endormi sans clé, hors d’usage avec une clé illisible : le matin ne touche à rien, et le journal ne nomme que le secret', async () => {
  const key = masterKeyText();
  await keepOtfFarmTokens(await keyring(key), { spaceKey: ALICE_7, farmName: 'Ferme 7', tokens: tokens(SEEDED.access7, SEEDED.refresh7), connectedAt: CONNECTED_AT });
  const before = connectionRow('7');

  assert.deepEqual(await currentOtfVault(), { status: 'dormant' });
  assert.deepEqual(await resealOtfVaultAtMorning(), { status: 'dormant' });

  process.env.OTF_TOKEN_MASTER_KEY = key;
  process.env.OTF_TOKEN_MASTER_KEY_PREVIOUS = `${key.slice(0, 20)}-cle-mal-recopiee`;
  keysSeen.push(process.env.OTF_TOKEN_MASTER_KEY_PREVIOUS);
  assert.deepEqual(await resealOtfVaultAtMorning(), { status: 'unavailable', unreadable: ['OTF_TOKEN_MASTER_KEY_PREVIOUS'] });
  assert.deepEqual(connectionRow('7'), before);
  assert.deepEqual(lines.map((line) => JSON.parse(line) as unknown), [{ event: 'otf_vault_unavailable', unreadable: ['OTF_TOKEN_MASTER_KEY_PREVIOUS'] }]);
});

test('la démonstration n’a jamais de coffre, même si une clé lui était posée', async () => {
  process.env.DEMO_MODE = 'true';
  process.env.OTF_TOKEN_MASTER_KEY = masterKeyText();
  assert.deepEqual(await currentOtfVault(), { status: 'dormant' });
  assert.deepEqual(await resealOtfVaultAtMorning(), { status: 'dormant' });
});

test('la base refuse des jetons à une ferme en « reconnexion demandée », et une ferme « reliée » sans jetons (F358)', () => {
  type Columns = { access?: string | null; refresh?: string | null; expires?: number | null };
  const insert = (otfFarmId: string, state: string, columns: Columns) => database.sqlite
    .prepare(`INSERT INTO otf_farm_connections (otf_farm_id, owner_user_id, farm_name, state, access_token_sealed, refresh_token_sealed, access_expires_at_ms, connected_at)
      VALUES (?, 'alice', 'Ferme', ?, ?, ?, ?, ?)`)
    .run(otfFarmId, state, columns.access ?? null, columns.refresh ?? null, columns.expires ?? null, CONNECTED_AT);
  const tokensKept: Columns = { access: 'v1.acces', refresh: 'v1.renouvellement', expires: EXPIRES_AT_MS };

  // En « reconnexion demandée », chacun des trois restes suffit à refuser la ligne.
  for (const kept of [{ access: 'v1.acces' }, { refresh: 'v1.renouvellement' }, { expires: EXPIRES_AT_MS }]) {
    assert.throws(() => insert('7', 'reconnect-required', kept), /CHECK constraint failed/, JSON.stringify(kept));
  }
  // « Reliée » ou en « lecture refusée », chacun des trois manques suffit à refuser la ligne.
  for (const state of ['linked', 'read-refused']) {
    for (const missing of ['access', 'refresh', 'expires'] as const) {
      assert.throws(() => insert('7', state, { ...tokensKept, [missing]: null }), /CHECK constraint failed/, `${state} sans ${missing}`);
    }
  }
  assert.throws(() => insert('7', 'reliee', tokensKept), /CHECK constraint failed/, 'un état inconnu');

  insert('7', 'reconnect-required', {});
  insert('8', 'linked', tokensKept);
  insert('9', 'read-refused', tokensKept);
  assert.deepEqual(['7', '8', '9'].map((farm) => connectionRow(farm)?.state), ['reconnect-required', 'linked', 'read-refused']);
});
