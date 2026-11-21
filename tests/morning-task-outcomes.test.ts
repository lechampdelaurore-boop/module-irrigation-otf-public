import assert from 'node:assert/strict';
import test from 'node:test';
import {
  morningTaskOutcomes,
  weatherFailureKind,
  type MorningRunReport,
} from '../lib/domain/operations/morning-task-outcomes.ts';
import { WeatherProviderError } from '../lib/domain/weather/weather-provider.ts';

/**
 * Ce que le matin dit de chacune de ses tâches (4.5, PR 1 ;
 * docs/tranche-4-contract.md, F560, F602) : une exécution n'est réussie que
 * si elle a tout fait, et son résumé ne porte que des nombres et des classes
 * d'erreur.
 */

const ALL_DONE: MorningRunReport = {
  weather: { status: 'completed', locations: 2, skippedBackoff: 0, forecastFailures: [], reanalysisFailures: [] },
  planning: { failed: 0 },
  cropWater: { failed: 0 },
  soilReserve: { failed: 0 },
  cropDrying: { failed: 0 },
  otfVault: { status: 'done', unreadable: 0 },
  farmErasure: { due: 0, erased: 0, unfinished: 0, failures: [] },
};

const byTask = (report: MorningRunReport) => Object.fromEntries(
  morningTaskOutcomes(report).map((outcome) => [outcome.task, outcome.successful ? 'réussie' : outcome.error]),
);

test('un matin complet : les cinq tâches réussies', () => {
  assert.deepEqual(byTask(ALL_DONE), {
    'weather-forecast': 'réussie',
    'weather-reanalysis': 'réussie',
    'morning-calculation': 'réussie',
    'otf-vault-morning': 'réussie',
    'farm-erasure': 'réussie',
  });
});

test('le matin du 14 novembre 2026 : les prévisions passent, la réanalyse non, et cela se dit à part', () => {
  const outcomes = byTask({
    ...ALL_DONE,
    weather: { status: 'completed', locations: 1, skippedBackoff: 0, forecastFailures: [], reanalysisFailures: ['network'] },
  });
  assert.equal(outcomes['weather-forecast'], 'réussie');
  assert.equal(outcomes['weather-reanalysis'], '1 lieu sur 1 sans pluie estimée (réseau)');
});

test('un lieu sur deux sans prévisions, et des classes d’erreur comptées', () => {
  const outcomes = byTask({
    ...ALL_DONE,
    weather: { status: 'completed', locations: 3, skippedBackoff: 0, forecastFailures: ['timeout'], reanalysisFailures: ['network', 'network', 'server'] },
  });
  assert.equal(outcomes['weather-forecast'], '1 lieu sur 3 sans prévisions (délai dépassé)');
  assert.equal(outcomes['weather-reanalysis'], '3 lieux sur 3 sans pluie estimée (réseau ×2, erreur du fournisseur)');
});

test('une ferme remise à plus tard par la limite du fournisseur n’est pas une réussite', () => {
  const outcomes = byTask({
    ...ALL_DONE,
    weather: { status: 'completed', locations: 1, skippedBackoff: 2, forecastFailures: [], reanalysisFailures: [] },
  });
  assert.equal(outcomes['weather-forecast'], '2 fermes remises à plus tard (limite du fournisseur)');
  assert.equal(outcomes['weather-reanalysis'], '2 fermes remises à plus tard (limite du fournisseur)');
});

test('le calcul du matin manqué dès qu’une ferme échoue, étape par étape', () => {
  assert.equal(
    byTask({ ...ALL_DONE, planning: { failed: 1 }, soilReserve: { failed: 2 } })['morning-calculation'],
    'planning : 1 ferme en échec ; réserve du sol : 2 fermes en échec',
  );
  assert.equal(byTask({ ...ALL_DONE, cropDrying: { failed: 1 } })['morning-calculation'], 'séchage avant récolte : 1 ferme en échec');
});

