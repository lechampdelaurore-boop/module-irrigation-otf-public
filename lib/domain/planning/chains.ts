import { remainingPlannedApplications } from '../planned-irrigation.ts';
import { cubicMetersFromMillimeters } from '../units.ts';
import type { PlanningInputs } from './contract.ts';
import type { PlanningEquipment } from './demand.ts';
import { DirectResourceTimeline, PumpTimeline, ReservoirTimeline, type SupplyChain } from './supply.ts';

/**
 * Les chaînes d'eau des matériels du calcul : pompe, puis réserve ou
 * ressource, avec leurs lignes du temps partagées. Les irrigations déjà
 * planifiées y prélèvent leur eau avant tout placement.
 */
export function buildSupplyChains(inputs: PlanningInputs, equipment: readonly PlanningEquipment[], horizonStart: Date, weekEndAt: Date): Map<string, SupplyChain> {
  const pumpTimelines = new Map<string, PumpTimeline>();
  const reservoirTimelines = new Map<string, ReservoirTimeline>();
  const resourceTimelines = new Map<string, DirectResourceTimeline>();
  const chains = new Map<string, SupplyChain>();
  const timeZone = inputs.timeZone;

  const reservoirTimeline = (reservoirId: string) => {
    const existing = reservoirTimelines.get(reservoirId);
    if (existing) return existing;
    const reservoir = inputs.infrastructure.reservoirs.find((item) => item.id === reservoirId);
    if (!reservoir) return null;
    const timeline = new ReservoirTimeline({ reservoir, infrastructure: inputs.infrastructure, days: inputs.days, now: horizonStart, horizonEnd: weekEndAt, timeZone });
    reservoirTimelines.set(reservoirId, timeline);
    return timeline;
  };
  const resourceTimeline = (resourceId: string) => {
    const existing = resourceTimelines.get(resourceId);
    if (existing) return existing;
    const resource = inputs.infrastructure.resources.find((item) => item.id === resourceId);
    if (!resource) return null;
    const timeline = new DirectResourceTimeline({ resource, infrastructure: inputs.infrastructure, now: horizonStart, horizonEnd: weekEndAt, timeZone });
    resourceTimelines.set(resourceId, timeline);
    return timeline;
  };

  // Les irrigations déjà planifiées ou en cours prélèvent leur eau sur leur origine.
  if (horizonStart < weekEndAt) {
    for (const row of remainingPlannedApplications(inputs.events, horizonStart, weekEndAt)) {
      if (!row.sourceKey) continue;
      const [kind, id] = row.sourceKey.split(':');
      const cubicMeters = cubicMetersFromMillimeters(row.amountMm, row.areaSquareMeters);
      if (kind === 'reservoir') {
        reservoirTimeline(id)?.addWithdrawal({ startMs: row.startsAt.getTime(), endMs: row.endsAt.getTime(), cubicMeters });
      } else if (kind === 'resource') {
        resourceTimeline(id)?.addWithdrawal(row.startsAt.getTime(), row.endsAt.getTime(), cubicMeters);
      }
    }
  }

  for (const item of equipment) {
    const pump = item.pump;
    let pumpTimeline: PumpTimeline | null = null;
    if (pump) {
      pumpTimeline = pumpTimelines.get(pump.id) ?? new PumpTimeline(pump, inputs.events);
      pumpTimelines.set(pump.id, pumpTimeline);
    }
    const origin = item.origin;
    let chain: SupplyChain;
    if (!origin) {
      chain = { originKey: null, originName: pump ? 'origine non renseignée' : 'sans pompe', pumpTimeline, reservoir: null, resource: null, origin: null, unavailable: false };
    } else if (origin.sourceKind === 'reservoir' && origin.reservoirId) {
      const timeline = reservoirTimeline(origin.reservoirId);
      chain = {
        originKey: `reservoir:${origin.reservoirId}`,
        originName: timeline?.reservoir.name ?? 'réserve introuvable',
        pumpTimeline,
        reservoir: timeline,
        resource: null,
        origin,
        unavailable: !timeline || timeline.reservoir.status !== 'active',
      };
    } else {
      const timeline = origin.resourceId ? resourceTimeline(origin.resourceId) : null;
      chain = {
        originKey: origin.resourceId ? `resource:${origin.resourceId}` : null,
        originName: timeline?.resource.name ?? 'ressource introuvable',
        pumpTimeline,
        reservoir: null,
        resource: timeline,
        origin,
        unavailable: !timeline || timeline.resource.status !== 'active',
      };
    }
    chains.set(item.id, chain);
  }
  return chains;
}


