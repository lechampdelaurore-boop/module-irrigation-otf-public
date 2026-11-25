import assert from 'node:assert/strict';
import test from 'node:test';
import type { CropPlan } from '../lib/domain/domain.ts';
import { bedSoilReserve } from '../lib/domain/soil-reserve/gauge.ts';
import type { SoilGaugeBed, SoilGaugePlot } from '../lib/domain/soil-reserve/gauge-view.ts';
import { soilReserveSummary } from '../lib/domain/soil-reserve/signals.ts';
import {
  bedIdFromStageAnchor,
  bedStageAnchor,
  guessedStages,
  hasMissingByBed,
  lastMeasuredRainOn,
  MISSING_BY_BED_ALL_CLEAR,
  MISSING_BY_BED_ANCHOR,
  MISSING_BY_BED_KINDS,
  missingByBed,
  missingByBedBeds,
  NO_CULTURE_GROUP,
  rainGaugeLookbackStart,
  unknownSoilBeds,
  type MissingByBedBed,
  type MissingByBedInputs,
} from '../lib/domain/today/missing-by-bed.ts';
import { RAIN_GAUGE_MAX_AGE_DAYS, reliabilityThresholdsText } from '../lib/domain/today/reliability.ts';
import { todayView, type TodayInputs } from '../lib/domain/today/today-view.ts';
import { crop, cropDay, cropWithoutKc, observation, soilInput, soilRecord, staged } from './support/soil-reserve-fixtures.ts';

/**
 * Amélioration n° 6 : le panneau « données manquantes », planche par planche
 * (docs/ameliorations-6-2-3-7-contract.md, section 3, F700, F701, F710 et F711). Trois
 * données par planche — la réserve du sol non saisie, le stade deviné, le
 * pluviomètre absent —, chacune avec sa phrase, sa conséquence et son geste ;
 * une case décochée ne compte pas ; une ferme sans manque le dit. Le parcours
 * P52 le montre à l'écran.
 */

const TODAY = '2026-11-08';
const ALL: MissingByBedInputs['enabled'] = ['sol', 'cultures', 'besoins', 'arrosages', 'materiel'];

function bed(bedId: string, options: Partial<MissingByBedBed> = {}): MissingByBedBed {
  return { bedId, bedName: bedId, zoneId: 'z1', plotName: 'Jardin Sud', sheltered: false, cultures: ['Laitue'], ...options };
}

const FRESH: MissingByBedInputs = {
  enabled: ALL,
  today: TODAY,
  beds: [],
  unknownSoilBeds: [],
  guessedStages: [],
  lastMeasuredRainOn: TODAY,
};

function lines(input: Partial<MissingByBedInputs>) {
  return missingByBed({ ...FRESH, ...input }).groups.flatMap((group) => group.beds.flatMap((item) => item.lines));
}

test('la liste fermée des trois données par planche, et le panneau n’existe qu’avec l’une de leurs cases', () => {
  assert.deepEqual([...MISSING_BY_BED_KINDS], ['soil', 'stage', 'rain-gauge']);
  assert.equal(hasMissingByBed(['sol']), true);
  assert.equal(hasMissingByBed(['cultures']), true);
  assert.equal(hasMissingByBed(['besoins']), true);
  assert.equal(hasMissingByBed(['arrosages', 'materiel', 'ressources', 'planning']), false);
});

