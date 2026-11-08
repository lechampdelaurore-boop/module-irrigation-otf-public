import assert from 'node:assert/strict';
import test from 'node:test';
import type { Bed } from '../lib/domain/domain.ts';
import type { EquipmentListItem } from '../lib/domain/equipment-record.ts';
import type { EquipmentPlacementRecord } from '../lib/domain/equipment-placement-record.ts';
import type { BedIrrigationCoverage } from '../lib/domain/irrigation-coverage.ts';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import type { BedIrrigationNeed } from '../lib/domain/irrigation-needs.ts';
import type { PlanningInputs, WeeklyPlan } from '../lib/domain/planning/contract.ts';
import { buildPlanningEquipment } from '../lib/domain/planning/demand.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { DEFAULT_PLANNING_SETTINGS, validatePlanningSettings } from '../lib/domain/planning/settings.ts';
import type { IrrigationPump } from '../lib/domain/pumps.ts';
import type { WaterInfrastructure } from '../lib/domain/water-resources.ts';

/**
 * La portée d'un matériel (D-025, docs/planning-contract.md « La portée ») :
 * une planche arrosée sous la part R13 du taux le plus fort ne commande pas
 * l'arrosage. Les chiffres sont ceux de la ferme, lus à la recette réelle du
 * 29 septembre 2026 : une rampe de bloc au réglage « 5 planches » arrose dix
 * planches de 38,4 m² à 7,5 mm/h au centre et 2 mm/h au bord, et déborde
 * de 1,5 mm/h sur la première planche du bloc voisin.
 */

const TZ = 'Europe/Paris';
const NOW = new Date('2026-09-29T17:52:00.000Z'); // mardi 19 h 52 à la ferme
const WEEK = { weekStart: '2026-09-28', weekEnd: '2026-10-04' };
const TUESDAY_21H = '2026-09-29T19:00:00.000Z';
const WEDNESDAY_21H = '2026-09-30T19:00:00.000Z';
/** Le profil « 5 planches », du bord au bord. */
const PROFILE = [2, 3.5, 4.5, 6.25, 7.5, 7.5, 6.25, 4.5, 3.5, 2];

type Rampe = { id: string; kind: 'sprinkler' | 'drip'; rates: Record<string, number> };

type Options = {
  now?: Date;
  rampes: Rampe[];
  needMm?: number | Record<string, number>;
  sheltered?: string[];
  forecast?: Record<string, number>;
  events?: IrrigationEventRecord[];
  reservoir?: { cubicMeters: number; inflow: boolean };
};

