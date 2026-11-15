import assert from 'node:assert/strict';
import test from 'node:test';
import { volumeText } from '../lib/domain/display-numbers.ts';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue.ts';
import type { StoredProposal, StoredWeeklyPlan, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { shortageAction } from '../lib/domain/planning/shortage-reading.ts';
import { todayTomorrow } from '../lib/domain/today/ahead.ts';
import { todayView, type TodayBlock, type TodayInputs } from '../lib/domain/today/today-view.ts';
import { waterBlock } from '../lib/domain/today/water.ts';
import type { WaterInfrastructure, WaterReservoir } from '../lib/domain/water-resources.ts';
import type { WeatherAlertForecastDay } from '../lib/domain/weather/weather-alerts.ts';
import { farm, settings } from './support/planning-fixtures.ts';

/**
 * Audit ergonomique final, lot A : le matin, l'essentiel
 * (docs/audit-ergonomie-final-lot-a-contract.md), PR 1, R1 : « Aujourd'hui »
 * annonce les arrosages de demain à valider et l'eau qui manque à la
 * semaine, avec la phrase du planning (F274 à F279). Affichage seul : rien
 * n'est recalculé, tout se lit sur le plan enregistré.
 * Aujourd'hui = jeudi 12 novembre 2026, 6 h 00 à la ferme.
 */

const ALL: FeatureId[] = [...FEATURE_IDS];
const NOW = new Date('2026-11-12T05:00:00.000Z');
const HOUR_MS = 3_600_000;

function proposal(storedId: string, startAt: string, status: StoredProposal['status'] = 'proposed'): StoredProposal {
  return {
    storedId,
    status,
    startAt,
    endAt: new Date(Date.parse(startAt) + HOUR_MS).toISOString(),
    durationSeconds: 3600,
    doseMm: 8,
    equipmentName: 'Asperseur A',
    settingName: 'Buse 2',
    applications: [{ otfBedId: 'b2' }],
  } as unknown as StoredProposal;
}

const forecast = (date: string): WeatherAlertForecastDay => ({
  date, minimumTemperatureCelsius: 6, maximumTemperatureCelsius: 14, precipitationMm: 0, forecastedAt: '2026-11-12T04:00:00.000Z',
});

function inputs(overrides: Partial<TodayInputs> = {}): TodayInputs {
  return {
    enabled: ALL,
    now: NOW,
    weather: { forecasts: [forecast('2026-11-12'), forecast('2026-11-13'), forecast('2026-11-14')], frost: [], criteria: [] },
    events: [],
    lateToleranceMinutes: 30,
    plan: { computedAt: '2026-11-12T05:02:00.000Z', proposals: [] },
    shortagePlan: null,
    bedNames: new Map([['b2', 'P2']]),
    infrastructure: null,
    reliability: { actualRainMissingDates: [], soilGardensNeverObserved: [], speciesWithoutReference: [] },
    week: null,
    soil: null,
    ...overrides,
  };
}

/** Le plan tel que le service l'enregistre (comme dans les tests du lot B) : la phrase se lit sur le plan enregistré. */
function stored(plan: WeeklyPlan): StoredWeeklyPlan {
  const { weekStart, weekEnd, computedAt, horizonStartAt, horizonEndAt, beds, deficit, budgets, assumptions, suggestions, overcommittedDays, arbitration } = plan;
  return {
    calculation: {
      id: 'calcul', season: 2026, weekStart, trigger: 'manual', triggerEvent: null, computedAt, horizonStartAt, horizonEndAt, settings: plan.settings,
      summary: { weekEnd, beds, deficit, budgets, assumptions, suggestions, overcommittedDays, changes: null, ...(arbitration ? { arbitration } : {}) },
    },
    proposals: [],
    suggestions: [],
    pendingEvent: null,
  };
}

/** La ferme à quatre tunnels, une réserve de 12 m³ sans forage : l'eau manque (le jeu S12 de la 3.9). */
const shortagePlan = () => stored(buildWeeklyPlan(farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: 12 }).inputs, settings));
/** La même, avec assez d'eau : aucun manque. */
const calmPlan = () => stored(buildWeeklyPlan(farm({}).inputs, settings));

function arbitrated(plan: StoredWeeklyPlan): StoredWeeklyPlan {
  const arbitration = { allocatedCubicMeters: 2, reservedCubicMeters: 2, unreceivedCubicMeters: 0, unreceivedBedCount: 0 };
  return { ...plan, calculation: { ...plan.calculation, summary: { ...plan.calculation.summary, arbitration } } };
}