test('une planche par cas : la réserve du sol non saisie, faute d’observation ou de RFU', () => {
  const observed = lines({
    beds: [bed('B1')],
    unknownSoilBeds: [{ bedId: 'B1', plotId: 'jardin-sud', plotName: 'Jardin Sud', withoutRfu: null }],
  });
  assert.deepEqual(observed.map((line) => [line.kind, line.text, line.action]), [[
    'soil',
    'Réserve du sol non saisie : le sol du jardin Jardin Sud n’a jamais été observé. La jauge de la planche reste inconnue.',
    { kind: 'link', label: 'Observer le sol de Jardin Sud', page: 'sol', anchor: 'soil-garden-jardin-sud' },
  ]]);
  const withoutRfu = lines({
    beds: [bed('B1')],
    unknownSoilBeds: [{ bedId: 'B1', plotId: 'jardin-sud', plotName: 'Jardin Sud', withoutRfu: { zoneId: 'z1', zoneName: 'Les Prés' } }],
  });
  assert.deepEqual(withoutRfu.map((line) => [line.text, line.action]), [[
    'Réserve du sol non saisie : ce que le sol de la parcelle Les Prés retient (sa RFU) manque. La jauge de la planche reste inconnue.',
    { kind: 'link', label: 'Renseigner la réserve de la parcelle Les Prés', page: 'sol', anchor: 'soil-parcel-z1' },
  ]]);
});

test('une planche par cas : le stade deviné d’après le calendrier, et son geste mène au formulaire de la planche', () => {
  const found = lines({
    beds: [bed('B2', { zoneId: 'z2' })],
    guessedStages: [{ bedId: 'B2', seriesId: 's1', seriesName: 'Tomates 1', plantName: 'Tomate', stageLabel: 'Floraison' }],
  });
  assert.deepEqual(found.map((line) => [line.kind, line.key, line.text, line.action]), [[
    'stage',
    'stage:B2:s1',
    'Stade deviné : Tomate (Tomates 1), stade « Floraison » d’après la date d’implantation et le calendrier. Le besoin proposé suit le calendrier, pas votre constat.',
    { kind: 'link', label: 'Déclarer le stade', page: 'materiel', anchor: 'bed-stage-B2', zone: 'z2' },
  ]]);
  assert.equal(bedStageAnchor('B2'), 'bed-stage-B2');
  assert.equal(bedIdFromStageAnchor('#bed-stage-B2'), 'B2');
  assert.equal(bedIdFromStageAnchor('#bed-stage-planche%20a'), 'planche a');
  assert.equal(bedIdFromStageAnchor('#bed-stage-'), null);
  assert.equal(bedIdFromStageAnchor('#soil-garden-B2'), null);
});

test('une planche par cas : le pluviomètre absent, sur une planche de plein champ qui porte une culture', () => {
  const found = lines({ beds: [bed('B3')], lastMeasuredRainOn: null });
  assert.deepEqual(found.map((line) => [line.kind, line.text, line.action]), [[
    'rain-gauge',
    'Pluviomètre absent : aucune pluie mesurée n’est notée depuis plus de 30 jours. La pluie vient de l’estimation météo, qui peut s’écarter du terrain.',
    { kind: 'link', label: 'Saisir une pluie mesurée, même 0 mm', page: 'besoins', anchor: 'manual-rain' },
  ]]);
  // Une planche sans culture ne dépend pas de la pluie ; une planche sous abri non plus (la pluie y vaut 0).
  assert.deepEqual(lines({ beds: [bed('B3', { cultures: [] }), bed('A1', { sheltered: true })], lastMeasuredRainOn: null }), []);
});

test('le seuil de trente jours, à la veille et au jour (F701)', () => {
  assert.equal(RAIN_GAUGE_MAX_AGE_DAYS, 30);
  assert.equal(rainGaugeLookbackStart(TODAY), '2026-10-09', 'la lecture commence à J − 30');
  assert.deepEqual(lines({ beds: [bed('B3')], lastMeasuredRainOn: '2026-10-09' }), [], 'il y a trente jours : la pluie mesurée compte encore');
  const late = lines({ beds: [bed('B3')], lastMeasuredRainOn: '2026-10-08' });
  assert.equal(late.length, 1, 'il y a trente et un jours : le pluviomètre est dit absent');
  assert.match(late[0].text, /^Pluviomètre absent : la dernière pluie mesurée date du 8 oct\. 2026 \(31 jours\)\./);
  // Le « ? » de la zone écrit ce seuil (section 3, règle 5).
  assert.match(reliabilityThresholdsText(), /aucune pluie mesurée n’est notée depuis plus de 30 jours/);
  assert.match(reliabilityThresholdsText(), /ne changent aucun calcul\.$/);
});

