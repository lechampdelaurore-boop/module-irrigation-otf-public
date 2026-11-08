import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CROP_ALERT_SETTINGS } from '../lib/domain/crop-alerts/settings.ts';
import { frostAlertKey } from '../lib/domain/crop-alerts/frost.ts';
import { dayText } from '../lib/domain/crop-alerts/text.ts';
import { cropAlertsScreen } from '../lib/domain/crop-alerts/view.ts';
import type { DryingRevision } from '../lib/domain/crop-alerts/thresholds.ts';
import { COMMON, link, MONDAY, MORNING, planting, series, TUESDAY, WEDNESDAY } from './support/crop-alerts-fixtures.ts';

/**
 * L'encart « Alertes cultures » (docs/weather-crop-alerts-contract.md,
 * « L'écran ») : la table des seuils des cultures présentes ou à venir, les
 * cultures sans seuil, les délais de séchage et les prochaines échéances.
 */

const common = [...COMMON.values()].map((entry) => ({ ...entry, confidence: 'bonne', source: 'Relevé du 6 novembre 2026' }));
const LYON = { latitude: 45.76, longitude: 4.84 };

const farm = {
  season: 2026,
  series: [
    series({ id: 'tomates', plantId: 'p-tomate', plantName: 'Tomate' }),
    series({ id: 'tomates-tunnel', plantId: 'p-tomate', plantName: 'Tomate' }),
    series({ id: 'carottes', plantId: 'p-carotte', plantName: 'Carotte' }),
    series({ id: 'fraises', plantId: 'p-fraisier', plantName: 'Fraisier' }),
    series({ id: 'radis', plantId: 'p-radis', plantName: 'Radis', harvestWeeksExpected: ['2026-W40'] }),
    series({ id: 'ail', plantId: 'p-ail', plantName: 'Ail', harvestWeeksExpected: ['2027-W29'] }),
    series({ id: 'mache', plantId: 'p-mache', plantName: 'Mâche' }),
    series({ id: 'oignons-2027', plantId: 'p-oignon', plantName: 'Oignon', season: 2027, harvestWeeksExpected: ['2027-W30'] }),
  ],
  tasks: [
    planting('tomates', '2026-W40'),
    planting('tomates-tunnel', '2026-W40'),
    planting('carottes', '2026-W40'),
    planting('fraises', '2026-W30'),
    planting('radis', '2026-W36'),
    planting('ail', '2026-W44'),
    planting('mache', '2026-W48', false),
    planting('oignons-2027', '2027-W10', false),
  ],
};

const tomatoLink = link('p-tomate', 'tomate');

function view(overrides: Partial<Parameters<typeof cropAlertsScreen>[0]> = {}) {
  return cropAlertsScreen({
    today: MONDAY,
    settings: { ...DEFAULT_CROP_ALERT_SETTINGS },
    season: farm.season,
    series: farm.series,
    tasks: farm.tasks,
    shelteredSeriesIds: new Set(['tomates-tunnel']),
    bedNamesBySeries: new Map([['ail', ['12', '14']]]),
    common,
    frostRevisions: [
      tomatoLink,
      link('p-carotte', 'carotte'),
      link('p-fraisier', 'fraisier'),
      link('p-ail', 'ail'),
      link('p-tomate', 'tomate', { seriesId: 'tomates-tunnel', damageCelsius: -1 }),
    ],
    dryingRevisions: [],
    forecasts: [
      { date: MONDAY, minimumTemperatureCelsius: 6, maximumTemperatureCelsius: 12, solarEnergyMegajoulesPerSquareMeter: 6, forecastedAt: MORNING },
      { date: TUESDAY, minimumTemperatureCelsius: 1.5, maximumTemperatureCelsius: 9, solarEnergyMegajoulesPerSquareMeter: null, forecastedAt: MORNING },
    ],
    alertedFrostKeys: new Set(),
    alertedSprinklerKeys: new Set(),
    alertedDryingSeries: new Set(),
    sprinklerSlots: [],
    location: LYON,
    ...overrides,
  });
}