function farm(options: Options) {
  const bedIds = [...new Set(options.rampes.flatMap((rampe) => Object.keys(rampe.rates)))].sort();
  const beds: Bed[] = bedIds.map((id) => ({ id, zoneId: 'zone', plotId: id.replace(/\d+$/, ''), name: id, length: 32, width: 0.75, alleyWidth: 0.45, area: 24, seasons: [2026] }));
  const equipment: EquipmentListItem[] = options.rampes.map((rampe) => ({
    id: rampe.id, name: rampe.id, kind: rampe.kind, mobility: 'fixed', status: 'active', settingsCount: 1, archivedAt: null,
    settings: [rampe.kind === 'drip'
      ? { id: `${rampe.id}-setting`, name: 'standard', position: 1, kind: 'drip', rateMmPerHour: 14 }
      : { id: `${rampe.id}-setting`, name: '5 planches', position: 1, kind: 'sprinkler', leftProfile: [{ distanceMeters: 0, rateMmPerHour: 7.5 }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: 7.5 }] }],
  }));
  const coverage: BedIrrigationCoverage[] = beds.flatMap((bed) => {
    const contributions = options.rampes
      .filter((rampe) => rampe.rates[bed.id] !== undefined)
      .map((rampe) => ({ equipmentId: rampe.id, equipmentName: rampe.id, settingId: `${rampe.id}-setting`, settingName: rampe.kind === 'drip' ? 'standard' : '5 planches', kind: rampe.kind, rateMmPerHour: rampe.rates[bed.id] }));
    return contributions.length === 0 ? [] : [{ bedId: bed.id, totalRateMmPerHour: contributions.reduce((sum, c) => sum + c.rateMmPerHour, 0), contributions }];
  });
  const placements: EquipmentPlacementRecord[] = options.rampes.map((rampe) => ({
    id: `${rampe.id}-placement`, equipmentId: rampe.id, settingId: `${rampe.id}-setting`, season: 2026, gardenGroupId: null,
    otfZoneId: 'zone', otfPlotId: Object.keys(rampe.rates)[0].replace(/\d+$/, ''), anchor: { type: 'bed_center', anchorBedOtfId: Object.keys(rampe.rates)[0] },
    selectedBeds: rampe.kind === 'drip' ? Object.keys(rampe.rates).map((bedId) => ({ otfZoneId: 'zone', otfPlotId: bedId.replace(/\d+$/, ''), otfBedId: bedId })) : [],
  }));
  const pumps: IrrigationPump[] = [{
    id: 'pompe', name: 'La pompe', maximumFlowCubicMetersPerHour: 8, status: 'active', archivedAt: null, notes: null,
    origins: [{ id: 'origine', pumpId: 'pompe', sourceKind: 'reservoir', resourceId: null, reservoirId: 'reserve', isDefault: true }],
  }];
  const reservoir = options.reservoir ?? { cubicMeters: 30, inflow: true };
  const infrastructure: WaterInfrastructure = {
    resources: [{ id: 'forage', name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 0.511, status: 'active', availableFrom: null, availableUntil: null, notes: null }],
    resourceLimits: [],
    reservoirs: [{
      id: 'reserve', name: 'Réserve tampon', type: 'tank', capacityCubicMeters: 60, currentVolumeCubicMeters: reservoir.cubicMeters,
      currentVolumeObservedAt: '2026-09-29T10:00:00.000Z', minimumSafetyCubicMeters: 0, exposedSurfaceSquareMeters: 0,
      receivesRain: false, evaporationEnabled: false, evaporationCoefficient: 0, status: 'active', notes: null,
    }],
    resourceReservoirLinks: reservoir.inflow ? [{ id: 'lien', resourceId: 'forage', reservoirId: 'reserve', fillMode: 'automatic', active: true }] : [],
    reservoirLinks: [],
    defaultSupply: { sourceKind: 'reservoir', resourceId: null, reservoirId: 'reserve' },
    movements: [],
  };
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = `2026-${index < 3 ? '09' : '10'}-${String(index < 3 ? 28 + index : index - 2).padStart(2, '0')}`;
    return { date, forecastRainMm: options.forecast?.[date] ?? 0, et0Mm: 3 };
  });
  const needs: BedIrrigationNeed[] = beds.map((bed) => {
    const need = typeof options.needMm === 'number' ? options.needMm : options.needMm?.[bed.id] ?? 17.2;
    const sheltered = options.sheltered?.includes(bed.id) ?? false;
    return {
      bedId: bed.id, bedName: bed.id, plotId: bed.plotId, plotName: bed.plotId, zoneId: 'zone', zoneName: 'Zone',
      sheltered, areaSquareMeters: bed.area, wettedAreaSquareMeters: bed.area, wettedAreaSource: 'sprinkler',
      et0Mm: null, et0KnownMm: null, et0ReanalysisMm: null, et0ForecastMm: null,
      objectiveMm: need, objectiveSource: 'farm', actualRainMm: 0, actualIrrigationMm: 0, realRemainingMm: need, relativeDeficitPercent: 100,
      forecastRainMm: 0, plannedIrrigationMm: 0, rawPlanningNeedMm: need, thresholdMm: 0, calculatedNeedMm: need,
      manualOverrideMm: null, overrideReason: null, effectiveNeedMm: need, effectiveVolumeCubicMeters: need * bed.area / 1000,
      priority: 'normal', weekStart: WEEK.weekStart, weekEnd: WEEK.weekEnd, deadlineAt: '2026-10-04T22:00:00.000Z',
      completeness: { complete: true, missing: [], demandComplete: true, realComplete: true, planningComplete: true, missingDates: { et0: [], actualRain: [], forecastRain: [] }, estimatedDates: { actualRain: [] } },
    };
  });
  const inputs: PlanningInputs = {
    season: 2026, now: options.now ?? NOW, weekStart: WEEK.weekStart, weekEnd: WEEK.weekEnd, timeZone: TZ,
    needs, beds, days, coverage, equipment, placements, pumpDefaults: options.rampes.map((rampe) => ({ equipmentId: rampe.id, pumpId: 'pompe' })), pumps, infrastructure,
    dailyLimits: [], events: options.events ?? [], arbitration: null,
  };
  return inputs;
}

