import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import {
  clearHydricGoalsForUser,
  deleteManualRainfallForUser,
  ensureRecurringHydricGoalsForUser,
  listDailyWaterLimitsForUser,
  listHydricGoalRevisionsThroughWeekForUser,
  listHydricGoalsForUser,
  listWeatherDailyValuesForUser,
  readWeatherGeocodeForUser,
  readWeatherPreferenceForUser,
  recordWeatherRefreshForUser,
  saveDailyWaterLimitForUser,
  saveHydricGoalForUser,
  saveManualRainfallForUser,
  saveWeatherGeocodeForUser,
  saveWeatherPreferenceForUser,
  tryClaimWeatherRefreshForUser,
  upsertWeatherDailyValuesForUser,
} from '../../db/water-management-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser, readWaterBudgetRevisionForUser } from '../../db/workspace-repository';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

const ALICE = 'alice';
const BOB = 'bob';
const SEASON = 2026;
const WEEK_1 = '2026-06-01';
const WEEK_2 = '2026-06-08';
const WEEK_3 = '2026-06-15';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
  // Les identifiants de révision commencent par l'horodatage : l'horloge simulée
  // avance d'une seconde entre deux enregistrements pour un ordre déterministe.
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-15T08:00:00.000Z') });
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

const tickSecond = () => mock.timers.tick(1000);

const farmGoal = (weekStart: string, amountMm: number) => ({
  season: SEASON, weekStart, scopeType: 'farm' as const, otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm,
});
const bedGoal = (weekStart: string, otfBedId: string, amountMm: number) => ({
  season: SEASON, weekStart, scopeType: 'bed' as const, otfZoneId: 'zone-1', otfPlotId: 'plot-1', otfBedId, amountMm,
});

test('objectifs hydriques : la dernière révision « set » de chaque périmètre fait foi, une révision « cleared » l’efface', async () => {
  assert.deepEqual(await listHydricGoalsForUser(ALICE, SEASON, WEEK_1), [], 'sans espace, aucune lecture ne crée rien');
  assert.equal(await findWorkspaceIdForUser(ALICE), null);

  await saveHydricGoalForUser(ALICE, farmGoal(WEEK_1, 20));
  assert.notEqual(await findWorkspaceIdForUser(ALICE), null, 'enregistrer crée l’espace au besoin');
  tickSecond();
  await saveHydricGoalForUser(ALICE, bedGoal(WEEK_1, 'bed-1', 30));
  tickSecond();
  await saveHydricGoalForUser(ALICE, farmGoal(WEEK_1, 25));

  const goals = await listHydricGoalsForUser(ALICE, SEASON, WEEK_1);
  assert.deepEqual(
    goals.map((goal) => [goal.scopeType, goal.otfBedId, goal.amountMm]).sort(),
    [['bed', 'bed-1', 30], ['farm', null, 25]],
    'une seule valeur par périmètre, la plus récente',
  );
  assert.deepEqual(await listHydricGoalsForUser(ALICE, SEASON, WEEK_2), [], 'la semaine suivante n’hérite pas toute seule');
  assert.deepEqual(await listHydricGoalsForUser(ALICE, 2025, WEEK_1), [], 'ni une autre saison');

  tickSecond();
  assert.equal(await clearHydricGoalsForUser(ALICE, SEASON, WEEK_1), 2);
  assert.deepEqual(await listHydricGoalsForUser(ALICE, SEASON, WEEK_1), []);
  assert.equal(await clearHydricGoalsForUser(ALICE, SEASON, WEEK_1), 0, 'rien à effacer une seconde fois');
  assert.equal(await clearHydricGoalsForUser(BOB, SEASON, WEEK_1), 0, 'sans espace : zéro');

  const revisions = await listHydricGoalRevisionsThroughWeekForUser(ALICE, SEASON, WEEK_1);
  assert.equal(revisions.length, 5, 'toutes les révisions, y compris les effacements, restent lisibles');
  assert.deepEqual(
    revisions.slice(0, 3).map((revision) => [revision.action, revision.scopeType, revision.amountMm]),
    [['set', 'farm', 20], ['set', 'bed', 30], ['set', 'farm', 25]],
    'ordre chronologique des enregistrements',
  );
  // Les deux effacements sont écrits dans le même lot : leur ordre relatif n'est pas garanti.
  assert.deepEqual(revisions.slice(3).map((revision) => [revision.action, revision.amountMm]), [['cleared', null], ['cleared', null]]);
  assert.deepEqual(revisions.slice(3).map((revision) => revision.scopeType).sort(), ['bed', 'farm']);
});

