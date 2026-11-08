import { db } from './binding';
import type { KeptSuggestion, PlanSuggestionKind } from '@/lib/domain/planning/contract';
import { ensureWorkspaceForUser } from './workspace-repository';
import { aEcritUneLigne } from './write-result';

/**
 * « Garder » une suggestion (3.7, docs/replanning-contract.md, règle 17 ;
 * « Données ») : le registre retient, par irrigation planifiée, la
 * suggestion tue avec sa dose, pour qu'elle ne revienne que si un calcul
 * suivant en fait une autre. L'irrigation doit être de l'exploitation, et sa
 * saison est la sienne ; une même suggestion gardée deux fois n'écrit qu'une
 * ligne. Ce n'est pas un événement : rien ne se recalcule.
 */
export async function keepPlanSuggestionForUser(
  ownerUserId: string,
  input: { eventEquipmentId: string; suggestion: PlanSuggestionKind; doseMm: number | null; actorUserId: string },
): Promise<'kept' | 'already-kept' | 'not-found'> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const doseMm = input.suggestion === 'reduce' ? input.doseMm : null;
  // Deux doses égales au dixième de millimètre affiché sont la même suggestion.
  const sameKeep = `k.event_equipment_id = ee.id AND k.suggestion = ? AND ((k.dose_mm IS NULL AND ? IS NULL) OR ROUND(k.dose_mm, 1) = ROUND(?, 1))`;
  const result = await db.prepare(`INSERT INTO irrigation_plan_suggestion_keeps
      (id, workspace_id, season, event_equipment_id, suggestion, dose_mm, actor_user_id, created_at)
    SELECT ?, ?, e.season, ee.id, ?, ?, ?, ?
    FROM irrigation_event_equipment ee
    JOIN irrigation_events e ON e.id = ee.event_id
    WHERE ee.id = ? AND e.workspace_id = ?
      AND NOT EXISTS (SELECT 1 FROM irrigation_plan_suggestion_keeps k WHERE ${sameKeep})`)
    .bind(crypto.randomUUID(), workspaceId, input.suggestion, doseMm, input.actorUserId, new Date().toISOString(),
      input.eventEquipmentId, workspaceId, input.suggestion, doseMm, doseMm)
    .run();
  if (aEcritUneLigne(result.meta)) return 'kept';
  const existing = await db.prepare(`SELECT 1 AS present FROM irrigation_plan_suggestion_keeps k
    JOIN irrigation_event_equipment ee ON ee.id = k.event_equipment_id
    WHERE k.workspace_id = ? AND ee.id = ? AND ${sameKeep} LIMIT 1`)
    .bind(workspaceId, input.eventEquipmentId, input.suggestion, doseMm, doseMm)
    .first<{ present: number }>();
  return existing ? 'already-kept' : 'not-found';
}

/** Les suggestions gardées d'une saison, pour marquer celles du plan. */
export async function listKeptSuggestions(workspaceId: string, season: number): Promise<KeptSuggestion[]> {
  const result = await db.prepare(`SELECT event_equipment_id, suggestion, dose_mm FROM irrigation_plan_suggestion_keeps
    WHERE workspace_id = ? AND season = ? ORDER BY created_at, rowid`)
    .bind(workspaceId, season)
    .all<{ event_equipment_id: string; suggestion: PlanSuggestionKind; dose_mm: number | null }>();
  return result.results.map((row) => ({ eventEquipmentId: row.event_equipment_id, suggestion: row.suggestion, doseMm: row.dose_mm }));
}
