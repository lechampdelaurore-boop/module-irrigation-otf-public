import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import {
  beginOtfFarmRead,
  claimOtfCallPlace,
  endOtfFarmRead,
  holdOtfCalls,
  readOtfDailyCalls,
  readOtfFarmPace,
  recordOtfAuthenticationFailure,
} from '../../db/otf-call-ledger-repository';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Le compteur partagé dans la base (4.3, PR 1 ; docs/tranche-4-contract.md,
 * F359, F361 à F363, F381 à F390), sur une base migrée : chaque place se prend
 * par une seule écriture conditionnelle, la même base pour toutes les
 * instances. Deux appels ici sont deux instances : rien ne les relie que la
 * base.
 */

let database: TestDatabase;

beforeEach(() => {
  database = installTestDatabase();
});

afterEach(() => database.dispose());

const SPACING_MS = 255;
const T0 = Date.parse('2026-11-18T10:00:00.000Z');

const place = (paceKey: string, atMs: number, extra: { readId?: string; fromReservation?: boolean } = {}) =>
  claimOtfCallPlace({ paceKey, atMs, spacingMs: SPACING_MS, readId: extra.readId ?? null, fromReservation: extra.fromReservation ?? false });

function rows(paceKey: string): { started_at_ms: number; reserved: number; read_id: string | null }[] {
  return database.sqlite
    .prepare('SELECT started_at_ms, reserved, read_id FROM otf_call_starts WHERE pace_key = ? ORDER BY started_at_ms, id')
    .all(paceKey) as { started_at_ms: number; reserved: number; read_id: string | null }[];
}

const realStarts = (paceKey: string) => rows(paceKey).filter((row) => row.reserved === 0).map((row) => row.started_at_ms);
const reservedPlaces = (paceKey: string) => rows(paceKey).filter((row) => row.reserved === 1).length;

/** Les lignes de `node:sqlite` n'ont pas de prototype : elles sont recopiées en objets ordinaires. */
function plainRows(sql: string, ...parameters: string[]): Record<string, unknown>[] {
  return database.sqlite.prepare(sql).all(...parameters).map((row) => ({ ...row }));
}

function farmRead(paceKey: string): Record<string, unknown> | undefined {
  return plainRows('SELECT lease_id, lease_until_ms, reserve_basis FROM otf_farm_reads WHERE pace_key = ?', paceKey)[0];
}

test('une place par écriture conditionnelle : 255 ms entre deux départs d’une ferme, pour toutes les instances ; une autre ferme ne patiente pas (F361)', async () => {
  assert.equal(await place('17', T0), true);
  assert.equal(await place('17', T0 + 100), false, 'une seconde instance, 100 ms après : refusée');
  assert.equal(await place('18', T0 + 100), true, 'une autre ferme part');
  assert.equal(await place('17', T0 + SPACING_MS), true);
  assert.deepEqual(realStarts('17'), [T0, T0 + SPACING_MS]);
});

test('trente places par minute glissante de 61 secondes ; la trente et unième attend que la première sorte (F361)', async () => {
  for (let index = 0; index < 30; index += 1) assert.equal(await place('17', T0 + index * SPACING_MS), true);
  assert.equal(await place('17', T0 + 30 * SPACING_MS), false);
  assert.equal(await place('17', T0 + 60_999), false, 'la première compte encore');
  assert.equal(await place('17', T0 + 61_000), true, 'sortie de la fenêtre, sa place est libre');
  assert.equal(realStarts('17').length, 31);
});

test('une pause de la ferme ou du module refuse toute place jusqu’à sa fin ; une pause plus courte ne raccourcit pas celle qui court (F359, F361)', async () => {
  await holdOtfCalls('17', { scope: 'farm', untilMs: T0 + 10_000, reason: 'rate-limit' });
  await holdOtfCalls('17', { scope: 'farm', untilMs: T0 + 2_000, reason: 'rate-limit' });
  assert.equal(await place('17', T0 + 5_000), false);
  assert.equal(await place('18', T0 + 5_000), true, 'la pause d’une ferme ne retient pas les autres');
  assert.equal(await place('17', T0 + 10_000), true, 'à sa fin, la ferme repart');

  await holdOtfCalls('17', { scope: 'module', untilMs: T0 + 30_000, reason: 'authentication-limit' });
  assert.equal(await place('17', T0 + 20_000), false);
  assert.equal(await place('19', T0 + 20_000), false, 'le module entier s’arrête');
  const { state } = await readOtfFarmPace('19', T0 + 20_000);
  assert.deepEqual(state.pauses, [{ scope: 'module', untilMs: T0 + 30_000, reason: 'authentication-limit' }]);
});

