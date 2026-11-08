import assert from 'node:assert/strict';
import type { Bed } from '../../lib/domain/domain.ts';
import type { EquipmentListItem } from '../../lib/domain/equipment-record.ts';
import type { EquipmentPlacementRecord } from '../../lib/domain/equipment-placement-record.ts';
import type { BedIrrigationCoverage } from '../../lib/domain/irrigation-coverage.ts';
import type { IrrigationEventRecord } from '../../lib/domain/irrigation-event-record.ts';
import type { BedIrrigationNeed, IrrigationNeedPriority } from '../../lib/domain/irrigation-needs.ts';
import type { PlanningInputs, WeeklyPlan } from '../../lib/domain/planning/contract.ts';
import { protectedIntervalsBetween } from '../../lib/domain/planning/protected-slots.ts';
import { DEFAULT_PLANNING_SETTINGS, type PlanningSettings } from '../../lib/domain/planning/settings.ts';
import { ReservoirTimeline } from '../../lib/domain/planning/supply.ts';
import { windowIntervalForDay } from '../../lib/domain/planning/windows.ts';
import type { IrrigationPump } from '../../lib/domain/pumps.ts';
import { millimetersForDurationSeconds } from '../../lib/domain/irrigation-timer.ts';
import { cubicMetersFromMillimeters, MILLISECONDS_PER_DAY, millisecondsFromSeconds, secondsFromMilliseconds } from '../../lib/domain/units.ts';
import { dateKeyInTimeZone, splitVolumeAcrossLocalDays } from '../../lib/domain/water-management.ts';
import type { WaterInfrastructure } from '../../lib/domain/water-resources.ts';

/**
 * La ferme de test du moteur de planning, aux chiffres de la ferme réelle
 * (docs/planning-contract.md, « Scénarios de recette » et « Valeurs
 * exactes ») : la rampe du bloc 2 à 1,87 m³/h sur dix planches de 28 m²
 * mouillés, les rampes de serre à 2,56 et 1,28 m³/h, gag1 à 924 L/h, la pompe
 * à 8 m³/h, la réserve de 60 m³ à 30 m³ et le forage à 0,511 m³/h. Avec les
 * aides de lecture d'un plan et les invariants du contrat, vérifiables sur
 * tout plan qu'elle produit.
 */

export const TZ = 'Europe/Paris';
export const NOW = new Date('2026-09-29T10:52:00.000Z'); // mardi 12 h 52 à la ferme
const WEEK = { weekStart: '2026-09-28', weekEnd: '2026-10-04' };
export const PARIS_21H_TUESDAY = '2026-09-29T19:00:00.000Z';
export const PARIS_21H_WEDNESDAY = '2026-09-30T19:00:00.000Z';

type FixtureOptions = {
  now?: Date;
  reservoirCubicMeters?: number | null;
  forageFlow?: number;
  dailyLimit?: number | null;
  /** Premier jour de la limite ; avant lui, les jours sont sans limite. */
  dailyLimitFrom?: string;
  needs?: Partial<Record<string, Partial<BedIrrigationNeed>>>;
  plotNeeds?: Partial<Record<string, Partial<BedIrrigationNeed>>>;
  priorities?: Partial<Record<string, IrrigationNeedPriority>>;
  forecast?: Partial<Record<string, number>>;
  events?: IrrigationEventRecord[];
  withoutPumpFor?: string[];
  extraTunnels?: boolean;
  arbitration?: PlanningInputs['arbitration'];
  /** Des planches de bord qu'un matériel arrose aussi, à un taux trop faible pour les commander (D-025). */
  edges?: { equipmentId: string; bedIds: string[]; rateMmPerHour: number }[];
};

function bed(id: string, name: string, plotId: string, length: number, alleyWidth: number): Bed {
  return { id, zoneId: 'clementiere', plotId, name, length, width: 0.75, alleyWidth, area: length * 0.75, seasons: [2026] };
}

