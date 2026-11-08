import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateFrost, frostAlertKey, frostDrafts, frostNotifications, frostSubjects } from '../lib/domain/crop-alerts/frost.ts';
import { frostAlertThresholdCelsius, frostMarginCelsius, type FrostLinkRevision } from '../lib/domain/crop-alerts/thresholds.ts';
import type { CropSeries, ImplantationTask } from '../lib/domain/domain.ts';
import { AFTERNOON, COMMON, link, MONDAY, MORNING, planting, series, TUESDAY, WEDNESDAY } from './support/crop-alerts-fixtures.ts';

/**
 * Le gel par culture (docs/weather-crop-alerts-contract.md, scénarios 1 à 10
 * et 20) : le lundi 9 novembre 2026, horizon 3 jours, cultures présentes :
 * tomate (alerte à +3 °C), carotte (−4 °C), poireau (−6 °C).
 */

const FARM_SERIES = [
  series({ id: 'tomates', plantId: 'p-tomate', plantName: 'Tomate' }),
  series({ id: 'carottes', plantId: 'p-carotte', plantName: 'Carotte', harvestWeeksExpected: ['2026-W52'] }),
  series({ id: 'poireaux', plantId: 'p-poireau', plantName: 'Poireau', harvestWeeksExpected: ['2027-W05'] }),
];
const FARM_TASKS = [planting('tomates', '2026-W44'), planting('carottes', '2026-W40'), planting('poireaux', '2026-W36')];
const FARM_LINKS = [link('p-tomate', 'tomate'), link('p-carotte', 'carotte'), link('p-poireau', 'poireau')];

function evaluate(options: {
  minima: Record<string, number | null>;
  forecastedAt?: string;
  alerted?: string[];
  offset?: number;
  series?: CropSeries[];
  tasks?: ImplantationTask[];
  revisions?: FrostLinkRevision[];
  sheltered?: string[];
}) {
  const { subjects, withoutThreshold } = frostSubjects({
    series: options.series ?? FARM_SERIES,
    tasks: options.tasks ?? FARM_TASKS,
    revisions: options.revisions ?? FARM_LINKS,
    common: COMMON,
    shelteredSeriesIds: new Set(options.sheltered ?? []),
    today: MONDAY,
  });
  const evaluation = evaluateFrost({
    subjects,
    forecasts: Object.entries(options.minima).map(([date, minimum]) => ({ date, minimumTemperatureCelsius: minimum, forecastedAt: options.forecastedAt ?? MORNING })),
    today: MONDAY,
    horizonDays: 3,
    offsetCelsius: options.offset ?? 0,
    alertedKeys: new Set(options.alerted ?? []),
  });
  return { subjects, withoutThreshold, evaluation, notifications: frostNotifications(evaluation), drafts: frostDrafts(evaluation) };
}

const names = (evaluation: ReturnType<typeof evaluate>['evaluation'], date: string) =>
  evaluation.days.find((day) => day.date === date)?.crossings.map((crossing) => crossing.name) ?? [];

test('la marge : 3 °C dès que les dégâts sont à −2 °C ou plus haut, 2 °C plus bas ; le seuil appliqué ajoute le curseur', () => {
  assert.equal(frostMarginCelsius(0), 3);
  assert.equal(frostMarginCelsius(-2), 3);
  assert.equal(frostMarginCelsius(-2.5), 2);
  assert.equal(frostAlertThresholdCelsius(-9.5, 0), -7.5, 'rutabaga, chou kale, coriandre, oseille');
  assert.equal(frostAlertThresholdCelsius(2, 0), 5, 'basilic');
  assert.equal(frostAlertThresholdCelsius(0, 1.5), 4.5);
  // Les marges de la ferme (P44) remplacent celles du contrat.
  const margins = { sensitiveCelsius: 4, hardyCelsius: 1.5 };
  assert.equal(frostMarginCelsius(0, margins), 4);
  assert.equal(frostMarginCelsius(-2.5, margins), 1.5);
  assert.equal(frostAlertThresholdCelsius(2, 0, margins), 6, 'basilic, marge 4 °C');
  assert.equal(frostAlertThresholdCelsius(-9.5, -1, margins), -9, 'rutabaga, marge 1,5 °C, microclimat −1 °C');
});

