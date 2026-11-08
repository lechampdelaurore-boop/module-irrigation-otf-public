import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { IrrigationSnapshot } from '../lib/domain/domain.ts';
import {
  type GoalRevisionLike,
  type HistoryPeriod,
  type HistoryScope,
  IrrigationHistoryInputError,
  type IrrigationHistoryItem,
} from '../lib/domain/irrigation-history/contract.ts';
import {
  buildIrrigationHistoryItems,
  buildIrrigationTimeline,
  paginateIrrigationHistory,
} from '../lib/domain/irrigation-history/items.ts';
import { resolveHistoryPeriod } from '../lib/domain/irrigation-history/period.ts';
import { normalizeHistoryScope } from '../lib/domain/irrigation-history/scope.ts';
import {
  aggregateActualIrrigation,
  aggregateHydricObjective,
  aggregateObservedWeather,
  buildIrrigationHistorySummary,
} from '../lib/domain/irrigation-history/summary.ts';
import { buildIrrigationHistoryCsv } from '../lib/domain/irrigation-history-csv.ts';

const farmScope: HistoryScope = {
  level: 'farm', zoneId: null, plotId: null, bedId: null,
};
const weekPeriod = resolveHistoryPeriod(
  2026,
  { mode: 'week', anchorDate: '2026-09-02' },
);

test('les périodes semaine, mois, saison et personnalisée restent bornées à la saison', () => {
  assert.deepEqual(
    pickDates(resolveHistoryPeriod(2026, { mode: 'week', anchorDate: '2026-09-02' })),
    ['2026-08-31', '2026-09-06'],
  );
  assert.deepEqual(
    pickDates(resolveHistoryPeriod(2026, { mode: 'month', anchorDate: '2026-09-15' })),
    ['2026-09-01', '2026-09-30'],
  );
  assert.deepEqual(
    pickDates(resolveHistoryPeriod(2026, { mode: 'season' })),
    ['2026-01-01', '2026-12-31'],
  );
  assert.deepEqual(
    pickDates(resolveHistoryPeriod(2026, {
      mode: 'custom', customStartDate: '2026-08-28', customEndDate: '2026-10-03',
    })),
    ['2026-08-28', '2026-10-03'],
  );
  assert.deepEqual(
    pickDates(resolveHistoryPeriod(2026, { mode: 'week', anchorDate: '2026-01-01' })),
    ['2026-01-01', '2026-01-04'],
  );
  assert.throws(
    () => resolveHistoryPeriod(2026, {
      mode: 'custom', customStartDate: '2025-12-31', customEndDate: '2026-01-02',
    }),
    IrrigationHistoryInputError,
  );
});

test('la période par défaut se replace dans la saison OTF sélectionnée', () => {
  const result = resolveHistoryPeriod(2024, { mode: 'month' }, new Date('2026-09-05T10:00:00Z'));
  assert.deepEqual(pickDates(result), ['2024-09-01', '2024-09-30']);
});

test('les filtres ferme, parcelle, jardin et planche suivent strictement la hiérarchie OTF', () => {
  assert.deepEqual(normalizeHistoryScope({ level: 'farm' }, snapshot, 2026), farmScope);
  assert.deepEqual(normalizeHistoryScope({ level: 'zone', zoneId: 'zone-a' }, snapshot, 2026), {
    level: 'zone', zoneId: 'zone-a', plotId: null, bedId: null,
  });
  assert.deepEqual(normalizeHistoryScope({
    level: 'plot', zoneId: 'zone-a', plotId: 'plot-a',
  }, snapshot, 2026), {
    level: 'plot', zoneId: 'zone-a', plotId: 'plot-a', bedId: null,
  });
  assert.deepEqual(normalizeHistoryScope({
    level: 'bed', zoneId: 'zone-a', plotId: 'plot-a', bedId: 'bed-a',
  }, snapshot, 2026), {
    level: 'bed', zoneId: 'zone-a', plotId: 'plot-a', bedId: 'bed-a',
  });
  assert.throws(() => normalizeHistoryScope({
    level: 'bed', zoneId: 'zone-b', plotId: 'plot-a', bedId: 'bed-a',
  }, snapshot, 2026), IrrigationHistoryInputError);
});

test('les agrégations restreignent réellement les applications au périmètre choisi', () => {
  const event = irrigation({ id: 'scopes', applications: [
    application('bed-a', 100, 10, 'plot-a'),
    application('bed-b', 300, 30, 'plot-b'),
  ] });
  const plot = aggregateActualIrrigation([event], snapshot.beds, {
    level: 'plot', zoneId: 'zone-a', plotId: 'plot-a', bedId: null,
  }, weekPeriod);
  const bed = aggregateActualIrrigation([event], snapshot.beds, {
    level: 'bed', zoneId: 'zone-a', plotId: 'plot-b', bedId: 'bed-b',
  }, weekPeriod);
  assert.equal(plot.irrigationMm, 10);
  assert.equal(plot.irrigationCubicMeters, 1);
  assert.equal(bed.irrigationMm, 30);
  assert.equal(bed.irrigationCubicMeters, 9);
});

