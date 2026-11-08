import { db } from './binding';
import {
  validateProtectedSlotDraft,
  WEEKDAYS,
  type ProtectedSlot,
  type ProtectedSlotChange,
  type ProtectedSlotDraft,
  type ProtectedSlotVersion,
  type Weekday,
} from '@/lib/domain/planning/protected-slots';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import { aEcritUneLigne } from './write-result';

/**
 * Le registre des créneaux protégés nommés (docs/protected-slots-contract.md,
 * règle 7 et section 5, migration 0030) : par exploitation, créés, modifiés
 * et supprimés par le maraîcher, chaque version gardée au journal avec ses
 * valeurs ; la suppression est logique. Le moteur relit les créneaux actifs à
 * chaque calcul (règle 8 : aucun recalcul de lui-même) ; aucun n'existe au
 * départ, et une exploitation qui n'en a pas se calcule comme avant.
 */

type SlotRow = Record<Weekday, number> & { id: string; name: string; start_minute: number; end_minute: number };
type LogRow = SlotRow & { change: ProtectedSlotChange; actor_user_id: string; created_at: string };

const DAY_COLUMNS = WEEKDAYS.join(', ');
const SLOT_COLUMNS = `id, name, ${DAY_COLUMNS}, start_minute, end_minute`;

export class ProtectedSlotInvalidError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Créneau protégé invalide : ${errors.join(' ')}`);
    this.name = 'ProtectedSlotInvalidError';
    this.errors = errors;
  }
}

export class ProtectedSlotNotFoundError extends Error {
  constructor() {
    super('Ce créneau protégé est introuvable ou déjà supprimé.');
    this.name = 'ProtectedSlotNotFoundError';
  }
}

/** Les créneaux actifs de l'exploitation, dans l'ordre de la journée puis du nom ; aucun pour qui n'a pas d'espace de travail. */
export async function listProtectedSlotsForUser(ownerUserId: string): Promise<ProtectedSlot[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  const result = await db.prepare(`SELECT ${SLOT_COLUMNS} FROM irrigation_protected_slots
    WHERE workspace_id = ? AND status = 'active' ORDER BY start_minute, name, created_at, rowid`)
    .bind(workspaceId).all<SlotRow>();
  return result.results.map(slotFromRow);
}

export async function createProtectedSlotForUser(ownerUserId: string, actorUserId: string, draft: ProtectedSlotDraft): Promise<ProtectedSlot> {
  const value = validOrThrow(draft);
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO irrigation_protected_slots
      (id, workspace_id, name, ${DAY_COLUMNS}, start_minute, end_minute, status, actor_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ${WEEKDAYS.map(() => '?').join(', ')}, ?, ?, 'active', ?, ?, ?)`)
      .bind(id, workspaceId, value.name, ...dayFlags(value.weekdays), value.startMinute, value.endMinute, actorUserId, now, now),
    logVersion('created', { id, workspaceId, actorUserId, at: now }),
  ]);
  return { id, ...value };
}

/** Modifie un créneau actif de l'exploitation ; le journal garde la nouvelle version. */
export async function updateProtectedSlotForUser(ownerUserId: string, actorUserId: string, slotId: string, draft: ProtectedSlotDraft): Promise<ProtectedSlot> {
  const value = validOrThrow(draft);
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) throw new ProtectedSlotNotFoundError();
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare(`UPDATE irrigation_protected_slots
      SET name = ?, ${WEEKDAYS.map((day) => `${day} = ?`).join(', ')}, start_minute = ?, end_minute = ?, actor_user_id = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ? AND status = 'active'`)
      .bind(value.name, ...dayFlags(value.weekdays), value.startMinute, value.endMinute, actorUserId, now, slotId, workspaceId),
    logVersion('updated', { id: slotId, workspaceId, actorUserId, at: now }),
  ]);
  if (!aEcritUneLigne(results[0]?.meta)) throw new ProtectedSlotNotFoundError();
  return { id: slotId, ...value };
}

