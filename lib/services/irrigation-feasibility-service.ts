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
import { feasibilityPlanGap, type FeasibilityPlanGap } from '../domain/feasibility-plan-gap';
import { feasibilityInShortage, stageAdvice, type StageAdviceScreen } from '../domain/stage-advice';
import { sensitiveStageKeys } from '../domain/crop-water/sensitive-stages';
import { featurePart, isPartActive } from '../domain/features/socle';
import { getEnabledFeaturesForUser } from './feature-selection-service';
import { readLatestPlanForUser, readPlanningSettingsForUser } from '@/db/planning-repository';
import { listSensitiveStageChoicesForWorkspace, listSensitiveStageReferences } from '@/db/crop-water/sensitive-stages';
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

/** L'écran de la répartition : la faisabilité et ce qui l'accompagne, pour l'écran seulement. */
export type FeasibilityScreen = {
  dashboard: IrrigationFeasibility;
  crops: ArbitrationCrops | null;
  planGap: FeasibilityPlanGap | null;
  stageAdvice: StageAdviceScreen | null;
};

/**
 * La faisabilité pour son écran : quand un niveau demande un choix, les
 * cultures de chaque planche et leur stade du jour, pour l'écran d'arbitrage
 * façon plan d'assolement (docs/shortage-contract.md, 2 bis, D-083) ; en
 * pénurie, le conseil selon le stade sensible (amélioration n° 4, F731,
 * F732), calculé après la répartition, qu'il lit sans la changer. Le
 * planning, qui relit la faisabilité, ne lit ni l'un ni l'autre.
 */
export async function getIrrigationFeasibilityScreenForUser(input: { ownerUserId: string; season: number; now?: Date }): Promise<FeasibilityScreen> {
  const now = input.now ?? new Date();
  const { result, snapshot } = await computeIrrigationFeasibility({ ...input, now });
  // Le manque du planning que la faisabilité ne voit pas : l'écran dit d'où il vient (audit du 19 novembre 2026, lot I, n° 5, F446).
  const planGap = feasibilityPlanGap({ plan: await readLatestPlanForUser(input.ownerUserId, input.season, result.weekStart), feasibility: result, now });
  const cropPlan = snapshot.cropPlan;
  const editable = result.priorities.some(isArbitrationEditable);
  // Seulement en pénurie ; la partie demande « Besoin par culture », sinon une ligne le dit (F732, point 7).
  const advicePart = feasibilityInShortage(result) ? isPartActive(await getEnabledFeaturesForUser(input.ownerUserId), 'stage-advice') : null;
  const missing: StageAdviceScreen | null = advicePart === false ? { kind: 'missing-part', notice: featurePart('stage-advice').missingNotice } : null;
  if (!cropPlan || (!editable && advicePart !== true)) return { dashboard: result, crops: null, planGap, stageAdvice: missing };
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const water = await cropWaterToday(input.ownerUserId, input.season, snapshot, today, now);
  const bedIds = result.priorities.flatMap((level) => level.beds.map((row) => row.need.bedId));
  const stages = new Map((water?.beds ?? []).map((bed) => [bed.bedId, stagesToday(bed.days[0]?.crops ?? [])]));
  return {
    dashboard: result,
    planGap,
    crops: editable ? arbitrationCrops({ cropPlan, bedIds, today, stagesToday: stages }) : null,
    stageAdvice: advicePart === true && water ? await stageAdviceScreen(input.ownerUserId, result, water, today) : missing,
  };
}

/** Les cultures du jour de chaque planche, une information : un échec du calcul laisse l'écran sans elles. */
async function cropWaterToday(ownerUserId: string, season: number, snapshot: IrrigationSnapshot, today: string, now: Date) {
  try {
    return await getCropWaterDaysForUser({ ownerUserId, season, snapshot, dates: [today], now });
  } catch (error) {
    logJsonLine('warn', { event: 'arbitration_crop_stages_failed', season, error: error instanceof Error ? error.message : 'inconnue', failedAt: new Date().toISOString() });
    return null;
  }
}

/** Le conseil de la semaine, une information : un échec de sa lecture laisse l'écran sans lui. */
async function stageAdviceScreen(
  ownerUserId: string,
  feasibility: IrrigationFeasibility,
  water: NonNullable<Awaited<ReturnType<typeof getCropWaterDaysForUser>>>,
  today: string,
): Promise<StageAdviceScreen | null> {
  try {
    const [references, choices, planning] = await Promise.all([
      listSensitiveStageReferences(), listSensitiveStageChoicesForWorkspace(water.workspaceId), readPlanningSettingsForUser(ownerUserId),
    ]);
    const advice = stageAdvice({ feasibility, days: water.beds, today, sensitive: sensitiveStageKeys(water.referenceCrops, references, choices) });
    if (!advice || advice.groups.length === 0) return null;
    // La part égale pour toutes ne lit pas les priorités : la priorité haute change cet écran, pas le planning (F732, point 6).
    return { kind: 'advice', advice, equalSharePlanning: planning.shortageStrategy === 'equal-share' };
  } catch (error) {
    logJsonLine('warn', { event: 'stage_advice_failed', error: error instanceof Error ? error.message : 'inconnue', failedAt: new Date().toISOString() });
    return null;
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
    result.notes.push('Calcul en volume seulement : les heures, les pompes et le remplissage des réserves sont vérifiés par le planning.');
    return { result, snapshot };
  }
  throw new Error('Les données viennent de changer. Recalculez la faisabilité avant de valider votre sélection.');
}