test('le frein : au dixième refus d’accès en quinze minutes, plus aucun appel ne part pendant quinze minutes, toutes fermes confondues (F359)', async () => {
  // Un refus de plus de quinze minutes ne compte plus.
  assert.equal(await recordOtfAuthenticationFailure(T0 - 900_000), null);
  for (let index = 0; index < 9; index += 1) assert.equal(await recordOtfAuthenticationFailure(T0 + index * 1_000), null);
  const brake = await recordOtfAuthenticationFailure(T0 + 9_000);
  assert.deepEqual(brake, { scope: 'module', untilMs: T0 + 9_000 + 900_000, reason: 'authentication-brake' });
  assert.equal(await place('17', T0 + 10_000), false);
  assert.equal(await place('18', T0 + 10_000), false);
  assert.equal(await place('18', T0 + 9_000 + 900_000), true, 'quinze minutes après, les appels repartent');
});

test('le départ d’une lecture prend le bail et réserve ses places en un seul lot ; une autre lecture de la ferme attend la fin du bail (F362)', async () => {
  assert.equal(await beginOtfFarmRead({ paceKey: '17', readId: 'lecture-a', atMs: T0, places: 25 }), true);
  assert.equal(reservedPlaces('17'), 25);
  assert.equal((await readOtfFarmPace('17', T0 + 1)).leaseHeld, true);

  assert.equal(await beginOtfFarmRead({ paceKey: '17', readId: 'lecture-b', atMs: T0 + 1_000, places: 5 }), false);
  assert.equal(rows('17').filter((row) => row.read_id === 'lecture-b').length, 0, 'la seconde ne réserve rien');
  assert.equal(await beginOtfFarmRead({ paceKey: '18', readId: 'lecture-c', atMs: T0 + 1_000, places: 25 }), true, 'une autre ferme lit en même temps');

  // Les places réservées comptent dans la minute : cinq appels isolés tiennent, pas un sixième.
  for (let index = 0; index < 5; index += 1) assert.equal(await place('17', T0 + 1_000 + index * SPACING_MS), true);
  assert.equal(await place('17', T0 + 1_000 + 5 * SPACING_MS), false);

  // Une instance arrêtée en route ne bloque pas la ferme : le bail expire après deux minutes.
  assert.equal(await beginOtfFarmRead({ paceKey: '17', readId: 'lecture-d', atMs: T0 + 120_000, places: 5 }), true);
  assert.equal(farmRead('17')?.lease_id, 'lecture-d');
});

test('une lecture qui ne peut pas finir ne prend rien : ni bail ni place, quand la minute n’a pas la place ou qu’une pause court (F362)', async () => {
  for (let index = 0; index < 6; index += 1) await place('17', T0 + index * SPACING_MS);
  assert.equal(await beginOtfFarmRead({ paceKey: '17', readId: 'lecture-a', atMs: T0 + 2_000, places: 25 }), false);
  assert.equal(farmRead('17'), undefined);
  assert.equal(reservedPlaces('17'), 0);
  assert.equal(await beginOtfFarmRead({ paceKey: '17', readId: 'lecture-a', atMs: T0 + 2_000, places: 24 }), true, 'vingt-quatre tiennent');

  await holdOtfCalls('18', { scope: 'farm', untilMs: T0 + 60_000, reason: 'day-limit' });
  assert.equal(await beginOtfFarmRead({ paceKey: '18', readId: 'lecture-b', atMs: T0, places: 25 }), false);
  assert.equal(reservedPlaces('18'), 0);
});

test('une place réservée devient un départ : elle compte une fois dans la minute, et alors seulement dans le compte du jour (F362, F363)', async () => {
  await beginOtfFarmRead({ paceKey: '17', readId: 'lecture-a', atMs: T0, places: 25 });
  for (let index = 0; index < 5; index += 1) await place('17', T0 + index * SPACING_MS);
  assert.deepEqual(await readOtfDailyCalls('17'), [{ parisDay: '2026-11-18', calls: 5 }], 'les places réservées ne comptent pas encore');

  // La minute compte trente places, dont vingt-cinq réservées : la lecture prend les siennes.
  const firstOfRead = T0 + 5 * SPACING_MS;
  assert.equal(await place('17', firstOfRead, { readId: 'lecture-a', fromReservation: true }), true);
  assert.equal(await place('17', firstOfRead + 100, { readId: 'lecture-a', fromReservation: true }), false, 'l’espacement vaut aussi pour elle');
  assert.equal(await place('17', firstOfRead + SPACING_MS, { readId: 'lecture-a', fromReservation: true }), true);
  assert.equal(reservedPlaces('17'), 23);
  assert.deepEqual(await readOtfDailyCalls('17'), [{ parisDay: '2026-11-18', calls: 7 }]);

  // Une lecture de plus d'une minute : ses places réservées sont sorties de la minute, qui est pleine d'autres départs.
  const later = T0 + 70_000;
  for (let index = 0; index < 30; index += 1) assert.equal(await place('17', later + index * SPACING_MS), true);
  assert.equal(await place('17', later + 30 * SPACING_MS, { readId: 'lecture-a', fromReservation: true }), false);
  assert.equal(reservedPlaces('17'), 23);
});