test('objectifs hydriques : deux révisions dans la même milliseconde gardent leur ordre, la seconde fait foi', async () => {
  // Les identifiants commencent par l'horodatage, puis un UUID tiré au sort :
  // dans la même milliseconde, le préfixe est le même et l'identifiant ne classe
  // plus rien (point ouvert 27, docs/revision-order-contract.md). L'égalité est
  // posée ici, le test ne dépend d'aucune horloge.
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const insert = database.sqlite.prepare(`INSERT INTO irrigation_hydric_goal_revisions
    (id, workspace_id, season, week_start, scope_type, otf_zone_id, otf_plot_id, otf_bed_id, amount_mm, action, actor_user_id, created_at)
    VALUES (?, ?, ?, ?, 'farm', NULL, NULL, NULL, ?, 'set', ?, ?)`);
  const sameMillisecond = '2026-06-01T06:00:00.500Z';
  insert.run('1780206400500-ffffffff-0000-4000-8000-000000000001', workspaceId, SEASON, WEEK_1, 20, ALICE, sameMillisecond);
  insert.run('1780206400500-00000000-0000-4000-8000-000000000002', workspaceId, SEASON, WEEK_1, 25, ALICE, sameMillisecond);
  assert.deepEqual((await listHydricGoalsForUser(ALICE, SEASON, WEEK_1)).map((goal) => goal.amountMm), [25], 'la seconde révision fait foi');
  assert.deepEqual(
    (await listHydricGoalRevisionsThroughWeekForUser(ALICE, SEASON, WEEK_1)).map((revision) => revision.amountMm),
    [20, 25],
    'l’histoire se rejoue dans l’ordre d’insertion',
  );
});

test('objectifs récurrents : la semaine sans révision copie les objectifs de la dernière semaine renseignée, une seule fois', async () => {
  assert.deepEqual(await ensureRecurringHydricGoalsForUser(ALICE, SEASON, WEEK_2), [], 'sans espace : rien');
  await ensureWorkspaceForUser(ALICE);
  assert.deepEqual(await ensureRecurringHydricGoalsForUser(ALICE, SEASON, WEEK_2), [], 'sans semaine antérieure : rien à copier');

  await saveHydricGoalForUser(ALICE, farmGoal(WEEK_1, 20));
  tickSecond();
  await saveHydricGoalForUser(ALICE, bedGoal(WEEK_1, 'bed-1', 30));
  tickSecond();
  const copied = await ensureRecurringHydricGoalsForUser(ALICE, SEASON, WEEK_3);
  assert.deepEqual(copied.map((goal) => [goal.weekStart, goal.scopeType, goal.amountMm]).sort(), [[WEEK_3, 'bed', 30], [WEEK_3, 'farm', 20]]);
  const sourceIds = new Set((await listHydricGoalsForUser(ALICE, SEASON, WEEK_1)).map((goal) => goal.id));
  const week3Revisions = (await listHydricGoalRevisionsThroughWeekForUser(ALICE, SEASON, WEEK_3)).filter((revision) => revision.weekStart === WEEK_3);
  assert.equal(week3Revisions.length, 2);
  for (const revision of week3Revisions) assert.ok(revision.copiedFromGoalId && sourceIds.has(revision.copiedFromGoalId), 'chaque copie cite son objectif source');

  tickSecond();
  const again = await ensureRecurringHydricGoalsForUser(ALICE, SEASON, WEEK_3);
  assert.deepEqual(again.map((goal) => goal.id).sort(), copied.map((goal) => goal.id).sort(), 'un second appel ne recopie pas');

  tickSecond();
  await clearHydricGoalsForUser(ALICE, SEASON, WEEK_3);
  tickSecond();
  assert.deepEqual(await ensureRecurringHydricGoalsForUser(ALICE, SEASON, WEEK_3), [], 'une semaine volontairement vidée reste vide');
  const week2 = await ensureRecurringHydricGoalsForUser(ALICE, SEASON, WEEK_2);
  assert.deepEqual(week2.map((goal) => goal.amountMm).sort(), [20, 30], 'une semaine intermédiaire copie la dernière semaine antérieure renseignée');
});