test('les mm multi-surfaces sont pondérés et le volume réel est calculé en m³', () => {
  const result = aggregateActualIrrigation([
    irrigation({ id: 'weighted', applications: [
      application('bed-a', 100, 10),
      application('bed-b', 300, 30, 'plot-b'),
    ] }),
  ], snapshot.beds, farmScope, weekPeriod);
  assert.equal(result.irrigationCubicMeters, 10);
  assert.equal(result.irrigationMm, 25);
  assert.equal(result.irrigatedAreaSquareMeters, 400);
});

test('trois irrigations de la même planche ne comptent sa surface physique qu’une fois', () => {
  const events = ['one', 'two', 'three'].map((id) => irrigation({
    id,
    applications: [application('bed-a', 100, 10)],
  }));
  const result = aggregateActualIrrigation(events, [snapshot.beds[0]], {
    level: 'bed', zoneId: 'zone-a', plotId: 'plot-a', bedId: 'bed-a',
  }, weekPeriod);
  assert.equal(result.irrigationMm, 30);
  assert.equal(result.irrigatedAreaSquareMeters, 100);
  assert.equal(result.irrigationCubicMeters, 3);
});

test('le réalisé partiel contribue, le planifié et l’annulé ne contribuent jamais', () => {
  const partial = irrigation({
    id: 'partial', status: 'partially_completed', applications: [application('bed-a', 100, 9, 'plot-a', 18)],
  });
  partial.remainingCanceledAt = '2026-09-02T09:05:00Z';
  partial.equipment.remainingCanceledAt = partial.remainingCanceledAt;
  const planned = irrigation({ id: 'planned', status: 'planned', applications: [application('bed-a', 100, 0, 'plot-a', 20)] });
  const canceled = irrigation({ id: 'canceled', status: 'canceled', applications: [application('bed-a', 100, 40)] });
  const result = aggregateActualIrrigation([partial, planned, canceled], [snapshot.beds[0]], farmScope, weekPeriod);
  assert.equal(result.irrigationMm, 9);
  assert.equal(result.irrigationCubicMeters, 0.9);
  assert.equal(result.irrigatedAreaSquareMeters, 100);
});

test('les planifications et annulations restent visibles avec des cumuls réels nuls', () => {
  const planned = irrigation({ id: 'visible-planned', status: 'planned' });
  const canceled = irrigation({ id: 'visible-canceled', status: 'canceled' });
  const items = buildIrrigationHistoryItems({
    events: [planned, canceled], snapshot, scope: farmScope, period: weekPeriod,
  });
  assert.deepEqual(items.map((item) => item.status).sort(), ['canceled', 'planned']);
  assert.ok(items.every((item) => item.actualCubicMeters === 0 && item.actualAmountMm === 0));
});

test('la pluie manuelle, y compris zéro, est prioritaire sur la réanalyse', () => {
  const observed = aggregateObservedWeather([
    { date: '2026-09-01', dataKind: 'reanalysis', precipitationMm: 8, et0Mm: 3 },
    { date: '2026-09-01', dataKind: 'manual_precipitation', precipitationMm: 0, et0Mm: null },
    { date: '2026-09-02', dataKind: 'reanalysis', precipitationMm: 2, et0Mm: 4 },
  ], { startDate: '2026-09-01', endDate: '2026-09-02' });
  assert.equal(observed.actualRainMm, 2);
  assert.equal(observed.et0Mm, 7);
  assert.equal(observed.actualRainAvailability.complete, true);
});

test('zéro mesuré reste zéro et une météo absente reste indisponible', () => {
  const zero = aggregateObservedWeather([
    { date: '2026-09-01', dataKind: 'reanalysis', precipitationMm: 0, et0Mm: 0 },
  ], { startDate: '2026-09-01', endDate: '2026-09-01' });
  assert.equal(zero.actualRainMm, 0);
  assert.equal(zero.et0Mm, 0);
  assert.equal(zero.actualRainAvailability.complete, true);
  const missing = aggregateObservedWeather([], {
    startDate: '2026-09-01', endDate: '2026-09-01',
  });
  assert.equal(missing.actualRainMm, null);
  assert.equal(missing.et0Mm, null);
  assert.equal(missing.actualRainAvailability.complete, false);
});

