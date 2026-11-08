import { db } from './binding';
import type { IrrigationNeedDecision, IrrigationNeedPriority } from '@/lib/domain/irrigation-needs';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';

type DecisionRow = {
  otf_zone_id: string; otf_plot_id: string; otf_bed_id: string;
  priority: IrrigationNeedPriority; manual_override_mm: number | null;
  override_reason: string | null; calculated_need_at_override_mm: number | null; updated_at: string;
};

export async function readIrrigationNeedSettingsForUser(ownerUserId: string, season: number, weekStart: string) {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return { thresholdMm: 0, decisions: [] as IrrigationNeedDecision[] };
  const [preference, decisions] = await Promise.all([
    db.prepare('SELECT minimum_need_threshold_mm FROM irrigation_need_preferences WHERE workspace_id = ?').bind(workspaceId).first<{ minimum_need_threshold_mm: number }>(),
    db.prepare(`SELECT otf_zone_id, otf_plot_id, otf_bed_id, priority, manual_override_mm, override_reason, calculated_need_at_override_mm, updated_at
      FROM irrigation_bed_need_decisions WHERE workspace_id = ? AND season = ? AND week_start = ? ORDER BY otf_plot_id, otf_bed_id`)
      .bind(workspaceId, season, weekStart).all<DecisionRow>(),
  ]);
  return {
    thresholdMm: preference ? Number(preference.minimum_need_threshold_mm) : 0,
    decisions: decisions.results.map((row) => ({
      otfZoneId: row.otf_zone_id, otfPlotId: row.otf_plot_id, otfBedId: row.otf_bed_id,
      priority: row.priority, manualOverrideMm: row.manual_override_mm === null ? null : Number(row.manual_override_mm),
      overrideReason: row.override_reason,
      calculatedNeedAtOverrideMm: row.calculated_need_at_override_mm === null ? null : Number(row.calculated_need_at_override_mm),
      updatedAt: row.updated_at,
    })),
  };
}

export async function saveIrrigationNeedThresholdForUser(ownerUserId: string, season: number, weekStart: string, thresholdMm: number) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO irrigation_need_preferences (workspace_id, minimum_need_threshold_mm, actor_user_id, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(workspace_id) DO UPDATE SET minimum_need_threshold_mm = excluded.minimum_need_threshold_mm, actor_user_id = excluded.actor_user_id, updated_at = excluded.updated_at`)
      .bind(workspaceId, thresholdMm, ownerUserId, now),
    logStatement(workspaceId, ownerUserId, season, weekStart, null, 'threshold_set', { thresholdMm }, now),
  ]);
}

export async function saveIrrigationBedNeedDecisionForUser(ownerUserId: string, input: {
  season: number; weekStart: string; otfZoneId: string; otfPlotId: string; otfBedId: string;
  priority: IrrigationNeedPriority; manualOverrideMm: number | null; overrideReason: string | null;
  calculatedNeedAtOverrideMm: number | null;
}) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const now = new Date().toISOString();
  const existing = await db.prepare(`SELECT manual_override_mm FROM irrigation_bed_need_decisions WHERE workspace_id = ? AND season = ? AND week_start = ? AND otf_bed_id = ?`)
    .bind(workspaceId, input.season, input.weekStart, input.otfBedId).first<{ manual_override_mm: number | null }>();
  const action = input.manualOverrideMm === null
    ? existing == null || existing.manual_override_mm === null ? 'priority_set' : 'override_cleared'
    : 'override_set';
  await db.batch([
    db.prepare(`INSERT INTO irrigation_bed_need_decisions
      (id, workspace_id, season, week_start, otf_zone_id, otf_plot_id, otf_bed_id, priority, manual_override_mm, override_reason, calculated_need_at_override_mm, actor_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, season, week_start, otf_bed_id) DO UPDATE SET
      otf_zone_id=excluded.otf_zone_id, otf_plot_id=excluded.otf_plot_id, priority=excluded.priority,
      manual_override_mm=excluded.manual_override_mm, override_reason=excluded.override_reason,
      calculated_need_at_override_mm=excluded.calculated_need_at_override_mm, actor_user_id=excluded.actor_user_id, updated_at=excluded.updated_at`)
      .bind(crypto.randomUUID(), workspaceId, input.season, input.weekStart, input.otfZoneId, input.otfPlotId, input.otfBedId,
        input.priority, input.manualOverrideMm, input.overrideReason, input.calculatedNeedAtOverrideMm, ownerUserId, now, now),
    logStatement(workspaceId, ownerUserId, input.season, input.weekStart, input.otfBedId, action,
      { priority: input.priority, manualOverrideMm: input.manualOverrideMm, overrideReason: input.overrideReason, calculatedNeedAtOverrideMm: input.calculatedNeedAtOverrideMm }, now),
  ]);
}

function logStatement(workspaceId: string, actor: string, season: number, weekStart: string, bedId: string | null, action: string, payload: unknown, now: string) {
  return db.prepare(`INSERT INTO irrigation_need_decision_log (id, workspace_id, season, week_start, otf_bed_id, action, payload, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), workspaceId, season, weekStart, bedId, action, JSON.stringify(payload), actor, now);
}
