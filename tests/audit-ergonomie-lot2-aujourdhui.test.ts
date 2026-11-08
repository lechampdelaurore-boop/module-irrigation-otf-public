import assert from 'node:assert/strict';
import test from 'node:test';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import { hasTodayPage, landingPage, legacyRedirect, menuPages, notFoundReturnLink, pageAccess, pageUsesSeason } from '../lib/domain/features/pages';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record';
import type { StoredProposal } from '../lib/domain/planning/contract';
import {
  ACTUAL_RAIN_CONSEQUENCE,
  neverObservedSoilGardens,
  RELIABILITY_ALL_CLEAR,
  RELIABILITY_KINDS,
  reliabilityLines,
  reliabilityThresholdsText,
  reliabilityZone,
  reservoirAnchor,
  soilGardenAnchor,
  type ReliabilityInputs,
} from '../lib/domain/today/reliability';
import { durationText, NOTHING_LATE, NOTHING_TO_DO, proposalAnchor } from '../lib/domain/today/today-irrigations';
import { namesText } from '../lib/domain/today/today-text';
import {
  FORECAST_UNAVAILABLE,
  planLine,
  todaySeason,
  todayView,
  weatherBlock,
  type TodayBlock,
  type TodayInputs,
} from '../lib/domain/today/today-view';
import { NO_WATER_TRACKED } from '../lib/domain/today/water';
import type { WaterInfrastructure, WaterReservoir } from '../lib/domain/water-resources';
import type { WeatherAlertCriterion, WeatherAlertForecastDay } from '../lib/domain/weather/weather-alerts';

/**
 * Le lot 2 de l'audit ergonomique, PR 2 : le domaine de la page
 * « Aujourd'hui » et de la zone « Fiabilité du calcul » (3.8 quater, points
 * 1 et 3, docs/audit-ergonomie-lot2-contract.md, sections 5 à 7, cas 4 à 16 ;
 * le cas 20 est un test de base, tests/db/today-service.test.ts). Aujourd'hui
 * = jeudi 12 novembre 2026, 6 h 00 à la ferme.
 */

const ALL: FeatureId[] = [...FEATURE_IDS];
const NOW = new Date('2026-11-12T05:00:00.000Z');
const BEDS = new Map([['b1', 'P1'], ['b2', 'P2'], ['b10', 'P10']]);

function event(id: string, startAt: string, endAt: string, overrides: { status?: 'planned' | 'completed'; mm?: number; beds?: string[] } = {}): IrrigationEventRecord {
  const status = overrides.status ?? 'planned';
  return {
    id: `event-${id}`,
    season: 2026,
    status,
    note: null,
    remainingCanceledAt: null,
    canceledAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    equipment: {
      id,
      status,
      plannedStartAt: startAt,
      plannedEndAt: endAt,
      plannedDurationSeconds: (Date.parse(endAt) - Date.parse(startAt)) / 1000,
      timerState: null,
      timerStartedAt: null,
      remainingCanceledAt: null,
      canceledAt: null,
      equipmentSnapshot: { id: 'eq', name: 'Goutte-à-goutte B', kind: 'drip', mobility: 'fixed' },
      settingSnapshot: { name: 'Réglage 1' },
      applications: (overrides.beds ?? ['b1']).map((otfBedId) => ({ otfBedId, plannedAmountMm: overrides.mm ?? 12 })),
    },
  } as unknown as IrrigationEventRecord;
}

function proposal(storedId: string, startAt: string, status: StoredProposal['status'] = 'proposed'): StoredProposal {
  return {
    storedId,
    status,
    startAt,
    endAt: new Date(Date.parse(startAt) + 3600_000).toISOString(),
    durationSeconds: 3600,
    doseMm: 8,
    equipmentName: 'Asperseur A',
    settingName: 'Buse 2',
    applications: [{ otfBedId: 'b2' }],
  } as unknown as StoredProposal;
}

function reservoir(id: string, name: string, observedAt: string | null, volume: number | null = 12): WaterReservoir {
  return {
    id, name, type: 'tank', capacityCubicMeters: 20, currentVolumeCubicMeters: volume, currentVolumeObservedAt: observedAt,
    minimumSafetyCubicMeters: 0, exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false,
    evaporationCoefficient: 1, status: 'active', notes: null,
  };
}