function profile(prefix: string, extra: Record<string, number> = {}): Record<string, number> {
  return { ...Object.fromEntries(PROFILE.map((rate, index) => [`${prefix}${index + 1}`, rate])), ...extra };
}

/** Une irrigation réelle d'une heure, avec le taux de chaque planche arrosée. */
function realIrrigation(equipmentId: string, startAt: string, rates: Record<string, number>): IrrigationEventRecord {
  const endAt = new Date(new Date(startAt).getTime() + 3_600_000).toISOString();
  const status = 'completed' as const;
  return {
    id: `${equipmentId}-event`, season: 2026, status, note: null, remainingCanceledAt: null, canceledAt: null, createdAt: startAt, updatedAt: endAt,
    equipment: {
      id: `${equipmentId}-event-eq`, equipmentId, settingId: `${equipmentId}-setting`, placementId: `${equipmentId}-placement`, status,
      plannedStartAt: null, plannedEndAt: null, actualStartAt: startAt, actualEndAt: endAt, plannedDurationSeconds: 3600, actualDurationSeconds: 3600,
      equipmentSnapshot: { id: equipmentId, name: equipmentId, kind: 'sprinkler', mobility: 'fixed' },
      settingSnapshot: { id: `${equipmentId}-setting`, name: '5 planches', position: 1, kind: 'sprinkler', leftProfile: [{ distanceMeters: 0, rateMmPerHour: 7.5 }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: 7.5 }] },
      placementSnapshot: { id: `${equipmentId}-placement`, equipmentId, settingId: `${equipmentId}-setting`, season: 2026, gardenGroupId: null, otfZoneId: 'zone', otfPlotId: 'A', anchor: { type: 'bed_center', anchorBedOtfId: Object.keys(rates)[0] }, selectedBeds: [] },
      timerState: null, timerStartedAt: null, timerResumedAt: null, timerPausedAt: null, timerTheoreticalEndAt: null,
      timerAccumulatedSeconds: 0, timerAlarmRevision: null, timerAlarmStatus: null, timerAlarmSyncedAt: null,
      remainingCanceledAt: null, canceledAt: null,
      applications: Object.entries(rates).map(([bedId, rate]) => ({ otfZoneId: 'zone', otfPlotId: bedId.replace(/\d+$/, ''), otfBedId: bedId, rateMmPerHour: rate, bedAreaSquareMeters: 38.4, wettedAreaSquareMeters: 38.4, plannedAmountMm: rate, actualAmountMm: rate })),
    },
  };
}

const settings = DEFAULT_PLANNING_SETTINGS;
const byEquipment = (plan: WeeklyPlan, equipmentId: string) => plan.proposals.filter((proposal) => proposal.equipmentId === equipmentId);
const outcome = (plan: WeeklyPlan, bedId: string) => plan.beds.find((bed) => bed.bedId === bedId)!;
const close = (actual: number | null | undefined, expected: number, tolerance: number, message: string) => {
  assert.ok(actual !== null && actual !== undefined && Math.abs(actual - expected) <= tolerance, `${message} : attendu ${expected}, obtenu ${actual}`);
};