test('un objectif hebdomadaire de 35 mm vaut 50 mm sur dix jours', () => {
  const goal = goalRevision({ weekStart: '2026-08-31', amountMm: 35 });
  const result = aggregateHydricObjective([goal], [snapshot.beds[0]], {
    startDate: '2026-08-31', endDate: '2026-09-09',
  });
  assert.equal(result.objectiveMm, 50);
  assert.equal(result.objectiveAvailability.complete, true);
});

test('une période à cheval sur deux semaines utilise chaque objectif journalier', () => {
  const result = aggregateHydricObjective([
    goalRevision({ id: 'week-a', weekStart: '2026-08-31', amountMm: 35 }),
    goalRevision({ id: 'week-b', weekStart: '2026-09-07', amountMm: 28 }),
  ], [snapshot.beds[0]], {
    startDate: '2026-08-31', endDate: '2026-09-09',
  });
  assert.equal(result.objectiveMm, 47);
});

test('les objectifs de plusieurs planches sont pondérés par leur surface', () => {
  const result = aggregateHydricObjective([
    goalRevision({ id: 'a', scopeType: 'bed', zoneId: 'zone-a', plotId: 'plot-a', bedId: 'bed-a', amountMm: 14 }),
    goalRevision({ id: 'b', scopeType: 'bed', zoneId: 'zone-a', plotId: 'plot-b', bedId: 'bed-b', amountMm: 28 }),
  ], snapshot.beds, { startDate: '2026-08-31', endDate: '2026-09-06' });
  assert.equal(result.objectiveMm, 24.5);
});

test('l’objectif d’une période se somme sur les journées-planche couvertes, jamais « indisponible » dès qu’une l’est (D-036)', () => {
  // Point ouvert 39 : une période commencée avant le premier objectif de la ferme lisait « objectif indisponible ».
  const late = aggregateHydricObjective([goalRevision({ weekStart: '2026-09-07', amountMm: 35 })], [snapshot.beds[0]], {
    startDate: '2026-08-31', endDate: '2026-09-13',
  });
  assert.equal(late.objectiveMm, 35, 'sept jours couverts sur quatorze : 35 mm, les sept autres comptent zéro');
  assert.deepEqual(late.objectiveAvailability, { availableBedDays: 7, totalBedDays: 14, complete: false });

  // Deux planches, un objectif sur une seule : pondéré par la surface, 35 × 100 / 400.
  const weather = Array.from({ length: 7 }, (_, index) => ({
    date: addDays('2026-08-31', index), dataKind: 'reanalysis' as const, precipitationMm: 0, et0Mm: 4,
  }));
  const partial = buildIrrigationHistorySummary({
    events: [], scopeBeds: snapshot.beds, plots: snapshot.plots, scope: farmScope, period: weekPeriod, weather,
    goalRevisions: [goalRevision({ scopeType: 'bed', zoneId: 'zone-a', plotId: 'plot-a', bedId: 'bed-a', amountMm: 35 })],
  });
  assert.equal(partial.objectiveMm, 8.75);
  assert.deepEqual(partial.objectiveAvailability, { availableBedDays: 7, totalBedDays: 14, complete: false });
  assert.equal(partial.gapToObjectiveMm, 8.75, 'l’écart se calcule : objectif 8,75 − irrigation 0 − pluie 0');

  // Aucune journée-planche couverte : sans objectif, sans écart.
  const none = buildIrrigationHistorySummary({
    events: [], scopeBeds: snapshot.beds, plots: snapshot.plots, scope: farmScope, period: weekPeriod, weather, goalRevisions: [],
  });
  assert.equal(none.objectiveMm, null);
  assert.deepEqual(none.objectiveAvailability, { availableBedDays: 0, totalBedDays: 14, complete: false });
  assert.equal(none.gapToObjectiveMm, null);
});

