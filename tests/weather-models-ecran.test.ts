import assert from 'node:assert/strict';
import test from 'node:test';
import { FORECAST_MODELS, forecastModelSource, forecastModelsCovering } from '../lib/domain/weather/forecast-models.ts';
import {
  AUTOMATIC_FORECAST_CHOICE,
  FORECAST_MODEL_SETTING_TEXT,
  forecastModelFacts,
  forecastModelOptions,
  forecastModelSettingView,
  forecastModelSummary,
  selectedForecastChoice,
} from '../lib/domain/weather/forecast-model-setting.ts';

/**
 * La météo multi-modèles, PR 3 : ce que montre le réglage « Modèle de
 * prévision » (docs/weather-models-contract.md, § 3 règles 3, 6, 10 et 12,
 * § 8 point 6, § 11 point 5 ; D-347). La liste n'est pas recopiée (§ 4) :
 * les tests la lisent du code. L'absence en démonstration est tenue par
 * tests/db/forecast-model-reglage.test.ts (`forecastModelsAvailable`) ; le
 * geste, par le parcours P72.
 */

const RENNES = { latitude: 48.1113, longitude: -1.68 };
const MONTREAL = { latitude: 45.5, longitude: -73.57 };

test('les choix d’un lieu : « Automatique » d’abord, puis les modèles qui le couvrent, dans l’ordre de la liste', () => {
  const options = forecastModelOptions(RENNES);
  assert.deepEqual(options[0], { value: AUTOMATIC_FORECAST_CHOICE, label: 'Automatique' });
  assert.deepEqual(options.slice(1), forecastModelsCovering(RENNES).map((model) => ({ value: model.id, label: model.label })));
  // Loin de l'Europe, aucun modèle à zone n'est offert (règle 3).
  const far = forecastModelOptions(MONTREAL).map((option) => option.value);
  for (const model of FORECAST_MODELS.filter((entry) => entry.zone !== null)) assert.ok(!far.includes(model.id), model.id);
});

test('le choix montré : le modèle enregistré s’il est offert au lieu, sinon « Automatique » (règle 9)', () => {
  const zoned = FORECAST_MODELS.find((model) => model.zone !== null);
  assert.ok(zoned);
  assert.equal(selectedForecastChoice(null, forecastModelOptions(RENNES)), AUTOMATIC_FORECAST_CHOICE);
  assert.equal(selectedForecastChoice(zoned.id, forecastModelOptions(RENNES)), zoned.id);
  assert.equal(selectedForecastChoice(zoned.id, forecastModelOptions(MONTREAL)), AUTOMATIC_FORECAST_CHOICE);
  assert.equal(selectedForecastChoice('modele_retire', forecastModelOptions(RENNES)), AUTOMATIC_FORECAST_CHOICE);
});

test('les faits d’un modèle : fournisseur, maille, portée, et le complément au-delà (règles 6 et 10)', () => {
  assert.equal(forecastModelFacts(AUTOMATIC_FORECAST_CHOICE), 'Le module lit la prévision comme il l’a toujours fait.');
  assert.equal(forecastModelFacts('modele_retire'), '');
  for (const model of FORECAST_MODELS) {
    const facts = forecastModelFacts(model.id);
    assert.match(facts, new RegExp(`prévoit environ ${model.measuredRangeDays} jours`), model.id);
    assert.ok(facts.includes(model.resolution), model.id);
    assert.doesNotMatch(facts, /meilleur|plus précis|fiable|recommand/i, model.id);
    if (model.id === 'best_match') {
      assert.doesNotMatch(facts, /au-delà/, 'Automatique d’Open-Meteo ne se complète pas lui-même');
    } else {
      assert.ok(facts.startsWith(`${model.provider} · `), model.id);
      assert.match(facts, /au-delà les jours viennent d’« Automatique d’Open-Meteo »\.$/, model.id);
    }
  }
});

test('la phrase de la règle 12, mot pour mot, et aucune affirmation de qualité dans les textes du réglage', () => {
  assert.equal(FORECAST_MODEL_SETTING_TEXT.lead, 'Les alertes météo et les prévisions de la ferme utiliseront ce modèle.');
  for (const text of Object.values(FORECAST_MODEL_SETTING_TEXT)) assert.doesNotMatch(text, /meilleur|plus précis|fiable|recommand/i);
});

test('règle 6 : la carte dit jusqu’à quel jour les prévisions gardées viennent du modèle, puis d’« Automatique d’Open-Meteo »', () => {
  const days = [
    { date: '2026-11-26', source: forecastModelSource('meteofrance_seamless') },
    { date: '2026-11-27', source: forecastModelSource('meteofrance_seamless') },
    { date: '2026-11-28', source: forecastModelSource('best_match') },
  ];
  const view = forecastModelSettingView('meteofrance_seamless', { forecastDays: days, lastChange: null }, '2026-11-26');
  assert.equal(view.completion, 'Prévisions gardées : ce modèle jusqu’au ven. 27 nov., puis « Automatique d’Open-Meteo ».');
  assert.equal(view.returnNotice, null);
  // Aucun jour complété, « Automatique d'Open-Meteo » lui-même, ou « Automatique » : rien à dire.
  assert.equal(forecastModelSettingView('meteofrance_seamless', { forecastDays: days.slice(0, 2), lastChange: null }, '2026-11-26').completion, null);
  assert.equal(forecastModelSettingView('best_match', { forecastDays: days, lastChange: null }, '2026-11-26').completion, null);
  assert.equal(forecastModelSettingView(null, { forecastDays: days, lastChange: null }, '2026-11-26').completion, null);
});

test('règle 9 : le retour du module à « Automatique » se dit la semaine qui suit, sans nommer un modèle retiré', () => {
  const back = (previousModelId: string, dateKey: string, byModule = true) => forecastModelSettingView(
    null,
    { forecastDays: [], lastChange: { byModule, previousModelId, dateKey } },
    '2026-11-26',
  ).returnNotice;
  assert.equal(back('meteofrance_seamless', '2026-11-25'), '« Météo-France (AROME puis ARPEGE) » ne couvre pas le lieu de la ferme : depuis le mer. 25 nov., la ferme lit de nouveau « Automatique ».');
  assert.equal(back('modele_retire', '2026-11-19'), 'Le modèle choisi n’est plus proposé : depuis le jeu. 19 nov., la ferme lit de nouveau « Automatique ».');
  // Plus d'une semaine après, ou un retour fait par une personne : rien.
  assert.equal(back('modele_retire', '2026-11-18'), null);
  assert.equal(back('meteofrance_seamless', '2026-11-25', false), null);
  // Un modèle choisi depuis efface le message.
  assert.equal(forecastModelSettingView('icon_seamless', { forecastDays: [], lastChange: { byModule: true, previousModelId: 'meteofrance_seamless', dateKey: '2026-11-25' } }, '2026-11-26').returnNotice, null);
});

test('la ligne du pli dit le modèle gardé, tel que la liste le nomme (F1030)', () => {
  const options = forecastModelOptions(RENNES);
  assert.equal(forecastModelSummary(AUTOMATIC_FORECAST_CHOICE, options), 'Automatique');
  assert.equal(forecastModelSummary('meteofrance_seamless', options), 'Météo-France (AROME puis ARPEGE)');
});
