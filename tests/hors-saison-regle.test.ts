import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import test from 'node:test';
import {
  automaticObjectiveWeekRecord,
  type AutomaticObjectiveInput,
  type AutomaticObjectiveSettingRevision,
} from '../lib/domain/automatic-objective.ts';
import { evaluateFrost, frostSubjects } from '../lib/domain/crop-alerts/frost.ts';
import type { Et0Reading } from '../lib/domain/crop-water/etm.ts';
import type { Bed, IrrigationSnapshot, Plot, PlotMode } from '../lib/domain/domain.ts';
import { farmObjective, farmObjectivePartial, farmObjectiveScopeText, farmObjectiveText } from '../lib/domain/farm-objective.ts';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import type { GoalRevisionLike } from '../lib/domain/irrigation-history/contract.ts';
import {
  buildIrrigationNeedsDashboard,
  objectiveForBed,
  type BedIrrigationNeed,
  type IrrigationNeedDecision,
  type IrrigationNeedsDashboard,
} from '../lib/domain/irrigation-needs.ts';
import {
  objectiveOffSeason,
  offSeasonSchedule,
  type ActiveOffSeasonScope,
  type OffSeasonBed,
  type OffSeasonRevision,
  type OffSeasonScope,
} from '../lib/domain/off-season.ts';
import type { WaterDashboardDay } from '../lib/domain/water-management.ts';
import { COMMON, link, MORNING as FROST_FORECAST_AT, planting, series } from './support/crop-alerts-fixtures.ts';
import { realIrrigation } from './support/planning-fixtures.ts';

/**
 * Le filtre « hors saison », PR B1 : la règle
 * (docs/objectif-automatique-saison-contract.md, sections 4, 5 et 8 ; D-337).
 * Les dix cas chiffrés du contrat, la garde de la pluie, de la réserve du sol
 * et des alertes, puis les précisions faites en codant (D-341).
 *
 * Semaine du lundi 15 au dimanche 21 juin 2026, ET0 des sept jours 4,0 ·
 * 4,2 · 3,8 · 4,5 · 5,0 · 4,6 · 3,9 mm, soit 30,0 mm : les chiffres du
 * contrat, ceux du 6 decies. Objectif automatique allumé depuis le 1er juin,
 * sauf mention. Les jardins Nord et Sud sont en plein champ, l'abri sous abri,
 * le jardin neuf à classer ; le verger est une autre parcelle.
 */

const WEEK = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];
const [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY] = WEEK;
const ET0 = [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, 3.9];
/** Le lundi qui suit : tous les jours de la semaine sont passés, leur ET0 est la réanalyse. */
const NEXT_MONDAY = '2026-06-22';
/** Le lundi 8 juin à 10 h à Paris : un geste posé avant la semaine. */
const BEFORE = '2026-06-08T08:00:00.000Z';
/** Un instant du jour `date`, en temps universel ; 8 h vaut 10 h à Paris en juin. */
const at = (date: string, time = '08:00') => `${date}T${time}:00.000Z`;

const FARM_BEDS: readonly (OffSeasonBed & { area: number })[] = [
  { id: 'planche-nord-1', zoneId: 'parcelle', plotId: 'jardin-nord', plotMode: 'garden', area: 100 },
  { id: 'planche-nord-2', zoneId: 'parcelle', plotId: 'jardin-nord', plotMode: 'garden', area: 50 },
  { id: 'planche-sud-1', zoneId: 'parcelle', plotId: 'jardin-sud', plotMode: 'garden', area: 100 },
  { id: 'planche-abri-1', zoneId: 'parcelle', plotId: 'abri', plotMode: 'greenhouse', area: 60 },
  { id: 'planche-neuve-1', zoneId: 'parcelle', plotId: 'jardin-neuf', plotMode: 'unclassified', area: 40 },
  { id: 'rang-verger-1', zoneId: 'verger', plotId: 'rangs', plotMode: 'garden', area: 80 },
];
const [NORD, NORD_2, SUD, ABRI, NEUVE, VERGER] = FARM_BEDS;

const PLEIN_CHAMP: OffSeasonScope = { level: 'mode', mode: 'garden' };
const SOUS_ABRI: OffSeasonScope = { level: 'mode', mode: 'greenhouse' };
const JARDIN_NORD: OffSeasonScope = { level: 'plot', plotId: 'jardin-nord' };

const put = (scope: OffSeasonScope, createdAt: string): OffSeasonRevision => ({ scope, offSeason: true, createdAt });
const resume = (scope: OffSeasonScope, createdAt: string): OffSeasonRevision => ({ scope, offSeason: false, createdAt });

const ON_JUNE_FIRST: AutomaticObjectiveSettingRevision = { enabled: true, createdAt: '2026-06-01T07:00:00.000Z' };
const reanalysis = (): Et0Reading[] => WEEK.map((date, index) => ({ date, reanalysisMm: ET0[index], forecastMm: null }));

function automatic(bed: OffSeasonBed, overrides: Partial<AutomaticObjectiveInput> = {}): AutomaticObjectiveInput {
  return {
    settings: [ON_JUNE_FIRST],
    today: NEXT_MONDAY,
    et0Readings: reanalysis(),
    plotMode: bed.plotMode,
    shelterFactors: [],
    cropNeed: { status: 'off' },
    ...overrides,
  };
}

/** Un objectif « Toute la ferme » saisi pour la semaine, posé le 1er juin : il compte dès le lundi. */
function farmGoal(amountMm: number | null, createdAt = '2026-06-01T07:00:00.000Z'): GoalRevisionLike {
  return {
    id: `ferme-${createdAt}`,
    weekStart: MONDAY,
    scopeType: 'farm',
    otfZoneId: null,
    otfPlotId: null,
    otfBedId: null,
    amountMm,
    action: amountMm === null ? 'cleared' : 'set',
    createdAt,
  };
}

