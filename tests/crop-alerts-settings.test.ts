import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CROP_ALERT_SETTINGS, validateCropAlertSettings, validateDryingDays, validateFrostLink } from '../lib/domain/crop-alerts/settings.ts';
import { resolveFrostThreshold } from '../lib/domain/crop-alerts/thresholds.ts';
import { COMMON, link } from './support/crop-alerts-fixtures.ts';

/**
 * Les réglages de l'exploitation et les saisies de la ferme
 * (docs/weather-crop-alerts-contract.md, « Le curseur de microclimat »,
 * « Les données »).
 */

test('sans réglage : les trois alertes actives, horizon 3 jours, curseur à 0, aspersion sous 24 °C ou 400 W/m²', () => {
  assert.deepEqual(validateCropAlertSettings({}), { ok: true, settings: DEFAULT_CROP_ALERT_SETTINGS });
  assert.deepEqual(DEFAULT_CROP_ALERT_SETTINGS, {
    frostActive: true, dryingActive: true, sprinklerActive: true, horizonDays: 3, frostOffsetCelsius: 0,
    frostMarginSensitiveCelsius: 3, frostMarginHardyCelsius: 2,
    sprinklerMaxTemperatureCelsius: 24, sprinklerRadiationWattsPerSquareMeter: 400,
  });
});

test('le curseur de microclimat va de −5 à +5 °C par pas de 0,5 °C', () => {
  for (const value of ['-5', '+2', '2,5', '−1,5', 5]) {
    assert.equal(validateCropAlertSettings({ frostOffsetCelsius: value }).ok, true, String(value));
  }
  for (const value of ['5,5', '-6', '0,3', 'froid']) {
    const result = validateCropAlertSettings({ frostOffsetCelsius: value });
    assert.equal(result.ok, false, value);
    if (!result.ok) assert.equal(result.refusals[0].message, 'Le décalage des seuils de gel va de −5 à +5 °C, par pas de 0,5 °C.');
  }
});

test('les deux marges de gel vont de 0 à 5 °C par pas de 0,5 °C et se règlent l’une sans l’autre (P44)', () => {
  const result = validateCropAlertSettings({ frostMarginSensitiveCelsius: '4,5', frostMarginHardyCelsius: 0 });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual([result.settings.frostMarginSensitiveCelsius, result.settings.frostMarginHardyCelsius], [4.5, 0]);
  for (const value of ['5,5', '-1', '0,3', 'froid']) {
    const sensitive = validateCropAlertSettings({ frostMarginSensitiveCelsius: value });
    assert.equal(sensitive.ok, false, value);
    if (!sensitive.ok) assert.equal(sensitive.refusals[0].message, 'La marge d’une culture sensible va de 0 à 5 °C, par pas de 0,5 °C.');
    const hardy = validateCropAlertSettings({ frostMarginHardyCelsius: value });
    if (!hardy.ok) assert.equal(hardy.refusals[0].message, 'La marge d’une culture rustique va de 0 à 5 °C, par pas de 0,5 °C.');
    else assert.fail(value);
  }
});

test('un horizon hors de 1 à 7 jours, des seuils d’aspersion hors bornes sont refusés en disant pourquoi', () => {
  const result = validateCropAlertSettings({ horizonDays: 8, sprinklerMaxTemperatureCelsius: '45', sprinklerRadiationWattsPerSquareMeter: '400,5', frostActive: 'oui' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.refusals.map((refusal) => refusal.input), ['frostActive', 'horizonDays', 'sprinklerMaxTemperatureCelsius', 'sprinklerRadiationWattsPerSquareMeter']);
  const valid = validateCropAlertSettings({ horizonDays: '7', sprinklerMaxTemperatureCelsius: '22,5', sprinklerRadiationWattsPerSquareMeter: 350, sprinklerActive: false });
  assert.deepEqual(valid.ok && [valid.settings.horizonDays, valid.settings.sprinklerMaxTemperatureCelsius, valid.settings.sprinklerRadiationWattsPerSquareMeter, valid.settings.sprinklerActive], [7, 22.5, 350, false]);
});

test('le rattachement d’une espèce : une entrée du jeu commun, un seuil propre, ou rien (« sans seuil »)', () => {
  const keys = new Set(COMMON.keys());
  assert.deepEqual(validateFrostLink({ commonKey: 'tomate' }, keys), { ok: true, commonKey: 'tomate', damageCelsius: null });
  assert.deepEqual(validateFrostLink({ commonKey: 'tomate', damageCelsius: '2' }, keys), { ok: true, commonKey: 'tomate', damageCelsius: 2 });
  assert.deepEqual(validateFrostLink({ damageCelsius: '-9,5' }, keys), { ok: true, commonKey: null, damageCelsius: -9.5 });
  assert.deepEqual(validateFrostLink({}, keys), { ok: true, commonKey: null, damageCelsius: null });
  assert.deepEqual(validateFrostLink({ commonKey: 'mandragore' }, keys), { ok: false, message: 'Cette culture n’est pas dans le jeu commun.' });
  assert.equal(validateFrostLink({ damageCelsius: '-31' }, keys).ok, false);
  assert.equal(validateFrostLink({ damageCelsius: '-2,2' }, keys).ok, false);
});

test('un délai de séchage : un nombre entier de jours de 1 à 60 ; vide, il retire le délai', () => {
  assert.deepEqual(validateDryingDays('15'), { ok: true, dryingDays: 15 });
  assert.deepEqual(validateDryingDays(''), { ok: true, dryingDays: null });
  assert.deepEqual(validateDryingDays('0'), { ok: false, message: 'Le délai de séchage est un nombre entier de jours, de 1 à 60.' });
  assert.equal(validateDryingDays('7,5').ok, false);
});

test('la révision la plus récente fait foi ; l’exception de série prime sur l’espèce ; rien n’est deviné', () => {
  const first = link('p-chou', 'tomate', { recordedAt: '2026-11-01T08:00:00.000Z' });
  const second = link('p-chou', 'carotte', { recordedAt: '2026-11-03T08:00:00.000Z' });
  const exception = link('p-chou', null, { seriesId: 's2', recordedAt: '2026-11-02T08:00:00.000Z' });
  const resolve = (seriesId: string) => resolveFrostThreshold({ plantId: 'p-chou', seriesId, revisions: [second, first, exception], common: COMMON });
  assert.deepEqual(resolve('s1'), { subjectKey: 'p-chou', subjectVersion: second.id, status: 'threshold', damageCelsius: -6, source: 'common', commonKey: 'carotte' });
  assert.deepEqual(resolve('s2'), { subjectKey: 'p-chou:s2', subjectVersion: exception.id, status: 'none', damageCelsius: null, source: null, commonKey: null });
  assert.equal(resolveFrostThreshold({ plantId: 'p-inconnue', seriesId: 's1', revisions: [first], common: COMMON }).status, 'missing');
});
