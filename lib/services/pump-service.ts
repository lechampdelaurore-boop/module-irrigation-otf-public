import { listPumpConfigurationForUser, listPumpUsagesForUser } from '@/db/pump-repository';
import { listWaterInfrastructureForUser } from '@/db/water-resource-repository';
import { listCountedIrrigationEventsForUser } from './counted-irrigation-events';
import {
  evaluateHydraulicFeasibility,
  requestedFlowCubicMetersPerHour,
  resolvePumpOriginAvailability,
  type HydraulicFeasibility,
  type PumpAssignment,
  type PumpUsage,
} from '../domain/pumps';

export type PumpValidationResult = {
  assignment: PumpAssignment | null;
  feasibility: HydraulicFeasibility;
};

export async function validatePumpAssignmentForUser({
  ownerUserId,
  pumpId,
  pumpOriginId,
  applications,
  startsAt,
  endsAt,
  excludedEventEquipmentId = null,
}: {
  ownerUserId: string;
  pumpId: string | null;
  pumpOriginId: string | null;
  applications: readonly { rateMmPerHour: number; wettedAreaSquareMeters: number | null }[];
  startsAt: string;
  endsAt: string;
  excludedEventEquipmentId?: string | null;
}): Promise<PumpValidationResult> {
  const requiredFlow = requestedFlowCubicMetersPerHour(applications);
  if (requiredFlow === null) {
    // Une planche sans passe-pied renseigné n'a pas de surface mouillée, donc
    // pas de débit calculable : la pompe est retenue, la faisabilité reste
    // « non vérifiée » (docs/wetted-surface-contract.md), jamais rassurante.
    return validateUnknownFlow({ ownerUserId, pumpId, pumpOriginId });
  }
  if (!pumpId) {
    return {
      assignment: null,
      feasibility: evaluateHydraulicFeasibility({
        pump: null,
        candidate: { eventEquipmentId: excludedEventEquipmentId ?? 'candidate', label: 'Nouvelle irrigation', startsAt, endsAt, requestedFlowCubicMetersPerHour: requiredFlow },
        usages: [],
      }),
    };
  }
  const [configuration, infrastructure, usages] = await Promise.all([
    listPumpConfigurationForUser(ownerUserId),
    listWaterInfrastructureForUser(ownerUserId),
    listPumpUsagesForUser(ownerUserId, pumpId, startsAt, endsAt, excludedEventEquipmentId)
      .then((found) => countedPumpUsages(ownerUserId, startsAt, endsAt, found)),
  ]);
  const pump = configuration.pumps.find((item) => item.id === pumpId) ?? null;
  if (!pump) throw new Error('La pompe sélectionnée est introuvable.');
  const origin = pumpOriginId
    ? pump.origins.find((item) => item.id === pumpOriginId) ?? null
    : pump.origins.find((item) => item.isDefault) ?? null;
  if (pumpOriginId && !origin) throw new Error('Cette origine n’est pas autorisée pour la pompe sélectionnée.');
  const durationHours = Math.max(0, new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000;
  const originAvailability = resolvePumpOriginAvailability({
    infrastructure,
    origin,
    startsAt,
    requiredVolumeCubicMeters: requiredFlow * durationHours,
  });
  const feasibility = evaluateHydraulicFeasibility({
    pump,
    candidate: { eventEquipmentId: excludedEventEquipmentId ?? 'candidate', label: 'Nouvelle irrigation', startsAt, endsAt, requestedFlowCubicMetersPerHour: requiredFlow },
    usages,
    originAvailability,
  });
  const originSnapshot = origin ? {
    id: origin.id,
    sourceKind: origin.sourceKind,
    sourceId: origin.sourceKind === 'resource' ? origin.resourceId! : origin.reservoirId!,
    name: originName(infrastructure, origin.sourceKind, origin.resourceId, origin.reservoirId),
  } : null;
  return {
    assignment: {
      pumpId: pump.id,
      pumpOriginId: origin?.id ?? null,
      requestedFlowCubicMetersPerHour: requiredFlow,
      pumpSnapshot: { id: pump.id, name: pump.name, maximumFlowCubicMetersPerHour: pump.maximumFlowCubicMetersPerHour },
      pumpOriginSnapshot: originSnapshot,
    },
    feasibility,
  };
}

async function validateUnknownFlow({
  ownerUserId,
  pumpId,
  pumpOriginId,
}: {
  ownerUserId: string;
  pumpId: string | null;
  pumpOriginId: string | null;
}): Promise<PumpValidationResult> {
  const feasibility: HydraulicFeasibility = {
    possible: true,
    hydraulicallyVerified: false,
    reasons: ['flow_unknown'],
    requiredFlowCubicMetersPerHour: 0,
    alreadyEngagedFlowCubicMetersPerHour: 0,
    totalFlowCubicMetersPerHour: 0,
    pumpCapacityCubicMetersPerHour: null,
    remainingCapacityCubicMetersPerHour: null,
    excessFlowCubicMetersPerHour: 0,
    conflictingIrrigations: [],
    originAvailability: { status: 'unknown', message: 'Débit demandé inconnu : une planche sans passe-pied renseigné dans Ouvre ta ferme.' },
  };
  if (!pumpId) return { assignment: null, feasibility };
  const [configuration, infrastructure] = await Promise.all([
    listPumpConfigurationForUser(ownerUserId),
    listWaterInfrastructureForUser(ownerUserId),
  ]);
  const pump = configuration.pumps.find((item) => item.id === pumpId) ?? null;
  if (!pump) throw new Error('La pompe sélectionnée est introuvable.');
  const origin = pumpOriginId
    ? pump.origins.find((item) => item.id === pumpOriginId) ?? null
    : pump.origins.find((item) => item.isDefault) ?? null;
  if (pumpOriginId && !origin) throw new Error('Cette origine n’est pas autorisée pour la pompe sélectionnée.');
  return {
    assignment: {
      pumpId: pump.id,
      pumpOriginId: origin?.id ?? null,
      requestedFlowCubicMetersPerHour: null,
      pumpSnapshot: { id: pump.id, name: pump.name, maximumFlowCubicMetersPerHour: pump.maximumFlowCubicMetersPerHour },
      pumpOriginSnapshot: origin ? {
        id: origin.id,
        sourceKind: origin.sourceKind,
        sourceId: origin.sourceKind === 'resource' ? origin.resourceId! : origin.reservoirId!,
        name: originName(infrastructure, origin.sourceKind, origin.resourceId, origin.reservoirId),
      } : null,
    },
    feasibility,
  };
}

function originName(
  infrastructure: Awaited<ReturnType<typeof listWaterInfrastructureForUser>>,
  kind: 'resource' | 'reservoir',
  resourceId: string | null,
  reservoirId: string | null,
) {
  return kind === 'resource'
    ? infrastructure.resources.find((item) => item.id === resourceId)?.name ?? 'Ressource'
    : infrastructure.reservoirs.find((item) => item.id === reservoirId)?.name ?? 'Réserve';
}

export function hydraulicFailureMessage(result: HydraulicFeasibility) {
  const required = result.requiredFlowCubicMetersPerHour.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  const capacity = (result.pumpCapacityCubicMetersPerHour ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  const excess = result.excessFlowCubicMetersPerHour.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  if (result.reasons.includes('pump_inactive')) return 'Action bloquée : la pompe sélectionnée est archivée.';
  if (result.reasons.includes('origin_unavailable')) return `Action bloquée : ${result.originAvailability.message}`;
  return `Action bloquée : débit demandé ${required} m³/h, capacité de la pompe ${capacity} m³/h, dépassement ${excess} m³/h.${result.conflictingIrrigations.length ? ` Conflit avec : ${result.conflictingIrrigations.map((item) => item.label).join(', ')}.` : ''}`;
}

/**
 * Les usages de la pompe qui comptent : une irrigation planifiée qui ne peut
 * plus démarrer, matériel stocké ou reposé ailleurs, n'occupe pas la pompe
 * (D-044) ; reposé au même endroit, elle l'occupe de nouveau.
 */
async function countedPumpUsages(ownerUserId: string, startsAt: string, endsAt: string, usages: PumpUsage[]): Promise<PumpUsage[]> {
  if (usages.length === 0) return usages;
  const counted = await listCountedIrrigationEventsForUser(ownerUserId, undefined, false, { startAt: startsAt, endAt: endsAt });
  const countedIds = new Set(counted.map((event) => event.equipment.id));
  return usages.filter((usage) => countedIds.has(usage.eventEquipmentId));
}
