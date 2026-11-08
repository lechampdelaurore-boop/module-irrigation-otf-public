import assert from 'node:assert/strict';
import test from 'node:test';
import { dryingNotification, evaluateDrying } from '../lib/domain/crop-alerts/drying.ts';
import { daylight, evaluateSprinklers, sprinklerAlertKey, sprinklerNotifications, type SprinklerSlot } from '../lib/domain/crop-alerts/sprinkler.ts';
import { resolveDryingDays, type DryingRevision } from '../lib/domain/crop-alerts/thresholds.ts';
import type { CropSeries } from '../lib/domain/domain.ts';
import { COMMON, link, series } from './support/crop-alerts-fixtures.ts';

/**
 * L'arrêt d'arrosage avant récolte (scénarios 11 et 12) et les aspersions à
 * reconsidérer (scénarios 14 à 19) du contrat des alertes par culture.
 */

/** Semaine 2026-W30 : du lundi 20 juillet au dimanche 26 juillet 2026. */
const HARVEST_WEEK = '2026-W30';
const GARLIC_LINKS = [link('p-ail', 'ail'), link('p-oignon-botte', 'oignon-botte'), link('p-aillet', 'oignon-botte')];

function drying(options: { today: string; series?: CropSeries[]; alerted?: string[]; dryingRevisions?: DryingRevision[] }) {
  return evaluateDrying({
    series: options.series ?? [series({ id: 'ail-sec', plantId: 'p-ail', plantName: 'Ail', harvestWeeksExpected: [HARVEST_WEEK, '2026-W31'] })],
    bedNamesBySeries: new Map([['ail-sec', ['14', '12']], ['ail-blanc', ['3']]]),
    frostRevisions: GARLIC_LINKS,
    dryingRevisions: options.dryingRevisions ?? [],
    common: COMMON,
    today: options.today,
    alertedSeriesIds: new Set(options.alerted ?? []),
  });
}

test('scénario 11 : récolte attendue à partir du lundi 20 juillet, délai 15 jours : alerte le 5 juillet, une seule fois', () => {
  const before = drying({ today: '2026-07-04' });
  assert.deepEqual(before.due, []);
  assert.deepEqual(before.upcoming.map((deadline) => [deadline.seriesId, deadline.stopDate, deadline.harvestStart]), [['ail-sec', '2026-07-05', '2026-07-20']]);
  const due = drying({ today: '2026-07-05' });
  assert.deepEqual(due.due.map((deadline) => [deadline.seriesId, deadline.stopDate, deadline.dryingDays]), [['ail-sec', '2026-07-05', 15]]);
  const notification = dryingNotification(due.due);
  assert.equal(notification?.title, 'Alerte récolte');
  assert.equal(notification?.body, 'Cessez d’arroser avant la récolte : ail, planches 12 et 14 ; récolte attendue à partir du lundi 20 juillet.');
  assert.equal(notification?.url, '/irrigation/alertes-cultures?season=2026');
  assert.deepEqual(drying({ today: '2026-07-06', alerted: ['ail-sec'] }).due, [], 'pas de seconde alerte les jours suivants');
  assert.deepEqual(drying({ today: '2026-07-08' }).due.map((deadline) => deadline.seriesId), ['ail-sec'], 'une date passée part le premier matin qui la voit');
});

test('scénario 12 : ail récolté ou sans semaine de récolte, oignon en botte et aillet : aucune alerte de séchage', () => {
  const harvested = series({ id: 'ail-sec', plantId: 'p-ail', plantName: 'Ail', harvestWeeks: ['2026-W29'], harvestWeeksExpected: [HARVEST_WEEK] });
  const noWeek = series({ id: 'ail-sec', plantId: 'p-ail', plantName: 'Ail', harvestWeeksExpected: [] });
  const bunches = series({ id: 'oignons', plantId: 'p-oignon-botte', plantName: 'Oignon botte', harvestWeeksExpected: [HARVEST_WEEK] });
  const green = series({ id: 'aillet', plantId: 'p-aillet', plantName: 'Aillet', harvestWeeksExpected: [HARVEST_WEEK] });
  for (const item of [harvested, noWeek, bunches, green]) {
    const result = drying({ today: '2026-07-10', series: [item] });
    assert.deepEqual([result.due, result.upcoming], [[], []], item.id);
  }
  const past = series({ id: 'ail-sec', plantId: 'p-ail', plantName: 'Ail', harvestWeeksExpected: ['2026-W20'] });
  assert.deepEqual(drying({ today: '2026-07-10', series: [past] }).due, [], 'plus aucune semaine encore attendue');
});