test('l’historique compte un objectif à partir de son jour de pose, comme le tableau des besoins (D-039)', () => {
  // Point ouvert 40 : 35 mm posés le mercredi 2 septembre couvrent cinq jours sur sept, 25 mm ; l'historique lisait 35.
  const week = { startDate: '2026-08-31', endDate: '2026-09-06' };
  const wednesday = { ...goalRevision({ weekStart: '2026-08-31', amountMm: 35 }), createdAt: '2026-09-02T07:00:00.000Z' };
  const posed = aggregateHydricObjective([wednesday], [snapshot.beds[0]], week);
  assert.equal(posed.objectiveMm, 25);
  assert.deepEqual(posed.objectiveAvailability, { availableBedDays: 5, totalBedDays: 7, complete: false });
  // La semaine suivante le compte dès le lundi.
  assert.equal(aggregateHydricObjective([wednesday], [snapshot.beds[0]], { startDate: '2026-09-07', endDate: '2026-09-13' }).objectiveMm, 35);
  // Une reprise automatique de la semaine précédente compte dès le lundi, quel que soit son jour de création.
  assert.equal(aggregateHydricObjective([{ ...wednesday, copiedFromGoalId: 'origine' }], [snapshot.beds[0]], week).objectiveMm, 35);
  // Un objectif posé après sa semaine ne la couvre pas.
  assert.equal(aggregateHydricObjective([{ ...wednesday, createdAt: '2026-09-08T07:00:00.000Z' }], [snapshot.beds[0]], week).objectiveMm, null);
  // Le jour de pose se lit à la ferme (D-004) : posé le mercredi à 0 h 30 de Paris, 22 h 30 UTC la veille, il compte dès le mercredi.
  assert.equal(aggregateHydricObjective([{ ...wednesday, createdAt: '2026-09-01T22:30:00.000Z' }], [snapshot.beds[0]], week).objectiveMm, 25);
  // Deux révisions reçues dans la même milliseconde : la seconde fait foi, quel que soit l'identifiant (docs/revision-order-contract.md).
  const sameMillisecond = '2026-08-31T07:00:00.000Z';
  const twice = aggregateHydricObjective([
    { ...goalRevision({ id: 'zz-la-premiere', amountMm: 14 }), createdAt: sameMillisecond },
    { ...goalRevision({ id: 'aa-la-seconde', amountMm: 35 }), createdAt: sameMillisecond },
  ], [snapshot.beds[0]], week);
  assert.equal(twice.objectiveMm, 35);
});

test('l’écart vaut objectif moins irrigation et pluie, sans intégrer l’ET0', () => {
  const event = irrigation({ id: 'gap', applications: [application('bed-a', 100, 20)] });
  const weather = Array.from({ length: 7 }, (_, index) => ({
    date: addDays('2026-08-31', index),
    dataKind: 'reanalysis' as const,
    precipitationMm: index === 0 ? 8 : 0,
    et0Mm: 4,
  }));
  const result = buildIrrigationHistorySummary({
    events: [event], scopeBeds: [snapshot.beds[0]], plots: snapshot.plots, scope: farmScope,
    period: weekPeriod, weather,
    goalRevisions: [goalRevision({ amountMm: 35 })],
  });
  assert.equal(result.irrigationMm, 20);
  assert.equal(result.actualRainMm, 8);
  assert.equal(result.et0Mm, 28);
  assert.equal(result.gapToObjectiveMm, 7);
});

test('sous abri, la pluie du périmètre vaut zéro ; un périmètre mixte la pondère par la surface (D-032)', () => {
  // Point ouvert 11 : la vue « Par périmètre » applique la règle du cahier des charges comme la vue « Par série ».
  const plots = snapshot.plots.map((plot) => plot.id === 'plot-a' ? { ...plot, mode: 'greenhouse' as const } : plot);
  const shelteredBed = snapshot.beds[0];
  const openBed = { ...shelteredBed, id: 'bed-open', plotId: 'plot-b', name: 'Planche de plein champ', area: 300 };
  const weather = Array.from({ length: 7 }, (_, index) => ({
    date: addDays('2026-08-31', index), dataKind: 'reanalysis' as const, precipitationMm: index === 0 ? 8 : 0, et0Mm: 4,
  }));
  const event = irrigation({ id: 'under-cover', applications: [application('bed-a', 100, 20)] });

  const sheltered = buildIrrigationHistorySummary({
    events: [event], scopeBeds: [shelteredBed], plots, scope: farmScope, period: weekPeriod, weather,
    goalRevisions: [goalRevision({ amountMm: 35 })],
  });
  assert.equal(sheltered.actualRainMm, 0, 'sous abri, zéro explicite');
  assert.equal(sheltered.actualRainAvailability.complete, true, 'et complet');
  assert.equal(sheltered.et0Mm, 28, 'l’ET0 reste celle de l’extérieur, pour information');
  assert.equal(sheltered.gapToObjectiveMm, 15, 'objectif 35 − irrigation 20 − pluie 0');

  const withoutWeather = buildIrrigationHistorySummary({
    events: [event], scopeBeds: [shelteredBed], plots, scope: farmScope, period: weekPeriod, weather: [],
    goalRevisions: [goalRevision({ amountMm: 35 })],
  });
  assert.equal(withoutWeather.actualRainMm, 0, 'la météo absente ne change rien sous abri');
  assert.equal(withoutWeather.actualRainAvailability.complete, true);
  assert.equal(withoutWeather.gapToObjectiveMm, 15);

  const mixed = buildIrrigationHistorySummary({
    events: [], scopeBeds: [shelteredBed, openBed], plots, scope: farmScope, period: weekPeriod, weather,
    goalRevisions: [goalRevision({ amountMm: 35 })],
  });
  assert.equal(mixed.actualRainMm, 6, '8 mm sur 300 m² de plein champ, 0 sur 100 m² sous abri : 6 mm pondérés');
  assert.equal(mixed.actualRainAvailability.complete, true);
  assert.equal(mixed.gapToObjectiveMm, 29, 'objectif 35 − irrigation 0 − pluie 6');
});

