import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateWeatherAlertCriterion,
  unavailableForecastMessage,
  validateWeatherAlertCriterion,
  weatherAlertCriterionNeedsNewVersion,
  weatherAlertCriterionSummary,
  weatherAlertDeliveryLabel,
  WEATHER_ALERT_FIELD_CHOICES,
  weatherAlertDrafts,
  weatherAlertNotification,
  alertWeekUrl,
  WEATHER_ALERT_LABEL_MAX_LENGTH,
  type WeatherAlertCriterion,
  type WeatherAlertForecastDay,
} from '../lib/domain/weather/weather-alerts.ts';
import { validateIrrigationPushAlarmRequest } from '../lib/domain/irrigation-push-contract.ts';

/**
 * Alertes météo paramétrables (docs/weather-alerts-contract.md, D-050) :
 * le domaine, première des trois PR. Les scénarios chiffrés 1 à 7 du contrat
 * sont joués ici ; les scénarios 8 (isolation entre exploitations) et 9
 * (aucun appareil abonné) portent sur l'enregistrement et l'envoi, et sont
 * joués par les tests de persistance de la PR suivante.
 */

// Lundi 2 novembre 2026, lecture de 06 h 15 à la ferme (07 h 15 en hiver = 05 h 15 UTC).
const MONDAY = '2026-11-02';
const MORNING_READ = '2026-11-02T05:15:00.000Z';
const AFTERNOON_READ = '2026-11-02T13:00:00.000Z';

const FROST: WeatherAlertCriterion = {
  id: 'critere-gel',
  version: 1,
  field: 'minimum-temperature',
  direction: 'below',
  threshold: 5,
  horizonDays: 3,
  active: true,
  label: null,
};

function day(date: string, minimumTemperatureCelsius: number | null, forecastedAt = MORNING_READ): WeatherAlertForecastDay {
  return { date, minimumTemperatureCelsius, maximumTemperatureCelsius: 15, precipitationMm: 0, forecastedAt };
}

function minimums(values: readonly (number | null)[], forecastedAt = MORNING_READ): WeatherAlertForecastDay[] {
  const dates = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
  return values.map((value, index) => day(dates[index], value, forecastedAt));
}

function evaluate(forecasts: readonly WeatherAlertForecastDay[], criterion = FROST, alertedDates = new Set<string>()) {
  return evaluateWeatherAlertCriterion({ criterion, forecasts, today: MONDAY, alertedDates });
}

test('scénario 1 : lundi 7, mardi 4, mercredi 6 °C donnent une alerte pour mardi, 4 °C', () => {
  const evaluation = evaluate(minimums([7, 4, 6]));
  assert.deepEqual(evaluation.crossings, [{ date: '2026-11-03', value: 4, forecastedAt: MORNING_READ }]);
  assert.deepEqual(evaluation.unavailableDates, []);
});

test('scénario 2 : 5 °C n’est pas strictement sous 5 °C, aucune alerte', () => {
  assert.deepEqual(evaluate(minimums([7, 5, 6])).crossings, []);
});

test('« au-dessus de » est strict lui aussi', () => {
  const heat = { ...FROST, field: 'maximum-temperature' as const, direction: 'above' as const, threshold: 30 };
  const forecasts = [
    { ...day('2026-11-02', 10), maximumTemperatureCelsius: 30 },
    { ...day('2026-11-03', 10), maximumTemperatureCelsius: 30.5 },
  ];
  assert.deepEqual(evaluate(forecasts, heat).crossings.map((crossing) => crossing.date), ['2026-11-03']);
});

test('scénario 3 : une prévision absente ne déclenche rien et l’écran la signale', () => {
  const evaluation = evaluate(minimums([7, null, 6]));
  assert.deepEqual(evaluation.crossings, []);
  assert.deepEqual(evaluation.unavailableDates, ['2026-11-03']);
  assert.equal(unavailableForecastMessage(evaluation.unavailableDates), 'Prévision indisponible pour le mardi 3 novembre.');
});

test('un jour sans aucune ligne de prévision est indisponible, jamais lu comme 0', () => {
  const evaluation = evaluate(minimums([7]));
  assert.deepEqual(evaluation.crossings, []);
  assert.deepEqual(evaluation.unavailableDates, ['2026-11-03', '2026-11-04']);
  assert.equal(
    unavailableForecastMessage(evaluation.unavailableDates),
    'Prévision indisponible pour le mardi 3 novembre et le mercredi 4 novembre.',
  );
  assert.equal(unavailableForecastMessage([]), null);
});

