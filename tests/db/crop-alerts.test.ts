import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach, beforeEach } from 'node:test';
import { listCropAlertHistory } from '../../db/crop-alerts/alerts';
import {
  listCropAlertCommon,
  listCropAlertForecastDays,
  readCropAlertSettings,
  saveCropAlertSettingsForUser,
  saveDryingDaysForUser,
  saveFrostLinkForUser,
} from '../../db/crop-alerts/inputs';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { savePlanCalculationForUser } from '../../db/planning-repository';
import { upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { daylight } from '../../lib/domain/crop-alerts/sprinkler';
import type { IrrigationPushSendRequest } from '../../lib/domain/irrigation-push-contract';
import type { WeeklyPlan } from '../../lib/domain/planning/contract';
import { DEFAULT_PLANNING_SETTINGS } from '../../lib/domain/planning/settings';
import { addDaysToDateKey, dateKeyInTimeZone } from '../../lib/domain/water-management';
import type { WeatherDailyValue } from '../../lib/domain/weather/weather-provider';
import {
  evaluateCropAlertsAfterForecastWrite,
  evaluateCropDryingForAllWorkspaces,
  evaluateSprinklerAlertsForUser,
} from '../../lib/services/crop-alerts-service';
import { readCropAlertsView } from '../../lib/services/crop-alerts-view';
import { readCachedIrrigationSnapshot } from '../../lib/services/irrigation-service';
import type { IrrigationPushSendResult } from '../../lib/services/irrigation-push-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Les alertes par culture, persistance et envoi
 * (docs/weather-crop-alerts-contract.md, PR 2) : le jeu commun relu contre le
 * contrat, les révisions de la ferme, l'énergie solaire conservée,
 * l'évaluation après une écriture de prévisions et chaque matin, la
 * répétition tenue par la base et l'isolation entre exploitations
 * (scénario 13). Les séries sont celles de la ferme de démonstration, dont
 * les dates suivent le jour où le test tourne.
 */

const ALICE = 'alice';
const BOB = 'bob';
const LOCATION = 'custom:lyon:69001';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

function recordingSender(result: IrrigationPushSendResult = { status: 'sent' }) {
  const requests: IrrigationPushSendRequest[] = [];
  return { requests, send: async (request: IrrigationPushSendRequest) => { requests.push(request); return result; } };
}
const silent = () => undefined;

async function writeForecast(owner: string, from: string, values: Partial<WeatherDailyValue>[], at: Date) {
  await upsertWeatherDailyValuesForUser(owner, LOCATION, 'forecast', values.map((value, index) => ({
    date: addDaysToDateKey(from, index), precipitationMm: 0, et0Mm: 1, minimumTemperatureCelsius: 8, maximumTemperatureCelsius: 15, ...value,
  })), 'visual-crossing', at.toISOString());
}

/** Le tableau « Le jeu commun des seuils » du contrat : nom, dégâts dès. */
function contractThresholds(): Map<string, number> {
  const text = readFileSync(new URL('../../docs/weather-crop-alerts-contract.md', import.meta.url), 'utf8');
  const section = text.slice(text.indexOf('### Le jeu commun des seuils'), text.indexOf('### Les cultures sans seuil'));
  const rows = new Map<string, number>();
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 6 || !/°C$/.test(cells[2]) || cells[1] === 'Culture (espèces d\'OTF)') continue;
    rows.set(cells[1], Number(cells[2].replace(' °C', '').replace('−', '-').replace(',', '.')));
  }
  return rows;
}

test('le jeu commun est relu chiffre pour chiffre contre le contrat ; les délais de séchage sont ceux du contrat', async () => {
  const common = await listCropAlertCommon();
  const byName = new Map(common.map((entry) => [entry.name, entry]));
  const contract = contractThresholds();
  assert.equal(contract.size, 51);
  for (const [name, damage] of contract) {
    // La courge et la courgette partagent une ligne du contrat ; seule la courge a un délai de séchage.
    const names = name === 'Courge, courgette' ? ['Courge', 'Courgette'] : [name];
    for (const stored of names) assert.equal(byName.get(stored)?.damageCelsius, damage, stored);
  }
  assert.deepEqual(common.filter((entry) => entry.dryingDays !== null).map((entry) => [entry.name, entry.dryingDays]), [
    ['Ail', 15], ['Courge', 10], ['Melon', 7], ['Pomme de terre', 14],
  ]);
  assert.deepEqual(common.filter((entry) => entry.damageCelsius === null).map((entry) => entry.name), [
    'Asperge', 'Claytonia', 'Cresson de terre', 'Fraisier', 'Oseille à feuilles étroites', 'Topinambour',
  ]);
  assert.ok(common.every((entry) => entry.source.length > 0 && entry.recordedOn === '2026-11-06'));
});

