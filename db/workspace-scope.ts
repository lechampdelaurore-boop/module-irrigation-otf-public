import { farmSpaceOf, spaceKeyOf } from '@/lib/domain/farm-space';

/**
 * Le filtre d'un espace sur `irrigation_workspaces` (docs/tranche-4-contract.md,
 * section 5 bis, F328) : la personne et la ferme ensemble, `IS` couvrant
 * l'espace sans ferme (`NULL`). Toute requête qui retrouve un espace, ou qui
 * vérifie qu'un objet désigné par le navigateur lui appartient, l'emploie ;
 * ses deux paramètres viennent de `spaceParams`, dans cet ordre.
 */
export const SPACE_FILTER = 'owner_user_id = ? AND otf_farm_id IS ?';

/** Le même filtre, sur la table des espaces nommée `workspace` dans une jointure. */
export const WORKSPACE_SPACE_FILTER = 'workspace.owner_user_id = ? AND workspace.otf_farm_id IS ?';

/** Les deux paramètres du filtre d'un espace : la personne, puis la ferme ou `null`. */
export function spaceParams(spaceKey: string): [string, string | null] {
  const { ownerUserId, otfFarmId } = farmSpaceOf(spaceKey);
  return [ownerUserId, otfFarmId];
}

/** La clé d'espace d'une ligne de `irrigation_workspaces`, pour les traitements qui les parcourent toutes. */
export function spaceKeyOfRow(row: { owner_user_id: string; otf_farm_id: string | null }): string {
  return spaceKeyOf({ ownerUserId: row.owner_user_id, otfFarmId: row.otf_farm_id });
}