test('objectifs : la base refuse un périmètre incohérent ou un montant négatif', async () => {
  await ensureWorkspaceForUser(ALICE);
  await assert.rejects(
    saveHydricGoalForUser(ALICE, { season: SEASON, weekStart: WEEK_1, scopeType: 'zone', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 10 }),
    /CHECK constraint failed/,
  );
  await assert.rejects(saveHydricGoalForUser(ALICE, farmGoal(WEEK_1, -1)), /CHECK constraint failed/);
  assert.deepEqual(await listHydricGoalsForUser(ALICE, SEASON, WEEK_1), []);
});

test('préférence météo : valeur par défaut, mode personnalisé, retour au mode OTF, contrainte de cohérence', async () => {
  const defaults = await readWeatherPreferenceForUser(ALICE);
  assert.equal(defaults.locationMode, 'otf');
  assert.equal(defaults.lastSuccessfulRefreshAt, null);
  assert.equal(await findWorkspaceIdForUser(ALICE), null, 'lire la préférence ne crée pas d’espace');

  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'custom', customCity: 'Vannes', customPostcode: '56000' });
  let preference = await readWeatherPreferenceForUser(ALICE);
  assert.equal(preference.locationMode, 'custom');
  assert.equal(preference.customCity, 'Vannes');
  assert.equal(preference.customPostcode, '56000');

  await recordWeatherRefreshForUser(ALICE, { successful: false, at: '2026-06-15T08:00:00.000Z', error: 'quota', notBeforeAt: '2026-06-15T09:00:00.000Z' });
  await saveWeatherPreferenceForUser(ALICE, { locationMode: 'otf', customCity: 'ignorée', customPostcode: '00000' });
  preference = await readWeatherPreferenceForUser(ALICE);
  assert.equal(preference.locationMode, 'otf');
  assert.equal(preference.customCity, null, 'en mode OTF, la ville personnalisée est effacée');
  assert.equal(preference.customPostcode, null);
  assert.equal(preference.lastRefreshError, null, 'changer de lieu remet l’état d’actualisation à zéro');
  assert.equal(preference.refreshNotBeforeAt, null);
  assert.equal(preference.lastRefreshAttemptAt, null);

  await assert.rejects(
    saveWeatherPreferenceForUser(ALICE, { locationMode: 'custom', customCity: null, customPostcode: null }),
    /CHECK constraint failed/,
    'un mode personnalisé sans ville est refusé par la base',
  );
});

test('actualisation météo : succès et échec enregistrés, la dernière réussite survit à un échec', async () => {
  await recordWeatherRefreshForUser(ALICE, { successful: true, at: '2026-06-15T06:15:00.000Z' });
  let preference = await readWeatherPreferenceForUser(ALICE);
  assert.equal(preference.lastSuccessfulRefreshAt, '2026-06-15T06:15:00.000Z');
  assert.equal(preference.lastRefreshAttemptAt, '2026-06-15T06:15:00.000Z');
  assert.equal(preference.lastRefreshError, null);

  await recordWeatherRefreshForUser(ALICE, { successful: false, at: '2026-06-15T12:00:00.000Z', notBeforeAt: '2026-06-15T12:30:00.000Z' });
  preference = await readWeatherPreferenceForUser(ALICE);
  assert.equal(preference.lastSuccessfulRefreshAt, '2026-06-15T06:15:00.000Z', 'la réussite précédente est conservée');
  assert.equal(preference.lastRefreshAttemptAt, '2026-06-15T12:00:00.000Z');
  assert.equal(preference.lastRefreshError, 'Actualisation météo impossible.', 'message par défaut');
  assert.equal(preference.refreshNotBeforeAt, '2026-06-15T12:30:00.000Z');

  await recordWeatherRefreshForUser(ALICE, { successful: true, at: '2026-06-15T13:00:00.000Z' });
  preference = await readWeatherPreferenceForUser(ALICE);
  assert.equal(preference.lastRefreshError, null);
  assert.equal(preference.refreshNotBeforeAt, null);
  assert.equal((await readWeatherPreferenceForUser(BOB)).lastSuccessfulRefreshAt, null, 'un autre propriétaire n’en voit rien');
});