test('la ferme corrige ou retire le délai d’une espèce ; les séries échues le même matin partent ensemble', () => {
  const at = '2026-11-02T08:00:00.000Z';
  assert.equal(resolveDryingDays({ plantId: 'p-ail', seriesId: 'x', frostRevisions: GARLIC_LINKS, dryingRevisions: [{ id: 'd1', plantId: 'p-ail', dryingDays: 10, recordedAt: at }], common: COMMON }), 10);
  assert.equal(resolveDryingDays({ plantId: 'p-ail', seriesId: 'x', frostRevisions: GARLIC_LINKS, dryingRevisions: [{ id: 'd1', plantId: 'p-ail', dryingDays: null, recordedAt: at }], common: COMMON }), null);
  assert.equal(resolveDryingDays({ plantId: 'p-ail', seriesId: 'x', frostRevisions: [], dryingRevisions: [], common: COMMON }), null, 'non rattachée : rien n’est deviné');

  const garlic = series({ id: 'ail-sec', plantId: 'p-ail', plantName: 'Ail', harvestWeeksExpected: [HARVEST_WEEK] });
  const white = series({ id: 'ail-blanc', plantId: 'p-ail', plantName: 'Ail', harvestWeeksExpected: [HARVEST_WEEK] });
  const melon = { ...series({ id: 'melons', plantId: 'p-melon', plantName: 'Melon', harvestWeeksExpected: ['2026-W29'], use: 'block' }) };
  const result = evaluateDrying({
    series: [garlic, white, melon],
    bedNamesBySeries: new Map([['ail-sec', ['14', '12']], ['ail-blanc', ['3']]]),
    frostRevisions: [...GARLIC_LINKS, link('p-melon', 'melon')],
    dryingRevisions: [],
    common: COMMON,
    today: '2026-07-06',
    alertedSeriesIds: new Set(),
  });
  assert.deepEqual(result.due.map((deadline) => deadline.seriesId), ['ail-blanc', 'ail-sec', 'melons']);
  assert.equal(dryingNotification(result.due)?.body,
    'Cessez d’arroser avant la récolte : ail, planches 3, 12 et 14 ; récolte attendue à partir du lundi 20 juillet. Melon, série melons en bloc ; récolte attendue…',
    'coupé au dernier mot pour tenir dans les 160 caractères du service d’envoi');
  assert.equal(dryingNotification([]), null);
});

/** Le jeudi 12 novembre 2026, à Lyon (45,76° N, 4,84° E). */
const THURSDAY = '2026-11-12';
const LOCATION = { latitude: 45.76, longitude: 4.84 };
const THRESHOLDS = { maxTemperatureCelsius: 24, radiationWattsPerSquareMeter: 400 };
const DAY_SECONDS = daylight(THURSDAY, LOCATION).dayLengthSeconds;
const energyFor = (watts: number) => watts * DAY_SECONDS / 1_000_000;

const slot = (options: Partial<SprinklerSlot> = {}): SprinklerSlot => ({
  slotKey: 'creneau-1@2026-11-12T09:00:00.000Z',
  startAt: '2026-11-12T09:00:00.000Z',
  sprinkler: true,
  beds: [{ bedName: '4', underShelter: true }],
  ...options,
});

function sprinkler(options: { maximum: number | null; watts: number | null; slots?: SprinklerSlot[]; alerted?: string[] }) {
  const evaluation = evaluateSprinklers({
    slots: options.slots ?? [slot()],
    forecasts: [{ date: THURSDAY, maximumTemperatureCelsius: options.maximum, solarEnergyMegajoulesPerSquareMeter: options.watts === null ? null : energyFor(options.watts), forecastedAt: '2026-11-11T05:15:00.000Z' }],
    thresholds: THRESHOLDS,
    location: LOCATION,
    alertedKeys: new Set(options.alerted ?? []),
  });
  return { evaluation, notifications: sprinklerNotifications(evaluation, THRESHOLDS) };
}

test('le jour se lit comme pour l’ET0 : à Lyon le 12 novembre, lever vers 7 h 40 et coucher vers 17 h 05, heure de Paris, à un quart d’heure près', () => {
  // Les éphémérides donnent 7 h 38 et 17 h 05 ; le modèle de la FAO, sans la réfraction, raccourcit le jour de quelques minutes.
  const sun = daylight(THURSDAY, LOCATION);
  assert.ok(sun.sunrise > '2026-11-12T06:23:00.000Z' && sun.sunrise < '2026-11-12T06:53:00.000Z', sun.sunrise);
  assert.ok(sun.sunset > '2026-11-12T15:50:00.000Z' && sun.sunset < '2026-11-12T16:20:00.000Z', sun.sunset);
  assert.ok(DAY_SECONDS > 9.2 * 3600 && DAY_SECONDS < 9.6 * 3600);
});