test('le coffre : endormi sans clé, c’est une réussite ; illisible ou en erreur, c’est un manque', () => {
  assert.equal(byTask({ ...ALL_DONE, otfVault: { status: 'dormant' } })['otf-vault-morning'], 'réussie');
  assert.equal(byTask({ ...ALL_DONE, otfVault: { status: 'done', unreadable: 2 } })['otf-vault-morning'], '2 raccordements illisibles');
  assert.equal(byTask({ ...ALL_DONE, otfVault: { status: 'done', unreadable: 1 } })['otf-vault-morning'], '1 raccordement illisible');
  assert.equal(byTask({ ...ALL_DONE, otfVault: { status: 'unavailable' } })['otf-vault-morning'], 'clé maîtresse illisible : coffre hors d\'usage');
  assert.equal(byTask({ ...ALL_DONE, otfVault: { status: 'failed' } })['otf-vault-morning'], 'erreur du coffre');
});

test('l’effacement des fermes : réussi quand aucune demande échue ne reste à effacer, sans demande comme avec', () => {
  assert.equal(byTask({ ...ALL_DONE, farmErasure: { due: 2, erased: 2, unfinished: 0, failures: [] } })['farm-erasure'], 'réussie');
  assert.equal(
    byTask({ ...ALL_DONE, farmErasure: { due: 3, erased: 1, unfinished: 2, failures: [] } })['farm-erasure'],
    '2 effacements commencés, à finir au prochain passage',
    'arrêté par la borne du passage : la promesse des sept jours n’est pas tenue ce matin-là',
  );
  assert.equal(
    byTask({ ...ALL_DONE, farmErasure: { due: 2, erased: 0, unfinished: 1, failures: ['Error'] } })['farm-erasure'],
    '1 effacement en échec (erreur Error) ; 1 effacement commencé, à finir au prochain passage',
  );
  assert.equal(
    byTask({ ...ALL_DONE, farmErasure: { due: 0, erased: 0, unfinished: 0, failures: ['unknown'] } })['farm-erasure'],
    '1 effacement en échec (erreur inconnue)',
  );
});

test('une autre exécution tient le verrou : rien n’est enregistré, c’est elle qui le dira', () => {
  assert.deepEqual(morningTaskOutcomes({
    weather: { status: 'already-running', locations: 0, skippedBackoff: 0, forecastFailures: [], reanalysisFailures: [] },
    planning: null, cropWater: null, soilReserve: null, cropDrying: null, otfVault: null, farmErasure: null,
  }), []);
});

test('une route interrompue : ce qui a eu lieu compte, le reste est manqué', () => {
  assert.deepEqual(byTask({ interruptedBy: 'TypeError' }), {
    'weather-forecast': 'interrompu avant la fin (erreur TypeError)',
    'weather-reanalysis': 'interrompu avant la fin (erreur TypeError)',
    'morning-calculation': 'interrompu avant la fin (erreur TypeError)',
    'otf-vault-morning': 'interrompu avant la fin (erreur TypeError)',
    'farm-erasure': 'interrompu avant la fin (erreur TypeError)',
  }, 'interrompue dans la météo');
  assert.deepEqual(byTask({ weather: ALL_DONE.weather, planning: { failed: 0 }, interruptedBy: 'Error' }), {
    'weather-forecast': 'réussie',
    'weather-reanalysis': 'réussie',
    'morning-calculation': 'interrompu avant la fin (erreur Error)',
    'otf-vault-morning': 'interrompu avant la fin (erreur Error)',
    'farm-erasure': 'interrompu avant la fin (erreur Error)',
  }, 'interrompue après le planning');
});

test('aucun résumé ne porte un message, une adresse ou une valeur', () => {
  const message = 'fetch failed https://archive-api.open-meteo.com/v1/archive?latitude=46.42&longitude=3.06 token=abc';
  const kind = weatherFailureKind(new WeatherProviderError(message, { kind: 'network', endpoint: 'reanalysis' }));
  assert.equal(kind, 'network');
  assert.equal(weatherFailureKind(new Error(message)), 'unknown');
  assert.equal(weatherFailureKind('texte'), 'unknown');
  const summaries = morningTaskOutcomes({
    ...ALL_DONE,
    weather: { status: 'completed', locations: 1, skippedBackoff: 0, forecastFailures: ['unknown'], reanalysisFailures: [kind] },
    interruptedBy: message,
  }).map((outcome) => outcome.error ?? '');
  assert.deepEqual(summaries.filter((summary) => /https?:|latitude|token|=|\d+\.\d+/.test(summary)), []);
  assert.equal(
    byTask({ interruptedBy: 'Error: jeton abc' })['weather-forecast'],
    'interrompu avant la fin (erreur inconnue)',
    'un nom de classe qui n’est pas fait de lettres seules n’est pas repris',
  );
});
