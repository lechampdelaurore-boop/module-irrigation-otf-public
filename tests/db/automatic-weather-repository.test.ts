import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import {
  automaticWeatherRepository,
  finishAutomaticWeatherSync,
  listAutomaticWeatherTargets,
  tryClaimAutomaticWeatherSync,
} from '../../db/automatic-weather-repository';
import {
  listWeatherDailyValuesForUser,
  readWeatherPreferenceForUser,
  recordWeatherRefreshForUser,
  saveWeatherGeocodeForUser,
  saveWeatherPreferenceForUser,
} from '../../db/water-management-repository';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { customWeatherLocationKey } from '../../lib/domain/weather/location';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

const ALICE = 'alice';
const BOB = 'bob';
const CAROL = 'carol';
const candidate = { displayName: 'Vannes', city: 'Vannes', postcode: '56000', latitude: 47.66, longitude: -2.76, timezone: 'Europe/Paris', countryCode: 'FR' };

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

test('cibles de la synchronisation nocturne : un lieu actif par espace, selon le mode de localisation', async () => {
  assert.deepEqual(await listAutomaticWeatherTargets(), []);

  await recordWeatherRefreshForUser(ALICE, { successful: false, at: '2026-06-15T06:15:00.000Z', notBeforeAt: '2026-06-15T09:00:00.000Z' });
  await saveWeatherGeocodeForUser(ALICE, 'otf:ferme-17', { ...candidate, latitude: 48.1, longitude: -1.68 }, 'open-meteo');
  await saveWeatherGeocodeForUser(ALICE, customWeatherLocationKey('Vannes', '56000'), candidate, 'open-meteo');

  await saveWeatherPreferenceForUser(BOB, { locationMode: 'custom', customCity: 'Vannes', customPostcode: '56000' });
  await saveWeatherGeocodeForUser(BOB, 'otf:ferme-42', { ...candidate, city: 'Ailleurs' }, 'open-meteo');
  await saveWeatherGeocodeForUser(BOB, customWeatherLocationKey('Vannes', '56000'), candidate, 'open-meteo');

  await saveWeatherPreferenceForUser(CAROL, { locationMode: 'custom', customCity: 'Auray', customPostcode: null });
  await saveWeatherGeocodeForUser(CAROL, 'otf:ferme-7', candidate, 'open-meteo');
  await ensureWorkspaceForUser('dave');

  const targets = await listAutomaticWeatherTargets();
  const aliceWorkspace = database.sqlite.prepare("SELECT id FROM irrigation_workspaces WHERE owner_user_id = 'alice'").get()?.id;
  assert.deepEqual(
    targets.map((target) => [target.workspaceId === aliceWorkspace ? 'alice' : 'bob', target.locationKey, target.latitude, target.refreshNotBeforeAt]).sort(),
    [
      ['alice', 'otf:ferme-17', 48.1, '2026-06-15T09:00:00.000Z'],
      ['bob', customWeatherLocationKey('Vannes', '56000'), 47.66, null],
    ],
    'Alice en mode OTF prend le lieu OTF ; Bob en mode personnalisé prend le lieu de sa ville ; Carol sans géocodage de sa ville et Dave sans préférence sont ignorés',
  );
});

test('3.8 : une ferme dont aucune case cochée ne lit la météo n’est plus relevée ; recochée, elle l’est de nouveau (P4)', async () => {
  for (const owner of [ALICE, BOB]) await saveWeatherPreferenceForUser(owner, { locationMode: 'otf', customCity: null, customPostcode: null });
  await saveWeatherGeocodeForUser(ALICE, 'otf:ferme-17', candidate, 'open-meteo');
  await saveWeatherGeocodeForUser(BOB, 'otf:ferme-42', candidate, 'open-meteo');
  const now = new Date('2026-11-07T10:00:00.000Z');
  await saveFeatureSelectionForUser(BOB, ['materiel', 'arrosages', 'historique'], now);
  const keys = async () => (await listAutomaticWeatherTargets()).map((target) => target.locationKey).sort();
  assert.deepEqual(await keys(), ['otf:ferme-17'], 'Alice, d’avant la 3.8, a tout coché ; Bob n’a que des cases sans météo');
  await saveFeatureSelectionForUser(BOB, ['alertes-meteo'], now);
  assert.deepEqual(await keys(), ['otf:ferme-17', 'otf:ferme-42']);
});

