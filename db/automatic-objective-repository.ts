import { db } from './binding';
import type { AutomaticObjectiveSettingRevision } from '@/lib/domain/automatic-objective';
import { automaticObjectiveJournal } from './change-journal/objectives';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import { aEcritUneLigne } from './write-result';

/**
 * Le réglage « Objectif automatique » d'une ferme (6 decies, O2,
 * docs/objectif-automatique-contract.md, section 3, règle 1 ; D-309, D-317) :
 * éteint au départ, allumé ou éteint par un geste daté, qui compte à partir
 * de son jour, en heure de Paris. La règle le lit geste par geste
 * (`automaticObjectiveEnabledOn`) : rien n'est réécrit, les jours d'avant
 * gardent ce qu'ils avaient.
 */

/**
 * Les gestes de la ferme, du plus ancien au plus récent ; deux gestes de la
 * même milliseconde gardent l'ordre d'écriture, le second fait foi
 * (docs/revision-order-contract.md). Aucun : le réglage est éteint.
 */
export async function listAutomaticObjectiveRevisionsForUser(ownerUserId: string): Promise<AutomaticObjectiveSettingRevision[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  const result = await db.prepare(
    `SELECT enabled, created_at
     FROM irrigation_automatic_objective_revisions
     WHERE workspace_id = ?
     ORDER BY created_at, rowid`,
  ).bind(workspaceId).all<{ enabled: number; created_at: string }>();
  return result.results.map((row) => ({ enabled: Number(row.enabled) === 1, createdAt: row.created_at }));
}

/**
 * Allume ou éteint l'objectif automatique de la ferme, à l'instant `now` du
 * geste. Un geste qui ne change pas l'état en vigueur n'écrit rien, au
 * journal non plus ; sinon la ligne et celle du journal des modifications
 * s'écrivent dans le même lot (F709). Rend `true` quand l'état a changé.
 */
export async function saveAutomaticObjectiveForUser(ownerUserId: string, enabled: boolean, now: Date): Promise<boolean> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const at = now.toISOString();
  const [, inserted] = await db.batch([
    // Le journal d'abord : l'avant se lit sur la révision en vigueur (F716).
    automaticObjectiveJournal('objectif-automatique', { workspaceId, actorUserId: ownerUserId, at }, enabled),
    db.prepare(
      `INSERT INTO irrigation_automatic_objective_revisions (id, workspace_id, enabled, actor_user_id, created_at)
       SELECT ?, ?, ?, ?, ?
       WHERE COALESCE((
         SELECT enabled FROM irrigation_automatic_objective_revisions
         WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1
       ), 0) IS NOT ?`,
    ).bind(revisionId(), workspaceId, enabled ? 1 : 0, ownerUserId, at, workspaceId, enabled ? 1 : 0),
  ]);
  return aEcritUneLigne(inserted.meta);
}

function revisionId() {
  return `${String(Date.now()).padStart(13, '0')}-${crypto.randomUUID()}`;
}
