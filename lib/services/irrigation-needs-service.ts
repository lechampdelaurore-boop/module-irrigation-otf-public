import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { listEquipmentPlacementsForUser } from '@/db/equipment-placement-repository';
import { listEquipmentForUser } from '@/db/equipment/read';
import { listGardenGroupConfigurationForUser } from '@/db/garden-group-repository';
import { readIrrigationNeedSettingsForUser } from '@/db/irrigation-need-repository';
import { listHydricGoalRevisionsThroughWeekForUser } from '@/db/water-management-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import { calculateIrrigationCoverage, type BedIrrigationCoverage } from '../domain/irrigation-coverage';
import { buildIrrigationNeedsDashboard, resolveIrrigationNeedsWeekStart, type IrrigationNeedsDashboard } from '../domain/irrigation-needs';
import { listCountedIrrigationEventsForUser } from './counted-irrigation-events';
import { getWaterDashboardForUser, type WaterDashboard } from './water-dashboard';
import { getCropWaterWeekForUser } from './crop-water-week';
import { proposalSummary, type ProposalSummary } from '../domain/crop-water/proposal';
import { logJsonLine } from '@/lib/adapters/log';

export async function getIrrigationNeedsDashboardForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  weekStart?: string;
  now?: Date;
  waterDashboard?: WaterDashboard;
  events?: IrrigationEventRecord[];
  /** Couverture déjà calculée par l'appelant ; sinon elle est lue ici, elle fixe la surface mouillée des besoins. */
  coverage?: readonly BedIrrigationCoverage[];
}): Promise<IrrigationNeedsDashboard> {
  const now = input.now ?? new Date();
  const weekStart = resolveIrrigationNeedsWeekStart({
    selectedWeekStart: input.weekStart,
    waterDashboardWeekStart: input.waterDashboard?.weekStart,
    now,
  });
  const [waterDashboard, events, goalRevisions, settings, coverage] = await Promise.all([
    input.waterDashboard ?? getWaterDashboardForUser({
      ownerUserId: input.ownerUserId, season: input.season, snapshot: input.snapshot,
      weekStart, allowWeatherRefresh: false, now,
    }),
    input.events ?? listCountedIrrigationEventsForUser(input.ownerUserId, input.season, true),
    listHydricGoalRevisionsThroughWeekForUser(input.ownerUserId, input.season, weekStart),
    readIrrigationNeedSettingsForUser(input.ownerUserId, input.season, weekStart),
    input.coverage ?? loadBedCoverage(input.ownerUserId, input.season, input.snapshot),
  ]);
  const dashboard = buildIrrigationNeedsDashboard({
    season: input.season, snapshot: input.snapshot, days: waterDashboard.days,
    events, goalRevisions, decisions: settings.decisions, coverage, thresholdMm: settings.thresholdMm,
    weekStart: waterDashboard.weekStart, weekEnd: waterDashboard.weekEnd, now,
  });
  return { ...dashboard, proposedByBed: await proposedByBed(input, dashboard, now) };
}

/**
 * L'objectif proposé de chaque planche, face à l'objectif que le besoin vient
 * de lire (5 quater). Une information seulement : un échec du calcul est
 * journalisé et laisse le besoin tel quel, sans proposition.
 */
async function proposedByBed(
  input: { ownerUserId: string; season: number; snapshot: IrrigationSnapshot },
  dashboard: IrrigationNeedsDashboard,
  now: Date,
): Promise<Record<string, ProposalSummary> | undefined> {
  if (!input.snapshot.cropPlan) return undefined;
  const beds = dashboard.gardens.flatMap((garden) => garden.beds);
  try {
    const week = await getCropWaterWeekForUser({
      ...input, weekStart: dashboard.weekStart, now,
      objectiveMmByBed: new Map(beds.map((bed) => [bed.bedId, bed.objectiveMm])),
      bedIds: beds.map((bed) => bed.bedId),
    });
    return Object.fromEntries(week.beds.map((bed) => [bed.bedId, proposalSummary(bed.week)]));
  } catch (error) {
    logJsonLine('warn', { event: 'crop_water_proposal_failed', season: input.season, weekStart: dashboard.weekStart, error: error instanceof Error ? error.message : 'inconnue', failedAt: new Date().toISOString() });
    return undefined;
  }
}

async function loadBedCoverage(ownerUserId: string, season: number, snapshot: IrrigationSnapshot) {
  const seasonPlots = snapshot.plots.filter((plot) => plot.seasons.includes(season));
  const [equipment, placements, groups] = await Promise.all([
    listEquipmentForUser(ownerUserId),
    listEquipmentPlacementsForUser(ownerUserId, season),
    listGardenGroupConfigurationForUser(ownerUserId, season, seasonPlots.map((plot) => ({ otfZoneId: plot.zoneId, otfPlotId: plot.id }))),
  ]);
  return calculateIrrigationCoverage({
    beds: snapshot.beds.filter((bed) => bed.seasons.includes(season)), groups: groups.groups, equipment, placements,
  }).beds;
}