function infrastructure(reservoirs: WaterReservoir[]): WaterInfrastructure {
  return { resources: [], resourceLimits: [], reservoirs, resourceReservoirLinks: [], reservoirLinks: [], defaultSupply: null, movements: [] };
}

const forecast = (date: string, minimum: number | null = 6, maximum: number | null = 14): WeatherAlertForecastDay => ({
  date, minimumTemperatureCelsius: minimum, maximumTemperatureCelsius: maximum, precipitationMm: 0, forecastedAt: '2026-11-12T04:00:00.000Z',
});
const THREE_DAYS = [forecast('2026-11-12'), forecast('2026-11-13'), forecast('2026-11-14')];

const FRESH: Omit<ReliabilityInputs, 'enabled' | 'now'> = {
  reservoirs: [],
  actualRainMissingDates: [],
  soilGardensNeverObserved: [],
  speciesWithoutReference: [],
  planComputedAt: '2026-11-12T05:02:00.000Z',
};

function inputs(overrides: Partial<TodayInputs> = {}): TodayInputs {
  return {
    enabled: ALL,
    now: NOW,
    weather: { forecasts: THREE_DAYS, frost: [], criteria: [] },
    events: [],
    lateToleranceMinutes: 30,
    plan: { computedAt: '2026-11-12T05:02:00.000Z', proposals: [] },
    bedNames: BEDS,
    infrastructure: infrastructure([]),
    reliability: { actualRainMissingDates: [], soilGardensNeverObserved: [], speciesWithoutReference: [] },
    week: null,
    soil: null,
    ...overrides,
  };
}

function block<K extends TodayBlock['kind']>(blocks: TodayBlock[], kind: K): Extract<TodayBlock, { kind: K }> {
  const found = blocks.find((item) => item.kind === kind);
  assert.ok(found, `bloc ${kind}`);
  return found as Extract<TodayBlock, { kind: K }>;
}

test('cas 4 : sans aucune des huit cases utiles, pas de page « Aujourd’hui »', () => {
  assert.equal(hasTodayPage(['materiel', 'calculateur']), false);
  assert.equal(hasTodayPage(['materiel', 'historique']), false);
  assert.equal(hasTodayPage(['materiel', 'alertes-meteo']), true);
  assert.equal(hasTodayPage(ALL), true);

  const sansAujourdhui: FeatureId[] = ['materiel', 'calculateur'];
  assert.deepEqual(menuPages(sansAujourdhui), ['materiel', 'reglages']);
  assert.equal(landingPage(sansAujourdhui), 'materiel');
  // `/irrigation` va à Matériel ; `/irrigation/aujourdhui`, à la première page cochée avec sa ligne.
  assert.deepEqual(legacyRedirect('', sansAujourdhui), { page: 'materiel', notEnabled: false });
  assert.deepEqual(pageAccess('aujourdhui', false, sansAujourdhui), { kind: 'not-enabled', page: 'materiel' });
  assert.deepEqual(notFoundReturnLink({ firstVisit: false, enabled: sansAujourdhui }), { href: '/irrigation/materiel', label: 'Revenir à « Matériel et placement »' });
});

test('F1 et F2 : « Aujourd’hui » est la première du menu, la page d’arrivée, et ne propose pas la saison', () => {
  assert.equal(menuPages(ALL)[0], 'aujourdhui');
  assert.equal(menuPages(ALL).length, 12);
  assert.equal(landingPage(ALL), 'aujourdhui');
  assert.deepEqual(legacyRedirect('', ALL), { page: 'aujourdhui', notEnabled: false });
  // Une ancienne ancre garde sa page ; une ancre inconnue conduit à « Aujourd'hui ».
  assert.deepEqual(legacyRedirect('#irrigation-eq-1', ALL), { page: 'arrosages', notEnabled: false });
  assert.deepEqual(legacyRedirect('#inconnue', ALL), { page: 'aujourdhui', notEnabled: false });
  assert.deepEqual(pageAccess('aujourdhui', false, ALL), { kind: 'open' });
  assert.deepEqual(pageAccess('aujourdhui', true, ALL), { kind: 'welcome' });
  assert.deepEqual(pageAccess('sol', false, ['arrosages', 'materiel']), { kind: 'not-enabled', page: 'aujourdhui' });
  assert.deepEqual(notFoundReturnLink({ firstVisit: false, enabled: ALL }), { href: '/irrigation/aujourdhui', label: 'Revenir à « Aujourd’hui »' });
  assert.equal(pageUsesSeason('aujourdhui', ALL), false);
});