test('scénario 1 : minimales 6, 2 et 5 °C, une alerte pour mardi, la tomate seule', () => {
  const { evaluation, notifications, drafts } = evaluate({ minima: { [MONDAY]: 6, [TUESDAY]: 2, [WEDNESDAY]: 5 } });
  assert.deepEqual(evaluation.days.map((day) => day.date), [TUESDAY]);
  assert.deepEqual(names(evaluation, TUESDAY), ['Tomate']);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].title, 'Alerte gel');
  assert.equal(notifications[0].body, 'Gel prévu mardi 10 novembre : 2 °C. Tomate (1 culture présente).');
  assert.equal(notifications[0].url, '/irrigation/alertes-cultures?season=2026&week=2026-11-09');
  assert.deepEqual(drafts.map((draft) => [draft.plantId, draft.targetDate, draft.damageCelsius, draft.marginCelsius, draft.offsetCelsius, draft.forecastCelsius]), [
    ['p-tomate', TUESDAY, 0, 3, 0, 2],
  ]);
});

test('scénario 2 : exactement 3 °C alerte la tomate (inférieure ou égale)', () => {
  assert.deepEqual(names(evaluate({ minima: { [MONDAY]: 6, [TUESDAY]: 3, [WEDNESDAY]: 5 } }).evaluation, TUESDAY), ['Tomate']);
  assert.deepEqual(evaluate({ minima: { [MONDAY]: 6, [TUESDAY]: 3.1, [WEDNESDAY]: 5 } }).evaluation.days, []);
});

test('scénario 3 : −4 °C alerte la tomate et la carotte, pas le poireau, dans une seule notification', () => {
  const { evaluation, notifications } = evaluate({ minima: { [MONDAY]: 6, [TUESDAY]: -4, [WEDNESDAY]: 5 } });
  assert.deepEqual(names(evaluation, TUESDAY), ['Carotte', 'Tomate']);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].body, 'Gel prévu mardi 10 novembre : -4 °C. Carotte, tomate (2 cultures présentes).');
});

test('scénario 4 : une minimale absente ne déclenche rien et le jour est dit indisponible', () => {
  const { evaluation, notifications } = evaluate({ minima: { [MONDAY]: 6, [TUESDAY]: null, [WEDNESDAY]: 5 } });
  assert.deepEqual(evaluation.days, []);
  assert.deepEqual(evaluation.unavailableDates, [TUESDAY]);
  assert.deepEqual(notifications, []);
  assert.deepEqual(evaluate({ minima: { [MONDAY]: 6 } }).evaluation.unavailableDates, [TUESDAY, WEDNESDAY], 'un jour sans prévision non plus');
});

test('scénario 5 : l’actualisation de 14 h n’annonce que l’espèce nouvellement concernée', () => {
  const morning = evaluate({ minima: { [MONDAY]: 6, [TUESDAY]: 2, [WEDNESDAY]: 5 } });
  const alerted = morning.drafts.map((draft) => frostAlertKey(draft.subjectKey, draft.subjectVersion, draft.targetDate));
  const colder = evaluate({ minima: { [MONDAY]: 6, [TUESDAY]: 1, [WEDNESDAY]: 5 }, forecastedAt: AFTERNOON, alerted });
  assert.deepEqual(colder.notifications, [], 'rien de nouveau');
  assert.equal(colder.evaluation.days[0].crossings[0].alreadyAlerted, true, 'l’écran garde la tomate dans les échéances');
  const carrot = evaluate({ minima: { [MONDAY]: 6, [TUESDAY]: -4.5, [WEDNESDAY]: 5 }, forecastedAt: AFTERNOON, alerted });
  assert.equal(carrot.notifications.length, 1);
  assert.equal(carrot.notifications[0].body, 'Gel prévu mardi 10 novembre : -4,5 °C. Carotte (1 culture présente).');
  assert.deepEqual(carrot.drafts.map((draft) => draft.plantId), ['p-carotte']);
});

test('la prévision la plus récente de chaque jour fait foi', () => {
  const { subjects } = evaluate({ minima: {} });
  const evaluation = evaluateFrost({
    subjects,
    forecasts: [
      { date: TUESDAY, minimumTemperatureCelsius: 2, forecastedAt: MORNING },
      { date: TUESDAY, minimumTemperatureCelsius: 7, forecastedAt: AFTERNOON },
    ],
    today: MONDAY,
    horizonDays: 3,
    offsetCelsius: 0,
    alertedKeys: new Set(),
  });
  assert.deepEqual(evaluation.days, []);
});