test('la dernière pluie mesurée : 0 mm compte, la réanalyse et la prévision non', () => {
  assert.equal(lastMeasuredRainOn([
    { date: '2026-11-01', dataKind: 'manual_precipitation', precipitationMm: 0 },
    { date: '2026-10-20', dataKind: 'manual_precipitation', precipitationMm: 12 },
    { date: '2026-11-07', dataKind: 'reanalysis', precipitationMm: 3 },
    { date: '2026-11-08', dataKind: 'forecast', precipitationMm: 1 },
  ]), '2026-11-01');
  assert.equal(lastMeasuredRainOn([{ date: '2026-11-07', dataKind: 'reanalysis', precipitationMm: 3 }]), null);
});

test('une donnée dont la case n’est pas cochée ne compte pas', () => {
  const input: Partial<MissingByBedInputs> = {
    beds: [bed('B1')],
    unknownSoilBeds: [{ bedId: 'B1', plotId: 'p', plotName: 'Jardin Sud', withoutRfu: null }],
    guessedStages: [{ bedId: 'B1', seriesId: 's1', seriesName: 'Laitues', plantName: 'Laitue', stageLabel: 'Pommaison' }],
    lastMeasuredRainOn: null,
  };
  assert.deepEqual(lines(input).map((line) => line.kind), ['soil', 'stage', 'rain-gauge']);
  assert.deepEqual(lines({ ...input, enabled: ['cultures', 'besoins'] }).map((line) => line.kind), ['stage', 'rain-gauge'], 'sans « Réserve du sol »');
  assert.deepEqual(lines({ ...input, enabled: ['sol', 'besoins'] }).map((line) => line.kind), ['soil', 'rain-gauge'], 'sans « Besoin par culture »');
  assert.deepEqual(lines({ ...input, enabled: ['sol', 'cultures'] }).map((line) => line.kind), ['soil', 'stage'], 'sans « Objectifs et besoins »');
  // Une donnée non lue (`null`) ne se devine pas : aucune ligne, jamais une alarme inventée.
  assert.deepEqual(lines({ ...input, unknownSoilBeds: null, guessedStages: null }).map((line) => line.kind), ['rain-gauge']);
});

test('une ferme tout sous abri n’a pas de pluviomètre à réclamer', () => {
  const sheltered = missingByBed({ ...FRESH, beds: [bed('T1', { sheltered: true }), bed('T2', { sheltered: true })], lastMeasuredRainOn: null });
  assert.deepEqual(sheltered.groups, []);
  assert.equal(sheltered.allClear, MISSING_BY_BED_ALL_CLEAR);
});

test('une ferme sans donnée manquante dit « Tout est à jour », jamais une zone vide', () => {
  const clear = missingByBed({ ...FRESH, beds: [bed('B1'), bed('B2')] });
  assert.deepEqual(clear, { groups: [], total: null, allClear: 'Tout est à jour : aucune planche n’a de donnée manquante.', moreLabel: null });
  assert.equal(MISSING_BY_BED_ANCHOR, 'donnees-manquantes');
});