export function farm(options: FixtureOptions = {}) {
  const beds: Bed[] = [
    ...['B1-0', 'B1-1', 'B1-2', 'B1-3', 'B1-4', 'B1-5'].map((name) => bed(name, name, 'bloc-1', 22, 0.45)),
    ...Array.from({ length: 10 }, (_, index) => bed(`B2-${index + 1}`, `B2-${index + 1}`, 'bloc-2', 22, 0.5245)),
    ...Array.from({ length: 8 }, (_, index) => bed(`T1-${index + 1}`, `T1-${index + 1}`, 'tunnel-1', 16, 0.25)),
    ...Array.from({ length: 8 }, (_, index) => bed(`T2-${index + 1}`, `T2-${index + 1}`, 'tunnel-2', 16, 0.25)),
    ...(options.extraTunnels ? [3, 4].flatMap((tunnel) => Array.from({ length: 8 }, (_, index) => bed(`T${tunnel}-${index + 1}`, `T${tunnel}-${index + 1}`, `tunnel-${tunnel}`, 16, 0.25))) : []),
  ];
  const sheltered = (plotId: string) => plotId.startsWith('tunnel');
  const plotName = (plotId: string) => plotId.replace('bloc-', 'bloc ').replace('tunnel-', 'Tunnel ');

  const sprinkler = (id: string, name: string): EquipmentListItem => ({
    id, name, kind: 'sprinkler', mobility: 'fixed', status: 'active', settingsCount: 1, archivedAt: null,
    settings: [{ id: `${id}-setting`, name: 'Standard', position: 1, kind: 'sprinkler', leftProfile: [{ distanceMeters: 0, rateMmPerHour: 10 }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: 10 }] }],
  });
  const drip = (id: string, name: string, rate: number): EquipmentListItem => ({
    id, name, kind: 'drip', mobility: 'mobile', status: 'active', settingsCount: 1, archivedAt: null,
    settings: [{ id: `${id}-setting`, name: 'standard', position: 1, kind: 'drip', rateMmPerHour: rate }],
  });
  const equipment: EquipmentListItem[] = [
    drip('gag1', 'gag1', 14), drip('gag2', 'gag2', 14),
    sprinkler('rampe-bloc-2', 'rampe bloc 2'), sprinkler('rampe-tunnel-1', 'Rampe de serre tunnel 1'), sprinkler('rampe-tunnel-2', 'Rampe de serre tunnel 2'),
    ...(options.extraTunnels ? [sprinkler('rampe-tunnel-3', 'Rampe de serre tunnel 3'), sprinkler('rampe-tunnel-4', 'Rampe de serre tunnel 4')] : []),
  ];
  const coveredBy: Record<string, { beds: string[]; rate: number }> = {
    gag1: { beds: ['B1-0', 'B1-1', 'B1-2', 'B1-3'], rate: 14 },
    gag2: { beds: ['B1-4', 'B1-5'], rate: 14 },
    'rampe-bloc-2': { beds: beds.filter((item) => item.plotId === 'bloc-2').map((item) => item.id), rate: 6.667 },
    'rampe-tunnel-1': { beds: beds.filter((item) => item.plotId === 'tunnel-1').map((item) => item.id), rate: 10 },
    'rampe-tunnel-2': { beds: beds.filter((item) => item.plotId === 'tunnel-2').map((item) => item.id), rate: 20 },
    ...(options.extraTunnels ? {
      'rampe-tunnel-3': { beds: beds.filter((item) => item.plotId === 'tunnel-3').map((item) => item.id), rate: 20 },
      'rampe-tunnel-4': { beds: beds.filter((item) => item.plotId === 'tunnel-4').map((item) => item.id), rate: 20 },
    } : {}),
  };
  const edges = options.edges ?? [];
  const rateFor = (candidate: EquipmentListItem, bedId: string): number | null => (coveredBy[candidate.id]?.beds.includes(bedId)
    ? coveredBy[candidate.id].rate
    : edges.find((edge) => edge.equipmentId === candidate.id && edge.bedIds.includes(bedId))?.rateMmPerHour ?? null);
  const coverage: BedIrrigationCoverage[] = beds.flatMap((item) => {
    const contributions = equipment.flatMap((candidate) => {
      const rate = rateFor(candidate, item.id);
      return rate === null ? [] : [{ equipmentId: candidate.id, equipmentName: candidate.name, settingId: `${candidate.id}-setting`, settingName: candidate.settings[0].name, kind: candidate.kind, rateMmPerHour: rate }];
    });
    return contributions.length === 0 ? [] : [{ bedId: item.id, totalRateMmPerHour: contributions.reduce((sum, c) => sum + c.rateMmPerHour, 0), contributions }];
  });
  const placements: EquipmentPlacementRecord[] = equipment.map((item) => ({
    id: `${item.id}-placement`, equipmentId: item.id, settingId: `${item.id}-setting`, season: 2026, gardenGroupId: null,
    otfZoneId: 'clementiere', otfPlotId: beds.find((candidate) => candidate.id === coveredBy[item.id].beds[0])?.plotId ?? 'bloc-1',
    anchor: { type: 'bed_center', anchorBedOtfId: coveredBy[item.id].beds[0] },
    selectedBeds: item.kind === 'drip' ? coveredBy[item.id].beds.map((bedId) => ({ otfZoneId: 'clementiere', otfPlotId: 'bloc-1', otfBedId: bedId })) : [],
  }));
  const pumps: IrrigationPump[] = [{
    id: 'pompe', name: 'La pompe', maximumFlowCubicMetersPerHour: 8, status: 'active', archivedAt: null, notes: null,
    origins: [{ id: 'origine-reserve', pumpId: 'pompe', sourceKind: 'reservoir', resourceId: null, reservoirId: 'reserve', isDefault: true }],
  }];
  const pumpDefaults = equipment
    .filter((item) => !(options.withoutPumpFor ?? []).includes(item.id))
    .map((item) => ({ equipmentId: item.id, pumpId: 'pompe' }));
  const infrastructure: WaterInfrastructure = {
    resources: [{ id: 'forage', name: 'Forage principal', type: 'borehole', nominalFlowCubicMetersPerHour: options.forageFlow ?? 0.511, status: 'active', availableFrom: null, availableUntil: null, notes: null }],
    resourceLimits: [],
    reservoirs: [{
      id: 'reserve', name: 'Réserve tampon', type: 'tank', capacityCubicMeters: 60,
      currentVolumeCubicMeters: options.reservoirCubicMeters === undefined ? 30 : options.reservoirCubicMeters,
      currentVolumeObservedAt: '2026-09-29T10:00:00.000Z', minimumSafetyCubicMeters: 0, exposedSurfaceSquareMeters: 0,
      receivesRain: false, evaporationEnabled: false, evaporationCoefficient: 0, status: 'active', notes: null,
    }],
    resourceReservoirLinks: [{ id: 'lien', resourceId: 'forage', reservoirId: 'reserve', fillMode: 'automatic', active: true }],
    reservoirLinks: [],
    defaultSupply: { sourceKind: 'reservoir', resourceId: null, reservoirId: 'reserve' },
    movements: [],
  };
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = `2026-${index < 3 ? '09' : '10'}-${String(index < 3 ? 28 + index : index - 2).padStart(2, '0')}`;
    return { date, forecastRainMm: options.forecast?.[date] ?? 0, et0Mm: 3 };
  });
  const needs: BedIrrigationNeed[] = beds.map((item) => {
    const base: BedIrrigationNeed = {
      bedId: item.id, bedName: item.name, plotId: item.plotId, plotName: plotName(item.plotId), zoneId: 'clementiere', zoneName: 'Clémentière',
      sheltered: sheltered(item.plotId), areaSquareMeters: item.area, wettedAreaSquareMeters: item.area, wettedAreaSource: 'drip',
      et0Mm: null, et0KnownMm: null, et0ReanalysisMm: null, et0ForecastMm: null,
      objectiveMm: 20, objectiveSource: 'farm', actualRainMm: 0, actualIrrigationMm: 0, realRemainingMm: 20, relativeDeficitPercent: 100,
      forecastRainMm: 0, plannedIrrigationMm: 0, rawPlanningNeedMm: 20, thresholdMm: 0, calculatedNeedMm: 20,
      manualOverrideMm: null, overrideReason: null, effectiveNeedMm: 20, effectiveVolumeCubicMeters: cubicMetersFromMillimeters(20, item.area),
      priority: options.priorities?.[item.plotId] ?? options.priorities?.[item.id] ?? 'normal', weekStart: WEEK.weekStart, weekEnd: WEEK.weekEnd,
      deadlineAt: '2026-10-04T22:00:00.000Z',
      completeness: { complete: true, missing: [], demandComplete: true, realComplete: true, planningComplete: true, missingDates: { et0: [], actualRain: [], forecastRain: [] }, estimatedDates: { actualRain: [] } },
    };
    return { ...base, ...options.plotNeeds?.[item.plotId], ...options.needs?.[item.id] };
  });
  const inputs: PlanningInputs = {
    season: 2026, now: options.now ?? NOW, weekStart: WEEK.weekStart, weekEnd: WEEK.weekEnd, timeZone: TZ,
    needs, beds, days, coverage, equipment, placements, pumpDefaults, pumps, infrastructure,
    dailyLimits: options.dailyLimit ? [{ id: 'limite', season: 2026, enabled: true, maxCubicMetersPerDay: options.dailyLimit, validFrom: options.dailyLimitFrom ?? '2026-09-01', validUntil: null, note: 'arrêté', createdAt: '2026-09-01T00:00:00.000Z' }] : [],
    events: options.events ?? [],
    arbitration: options.arbitration ?? null,
  };
  return { inputs, beds, coveredBy };
}

