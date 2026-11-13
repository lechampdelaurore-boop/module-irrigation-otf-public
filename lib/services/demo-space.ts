import { DEMO_FARMS } from '../adapters/demo/farms.ts';
import { DEMO_FROST_COMMON_KEYS, DEMO_SPECIES_REFERENCES } from '../adapters/demo/module-data.ts';
import type { DemoChoice } from '../domain/demo/catalogue.ts';
import { saveFrostLinkForUser } from '@/db/crop-alerts/inputs';
import { saveSpeciesCorrespondenceForUser } from '@/db/crop-water/entries';
import { saveFeatureSelectionForUser } from '@/db/feature-selection-repository';
import { createWorkspaceIfAbsent, findWorkspaceIdForUser } from '@/db/workspace-repository';
import { isDemoDeployment } from './deployment-mode.ts';

/**
 * L'espace d'un invité de la démonstration, pour une ferme fictive et un
 * moment (docs/demo-guided-contract.md, sections 5 et 6) : créé à sa première
 * ouverture avec ce que la ferme a déjà réglé (ses cases cochées, ses
 * espèces rattachées aux cultures de référence et aux seuils de gel du jeu
 * commun), par les dépôts ordinaires, comme si la ferme l'avait saisi. La
 * ferme vierge n'a pas d'espace tant que l'invité n'a rien coché : c'est
 * ainsi qu'une ferme qui n'a jamais ouvert le module arrive sur la liste à
 * cocher (R5). Le plan de la ferme vient de `lib/adapters/demo/farms.ts`, la
 * météo du fournisseur de la démonstration.
 *
 * Deux requêtes simultanées ne préparent l'espace qu'une fois : seule celle
 * qui le crée l'écrit ; l'autre le lit tel qu'il est. Un espace déjà ouvert
 * n'est jamais réécrit : les essais de l'invité restent jusqu'à la remise à
 * zéro (D4). Refusé hors démonstration : le module en production n'a aucun
 * peuplement.
 */
export async function prepareDemoSpace(ownerUserId: string, choice: DemoChoice): Promise<void> {
  if (!isDemoDeployment()) throw new Error('Un espace de démonstration ne se prépare qu’en démonstration.');
  if (choice.profile.features.length === 0) return;
  if (await findWorkspaceIdForUser(ownerUserId)) return;
  if (!(await createWorkspaceIfAbsent(ownerUserId))) return;
  const now = new Date();
  await saveFeatureSelectionForUser(ownerUserId, choice.profile.features, now);
  await saveSpecies(ownerUserId, choice, now);
}

/** Les espèces de la ferme, rattachées comme la ferme le ferait dans Réglages et dans Alertes cultures. */
async function saveSpecies(ownerUserId: string, choice: DemoChoice, now: Date): Promise<void> {
  const plantIds = [...new Set(DEMO_FARMS[choice.profile.id].series.map((series) => series.plantId))];
  const frost = choice.profile.features.includes('alertes-cultures');
  for (const plantId of plantIds) {
    const referenceCropId = DEMO_SPECIES_REFERENCES[plantId];
    if (referenceCropId) {
      const saved = await saveSpeciesCorrespondenceForUser(
        ownerUserId,
        { plantId, seriesId: null, target: { kind: 'reference', referenceCropId, analogy: false } },
        now,
      );
      if (!saved.ok) throw new Error(`Démonstration : ${plantId} non rattachée (${saved.problems.join(' ; ')}).`);
    }
    const commonKey = DEMO_FROST_COMMON_KEYS[plantId];
    if (frost && commonKey) {
      const saved = await saveFrostLinkForUser(ownerUserId, { plantId, seriesId: null, commonKey }, now);
      if (!saved.ok) throw new Error(`Démonstration : seuil de gel de ${plantId} refusé (${saved.problems.join(' ; ')}).`);
    }
  }
}