test('par culture puis par planche, par effet sur le plan, puis par ordre naturel des noms ; cinq planches d’emblée', () => {
  const view = missingByBed({
    ...FRESH,
    beds: [
      bed('B10', { cultures: ['Laitue'] }),
      bed('B9', { cultures: ['Laitue'] }),
      bed('B2', { cultures: ['Tomate'] }),
      bed('B1', { cultures: ['Tomate'] }),
      bed('C1', { cultures: ['Carotte', 'Radis'] }),
      bed('V1', { cultures: [] }),
      bed('A1', { cultures: ['Tomate'], sheltered: true }),
    ],
    unknownSoilBeds: [
      { bedId: 'B2', plotId: 'p', plotName: 'Jardin Sud', withoutRfu: null },
      { bedId: 'V1', plotId: 'p', plotName: 'Jardin Sud', withoutRfu: null },
    ],
    guessedStages: [
      { bedId: 'B10', seriesId: 'l', seriesName: 'Laitues', plantName: 'Laitue', stageLabel: 'Pommaison' },
      { bedId: 'A1', seriesId: 't', seriesName: 'Tomates', plantName: 'Tomate', stageLabel: 'Floraison' },
    ],
    lastMeasuredRainOn: null,
  });
  assert.deepEqual(view.groups.map((group) => [group.culture, group.beds.map((item) => [item.bedId, item.lines.map((line) => line.kind), item.hidden])]), [
    // La réserve du sol d'abord : la tomate de B2, puis la planche vide.
    ['Tomate', [['B2', ['soil', 'rain-gauge'], false], ['A1', ['stage'], false], ['B1', ['rain-gauge'], false]]],
    [NO_CULTURE_GROUP, [['V1', ['soil'], false]]],
    // Puis le stade : B10 avant B9 par son stade, malgré l'ordre naturel des noms.
    ['Laitue', [['B10', ['stage', 'rain-gauge'], false], ['B9', ['rain-gauge'], true]]],
    ['Carotte, Radis', [['C1', ['rain-gauge'], true]]],
  ]);
  // Les cinq premières planches dans l'ordre de l'écran ; les autres derrière « Voir les 2 autres planches ».
  assert.equal(view.total, '7 planches ont une donnée manquante');
  assert.equal(view.moreLabel, 'Voir les 2 autres planches');
  assert.equal(missingByBed({ ...FRESH, beds: [bed('B1')], lastMeasuredRainOn: null }).total, '1 planche a une donnée manquante');
});

test('les stades devinés : une culture sans déclaration, jamais une déclarée ni une sans référence', () => {
  const declaration = { seriesId: 'serie-tomate', bedId: null, referenceCropId: 'tomate', rank: 2, date: '2026-10-01', recordedAt: '2026-10-01T08:00:00.000Z' };
  const found = guessedStages([
    { bedId: 'B1', days: [cropDay(TODAY, [crop({ referenceCropId: 'laitue', name: 'Laitue', stage: staged(2, '2026-10-20', { label: 'Pommaison' }) })])] },
    { bedId: 'B2', days: [cropDay(TODAY, [crop({ referenceCropId: 'tomate', name: 'Tomate', stage: staged(2, '2026-10-01', { origin: 'observed', declaration }) })])] },
    // Recalé sur une déclaration, un stade calculé reste un stade déclaré (D-057).
    { bedId: 'B3', days: [cropDay(TODAY, [crop({ referenceCropId: 'tomate', name: 'Tomate', stage: staged(3, '2026-10-15', { declaration }) })])] },
    { bedId: 'B4', days: [cropDay(TODAY, [cropWithoutKc('Physalis')])] },
    // L'ET0 manque : le stade est connu, deviné quand même.
    { bedId: 'B5', days: [cropDay(TODAY, [crop({ referenceCropId: 'chou', name: 'Chou', etmMm: null })])] },
    { bedId: 'B6', days: [cropDay('2026-11-07', [crop({ referenceCropId: 'chou', name: 'Chou' })])] },
  ], TODAY);
  assert.deepEqual(found, [
    { bedId: 'B1', seriesId: 'serie-laitue', seriesName: 'Série Laitue', plantName: 'Laitue', stageLabel: 'Pommaison' },
    { bedId: 'B5', seriesId: 'serie-chou', seriesName: 'Série Chou', plantName: 'Chou', stageLabel: 'Stade 2' },
  ]);
});

function gaugeBed(bedId: string, reason: 'no-soil' | 'not-started' | null): SoilGaugeBed {
  const day = cropDay(TODAY, [crop({ etmMm: 0 })]);
  const days = reason === null
    ? bedSoilReserve(soilInput({ waterDays: [day], observations: [observation(80, '2026-11-07T23:00:00.000Z')], today: TODAY }))
    : bedSoilReserve(soilInput({ waterDays: [day], soilRecords: reason === 'no-soil' ? [] : [soilRecord()], today: TODAY }));
  return { bedId, name: bedId, summary: soilReserveSummary(days, TODAY), today: days[0] ?? null, week: [] };
}

