import { db } from '../binding';
import { findWorkspaceIdForUser } from '../workspace-repository';
import {
  CHANGE_JOURNAL_PAGE_SIZE,
  knownFamilyAndSubject,
  parseChangeValues,
  type ChangeJournalCursor,
  type ChangeJournalEntry,
} from '@/lib/domain/change-journal/entry';
import type { ChangeAction, ChangeFamily } from '@/lib/domain/change-journal/subjects';

/**
 * La lecture du journal des modifications d'une ferme (amélioration n° 7,
 * §5.3 et §5.5 ; D-285). Toute lecture porte l'espace : une ferme ne lit
 * jamais le journal d'une autre (F709).
 */

type JournalRow = {
  id: string;
  family: string;
  subject: string;
  object_id: string | null;
  object_context: string | null;
  action: ChangeAction;
  before_values: string | null;
  after_values: string | null;
  actor_user_id: string;
  created_at: string;
  sequence: number;
};

export type ChangeJournalQuery = {
  /** Une seule famille, ou toutes. */
  family?: ChangeFamily | null;
  /** Reprendre après cette ligne : « Voir plus ». */
  after?: ChangeJournalCursor | null;
  limit?: number;
};

/** Les lignes de la ferme, de la plus récente à la plus ancienne ; aucune pour qui n'a pas d'espace. */
export async function listChangeJournalForUser(ownerUserId: string, query: ChangeJournalQuery = {}): Promise<ChangeJournalEntry[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  const limit = Math.max(1, Math.min(query.limit ?? CHANGE_JOURNAL_PAGE_SIZE, CHANGE_JOURNAL_PAGE_SIZE * 4));
  const conditions = ['workspace_id = ?'];
  const params: unknown[] = [workspaceId];
  if (query.family) {
    conditions.push('family = ?');
    params.push(query.family);
  }
  if (query.after) {
    // Départage par l'ordre d'écriture, comme les autres journaux (docs/revision-order-contract.md).
    conditions.push('(created_at < ? OR (created_at = ? AND rowid < ?))');
    params.push(query.after.createdAt, query.after.createdAt, query.after.sequence);
  }
  const result = await db.prepare(`SELECT id, family, subject, object_id, object_context, action, before_values, after_values,
      actor_user_id, created_at, rowid AS sequence
    FROM irrigation_change_journal WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC, rowid DESC LIMIT ?`)
    .bind(...params, limit).all<JournalRow>();
  return result.results.flatMap(entryOf);
}

/** Le nombre de lignes de la ferme, toutes familles. */
export async function countChangeJournalForUser(ownerUserId: string): Promise<number> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return 0;
  const row = await db.prepare('SELECT COUNT(*) AS lines FROM irrigation_change_journal WHERE workspace_id = ?')
    .bind(workspaceId).first<{ lines: number }>();
  return Number(row?.lines ?? 0);
}

function entryOf(row: JournalRow): ChangeJournalEntry[] {
  const known = knownFamilyAndSubject(row.family, row.subject);
  if (!known) return [];
  return [{
    id: row.id,
    family: known.family,
    subject: known.subject,
    objectId: row.object_id,
    context: parseChangeValues(row.object_context) ?? {},
    action: row.action,
    before: parseChangeValues(row.before_values),
    after: parseChangeValues(row.after_values),
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
    sequence: Number(row.sequence),
  }];
}
