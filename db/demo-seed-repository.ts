import { batchWholeGroups } from './batches';
import { checkFrostLink, frostLinkStatements, listCropAlertCommon } from './crop-alerts/inputs';
import { speciesCorrespondenceStatements } from './crop-water/entries';
import { listReferenceCropsForWorkspace } from './crop-water/references';
import { ensureWorkspaceForUser } from './workspace-repository';

/**
 * Les espèces d'une ferme de démonstration, rattachées comme la ferme le
 * ferait dans Réglages puis dans Alertes cultures (accélérer le site, A2,
 * D-359 ; docs/acceleration-du-site-contract.md, section 4) : pour chaque
 * espèce, dans l'ordre donné, son rattachement à une culture de référence,
 * puis, s'il y a lieu, son seuil de gel du jeu commun. Les mêmes lignes que
 * `saveSpeciesCorrespondenceForUser` puis `saveFrostLinkForUser`, espèce
 * après espèce, mais les cultures de référence et le jeu commun lus une
 * seule fois, et les écritures parties en quelques lots, chaque geste
 * entier. Tout est vérifié avant la première écriture : un refus n'écrit
 * rien et dit chaque problème, l'espèce en tête.
 */
export async function saveDemoSpeciesForUser(
  ownerUserId: string,
  species: readonly { plantId: string; referenceCropId: string | null; frostCommonKey: string | null }[],
  now: Date,
): Promise<{ ok: true } | { ok: false; problems: string[] }> {
  if (species.length === 0) return { ok: true };
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const crops = species.some((item) => item.referenceCropId !== null)
    ? (await listReferenceCropsForWorkspace(workspaceId)).map((stored) => stored.crop)
    : [];
  const commonKeys = species.some((item) => item.frostCommonKey !== null)
    ? new Set((await listCropAlertCommon()).map((entry) => entry.key))
    : new Set<string>();
  const gesture = { workspaceId, ownerUserId, at: now.toISOString() };
  const groups: D1PreparedStatement[][] = [];
  const problems: string[] = [];
  for (const { plantId, referenceCropId, frostCommonKey } of species) {
    if (referenceCropId !== null) {
      const link = speciesCorrespondenceStatements(gesture, crops, {
        plantId,
        seriesId: null,
        target: { kind: 'reference', referenceCropId, analogy: false },
      });
      if (link.ok) groups.push(link.value);
      else problems.push(...link.problems.map((problem) => `${plantId} non rattachée : ${problem}`));
    }
    if (frostCommonKey !== null) {
      const checked = checkFrostLink({ plantId, seriesId: null, commonKey: frostCommonKey }, commonKeys);
      if (checked.ok) groups.push(frostLinkStatements(gesture, checked.value).statements);
      else problems.push(...checked.problems.map((problem) => `seuil de gel de ${plantId} refusé : ${problem}`));
    }
  }
  if (problems.length > 0) return { ok: false, problems };
  await batchWholeGroups(groups);
  return { ok: true };
}