test('cas 5 : un gel annoncé samedi nomme la minimale, la date et les cultures, en barre rouge', () => {
  const frost = [{
    date: '2026-11-14',
    minimumCelsius: 1.2,
    crops: [
      { name: 'Laitue', alertCelsius: 2, underShelter: false, alreadyAlerted: false },
      { name: 'Fenouil', alertCelsius: 1.5, underShelter: false, alreadyAlerted: true },
    ],
  }];
  const result = weatherBlock({ forecasts: THREE_DAYS, frost, criteria: [] }, ALL, NOW);
  assert.equal(result.tone, 'alert');
  assert.deepEqual(result.lines, ['Gel annoncé le sam. 14 nov. : 1,2 °C. 2 cultures : Laitue, Fenouil.']);
  assert.deepEqual(result.link, { label: 'Voir les alertes', page: 'alertes-cultures' });
  // Le gel le plus froid des trois jours, et toutes les cultures touchées.
  const twoDays = weatherBlock({ forecasts: THREE_DAYS, frost: [{ ...frost[0], date: '2026-11-13', minimumCelsius: 0.4, crops: [frost[0].crops[0]] }, frost[0]], criteria: [] }, ALL, NOW);
  assert.deepEqual(twoDays.lines, ['Gel annoncé le ven. 13 nov. : 0,4 °C. 2 cultures : Laitue, Fenouil.']);
  // Au-delà des trois jours, rien.
  assert.equal(weatherBlock({ forecasts: THREE_DAYS, frost: [{ ...frost[0], date: '2026-11-15' }], criteria: [] }, ALL, NOW).tone, 'calm');
});

test('cas 5 bis : les alertes météo de l’exploitation qui se déclencheraient dans les trois jours', () => {
  const criterion: WeatherAlertCriterion = {
    id: 'c1', version: 1, field: 'maximum-temperature', direction: 'above', threshold: 30, horizonDays: 7, active: true, label: 'Chaleur',
  };
  const hot = [forecast('2026-11-12'), forecast('2026-11-13', 10, 31.5), forecast('2026-11-14')];
  const result = weatherBlock({ forecasts: hot, frost: null, criteria: [criterion] }, ['arrosages', 'materiel', 'alertes-meteo'], NOW);
  assert.equal(result.tone, 'alert');
  assert.deepEqual(result.lines, ['Chaleur : température maximale prévue 31,5 °C le ven. 13 nov.']);
  assert.equal(result.link.page, 'alertes-meteo');
  // Les deux cases cochées : « Voir les alertes » mène à la page de ce qui est annoncé.
  assert.equal(weatherBlock({ forecasts: hot, frost: [], criteria: [criterion] }, ALL, NOW).link.page, 'alertes-meteo');
  assert.equal(weatherBlock({ forecasts: THREE_DAYS, frost: [], criteria: [criterion] }, ALL, NOW).link.page, 'alertes-cultures');
  // Au-delà du troisième jour, l'horizon du critère ne compte pas ici.
  const later = [...THREE_DAYS, forecast('2026-11-16', 10, 33)];
  assert.equal(weatherBlock({ forecasts: later, frost: null, criteria: [criterion] }, ['alertes-meteo'], NOW).tone, 'calm');
});