test('la chronologie regroupe démarrage, pause, reprise et arrêt dans une irrigation', () => {
  const event = irrigation({ id: 'timeline', status: 'partially_completed' });
  event.timerHistory = [
    history(event, 'created', '2026-09-02T12:02:00Z', { kind: 'running' }),
    history(event, 'updated', '2026-09-02T12:37:00Z', { timerAction: 'paused' }),
    history(event, 'updated', '2026-09-02T12:51:00Z', { timerAction: 'resumed' }),
    history(event, 'partially_completed', '2026-09-02T13:26:00Z'),
  ];
  assert.deepEqual(buildIrrigationTimeline(event).map((entry) => entry.label), [
    'Démarrage', 'Pause', 'Reprise', 'Arrêt anticipé',
  ]);
});

test('« Tout est fait » : le mode et la chronologie disent une irrigation planifiée faite comme prévu, sans chrono', () => {
  const asPlanned = irrigation({ id: 'as-planned' });
  asPlanned.timerHistory = [
    history(asPlanned, 'created', '2026-09-01T08:00:00Z', { kind: 'planned' }),
    history(asPlanned, 'completed', '2026-09-02T18:00:00Z', { actualEndAt: '2026-09-02T11:00:00Z', asPlanned: true }),
  ];
  const timed = irrigation({ id: 'timed' });
  timed.timerHistory = [
    history(timed, 'created', '2026-09-01T08:00:00Z', { kind: 'planned' }),
    history(timed, 'completed', '2026-09-02T11:00:00Z', { actualEndAt: '2026-09-02T11:00:00Z' }),
  ];
  const items = buildIrrigationHistoryItems({ events: [asPlanned, timed], snapshot, scope: farmScope, period: weekPeriod });
  assert.deepEqual(Object.fromEntries(items.map((item) => [item.id, item.modeLabel])), { 'as-planned': 'Planifiée, faite comme prévu', timed: 'Planifiée' });
  assert.deepEqual(buildIrrigationTimeline(asPlanned).map((entry) => [entry.at, entry.label]), [
    ['2026-09-01T08:00:00Z', 'Planification'],
    ['2026-09-02T11:00:00Z', 'Faite comme prévu'],
  ]);
});

test('le détail conserve les snapshots historiques après renommage du matériel', () => {
  const event = irrigation({ id: 'snapshot' });
  event.equipment.equipmentSnapshot.name = 'Ancienne rampe';
  const changedSnapshot = { ...snapshot };
  const [item] = buildIrrigationHistoryItems({
    events: [event], snapshot: changedSnapshot, scope: farmScope, period: weekPeriod,
  });
  assert.equal(item.equipmentName, 'Ancienne rampe');
  assert.equal(item.settingName, 'Réglage historique');
});

test('3.8 ter, règle 11 : une irrigation faite pendant un créneau protégé en vigueur à son début le dit sur sa carte', () => {
  // Mercredi 2 septembre, 10 h – 11 h à la ferme ; « Lavage » le mercredi, de 10 h 30 (630 min) à 12 h (720 min).
  const lavage = (change: 'created' | 'deleted', createdAt: string) => ({
    id: 'lavage', name: 'Lavage', weekdays: ['wednesday' as const], startMinute: 630, endMinute: 720, change, createdAt, actorUserId: 'alice',
  });
  const names = (protectedSlotVersions: ReturnType<typeof lavage>[]) => Object.fromEntries(buildIrrigationHistoryItems({
    events: [irrigation({ id: 'faite' }), irrigation({ id: 'prevue', status: 'planned' })], snapshot, scope: farmScope, period: weekPeriod, protectedSlotVersions,
  }).map((item) => [item.id, item.protectedSlotNames]));
  assert.deepEqual(names([lavage('created', '2026-09-01T08:00:00Z')]), { faite: ['Lavage'], prevue: [] }, 'faite pendant le créneau ; la prévue, sans signal');
  assert.deepEqual(names([lavage('created', '2026-09-03T08:00:00Z')]), { faite: [], prevue: [] }, 'un créneau posé après coup ne la signale pas');
  assert.deepEqual(names([lavage('deleted', '2026-09-02T07:00:00Z'), lavage('created', '2026-09-01T08:00:00Z')]), { faite: [], prevue: [] }, 'supprimé avant elle');
  assert.deepEqual(names([]), { faite: [], prevue: [] });
});