test('scénario 6 : une tomate terminée la semaine passée ou pas encore plantée ne compte pas', () => {
  const minima = { [MONDAY]: 6, [TUESDAY]: 2, [WEDNESDAY]: 5 };
  const finished = series({ id: 'tomates', plantId: 'p-tomate', plantName: 'Tomate', harvestWeeks: ['2026-W45'], harvestWeeksExpected: [] });
  assert.deepEqual(evaluate({ minima, series: [finished] }).evaluation.days, []);
  const later = [planting('tomates', '2026-W48', false)];
  assert.deepEqual(evaluate({ minima, series: [FARM_SERIES[0]], tasks: later }).evaluation.days, []);
  assert.deepEqual(evaluate({ minima, series: [FARM_SERIES[0]], tasks: [] }).evaluation.days, [], 'sans implantation, aucune période');
});

test('scénario 7 : une série en bloc de carotte est alertée comme les autres', () => {
  const block = series({ id: 'carottes-bloc', plantId: 'p-carotte', plantName: 'Carotte', use: 'block' });
  const { evaluation } = evaluate({ minima: { [MONDAY]: 6, [TUESDAY]: -4, [WEDNESDAY]: 5 }, series: [block], tasks: [planting('carottes-bloc', '2026-W40')] });
  assert.deepEqual(names(evaluation, TUESDAY), ['Carotte']);
});

test('scénario 8 : le fraisier n’alerte jamais et figure dans les cultures sans seuil ; une espèce non rattachée aussi', () => {
  const strawberries = series({ id: 'fraisiers', plantId: 'p-fraisier', plantName: 'Fraisier' });
  const zinnias = series({ id: 'zinnias', plantId: 'p-zinnia', plantName: 'Zinnia' });
  const { evaluation, withoutThreshold } = evaluate({
    minima: { [MONDAY]: -10, [TUESDAY]: -10, [WEDNESDAY]: -10 },
    series: [strawberries, zinnias],
    tasks: [planting('fraisiers', '2026-W20'), planting('zinnias', '2026-W20')],
    revisions: [link('p-fraisier', 'fraisier')],
  });
  assert.deepEqual(evaluation.days, []);
  assert.deepEqual(withoutThreshold, [
    { plantId: 'p-fraisier', name: 'Fraisier', reason: 'none' },
    { plantId: 'p-zinnia', name: 'Zinnia', reason: 'missing' },
  ]);
});

test('scénario 9 : la tomate corrigée à +2 °C de dégâts alerte à +5 °C ; la correction remet ses jours à zéro', () => {
  const minima = { [MONDAY]: 6, [TUESDAY]: 2, [WEDNESDAY]: 4.5 };
  const before = evaluate({ minima });
  const alerted = before.drafts.map((draft) => frostAlertKey(draft.subjectKey, draft.subjectVersion, draft.targetDate));
  const corrected = [...FARM_LINKS, link('p-tomate', 'tomate', { damageCelsius: 2, recordedAt: '2026-11-09T09:00:00.000Z' })];
  const after = evaluate({ minima, alerted, revisions: corrected });
  assert.deepEqual(after.evaluation.days.map((day) => day.date), [TUESDAY, WEDNESDAY]);
  assert.deepEqual(after.drafts.map((draft) => [draft.targetDate, draft.damageCelsius, draft.marginCelsius]), [[TUESDAY, 2, 3], [WEDNESDAY, 2, 3]],
    'mardi, déjà alerté avec le seuil commun, l’est de nouveau');
  assert.equal(after.subjects.find((subject) => subject.plantId === 'p-tomate')?.source, 'farm');
  assert.deepEqual(before.drafts.map((draft) => [draft.damageCelsius, draft.marginCelsius]), [[0, 3]], 'l’alerte envoyée garde ses valeurs');
});

test('une exception de série a son propre seuil et se nomme avec sa série', () => {
  const under = series({ id: 'tomates-abri', plantId: 'p-tomate', plantName: 'Tomate' });
  const { evaluation, notifications } = evaluate({
    minima: { [MONDAY]: 6, [TUESDAY]: 2, [WEDNESDAY]: 5 },
    series: [FARM_SERIES[0], under],
    tasks: [planting('tomates', '2026-W44'), planting('tomates-abri', '2026-W44')],
    revisions: [link('p-tomate', 'tomate'), link('p-tomate', 'tomate', { seriesId: 'tomates-abri', damageCelsius: -3 })],
    sheltered: ['tomates-abri'],
  });
  assert.deepEqual(names(evaluation, TUESDAY), ['Tomate']);
  const colder = evaluate({
    minima: { [MONDAY]: 6, [TUESDAY]: -1, [WEDNESDAY]: 5 },
    series: [FARM_SERIES[0], under],
    tasks: [planting('tomates', '2026-W44'), planting('tomates-abri', '2026-W44')],
    revisions: [link('p-tomate', 'tomate'), link('p-tomate', 'tomate', { seriesId: 'tomates-abri', damageCelsius: -3 })],
    sheltered: ['tomates-abri'],
  });
  assert.deepEqual(names(colder.evaluation, TUESDAY), ['Tomate', 'Tomate (série tomates-abri)']);
  assert.equal(colder.notifications[0].body,
    'Gel prévu mardi 10 novembre : -1 °C. Tomate, tomate (série tomates-abri) (2 cultures présentes). Sous abri, la température diffère.',
    'la note d’abri entière ferait dépasser les 160 caractères du service d’envoi : elle se raccourcit');
  assert.doesNotMatch(notifications[0].body, /abri/u);
});