/** Une irrigation réelle d'une heure sur un matériel, pour la semaine en cours. */
export function realIrrigation(id: string, equipmentId: string, startAt: string, bedIds: string[], mm: number, rate: number, kind: 'drip' | 'sprinkler' = 'drip', status: IrrigationEventRecord['status'] = 'completed'): IrrigationEventRecord {
  const endAt = new Date(new Date(startAt).getTime() + 3_600_000).toISOString();
  return {
    id, season: 2026, status, note: null, remainingCanceledAt: null, canceledAt: null, createdAt: startAt, updatedAt: endAt,
    equipment: {
      id: `${id}-eq`, equipmentId, settingId: `${equipmentId}-setting`, placementId: `${equipmentId}-placement`, status,
      plannedStartAt: null, plannedEndAt: null, actualStartAt: startAt, actualEndAt: endAt, plannedDurationSeconds: 3600, actualDurationSeconds: 3600,
      equipmentSnapshot: { id: equipmentId, name: equipmentId, kind, mobility: 'mobile' },
      settingSnapshot: kind === 'drip'
        ? { id: `${equipmentId}-setting`, name: 'standard', position: 1, kind: 'drip', rateMmPerHour: rate }
        : { id: `${equipmentId}-setting`, name: 'Standard', position: 1, kind: 'sprinkler', leftProfile: [{ distanceMeters: 0, rateMmPerHour: rate }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: rate }] },
      placementSnapshot: { id: `${equipmentId}-placement`, equipmentId, settingId: `${equipmentId}-setting`, season: 2026, gardenGroupId: null, otfZoneId: 'clementiere', otfPlotId: 'bloc-1', anchor: { type: 'bed_center', anchorBedOtfId: bedIds[0] }, selectedBeds: [] },
      timerState: null, timerStartedAt: null, timerResumedAt: null, timerPausedAt: null, timerTheoreticalEndAt: null,
      timerAccumulatedSeconds: 0, timerAlarmRevision: null, timerAlarmStatus: null, timerAlarmSyncedAt: null,
      remainingCanceledAt: null, canceledAt: null,
      applications: bedIds.map((bedId) => ({ otfZoneId: 'clementiere', otfPlotId: 'bloc-1', otfBedId: bedId, rateMmPerHour: rate, bedAreaSquareMeters: 16.5, wettedAreaSquareMeters: 16.5, plannedAmountMm: mm, actualAmountMm: mm })),
    },
  };
}