test('la fin d’une lecture rend ses places inutilisées et le bail, et garde la base de la réserve suivante ; une lecture dont le bail a été repris ne touche à rien (F362)', async () => {
  await beginOtfFarmRead({ paceKey: '17', readId: 'lecture-a', atMs: T0, places: 25 });
  for (let index = 0; index < 3; index += 1) await place('17', T0 + index * SPACING_MS, { readId: 'lecture-a', fromReservation: true });

  await endOtfFarmRead({ paceKey: '17', readId: 'lecture-périmée', reserveBasis: 99, atMs: T0 + 1_000 });
  assert.equal(farmRead('17')?.lease_id, 'lecture-a');
  assert.equal(reservedPlaces('17'), 22);

  await endOtfFarmRead({ paceKey: '17', readId: 'lecture-a', reserveBasis: 3, atMs: T0 + 1_000 });
  assert.equal(reservedPlaces('17'), 0);
  assert.equal(realStarts('17').length, 3);
  assert.deepEqual(farmRead('17'), { lease_id: null, lease_until_ms: 0, reserve_basis: 3 });
  const pace = await readOtfFarmPace('17', T0 + 1_000);
  assert.equal(pace.leaseHeld, false);
  assert.equal(pace.reserveBasis, 3);
});

test('le ménage au départ d’une lecture : départs de plus de deux jours, comptes de plus de trente jours, refus de plus de quinze minutes, pauses finies (F361, F363, F387)', async () => {
  const day = 86_400_000;
  await place('17', T0 - 31 * day);
  await place('17', T0 - 3 * day);
  await place('17', T0 - day);
  await recordOtfAuthenticationFailure(T0 - 900_001);
  await recordOtfAuthenticationFailure(T0 - 1_000);
  await holdOtfCalls('18', { scope: 'farm', untilMs: T0 - 1, reason: 'rate-limit' });

  assert.equal(await beginOtfFarmRead({ paceKey: '17', readId: 'lecture-a', atMs: T0, places: 2 }), true);
  assert.deepEqual(realStarts('17'), [T0 - day]);
  assert.deepEqual((await readOtfDailyCalls('17')).map((count) => count.parisDay), ['2026-11-17', '2026-11-15'], 'le compte d’il y a trois jours reste, celui d’il y a trente et un jours part');
  assert.deepEqual(plainRows('SELECT failed_at_ms FROM otf_authentication_failures'), [{ failed_at_ms: T0 - 1_000 }]);
  assert.deepEqual(plainRows('SELECT scope FROM otf_call_pauses'), []);
});

test('le compte du jour : par ferme et par jour de Paris, de minuit à minuit (D-004, F363)', async () => {
  await place('17', Date.parse('2026-11-18T22:59:59.000Z'));
  await place('17', Date.parse('2026-11-18T23:00:01.000Z'));
  await place('18', Date.parse('2026-11-18T23:00:01.000Z'));
  assert.deepEqual(await readOtfDailyCalls('17'), [
    { parisDay: '2026-11-19', calls: 1 },
    { parisDay: '2026-11-18', calls: 1 },
  ]);
  assert.deepEqual(await readOtfDailyCalls('18'), [{ parisDay: '2026-11-19', calls: 1 }]);
});

test('ce que la base dit d’une ferme : le dernier départ réel, les places de la minute réservées comprises, les pauses et le bail (F361, F362)', async () => {
  await place('17', T0);
  await beginOtfFarmRead({ paceKey: '17', readId: 'lecture-a', atMs: T0 + 500, places: 2 });
  await holdOtfCalls('17', { scope: 'farm', untilMs: T0 + 5_000, reason: 'rate-limit' });

  const pace = await readOtfFarmPace('17', T0 + 1_000);
  assert.deepEqual(pace.state, {
    lastStartedAtMs: T0,
    windowPlacesMs: [T0, T0 + 500, T0 + 500],
    pauses: [{ scope: 'farm', untilMs: T0 + 5_000, reason: 'rate-limit' }],
  });
  assert.equal(pace.leaseHeld, true);
  assert.equal(pace.reserveBasis, null);
  assert.deepEqual((await readOtfFarmPace('18', T0 + 1_000)).state, { lastStartedAtMs: null, windowPlacesMs: [], pauses: [] });
});
