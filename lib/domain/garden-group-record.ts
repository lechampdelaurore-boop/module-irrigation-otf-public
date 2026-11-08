import type { GardenBedOrder } from './garden-group-domain.ts';

/**
 * Groupes de jardin : des parcelles rassemblées dans l'ordre où le maraîcher
 * les parcourt, avec l'écart qui les sépare. Décision D-020 : ces
 * descriptions appartiennent au domaine, `db/` les lit.
 */

export type GardenGroupMemberRecord = {
  otfZoneId: string;
  otfPlotId: string;
  position: number;
  bedOrder: GardenBedOrder;
  gapBeforeMeters: number;
};

export type GardenGroupRecord = {
  id: string;
  name: string;
  position: number;
  copiedFromGroupId: string | null;
  members: GardenGroupMemberRecord[];
};

/**
 * Les groupes d'une saison. `copiedFromSeason` dit de quelle saison ils ont
 * été recopiés lorsque la saison en cours n'en avait aucun : le maraîcher
 * retrouve ainsi son organisation d'une année sur l'autre.
 */
export type GardenGroupConfiguration = {
  groups: GardenGroupRecord[];
  copiedFromSeason: number | null;
};