export const settings = DEFAULT_PLANNING_SETTINGS;
export const byEquipment = (plan: WeeklyPlan, equipmentId: string) => plan.proposals.filter((proposal) => proposal.equipmentId === equipmentId);
export const close = (actual: number | null, expected: number, tolerance = 0.01, message?: string) => {
  assert.ok(actual !== null && Math.abs(actual - expected) <= tolerance, `${message ?? ''} attendu ${expected}, obtenu ${actual}`);
};

/** Les invariants du contrat, vérifiés sur tout plan (roadmap 3.5, preuve de fin). */
export function assertInvariants(plan: WeeklyPlan, inputs: PlanningInputs, used: PlanningSettings = settings) {
  const pumpUsages: { start: number; end: number; flow: number }[] = [];
  const volumeByDate = new Map<string, number>();
  const startsByBed = new Map<string, number[]>();
  for (const proposal of plan.proposals) {
    const start = Date.parse(proposal.startAt);
    const end = Date.parse(proposal.endAt);
    assert.ok(end > start && proposal.durationSeconds >= 1, `${proposal.id} : durée positive`);
    assert.ok(start >= inputs.now.getTime() - 1, `${proposal.id} : pas avant le calcul`);
    assert.ok(end <= Date.parse(plan.horizonEndAt) + 1, `${proposal.id} : pas après dimanche minuit`);
    // La plage horaire de sa nature, pour le jour de planning où il commence ou la veille (plage de nuit).
    const window = used.windows[proposal.kind];
    const day = dateKeyInTimeZone(new Date(start), TZ);
    const inWindow = [day, dateKeyInTimeZone(new Date(start - MILLISECONDS_PER_DAY), TZ)].some((candidate) => {
      const interval = windowIntervalForDay(window, candidate, TZ);
      return start >= interval.startAt.getTime() - 1 && end <= interval.endAt.getTime() + 1;
    });
    assert.ok(inWindow, `${proposal.id} (${proposal.kind}) ${proposal.startAt} → ${proposal.endAt} dans sa plage`);
    // R6 et R7 ne comptent que les planches qui commandent le matériel : leur taux atteint la part R13 du plus fort (D-025).
    const strongest = proposal.applications.reduce((best, application) => Math.max(best, application.rateMmPerHour), 0);
    const commanding = new Set(proposal.applications.filter((application) => application.rateMmPerHour + 1e-9 >= used.commandingRateShare * strongest).map((application) => application.otfBedId));
    for (const application of proposal.bedApplications) {
      assert.ok(application.appliedMm <= used.doses[proposal.kind].maximumMm + 1e-6, `${proposal.id} : ${application.bedName} ne dépasse pas la dose maximale`);
      if (application.appliedMm > 0 && commanding.has(application.bedId)) {
        const starts = startsByBed.get(application.bedId) ?? [];
        starts.push(start);
        startsByBed.set(application.bedId, starts);
      }
    }
    if (proposal.pumpId && proposal.flowCubicMetersPerHour !== null) pumpUsages.push({ start, end, flow: proposal.flowCubicMetersPerHour });
    if (proposal.volumeCubicMeters !== null) {
      for (const [date, volume] of splitVolumeAcrossLocalDays({ startAt: proposal.startAt, endAt: proposal.endAt, cubicMeters: proposal.volumeCubicMeters, timeZone: TZ })) {
        volumeByDate.set(date, (volumeByDate.get(date) ?? 0) + volume);
      }
    }
  }
  // Pompe : à aucun instant la somme des débits ne dépasse 8 m³/h.
  for (const usage of pumpUsages) {
    const engaged = pumpUsages.filter((other) => other.start <= usage.start && other.end > usage.start).reduce((sum, other) => sum + other.flow, 0);
    assert.ok(engaged <= inputs.pumps[0].maximumFlowCubicMetersPerHour + 1e-9, `pompe à ${engaged} m³/h à ${new Date(usage.start).toISOString()}`);
  }
  // Limite journalière.
  for (const limit of inputs.dailyLimits) {
    for (const [date, volume] of volumeByDate) {
      if (limit.enabled && limit.maxCubicMetersPerDay !== null && date >= limit.validFrom) {
        assert.ok(volume <= limit.maxCubicMetersPerDay + 1e-6, `${date} : ${volume} m³ sous la limite ${limit.maxCubicMetersPerDay}`);
      }
    }
  }
  // Espacement : 24 h au moins entre deux débuts sur une même planche.
  for (const [bedId, starts] of startsByBed) {
    const sorted = [...starts].sort((left, right) => left - right);
    for (let index = 1; index < sorted.length; index += 1) {
      assert.ok(sorted[index] - sorted[index - 1] >= used.doses.drip.spacingDays * MILLISECONDS_PER_DAY - 1, `${bedId} : espacement respecté`);
    }
  }
  // Créneaux protégés : aucun créneau planifié n'en recouvre un, même en partie, quel que soit le matériel (D-062, règle 5).
  for (const slot of protectedIntervalsBetween(inputs.protectedSlots, inputs.now, new Date(plan.horizonEndAt), TZ)) {
    for (const proposal of plan.proposals) {
      assert.ok(Date.parse(proposal.endAt) <= slot.startMs || Date.parse(proposal.startAt) >= slot.endMs, `${proposal.id} ${proposal.startAt} → ${proposal.endAt} hors du créneau protégé ${slot.names.join(', ')}`);
    }
  }
  // Réserve : jamais sous le minimum, avec tous les prélèvements placés, sur la
  // projection qui juge — bornée par la capacité, jamais par zéro — et non sur
  // le niveau affiché (point ouvert 19 : la borne à zéro rendait « 0 ≥ 0 » vrai).
  // Jugée dès le premier prélèvement placé : avant lui, rien du plan ne la fait
  // descendre, et une réserve qui part sous son minimum (S3) n'en est pas fautive.
  const reservoir = inputs.infrastructure.reservoirs[0];
  const withdrawals = plan.proposals.filter((proposal) => proposal.volumeCubicMeters !== null && proposal.pumpId);
  if (reservoir.currentVolumeCubicMeters !== null && withdrawals.length > 0) {
    const timeline = new ReservoirTimeline({ reservoir, infrastructure: inputs.infrastructure, days: inputs.days, now: inputs.now, horizonEnd: new Date(plan.horizonEndAt), timeZone: TZ });
    for (const proposal of withdrawals) timeline.addWithdrawal({ startMs: Date.parse(proposal.startAt), endMs: Date.parse(proposal.endAt), cubicMeters: proposal.volumeCubicMeters ?? 0 });
    const firstStart = Math.min(...withdrawals.map((proposal) => Date.parse(proposal.startAt)));
    const minimum = timeline.minimumLevel(firstStart, Date.parse(plan.horizonEndAt));
    assert.ok(minimum !== null && minimum.minimum >= reservoir.minimumSafetyCubicMeters - 1e-6, `réserve au plus bas à ${minimum?.minimum} m³`);
  }
  // Budget : la somme des volumes d'une chaîne ne dépasse jamais son budget, l'eau ni la limite journalière (D-037).
  for (const budget of plan.budgets) {
    const bound = Math.min(budget.availableCubicMeters ?? Number.POSITIVE_INFINITY, budget.dailyLimitRemainingCubicMeters ?? Number.POSITIVE_INFINITY);
    if (!Number.isFinite(bound)) continue;
    const drawn = plan.proposals
      .filter((proposal) => proposal.justification.supply?.originKey === budget.originKey || budget.originKey === `unverified:${proposal.equipmentId}`)
      .reduce((sum, proposal) => sum + (proposal.volumeCubicMeters ?? 0), 0);
    assert.ok(drawn <= bound + 1e-6, `chaîne « ${budget.originName} » : ${drawn} m³ placés pour un budget de ${bound} m³`);
  }
  // Comptabilité : le déficit annoncé est exactement le besoin non couvert.
  for (const outcome of plan.beds) {
    // Un reste sous un centième de millimètre est un résidu d'arrondi des secondes, pas un déficit.
    const rawDeficit = outcome.needMm - outcome.placedMm;
    close(outcome.deficitMm, rawDeficit < 0.01 ? 0 : rawDeficit, 1e-6, `${outcome.bedName} déficit`);
    assert.ok(outcome.placedMm <= outcome.needMm + 1e-6, `${outcome.bedName} : pas plus placé que le besoin`);
    if (outcome.deficitMm > 1e-6) assert.ok(outcome.reasons.length > 0, `${outcome.bedName} : un déficit a une raison`);
  }
}