test('la table des seuils : les espèces présentes ou à venir de la saison, l’exception de série à part, le curseur dans le seuil d’alerte', () => {
  const screen = view({ settings: { ...DEFAULT_CROP_ALERT_SETTINGS, frostOffsetCelsius: 1.5 } });
  assert.deepEqual(screen.frost.map((row) => [row.name, row.damageCelsius, row.marginCelsius, row.alertCelsius, row.source]), [
    ['Ail', -10, 2, -6.5, 'common'],
    ['Carotte', -6, 2, -2.5, 'common'],
    ['Tomate', 0, 3, 4.5, 'common'],
    ['Tomate (série tomates-tunnel)', -1, 3, 3.5, 'farm'],
  ]);
  const tomato = screen.frost.find((row) => row.name === 'Tomate');
  assert.deepEqual(tomato?.series.map((item) => item.id), ['tomates', 'tomates-tunnel']);
  assert.equal(tomato?.common?.confidence, 'bonne');
  // Le radis est fini, l'oignon est d'une autre saison : ni l'un ni l'autre.
  assert.deepEqual(screen.withoutThreshold.map((row) => [row.name, row.status, row.presentToday]), [
    ['Fraisier', 'none', true],
    ['Mâche', 'missing', false],
  ]);
});

test('les prochaines échéances : le gel de mardi nomme ses cultures, dit ce qui est déjà annoncé, et le jour sans prévision', () => {
  const screen = view({ alertedFrostKeys: new Set([frostAlertKey('p-tomate', tomatoLink.id, TUESDAY)]) });
  assert.equal(screen.upcoming.frost.length, 1);
  const tuesday = screen.upcoming.frost[0];
  assert.equal(tuesday.date, TUESDAY);
  assert.deepEqual(tuesday.crops.map((crop) => [crop.name, crop.alertCelsius, crop.underShelter, crop.alreadyAlerted]), [
    ['Tomate', 3, false, true],
    ['Tomate (série tomates-tunnel)', 2, true, false],
  ]);
  assert.equal(screen.upcoming.frostUnavailable, `Prévision indisponible pour le ${dayText(WEDNESDAY)}.`);
});

test('le séchage : délai du jeu commun, corrigé ou retiré par la ferme ; la date d’arrêt à venir est listée', () => {
  const removed: DryingRevision = { id: 'd-1', plantId: 'p-ail', dryingDays: null, recordedAt: '2026-11-02T08:00:00.000Z' };
  assert.deepEqual(view().drying.map((row) => [row.name, row.dryingDays, row.origin]), [['Ail', 15, 'common']]);
  const upcoming = view().upcoming.drying;
  assert.deepEqual(upcoming.map((deadline) => [deadline.plantName, deadline.stopDate, deadline.bedNames]), [['Ail', '2027-07-04', ['12', '14']]]);
  const screen = view({ dryingRevisions: [removed, { id: 'd-2', plantId: 'p-carotte', dryingDays: 5, recordedAt: '2026-11-02T08:00:00.000Z' }] });
  assert.deepEqual(screen.drying.map((row) => [row.name, row.dryingDays, row.origin]), [['Ail', null, 'farm'], ['Carotte', 5, 'farm']]);
  assert.equal(screen.upcoming.drying.length, 1);
  assert.ok(screen.speciesWithoutDrying.some((plant) => plant.name === 'Ail'));
});

test('les aspersions : sans lieu localisé, rien n’est jugé ; sans énergie solaire prévue, l’écran dit « ensoleillement non prévu »', () => {
  assert.equal(view({ location: null }).upcoming.sprinklerUnjudged, true);
  const screen = view({
    sprinklerSlots: [{ slotKey: 'p1@2026-11-10T09:00:00.000Z', startAt: '2026-11-10T09:00:00.000Z', sprinkler: true, beds: [{ bedName: 'T01', underShelter: true }] }],
  });
  assert.equal(screen.upcoming.sprinklerUnjudged, false);
  assert.deepEqual(screen.upcoming.sprinkler.map((flag) => [flag.date, flag.cool, flag.overcast, flag.bedNames]), [[TUESDAY, true, false, ['T01']]]);
  assert.equal(screen.upcoming.sunshineUnavailable, 'Ensoleillement non prévu le mardi 10 novembre : seule la maximale y est jugée.');
});