test('la pagination borne la page et ne renvoie que douze lignes', () => {
  const source = Array.from({ length: 25 }, (_, index) => ({
    ...historyItemStub,
    id: `event-${index}`,
    eventEquipmentId: `equipment-${index}`,
  }));
  const page = paginateIrrigationHistory(source, 2);
  assert.equal(page.items.length, 12);
  assert.equal(page.totalPages, 3);
  assert.equal(page.items[0].id, 'event-12');
});

test('le CSV contient le résumé, le contexte, l’irrigation et sa chronologie', () => {
  const event = irrigation({ id: 'csv' });
  event.timerHistory = [history(event, 'updated', '2026-09-02T12:37:00Z', { timerAction: 'paused' })];
  const [item] = buildIrrigationHistoryItems({ events: [event], snapshot, scope: farmScope, period: weekPeriod });
  const csv = buildIrrigationHistoryCsv(exportData([item]));
  assert.ok(csv.startsWith('\uFEFFType de ligne;'));
  assert.match(csv, /Résumé de période/);
  assert.match(csv, /Irrigation/);
  assert.match(csv, /Pause/);
  assert.match(csv, /Ferme de test/);
});

test('le CSV sans irrigation conserve un résumé météo et hydrique non vide', () => {
  const csv = buildIrrigationHistoryCsv(exportData([]));
  assert.match(csv, /Résumé de période/);
  assert.match(csv, /2026-08-31/);
  assert.equal(csv.trimEnd().split('\r\n').length, 2);
});

test('les requêtes d’historique imposent la saison et le propriétaire sur chaque lecture D1', () => {
  const source = readFileSync('db/irrigation-history-repository.ts', 'utf8');
  assert.equal((source.match(/workspace\.owner_user_id = \?/g) ?? []).length, 3);
  assert.equal((source.match(/event\.season = \?/g) ?? []).length, 3);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE)\b/i);
});

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: {
    id: 'farm', name: 'Ferme de test', legalCity: 'Tronget', legalPostcode: '03240', legalCountry: 'FR',
  },
  zones: [
    { id: 'zone-a', name: 'Parcelle A', area: 400, seasons: [2026] },
    { id: 'zone-b', name: 'Parcelle B', area: 50, seasons: [2026] },
  ],
  plots: [
    { id: 'plot-a', zoneId: 'zone-a', name: 'Jardin A', mode: 'garden', length: 10, width: 10, area: 100, seasons: [2026] },
    { id: 'plot-b', zoneId: 'zone-a', name: 'Jardin B', mode: 'garden', length: 30, width: 10, area: 300, seasons: [2026] },
  ],
  beds: [
    { id: 'bed-a', zoneId: 'zone-a', plotId: 'plot-a', name: 'Planche A', length: 10, width: 10, alleyWidth: null, area: 100, seasons: [2026] },
    { id: 'bed-b', zoneId: 'zone-a', plotId: 'plot-b', name: 'Planche B', length: 30, width: 10, alleyWidth: null, area: 300, seasons: [2026] },
  ],
  source: 'cache', lastSuccessfulReadAt: '2026-09-01T00:00:00Z',
};

function irrigation(input: {
  id: string;
  status?: IrrigationEventRecord['status'];
  applications?: IrrigationEventRecord['equipment']['applications'];
}): IrrigationEventRecord {
  const status = input.status ?? 'completed';
  const actual = status === 'completed' || status === 'partially_completed';
  return {
    id: input.id,
    season: 2026,
    status,
    note: null,
    remainingCanceledAt: null,
    canceledAt: status === 'canceled' ? '2026-09-02T10:00:00Z' : null,
    createdAt: '2026-09-02T07:00:00Z',
    updatedAt: '2026-09-02T09:00:00Z',
    equipment: {
      id: `event-equipment-${input.id}`,
      equipmentId: 'equipment-current-id',
      settingId: 'setting-current-id',
      placementId: 'placement-current-id',
      status,
      plannedStartAt: status === 'planned' ? '2026-09-02T08:00:00Z' : null,
      plannedEndAt: status === 'planned' ? '2026-09-02T09:00:00Z' : null,
      actualStartAt: actual ? '2026-09-02T08:00:00Z' : null,
      actualEndAt: actual ? '2026-09-02T09:00:00Z' : null,
      plannedDurationSeconds: 3600,
      actualDurationSeconds: actual ? 3600 : 0,
      equipmentSnapshot: { id: 'old-equipment', name: 'Rampe historique', kind: 'sprinkler', mobility: 'mobile' },
      settingSnapshot: {
        id: 'old-setting', name: 'Réglage historique', position: 1, kind: 'sprinkler',
        leftProfile: [{ distanceMeters: 0, rateMmPerHour: 10 }],
        rightProfile: [{ distanceMeters: 0, rateMmPerHour: 10 }],
      },
      placementSnapshot: {
        id: 'old-placement', equipmentId: 'old-equipment', settingId: 'old-setting', season: 2026,
        gardenGroupId: null, otfZoneId: 'zone-a', otfPlotId: 'plot-a',
        anchor: { type: 'bed_center', anchorBedOtfId: 'bed-a' },
        selectedBeds: [{ otfZoneId: 'zone-a', otfPlotId: 'plot-a', otfBedId: 'bed-a' }],
      },
      timerState: null,
      timerStartedAt: null,
      timerResumedAt: null,
      timerPausedAt: null,
      timerTheoreticalEndAt: null,
      timerAccumulatedSeconds: 0,
      timerAlarmRevision: null,
      timerAlarmStatus: null,
      timerAlarmSyncedAt: null,
      remainingCanceledAt: null,
      canceledAt: status === 'canceled' ? '2026-09-02T10:00:00Z' : null,
      applications: input.applications ?? [application('bed-a', 100, actual ? 10 : 0)],
    },
  };
}