/** La ferme réelle en taille : 11 blocs de 10 planches, 4 tunnels de 8, 11 goutte-à-goutte et 15 rampes — 138 planches, 26 matériels. */
export function largeFarm(options: FixtureOptions & { blocDrips?: boolean } = {}) {
  const { inputs, beds } = farm({ ...options, extraTunnels: true });
  const blocDrips = options.blocDrips ?? true;
  const extraBeds: Bed[] = [];
  const extraCoverage: BedIrrigationCoverage[] = [];
  const extraEquipment: EquipmentListItem[] = [];
  const extraPlacements: EquipmentPlacementRecord[] = [];
  const extraDefaults: { equipmentId: string; pumpId: string }[] = [];
  for (let bloc = 3; bloc <= 11; bloc += 1) {
    const plotId = `bloc-${bloc}`;
    const ids = Array.from({ length: 10 }, (_, index) => `B${bloc}-${index + 1}`);
    for (const id of ids) extraBeds.push(bed(id, id, plotId, 22, 0.45));
    const rampe = `rampe-bloc-${bloc}`;
    extraEquipment.push({ id: rampe, name: `rampe bloc ${bloc}`, kind: 'sprinkler', mobility: 'fixed', status: 'active', settingsCount: 1, archivedAt: null, settings: [{ id: `${rampe}-setting`, name: 'Standard', position: 1, kind: 'sprinkler', leftProfile: [{ distanceMeters: 0, rateMmPerHour: 7 }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: 7 }] }] });
    extraPlacements.push({ id: `${rampe}-placement`, equipmentId: rampe, settingId: `${rampe}-setting`, season: 2026, gardenGroupId: null, otfZoneId: 'clementiere', otfPlotId: plotId, anchor: { type: 'bed_center', anchorBedOtfId: ids[0] }, selectedBeds: [] });
    extraDefaults.push({ equipmentId: rampe, pumpId: 'pompe' });
    const gag = `gag-bloc-${bloc}`;
    if (blocDrips) {
    extraEquipment.push({ id: gag, name: gag, kind: 'drip', mobility: 'mobile', status: 'active', settingsCount: 1, archivedAt: null, settings: [{ id: `${gag}-setting`, name: 'standard', position: 1, kind: 'drip', rateMmPerHour: 14 }] });
    extraPlacements.push({ id: `${gag}-placement`, equipmentId: gag, settingId: `${gag}-setting`, season: 2026, gardenGroupId: null, otfZoneId: 'clementiere', otfPlotId: plotId, anchor: { type: 'bed_center', anchorBedOtfId: ids[0] }, selectedBeds: ids.slice(0, 2).map((otfBedId) => ({ otfZoneId: 'clementiere', otfPlotId: plotId, otfBedId })) });
    extraDefaults.push({ equipmentId: gag, pumpId: 'pompe' });
    }
    for (const id of ids) {
      const contributions: BedIrrigationCoverage['contributions'] = [{ equipmentId: rampe, equipmentName: `rampe bloc ${bloc}`, settingId: `${rampe}-setting`, settingName: 'Standard', kind: 'sprinkler', rateMmPerHour: 7 }];
      if (blocDrips && ids.indexOf(id) < 2) contributions.push({ equipmentId: gag, equipmentName: gag, settingId: `${gag}-setting`, settingName: 'standard', kind: 'drip', rateMmPerHour: 14 });
      extraCoverage.push({ bedId: id, totalRateMmPerHour: contributions.reduce((sum, c) => sum + c.rateMmPerHour, 0), contributions });
    }
  }
  const template = inputs.needs[0];
  const needs = [...inputs.needs, ...extraBeds.map((item) => ({ ...template, bedId: item.id, bedName: item.name, plotId: item.plotId, plotName: item.plotId, sheltered: false, areaSquareMeters: item.area, wettedAreaSquareMeters: item.area }))];
  const large: PlanningInputs = {
    ...inputs,
    beds: [...beds, ...extraBeds],
    needs,
    coverage: [...inputs.coverage, ...extraCoverage],
    equipment: [...inputs.equipment, ...extraEquipment],
    placements: [...inputs.placements, ...extraPlacements],
    pumpDefaults: [...inputs.pumpDefaults, ...extraDefaults],
  };
  return { inputs: large };
}