function block<K extends TodayBlock['kind']>(blocks: TodayBlock[], kind: K): Extract<TodayBlock, { kind: K }> {
  const found = blocks.find((item) => item.kind === kind);
  assert.ok(found, `bloc ${kind}`);
  return found as Extract<TodayBlock, { kind: K }>;
}

const withProposals = (proposals: StoredProposal[]) => ({ plan: { computedAt: '2026-11-12T05:02:00.000Z', proposals } });

// R1, demain (F274, F275).

test('cas 1 : trois arrosages à valider demain à 6 h, rien aujourd’hui : la ligne, la pastille, une phrase sans « Rien d’urgent »', () => {
  const view = todayView(inputs(withProposals([
    proposal('p2', '2026-11-13T05:00:00.000Z'),
    proposal('p1', '2026-11-13T05:00:00.000Z'),
    proposal('p3', '2026-11-13T05:00:00.000Z'),
  ])));
  assert.deepEqual(view.tomorrow, {
    count: 3,
    text: 'Demain à 6 h : 3 arrosages à valider',
    sentence: '3 arrosages sont à valider demain à 6 h.',
    link: { page: 'planning', anchor: 'proposal-p1' },
  });
  assert.equal(view.headline.sentence, '3 arrosages sont à valider demain à 6 h.');
  const chips = view.headline.chips.map((chip) => [chip.key, chip.text]);
  assert.ok(chips.some(([key, text]) => key === 'tomorrow' && text === '3 à valider demain'), JSON.stringify(chips));
  assert.ok(!chips.some(([key]) => key === 'nothing'), '« Rien à arroser » ne se dit plus quand demain parle (F277)');
  // Le jour reste vide : demain n'entre pas dans « À faire aujourd'hui ».
  assert.equal(block(view.blocks, 'todo').lines.length, 0);
});

test('F275 : un créneau de 0 h 30 compte pour demain ; après-demain, aujourd’hui, une proposition décidée ou expirée, non ; « dès » la première heure', () => {
  const tomorrow = todayTomorrow([
    proposal('nuit', '2026-11-12T23:30:00.000Z'),
    proposal('matin', '2026-11-13T05:00:00.000Z'),
    proposal('aujourdhui', '2026-11-12T16:00:00.000Z'),
    proposal('apres-demain', '2026-11-14T05:00:00.000Z'),
    proposal('validee', '2026-11-13T06:00:00.000Z', 'validated'),
    proposal('refusee', '2026-11-13T06:00:00.000Z', 'refused'),
  ], NOW);
  assert.equal(tomorrow?.count, 2);
  assert.equal(tomorrow?.text, 'Demain dès 0 h 30 : 2 arrosages à valider');
  assert.equal(tomorrow?.sentence, '2 arrosages sont à valider demain dès 0 h 30.');
  assert.equal(tomorrow?.link.anchor, 'proposal-nuit');
  const one = todayTomorrow([proposal('seule', '2026-11-13T17:30:00.000Z')], NOW);
  assert.equal(one?.text, 'Demain à 18 h 30 : 1 arrosage à valider');
  assert.equal(one?.sentence, 'Un arrosage est à valider demain à 18 h 30.');
  // Le lendemain du créneau passé : une proposition de demain dont la fin est passée est expirée.
  assert.equal(todayTomorrow([proposal('p', '2026-11-13T05:00:00.000Z')], new Date('2026-11-13T07:00:00.000Z')), null);
  assert.equal(todayTomorrow([], NOW), null);
});

// R1, l'eau qui manque (F276, F277).

test('cas 2 : en pénurie, la répartition en attente : la phrase du planning, « Répartir l’eau », la pastille orange en tête', () => {
  const plan = shortagePlan();
  const view = todayView(inputs({ shortagePlan: plan }));
  const planning = shortageAction(plan, volumeText);
  assert.ok(planning, 'le jeu manque d’eau');
  assert.deepEqual(view.shortage, {
    sentence: planning.sentence,
    arbitrated: false,
    decisionPending: true,
    link: { label: 'Répartir l’eau', page: 'ressources', anchor: 'repartition' },
  });
  assert.match(view.shortage?.sentence ?? '', /^Il manque .+ d’eau d’ici dimanche : \d+ planches ne recevront pas tout leur besoin\.$/);
  assert.deepEqual(view.headline.chips[0], { key: 'shortage', tone: 'shortage', icon: 'drop', text: 'L’eau manque', target: 'shortage' });
  assert.ok(!view.headline.chips.some((chip) => chip.key === 'nothing'), '« Rien à arroser » ne se dit plus quand la semaine parle (F277)');
  assert.doesNotMatch(view.headline.sentence, /Rien d’urgent/);
  // La phrase de résumé ne redit pas le manque : l'encadré le dit, avec la phrase du planning.
  assert.doesNotMatch(view.headline.sentence, /manque/);
});

