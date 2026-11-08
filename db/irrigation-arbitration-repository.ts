import { db } from './binding';
import type { IrrigationArbitration } from '@/lib/domain/irrigation-feasibility';
import type { IrrigationNeedPriority } from '@/lib/domain/irrigation-needs';
import { ensureWorkspaceForUser } from './workspace-repository';

/** Replays acknowledge the original request without ever overwriting a newer decision. */
export async function wasIrrigationArbitrationSavedForUser(ownerUserId: string, input: {
  requestId: string; season: number; weekStart: string; priority: IrrigationNeedPriority; selectedBedIds: string[];
}) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const previous = await db.prepare("SELECT payload, season, week_start, priority FROM irrigation_arbitration_log WHERE workspace_id = ? AND request_id = ? AND action = 'selected'")
    .bind(workspaceId, input.requestId).first<{ payload: string; season: number; week_start: string; priority: string }>();
  if (!previous) return false;
  const saved = JSON.parse(previous.payload) as { selectedBedIds: string[] };
  if (previous.season !== input.season || previous.week_start !== input.weekStart || previous.priority !== input.priority
    || JSON.stringify(saved.selectedBedIds) !== JSON.stringify([...input.selectedBedIds].sort())) throw new Error('Cette requête a déjà été utilisée pour une autre décision.');
  return true;
}

export async function readFeasibilityRevisionForUser(ownerUserId: string) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const row = await db.prepare('SELECT feasibility_revision FROM irrigation_workspaces WHERE id = ?').bind(workspaceId).first<{ feasibility_revision: number }>();
  if (!row) throw new Error('Espace d’irrigation introuvable.');
  return Number(row.feasibility_revision);
}

export async function listIrrigationArbitrationsForUser(ownerUserId: string, season: number, weekStart: string): Promise<IrrigationArbitration[]> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const rows = await db.prepare('SELECT priority, selected_bed_ids, candidate_bed_ids, decided_at, invalidated_at FROM irrigation_arbitrations WHERE workspace_id = ? AND season = ? AND week_start = ?')
    .bind(workspaceId, season, weekStart).all<{ priority: IrrigationNeedPriority; selected_bed_ids: string; candidate_bed_ids: string; decided_at: string; invalidated_at: string | null }>();
  return rows.results.map((row) => ({ priority: row.priority, selectedBedIds: JSON.parse(row.selected_bed_ids), candidateBedIds: JSON.parse(row.candidate_bed_ids), decidedAt: row.decided_at, invalidatedAt: row.invalidated_at }));
}

export async function saveIrrigationArbitrationForUser(ownerUserId: string, input: {
  season: number; weekStart: string; priority: IrrigationNeedPriority; selectedBedIds: string[]; candidateBedIds: string[]; expectedRevision: number; requestId: string;
}) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const payload = JSON.stringify({ selectedBedIds: [...input.selectedBedIds].sort(), candidateBedIds: [...input.candidateBedIds].sort() });
  const previous = await db.prepare('SELECT payload, season, week_start, priority FROM irrigation_arbitration_log WHERE workspace_id = ? AND request_id = ?')
    .bind(workspaceId, input.requestId).first<{ payload: string; season: number; week_start: string; priority: string }>();
  if (previous) {
    if (previous.payload !== payload || previous.season !== input.season || previous.week_start !== input.weekStart || previous.priority !== input.priority) throw new Error('Cette requête a déjà été utilisée pour une autre décision.');
    return;
  }
  const now = new Date().toISOString();
  await db.batch([
    revisionGuard(workspaceId, input.expectedRevision),
    db.prepare(`INSERT INTO irrigation_arbitrations (workspace_id, season, week_start, priority, selected_bed_ids, candidate_bed_ids, actor_user_id, decided_at, invalidated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(workspace_id, season, week_start, priority) DO UPDATE SET selected_bed_ids=excluded.selected_bed_ids, candidate_bed_ids=excluded.candidate_bed_ids, actor_user_id=excluded.actor_user_id, decided_at=excluded.decided_at, invalidated_at=NULL`)
      .bind(workspaceId, input.season, input.weekStart, input.priority, JSON.stringify([...input.selectedBedIds].sort()), JSON.stringify([...input.candidateBedIds].sort()), ownerUserId, now),
    logStatement(workspaceId, ownerUserId, input.season, input.weekStart, input.priority, input.requestId, 'selected', payload, now),
  ]);
}

export async function invalidateIrrigationArbitrationsForUser(ownerUserId: string, season: number, weekStart: string, priorities: IrrigationNeedPriority[], expectedRevision: number) {
  if (!priorities.length) return;
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const now = new Date().toISOString();
  await db.batch([revisionGuard(workspaceId, expectedRevision), ...priorities.flatMap((priority) => [
    db.prepare('UPDATE irrigation_arbitrations SET invalidated_at = ? WHERE workspace_id = ? AND season = ? AND week_start = ? AND priority = ? AND invalidated_at IS NULL').bind(now, workspaceId, season, weekStart, priority),
    logStatement(workspaceId, ownerUserId, season, weekStart, priority, crypto.randomUUID(), 'invalidated', '{}', now),
  ])]);
}

function revisionGuard(workspaceId: string, expectedRevision: number) {
  // The database trigger aborts this whole batch if any source changed since validation.
  return db.prepare('UPDATE irrigation_workspaces SET feasibility_revision = ? WHERE id = ?').bind(expectedRevision + 1, workspaceId);
}
function logStatement(workspaceId: string, actor: string, season: number, week: string, priority: string, requestId: string, action: string, payload: string, now: string) {
  return db.prepare('INSERT INTO irrigation_arbitration_log (id, workspace_id, request_id, season, week_start, priority, action, payload, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), workspaceId, requestId, season, week, priority, action, payload, actor, now);
}
