import type { EquipmentPlacementRecord } from './equipment-placement-record.ts';

/**
 * Keeps the plan responsive after a placement is saved without rebuilding the
 * whole irrigation route. Existing order is retained when a placement moves.
 */
export function upsertEquipmentPlacement(
  placements: EquipmentPlacementRecord[],
  placement: EquipmentPlacementRecord,
): EquipmentPlacementRecord[] {
  const index = placements.findIndex(
    (item) => item.equipmentId === placement.equipmentId,
  );
  if (index === -1) return [...placements, placement];

  return placements.map((item, itemIndex) =>
    itemIndex === index ? placement : item,
  );
}

export function removeEquipmentPlacement(
  placements: EquipmentPlacementRecord[],
  equipmentId: string,
): EquipmentPlacementRecord[] {
  return placements.filter((placement) => placement.equipmentId !== equipmentId);
}
