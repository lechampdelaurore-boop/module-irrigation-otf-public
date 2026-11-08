import { db } from '../binding';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../workspace-repository';
import type { AdoptedGoalRevision } from '@/lib/domain/crop-water/proposal';

/**
 * L'adoption d'un objectif proposé (docs/crop-water-need-contract.md,
 * « Adopter la proposition », migration 0024) : une révision ordinaire de
 * l'objectif de la planche, ajoutée à l'historique sans rien effacer, que le
 * besoin, l'écart, la faisabilité et le planning lisent comme toute autre ;
 * seule son origine, « proposition adoptée », la distingue.
 */

export type StoredAdoption = { weekStart: string; amountMm: number; adoptedAt: string };

/** Enregistre la révision née d'une adoption, avec son origine. */
export async function saveAdoptedGoalForUser(
  ownerUserId: string,
  season: number,
  revision: AdoptedGoalRevision,
): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await db.prepare(
    `INSERT INTO irrigation_hydric_goal_revisions
       (id, workspace_id, season, week_start, scope_type, otf_zone_id, otf_plot_id, otf_bed_id,
        amount_mm, action, actor_user_id, created_at, origin)
     VALUES (?, ?, ?, ?, 'bed', ?, ?, ?, ?, 'set', ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), workspaceId, season, revision.weekStart,
    revision.otfZoneId, revision.otfPlotId, revision.otfBedId,
    revision.amountMm, ownerUserId, revision.createdAt, revision.origin,
  ).run();
}

/** Les adoptions d'une planche pour une saison, la plus récente d'abord. */
export async function listAdoptionsForBedForUser(ownerUserId: string, season: number, bedId: string): Promise<StoredAdoption[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  const result = await db.prepare(
    `SELECT week_start, amount_mm, created_at FROM irrigation_hydric_goal_revisions
     WHERE workspace_id = ? AND season = ? AND scope_type = 'bed' AND otf_bed_id = ? AND origin = 'adopted-proposal'
     ORDER BY created_at DESC, rowid DESC`,
  ).bind(workspaceId, season, bedId).all<{ week_start: string; amount_mm: number; created_at: string }>();
  return result.results.map((row) => ({ weekStart: row.week_start, amountMm: Number(row.amount_mm), adoptedAt: row.created_at }));
}