/**
 * Une irrigation planifiée — validée d'un calcul précédent ou posée à la main —
 * telle que le moteur la lit : elle tient la pompe sur son créneau prévu quand
 * elle a un débit demandé, et fixe un début d'arrosage sur ses planches (R6, R7).
 */
export function plannedIrrigation(id: string, equipmentId: string, startAt: string, endAt: string, bedIds: string[], options: { kind?: 'drip' | 'sprinkler'; flow?: number } = {}): IrrigationEventRecord {
  const base = realIrrigation(id, equipmentId, startAt, bedIds, 1, 6.667, options.kind ?? 'sprinkler', 'planned');
  const plannedDurationSeconds = Math.round(secondsFromMilliseconds(Date.parse(endAt) - Date.parse(startAt)));
  return {
    ...base,
    equipment: {
      ...base.equipment,
      actualStartAt: null, actualEndAt: null, actualDurationSeconds: 0,
      plannedStartAt: startAt, plannedEndAt: endAt, plannedDurationSeconds,
      pumpId: options.flow === undefined ? null : 'pompe', requestedFlowCubicMetersPerHour: options.flow ?? null,
    },
  };
}

export const BLOC_2 = Array.from({ length: 10 }, (_, index) => `B2-${index + 1}`);

/**
 * Un arrosage validé encore à venir (3.7, docs/replanning-contract.md,
 * règles 11 à 17) : planifié, non démarré, aux doses que son taux et sa durée
 * donnent sur chaque planche, pour les suggestions du moteur. La surface
 * mouillée vaut celle de la planche de la fixture, `null` pour un passe-pied
 * inconnu.
 */
export function validatedIrrigation(
  id: string,
  equipmentId: string,
  startAt: string,
  durationSeconds: number,
  bedIds: string[],
  options: { kind?: 'drip' | 'sprinkler'; rate?: number; wettedAreaSquareMeters?: number | null; flow?: number } = {},
): IrrigationEventRecord {
  const kind = options.kind ?? 'sprinkler';
  const rate = options.rate ?? (kind === 'drip' ? 14 : 6.667);
  const endAt = new Date(Date.parse(startAt) + millisecondsFromSeconds(durationSeconds)).toISOString();
  const base = plannedIrrigation(id, equipmentId, startAt, endAt, bedIds, { kind, flow: options.flow });
  const plannedAmountMm = millimetersForDurationSeconds(rate, durationSeconds);
  return {
    ...base,
    equipment: {
      ...base.equipment,
      applications: base.equipment.applications.map((application) => ({
        ...application,
        rateMmPerHour: rate,
        plannedAmountMm,
        actualAmountMm: 0,
        wettedAreaSquareMeters: options.wettedAreaSquareMeters === undefined ? application.wettedAreaSquareMeters : options.wettedAreaSquareMeters,
      })),
    },
  };
}
