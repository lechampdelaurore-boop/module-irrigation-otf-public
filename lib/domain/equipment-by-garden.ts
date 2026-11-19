import { compareNamesNaturally } from './bed-order.ts';

/**
 * La liste « Matériel » des formulaires d'« Arrosages », regroupée par
 * jardin (audit du 19 novembre 2026, lot H, n° 14, F437) : le jardin où le
 * matériel est posé, ou le nom du groupe de jardins pour un matériel posé
 * sur un groupe ; « Sans jardin » quand le jardin n'est plus connu. Les
 * groupes et les matériels suivent l'ordre naturel (« gag2 » avant
 * « gag10 », F436).
 */

const NO_GARDEN_LABEL = 'Sans jardin';

export type EquipmentGardenGroup<T> = { label: string; items: T[] };

export function equipmentByGarden<T extends { id: string; name: string }>(
  items: readonly T[],
  placements: readonly { equipmentId: string; otfPlotId: string; gardenGroupId: string | null }[],
  gardens: { plots: readonly { id: string; name: string }[]; groups: readonly { id: string; name: string }[] },
): EquipmentGardenGroup<T>[] {
  const placementByEquipment = new Map(placements.map((placement) => [placement.equipmentId, placement]));
  const plotNames = new Map(gardens.plots.map((plot) => [plot.id, plot.name]));
  const groupNames = new Map(gardens.groups.map((group) => [group.id, group.name]));
  const byLabel = new Map<string, T[]>();
  for (const item of items) {
    const placement = placementByEquipment.get(item.id);
    const label = (placement?.gardenGroupId ? groupNames.get(placement.gardenGroupId) : undefined)
      ?? (placement ? plotNames.get(placement.otfPlotId) : undefined)
      ?? NO_GARDEN_LABEL;
    byLabel.set(label, [...(byLabel.get(label) ?? []), item]);
  }
  return [...byLabel.entries()]
    .sort(([left], [right]) => Number(left === NO_GARDEN_LABEL) - Number(right === NO_GARDEN_LABEL) || compareNamesNaturally(left, right))
    .map(([label, grouped]) => ({
      label,
      items: [...grouped].sort((left, right) => compareNamesNaturally(left.name, right.name) || compareNamesNaturally(left.id, right.id)),
    }));
}