test('scénario 10 : laitue et mesclun ont un seul seuil, −2 °C de dégâts, alerte à +1 °C', () => {
  const salads = [
    series({ id: 'laitues', plantId: 'p-laitue', plantName: 'Laitue' }),
    series({ id: 'mesclun', plantId: 'p-mesclun', plantName: 'Mesclun' }),
  ];
  const options = { series: salads, tasks: [planting('laitues', '2026-W42'), planting('mesclun', '2026-W43')], revisions: [link('p-laitue', 'laitue'), link('p-mesclun', 'laitue')] };
  assert.deepEqual(names(evaluate({ ...options, minima: { [TUESDAY]: 1 } }).evaluation, TUESDAY), ['Laitue', 'Mesclun']);
  assert.deepEqual(evaluate({ ...options, minima: { [TUESDAY]: 1.5 } }).evaluation.days, []);
});

test('scénario 20 : le curseur à +2 °C fait alerter la tomate dès 5 °C, à −2 °C seulement à 1 °C ; dégâts et marge ne changent pas', () => {
  const warm = evaluate({ minima: { [TUESDAY]: 5 }, offset: 2 });
  assert.deepEqual(names(warm.evaluation, TUESDAY), ['Tomate']);
  const crossing = warm.evaluation.days[0].crossings[0];
  assert.deepEqual([crossing.damageCelsius, crossing.marginCelsius, crossing.offsetCelsius, crossing.alertThresholdCelsius], [0, 3, 2, 5]);
  assert.deepEqual(evaluate({ minima: { [TUESDAY]: 2 }, offset: -2 }).evaluation.days, []);
  assert.deepEqual(names(evaluate({ minima: { [TUESDAY]: 1 }, offset: -2 }).evaluation, TUESDAY), ['Tomate']);
  const alerted = [frostAlertKey('p-tomate', FARM_LINKS[0].id, TUESDAY)];
  assert.deepEqual(evaluate({ minima: { [TUESDAY]: 4 }, offset: 2, alerted }).notifications, [], 'déplacer le curseur ne renvoie pas un jour déjà alerté');
});

test('au plus cinq noms, puis « et N autres » ; au plus trois jours, puis une notification qui résume le reste', () => {
  const many = ['Ail', 'Blette', 'Carotte', 'Épinard', 'Navet', 'Poireau', 'Tomate'].map((name) => series({ id: name, plantId: `p-${name}`, plantName: name, harvestWeeksExpected: ['2027-W10'] }));
  const tasks = many.map((item) => planting(item.id, '2026-W40'));
  const revisions = many.map((item) => link(item.cultivations[0].plantId, 'tomate'));
  const { subjects } = frostSubjects({ series: many, tasks, revisions, common: COMMON, shelteredSeriesIds: new Set(), today: MONDAY });
  const forecasts = [0, 1, 2, 3, 4, 5].map((offset) => ({ date: `2026-11-${String(9 + offset).padStart(2, '0')}`, minimumTemperatureCelsius: -offset, forecastedAt: MORNING }));
  const notifications = frostNotifications(evaluateFrost({ subjects, forecasts, today: MONDAY, horizonDays: 6, offsetCelsius: 0, alertedKeys: new Set() }));
  assert.equal(notifications.length, 4);
  assert.equal(notifications[0].body, 'Gel prévu lundi 9 novembre : 0 °C. Ail, blette, carotte, épinard, navet et 2 autres (7 cultures présentes).');
  assert.equal(notifications[3].body, 'Gel prévu aussi jeudi 12 novembre (-3 °C), vendredi 13 novembre (-4 °C) et samedi 14 novembre (-5 °C), pour 7 cultures présentes.');
  assert.equal(new Set(notifications.map((notification) => notification.tag)).size, 4);
});