test('une pluie prévue absente n’est pas 0 mm : un critère « en dessous de 1 mm » ne se déclenche pas', () => {
  const dry = { ...FROST, field: 'precipitation' as const, threshold: 1 };
  const evaluation = evaluate([{ ...day('2026-11-02', 7), precipitationMm: null }], dry);
  assert.deepEqual(evaluation.crossings, []);
  assert.ok(evaluation.unavailableDates.includes('2026-11-02'));
});

test('scénario 4 : le jour déjà alerté ne l’est plus à l’actualisation de l’après-midi', () => {
  const morning = evaluate(minimums([7, 4, 6]));
  assert.deepEqual(morning.crossings.map((crossing) => crossing.date), ['2026-11-03']);
  const alerted = new Set(weatherAlertDrafts(FROST, morning.crossings).map((draft) => draft.targetDate));

  const afternoon = evaluate([...minimums([7, 4, 6]), ...minimums([7, 3, 6], AFTERNOON_READ)], FROST, alerted);
  assert.deepEqual(afternoon.crossings, []);
});

test('la prévision la plus récente de chaque jour fait foi, quel que soit l’ordre des lignes', () => {
  const evaluation = evaluate([...minimums([7, 3, 6], AFTERNOON_READ), ...minimums([7, 6, 6])]);
  assert.deepEqual(evaluation.crossings, [{ date: '2026-11-03', value: 3, forecastedAt: AFTERNOON_READ }]);
  const warmer = evaluate([...minimums([7, 3, 6]), ...minimums([7, 6, 6], AFTERNOON_READ)]);
  assert.deepEqual(warmer.crossings, []);
});

test('scénario 5 : trois jours de gel font une seule notification qui nomme lundi et compte les deux autres', () => {
  const evaluation = evaluate(minimums([2, 1, 3]));
  assert.equal(evaluation.crossings.length, 3);
  const notification = weatherAlertNotification(FROST, evaluation.crossings);
  assert.deepEqual(notification, {
    title: 'Alerte météo',
    body: 'Température minimale prévue 2 °C lundi 2 novembre, et 2 autres jours (seuil : sous 5 °C). Prévision du 2 novembre, 06 h 15.',
    tag: 'weather-alert:critere-gel:v1:2026-11-02',
    url: '/irrigation/alertes-meteo?season=2026&week=2026-11-02',
  });
  assert.deepEqual(
    weatherAlertDrafts(FROST, evaluation.crossings).map((draft) => [draft.targetDate, draft.forecastValue, draft.unit]),
    [['2026-11-02', 2, '°C'], ['2026-11-03', 1, '°C'], ['2026-11-04', 3, '°C']],
  );
});

test('scénario 6 : jeudi 5 novembre est hors d’un horizon de 3 jours, aucune alerte', () => {
  const evaluation = evaluate(minimums([7, 6, 6, 4]));
  assert.deepEqual(evaluation.crossings, []);
  assert.deepEqual(evaluation.unavailableDates, []);
});

test('l’horizon compte aujourd’hui : 1 jour ne surveille que lundi, 7 jours vont jusqu’à dimanche', () => {
  const forecasts = minimums([7, 4, 6, 6, 6, 6, 2]);
  assert.deepEqual(evaluate(forecasts, { ...FROST, horizonDays: 1 }).crossings, []);
  assert.deepEqual(
    evaluate(forecasts, { ...FROST, horizonDays: 7 }).crossings.map((crossing) => crossing.date),
    ['2026-11-03', '2026-11-08'],
  );
});

test('les jours passés ne sont jamais évalués : la réanalyse dit le passé', () => {
  const yesterday = day('2026-11-01', -2);
  assert.deepEqual(evaluate([yesterday, ...minimums([7, 6, 6])]).crossings, []);
});

test('scénario 7 : un critère inactif n’est jamais évalué', () => {
  const evaluation = evaluate(minimums([2, 1, null]), { ...FROST, active: false });
  assert.deepEqual(evaluation, { crossings: [], unavailableDates: [] });
});

