import type { PlacementBedInput } from './equipment-placement-domain.ts';
import type { PlacementAnchor } from './irrigation-domain.ts';

/**
 * Position d'un matériel sur le plan, pour une saison donnée : le point
 * d'ancrage et les planches qu'il alimente. Décision D-020 : cette
 * description appartient au domaine, `db/` la lit.
 */
export type EquipmentPlacementRecord = {
  id: string;
  equipmentId: string;
  settingId: string;
  season: number;
  gardenGroupId: string | null;
  otfZoneId: string;
  otfPlotId: string;
  anchor: PlacementAnchor;
  selectedBeds: PlacementBedInput[];
};