test('verrou du travail nocturne : un seul détenteur à la fois, libéré par le bon jeton ou par expiration', async () => {
  const first = await tryClaimAutomaticWeatherSync('2026-06-15T04:15:00.000Z', '2026-06-15T04:45:00.000Z');
  assert.ok(first, 'première prise');
  assert.equal(await tryClaimAutomaticWeatherSync('2026-06-15T04:16:00.000Z', '2026-06-15T04:46:00.000Z'), null, 'verrou tenu');

  await finishAutomaticWeatherSync({ token: 'mauvais-jeton', at: '2026-06-15T04:17:00.000Z', successful: true, error: null });
  assert.equal(await tryClaimAutomaticWeatherSync('2026-06-15T04:18:00.000Z', '2026-06-15T04:48:00.000Z'), null, 'un mauvais jeton ne libère rien');

  await finishAutomaticWeatherSync({ token: first!, at: '2026-06-15T04:20:00.000Z', successful: false, error: 'fournisseur indisponible' });
  let job = database.sqlite.prepare('SELECT lock_token, lock_expires_at, last_completed_at, last_successful_at, last_error FROM irrigation_background_jobs').get() as Record<string, unknown>;
  assert.deepEqual({ ...job }, { lock_token: null, lock_expires_at: null, last_completed_at: '2026-06-15T04:20:00.000Z', last_successful_at: null, last_error: 'fournisseur indisponible' });

  const second = await tryClaimAutomaticWeatherSync('2026-06-15T05:15:00.000Z', '2026-06-15T05:45:00.000Z');
  assert.ok(second && second !== first, 'nouveau jeton après libération');
  await finishAutomaticWeatherSync({ token: second!, at: '2026-06-15T05:16:00.000Z', successful: true, error: null });
  job = database.sqlite.prepare('SELECT last_successful_at, last_error FROM irrigation_background_jobs').get() as Record<string, unknown>;
  assert.deepEqual({ ...job }, { last_successful_at: '2026-06-15T05:16:00.000Z', last_error: null });

  const third = await tryClaimAutomaticWeatherSync('2026-06-16T04:15:00.000Z', '2026-06-16T04:45:00.000Z');
  assert.ok(third);
  assert.equal(await tryClaimAutomaticWeatherSync('2026-06-16T04:44:00.000Z', '2026-06-16T05:14:00.000Z'), null, 'avant l’expiration');
  assert.ok(await tryClaimAutomaticWeatherSync('2026-06-16T04:45:00.000Z', '2026-06-16T05:15:00.000Z'), 'un verrou expiré est repris');
});

test('résultat par espace : valeurs écrites puis état automatique renseigné, la réussite survivant à un échec', async () => {
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'otf', customCity: null, customPostcode: null });
  await saveWeatherGeocodeForUser(ALICE, 'otf:ferme-17', candidate, 'open-meteo');
  const [target] = await listAutomaticWeatherTargets();
  assert.ok(target);

  await automaticWeatherRepository.upsertValues({ target, kind: 'forecast', values: [{ date: '2026-06-16', precipitationMm: 2, et0Mm: 3 }, { date: '2026-06-17', precipitationMm: null, et0Mm: null }], source: 'visual-crossing', fetchedAt: '2026-06-15T04:16:00.000Z' });
  await automaticWeatherRepository.upsertValues({ target, kind: 'forecast', values: [{ date: '2026-06-16', precipitationMm: null, et0Mm: 3.5 }], source: 'visual-crossing', fetchedAt: '2026-06-16T04:16:00.000Z' });
  const values = await listWeatherDailyValuesForUser(ALICE, target.locationKey, '2026-06-16', '2026-06-17');
  assert.deepEqual(values.map((value) => [value.date, value.precipitationMm, value.et0Mm, value.fetchedAt]), [['2026-06-16', 2, 3.5, '2026-06-15T04:16:00.000Z']], 'la pluie connue est conservée, la date de lecture aussi ; un jour tout absent n’est pas écrit');

  await automaticWeatherRepository.recordWorkspaceResult({ workspaceId: target.workspaceId, at: '2026-06-15T04:17:00.000Z', successful: true, error: null, notBeforeAt: null });
  let preference = await readWeatherPreferenceForUser(ALICE);
  assert.equal(preference.lastAutomaticRefreshSuccessAt, '2026-06-15T04:17:00.000Z');
  assert.equal(preference.lastSuccessfulRefreshAt, '2026-06-15T04:17:00.000Z', 'la réussite automatique compte comme dernière actualisation');
  assert.equal(preference.lastAutomaticRefreshError, null);

  await automaticWeatherRepository.recordWorkspaceResult({ workspaceId: target.workspaceId, at: '2026-06-16T04:17:00.000Z', successful: false, error: 'Requête météo refusée (statut 401).', notBeforeAt: '2026-06-16T10:00:00.000Z' });
  preference = await readWeatherPreferenceForUser(ALICE);
  assert.equal(preference.lastAutomaticRefreshAttemptAt, '2026-06-16T04:17:00.000Z');
  assert.equal(preference.lastAutomaticRefreshSuccessAt, '2026-06-15T04:17:00.000Z', 'la dernière réussite est conservée');
  assert.equal(preference.lastAutomaticRefreshError, 'Requête météo refusée (statut 401).');
  assert.equal(preference.lastRefreshError, 'Requête météo refusée (statut 401).');
  assert.equal(preference.refreshNotBeforeAt, '2026-06-16T10:00:00.000Z');
  assert.equal((await readWeatherPreferenceForUser(BOB)).lastAutomaticRefreshAttemptAt, null);
});
