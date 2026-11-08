import { db } from './binding';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import { FEATURE_IDS, FEATURES_BEFORE_SELECTION, type FeatureId } from '@/lib/domain/features/catalogue';
import {
  isCompleteSelection,
  orderedSelection,
  resolveFeatureSelection,
  type FeatureSelection,
  type StoredFeatureSelection,
} from '@/lib/domain/features/selection';

/**
 * Le choix des fonctionnalités d'une exploitation (3.8,
 * docs/feature-selection-contract.md, sections 4 et 7). Le choix vaut pour
 * l'espace d'irrigation, donc pour toute la ferme (R4). Ce dépôt n'interprète
 * rien : il rend ce que la base contient et le domaine
 * (`resolveFeatureSelection`) en tire les cases cochées et le bandeau.
 */

type SelectionRow = {
  enabled_features: string;
  known_features: string;
  chosen_at: string | null;
  banner_dismissed_at: string | null;
};

function parseList(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storedSelection(row: SelectionRow | null): StoredFeatureSelection {
  if (!row) return { kind: 'before-selection' };
  return {
    kind: 'stored',
    enabled: parseList(row.enabled_features),
    known: parseList(row.known_features),
    chosenAt: row.chosen_at,
    bannerDismissedAt: row.banner_dismissed_at,
  };
}

/** Ce que la base sait du choix d'un espace d'irrigation qui existe : sans ligne, une ferme d'avant la 3.8 (R6). */
async function readFeatureSelectionForWorkspace(workspaceId: string): Promise<StoredFeatureSelection> {
  const row = await db.prepare(
    `SELECT enabled_features, known_features, chosen_at, banner_dismissed_at
     FROM irrigation_feature_selections WHERE workspace_id = ?`,
  ).bind(workspaceId).first<SelectionRow>();
  return storedSelection(row ?? null);
}

/** Ce que la base sait du choix, sans rien créer : une ferme sans espace n'a jamais ouvert le module (R5). */
export async function readFeatureSelectionForUser(ownerUserId: string): Promise<StoredFeatureSelection> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (workspaceId === null) return { kind: 'first-visit' };
  return readFeatureSelectionForWorkspace(workspaceId);
}

/** Les cases cochées d'un espace d'irrigation, pour un traitement qui ne connaît que lui (une alerte après une prévision). */
export async function readEnabledFeaturesForWorkspace(workspaceId: string): Promise<FeatureId[]> {
  return resolveFeatureSelection(await readFeatureSelectionForWorkspace(workspaceId)).enabled;
}

export type FarmForTreatment = { workspaceId: string; ownerUserId: string };

/**
 * Les fermes dont le choix remplit la condition, en une lecture : chaque
 * traitement d'arrière-plan ne tourne que pour elles (R1 ; section 7, « La
 * prise en compte »). Une ferme d'avant la 3.8, sans ligne, a tout coché (R6).
 */
export async function listFarmsWithSelection(
  condition: (enabled: FeatureSelection) => boolean,
): Promise<FarmForTreatment[]> {
  const result = await db.prepare(
    `SELECT workspace.id AS workspace_id, workspace.owner_user_id, selection.workspace_id AS selection_workspace_id,
            selection.enabled_features, selection.known_features, selection.chosen_at, selection.banner_dismissed_at
     FROM irrigation_workspaces AS workspace
     LEFT JOIN irrigation_feature_selections AS selection ON selection.workspace_id = workspace.id
     WHERE workspace.otf_farm_id IS NULL
     ORDER BY workspace.owner_user_id`,
  ).all<SelectionRow & { workspace_id: string; owner_user_id: string; selection_workspace_id: string | null }>();
  return result.results
    .filter((row) => condition(resolveFeatureSelection(storedSelection(row.selection_workspace_id === null ? null : row)).enabled))
    .map((row) => ({ workspaceId: row.workspace_id, ownerUserId: row.owner_user_id }));
}

export class InvalidFeatureSelectionError extends Error {
  constructor() {
    super('Le choix doit compter au moins une fonctionnalité, avec celles dont elle a besoin.');
    this.name = 'InvalidFeatureSelectionError';
  }
}

/**
 * Enregistre le choix de la ferme. Le domaine a déjà complété les
 * dépendances ; un choix incomplet ou vide est refusé ici aussi (R3, P7). Les
 * cases connues deviennent toute la liste du moment : rien n'est plus annoncé
 * comme nouveau. L'espace d'irrigation est créé à la première ouverture.
 */
export async function saveFeatureSelectionForUser(
  ownerUserId: string,
  enabled: readonly FeatureId[],
  now: Date,
): Promise<void> {
  if (!isCompleteSelection(enabled)) throw new InvalidFeatureSelectionError();
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const at = now.toISOString();
  await db.prepare(
    `INSERT INTO irrigation_feature_selections
       (workspace_id, enabled_features, known_features, chosen_at, banner_dismissed_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?)
     ON CONFLICT (workspace_id) DO UPDATE SET
       enabled_features = excluded.enabled_features,
       known_features = excluded.known_features,
       chosen_at = excluded.chosen_at,
       updated_at = excluded.updated_at`,
  ).bind(workspaceId, JSON.stringify(orderedSelection(enabled)), JSON.stringify(FEATURE_IDS), at, at).run();
}

/**
 * Ferme le bandeau (R6, R7) sans rien cocher ni décocher. Une ferme d'avant la
 * 3.8 garde tout coché : sa ligne naît avec les cases d'alors, sans date de
 * choix. Une case nouvelle reste décochée et n'est plus annoncée.
 */
export async function dismissFeatureBannerForUser(ownerUserId: string, now: Date): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const at = now.toISOString();
  await db.prepare(
    `INSERT INTO irrigation_feature_selections
       (workspace_id, enabled_features, known_features, chosen_at, banner_dismissed_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?)
     ON CONFLICT (workspace_id) DO UPDATE SET
       known_features = excluded.known_features,
       banner_dismissed_at = excluded.banner_dismissed_at,
       updated_at = excluded.updated_at`,
  ).bind(workspaceId, JSON.stringify(FEATURES_BEFORE_SELECTION), JSON.stringify(FEATURE_IDS), at, at).run();
}