test('scénario 14 : aspersion de 10 h sous abri, maximale 18 °C, 500 W/m² : signalée (temps frais)', () => {
  const { evaluation, notifications } = sprinkler({ maximum: 18, watts: 500 });
  assert.deepEqual(evaluation.flags.map((flag) => [flag.cool, flag.overcast, Math.round(flag.radiationWattsPerSquareMeter ?? 0)]), [[true, false, 500]]);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].body, 'Aspersion à reconsidérer : jeudi 12 novembre 10 h, planche 4 (sous abri). Maximale prévue 18 °C (seuil : sous 24 °C).');
  assert.equal(notifications[0].url, '/irrigation/planning?season=2026&week=2026-11-09');
});

test('scénario 15 : maximale 26 °C, rayonnement moyen 300 W/m² : signalée (ciel couvert)', () => {
  const { notifications } = sprinkler({ maximum: 26, watts: 300 });
  assert.equal(notifications[0].body, 'Aspersion à reconsidérer : jeudi 12 novembre 10 h, planche 4 (sous abri). Ciel couvert prévu (rayonnement moyen 300 W/m², seuil : sous 400).');
  const both = sprinkler({ maximum: 18, watts: 220 });
  assert.equal(both.notifications[0].body,
    'Aspersion à reconsidérer : jeudi 12 novembre 10 h, planche 4 (sous abri). Maximale prévue 18 °C, ciel couvert prévu (rayonnement moyen 220 W/m²).',
    'avec les deux seuils, le texte ferait 184 caractères : il les laisse pour tenir dans les 160 du service d’envoi');
  assert.match(both.notifications[0].tag, /^crop-sprinkler:2026-11-12:[0-9a-f]{8}$/u, 'l’heure du créneau (« @ ») n’entre plus telle quelle dans l’étiquette');
});

test('scénario 16 : maximale 26 °C, rayonnement 450 W/m² : rien', () => {
  assert.deepEqual(sprinkler({ maximum: 26, watts: 450 }).evaluation.flags, []);
});

test('scénario 17 : une aspersion à 23 h n’est jamais jugée', () => {
  const night = slot({ slotKey: 'nuit', startAt: '2026-11-12T22:00:00.000Z' });
  assert.deepEqual(sprinkler({ maximum: 15, watts: 100, slots: [night] }).evaluation.flags, []);
  const dawn = slot({ slotKey: 'aube', startAt: '2026-11-12T05:30:00.000Z' });
  assert.deepEqual(sprinkler({ maximum: 15, watts: 100, slots: [dawn] }).evaluation.flags, [], '6 h 30, avant le lever');
});

test('scénario 18 : une aspersion en plein champ, un goutte-à-goutte sous abri ne sont jamais jugés', () => {
  const field = slot({ beds: [{ bedName: '7', underShelter: false }] });
  const drip = slot({ sprinkler: false });
  assert.deepEqual(sprinkler({ maximum: 15, watts: 100, slots: [field, drip] }).evaluation.flags, []);
  const mixed = slot({ beds: [{ bedName: '7', underShelter: false }, { bedName: '4', underShelter: true }] });
  assert.deepEqual(sprinkler({ maximum: 15, watts: 500, slots: [mixed] }).evaluation.flags.map((flag) => flag.bedNames), [['4']], 'seule la planche sous abri est nommée');
});

test('scénario 19 : sans énergie solaire prévue et à 26 °C, rien, et l’écran dit « ensoleillement non prévu »', () => {
  const { evaluation } = sprinkler({ maximum: 26, watts: null });
  assert.deepEqual(evaluation.flags, []);
  assert.deepEqual(evaluation.sunshineUnavailableDates, [THURSDAY]);
  assert.equal(sprinkler({ maximum: 18, watts: null }).evaluation.flags[0].cool, true, 'une seule des deux suffit');
  assert.deepEqual(sprinkler({ maximum: null, watts: 450 }).evaluation.flags, [], 'maximale absente, rayonnement au-dessus du seuil');
});

test('une seule alerte par créneau et par jour ; plusieurs créneaux le même jour dans une seule notification', () => {
  const afternoon = slot({ slotKey: 'creneau-2', startAt: '2026-11-12T13:30:00.000Z', beds: [{ bedName: '6', underShelter: true }, { bedName: '5', underShelter: true }] });
  const { notifications } = sprinkler({ maximum: 18, watts: 500, slots: [afternoon, slot()] });
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].body, /^Aspersion à reconsidérer : jeudi 12 novembre 10 h, planche 4 \(sous abri\) et 14 h 30, planches 5 et 6 \(sous abri\)\. /u);
  const again = sprinkler({ maximum: 18, watts: 500, alerted: [sprinklerAlertKey(slot().slotKey, THURSDAY)] });
  assert.equal(again.evaluation.flags[0].alreadyAlerted, true);
  assert.deepEqual(again.notifications, []);
});