function application(
  bedId: string,
  area: number,
  actualAmountMm: number,
  plotId = 'plot-a',
  plannedAmountMm = actualAmountMm,
  wettedAreaSquareMeters: number | null = area,
) {
  return {
    otfZoneId: 'zone-a', otfPlotId: plotId, otfBedId: bedId,
    rateMmPerHour: plannedAmountMm, bedAreaSquareMeters: area,
    wettedAreaSquareMeters,
    plannedAmountMm, actualAmountMm,
  };
}

function goalRevision(input: {
  id?: string;
  weekStart?: string;
  scopeType?: GoalRevisionLike['scopeType'];
  zoneId?: string | null;
  plotId?: string | null;
  bedId?: string | null;
  amountMm: number;
}): GoalRevisionLike {
  return {
    id: input.id ?? 'goal',
    weekStart: input.weekStart ?? '2026-08-31',
    scopeType: input.scopeType ?? 'farm',
    otfZoneId: input.zoneId ?? null,
    otfPlotId: input.plotId ?? null,
    otfBedId: input.bedId ?? null,
    amountMm: input.amountMm,
    action: 'set',
    createdAt: `${input.weekStart ?? '2026-08-31'}T00:00:00Z`,
  };
}

function history(
  event: IrrigationEventRecord,
  action: string,
  at: string,
  payload: Record<string, unknown> = {},
) {
  return { action, at, payload: { eventEquipmentId: event.equipment.id, ...payload } };
}

function exportData(items: IrrigationHistoryItem[]) {
  return {
    season: 2026,
    period: weekPeriod,
    scope: farmScope,
    scopeLabel: 'Ferme de test',
    farmName: 'Ferme de test',
    summary: {
      irrigationCubicMeters: 2,
      irrigationVolumeIncomplete: false,
      irrigationMm: 20,
      irrigatedAreaSquareMeters: 100,
      actualRainMm: 8,
      actualRainAvailability: { availableDays: 7, totalDays: 7, complete: true },
      et0Mm: 28,
      et0Availability: { availableDays: 7, totalDays: 7, complete: true },
      objectiveMm: 35,
      objectiveAvailability: { availableBedDays: 7, totalBedDays: 7, complete: true },
      irrigationAndRainMm: 28,
      gapToObjectiveMm: 7,
      scopeAreaSquareMeters: 100,
    },
    items,
    snapshot,
  };
}

const historyItemStub = {
  id: 'event', eventEquipmentId: 'event-equipment', date: '2026-09-02T08:00:00Z',
  status: 'completed' as const, statusLabel: 'Terminée', modeLabel: 'Irriguer maintenant',
  equipmentName: 'Rampe', settingName: 'Standard', locationLabel: 'Jardin A', zoneName: 'Parcelle A',
  plotNames: ['Jardin A'], bedNames: ['Planche A'], bedIds: ['bed-a'], plannedStartAt: null, plannedEndAt: null,
  actualStartAt: '2026-09-02T08:00:00Z', actualEndAt: '2026-09-02T09:00:00Z',
  actualDurationSeconds: 3600, plannedDurationSeconds: 3600, actualAmountMm: 20,
  plannedAmountMm: 20, actualCubicMeters: 2, irrigatedAreaSquareMeters: 100,
  wettedAreaSquareMeters: 100, wettedAreaLabel: 'aspersion, planche et passe-pied',
  placementLabel: 'Sur Planche A', initialObjectiveMm: null, partial: false,
  stoppedEarly: false, canceled: false, note: null, protectedSlotNames: [] as string[],
  timeline: [{ at: '2026-09-02T08:00:00Z', label: 'Démarrage' }],
};