/** Supprime un créneau actif, logiquement : la ligne reste, marquée supprimée, et le journal le dit. */
export async function deleteProtectedSlotForUser(ownerUserId: string, actorUserId: string, slotId: string): Promise<void> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) throw new ProtectedSlotNotFoundError();
  const now = new Date().toISOString();
  const results = await db.batch([
    // Le journal d'abord, à la condition même du geste : la ligne encore active (voir `logVersion`).
    logVersion('deleted', { id: slotId, workspaceId, actorUserId, at: now }),
    db.prepare(`UPDATE irrigation_protected_slots SET status = 'deleted', actor_user_id = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ? AND status = 'active'`)
      .bind(actorUserId, now, slotId, workspaceId),
  ]);
  if (!aEcritUneLigne(results[1]?.meta)) throw new ProtectedSlotNotFoundError();
}

/** Le journal de l'exploitation, du plus récent au plus ancien. */
export async function listProtectedSlotHistoryForUser(ownerUserId: string): Promise<ProtectedSlotVersion[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  // Départage par rowid, l'ordre d'insertion : l'identifiant est tiré au sort (docs/revision-order-contract.md).
  const result = await db.prepare(`SELECT slot_id AS id, change, name, ${DAY_COLUMNS}, start_minute, end_minute, actor_user_id, created_at
    FROM irrigation_protected_slots_log WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC`)
    .bind(workspaceId).all<LogRow>();
  return result.results.map((row) => ({ ...slotFromRow(row), change: row.change, actorUserId: row.actor_user_id, createdAt: row.created_at }));
}

function validOrThrow(draft: ProtectedSlotDraft): Omit<ProtectedSlot, 'id'> {
  const validation = validateProtectedSlotDraft(draft);
  if (validation.value === null) throw new ProtectedSlotInvalidError(validation.errors);
  return validation.value;
}

function dayFlags(weekdays: readonly Weekday[]): number[] {
  return WEEKDAYS.map((day) => (weekdays.includes(day) ? 1 : 0));
}

/**
 * La version du journal, dans le même lot que le geste et à ses conditions
 * mêmes, pour qu'elle s'écrive si et seulement si le geste s'écrit : rien
 * pour un créneau d'une autre exploitation ou déjà supprimé (S15).
 * Création et modification : après le geste, la ligne qu'il vient d'écrire,
 * active, à son instant ; une création a un identifiant neuf, et une
 * modification ne touche qu'une ligne active. Suppression : avant le geste,
 * la ligne encore active qu'il va marquer supprimée, valeurs inchangées.
 * Relue après coup, d'après son seul instant, une suppression refusée dans la
 * même milliseconde que la précédente recopiait la ligne déjà supprimée :
 * la CI de `main` l'a montré le 8 novembre 2026.
 */
function logVersion(change: ProtectedSlotChange, at: { id: string; workspaceId: string; actorUserId: string; at: string }) {
  const before = change === 'deleted';
  const statement = db.prepare(`INSERT INTO irrigation_protected_slots_log
    (id, slot_id, workspace_id, change, name, ${DAY_COLUMNS}, start_minute, end_minute, actor_user_id, created_at)
    SELECT ?, id, workspace_id, ?, name, ${DAY_COLUMNS}, start_minute, end_minute, ?, ?
    FROM irrigation_protected_slots WHERE id = ? AND workspace_id = ? AND status = 'active'${before ? '' : ' AND updated_at = ?'}`);
  const values = [crypto.randomUUID(), change, at.actorUserId, at.at, at.id, at.workspaceId];
  return before ? statement.bind(...values) : statement.bind(...values, at.at);
}

function slotFromRow(row: SlotRow): ProtectedSlot {
  return { id: row.id, name: row.name, weekdays: WEEKDAYS.filter((day) => row[day] === 1), startMinute: row.start_minute, endMinute: row.end_minute };
}