test('les saisies de la ferme sont des révisions que la base ne laisse ni modifier ni effacer ; elle refuse ce que le domaine refuse', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  assert.deepEqual((await readCropAlertSettings(workspaceId)).horizonDays, 3, 'sans réglage, ceux du contrat');
  assert.equal((await saveCropAlertSettingsForUser(ALICE, { frostOffsetCelsius: '1,5' })).ok, true);
  assert.equal((await readCropAlertSettings(workspaceId)).frostOffsetCelsius, 1.5);
  assert.deepEqual(await saveCropAlertSettingsForUser(ALICE, { frostOffsetCelsius: '0,3' }), { ok: false, problems: ['Le décalage des seuils de gel va de −5 à +5 °C, par pas de 0,5 °C.'] });
  // Les marges de gel (P44) : 3 et 2 °C sans réglage, gardées par la révision suivante, refusées hors bornes par la base aussi.
  assert.deepEqual([(await readCropAlertSettings(workspaceId)).frostMarginSensitiveCelsius, (await readCropAlertSettings(workspaceId)).frostMarginHardyCelsius], [3, 2]);
  assert.equal((await saveCropAlertSettingsForUser(ALICE, { frostMarginSensitiveCelsius: '3,5' })).ok, true);
  assert.equal((await saveCropAlertSettingsForUser(ALICE, { horizonDays: 3 })).ok, true);
  const kept = await readCropAlertSettings(workspaceId);
  assert.deepEqual([kept.frostOffsetCelsius, kept.frostMarginSensitiveCelsius, kept.frostMarginHardyCelsius], [1.5, 3.5, 2]);
  assert.throws(() => database.sqlite.exec(`INSERT INTO irrigation_crop_alert_settings (id, workspace_id, frost_active, drying_active, sprinkler_active, horizon_days, frost_offset_celsius, frost_margin_sensitive_celsius, sprinkler_max_temperature_celsius, sprinkler_radiation_w_per_square_meter, recorded_at) VALUES ('m', '${workspaceId}', 1, 1, 1, 3, 0, 5.5, 24, 400, 'now')`), /CHECK/u);
  assert.equal((await saveFrostLinkForUser(ALICE, { plantId: 'plante-tomate', seriesId: null, commonKey: 'tomate' })).ok, true);
  assert.deepEqual(await saveFrostLinkForUser(ALICE, { plantId: 'plante-tomate', seriesId: null, commonKey: 'mandragore' }), { ok: false, problems: ['Cette culture n’est pas dans le jeu commun.'] });
  assert.equal((await saveDryingDaysForUser(ALICE, { plantId: 'plante-ail', dryingDays: '' })).ok, true);
  for (const table of ['irrigation_crop_frost_links', 'irrigation_crop_drying_revisions', 'irrigation_crop_alert_settings']) {
    assert.throws(() => database.sqlite.exec(`UPDATE ${table} SET recorded_at = '2026-01-01T00:00:00.000Z'`), /CROP_ALERT_REVISION_IMMUTABLE/u, table);
    assert.throws(() => database.sqlite.exec(`DELETE FROM ${table}`), /CROP_ALERT_REVISION_IMMUTABLE/u, table);
  }
  assert.throws(() => database.sqlite.exec(`INSERT INTO irrigation_crop_frost_links (id, workspace_id, plant_id, damage_celsius, recorded_at) VALUES ('x', '${workspaceId}', 'p', -2.2, 'now')`), /CHECK/u);
  assert.throws(() => database.sqlite.exec(`INSERT INTO irrigation_crop_alert_settings (id, workspace_id, frost_active, drying_active, sprinkler_active, horizon_days, frost_offset_celsius, sprinkler_max_temperature_celsius, sprinkler_radiation_w_per_square_meter, recorded_at) VALUES ('x', '${workspaceId}', 1, 1, 1, 8, 0, 24, 400, 'now')`), /CHECK/u);
});