test('verrou d’actualisation : une seule prise par intervalle, et jamais avant la date de report', async () => {
  assert.equal(await tryClaimWeatherRefreshForUser(ALICE, '2026-06-15T08:00:00.000Z'), true, 'première prise');
  assert.equal(await tryClaimWeatherRefreshForUser(ALICE, '2026-06-15T08:00:10.000Z'), false, 'dix secondes plus tard : refusée');
  assert.equal(await tryClaimWeatherRefreshForUser(ALICE, '2026-06-15T08:00:30.000Z'), true, 'trente secondes : autorisée');
  assert.equal(await tryClaimWeatherRefreshForUser(ALICE, '2026-06-15T08:00:35.000Z', 3_000), true, 'intervalle personnalisé de trois secondes');
  assert.equal((await readWeatherPreferenceForUser(ALICE)).lastRefreshAttemptAt, '2026-06-15T08:00:35.000Z');

  await recordWeatherRefreshForUser(ALICE, { successful: false, at: '2026-06-15T08:01:00.000Z', notBeforeAt: '2026-06-15T09:00:00.000Z' });
  assert.equal(await tryClaimWeatherRefreshForUser(ALICE, '2026-06-15T08:30:00.000Z'), false, 'reportée à 9 h');
  assert.equal(await tryClaimWeatherRefreshForUser(ALICE, '2026-06-15T09:00:00.000Z'), true, 'à l’heure du report');
  assert.equal(await tryClaimWeatherRefreshForUser(BOB, '2026-06-15T08:00:00.000Z'), true, 'le verrou est propre à chaque espace');
});

test('géocodage : absent, enregistré, mis à jour au même emplacement, borné par la base', async () => {
  assert.equal(await readWeatherGeocodeForUser(ALICE, 'otf:ferme'), null);
  const candidate = { displayName: 'Vannes, Morbihan', city: 'Vannes', postcode: '56000', latitude: 47.66, longitude: -2.76, timezone: 'Europe/Paris', countryCode: 'FR' };
  const saved = await saveWeatherGeocodeForUser(ALICE, 'otf:ferme', candidate, 'open-meteo');
  assert.equal(saved.locationKey, 'otf:ferme');
  assert.equal(saved.source, 'open-meteo');
  assert.equal(saved.resolvedAt, new Date().toISOString());
  assert.deepEqual(await readWeatherGeocodeForUser(ALICE, 'otf:ferme'), saved);

  mock.timers.tick(60_000);
  const moved = await saveWeatherGeocodeForUser(ALICE, 'otf:ferme', { ...candidate, city: 'Auray', latitude: 47.67 }, 'manuel');
  const read = await readWeatherGeocodeForUser(ALICE, 'otf:ferme');
  assert.equal(read?.city, 'Auray');
  assert.equal(read?.latitude, 47.67);
  assert.equal(read?.source, 'manuel');
  assert.equal(read?.resolvedAt, moved.resolvedAt);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_weather_geocodes').get()?.n, 1, 'une seule ligne par emplacement');
  assert.equal(await readWeatherGeocodeForUser(BOB, 'otf:ferme'), null);
  await assert.rejects(saveWeatherGeocodeForUser(ALICE, 'otf:ailleurs', { ...candidate, latitude: 95 }, 'x'), /CHECK constraint failed/);
});

