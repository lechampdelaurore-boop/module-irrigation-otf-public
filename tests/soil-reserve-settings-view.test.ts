import assert from 'node:assert/strict';
import test from 'node:test';
import type { Plot, Zone } from '../lib/domain/domain.ts';
import { parseDecimal, parseShare, shareLabel, soilSettingsView } from '../lib/domain/soil-reserve/settings-view.ts';
import { DEFAULT_SOIL_SETTINGS, type SoilSettingsRevision } from '../lib/domain/soil-reserve/soil.ts';
import { FARM_SOIL, soilRecord } from './support/soil-reserve-fixtures.ts';

/**
 * Les réglages de la réserve du sol tels que l'écran les montre (5 ter,
 * PR 3a) : la saisie qui vaut aujourd'hui suit la même règle que le calcul (le
 * jour le plus tardif, puis l'enregistrement le plus récent) ; une saisie à
 * venir est montrée sans compter ; la valeur propre d'un jardin reste à part
 * de celle de sa parcelle ; sans réglage, l'exploitation part des valeurs par
 * défaut, seuil selon la culture.
 */

const zone = (id: string, seasons: number[]): Zone => ({ id, name: id, area: 100, seasons }) as Zone;
const plot = (id: string, zoneId: string, mode: Plot['mode'], seasons: number[]): Plot =>
  ({ id, zoneId, name: id, mode, length: 10, width: 10, area: 100, seasons }) as Plot;

const ZONES = [zone('parcelle', [2026]), zone('ancienne', [2025])];
const PLOTS = [plot('jardin', 'parcelle', 'garden', [2026]), plot('abri', 'parcelle', 'greenhouse', [2026]), plot('vieux', 'parcelle', 'garden', [2025])];

const revision = (overrides: Partial<SoilSettingsRevision>): SoilSettingsRevision => ({
  ...DEFAULT_SOIL_SETTINGS,
  effectiveFrom: '2026-01-01',
  recordedAt: '2026-01-01T08:00:00.000Z',
  ...overrides,
});

test('une part se saisit en fraction ou en décimal, à virgule ou à point, et se relit en fraction simple', () => {
  assert.equal(parseShare('2/3'), 2 / 3);
  assert.equal(parseShare(' 1 / 2 '), 0.5);
  assert.equal(parseShare('0,5'), 0.5);
  assert.equal(parseShare('0.75'), 0.75);
  assert.equal(parseShare('1/0'), null);
  assert.equal(parseShare('deux tiers'), null);
  assert.equal(parseDecimal('62'), 62);
  assert.equal(parseDecimal('-1,5'), -1.5);
  assert.equal(parseDecimal(''), null);
  assert.equal(parseDecimal('12 mm'), null);
  assert.equal(shareLabel(2 / 3), '2/3');
  assert.equal(shareLabel(0.25), '1/4');
  assert.equal(shareLabel(0.6), '0,6');
});

test('par parcelle et par jardin de la saison : la saisie qui vaut aujourd’hui, l’histoire la plus récente d’abord, la RFU du sol calculée', () => {
  const older = soilRecord({ labRfuMmPerMeter: 70, stoneSharePercent: null, effectiveFrom: '2025-03-01', recordedAt: '2025-03-01T08:00:00.000Z' });
  const sameDayLater = soilRecord({ ...FARM_SOIL, recordedAt: '2026-01-01T09:00:00.000Z' });
  const sameDayEarlier = soilRecord({ labRfuMmPerMeter: 40, recordedAt: '2026-01-01T07:00:00.000Z' });
  const future = soilRecord({ labRfuMmPerMeter: 90, effectiveFrom: '2026-12-01', recordedAt: '2026-06-01T08:00:00.000Z' });
  const own = soilRecord({ plotId: 'abri', labRfuMmPerMeter: 250, stoneSharePercent: 0 });
  const view = soilSettingsView({
    zones: ZONES,
    plots: PLOTS,
    season: 2026,
    records: [older, sameDayEarlier, future, sameDayLater, own],
    settings: [],
    today: '2026-06-10',
  });

  assert.deepEqual(view.zones.map((item) => item.zoneId), ['parcelle']);
  const [parcelle] = view.zones;
  assert.deepEqual(parcelle.plots.map((item) => [item.plotId, item.sheltered]), [['jardin', false], ['abri', true]]);
  assert.equal(parcelle.soil.current?.record, sameDayLater);
  assert.equal(parcelle.soil.current?.soilRfuMmPerMeter, 51);
  assert.equal(parcelle.soil.current?.warning, null);
  assert.deepEqual(parcelle.soil.history.map((item) => item.record), [future, sameDayLater, sameDayEarlier, older]);
  assert.equal(parcelle.soil.history.at(-1)?.soilRfuMmPerMeter, 70, 'une part de cailloux non renseignée compte pour 0');

  const [jardin, abri] = parcelle.plots;
  assert.equal(jardin.soil.current, null, 'un jardin sans valeur propre n’en montre pas : l’écran rappelle celle de sa parcelle');
  assert.deepEqual(jardin.soil.history, []);
  assert.equal(abri.soil.current?.record, own);
  assert.match(abri.soil.current?.warning ?? '', /250 mm\/m/);
});

test('sans réglage, l’exploitation part des valeurs par défaut ; ensuite, le réglage qui vaut aujourd’hui, l’histoire comprise', () => {
  const empty = soilSettingsView({ zones: ZONES, plots: PLOTS, season: 2026, records: [], settings: [], today: '2026-06-10' });
  assert.equal(empty.farm.isDefault, true);
  assert.deepEqual(empty.farm.current, DEFAULT_SOIL_SETTINGS);
  assert.deepEqual(empty.farm.history, []);
  assert.equal(empty.zones[0].soil.current, null);

  const farm = revision({ threshold: { mode: 'farm', percent: 50 }, effectiveFrom: '2026-05-01', recordedAt: '2026-05-01T08:00:00.000Z' });
  const back = revision({ effectiveFrom: '2026-07-01', recordedAt: '2026-06-09T08:00:00.000Z' });
  const view = soilSettingsView({ zones: ZONES, plots: PLOTS, season: 2026, records: [], settings: [revision({}), back, farm], today: '2026-06-10' });
  assert.equal(view.farm.isDefault, false);
  assert.deepEqual(view.farm.current, { threshold: { mode: 'farm', percent: 50 }, surface: DEFAULT_SOIL_SETTINGS.surface, plasticMulchRainShare: 1 });
  assert.deepEqual(view.farm.history.map((item) => item.effectiveFrom), ['2026-07-01', '2026-05-01', '2026-01-01']);
});