test('l’énergie solaire prévue est conservée ; absente, elle reste nulle et n’efface pas la précédente', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const at = new Date('2026-11-09T05:15:00.000Z');
  await writeForecast(ALICE, '2026-11-09', [{ solarEnergyMegajoulesPerSquareMeter: 6.4 }, { solarEnergyMegajoulesPerSquareMeter: null }], at);
  await writeForecast(ALICE, '2026-11-09', [{ solarEnergyMegajoulesPerSquareMeter: null }], new Date('2026-11-09T13:00:00.000Z'));
  const days = await listCropAlertForecastDays(workspaceId, LOCATION, '2026-11-09', '2026-11-10');
  assert.deepEqual(days.map((day) => day.solarEnergyMegajoulesPerSquareMeter), [6.4, null]);
});

test('le gel : la carotte en place alerte une fois pour son jour visé ; l’actualisation suivante ne renvoie rien', async () => {
  const now = new Date();
  const today = dateKeyInTimeZone(now);
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  assert.equal((await saveFrostLinkForUser(ALICE, { plantId: 'plante-carotte', seriesId: null, commonKey: 'carotte' })).ok, true);
  await writeForecast(ALICE, today, [{ minimumTemperatureCelsius: 6 }, { minimumTemperatureCelsius: -5 }, { minimumTemperatureCelsius: 2 }], now);
  const sender = recordingSender();
  await evaluateCropAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now, send: sender.send, log: silent });
  assert.equal(sender.requests.length, 1);
  assert.equal(sender.requests[0].notification.title, 'Alerte gel');
  assert.match(sender.requests[0].notification.body, /^Gel prévu .+ : -5 °C\. Carotte \(1 culture présente\)\.$/u);
  const [alert] = await listCropAlertHistory(workspaceId, 10);
  assert.deepEqual([alert.kind, alert.plantId, alert.targetDate, alert.damageCelsius, alert.marginCelsius, alert.offsetCelsius, alert.forecastValue, alert.deliveryStatus],
    ['frost', 'plante-carotte', addDaysToDateKey(today, 1), -6, 2, 0, -5, 'sent']);
  assert.equal(alert.detail, sender.requests[0].notification.body);

  await writeForecast(ALICE, today, [{ minimumTemperatureCelsius: 6 }, { minimumTemperatureCelsius: -6 }], new Date(now.getTime() + 60_000));
  await evaluateCropAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now, send: sender.send, log: silent });
  assert.equal(sender.requests.length, 1, 'rien de nouveau');

  assert.equal((await saveCropAlertSettingsForUser(ALICE, { frostActive: false })).ok, true);
  assert.equal((await saveFrostLinkForUser(ALICE, { plantId: 'plante-carotte', seriesId: null, commonKey: 'carotte', damageCelsius: '-7' })).ok, true);
  await evaluateCropAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now, send: sender.send, log: silent });
  assert.equal(sender.requests.length, 1, 'alerte de gel inactive');
});

test('scénario 13 : le gel de l’exploitation A n’envoie rien vers B, et aucune saisie de A ne se lit chez B', async () => {
  const now = new Date();
  const today = dateKeyInTimeZone(now);
  await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  assert.equal((await saveFrostLinkForUser(ALICE, { plantId: 'plante-carotte', seriesId: null, commonKey: 'carotte' })).ok, true);
  assert.equal((await saveCropAlertSettingsForUser(ALICE, { frostOffsetCelsius: 5 })).ok, true);
  await writeForecast(BOB, today, [{ minimumTemperatureCelsius: -8 }, { minimumTemperatureCelsius: -8 }], now);
  const sender = recordingSender();
  await evaluateCropAlertsAfterForecastWrite({ workspaceId: bob, locationKey: LOCATION, now, send: sender.send, log: silent });
  assert.deepEqual(sender.requests, [], 'les espèces de B ne sont pas rattachées');
  assert.equal((await readCropAlertSettings(bob)).frostOffsetCelsius, 0);
  assert.deepEqual(await listCropAlertHistory(bob, 10), []);
});

