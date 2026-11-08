import { listEquipmentPosesForUser } from '@/db/equipment-placement-poses';
import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { blockedPlannedIrrigations, irrigationsThatCount, type PlacementPose } from '@/lib/domain/equipment-placement-periods';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import type { BlockedPlannedIrrigation } from '@/lib/domain/planning/contract';

/**
 * Les irrigations que comptent les calculs : besoins, faisabilité, planning,
 * réserves, limite journalière et pompe (D-044). Une irrigation planifiée sur
 * un matériel stocké, ou reposé ailleurs, ne peut pas démarrer (2.11, règle
 * 13) : elle reste dans les listes et l'historique, mais n'entre plus dans
 * les calculs tant que le matériel n'est pas reposé au même endroit. Les
 * écrans qui listent les irrigations lisent toujours `listIrrigationEventsForUser`.
 */
export async function listCountedIrrigationEventsForUser(
  ...parameters: Parameters<typeof listIrrigationEventsForUser>
): Promise<IrrigationEventRecord[]> {
  const [ownerUserId] = parameters;
  const events = await listIrrigationEventsForUser(...parameters);
  return irrigationsThatCount(events, await currentPoses(ownerUserId, events));
}

/**
 * Les mêmes irrigations, partagées : celles qui comptent, et celles qu'une
 * pose empêche de démarrer, avec leur blocage — le planning suggère de les
 * annuler (3.7, docs/replanning-contract.md, règle 16).
 */
export async function partitionIrrigationEventsForUser(
  ...parameters: Parameters<typeof listIrrigationEventsForUser>
): Promise<{ counted: IrrigationEventRecord[]; blocked: BlockedPlannedIrrigation[] }> {
  const [ownerUserId] = parameters;
  const events = await listIrrigationEventsForUser(...parameters);
  const poses = await currentPoses(ownerUserId, events);
  return { counted: irrigationsThatCount(events, poses), blocked: blockedPlannedIrrigations(events, poses) };
}

/** Les poses courantes, posées ou stockées, de chaque saison des irrigations lues. */
async function currentPoses(ownerUserId: string, events: readonly IrrigationEventRecord[]): Promise<PlacementPose[]> {
  const seasons = [...new Set(events.map((event) => event.season))];
  const poses = await Promise.all(seasons.map((season) => listEquipmentPosesForUser(ownerUserId, season)));
  return poses.flat();
}