test('cas 6 : une prévision indisponible ne se lit jamais « pas de gel »', () => {
  const none = weatherBlock({ forecasts: [], frost: [], criteria: [] }, ALL, NOW);
  assert.equal(none.tone, 'unknown');
  assert.deepEqual(none.lines, [FORECAST_UNAVAILABLE]);
  const partial = weatherBlock({ forecasts: THREE_DAYS.slice(0, 2), frost: [], criteria: [] }, ALL, NOW);
  assert.equal(partial.tone, 'unknown');
  assert.deepEqual(partial.lines, ['Prévision indisponible le sam. 14 nov. : à vérifier.']);
  // Tout est prévu, rien d'annoncé : la phrase calme ne dit que ce qui a été regardé.
  assert.deepEqual(weatherBlock({ forecasts: THREE_DAYS, frost: [], criteria: [] }, ALL, NOW).lines, ['Pas de gel annoncé pour vos cultures ni d’alerte météo d’ici le sam. 14 nov.']);
  assert.deepEqual(weatherBlock({ forecasts: THREE_DAYS, frost: [], criteria: null }, ['alertes-cultures'], NOW).lines, ['Pas de gel annoncé pour vos cultures d’ici le sam. 14 nov.']);
});

test('cas 7 : trois « Non faite » hier et une « En retard » ce matin, chacune avec « Ouvrir », comptées par la pastille', () => {
  const events = [
    event('m1', '2026-11-11T06:00:00.000Z', '2026-11-11T07:00:00.000Z'),
    event('m2', '2026-11-11T07:00:00.000Z', '2026-11-11T08:00:00.000Z', { beds: ['b2', 'b1'] }),
    event('m3', '2026-11-11T16:00:00.000Z', '2026-11-11T17:00:00.000Z'),
    event('late', '2026-11-12T04:00:00.000Z', '2026-11-12T06:00:00.000Z'),
    // Faite : elle ne compte pas.
    event('done', '2026-11-11T05:00:00.000Z', '2026-11-11T06:00:00.000Z', { status: 'completed' }),
  ];
  const view = todayView(inputs({ events }));
  const late = block(view.blocks, 'late');
  assert.deepEqual(late.lines.map((line) => [line.time, line.status]), [
    ['mer. 11 nov. à 7 h', 'Non faite'],
    ['mer. 11 nov. à 8 h', 'Non faite'],
    ['mer. 11 nov. à 17 h', 'Non faite'],
    ['5 h', 'En retard'],
  ]);
  assert.equal(late.lines[1].detail, 'planches P1 et P2 · 1 h · 12 mm');
  // La couleur du statut : rouge pour « Non faite », ambre pour « En retard ».
  assert.deepEqual(late.lines.map((line) => line.tone), ['missed', 'missed', 'missed', 'late']);
  assert.ok(late.lines.every((line) => line.canStart && line.open.page === 'arrosages'));
  assert.equal(late.lines[3].open.anchor, 'irrigation-late');
  assert.equal(late.empty, null);
  assert.equal(view.badge, 4);
  // Sans les arrosages cochés, la carte s'ouvre sur le planning.
  const planningOnly = todayView(inputs({ events, enabled: ['planning', 'materiel'] }));
  assert.equal(block(planningOnly.blocks, 'late').lines[0].open.page, 'planning');
});

test('cas 8 : deux irrigations planifiées et une proposition, par heure ; « Démarrer » pour les planifiées seulement', () => {
  const events = [
    event('e18', '2026-11-12T17:00:00.000Z', '2026-11-12T17:45:00.000Z', { mm: 6 }),
    event('e07', '2026-11-12T06:00:00.000Z', '2026-11-12T07:30:00.000Z'),
    // Demain : pas dans le bloc.
    event('tomorrow', '2026-11-13T06:00:00.000Z', '2026-11-13T07:00:00.000Z'),
  ];
  const proposals = [
    proposal('p20', '2026-11-12T19:00:00.000Z'),
    // Validée : son irrigation planifiée la représente déjà.
    proposal('p-validated', '2026-11-12T08:00:00.000Z', 'validated'),
    // Expirée, ou d'un autre jour : rien.
    proposal('p-expired', '2026-11-12T03:00:00.000Z'),
    proposal('p-tomorrow', '2026-11-13T19:00:00.000Z'),
  ];
  const view = todayView(inputs({ events, plan: { computedAt: '2026-11-12T05:02:00.000Z', proposals } }));
  const todo = block(view.blocks, 'todo');
  assert.deepEqual(todo.lines.map((line) => [line.time, line.status, line.canStart]), [
    ['7 h', 'Planifiée', true],
    ['18 h', 'Planifiée', true],
    ['20 h', 'À valider', false],
  ]);
  assert.equal(todo.lines[0].detail, 'planche P1 · 1 h 30 · 12 mm');
  assert.equal(todo.lines[2].title, 'Asperseur A · Buse 2');
  assert.deepEqual(todo.lines[2].open, { page: 'planning', anchor: 'proposal-p20' });
  assert.deepEqual(todo.lines.map((line) => line.tone), ['planned', 'planned', 'proposed']);
  assert.equal(block(view.blocks, 'late').empty, NOTHING_LATE);
  assert.equal(view.badge, null);
  // Le planning décoché : ses propositions ne sont pas lues.
  const withoutPlanning = todayView(inputs({ events, enabled: ['arrosages', 'materiel'], plan: { computedAt: '2026-11-12T05:02:00.000Z', proposals } }));
  assert.equal(block(withoutPlanning.blocks, 'todo').lines.length, 2);
  assert.equal(withoutPlanning.plan, null);
});