/** Un plan de la semaine du lundi 9 novembre 2026 : une aspersion jeudi à 10 h sur T01, sous le tunnel, et une à 23 h. */
function sprinklerPlan(): WeeklyPlan {
  const proposal = (id: string, startAt: string, endAt: string) => ({
    id, equipmentId: 'asperseur', equipmentName: 'Asperseurs', kind: 'sprinkler', settingId: 'standard', settingName: 'Standard', placementId: 'pose',
    startAt, endAt, durationSeconds: 3600, doseMm: 5,
    applications: [{ otfZoneId: 'zone-pres', otfPlotId: 'plot-tunnel-1', otfBedId: 'bed-t01', rateMmPerHour: 5, bedAreaSquareMeters: 20, wettedAreaSquareMeters: 20 }],
    bedApplications: [{ bedId: 'bed-t01', bedName: 'T01', needBeforeMm: 5, appliedMm: 5, needAfterMm: 0, surplusMm: 0, wettedAreaSquareMeters: 20 }],
    volumeCubicMeters: 0.1, flowCubicMetersPerHour: 0.1, pumpId: null, pumpOriginId: null,
    justification: { priority: 'normal', doseReason: 'maximum-dose', timingReason: 'earliest', limitingConstraint: null, pump: null, supply: null, hydraulicallyVerified: false },
  });
  return {
    weekStart: '2026-11-09', weekEnd: '2026-11-15', computedAt: '2026-11-09T05:30:00.000Z', horizonStartAt: '2026-11-09T05:30:00.000Z', horizonEndAt: '2026-11-15T23:00:00.000Z',
    proposals: [
      proposal('p-1', '2026-11-12T09:00:00.000Z', '2026-11-12T10:00:00.000Z'),
      proposal('p-2', '2026-11-12T22:00:00.000Z', '2026-11-12T23:00:00.000Z'),
    ],
    beds: [], deficit: { waterCubicMeters: 0, pumpTimeCubicMeters: 0, byReason: {}, bedCount: 0 }, budgets: [], settings: DEFAULT_PLANNING_SETTINGS,
    assumptions: { forecastDays: 7, reservoirsObservedAt: [] }, suggestions: [], overcommittedDays: [],
  } as unknown as WeeklyPlan;
}

test('scénarios 14 et 17 : l’aspersion de jour sous abri par temps frais est signalée une fois ; celle de 23 h jamais', async () => {
  const now = new Date('2026-11-09T07:00:00.000Z');
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  database.sqlite.exec(`INSERT INTO irrigation_weather_geocodes (workspace_id, location_key, display_name, city, postcode, latitude, longitude, timezone, source, resolved_at)
    VALUES ('${workspaceId}', '${LOCATION}', 'Lyon', 'Lyon', '69001', 45.76, 4.84, 'Europe/Paris', 'test', '2026-11-01T00:00:00.000Z')`);
  await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: '2026-11-09', trigger: 'manual', actorUserId: ALICE, plan: sprinklerPlan() });
  const energy = 500 * daylight('2026-11-12', { latitude: 45.76, longitude: 4.84 }).dayLengthSeconds / 1_000_000;
  await writeForecast(ALICE, '2026-11-09', [{}, {}, {}, { maximumTemperatureCelsius: 18, minimumTemperatureCelsius: 12, solarEnergyMegajoulesPerSquareMeter: energy }], now);
  const sender = recordingSender();
  await evaluateCropAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now, send: sender.send, log: silent });
  assert.equal(sender.requests.length, 1);
  assert.equal(sender.requests[0].notification.title, 'Alerte aspersion');
  assert.equal(sender.requests[0].notification.body, 'Aspersion à reconsidérer : jeudi 12 novembre 10 h, planche T01 (sous abri). Maximale prévue 18 °C (seuil : sous 24 °C).');
  await evaluateSprinklerAlertsForUser(ALICE, { now, send: sender.send, log: silent });
  assert.equal(sender.requests.length, 1, 'une seule alerte par créneau et par jour');
  const [alert] = await listCropAlertHistory(workspaceId, 10);
  assert.deepEqual([alert.kind, alert.targetDate, alert.forecastValue, alert.unit, alert.name], ['sprinkler', '2026-11-12', 18, '°C', 'planche T01']);
});