test('valeurs météo quotidiennes : fusion par jour et nature, valeurs connues jamais écrasées par une absence', async () => {
  const key = 'otf:ferme';
  await upsertWeatherDailyValuesForUser(ALICE, key, 'forecast', [{ date: '2026-06-16', precipitationMm: null, et0Mm: null }], 'visual-crossing', '2026-06-15T06:00:00.000Z');
  assert.equal(await findWorkspaceIdForUser(ALICE), null, 'des valeurs toutes absentes ne créent rien');

  await upsertWeatherDailyValuesForUser(ALICE, key, 'forecast', [
    { date: '2026-06-16', precipitationMm: 4.5, et0Mm: 3.2 },
    { date: '2026-06-17', precipitationMm: 0, et0Mm: null },
  ], 'visual-crossing', '2026-06-15T06:00:00.000Z');
  await upsertWeatherDailyValuesForUser(ALICE, key, 'forecast', [
    { date: '2026-06-16', precipitationMm: null, et0Mm: 3.4 },
    { date: '2026-06-17', precipitationMm: 1.5, et0Mm: 2.9 },
  ], 'visual-crossing', '2026-06-15T18:00:00.000Z');
  await upsertWeatherDailyValuesForUser(ALICE, key, 'reanalysis', [{ date: '2026-06-16', precipitationMm: 5.1, et0Mm: null }], 'open-meteo', '2026-06-18T05:00:00.000Z');

  const values = await listWeatherDailyValuesForUser(ALICE, key, '2026-06-16', '2026-06-17');
  assert.deepEqual(values.map((value) => [value.date, value.dataKind, value.precipitationMm, value.et0Mm, value.fetchedAt]), [
    ['2026-06-16', 'forecast', 4.5, 3.4, '2026-06-15T06:00:00.000Z'],
    ['2026-06-16', 'reanalysis', 5.1, null, '2026-06-18T05:00:00.000Z'],
    ['2026-06-17', 'forecast', 1.5, 2.9, '2026-06-15T18:00:00.000Z'],
  ]);
  assert.deepEqual(await listWeatherDailyValuesForUser(ALICE, 'autre:lieu', '2026-06-16', '2026-06-17'), [], 'un autre lieu ne voit pas ces valeurs');
  assert.deepEqual(await listWeatherDailyValuesForUser(ALICE, key, '2026-06-18', '2026-06-20'), [], 'hors période');
  assert.deepEqual(await listWeatherDailyValuesForUser(BOB, key, '2026-06-16', '2026-06-17'), []);
});

test('pluie manuelle : propre à la ferme, visible pour tout lieu, remplaçable, jamais touchée par une synchronisation', async () => {
  await saveManualRainfallForUser(ALICE, '2026-06-16', 12);
  await saveManualRainfallForUser(ALICE, '2026-06-17', 0);
  await upsertWeatherDailyValuesForUser(ALICE, 'otf:ferme', 'reanalysis', [{ date: '2026-06-16', precipitationMm: 3, et0Mm: 2 }], 'open-meteo', '2026-06-18T05:00:00.000Z');

  const values = await listWeatherDailyValuesForUser(ALICE, 'otf:ferme', '2026-06-16', '2026-06-17');
  assert.deepEqual(values.map((value) => [value.date, value.dataKind, value.locationKey, value.precipitationMm, value.source]), [
    ['2026-06-16', 'manual_precipitation', 'farm:manual', 12, 'user'],
    ['2026-06-16', 'reanalysis', 'otf:ferme', 3, 'open-meteo'],
    ['2026-06-17', 'manual_precipitation', 'farm:manual', 0, 'user'],
  ], 'la réanalyse s’ajoute à côté de la pluie manuelle sans la remplacer ; 0 mm est une mesure');
  assert.equal((await listWeatherDailyValuesForUser(ALICE, 'n-importe-quel-lieu', '2026-06-16', '2026-06-16')).filter((value) => value.dataKind === 'manual_precipitation').length, 1);

  await saveManualRainfallForUser(ALICE, '2026-06-16', 14.5);
  const corrected = (await listWeatherDailyValuesForUser(ALICE, 'otf:ferme', '2026-06-16', '2026-06-16')).find((value) => value.dataKind === 'manual_precipitation');
  assert.equal(corrected?.precipitationMm, 14.5, 'une nouvelle saisie remplace la précédente');
  assert.equal(corrected?.et0Mm, null);
  await assert.rejects(saveManualRainfallForUser(ALICE, '2026-06-18', -2), /CHECK constraint failed/);

  assert.equal(await deleteManualRainfallForUser(ALICE, '2026-06-16'), true, 'une mesure se retire');
  const afterRemoval = await listWeatherDailyValuesForUser(ALICE, 'otf:ferme', '2026-06-16', '2026-06-17');
  assert.deepEqual(afterRemoval.map((value) => [value.date, value.dataKind]), [['2026-06-16', 'reanalysis'], ['2026-06-17', 'manual_precipitation']], 'la réanalyse reste, l’autre mesure aussi');
  assert.equal(await deleteManualRainfallForUser(ALICE, '2026-06-16'), false, 'rien à retirer une seconde fois');
});