test('un jour visé déjà alerté sort du compte, les autres partent dans la notification', () => {
  const evaluation = evaluate(minimums([2, 1, 3]), FROST, new Set(['2026-11-02']));
  assert.deepEqual(evaluation.crossings.map((crossing) => crossing.date), ['2026-11-03', '2026-11-04']);
  const notification = weatherAlertNotification(FROST, evaluation.crossings);
  assert.match(notification?.body ?? '', /^Température minimale prévue 1 °C mardi 3 novembre, et 1 autre jour \(seuil/);
});

test('aucun jour franchi, aucune notification', () => {
  assert.equal(weatherAlertNotification(FROST, []), null);
});

test('la notification de pluie et de chaleur dit « prévue », le seuil et l’unité, et reprend le libellé', () => {
  const rain: WeatherAlertCriterion = {
    ...FROST, id: 'pluie', version: 3, field: 'precipitation', direction: 'above', threshold: 20, label: 'Forte pluie',
  };
  const notification = weatherAlertNotification(rain, [{ date: '2026-11-05', value: 24.4, forecastedAt: MORNING_READ }]);
  assert.deepEqual(notification, {
    title: 'Alerte météo · Forte pluie',
    body: 'Pluie prévue 24,4 mm jeudi 5 novembre (seuil : au-dessus de 20 mm). Prévision du 2 novembre, 06 h 15.',
    tag: 'weather-alert:pluie:v3:2026-11-05',
    url: '/irrigation/alertes-meteo?season=2026&week=2026-11-02',
  });
});

test('la notification passe les contrôles du Worker Web Push, même au plus long', () => {
  const longest: WeatherAlertCriterion = {
    ...FROST,
    id: '0f8fad5b-d9cb-469f-a165-70867728950e',
    version: 9999,
    field: 'maximum-temperature',
    direction: 'above',
    threshold: -29.9,
    horizonDays: 7,
    label: 'x'.repeat(WEATHER_ALERT_LABEL_MAX_LENGTH),
  };
  const crossings = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']
    .map((date) => ({ date, value: -12.5, forecastedAt: '2026-09-30T21:45:00.000Z' }));
  const notification = weatherAlertNotification(longest, crossings);
  assert.ok(notification);
  const request = validateIrrigationPushAlarmRequest({
    eventEquipmentId: 'weather-alert',
    recipientKey: 'workspace-1',
    revision: 'v1',
    dueAt: MORNING_READ,
    notification: { title: notification.title, body: notification.body, tag: notification.tag, data: { url: notification.url } },
  });
  assert.ok(request, `refusée : ${notification.title} | ${notification.body} (${notification.body.length} caractères)`);
  assert.equal(request.notification.data.url, notification.url);
});

test('l’heure de la prévision est celle de la ferme, en été comme en hiver', () => {
  const summer = weatherAlertNotification(FROST, [{ date: '2026-07-01', value: 4, forecastedAt: '2026-07-01T04:15:00.000Z' }]);
  assert.match(summer?.body ?? '', /Prévision du 1 juillet, 06 h 15\.$/);
});

test('le clic ouvre la semaine du jour visé, saison comprise, y compris à cheval sur deux années', () => {
  assert.equal(alertWeekUrl('alertes-meteo', '2026-11-08'), '/irrigation/alertes-meteo?season=2026&week=2026-11-02');
  assert.equal(alertWeekUrl('alertes-cultures', '2027-01-01'), '/irrigation/alertes-cultures?season=2026&week=2026-12-28');
  assert.throws(() => alertWeekUrl('alertes-meteo', '2026-02-30'));
});

test('un critère complet est accepté ; l’horizon vaut 3 jours et le critère est actif par défaut', () => {
  assert.deepEqual(validateWeatherAlertCriterion({ field: 'minimum-temperature', direction: 'below', threshold: 5 }), {
    ok: true,
    settings: { field: 'minimum-temperature', direction: 'below', threshold: 5, horizonDays: 3, active: true, label: null },
  });
  assert.deepEqual(validateWeatherAlertCriterion({
    field: 'precipitation', direction: 'above', threshold: '12,5', horizonDays: '7', active: false, label: '  Forte   pluie ',
  }), {
    ok: true,
    settings: { field: 'precipitation', direction: 'above', threshold: 12.5, horizonDays: 7, active: false, label: 'Forte pluie' },
  });
  const negative = validateWeatherAlertCriterion({ field: 'minimum-temperature', direction: 'below', threshold: '-2', label: '' });
  assert.ok(negative.ok);
  assert.equal(negative.settings.threshold, -2);
  assert.equal(negative.settings.label, null);
});

test('un seuil absent, non numérique ou hors des bornes est refusé avec sa raison', () => {
  const refusal = (threshold: unknown, field = 'minimum-temperature') => {
    const result = validateWeatherAlertCriterion({ field, direction: 'below', threshold });
    assert.equal(result.ok, false);
    return result.ok ? [] : result.refusals.map((item) => `${item.input} : ${item.message}`);
  };
  assert.deepEqual(refusal(undefined), ['threshold : Indiquez un seuil, en °C.']);
  assert.deepEqual(refusal('  '), ['threshold : Indiquez un seuil, en °C.']);
  assert.deepEqual(refusal('cinq'), ['threshold : Le seuil doit être un nombre, en °C.']);
  assert.deepEqual(refusal('5 °C'), ['threshold : Le seuil doit être un nombre, en °C.']);
  assert.deepEqual(refusal(Number.NaN), ['threshold : Le seuil doit être un nombre, en °C.']);
  assert.deepEqual(refusal(-31), ['threshold : Le seuil de température minimale va de -30 °C à 50 °C.']);
  assert.deepEqual(refusal(51), ['threshold : Le seuil de température minimale va de -30 °C à 50 °C.']);
  assert.deepEqual(refusal(-0.5, 'precipitation'), ['threshold : Le seuil de pluie va de 0 mm à 300 mm.']);
  assert.deepEqual(refusal(300.5, 'precipitation'), ['threshold : Le seuil de pluie va de 0 mm à 300 mm.']);
  assert.ok(validateWeatherAlertCriterion({ field: 'precipitation', direction: 'above', threshold: 300 }).ok);
  assert.ok(validateWeatherAlertCriterion({ field: 'maximum-temperature', direction: 'above', threshold: -30 }).ok);
});

test('le champ, le sens, l’horizon, l’activation et le libellé refusés disent pourquoi', () => {
  const result = validateWeatherAlertCriterion({
    field: 'wind', direction: 'equal', threshold: 5, horizonDays: 8, active: 'oui', label: 'x'.repeat(WEATHER_ALERT_LABEL_MAX_LENGTH + 1),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.ok ? [] : result.refusals.map((item) => item.input), ['field', 'direction', 'horizonDays', 'active', 'label']);
  for (const horizonDays of [0, 2.5, '3 jours', -1]) {
    const horizon = validateWeatherAlertCriterion({ field: 'precipitation', direction: 'above', threshold: 5, horizonDays });
    assert.deepEqual(horizon.ok ? [] : horizon.refusals.map((item) => item.message), [
      'L’horizon est un nombre entier de jours, de 1 à 7, aujourd’hui compris.',
    ]);
  }
  assert.ok(validateWeatherAlertCriterion({ field: 'precipitation', direction: 'above', threshold: 5, label: 'x'.repeat(WEATHER_ALERT_LABEL_MAX_LENGTH) }).ok);
  assert.ok(!validateWeatherAlertCriterion({ field: 'precipitation', direction: 'above', threshold: 5, label: 12 }).ok);
});

test('un champ inconnu ne passe pas par un nom hérité de l’objet', () => {
  assert.equal(validateWeatherAlertCriterion({ field: 'toString', direction: 'below', threshold: 5 }).ok, false);
});

test('modifier un critère en fait une nouvelle version ; l’activer ou le désactiver, non', () => {
  const settings = { field: 'minimum-temperature', direction: 'below', threshold: 5, horizonDays: 3, active: true, label: null } as const;
  assert.equal(weatherAlertCriterionNeedsNewVersion(settings, { ...settings, active: false }), false);
  assert.equal(weatherAlertCriterionNeedsNewVersion(settings, { ...settings }), false);
  for (const change of [
    { threshold: 4 }, { horizonDays: 4 }, { direction: 'above' as const }, { field: 'precipitation' as const }, { label: 'Gel' },
  ]) {
    assert.equal(weatherAlertCriterionNeedsNewVersion(settings, { ...settings, ...change }), true, JSON.stringify(change));
  }
});

test('un jour de référence invalide est une erreur, jamais une évaluation silencieuse', () => {
  assert.throws(() => evaluateWeatherAlertCriterion({ criterion: FROST, forecasts: [], today: '2026-13-01', alertedDates: new Set() }));
});

test('l’écran : le critère en une phrase, le seuil jamais compris, les champs offerts et le résultat de l’envoi', () => {
  assert.equal(
    weatherAlertCriterionSummary(FROST),
    'Température minimale prévue en dessous de 5 °C (5 °C non compris), sur 3 jours, aujourd’hui compris',
  );
  assert.equal(
    weatherAlertCriterionSummary({ ...FROST, field: 'precipitation', direction: 'above', threshold: 12.5, horizonDays: 1 }),
    'Pluie prévue au-dessus de 12,5 mm (12,5 mm non compris), aujourd’hui seulement',
  );
  assert.deepEqual(WEATHER_ALERT_FIELD_CHOICES.map((choice) => [choice.field, choice.unit]), [
    ['minimum-temperature', '°C'], ['maximum-temperature', '°C'], ['precipitation', 'mm'],
  ]);
  assert.deepEqual(
    (['pending', 'sent', 'no-subscriber', 'retrying', 'failed'] as const).map(weatherAlertDeliveryLabel),
    ['Envoi en cours', 'Envoyée', 'Aucun appareil abonné', 'Nouvelle tentative du service de notification', 'Échec du service de notification'],
  );
});