test('une rampe à profil tourne une fois pour son centre ; les bords sont « portée insuffisante », jamais poursuivis', () => {
  const plan = buildWeeklyPlan(farm({ rampes: [{ id: 'rampe A', kind: 'sprinkler', rates: profile('A') }] }), settings);
  const slots = byEquipment(plan, 'rampe A');
  assert.equal(slots.length, 1, 'un seul créneau : le centre est servi, le reste attend sous la dose minimale');
  const [slot] = slots;
  assert.equal(slot.startAt, TUESDAY_21H, 'à l’ouverture de la plage');
  assert.equal(slot.durationSeconds, 7200, '15 mm à 7,5 mm/h');
  close(slot.doseMm, 15, 0.01, 'la dose est celle de la planche la mieux arrosée');
  assert.equal(slot.justification.doseReason, 'maximum-dose');
  close(slot.volumeCubicMeters, 3.648, 0.001, 'le volume de la ferme : 47,5 mm/h sur 38,4 m² pendant 2 h');
  const applied = Object.fromEntries(slot.bedApplications.map((application) => [application.bedId, application.appliedMm]));
  close(applied.A5, 15, 0.01, 'le centre');
  close(applied.A3, 9, 0.01, 'à 4,5 mm/h');
  close(applied.A1, 4, 0.01, 'le bord');

  // Le centre garde 2,2 mm : sous la dose minimale, il attend ; les autres n'ont pas la portée.
  assert.deepEqual(outcome(plan, 'A5').reasons, ['below-minimum-dose']);
  close(outcome(plan, 'A5').deficitMm, 2.2, 0.01, 'le reste du centre');
  assert.deepEqual(outcome(plan, 'A4').reasons, ['insufficient-reach'], '6,25 mm/h : commande, mais moins vite que le centre');
  assert.deepEqual(outcome(plan, 'A3').reasons, ['insufficient-reach']);
  assert.deepEqual(outcome(plan, 'A2').reasons, ['insufficient-reach'], '3,5 mm/h : sous la moitié de 7,5, ne commande pas');
  assert.deepEqual(outcome(plan, 'A1').reasons, ['insufficient-reach']);
  close(outcome(plan, 'A1').placedMm, 4, 0.01, 'l’eau reçue reste comptée');
  close(outcome(plan, 'A1').deficitMm, 13.2, 0.01, 'le reste du bord est affiché, jamais fondu');
  assert.equal(plan.deficit.waterCubicMeters, 0, 'ni manque d’eau');
  assert.equal(plan.deficit.pumpTimeCubicMeters, 0, 'ni temps de pompage');
  assert.ok((plan.deficit.byReason['insufficient-reach'] ?? 0) > 0, 'la portée, chiffrée');
  assert.ok((plan.deficit.byReason['below-minimum-dose'] ?? 0) > 0);
});

test('le débordement d’une rampe sur le bloc voisin ne compte ni pour l’espacement ni pour un arrosage par jour, réel ou proposé', () => {
  // La rampe A a arrosé ce matin, débordant de 1,5 mm/h sur B1 ; la rampe B commande B1 à 7,5 mm/h.
  const rampeA: Rampe = { id: 'rampe A', kind: 'sprinkler', rates: profile('A', { B1: 1.5 }) };
  const rampeB: Rampe = { id: 'rampe B', kind: 'sprinkler', rates: { B1: 7.5, B2: 7.5, B3: 6.25, B4: 4.5 } };
  // La rampe B déborde à son tour sur C1, que la rampe C commande.
  const rampeBDebordante: Rampe = { ...rampeB, rates: { ...rampeB.rates, C1: 1.5 } };
  const rampeC: Rampe = { id: 'rampe C', kind: 'sprinkler', rates: { C1: 7.5, C2: 7.5 } };
  const morning = realIrrigation('rampe A', '2026-09-29T07:00:00.000Z', { ...profile('A'), B1: 1.5 });
  const plan = buildWeeklyPlan(farm({ rampes: [rampeA, rampeBDebordante, rampeC], events: [morning] }), settings);

  assert.equal(byEquipment(plan, 'rampe A')[0]?.startAt, WEDNESDAY_21H, 'la rampe A attend 24 h après son propre arrosage');
  assert.equal(byEquipment(plan, 'rampe B')[0]?.startAt, TUESDAY_21H, 'le 1,5 mm/h reçu ce matin par B1 n’est pas un arrosage : la rampe B tourne ce soir');
  assert.equal(byEquipment(plan, 'rampe C')[0]?.startAt, TUESDAY_21H, 'le débordement proposé de B sur C1 ne retient pas la rampe C');
  const slotB = byEquipment(plan, 'rampe B')[0];
  assert.ok(slotB.bedApplications.some((application) => application.bedId === 'C1' && application.appliedMm > 0), 'C1 reçoit tout de même l’eau qui déborde');
  assert.equal(outcome(plan, 'C1').deficitMm, 0, 'C1 est servie par sa propre rampe');
});

