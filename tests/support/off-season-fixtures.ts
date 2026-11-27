import assert from 'node:assert/strict';
import type { AutomaticObjectiveInput, AutomaticObjectiveSettingRevision } from '../../lib/domain/automatic-objective.ts';
import type { Et0Reading } from '../../lib/domain/crop-water/etm.ts';
import type { Bed, IrrigationSnapshot, Plot, PlotMode } from '../../lib/domain/domain.ts';
import type { IrrigationEventRecord } from '../../lib/domain/irrigation-event-record.ts';
import type { GoalRevisionLike } from '../../lib/domain/irrigation-history/contract.ts';
import {
  buildIrrigationNeedsDashboard,
  objectiveForBed,
  type BedIrrigationNeed,
  type IrrigationNeedDecision,
  type IrrigationNeedsDashboard,
} from '../../lib/domain/irrigation-needs.ts';
import { offSeasonSchedule, type OffSeasonBed, type OffSeasonRevision, type OffSeasonScope } from '../../lib/domain/off-season.ts';
import type { WaterDashboardDay } from '../../lib/domain/water-management.ts';
import { realIrrigation } from './planning-fixtures.ts';

/**
 * La ferme et la semaine des tests du filtre « hors saison »
 * (docs/objectif-automatique-saison-contract.md ; B1, D-341 ; B2, D-352).
 *
 * Semaine du lundi 15 au dimanche 21 juin 2026, ET0 des sept jours 4,0 ·
 * 4,2 · 3,8 · 4,5 · 5,0 · 4,6 · 3,9 mm, soit 30,0 mm : les chiffres du
 * contrat, ceux du 6 decies. Objectif automatique allumé depuis le 1er juin,
 * sauf mention. Les jardins Nord et Sud sont en plein champ, l'abri sous abri,
 * le jardin neuf à classer ; le verger est une autre parcelle.
 */

export const WEEK = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];
export const [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY] = WEEK;
const ET0 = [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, 3.9];
/** Le lundi qui suit : tous les jours de la semaine sont passés, leur ET0 est la réanalyse. */
export const NEXT_MONDAY = '2026-06-22';
/** Le lundi 8 juin à 10 h à Paris : un geste posé avant la semaine. */
export const BEFORE = '2026-06-08T08:00:00.000Z';
/** Un instant du jour `date`, en temps universel ; 8 h vaut 10 h à Paris en juin. */
export const at = (date: string, time = '08:00') => `${date}T${time}:00.000Z`;

export const FARM_BEDS: readonly (OffSeasonBed & { area: number })[] = [
  { id: 'planche-nord-1', zoneId: 'parcelle', plotId: 'jardin-nord', plotMode: 'garden', area: 100 },
  { id: 'planche-nord-2', zoneId: 'parcelle', plotId: 'jardin-nord', plotMode: 'garden', area: 50 },
  { id: 'planche-sud-1', zoneId: 'parcelle', plotId: 'jardin-sud', plotMode: 'garden', area: 100 },
  { id: 'planche-abri-1', zoneId: 'parcelle', plotId: 'abri', plotMode: 'greenhouse', area: 60 },
  { id: 'planche-neuve-1', zoneId: 'parcelle', plotId: 'jardin-neuf', plotMode: 'unclassified', area: 40 },
  { id: 'rang-verger-1', zoneId: 'verger', plotId: 'rangs', plotMode: 'garden', area: 80 },
];
export const [NORD, NORD_2, SUD, ABRI, NEUVE, VERGER] = FARM_BEDS;

export const PLEIN_CHAMP: OffSeasonScope = { level: 'mode', mode: 'garden' };
export const SOUS_ABRI: OffSeasonScope = { level: 'mode', mode: 'greenhouse' };
export const JARDIN_NORD: OffSeasonScope = { level: 'plot', plotId: 'jardin-nord' };

export const put = (scope: OffSeasonScope, createdAt: string): OffSeasonRevision => ({ scope, offSeason: true, createdAt });
export const resume = (scope: OffSeasonScope, createdAt: string): OffSeasonRevision => ({ scope, offSeason: false, createdAt });

