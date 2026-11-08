import { listEquipmentPlacementsForUser, listPosesOfEquipmentForUser } from '@/db/equipment-placement-repository';
import { placementRecord } from '@/db/equipment-placement-poses';
import { IrrigationEventInputError } from '@/db/irrigation-event/errors';
import {
  completedIrrigationPoseRefusalMessage,
  poseForCompletedIrrigation,
} from '@/lib/domain/equipment-placement-periods';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';

/**
 * La position d'une irrigation qu'on enregistre (2.11,
 * docs/equipment-placement-periods-contract.md). À venir ou en cours : le
 * matériel posé, un matériel stocké n'arrose pas (règle 11). Saisie après
 * coup : la pose ouverte à son heure de début, même retirée depuis, pour que
 * l'irrigation garde les planches qu'elle a réellement arrosées ; stocké à
 * cette heure, ou retiré avant la fin, l'enregistrement est refusé avec son
 * motif (règles 5 et 12). `null` : ce matériel n'a aucune pose cette saison.
 */
export async function irrigationPlacementForUser(input: {
  ownerUserId: string;
  season: number;
  equipmentId: string;
  /** Les heures réelles d'une irrigation saisie après coup ; `null` pour une irrigation à venir ou en cours. */
  completed: { actualStartAt: string; actualEndAt: string } | null;
}): Promise<EquipmentPlacementRecord | null> {
  if (input.completed === null) {
    const placements = await listEquipmentPlacementsForUser(input.ownerUserId, input.season);
    return placements.find((placement) => placement.equipmentId === input.equipmentId) ?? null;
  }
  const poses = await listPosesOfEquipmentForUser(input.ownerUserId, input.equipmentId, input.season);
  if (poses.length === 0) return null;
  const found = poseForCompletedIrrigation(poses, input.completed.actualStartAt, input.completed.actualEndAt);
  if (!found.ok) throw new IrrigationEventInputError(completedIrrigationPoseRefusalMessage(found.refusal));
  return placementRecord(found.pose);
}