test('le séchage : la série dont la date d’arrêt est venue alerte une fois, chaque matin même sans météo ; une ferme qui l’a coupé ne reçoit rien', async () => {
  const now = new Date();
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await ensureWorkspaceForUser(BOB);
  assert.equal((await saveFrostLinkForUser(ALICE, { plantId: 'plante-carotte', seriesId: null, commonKey: 'carotte' })).ok, true);
  assert.equal((await saveDryingDaysForUser(ALICE, { plantId: 'plante-carotte', dryingDays: '60' })).ok, true);
  const sender = recordingSender({ status: 'no-subscriber' });
  assert.deepEqual(await evaluateCropDryingForAllWorkspaces({ now, send: sender.send, log: silent }), { evaluated: 2, failed: 0 });
  assert.equal(sender.requests.length, 1, 'les carottes de printemps, déjà récoltées, ne comptent pas');
  assert.equal(sender.requests[0].notification.title, 'Alerte récolte');
  assert.match(sender.requests[0].notification.body, /^Cessez d’arroser avant la récolte : carotte, planche V01 ; récolte attendue à partir du lundi .+\.$/u);
  assert.match(sender.requests[0].notification.data.url, /^\/irrigation\/alertes-cultures\?season=\d{4}$/u);
  const [alert] = await listCropAlertHistory(workspaceId, 10);
  assert.deepEqual([alert.kind, alert.seriesId, alert.dryingDays, alert.deliveryStatus], ['drying', 'serie-carottes-verger', 60, 'no-subscriber']);
  await evaluateCropDryingForAllWorkspaces({ now, send: sender.send, log: silent });
  assert.equal(sender.requests.length, 1, 'une seule fois par série');

  assert.equal((await saveCropAlertSettingsForUser(BOB, { dryingActive: false })).ok, true);
  assert.equal((await saveFrostLinkForUser(BOB, { plantId: 'plante-carotte', seriesId: null, commonKey: 'carotte' })).ok, true);
  assert.equal((await saveDryingDaysForUser(BOB, { plantId: 'plante-carotte', dryingDays: '60' })).ok, true);
  await evaluateCropDryingForAllWorkspaces({ now, send: sender.send, log: silent });
  assert.equal(sender.requests.length, 1);
});

test('3.8 : sans le Planning, les aspersions ne s’évaluent pas ; avec lui, elles reviennent (P1)', async () => {
  const now = new Date('2026-11-09T07:00:00.000Z');
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  database.sqlite.exec(`INSERT INTO irrigation_weather_geocodes (workspace_id, location_key, display_name, city, postcode, latitude, longitude, timezone, source, resolved_at)
    VALUES ('${workspaceId}', '${LOCATION}', 'Lyon', 'Lyon', '69001', 45.76, 4.84, 'Europe/Paris', 'test', '2026-11-01T00:00:00.000Z')`);
  await savePlanCalculationForUser(ALICE, { season: 2026, weekStart: '2026-11-09', trigger: 'manual', actorUserId: ALICE, plan: sprinklerPlan() });
  const energy = 500 * daylight('2026-11-12', { latitude: 45.76, longitude: 4.84 }).dayLengthSeconds / 1_000_000;
  await writeForecast(ALICE, '2026-11-09', [{}, {}, {}, { maximumTemperatureCelsius: 18, minimumTemperatureCelsius: 12, solarEnergyMegajoulesPerSquareMeter: energy }], now);
  await saveFeatureSelectionForUser(ALICE, ['alertes-cultures'], now);
  const sender = recordingSender();
  await evaluateCropAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now, send: sender.send, log: silent });
  await evaluateSprinklerAlertsForUser(ALICE, { now, send: sender.send, log: silent });
  assert.equal(sender.requests.length, 0);
  assert.deepEqual(await listCropAlertHistory(workspaceId, 10), []);

  await saveFeatureSelectionForUser(ALICE, ['materiel', 'arrosages', 'besoins', 'planning', 'alertes-cultures'], now);
  await evaluateSprinklerAlertsForUser(ALICE, { now, send: sender.send, log: silent });
  assert.deepEqual(sender.requests.map((request) => request.notification.title), ['Alerte aspersion']);
});

test('3.8 : Alertes cultures décochée, ni gel ni arrêt d’arrosage avant récolte ; une ferme d’avant la 3.8 les reçoit (R1, R6)', async () => {
  const now = new Date();
  const today = dateKeyInTimeZone(now);
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await ensureWorkspaceForUser(BOB);
  for (const owner of [ALICE, BOB]) {
    assert.equal((await saveFrostLinkForUser(owner, { plantId: 'plante-carotte', seriesId: null, commonKey: 'carotte' })).ok, true);
    assert.equal((await saveDryingDaysForUser(owner, { plantId: 'plante-carotte', dryingDays: '60' })).ok, true);
  }
  await saveFeatureSelectionForUser(ALICE, ['materiel', 'alertes-meteo'], now);
  await writeForecast(ALICE, today, [{ minimumTemperatureCelsius: -5 }], now);
  const sender = recordingSender();
  await evaluateCropAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now, send: sender.send, log: silent });
  assert.equal(sender.requests.length, 0, 'pas de gel pour Alice');
  assert.deepEqual(await evaluateCropDryingForAllWorkspaces({ now, send: sender.send, log: silent }), { evaluated: 1, failed: 0 }, 'Bob seul');
  assert.deepEqual(sender.requests.map((request) => [request.recipientKey === workspaceId ? 'alice' : 'bob', request.notification.title]), [['bob', 'Alerte récolte']]);
  assert.deepEqual(await listCropAlertHistory(workspaceId, 10), [], 'rien d’enregistré chez Alice');
});