test('cas 3 : la répartition validée : « Revoir la répartition », sans pastille orange', () => {
  const plan = arbitrated(shortagePlan());
  const view = todayView(inputs({ shortagePlan: plan }));
  assert.equal(view.shortage?.arbitrated, true);
  assert.equal(view.shortage?.decisionPending, false);
  assert.match(view.shortage?.sentence ?? '', /^Votre répartition s’applique : /);
  assert.equal(view.shortage?.link?.label, 'Revoir la répartition');
  assert.ok(!view.headline.chips.some((chip) => chip.key === 'shortage'));
  assert.doesNotMatch(view.headline.sentence, /Rien d’urgent/);
});

test('cas 4 : « Planning » décoché : ni ligne ni pastille de demain ni de l’eau', () => {
  const enabled = ALL.filter((feature) => feature !== 'planning');
  const view = todayView(inputs({ enabled, shortagePlan: shortagePlan(), ...withProposals([proposal('p1', '2026-11-13T05:00:00.000Z')]) }));
  assert.equal(view.tomorrow, null);
  assert.equal(view.shortage, null);
  assert.ok(!view.headline.chips.some((chip) => chip.key === 'shortage' || chip.key === 'tomorrow'));
  assert.match(view.headline.sentence, /^Rien d’urgent aujourd’hui\./);
});

test('cas 5 : la faisabilité inactive : la phrase de l’eau, sans lien « Répartir l’eau »', () => {
  for (const off of ['ressources', 'besoins'] as const) {
    const view = todayView(inputs({ enabled: ALL.filter((feature) => feature !== off), shortagePlan: shortagePlan() }));
    assert.ok(view.shortage, `sans « ${off} », la phrase reste`);
    assert.equal(view.shortage?.link, null, `sans « ${off} », pas de lien`);
  }
});

test('cas 10 : une ferme sans rien d’annoncé, à valider ni qui manque : « Rien d’urgent aujourd’hui. » comme avant', () => {
  const view = todayView(inputs({ shortagePlan: calmPlan(), ...withProposals([proposal('apres-demain', '2026-11-14T05:00:00.000Z')]) }));
  assert.equal(view.tomorrow, null);
  assert.equal(view.shortage, null);
  assert.equal(view.headline.sentence, 'Rien d’urgent aujourd’hui. Pas de gel annoncé pour vos cultures ni d’alerte météo d’ici le sam. 14 nov.');
  assert.equal(view.headline.chips[0].text, 'Rien à arroser');
});

// R1, l'eau disponible (F279).

function reservoir(volume: number | null, minimum: number): WaterReservoir {
  return {
    id: 'r1', name: 'Bassin', type: 'tank', capacityCubicMeters: 20, currentVolumeCubicMeters: volume, currentVolumeObservedAt: '2026-11-12T04:00:00.000Z',
    minimumSafetyCubicMeters: minimum, exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false,
    evaporationCoefficient: 1, status: 'active', notes: null,
  };
}

function water(reservoirs: WaterReservoir[]): WaterInfrastructure {
  return { resources: [], resourceLimits: [], reservoirs, resourceReservoirLinks: [], reservoirLinks: [], defaultSupply: null, movements: [] };
}

test('F279 : un bassin sous son minimum de sécurité le dit en mots ; au minimum, au-dessus ou au volume inconnu, non', () => {
  const below = waterBlock(water([reservoir(1.5, 2)]), NOW);
  assert.equal(below.reservoirs[0].belowMinimumText, 'sous son minimum de 2 m³');
  assert.equal(below.lines[0], 'Bassin : 1,5 m³ sur 20 m³, sous son minimum de 2 m³, observé aujourd’hui.');
  assert.equal(waterBlock(water([reservoir(2, 2)]), NOW).reservoirs[0].belowMinimumText, null);
  assert.equal(waterBlock(water([reservoir(12, 2)]), NOW).reservoirs[0].belowMinimumText, null);
  assert.equal(waterBlock(water([reservoir(0, 0)]), NOW).reservoirs[0].belowMinimumText, null, 'un minimum nul n’est jamais franchi');
  assert.equal(waterBlock(water([reservoir(null, 2)]), NOW).reservoirs[0].belowMinimumText, null, 'un volume inconnu n’est jamais dit sous le minimum (D-003)');
});