function gaugePlot(plotId: string, beds: SoilGaugeBed[], observed = false): SoilGaugePlot {
  const known = beds.filter((item) => item.summary.current !== null).length;
  return {
    plotId,
    name: plotId,
    sheltered: false,
    garden: { percent: known > 0 ? 80 : null, lowest: null, countedBeds: known, unknownBeds: beds.length - known, withoutCrop: [] },
    week: [],
    observation: observed ? observation(50, '2026-11-07T08:00:00.000Z', plotId, 'z1') : null,
    beds,
  };
}

test('la réserve du sol non saisie se lit planche par planche, à partir des jardins que la zone nomme', () => {
  const zones = [
    { zoneId: 'z1', name: 'Les Prés', plots: [
      gaugePlot('Jardin Nord', [gaugeBed('N1', 'no-soil'), gaugeBed('N2', 'no-soil')], true),
      gaugePlot('Jardin Est', [gaugeBed('E1', 'not-started')]),
      // Observé, avec sa RFU : la ligne de la pluie le dit déjà, pas celle du sol.
      gaugePlot('Jardin Ouest', [gaugeBed('O1', 'not-started')], true),
      gaugePlot('Jardin Sud', [gaugeBed('S1', null)]),
    ] },
  ];
  assert.deepEqual(unknownSoilBeds(zones), [
    { bedId: 'N1', plotId: 'Jardin Nord', plotName: 'Jardin Nord', withoutRfu: { zoneId: 'z1', zoneName: 'Les Prés' } },
    { bedId: 'N2', plotId: 'Jardin Nord', plotName: 'Jardin Nord', withoutRfu: { zoneId: 'z1', zoneName: 'Les Prés' } },
    { bedId: 'E1', plotId: 'Jardin Est', plotName: 'Jardin Est', withoutRfu: null },
  ]);
});