/** L'objectif de la semaine d'une planche, filtre compris ; `automatic: null` : réglage absent. */
function objective(bed: OffSeasonBed, options: { gestures?: readonly OffSeasonRevision[]; goals?: readonly GoalRevisionLike[]; automatic?: AutomaticObjectiveInput | null } = {}) {
  const input = options.automatic === null ? undefined : options.automatic ?? automatic(bed);
  return objectiveForBed(options.goals ?? [], bed, MONDAY, SUNDAY, input, offSeasonSchedule(options.gestures ?? []).daysOf(bed));
}

/** Les jours de la semaine où le filtre dit la planche hors saison. */
const offSeasonDays = (gestures: readonly OffSeasonRevision[], bed: OffSeasonBed) => WEEK.filter(offSeasonSchedule(gestures).daysOf(bed));

function near(actual: number | null | undefined, expected: number, message = '') {
  assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message} : attendu ${expected}, obtenu ${actual}`);
}

/*
 * Le tableau des besoins d'une ferme, calculé le mercredi 17 juin à 10 h :
 * lundi à mercredi sont passés, jeudi à dimanche sont prévus.
 */
const NOW = new Date('2026-06-17T08:00:00.000Z');

function plot(id: string, zoneId: string, name: string, mode: PlotMode): Plot {
  return { id, zoneId, name, mode, length: 10, width: 10, area: 100, seasons: [2026] };
}

function snapshotOf(beds: readonly (OffSeasonBed & { area: number })[]): IrrigationSnapshot {
  const plots = new Map<string, Plot>();
  for (const bed of beds) plots.set(bed.plotId, plot(bed.plotId, bed.zoneId, bed.plotId, bed.plotMode));
  const zones = [...new Set(beds.map((bed) => bed.zoneId))].map((id) => ({ id, name: id, area: 1000, seasons: [2026] }));
  const snapshotBeds: Bed[] = beds.map((bed) => ({ id: bed.id, zoneId: bed.zoneId, plotId: bed.plotId, name: bed.id, length: 10, width: 1, alleyWidth: 0.5, area: bed.area, seasons: [2026] }));
  return {
    configuration: { seasonFirst: 2026, seasonLast: 2026 },
    structure: { id: 'ferme', name: 'Ferme', legalCity: null, legalPostcode: null, legalCountry: null },
    zones, plots: [...plots.values()], beds: snapshotBeds,
    source: 'cache', lastSuccessfulReadAt: '2026-06-15T00:00:00.000Z',
  };
}

/** La valeur donnée pour ce jour, `null` compris ; sans valeur donnée, `fallback`. */
function valueOn(values: Partial<Record<string, number | null>> | undefined, date: string, fallback: number | null): number | null {
  return values !== undefined && date in values ? values[date] ?? null : fallback;
}

/**
 * Les jours de la semaine : ET0 du contrat ; pluie au pluviomètre ou en
 * réanalyse les jours passés (0 mm sans mention), prévue les jours à venir
 * (1 mm par jour sans mention).
 */
function weekDays(options: { gaugeMm?: Partial<Record<string, number>>; reanalysisMm?: Partial<Record<string, number | null>>; forecastMm?: Partial<Record<string, number | null>> } = {}): WaterDashboardDay[] {
  return WEEK.map((date, index) => {
    const past = date <= WEDNESDAY;
    const manual = options.gaugeMm?.[date] ?? null;
    const reanalysisMm = past ? valueOn(options.reanalysisMm, date, 0) : null;
    return {
      date, volumeIncomplete: false, realizedIrrigationCubicMeters: 0, plannedIrrigationCubicMeters: 0, estimatedOngoingCubicMeters: 0,
      reanalysisRainMm: reanalysisMm, manualRainMm: manual, effectiveActualRainMm: manual ?? reanalysisMm,
      forecastRainMm: valueOn(options.forecastMm, date, 1),
      forecastMinimumTemperatureCelsius: null, forecastMaximumTemperatureCelsius: null,
      et0Mm: ET0[index], et0Kind: past ? 'reanalysis' : 'forecast',
      limitCubicMeters: null, limitExceededByCubicMeters: 0, actualLimitExceededByCubicMeters: 0,
    };
  });
}

function dashboard(options: {
  gestures?: readonly OffSeasonRevision[];
  beds?: readonly (OffSeasonBed & { area: number })[];
  days?: WaterDashboardDay[];
  events?: IrrigationEventRecord[];
  decisions?: IrrigationNeedDecision[];
  goals?: GoalRevisionLike[];
} = {}): IrrigationNeedsDashboard {
  return buildIrrigationNeedsDashboard({
    season: 2026,
    snapshot: snapshotOf(options.beds ?? FARM_BEDS),
    days: options.days ?? weekDays(),
    events: options.events ?? [],
    goalRevisions: options.goals ?? [farmGoal(20)],
    decisions: options.decisions ?? [],
    coverage: [],
    thresholdMm: 0,
    weekStart: MONDAY,
    weekEnd: SUNDAY,
    now: NOW,
    ...(options.gestures === undefined ? {} : { offSeason: offSeasonSchedule(options.gestures) }),
  });
}

const rowsOf = (board: IrrigationNeedsDashboard) => board.gardens.flatMap((garden) => garden.beds);
const row = (board: IrrigationNeedsDashboard, bedId: string) => rowsOf(board).find((item) => item.bedId === bedId)!;
const garden = (board: IrrigationNeedsDashboard, plotId: string) => board.gardens.find((item) => item.plotId === plotId)!;

function decision(bedId: string, manualOverrideMm: number): IrrigationNeedDecision {
  const bed = FARM_BEDS.find((item) => item.id === bedId)!;
  return { otfZoneId: bed.zoneId, otfPlotId: bed.plotId, otfBedId: bedId, priority: 'normal', manualOverrideMm, overrideReason: 'repiquage', calculatedNeedAtOverrideMm: 8, updatedAt: '2026-06-15T08:00:00.000Z' };
}

/** Un arrosage planifié d'une heure, pas encore fait, de `mm` sur la planche. */
function plannedOn(bedId: string, startAt: string, mm: number): IrrigationEventRecord {
  const base = realIrrigation(`planifie-${bedId}`, 'rampe', startAt, [bedId], mm, mm, 'sprinkler', 'planned');
  return {
    ...base,
    equipment: {
      ...base.equipment,
      plannedStartAt: startAt, plannedEndAt: base.equipment.actualEndAt, actualStartAt: null, actualEndAt: null, actualDurationSeconds: 0,
      applications: base.equipment.applications.map((application) => ({ ...application, actualAmountMm: 0 })),
    },
  };
}

/**
 * Ce que le filtre ne touche jamais d'une ligne du tableau des besoins : la
 * pluie et ses jours manquants ou estimés, l'ET0, l'irrigation réelle et
 * planifiée, les surfaces, le besoin remplacé enregistré, la priorité.
 */
function untouched(bed: BedIrrigationNeed) {
  return {
    bedId: bed.bedId, sheltered: bed.sheltered, areaSquareMeters: bed.areaSquareMeters,
    wettedAreaSquareMeters: bed.wettedAreaSquareMeters, wettedAreaSource: bed.wettedAreaSource,
    et0Mm: bed.et0Mm, et0KnownMm: bed.et0KnownMm, et0ReanalysisMm: bed.et0ReanalysisMm, et0ForecastMm: bed.et0ForecastMm,
    actualRainMm: bed.actualRainMm, forecastRainMm: bed.forecastRainMm,
    actualIrrigationMm: bed.actualIrrigationMm, plannedIrrigationMm: bed.plannedIrrigationMm,
    manualOverrideMm: bed.manualOverrideMm, overrideReason: bed.overrideReason, priority: bed.priority,
    missingDates: bed.completeness.missingDates, estimatedDates: bed.completeness.estimatedDates,
    // Ce qui manque à la pluie et au jardin ; « objectif » seul dépend du filtre.
    missing: bed.completeness.missing.filter((reason) => reason !== 'objective'),
  };
}

test('filtre vide : l’objectif de chaque planche est celui d’avant, mot pour mot', () => {
  const goalSets: GoalRevisionLike[][] = [[], [farmGoal(20)], [farmGoal(20), farmGoal(null, at(WEDNESDAY))]];
  // Aucun geste, des portées reprises avant la semaine, une portée qui couvre une autre parcelle.
  const emptyFilters: OffSeasonRevision[][] = [
    [],
    [put(PLEIN_CHAMP, BEFORE), resume(PLEIN_CHAMP, at('2026-06-10'))],
    [put({ level: 'zone', zoneId: 'autre-parcelle' }, BEFORE)],
  ];
  for (const bed of FARM_BEDS) {
    for (const input of [undefined, automatic(bed)]) {
      for (const goals of goalSets) {
        const before = objectiveForBed(goals, bed, MONDAY, SUNDAY, input);
        assert.deepEqual(before.offSeasonDates, [], 'sans filtre, aucun jour hors saison');
        for (const gestures of emptyFilters) {
          assert.deepEqual(objectiveForBed(goals, bed, MONDAY, SUNDAY, input, offSeasonSchedule(gestures).daysOf(bed)), before, `${bed.id} : rien ne change`);
        }
      }
    }
  }
});

test('filtre vide : le tableau des besoins est celui d’avant, mot pour mot', () => {
  const events = [realIrrigation('arrosage-mardi', 'goutte-a-goutte', '2026-06-16T05:00:00.000Z', [NORD.id], 10, 10), plannedOn(SUD.id, at(FRIDAY), 6)];
  const decisions = [decision(NORD_2.id, 15)];
  const days = weekDays({ gaugeMm: { [MONDAY]: 12 } });
  const plain = dashboard({ events, decisions, days });
  assert.deepEqual(dashboard({ events, decisions, days, gestures: [] }), plain);
  assert.deepEqual(dashboard({ events, decisions, days, gestures: [put(SOUS_ABRI, BEFORE), resume(SOUS_ABRI, at('2026-06-12'))] }), plain);
  assert.ok(rowsOf(plain).every((bed) => !('offSeasonDates' in bed)), 'la ligne d’avant, sans champ de plus');
  assert.equal('offSeason' in plain.farmObjective, false, 'l’objectif de la ferme d’avant, sans champ de plus');
});

test('cas 1 : plein champ hors saison toute la semaine, objectif de ferme saisi 20 mm : pas d’objectif dehors, 20 mm sous abri, le 20 mm reste', () => {
  const gestures = [put(PLEIN_CHAMP, BEFORE)];
  const goals = [farmGoal(20)];
  const outside = objective(NORD, { gestures, goals });
  assert.equal(outside.value, null, 'hors saison : pas d’objectif, jamais zéro (D-003)');
  assert.equal(outside.complete, false);
  assert.equal(outside.origin, null);
  assert.equal(outside.source, null, 'l’objectif saisi n’a servi aucun jour');
  assert.equal(outside.automatic, null, 'l’objectif automatique non plus');
  assert.deepEqual(outside.offSeasonDates, WEEK);
  assert.equal(objectiveOffSeason({ objectiveMm: outside.value, offSeasonDates: outside.offSeasonDates }), true, 'dite « hors saison », pas « sans objectif »');

  const sheltered = objective(ABRI, { gestures, goals });
  near(sheltered.value, 20, 'sous abri, l’objectif de ferme saisi');
  assert.equal(sheltered.origin, 'entered');
  assert.deepEqual(sheltered.offSeasonDates, []);

  // L'objectif saisi reste là, inactif : repris le mercredi, il compte de nouveau à partir de ce jour.
  const resumed = objective(NORD, { gestures: [...gestures, resume(PLEIN_CHAMP, at(WEDNESDAY))], goals });
  near(resumed.value, 20 * 5 / 7, 'mercredi à dimanche : cinq septièmes des 20 mm');
  assert.equal(resumed.origin, 'entered');
  assert.deepEqual(resumed.offSeasonDates, [MONDAY, TUESDAY]);
  assert.deepEqual(goals, [farmGoal(20)], 'aucun objectif saisi n’est effacé');

  const board = dashboard({ gestures, goals });
  assert.equal(row(board, NORD.id).objectiveMm, null);
  near(row(board, ABRI.id).objectiveMm, 20, 'au tableau des besoins aussi');
});

test('cas 2 : plein champ hors saison depuis jeudi : trois jours d’objectif, puis « hors saison depuis jeudi »', () => {
  // Mercredi 22 h 30 en temps universel : jeudi 0 h 30 à Paris ; le geste compte à partir du jeudi (D-004, D-034).
  const gestures = [put(PLEIN_CHAMP, '2026-06-17T22:30:00.000Z')];
  const result = objective(NORD, { gestures });
  near(result.value, 4.0 + 4.2 + 3.8, 'objectif automatique du lundi au mercredi');
  assert.equal(result.origin, 'automatic');
  assert.deepEqual(result.automatic?.days.map((day) => day.date), [MONDAY, TUESDAY, WEDNESDAY]);
  assert.deepEqual(result.offSeasonDates, [THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  assert.equal(objectiveOffSeason({ objectiveMm: result.value, offSeasonDates: result.offSeasonDates }), false, 'elle garde ses trois jours d’objectif');

  const schedule = offSeasonSchedule(gestures);
  assert.deepEqual(schedule.scopesCovering(NORD, SUNDAY), [{ scope: PLEIN_CHAMP, since: THURSDAY }], 'hors saison depuis jeudi');
  assert.deepEqual(schedule.scopesCovering(NORD, WEDNESDAY), [], 'mercredi, en saison');

  near(objective(NORD, { gestures, goals: [farmGoal(20)] }).value, 20 * 3 / 7, 'un objectif saisi : trois septièmes des 20 mm');
});

test('cas 3 : plein champ hors saison, 12 mm au pluviomètre lundi : la pluie reste au bilan, l’objectif n’y compte pas', () => {
  const days = weekDays({ gaugeMm: { [MONDAY]: 12 }, reanalysisMm: { [MONDAY]: 3 } });
  const plain = dashboard({ days });
  const filtered = dashboard({ days, gestures: [put(PLEIN_CHAMP, BEFORE)] });
  const before = row(plain, NORD.id);
  const after = row(filtered, NORD.id);
  assert.equal(after.actualRainMm, 12, 'la mesure du pluviomètre prime, filtre ou non');
  assert.equal(after.actualRainMm, before.actualRainMm);
  assert.equal(after.forecastRainMm, before.forecastRainMm, 'la pluie prévue aussi');
  near(before.realRemainingMm, 20 - 12, 'en saison, la pluie se déduit de l’objectif');
  assert.equal(after.objectiveMm, null);
  assert.equal(after.realRemainingMm, null, 'hors saison : aucun objectif auquel comparer la pluie');
  assert.deepEqual(after.offSeasonDates, WEEK);
  assert.deepEqual(after.completeness.missing, [], 'hors saison n’est pas un objectif manquant');
  assert.equal(row(filtered, ABRI.id).actualRainMm, 0, 'sous abri, la pluie vaut 0, comme avant');
});

test('cas 4 : tout le plein champ et le jardin Nord hors saison ; reprendre tout le plein champ laisse le jardin Nord hors saison, et le dit', () => {
  const gestures = [put(PLEIN_CHAMP, BEFORE), put(JARDIN_NORD, at('2026-06-09')), resume(PLEIN_CHAMP, at(WEDNESDAY))];
  const schedule = offSeasonSchedule(gestures);
  assert.deepEqual(schedule.scopesCovering(NORD, TUESDAY), [{ scope: PLEIN_CHAMP, since: '2026-06-08' }, { scope: JARDIN_NORD, since: '2026-06-09' }]);
  const remaining: ActiveOffSeasonScope[] = [{ scope: JARDIN_NORD, since: '2026-06-09' }];
  assert.deepEqual(schedule.scopesCovering(NORD, WEDNESDAY), remaining, 'la portée qui reste, nommée avec son jour');
  assert.deepEqual(schedule.activeScopes(WEDNESDAY), remaining);
  assert.deepEqual(offSeasonDays(gestures, NORD), WEEK, 'le jardin Nord reste hors saison toute la semaine');
  assert.deepEqual(offSeasonDays(gestures, SUD), [MONDAY, TUESDAY], 'le jardin Sud reprend le mercredi');
  assert.equal(objective(NORD, { gestures }).value, null);
  near(objective(SUD, { gestures }).value, 3.8 + 4.5 + 5.0 + 4.6 + 3.9, 'jardin Sud : 21,8 mm à partir du mercredi');
});

test('cas 5 : tout le sous-abri ne couvre pas un jardin à classer, tout le plein champ non plus : le module ne devine pas', () => {
  const gestures = [put(SOUS_ABRI, BEFORE), put(PLEIN_CHAMP, BEFORE)];
  assert.deepEqual(offSeasonDays(gestures, NEUVE), [], 'ni plein champ ni sous abri (D-003)');
  assert.deepEqual(offSeasonSchedule(gestures).scopesCovering(NEUVE, MONDAY), []);
  assert.deepEqual(offSeasonDays(gestures, ABRI), WEEK);
  assert.deepEqual(offSeasonDays(gestures, NORD), WEEK);
  near(objective(NEUVE, { gestures, goals: [farmGoal(20)] }).value, 20, 'le jardin à classer garde son objectif');
  // Mis hors saison par son nom, ou par sa parcelle, il l'est.
  assert.deepEqual(offSeasonDays([put({ level: 'plot', plotId: 'jardin-neuf' }, BEFORE)], NEUVE), WEEK);
  assert.deepEqual(offSeasonDays([put({ level: 'zone', zoneId: 'parcelle' }, BEFORE)], NEUVE), WEEK);
});

test('cas 6 : une irrigation réelle mardi sur une planche hors saison est comptée, sans objectif auquel la comparer', () => {
  const events = [realIrrigation('arrosage-mardi', 'goutte-a-goutte', '2026-06-16T05:00:00.000Z', [NORD.id], 10, 10)];
  const before = row(dashboard({ events }), NORD.id);
  const after = row(dashboard({ events, gestures: [put(PLEIN_CHAMP, BEFORE)] }), NORD.id);
  assert.equal(after.actualIrrigationMm, 10, 'l’irrigation réelle reste comptée');
  assert.equal(after.actualIrrigationMm, before.actualIrrigationMm);
  assert.equal(after.objectiveMm, null);
  assert.equal(after.realRemainingMm, null, 'rien à comparer : aucun dépassement inventé');
  assert.equal(after.relativeDeficitPercent, null);
  assert.equal(after.effectiveNeedMm, null, 'aucun besoin, aucune proposition');
  assert.equal(after.effectiveVolumeCubicMeters, null);
  assert.equal(objectiveOffSeason(after), true, '« hors saison »');
});

test('cas 7 : une semaine close avant la pause garde l’objectif d’avant, enregistré ou saisi', () => {
  const recorded = automaticObjectiveWeekRecord(automatic(NORD), NORD, { weekDates: WEEK, days: WEEK });
  const closed = automatic(NORD, { today: '2026-06-24', closedWeeks: new Map([[MONDAY, recorded]]) });
  // Mis hors saison le mercredi qui suit la semaine close.
  const daysOf = offSeasonSchedule([put(PLEIN_CHAMP, at('2026-06-24'))]).daysOf(NORD);
  const before = objectiveForBed([], NORD, MONDAY, SUNDAY, closed);
  const after = objectiveForBed([], NORD, MONDAY, SUNDAY, closed, daysOf);
  assert.deepEqual(after, before, 'la semaine close ne bouge pas (D-318)');
  near(after.value, 30, 'les 30,0 mm enregistrés');
  assert.equal(after.automatic?.closure, 'recorded');
  const goals = [farmGoal(20)];
  assert.deepEqual(objectiveForBed(goals, NORD, MONDAY, SUNDAY, undefined, daysOf), objectiveForBed(goals, NORD, MONDAY, SUNDAY), 'l’objectif saisi de la semaine close non plus');
  // La semaine du geste, elle, compte ses jours hors saison à partir du mercredi.
  const next = objectiveForBed([], NORD, '2026-06-22', '2026-06-28', undefined, daysOf);
  assert.deepEqual(next.offSeasonDates, ['2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28']);
});

test('cas 8 : un gel prévu vendredi sur des poireaux dehors, plein champ hors saison : l’alerte part comme avant', () => {
  // Les données du contrat des alertes par culture : lundi 9 novembre 2026, poireaux plantés en semaine 36, alerte à −6 °C.
  const monday = '2026-11-09';
  const friday = '2026-11-13';
  const { subjects } = frostSubjects({
    series: [series({ id: 'poireaux', plantId: 'p-poireau', plantName: 'Poireau', harvestWeeksExpected: ['2027-W05'] })],
    tasks: [planting('poireaux', '2026-W36')],
    revisions: [link('p-poireau', 'poireau')],
    common: COMMON,
    shelteredSeriesIds: new Set(),
    today: monday,
  });
  const evaluation = evaluateFrost({
    subjects,
    forecasts: [{ date: friday, minimumTemperatureCelsius: -7, forecastedAt: FROST_FORECAST_AT }],
    today: monday,
    horizonDays: 5,
    offsetCelsius: 0,
    alertedKeys: new Set(),
  });
  assert.deepEqual(evaluation.days.map((day) => [day.date, day.crossings.map((crossing) => crossing.name)]), [[friday, ['Poireau']]], 'l’alerte de gel du vendredi');
  assert.equal(offSeasonSchedule([put(PLEIN_CHAMP, '2026-11-02T09:00:00.000Z')]).daysOf(NORD)(friday), true, 'la planche des poireaux est bien hors saison ce vendredi');
  // L'alerte ne reçoit rien du filtre et son module n'y mène pas : la garde ci-dessous le vérifie.
});

test('cas 9 : la pause levée mercredi : l’objectif à partir du mercredi, 21,8 mm ; lundi et mardi hors saison', () => {
  const result = objective(NORD, { gestures: [put(PLEIN_CHAMP, BEFORE), resume(PLEIN_CHAMP, at(WEDNESDAY))] });
  near(result.value, 21.8, '3,8 + 4,5 + 5,0 + 4,6 + 3,9');
  assert.equal(result.origin, 'automatic');
  assert.deepEqual(result.automatic?.days.map((day) => day.date), [WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  assert.deepEqual(result.offSeasonDates, [MONDAY, TUESDAY]);
});

test('cas 10 : objectif automatique éteint, plein champ hors saison : l’objectif saisi n’y compte pas non plus', () => {
  const gestures = [put(PLEIN_CHAMP, BEFORE)];
  const goals = [farmGoal(20)];
  const absent = objective(NORD, { gestures, goals, automatic: null });
  assert.equal(absent.value, null, 'le filtre ne dépend pas de l’objectif automatique');
  assert.deepEqual(absent.offSeasonDates, WEEK);
  const switchedOff = objective(NORD, { gestures, goals, automatic: automatic(NORD, { settings: [ON_JUNE_FIRST, { enabled: false, createdAt: '2026-06-02T07:00:00.000Z' }] }) });
  assert.equal(switchedOff.value, null, 'réglage éteint : pareil');
  near(objective(ABRI, { gestures, goals, automatic: null }).value, 20, 'sous abri, l’objectif saisi');
});

test('garde : la pluie, l’ET0 et l’irrigation de chaque planche sont les mêmes, filtre actif ou non, sur deux fermes', () => {
  const everything = [put({ level: 'zone', zoneId: 'parcelle' }, BEFORE), put({ level: 'zone', zoneId: 'verger' }, BEFORE), put(PLEIN_CHAMP, BEFORE), put(SOUS_ABRI, BEFORE)];
  const events = [realIrrigation('arrosage-mardi', 'goutte-a-goutte', '2026-06-16T05:00:00.000Z', [NORD.id, ABRI.id], 10, 10), plannedOn(SUD.id, at(FRIDAY), 6)];
  // Deux fermes : la ferme complète, avec un pluviomètre ; une ferme de plein champ seul, à la pluie et à la prévision incomplètes.
  const farms = [
    { beds: FARM_BEDS, days: weekDays({ gaugeMm: { [MONDAY]: 12 }, reanalysisMm: { [TUESDAY]: 4 } }) },
    { beds: [SUD, VERGER], days: weekDays({ reanalysisMm: { [TUESDAY]: null }, forecastMm: { [SUNDAY]: null } }) },
  ];
  for (const farm of farms) {
    const plain = dashboard({ ...farm, events, decisions: [decision(SUD.id, 15)] });
    const filtered = dashboard({ ...farm, events, decisions: [decision(SUD.id, 15)], gestures: everything });
    assert.ok(rowsOf(filtered).every((bed) => objectiveOffSeason(bed)), 'toutes les planches sont hors saison');
    assert.deepEqual(rowsOf(filtered).map(untouched), rowsOf(plain).map(untouched));
    assert.deepEqual(filtered.completeness.missingDates, plain.completeness.missingDates, 'les jours de pluie, de prévision et d’ET0 manquants');
    assert.deepEqual(filtered.completeness.estimatedDates, plain.completeness.estimatedDates, 'les jours de pluie repris de la prévision');
  }
});

/*
 * La garde du contrat (section 8) : la pluie, la réserve du sol, l'ET0, la
 * météo et ses alertes, les cultures et l'archivage des prévisions ne passent
 * jamais par le filtre. Leurs modules de calcul n'y mènent par aucun import,
 * même de proche en proche ; les services de la météo, de la réserve du sol
 * et des alertes ne le nomment pas. Les imports de type seuls ne portent
 * aucun calcul et ne sont pas suivis.
 */
const FILTER_MODULES = ['lib/domain/off-season.ts', 'lib/domain/irrigation-needs.ts', 'lib/domain/farm-objective.ts'];
const FILTER_NAMES = /off-season|offSeason|OffSeason/;
const VALUE_IMPORT = /^\s*(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+'([^']+)'/gm;

function sourceFiles(path: string): string[] {
  if (statSync(path).isDirectory()) return readdirSync(path).flatMap((name) => sourceFiles(join(path, name)));
  return /\.(ts|js)$/.test(path) && !path.endsWith('.d.ts') ? [path] : [];
}

function resolveImport(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/') ? specifier.slice(2) : normalize(join(dirname(from), specifier));
  for (const candidate of [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Les modules qu'atteignent les imports de valeur des fichiers donnés, de proche en proche, chacun avec celui qui l'importe. */
function reachedFrom(starts: readonly string[]): Map<string, string | null> {
  const reached = new Map<string, string | null>();
  const queue: [string, string | null][] = starts.flatMap(sourceFiles).map((file) => [file, null]);
  while (queue.length > 0) {
    const [file, importer] = queue.shift()!;
    if (reached.has(file)) continue;
    reached.set(file, importer);
    for (const match of readFileSync(file, 'utf8').matchAll(VALUE_IMPORT)) {
      const target = resolveImport(file, match[1]);
      if (target !== null && !reached.has(target)) queue.push([target, file]);
    }
  }
  return reached;
}

function chainTo(reached: Map<string, string | null>, file: string): string {
  const chain: string[] = [];
  for (let at: string | null | undefined = file; at; at = reached.get(at)) chain.unshift(at);
  return chain.join(' → ');
}

test('garde : les calculs de la pluie, de l’ET0, de la réserve du sol, des alertes et des cultures n’atteignent jamais le filtre', () => {
  const reached = reachedFrom([
    'lib/domain/water-management.ts',
    'lib/domain/weather',
    'lib/domain/crop-alerts',
    'lib/domain/soil-reserve',
    'lib/domain/crop-water',
  ]);
  assert.ok(reached.size > 50, `les modules de la garde sont bien lus (${reached.size})`);
  for (const filterModule of FILTER_MODULES) {
    assert.equal(reached.has(filterModule), false, `la règle s’y appellerait : ${reached.has(filterModule) ? chainTo(reached, filterModule) : filterModule}`);
  }
  for (const file of reached.keys()) assert.doesNotMatch(readFileSync(file, 'utf8'), FILTER_NAMES, `${file} nomme le filtre`);
});

test('garde : les services de la météo, de la réserve du sol et des alertes ne nomment pas le filtre', () => {
  const services = [
    ...sourceFiles('lib/services/weather'),
    'lib/services/soil-reserve-record.ts',
    'lib/services/crop-alerts-service.ts',
    'lib/services/weather-alerts-service.ts',
    'lib/services/intraday-weather-alerts.ts',
    ...sourceFiles('cloudflare/irrigation-weather-scheduler/src'),
  ];
  for (const file of services) assert.doesNotMatch(readFileSync(file, 'utf8'), FILTER_NAMES, `${file} nomme le filtre`);
});

test('contre-épreuve : la garde voit un calcul qui passerait par le filtre', () => {
  // Le tableau des besoins passe par le filtre : la garde le trouve, avec le chemin.
  const needs = reachedFrom(['lib/domain/irrigation-needs.ts']);
  assert.equal(needs.has('lib/domain/off-season.ts'), true);
  assert.equal(chainTo(needs, 'lib/domain/off-season.ts'), 'lib/domain/irrigation-needs.ts → lib/domain/off-season.ts');
  // L'objectif de la ferme aussi, et « Aujourd'hui » à travers lui.
  assert.equal(reachedFrom(['lib/domain/today/essential.ts']).has('lib/domain/off-season.ts'), true);
  // Un import de valeur est suivi ; un import de type seul ne l'est pas.
  assert.ok([..."import { offSeasonSchedule } from '../off-season.ts';".matchAll(VALUE_IMPORT)].length === 1);
  assert.ok([..."import type { OffSeasonDays } from '../off-season.ts';".matchAll(VALUE_IMPORT)].length === 0);
  assert.match("const days = schedule.daysOf(bed); // offSeason", FILTER_NAMES);
});

test('les cinq portées : une planche, un jardin ou un abri, une parcelle, tout le plein champ, tout le sous-abri', () => {
  const covered = (scope: OffSeasonScope) => FARM_BEDS.filter((bed) => offSeasonSchedule([put(scope, BEFORE)]).daysOf(bed)(MONDAY)).map((bed) => bed.id);
  assert.deepEqual(covered({ level: 'bed', bedId: NORD.id }), [NORD.id]);
  assert.deepEqual(covered(JARDIN_NORD), [NORD.id, NORD_2.id]);
  assert.deepEqual(covered({ level: 'plot', plotId: 'abri' }), [ABRI.id]);
  assert.deepEqual(covered({ level: 'zone', zoneId: 'parcelle' }), [NORD.id, NORD_2.id, SUD.id, ABRI.id, NEUVE.id]);
  assert.deepEqual(covered(PLEIN_CHAMP), [NORD.id, NORD_2.id, SUD.id, VERGER.id], 'tous les jardins de plein champ de la ferme, toutes parcelles');
  assert.deepEqual(covered(SOUS_ABRI), [ABRI.id]);
  // Évaluées à la lecture : un jardin reclassé suit la portée qui le couvre alors (section 4.3).
  const gestures = [put(PLEIN_CHAMP, BEFORE)];
  assert.deepEqual(offSeasonDays(gestures, { ...NORD, plotMode: 'greenhouse' }), [], 'reclassé sous abri : tout le plein champ ne le couvre plus');
  assert.deepEqual(offSeasonDays(gestures, { ...NEUVE, plotMode: 'garden' }), WEEK, 'classé plein champ : couvert');
});

test('l’ordre des gestes : le dernier du jour fait foi pour toute la journée ; à la même milliseconde, le second reçu', () => {
  assert.deepEqual(offSeasonDays([put(PLEIN_CHAMP, at(WEDNESDAY, '06:00')), resume(PLEIN_CHAMP, at(WEDNESDAY, '15:00'))], NORD), [], 'mis puis repris le même jour : en saison toute la journée');
  assert.deepEqual(offSeasonDays([resume(PLEIN_CHAMP, at(WEDNESDAY, '06:00')), put(PLEIN_CHAMP, at(WEDNESDAY, '15:00'))], NORD), [WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  const instant = at(WEDNESDAY);
  assert.deepEqual(offSeasonDays([put(PLEIN_CHAMP, instant), resume(PLEIN_CHAMP, instant)], NORD), [], 'même milliseconde : le second reçu fait foi (docs/revision-order-contract.md)');
  assert.deepEqual(offSeasonDays([resume(PLEIN_CHAMP, instant), put(PLEIN_CHAMP, instant)], NORD), [WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  assert.deepEqual(offSeasonDays([resume(PLEIN_CHAMP, at(THURSDAY)), put(PLEIN_CHAMP, at(MONDAY))], NORD), [MONDAY, TUESDAY, WEDNESDAY], 'reçus dans le désordre : l’instant fait foi');
  const twice = offSeasonSchedule([put(PLEIN_CHAMP, at(MONDAY)), put(PLEIN_CHAMP, at(THURSDAY))]);
  assert.deepEqual(twice.scopesCovering(NORD, SUNDAY), [{ scope: PLEIN_CHAMP, since: MONDAY }], 'un second « Mettre hors saison » ne change pas le jour de départ');
  assert.deepEqual(offSeasonDays([resume(PLEIN_CHAMP, BEFORE)], NORD), [], '« Reprendre » seul ne fait rien');
  assert.equal(offSeasonSchedule([put(PLEIN_CHAMP, BEFORE)]).daysOf(NORD)('2027-03-01'), true, 'ni date ni calendrier : le filtre ne se lève qu’à la main');
});

test('au tableau des besoins, une planche hors saison reste dans son jardin et sort de ses comptes', () => {
  const plain = dashboard();
  // Une planche du jardin Nord hors saison : le jardin se compte sur l'autre.
  const one = dashboard({ gestures: [put({ level: 'bed', bedId: NORD.id }, BEFORE)] });
  const north = garden(one, 'jardin-nord');
  assert.equal(north.bedCount, 2, 'la planche hors saison reste dans les lignes du jardin');
  assert.deepEqual(north.beds.map((bed) => bed.bedId), [NORD.id, NORD_2.id]);
  near(north.realRemainingMm, row(one, NORD_2.id).realRemainingMm!, 'le reste du jardin est celui de la planche en saison');
  near(north.effectiveNeedMm, row(one, NORD_2.id).effectiveNeedMm!);
  near(north.effectiveVolumeCubicMeters, row(one, NORD_2.id).effectiveVolumeCubicMeters!);
  assert.equal(north.areaSquareMeters, garden(plain, 'jardin-nord').areaSquareMeters, 'la surface du jardin ne change pas');
  // Tout le jardin Nord hors saison : ni reste, ni besoin, ni volume, jamais un zéro.
  const all = garden(dashboard({ gestures: [put(JARDIN_NORD, BEFORE)] }), 'jardin-nord');
  assert.equal(all.realRemainingMm, null);
  assert.equal(all.effectiveNeedMm, null);
  assert.equal(all.effectiveVolumeCubicMeters, null);
  assert.equal(all.bedCount, 2);
  // Les autres jardins ne bougent pas.
  assert.deepEqual(garden(one, 'abri'), garden(plain, 'abri'));
});

test('l’objectif de la ferme au tableau des besoins : « 2 planches sur 2 ont un objectif, 4 hors saison »', () => {
  const board = dashboard({ gestures: [put(PLEIN_CHAMP, BEFORE)] });
  assert.deepEqual(board.farmObjective, { objectiveMm: 20, withObjective: 2, total: 6, offSeason: 4 });
  assert.equal(farmObjectiveText(board.farmObjective), '20 mm visés, 2 planches sur 2 ont un objectif, 4 hors saison');
  assert.equal(board.completeness.missing.includes('objective'), false, 'aucun objectif manquant à l’échelle de la ferme');
  assert.deepEqual(dashboard().farmObjective, { objectiveMm: 20, withObjective: 6, total: 6 });
});

test('les comptes de l’objectif de la ferme : la moyenne sur les planches en saison, les planches hors saison dites à part', () => {
  const inSeason = Array.from({ length: 7 }, () => ({ areaSquareMeters: 100, objectiveMm: 20 }));
  const offSeason = Array.from({ length: 3 }, () => ({ areaSquareMeters: 100, objectiveMm: null, offSeasonDates: WEEK }));
  const objectiveOfFarm = farmObjective([...inSeason, ...offSeason]);
  assert.deepEqual(objectiveOfFarm, { objectiveMm: 20, withObjective: 7, total: 10, offSeason: 3 });
  assert.equal(farmObjectiveScopeText(objectiveOfFarm), '7 planches sur 7 ont un objectif, 3 hors saison', 'la phrase du contrat (section 4.1)');
  assert.equal(farmObjectiveText(objectiveOfFarm), '20 mm visés, 7 planches sur 7 ont un objectif, 3 hors saison');
  assert.equal(farmObjectivePartial(objectiveOfFarm), true, 'l’eau reçue se compare sur les seules planches qui ont un objectif');

  const withoutObjective = { areaSquareMeters: 100, objectiveMm: null };
  assert.equal(farmObjectiveScopeText(farmObjective([...inSeason.slice(0, 5), withoutObjective, withoutObjective, ...offSeason])), '5 planches sur 7 ont un objectif, 3 hors saison', 'une planche en saison sans objectif reste « sans objectif »');
  assert.equal(farmObjectiveText(farmObjective(offSeason)), 'aucune eau visée, 3 planches hors saison');
  assert.equal(farmObjectiveScopeText(farmObjective(offSeason)), 'aucune planche en saison, 3 hors saison');
  assert.equal(farmObjectiveText(farmObjective([withoutObjective, offSeason[0]])), 'aucune eau visée, 1 planche hors saison');
  assert.equal(farmObjectiveScopeText(farmObjective([withoutObjective, ...offSeason])), 'aucune planche sur 1 n’a d’objectif, 3 hors saison');
  assert.equal(farmObjectiveScopeText(farmObjective([{ areaSquareMeters: 100, objectiveMm: 20 }, offSeason[0]])), '1 planche sur 1 a un objectif, 1 hors saison');

  // Hors saison une partie de la période seulement, avec un objectif les autres jours : comptée avec son objectif.
  assert.deepEqual(farmObjective([{ areaSquareMeters: 100, objectiveMm: 12, offSeasonDates: [THURSDAY, FRIDAY, SATURDAY, SUNDAY] }]), { objectiveMm: 12, withObjective: 1, total: 1 });
  // Sans planche hors saison, le résultat et la phrase d'avant.
  assert.deepEqual(farmObjective(inSeason), { objectiveMm: 20, withObjective: 7, total: 7 });
  assert.equal(farmObjectiveText(farmObjective(inSeason)), '20 mm visés, ferme entière');
  assert.equal(farmObjectiveText(farmObjective([...inSeason, withoutObjective])), '20 mm visés, 7 planches sur 8 ont un objectif');
});

test('un besoin remplacé à la main reste enregistré, inactif, tant que la planche est hors saison sans objectif', () => {
  const decisions = [decision(NORD.id, 15)];
  near(row(dashboard({ decisions }), NORD.id).effectiveNeedMm, 15, 'en saison, le remplacement fait le besoin');
  const after = row(dashboard({ decisions, gestures: [put(PLEIN_CHAMP, BEFORE)] }), NORD.id);
  assert.equal(after.manualOverrideMm, 15, 'le remplacement reste là, rien n’est effacé');
  assert.equal(after.overrideReason, 'repiquage');
  assert.equal(after.effectiveNeedMm, null, 'aucun besoin, aucune proposition (section 4.1)');
  assert.equal(after.effectiveVolumeCubicMeters, null);
  // Hors saison depuis jeudi, avec trois jours d'objectif : la planche garde son besoin de la semaine.
  const partial = row(dashboard({ decisions, gestures: [put(PLEIN_CHAMP, at(THURSDAY))] }), NORD.id);
  assert.deepEqual(partial.offSeasonDates, [THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  near(partial.objectiveMm, 20 * 3 / 7, 'trois septièmes des 20 mm');
  near(partial.effectiveNeedMm, 15);
});
