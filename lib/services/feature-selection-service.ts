import {
  listFarmsWithSelection,
  readEnabledFeaturesForWorkspace,
  readFeatureSelectionForUser,
  type FarmForTreatment,
} from '@/db/feature-selection-repository';
import { rememberedRead } from '@/db/request-memo';
import type { FeatureId } from '../domain/features/catalogue';
import { resolveFeatureSelection, type ResolvedFeatureSelection } from '../domain/features/selection';

/**
 * Le choix des fonctionnalités d'une ferme, résolu (3.8,
 * docs/feature-selection-contract.md, section 4) : ce que les pages affichent
 * et ce que les traitements font tourner. Lu une fois par requête (section 5
 * sexies du contrat de la tranche 4) : la page et la page introuvable que son
 * rendu prépare avec elle le demandent toutes deux. La démonstration qui
 * attend qu'une autre requête ait coché les cases relit le dépôt, jamais
 * cette lecture (`lib/services/demo-space.ts`).
 */
export async function getFeatureSelectionForUser(ownerUserId: string): Promise<ResolvedFeatureSelection> {
  return rememberedRead('feature-selection', [ownerUserId], async () => resolveFeatureSelection(await readFeatureSelectionForUser(ownerUserId)));
}

/**
 * Les cases cochées, pour un traitement d'arrière-plan ou un envoi : une ferme
 * qui n'a jamais ouvert le module n'en a aucune, une ferme d'avant la 3.8 les
 * a toutes (R6).
 */
export async function getEnabledFeaturesForUser(ownerUserId: string): Promise<FeatureId[]> {
  return (await getFeatureSelectionForUser(ownerUserId)).enabled;
}

/** Les cases cochées d'un espace d'irrigation : une alerte après une prévision ne connaît que lui. */
export async function getEnabledFeaturesForWorkspace(workspaceId: string): Promise<FeatureId[]> {
  return readEnabledFeaturesForWorkspace(workspaceId);
}

/**
 * Les fermes pour qui un traitement du matin tourne : celles qui ont coché sa
 * case (R1 ; section 7, « La prise en compte »). Ce qui n'a pas tourné pendant
 * qu'une case était décochée ne se rattrape pas (P5).
 */
export async function listFarmsWithFeature(feature: FeatureId): Promise<FarmForTreatment[]> {
  return listFarmsWithSelection((enabled) => enabled.includes(feature));
}