test('limite journalière : deux révisions dans la même milliseconde gardent leur ordre, la plus récente d’abord', async () => {
  // Même règle que pour les objectifs : à created_at égal, l'identifiant ne
  // classe rien (point ouvert 27, docs/revision-order-contract.md).
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const insert = database.sqlite.prepare(`INSERT INTO irrigation_daily_water_limit_revisions
    (id, workspace_id, season, enabled, max_cubic_meters_per_day, valid_from, valid_until, note, actor_user_id, created_at)
    VALUES (?, ?, ?, 1, ?, '2026-06-01', NULL, NULL, ?, ?)`);
  const sameMillisecond = '2026-06-01T06:00:00.500Z';
  insert.run('1780206400500-ffffffff-0000-4000-8000-000000000001', workspaceId, SEASON, 60, ALICE, sameMillisecond);
  insert.run('1780206400500-00000000-0000-4000-8000-000000000002', workspaceId, SEASON, 40, ALICE, sameMillisecond);
  assert.deepEqual((await listDailyWaterLimitsForUser(ALICE)).map((limit) => limit.maxCubicMetersPerDay), [40, 60], 'l’ordre d’insertion départage, jamais l’identifiant');
});

test('limite journalière : historique du plus récent au plus ancien, révision du budget avancée, lot annulé si la base refuse', async () => {
  assert.deepEqual(await listDailyWaterLimitsForUser(ALICE), []);
  await saveDailyWaterLimitForUser(ALICE, { season: SEASON, enabled: true, maxCubicMetersPerDay: 60, validFrom: '2026-06-01', validUntil: null, note: 'arrêté sécheresse' });
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 1);
  tickSecond();
  await saveDailyWaterLimitForUser(ALICE, { season: SEASON, enabled: false, maxCubicMetersPerDay: 40, validFrom: '2026-07-01', validUntil: '2026-07-31', note: null });
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 2);

  const limits = await listDailyWaterLimitsForUser(ALICE);
  assert.deepEqual(limits.map((limit) => [limit.enabled, limit.maxCubicMetersPerDay, limit.validFrom, limit.validUntil, limit.note]), [
    [false, null, '2026-07-01', '2026-07-31', null],
    [true, 60, '2026-06-01', null, 'arrêté sécheresse'],
  ], 'la plus récente d’abord ; une limite désactivée ne garde pas de volume');

  tickSecond();
  await assert.rejects(
    saveDailyWaterLimitForUser(ALICE, { season: SEASON, enabled: true, maxCubicMetersPerDay: null, validFrom: '2026-08-01', validUntil: null, note: null }),
    /CHECK constraint failed/,
  );
  await assert.rejects(
    saveDailyWaterLimitForUser(ALICE, { season: SEASON, enabled: true, maxCubicMetersPerDay: 10, validFrom: '2026-08-10', validUntil: '2026-08-01', note: null }),
    /CHECK constraint failed/,
  );
  assert.equal(await readWaterBudgetRevisionForUser(ALICE), 2, 'un lot refusé ne fait pas avancer la révision');
  assert.equal((await listDailyWaterLimitsForUser(ALICE)).length, 2);
  assert.deepEqual(await listDailyWaterLimitsForUser(BOB), []);
});