test('sans plage restante, le motif dit l’espacement ou la fin de la semaine, jamais la pompe', () => {
  const drip: Rampe = { id: 'gag', kind: 'drip', rates: { D1: 14, D2: 14 } };
  const sundayMorning = realIrrigation('gag', '2026-10-04T08:00:00.000Z', { D1: 14, D2: 14 });
  const sundayEvening = new Date('2026-10-04T18:00:00.000Z'); // dimanche 20 h
  const spaced = buildWeeklyPlan(farm({ now: sundayEvening, rampes: [drip], events: [sundayMorning] }), settings);
  assert.equal(spaced.proposals.length, 0);
  assert.deepEqual(outcome(spaced, 'D1').reasons, ['spacing'], 'l’espacement a repoussé le créneau après dimanche');
  assert.equal(spaced.deficit.pumpTimeCubicMeters, 0, 'ce n’est pas du temps de pompage');
  assert.ok((spaced.deficit.byReason.spacing ?? 0) > 0);

  const sundayNight = new Date('2026-10-04T21:00:00.000Z'); // dimanche 23 h, la plage du goutte-à-goutte est fermée
  const late = buildWeeklyPlan(farm({ now: sundayNight, rampes: [drip] }), settings);
  assert.equal(late.proposals.length, 0);
  assert.deepEqual(outcome(late, 'D1').reasons, ['no-time-left']);
});

test('le niveau projeté de la réserve est celui du plan fini, même pour un créneau placé avant un autre plus tôt', () => {
  // X attend la pluie de mercredi et passe jeudi ; Y, sous abri, passe ce soir. X est placée avant Y, Y coule avant X.
  const rampes: Rampe[] = [{ id: 'gag X', kind: 'drip', rates: { X1: 14 } }, { id: 'gag Y', kind: 'drip', rates: { Y1: 14 } }];
  const plan = buildWeeklyPlan(farm({ rampes, needMm: 10, sheltered: ['Y1'], forecast: { '2026-09-30': 12 }, reservoir: { cubicMeters: 10, inflow: false } }), settings);
  const [x] = byEquipment(plan, 'gag X');
  const [y] = byEquipment(plan, 'gag Y');
  assert.equal(x.id, 'p-1', 'X est placée en premier');
  assert.ok(x.startAt > y.startAt, 'mais coule après Y');
  const volume = 10 * 24 / 1000; // goutte-à-goutte : la planche seule, 32 m × 0,75 m
  close(y.justification.supply?.projectedLevelAfterCubicMeters, 10 - volume, 0.001, 'après Y seule');
  close(x.justification.supply?.projectedLevelAfterCubicMeters, 10 - 2 * volume, 0.001, 'après Y puis X : le plan fini');
});

test('la part R13 se règle, se valide et décide qui commande', () => {
  const inputs = farm({ rampes: [{ id: 'rampe A', kind: 'sprinkler', rates: profile('A') }] });
  const commanding = (share: number) => buildPlanningEquipment(inputs, { ...settings, commandingRateShare: share })[0].coveredBeds.filter((covered) => covered.commands).map((covered) => covered.bedId);
  assert.deepEqual(commanding(0.5), ['A3', 'A4', 'A5', 'A6', 'A7', 'A8'], '50 % de 7,5 : à partir de 3,75 mm/h');
  assert.deepEqual(commanding(1), ['A5', 'A6'], 'à 100 %, le centre seul');
  assert.equal(commanding(0).length, 10, 'à 0 %, toutes commandent : la règle d’avant');
  assert.deepEqual(validatePlanningSettings({ ...settings, commandingRateShare: 1.2 }).issues.map((issue) => issue.path), ['commandingRateShare']);
  assert.equal(validatePlanningSettings({ ...settings, commandingRateShare: 0 }).settings?.commandingRateShare, 0);

  // Même à 0 %, la planche la mieux arrosée fixe la dose (D-025, point 3) : la rampe ne revient pas pour ses bords.
  const zero = buildWeeklyPlan(inputs, { ...settings, commandingRateShare: 0 });
  assert.equal(byEquipment(zero, 'rampe A').length, 1, 'un seul créneau, quelle que soit la part');
  assert.deepEqual(outcome(zero, 'A1').reasons, ['insufficient-reach'], 'le bord commande, mais reste arrosé moins vite que le centre servi');
});