function pickDates(period: HistoryPeriod) {
  return [period.startDate, period.endDate];
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test('le volume d’une irrigation se fait sur la surface mouillée, ses millimètres sur la planche', () => {
  // Aspersion sur une planche de 22,5 m², 36 m² mouillés passe-pied compris :
  // 10 mm donnent 0,36 m³, et restent 10 mm (docs/wetted-surface-contract.md).
  const event = irrigation({ id: 'event-1', applications: [application('bed-a', 22.5, 10, 'plot-a', 10, 36)] });
  const [item] = buildIrrigationHistoryItems({ events: [event], snapshot, scope: farmScope, period: weekPeriod });
  assert.equal(item.actualAmountMm, 10);
  assert.equal(item.actualCubicMeters, 0.36);
  assert.equal(item.irrigatedAreaSquareMeters, 22.5);
  assert.equal(item.wettedAreaSquareMeters, 36);
  assert.equal(item.wettedAreaLabel, 'aspersion, planche et passe-pied');
  const summary = aggregateActualIrrigation([event], snapshot.beds, farmScope, weekPeriod);
  assert.equal(summary.irrigationCubicMeters, 0.36);
  assert.equal(summary.irrigationVolumeIncomplete, false);
});

test('une planche sans surface mouillée connue rend le volume inconnu et le dit, sans le mettre à zéro', () => {
  const unknown = irrigation({ id: 'event-1', applications: [application('bed-a', 22.5, 10, 'plot-a', 10, null)] });
  const known = irrigation({ id: 'event-2', applications: [application('bed-a', 22.5, 10, 'plot-a', 10, 36)] });
  const [item] = buildIrrigationHistoryItems({ events: [unknown], snapshot, scope: farmScope, period: weekPeriod });
  assert.equal(item.actualAmountMm, 10, 'les millimètres restent la vérité');
  assert.equal(item.actualCubicMeters, null);
  assert.equal(item.wettedAreaSquareMeters, null);
  assert.match(item.wettedAreaLabel, /passe-pied non renseigné/);
  const summary = aggregateActualIrrigation([unknown], snapshot.beds, farmScope, weekPeriod);
  assert.equal(summary.irrigationCubicMeters, 0);
  assert.equal(summary.irrigationVolumeIncomplete, true);
  // La pondération des millimètres se fait sur la planche : elle ne dépend pas de la surface mouillée.
  assert.equal(summary.irrigationMm, aggregateActualIrrigation([known], snapshot.beds, farmScope, weekPeriod).irrigationMm);
});

test('le CSV nomme les séries qui occupaient les planches arrosées le jour de l’irrigation', () => {
  const cropPlan: NonNullable<IrrigationSnapshot['cropPlan']> = {
    series: [
      { id: 'carottes', name: 'Carottes', season: 2026, use: 'bed', cycle: 'annual', cultivations: [{ id: 'c1', plantId: 'p', plantName: 'Carotte', harvestWeeks: [], harvestWeeksExpected: ['2026-W40'] }] },
      { id: 'radis', name: 'Radis', season: 2026, use: 'bed', cycle: 'annual', cultivations: [] },
    ],
    places: [{ id: 'p1', seriesId: 'carottes', bedId: 'bed-a', lengthMeters: 10 }, { id: 'p2', seriesId: 'radis', bedId: 'bed-a', lengthMeters: 10 }],
    implantationTasks: [{ id: 't1', seriesId: 'carottes', cultivationId: null, kind: 'direct-sowing', plannedWeek: '2026-W20', doneWeek: '2026-W20', status: 'done' }],
    readSummary: { seriesRead: 2, placesRead: 2, tasksRead: 1, tasksRetained: 1, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  };
  const csv = buildIrrigationHistoryCsv({ ...exportData([historyItemStub]), snapshot: { ...snapshot, cropPlan } });
  const [header, , irrigationRow] = csv.split('\r\n');
  const columns = header.replace('﻿', '').split(';');
  assert.equal(columns[columns.indexOf('Planche(s)') + 1], 'Séries', 'la colonne suit les planches');
  assert.equal(irrigationRow.split(';')[columns.indexOf('Séries')], 'Carottes', 'le radis sans implantation n’y est pas');

  const withoutPlan = buildIrrigationHistoryCsv(exportData([historyItemStub]));
  assert.equal(withoutPlan.split('\r\n')[2].split(';')[columns.indexOf('Séries')], '', 'plan non lu : colonne vide, pas d’erreur');
});
