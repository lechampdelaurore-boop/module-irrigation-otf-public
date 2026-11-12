import { listEquipmentPlacementsForUser } from '@/db/equipment-placement-repository';
import { listEquipmentForUser } from '@/db/equipment/read';
import { listGardenGroupConfigurationForUser } from '@/db/garden-group-repository';
import { listPumpConfigurationForUser } from '@/db/pump-repository';
import { listWaterInfrastructureForUser } from '@/db/water-resource-repository';
import { invalidateIrrigationArbitrationsForUser, listIrrigationArbitrationsForUser, readFeasibilityRevisionForUser } from '@/db/irrigation-arbitration-repository';
import { listCountedIrrigationEventsForUser } from './counted-irrigation-events';
import { getCropWaterDaysForUser } from './crop-water-week';
import { logJsonLine } from '@/lib/adapters/log';
import { getIrrigationSnapshot } from './irrigation-service';
import { allocateIrrigationWater, sameBedIds, type IrrigationFeasibility } from '../domain/irrigation-feasibility';
import { isArbitrationEditable } from '../domain/arbitration-preview';
import { arbitrationCrops, stagesToday, type ArbitrationCrops } from '../domain/arbitration-crops';
import type { IrrigationSnapshot } from '../domain/domain';
import { describeFeasibilityPaths } from '../domain/feasibility-hydraulics';
import { getIrrigationNeedsDashboardForUser } from './irrigation-needs-service';
import { calculateIrrigationCoverage } from '../domain/irrigation-coverage';
import { getWaterDashboardForUser } from './water-dashboard';
import { FARM_TIME_ZONE, addDaysToDateKey, dateKeyInTimeZone, localDateStartUtc, weekStartDateKey } from '../domain/water-management';
import { plannedWaterForPeriod } from '../domain/planned-irrigation';
import { projectWaterAvailability } from '../domain/water-resources';

export async function getIrrigationFeasibilityForUser(input: { ownerUserId: string; season: number; now?: Date }): Promise<IrrigationFeasibility> {
  return (await computeIrrigationFeasibility(input)).result;
}

/**
 * La faisabilité pour son écran : quand un niveau demande un choix, les
 * cultures de chaque planche et leur stade du jour, pour l'écran d'arbitrage
 * façon plan d'assolement (docs/shortage-contract.md, 2 bis, D-083). Le
 * planning, qui relit la faisabilité, ne les lit pas.
 */
export async function getIrrigationFeasibilityScreenForUser(input: { ownerUserId: string; season: number; now?: Date }): Promise<{ dashboard: IrrigationFeasibility; crops: ArbitrationCrops | null }> {
  const now = input.now ?? new Date();
  const { result, snapshot } = await computeIrrigationFeasibility({ ...input, now });
  const cropPlan = snapshot.cropPlan;
  if (!cropPlan || !result.priorities.some(isArbitrationEditable)) return { dashboard: result, crops: null };
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const bedIds = result.priorities.flatMap((level) => level.beds.map((row) => row.need.bedId));
  return { dashboard: result, crops: arbitrationCrops({ cropPlan, bedIds, today, stagesToday: await stagesTodayByBed(input.ownerUserId, input.season, snapshot, today, now) }) };
}

/** Le stade et le Kc du jour, une information : un échec du calcul laisse l'écran sans eux. */
async function stagesTodayByBed(ownerUserId: string, season: number, snapshot: IrrigationSnapshot, today: string, now: Date) {
  try {
    const days = await getCropWaterDaysForUser({ ownerUserId, season, snapshot, dates: [today], now });
    return new Map((days?.beds ?? []).map((bed) => [bed.bedId, stagesToday(bed.days[0]?.crops ?? [])]));
  } catch (error) {
    logJsonLine('warn', { event: 'arbitration_crop_stages_failed', season, error: error instanceof Error ? error.message : 'inconnue', failedAt: new Date().toISOString() });
    return new Map();
  }
}