test('cas 9 : aucune irrigation ni proposition aujourd’hui, une phrase calme', () => {
  const view = todayView(inputs());
  assert.deepEqual(block(view.blocks, 'todo'), { kind: 'todo', lines: [], empty: NOTHING_TO_DO });
  assert.deepEqual(view.plan, { text: 'Plan calculé aujourd’hui à 6 h 02', linkToPlanning: false });
  assert.deepEqual(planLine(null, NOW), { text: 'Plan non calculé : ouvrir le planning', linkToPlanning: true });
  assert.equal(planLine('2026-11-10T05:00:00.000Z', NOW).text, 'Plan calculé le mar. 10 nov. à 6 h');
});

test('cas 10 : une cuve observée le 5 octobre dit sa date et ses jours, et la fiabilité propose de la saisir', () => {
  const view = todayView(inputs({ infrastructure: infrastructure([reservoir('r1', 'Cuve', '2026-10-05T07:00:00.000Z')]) }));
  assert.deepEqual(block(view.blocks, 'water').lines, ['Cuve : 12 m³ sur 20 m³, observé le 5 oct. 2026 (38 jours).']);
  const zone = block(view.blocks, 'reliability').zone;
  assert.equal(zone.shown.length, 1);
  assert.equal(zone.shown[0].text, 'Le volume de Cuve date du 5 oct. 2026 (38 jours). Le plan s’en sert pour ne pas tirer plus qu’il n’y a.');
  assert.deepEqual(zone.shown[0].action, { kind: 'link', label: 'Saisir le volume de Cuve', page: 'ressources', anchor: 'reservoir-r1' });
  // Le volume jamais saisi se dit aussi.
  const never = todayView(inputs({ infrastructure: infrastructure([reservoir('r2', 'Bassin', null, null)]) }));
  assert.deepEqual(block(never.blocks, 'water').lines, ['Bassin : volume jamais saisi.']);
  assert.equal(block(never.blocks, 'reliability').zone.shown[0].text, 'Le volume de Bassin n’a jamais été saisi. Le plan s’en sert pour ne pas tirer plus qu’il n’y a.');
  assert.equal(block(todayView(inputs({ infrastructure: infrastructure([]) })).blocks, 'water').empty, NO_WATER_TRACKED);
});

test('cas 10 bis : une ressource limitée dit ce qui reste à prélever aujourd’hui', () => {
  const water: WaterInfrastructure = {
    ...infrastructure([]),
    resources: [{ id: 'f1', name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 3, status: 'active', availableFrom: null, availableUntil: null, notes: null }],
    resourceLimits: [{ id: 'l1', resourceId: 'f1', enabled: true, maxCubicMetersPerDay: 10, validFrom: '2026-01-01', validUntil: null, referenceNote: null, createdAt: '2026-01-01T00:00:00.000Z' }],
    movements: [{ kind: 'direct_irrigation_withdrawal', resourceId: 'f1', occurredAt: '2026-11-12T04:30:00.000Z', volumeDeltaCubicMeters: -3.2 }] as unknown as WaterInfrastructure['movements'],
  };
  assert.deepEqual(block(todayView(inputs({ infrastructure: water })).blocks, 'water').lines, ['Forage : 6,8 m³ restants aujourd’hui sur 10 m³ (3,2 m³ prélevés).']);
});