test('une panne du service de notification est enregistrée comme échec, sans lever ; une panne de la base ne lève pas', async () => {
  const now = new Date();
  const today = dateKeyInTimeZone(now);
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  assert.equal((await saveFrostLinkForUser(ALICE, { plantId: 'plante-carotte', seriesId: null, commonKey: 'carotte' })).ok, true);
  await writeForecast(ALICE, today, [{ minimumTemperatureCelsius: -5 }], now);
  await evaluateCropAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now, send: async () => { throw new Error('panne'); }, log: silent });
  assert.equal((await listCropAlertHistory(workspaceId, 10))[0].deliveryStatus, 'failed');
  database.sqlite.exec('DROP TABLE irrigation_crop_alerts');
  const logged: Record<string, unknown>[] = [];
  await evaluateCropAlertsAfterForecastWrite({ workspaceId, locationKey: LOCATION, now, send: recordingSender().send, log: (_level, entry) => logged.push(entry) });
  assert.equal(logged[0]?.event, 'crop_alert_evaluation_failed');
});

test('l’encart : la carotte rattachée et l’endive à rattacher, le gel qui se confirmerait, l’historique avec ses valeurs ; rien de A chez B', async () => {
  const now = new Date();
  const today = dateKeyInTimeZone(now);
  const season = Number(today.slice(0, 4));
  const snapshot = await readCachedIrrigationSnapshot(ALICE, season);
  assert.ok(snapshot);
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  assert.equal((await saveFrostLinkForUser(ALICE, { plantId: 'plante-carotte', seriesId: null, commonKey: 'carotte', damageCelsius: '8' })).ok, true);
  assert.equal((await saveCropAlertSettingsForUser(ALICE, { frostOffsetCelsius: '1,5' })).ok, true);
  await writeForecast(ALICE, today, [{ minimumTemperatureCelsius: 9 }, { minimumTemperatureCelsius: 15 }], now);

  const before = await readCropAlertsView({ ownerUserId: ALICE, workspaceId: alice, locationKey: LOCATION, snapshot, season, now });
  assert.ok(before);
  const carrot = before.frost.find((row) => row.plantId === 'plante-carotte');
  assert.deepEqual([carrot?.damageCelsius, carrot?.marginCelsius, carrot?.alertCelsius, carrot?.source, carrot?.common?.name], [8, 3, 12.5, 'farm', 'Carotte']);
  assert.ok(before.withoutThreshold.some((row) => row.plantId === 'plante-endive' && row.status === 'missing'));
  assert.deepEqual(before.upcoming.frost.map((day) => [day.date, day.crops.map((crop) => [crop.name, crop.alreadyAlerted])]), [[today, [['Carotte', false]]]]);
  assert.equal(before.history.length, 0);

  await evaluateCropAlertsAfterForecastWrite({ workspaceId: alice, locationKey: LOCATION, now, send: recordingSender().send, log: silent });
  const after = await readCropAlertsView({ ownerUserId: ALICE, workspaceId: alice, locationKey: LOCATION, snapshot, season, now });
  assert.deepEqual(after?.upcoming.frost[0].crops.map((crop) => crop.alreadyAlerted), [true]);
  assert.equal(after?.history.length, 1);
  const [entry] = after?.history ?? [];
  assert.deepEqual([entry.kindLabel, entry.name, entry.deliveryLabel], ['Gel', 'Carotte', 'Envoyée']);
  assert.match(entry.fact, /^Minimale prévue 9 °C le .+ ; alerte à 12,5 °C \(dégâts 8 °C, marge 3 °C, microclimat \+1,5 °C\)$/u);
  assert.match(entry.url, /^\/irrigation\/alertes-cultures\?season=\d{4}&week=\d{4}-\d{2}-\d{2}$/);

  const other = await readCropAlertsView({ ownerUserId: BOB, workspaceId: bob, locationKey: LOCATION, snapshot, season, now });
  assert.equal(other?.settings.frostOffsetCelsius, 0);
  assert.ok(other?.withoutThreshold.some((row) => row.plantId === 'plante-carotte' && row.status === 'missing'));
  assert.deepEqual([other?.frost, other?.history, other?.upcoming.frost], [[], [], []]);
});
