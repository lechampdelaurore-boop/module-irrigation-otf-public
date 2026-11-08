import { db } from './binding';
import type { PlanEventKind, PlanEventNotice } from '@/lib/domain/planning/contract';
import { ensureWorkspaceForUser } from './workspace-repository';

/**
 * Le registre des événements qui font recalculer le plan (3.7,
 * docs/replanning-contract.md, règles 4 à 8 ; docs/planning-contract.md,
 * « Le recalcul sur événement ») : le nom, l'heure et le sort du recalcul de
 * chacun, dans la semaine et la saison qu'il concerne. L'événement lui-même —
 * la pluie, l'irrigation, le refus — vit dans sa propre table et ne dépend
 * jamais de cette ligne. Aucun identifiant de personne.
 */

export async function recordPlanEventForUser(
  ownerUserId: string,
  input: { season: number; weekStart: string; kind: PlanEventKind; occurredAt: string },
): Promise<string> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO irrigation_plan_events (id, workspace_id, season, week_start, kind, occurred_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, workspaceId, input.season, input.weekStart, input.kind, input.occurredAt)
    .run();
  return id;
}

/** Le sort du recalcul : le calcul qu'il a produit, ou l'échec. Une ligne déjà réglée ne se règle pas deux fois. */
export async function settlePlanEvent(eventId: string, outcome: { calculationId: string } | { failed: true }, settledAt: string): Promise<void> {
  const statement = 'calculationId' in outcome
    ? db.prepare(`UPDATE irrigation_plan_events SET status = 'recalculated', calculation_id = ?, settled_at = ? WHERE id = ? AND status = 'pending'`)
      .bind(outcome.calculationId, settledAt, eventId)
    : db.prepare(`UPDATE irrigation_plan_events SET status = 'failed', settled_at = ? WHERE id = ? AND status = 'pending'`)
      .bind(settledAt, eventId);
  await statement.run();
}

/**
 * L'événement le plus récent enregistré après un instant — celui du dernier
 * calcul — dont le recalcul n'a pas abouti, en cours ou échoué. Un calcul
 * plus récent que l'événement, quel que soit son déclencheur, l'a pris en
 * compte : l'avis disparaît alors de lui-même.
 */
export async function readPendingPlanEvent(workspaceId: string, season: number, weekStart: string, since: string): Promise<PlanEventNotice | null> {
  const row = await db.prepare(`SELECT kind, occurred_at, status FROM irrigation_plan_events
    WHERE workspace_id = ? AND season = ? AND week_start = ? AND status IN ('pending', 'failed') AND occurred_at > ?
    ORDER BY occurred_at DESC, rowid DESC LIMIT 1`)
    .bind(workspaceId, season, weekStart, since)
    .first<{ kind: PlanEventKind; occurred_at: string; status: 'pending' | 'failed' }>();
  return row ? { kind: row.kind, occurredAt: row.occurred_at, status: row.status } : null;
}