const CROP_PLAN: CropPlan = {
  series: [
    { id: 'laitues', name: 'Laitues', season: 2026, use: 'bed', cycle: 'annual', cultivations: [{ id: 'c1', plantId: 'p1', plantName: 'Laitue', harvestWeeks: [], harvestWeeksExpected: ['2026-W48'] }] },
    { id: 'radis', name: 'Radis', season: 2026, use: 'bed', cycle: 'annual', cultivations: [{ id: 'c2', plantId: 'p2', plantName: 'Radis', harvestWeeks: [], harvestWeeksExpected: ['2026-W47'] }] },
    { id: 'carottes', name: 'Carottes', season: 2026, use: 'bed', cycle: 'annual', cultivations: [{ id: 'c3', plantId: 'p3', plantName: 'Carotte', harvestWeeks: ['2026-W30'], harvestWeeksExpected: [] }] },
    { id: 'endives', name: 'Endives', season: 2026, use: 'block', cycle: 'annual', cultivations: [{ id: 'c4', plantId: 'p4', plantName: 'Endive', harvestWeeks: [], harvestWeeksExpected: ['2026-W50'] }] },
  ],
  places: [
    { id: 'pl1', seriesId: 'laitues', bedId: 'B1', lengthMeters: 30 },
    { id: 'pl2', seriesId: 'radis', bedId: 'B1', lengthMeters: 30 },
    { id: 'pl3', seriesId: 'carottes', bedId: 'B2', lengthMeters: 30 },
    { id: 'pl4', seriesId: 'endives', bedId: 'B2', lengthMeters: 30 },
  ],
  implantationTasks: [
    { id: 't1', seriesId: 'laitues', cultivationId: null, kind: 'planting', plannedWeek: '2026-W40', doneWeek: '2026-W40', status: 'done' },
    { id: 't2', seriesId: 'radis', cultivationId: null, kind: 'direct-sowing', plannedWeek: '2026-W43', doneWeek: '2026-W43', status: 'done' },
    { id: 't3', seriesId: 'carottes', cultivationId: null, kind: 'direct-sowing', plannedWeek: '2026-W12', doneWeek: '2026-W12', status: 'done' },
    { id: 't4', seriesId: 'endives', cultivationId: null, kind: 'direct-sowing', plannedWeek: '2026-W40', doneWeek: '2026-W40', status: 'done' },
  ],
  readSummary: { seriesRead: 4, placesRead: 4, tasksRead: 4, tasksRetained: 4, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
};

test('les planches de la saison et leurs cultures du jour, sans les séries en bloc (D-022) ni les planches hors saison', () => {
  const snapshot = {
    plots: [
      { id: 'jardin', zoneId: 'z1', name: 'Jardin Sud', mode: 'garden' as const, length: 10, width: 10, area: 100, seasons: [2026] },
      { id: 'tunnel', zoneId: 'z1', name: 'Tunnel 1', mode: 'greenhouse' as const, length: 10, width: 10, area: 100, seasons: [2026] },
    ],
    beds: [
      { id: 'B1', zoneId: 'z1', plotId: 'jardin', name: 'B1', length: 30, width: 1, alleyWidth: null, area: 30, seasons: [2026] },
      { id: 'B2', zoneId: 'z1', plotId: 'tunnel', name: 'B2', length: 30, width: 1, alleyWidth: null, area: 30, seasons: [2026] },
      { id: 'B3', zoneId: 'z1', plotId: 'jardin', name: 'B3', length: 30, width: 1, alleyWidth: null, area: 30, seasons: [2025] },
    ],
    cropPlan: CROP_PLAN,
  };
  assert.deepEqual(missingByBedBeds(snapshot, 2026, TODAY), [
    { bedId: 'B1', bedName: 'B1', zoneId: 'z1', plotName: 'Jardin Sud', sheltered: false, cultures: ['Laitue', 'Radis'] },
    // Les carottes sont récoltées depuis juillet ; les endives sont en bloc : la planche n'a pas de culture en cours.
    { bedId: 'B2', bedName: 'B2', zoneId: 'z1', plotName: 'Tunnel 1', sheltered: true, cultures: [] },
  ]);
  // Sans plan de culture lu, aucune culture n'est devinée.
  assert.deepEqual(missingByBedBeds({ ...snapshot, cropPlan: undefined }, 2026, TODAY).map((item) => item.cultures), [[], []]);
});

test('« Aujourd’hui » : le dépliant vit dans la zone « Fiabilité du calcul », sans toucher la pastille ni l’anneau (F710)', () => {
  const base: TodayInputs = {
    enabled: ALL,
    now: new Date('2026-11-08T08:00:00.000Z'),
    weather: { forecasts: [], frost: null, criteria: null },
    events: [],
    lateToleranceMinutes: 30,
    plan: null,
    shortagePlan: null,
    bedNames: new Map(),
    infrastructure: null,
    reliability: { actualRainMissingDates: [], soilGardensNeverObserved: [], speciesWithoutReference: [] },
    week: null,
    soil: null,
  };
  const reliability = (input: TodayInputs) => {
    const block = todayView(input).blocks.find((item) => item.kind === 'reliability');
    assert.ok(block && block.kind === 'reliability');
    return block;
  };
  // Sans lecture du dépliant (la pastille), rien n'est inventé.
  assert.equal(reliability(base).byBed, null);
  const withMissing: TodayInputs = {
    ...base,
    missingByBed: { beds: [bed('B1'), bed('B2')], unknownSoilBeds: [], guessedStages: [], lastMeasuredRainOn: null },
  };
  const block = reliability(withMissing);
  assert.equal(block.byBed?.total, '2 planches ont une donnée manquante');
  assert.equal(todayView(withMissing).badge, todayView(base).badge, 'la pastille garde ses cinq données');
  assert.deepEqual(block.checks.map((check) => check.kind), reliability(base).checks.map((check) => check.kind), 'l’anneau aussi');
  // Ses trois cases décochées, le dépliant disparaît ; la zone reste, avec ses propres données.
  const without = reliability({ ...withMissing, enabled: ['arrosages', 'materiel', 'ressources'] });
  assert.equal(without.byBed, null);
});