test('cas 11 : sept jours pile, pas de ligne ; huit jours, la ligne', () => {
  const base = { ...FRESH, enabled: ALL, now: NOW };
  assert.deepEqual(reliabilityLines({ ...base, reservoirs: [{ id: 'r', name: 'Cuve', observedAt: '2026-11-05T17:00:00.000Z' }] }), []);
  const eight = reliabilityLines({ ...base, reservoirs: [{ id: 'r', name: 'Cuve', observedAt: '2026-11-04T17:00:00.000Z' }] });
  assert.equal(eight.length, 1);
  assert.match(eight[0].text, /date du 4 nov\. 2026 \(8 jours\)/);
});

test('cas 12 : cinq jours de pluie réelle manquants sur sept', () => {
  const lines = reliabilityLines({ ...FRESH, enabled: ALL, now: NOW, actualRainMissingDates: ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-10', '2026-11-11'] });
  assert.deepEqual(lines.map((line) => [line.text, line.action]), [[
    'Pluie réelle incomplète : 5 jours manquants. Sans elle, le besoin est surévalué.',
    { kind: 'link', label: 'Noter la pluie de la semaine', page: 'besoins', anchor: 'manual-rain' },
  ]]);
  // Une ferme tout sous abri : la pluie ne compte pas, rien à rafraîchir.
  assert.deepEqual(reliabilityLines({ ...FRESH, enabled: ALL, now: NOW, actualRainMissingDates: null }), []);
});

test('cas 13 : trois jardins jamais observés sur cinq, nommés ; les jardins observés ne comptent pas', () => {
  const garden = (plotId: string, name: string, observed: boolean, percent: number | null, unknownBeds: number) => ({
    plotId, name, observation: observed ? { observedAt: '2026-11-01T08:00:00.000Z' } : null, garden: { percent, unknownBeds },
  });
  const zones = [
    { plots: [garden('a', 'Abri 1', false, null, 4), garden('b', 'Jardin nord', true, null, 3), garden('c', 'Jardin 10', false, null, 2)] },
    { plots: [garden('d', 'Jardin 9', false, null, 1), garden('e', 'Jardin sud', false, 62, 0)] },
  ] as unknown as Parameters<typeof neverObservedSoilGardens>[0];
  const gardens = neverObservedSoilGardens(zones);
  assert.deepEqual(gardens.map((item) => item.name), ['Abri 1', 'Jardin 10', 'Jardin 9']);
  const lines = reliabilityLines({ ...FRESH, enabled: ALL, now: NOW, soilGardensNeverObserved: gardens });
  assert.equal(lines[0].text, 'Le sol de 3 jardins n’a jamais été observé : Abri 1, Jardin 9, Jardin 10.');
  assert.deepEqual(lines[0].action, { kind: 'link', label: 'Observer le sol de Abri 1', page: 'sol', anchor: 'soil-garden-a' });
  assert.equal(reliabilityLines({ ...FRESH, enabled: ALL, now: NOW, soilGardensNeverObserved: gardens.slice(0, 1) })[0].text, 'Le sol du jardin Abri 1 n’a jamais été observé.');
  assert.equal(namesText(['A', 'B', 'C', 'D', 'E']), 'A, B, C et 2 autres');
});

test('cas 14 : « Réserve du sol » décochée, la zone ne dit rien du sol', () => {
  const lines = reliabilityLines({
    ...FRESH,
    enabled: ALL.filter((id) => id !== 'sol'),
    now: NOW,
    soilGardensNeverObserved: [{ plotId: 'a', name: 'Abri 1' }],
  });
  assert.deepEqual(lines, []);
});

test('cas 15 : six manques, cinq lignes et « Voir l’autre » ; la pastille compte les six et les retards', () => {
  const view = todayView(inputs({
    infrastructure: infrastructure([reservoir('r1', 'Cuve', '2026-10-05T07:00:00.000Z'), reservoir('r2', 'Bassin', null, null)]),
    plan: { computedAt: '2026-11-09T05:00:00.000Z', proposals: [] },
    events: [event('late', '2026-11-12T04:00:00.000Z', '2026-11-12T06:00:00.000Z')],
    reliability: {
      actualRainMissingDates: ['2026-11-11'],
      soilGardensNeverObserved: [{ plotId: 'a', name: 'Abri 1' }],
      speciesWithoutReference: ['Pourpier', 'Pourpier', 'Mizuna'],
    },
  }));
  const zone = block(view.blocks, 'reliability').zone;
  assert.deepEqual([...zone.shown, ...zone.hidden].map((line) => line.kind), ['reservoir-volume', 'reservoir-volume', 'actual-rain', 'soil', 'species', 'plan']);
  assert.equal(zone.shown.length, 5);
  assert.equal(zone.moreLabel, 'Voir l’autre');
  assert.equal(zone.hidden[0].text, 'Le plan n’a pas été recalculé depuis le lun. 9 nov. à 6 h.');
  assert.deepEqual(zone.hidden[0].action, { kind: 'recalculate-plan', label: 'Recalculer le plan' });
  assert.equal(zone.shown[4].text, '2 espèces sans référence : leur besoin n’est pas calculé, seul l’objectif compte.');
  assert.equal(view.badge, 7);
  assert.equal(reliabilityZone(Array.from({ length: 8 }, () => zone.shown[0])).moreLabel, 'Voir les 3 autres');
});

test('cas 16 : tout est à jour, aucun retard : « Rien à rafraîchir », pas de pastille', () => {
  const view = todayView(inputs());
  const zone = block(view.blocks, 'reliability').zone;
  assert.deepEqual(zone, { shown: [], hidden: [], moreLabel: null, allClear: RELIABILITY_ALL_CLEAR });
  assert.equal(view.badge, null);
});

test('les blocs suivent leurs cases, dans l’ordre du contrat, et jamais cachés parce que vides', () => {
  assert.deepEqual(todayView(inputs()).blocks.map((item) => item.kind), ['weather', 'late', 'todo', 'water', 'reliability']);
  assert.deepEqual(todayView(inputs({ enabled: ['alertes-meteo'] })).blocks.map((item) => item.kind), ['weather']);
  assert.deepEqual(todayView(inputs({ enabled: ['besoins', 'materiel'], infrastructure: null })).blocks.map((item) => item.kind), ['reliability']);
  // Le plan non calculé, planning coché : la ligne de fiabilité le dit aussi.
  const noPlan = todayView(inputs({ plan: null }));
  assert.equal(block(noPlan.blocks, 'reliability').zone.shown[0].text, 'Le plan de la semaine n’a pas été calculé.');
});

test('la liste fermée des cinq données, et le « ? » qui écrit chaque seuil', () => {
  assert.deepEqual([...RELIABILITY_KINDS], ['reservoir-volume', 'actual-rain', 'soil', 'species', 'plan']);
  const help = reliabilityThresholdsText();
  assert.match(help, /plus de 7 jours/);
  assert.match(help, /7 derniers jours/);
  assert.match(help, /plus de 48 heures/);
  assert.equal(durationText(5400), '1 h 30');
  assert.equal(durationText(2700), '45 min');
  assert.equal(durationText(7200), '2 h');
});

test('les ancres des gestes sont celles que portent les cartes, et la pluie manquante se dit dans les mêmes mots partout (F9)', () => {
  // Les écrans posent ces ancres sur la carte de la proposition, de la réserve et du jardin (PR 3).
  assert.equal(proposalAnchor('p20'), 'proposal-p20');
  assert.equal(reservoirAnchor('r1'), 'reservoir-r1');
  assert.equal(soilGardenAnchor('jardin-sud'), 'soil-garden-jardin-sud');
  // L'avertissement du tableau des besoins reprend la conséquence de la ligne.
  const [rain] = reliabilityLines({ ...FRESH, enabled: ALL, now: NOW, actualRainMissingDates: ['2026-11-11'] });
  assert.ok(rain.text.endsWith(ACTUAL_RAIN_CONSEQUENCE));
  assert.equal(rain.text, 'Pluie réelle incomplète : 1 jour manquant. Sans elle, le besoin est surévalué.');
});

test('F2 : la saison de « Aujourd’hui » est celle du jour de la ferme, même la nuit du Nouvel An', () => {
  assert.equal(todaySeason(NOW), 2026);
  // 23 h 30 à Greenwich, 0 h 30 à Paris : déjà la saison suivante.
  assert.equal(todaySeason(new Date('2026-12-31T23:30:00.000Z')), 2027);
});
