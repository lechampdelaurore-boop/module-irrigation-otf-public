import { cubicMetersFromLiters } from './units.ts';
import type { BedIrrigationNeed } from './irrigation-needs.ts';
import type { IrrigationCoverageResult } from './irrigation-coverage.ts';
import { evaluateHydraulicFeasibility, type EquipmentPumpDefault, type IrrigationPump } from './pumps.ts';
import type { FeasibilityPool, HydraulicQuality } from './irrigation-feasibility.ts';
import type { MobilizableWaterPool } from './water-resources.ts';

/** Defaults describe a known path, not an exclusive assignment. No simultaneous/hourly planning. */
export function describeFeasibilityPaths(input: {
  pools: MobilizableWaterPool[]; beds: BedIrrigationNeed[]; coverage: IrrigationCoverageResult;
  pumps: IrrigationPump[]; equipmentDefaults: EquipmentPumpDefault[];
}): FeasibilityPool[] {
  return input.pools.map((pool) => ({ ...pool, paths: Object.fromEntries(input.beds.map((bed) => {
    const coverage = input.coverage.beds.find((row) => row.bedId === bed.bedId);
    let quality: HydraulicQuality = 'unverified';
    let failedKnownPath = false;
    let incompleteAlternative = false;
    for (const contribution of coverage?.contributions ?? []) {
      const assigned = input.equipmentDefaults.find((item) => item.equipmentId === contribution.equipmentId);
      const pump = input.pumps.find((item) => item.id === assigned?.pumpId);
      if (!pump) { incompleteAlternative = true; continue; }
      const origin = pump.origins.find((item) => `${item.sourceKind}:${item.resourceId ?? item.reservoirId}` === pool.key);
      if (!origin) { incompleteAlternative = true; continue; }
      const flow = input.coverage.equipment.find((item) => item.equipmentId === contribution.equipmentId)?.totalLitersPerHour;
      if (flow === undefined) { incompleteAlternative = true; continue; }
      const check = evaluateHydraulicFeasibility({ pump, usages: [], candidate: {
        eventEquipmentId: contribution.equipmentId, label: contribution.equipmentName,
        startsAt: '2000-01-01T00:00:00.000Z', endsAt: '2000-01-01T00:00:01.000Z', requestedFlowCubicMetersPerHour: cubicMetersFromLiters(flow),
      }, originAvailability: { status: pool.forecastCubicMeters === null ? 'unknown' : 'available', message: 'Budget volumétrique de la période, sans contrôle de créneaux.' } });
      if (check.possible && pool.forecastCubicMeters !== null && !pool.reasons.some((reason) => reason.includes('non vérifiable'))) { quality = 'confirmed'; break; }
      if (!check.possible) failedKnownPath = true;
      else incompleteAlternative = true;
    }
    if (quality !== 'confirmed' && failedKnownPath && !incompleteAlternative) quality = 'incompatible';
    return [bed.bedId, quality];
  })) }));
}