async function computeIrrigationFeasibility(input: { ownerUserId: string; season: number; now?: Date }): Promise<{ result: IrrigationFeasibility; snapshot: IrrigationSnapshot }> {
  const { ownerUserId, season } = input;
  const now = input.now ?? new Date();
  const weekStart = weekStartDateKey(now, FARM_TIME_ZONE);
  const start = localDateStartUtc(weekStart, FARM_TIME_ZONE);
  const end = localDateStartUtc(addDaysToDateKey(weekStart, 7), FARM_TIME_ZONE);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await readFeasibilityRevisionForUser(ownerUserId);
    // Read through the existing OTF contract inside the revision boundary.
    const snapshot = await getIrrigationSnapshot(ownerUserId, { season });
    const periodEvents = listCountedIrrigationEventsForUser(ownerUserId, season, true, { startAt: start.toISOString(), endAt: end.toISOString() });
    const [events, water, infrastructure, pumps, equipment, placements, groups, decisions] = await Promise.all([
      periodEvents,
      getWaterDashboardForUser({ ownerUserId, season, snapshot, weekStart, allowWeatherRefresh: false, now, preloadedEvents: periodEvents }),
      listWaterInfrastructureForUser(ownerUserId, { startAt: localDateStartUtc(dateKeyInTimeZone(now, FARM_TIME_ZONE), FARM_TIME_ZONE).toISOString(), endAt: end.toISOString() }),
      listPumpConfigurationForUser(ownerUserId), listEquipmentForUser(ownerUserId), listEquipmentPlacementsForUser(ownerUserId, season),
      listGardenGroupConfigurationForUser(ownerUserId, season, snapshot.plots.filter((plot) => plot.seasons.includes(season)).map((plot) => ({ otfZoneId: plot.zoneId, otfPlotId: plot.id }))),
      listIrrigationArbitrationsForUser(ownerUserId, season, weekStart),
    ]);
    const coverage = calculateIrrigationCoverage({ beds: snapshot.beds.filter((bed) => bed.seasons.includes(season)), groups: groups.groups, equipment, placements });
    const needs = await getIrrigationNeedsDashboardForUser({ ownerUserId, season, snapshot, now, events, waterDashboard: water, coverage: coverage.beds });
    const plannedWater = plannedWaterForPeriod(events, now, end, FARM_TIME_ZONE);
    const projection = projectWaterAvailability({ infrastructure, startsAt: now, endsAt: end, timeZone: FARM_TIME_ZONE, weather: water.days, plannedWater });
    const pools = describeFeasibilityPaths({ pools: projection.pools, beds: needs.gardens.flatMap((garden) => garden.beds), coverage, ...pumps });
    const result = allocateIrrigationWater({ needs, pools, decisions, reservedUnassignedCubicMeters: projection.reservedUnassignedCubicMeters, reservedPlannedCubicMeters: plannedWater.reduce((sum, row) => sum + row.cubicMeters, 0) });
    if (await readFeasibilityRevisionForUser(ownerUserId) !== before) continue;
    const obsolete = result.priorities.filter((level) => level.decision && !level.decision.invalidatedAt && (level.arbitration === 'obsolete' || !sameBedIds(level.candidates, level.decision.candidateBedIds)));
    if (obsolete.length) {
      try { await invalidateIrrigationArbitrationsForUser(ownerUserId, season, weekStart, obsolete.map((level) => level.priority), before); } catch { continue; }
      result.revision = before + 1;
      for (const level of obsolete) level.decision!.invalidatedAt = now.toISOString();
    } else result.revision = before;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(snapshot.beds.filter((bed) => bed.seasons.includes(season)).sort((a, b) => a.id.localeCompare(b.id)))));
    result.snapshotSignature = [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    result.warnings.push('Analyse volumétrique préliminaire : les horaires, l’alternance des pompes et les remplissages pendant de nouvelles irrigations restent à vérifier dans le futur planning.');
    return { result, snapshot };
  }
  throw new Error('Les données viennent de changer. Recalculez la faisabilité avant de valider votre sélection.');
}