export const ON_JUNE_FIRST: AutomaticObjectiveSettingRevision = { enabled: true, createdAt: '2026-06-01T07:00:00.000Z' };
const reanalysis = (): Et0Reading[] => WEEK.map((date, index) => ({ date, reanalysisMm: ET0[index], forecastMm: null }));

export function automatic(bed: OffSeasonBed, overrides: Partial<AutomaticObjectiveInput> = {}): AutomaticObjectiveInput {
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
export function farmGoal(amountMm: number | null, createdAt = '2026-06-01T07:00:00.000Z'): GoalRevisionLike {
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
export function objective(bed: OffSeasonBed, options: { gestures?: readonly OffSeasonRevision[]; goals?: readonly GoalRevisionLike[]; automatic?: AutomaticObjectiveInput | null } = {}) {
  const input = options.automatic === null ? undefined : options.automatic ?? automatic(bed);
  return objectiveForBed(options.goals ?? [], bed, MONDAY, SUNDAY, input, offSeasonSchedule(options.gestures ?? []).daysOf(bed));
}

/** Les jours de la semaine où le filtre dit la planche hors saison. */
export const offSeasonDays = (gestures: readonly OffSeasonRevision[], bed: OffSeasonBed) => WEEK.filter(offSeasonSchedule(gestures).daysOf(bed));

export function near(actual: number | null | undefined, expected: number, message = '') {
  assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message} : attendu ${expected}, obtenu ${actual}`);
}

/*
 * Le tableau des besoins d'une ferme, calculé le mercredi 17 juin à 10 h
 * sauf mention : lundi à mercredi sont passés, jeudi à dimanche sont prévus.
 */
const NOW = new Date('2026-06-17T08:00:00.000Z');

function plot(id: string, zoneId: string, name: string, mode: PlotMode): Plot {
  return { id, zoneId, name, mode, length: 10, width: 10, area: 100, seasons: [2026] };
}

export function snapshotOf(beds: readonly (OffSeasonBed & { area: number })[]): IrrigationSnapshot {
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
 * (1 mm par jour sans mention). `today` : le dernier jour passé, le mercredi
 * sans mention.
 */
export function weekDays(options: { gaugeMm?: Partial<Record<string, number>>; reanalysisMm?: Partial<Record<string, number | null>>; forecastMm?: Partial<Record<string, number | null>>; today?: string } = {}): WaterDashboardDay[] {
  return WEEK.map((date, index) => {
    const past = date <= (options.today ?? WEDNESDAY);
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

export function dashboard(options: {
  gestures?: readonly OffSeasonRevision[];
  beds?: readonly (OffSeasonBed & { area: number })[];
  days?: WaterDashboardDay[];
  events?: IrrigationEventRecord[];
  decisions?: IrrigationNeedDecision[];
  goals?: GoalRevisionLike[];
  /** L'instant du calcul ; le mercredi 17 juin à 10 h sans mention. */
  now?: Date;
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
    now: options.now ?? NOW,
    ...(options.gestures === undefined ? {} : { offSeason: offSeasonSchedule(options.gestures) }),
  });
}

export const rowsOf = (board: IrrigationNeedsDashboard) => board.gardens.flatMap((garden) => garden.beds);
export const row = (board: IrrigationNeedsDashboard, bedId: string) => rowsOf(board).find((item) => item.bedId === bedId)!;
export const garden = (board: IrrigationNeedsDashboard, plotId: string) => board.gardens.find((item) => item.plotId === plotId)!;

export function decision(bedId: string, manualOverrideMm: number): IrrigationNeedDecision {
  const bed = FARM_BEDS.find((item) => item.id === bedId)!;
  return { otfZoneId: bed.zoneId, otfPlotId: bed.plotId, otfBedId: bedId, priority: 'normal', manualOverrideMm, overrideReason: 'repiquage', calculatedNeedAtOverrideMm: 8, updatedAt: '2026-06-15T08:00:00.000Z' };
}

/** Un arrosage planifié d'une heure, pas encore fait, de `mm` sur la planche. */
export function plannedOn(bedId: string, startAt: string, mm: number): IrrigationEventRecord {
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
export function untouched(bed: BedIrrigationNeed) {
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
