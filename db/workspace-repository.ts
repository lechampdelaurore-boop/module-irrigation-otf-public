import { db } from './binding';
import { farmSpaceKey, farmSpaceOf, InvalidFarmSpaceError } from '@/lib/domain/farm-space';
import { SPACE_FILTER, spaceKeyOfRow, spaceParams } from './workspace-scope';

export async function findWorkspaceIdForUser(ownerUserId: string): Promise<string | null> {
  const row = await db.prepare(
    `SELECT id FROM irrigation_workspaces
     WHERE ${SPACE_FILTER} LIMIT 1`,
  )
    .bind(...spaceParams(ownerUserId))
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function ensureWorkspaceForUser(ownerUserId: string): Promise<string> {
  const existing = await findWorkspaceIdForUser(ownerUserId);
  if (existing) return existing;
  const workspaceId = crypto.randomUUID();
  try {
    await db.prepare(
      `INSERT INTO irrigation_workspaces (id, owner_user_id, otf_farm_id) VALUES (?, ?, ?)`,
    ).bind(workspaceId, ...spaceParams(ownerUserId)).run();
    return workspaceId;
  } catch {
    const concurrent = await findWorkspaceIdForUser(ownerUserId);
    if (concurrent) return concurrent;
    throw new Error('Impossible de créer l’espace d’irrigation.');
  }
}

/**
 * Crée l'espace s'il n'existe pas encore, et dit si c'est cet appel qui l'a
 * créé : deux requêtes simultanées ne le créent qu'une fois, et une seule
 * apprend qu'elle l'a fait (les index uniques des espaces, avec ou sans ferme).
 */
export async function createWorkspaceIfAbsent(ownerUserId: string): Promise<boolean> {
  const result = await db.prepare(
    `INSERT INTO irrigation_workspaces (id, owner_user_id, otf_farm_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
  ).bind(crypto.randomUUID(), ...spaceParams(ownerUserId)).run();
  return Number(result.meta.changes ?? 0) === 1;
}

/**
 * Le rattachement de l'espace d'avant la 4.1 (docs/tranche-4-contract.md,
 * F331, F340) : l'espace sans ferme de cette personne reçoit cette ferme, par
 * une seule écriture, sans copie ni suppression. Si la personne a déjà un
 * espace pour cette ferme, rien n'est écrit : l'index unique de la personne
 * et de la ferme l'interdit, et l'espace sans ferme reste gardé à part. Dit
 * si c'est cet appel qui a rattaché l'espace.
 */
export async function attachPendingWorkspace(personKey: string, otfFarmId: string): Promise<boolean> {
  if (farmSpaceOf(personKey).otfFarmId !== null) {
    throw new InvalidFarmSpaceError('Le rattachement part de l’espace sans ferme d’une personne.');
  }
  // Une ferme mal formée est refusée avant toute écriture (F327).
  farmSpaceKey(personKey, otfFarmId);
  const result = await db.prepare(
    `UPDATE OR IGNORE irrigation_workspaces SET otf_farm_id = ?, updated_at = ? WHERE ${SPACE_FILTER}`,
  ).bind(otfFarmId, new Date().toISOString(), ...spaceParams(personKey)).run();
  return Number(result.meta.changes ?? 0) === 1;
}

export async function readWaterBudgetRevisionForUser(ownerUserId: string): Promise<number> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const row = await db.prepare(
    'SELECT water_budget_revision FROM irrigation_workspaces WHERE id = ?',
  ).bind(workspaceId).first<{ water_budget_revision: number }>();
  if (!row) throw new Error('Espace d’irrigation introuvable.');
  return Number(row.water_budget_revision);
}

/** First statement of the same D1 batch as the mutation: stale checks roll back. */
export function waterBudgetRevisionStatement(ownerUserId: string, expectedRevision?: number) {
  return expectedRevision === undefined
    ? db.prepare(
        `UPDATE irrigation_workspaces SET water_budget_revision = water_budget_revision + 1 WHERE ${SPACE_FILTER}`,
      ).bind(...spaceParams(ownerUserId))
    : db.prepare(
        `UPDATE irrigation_workspaces SET water_budget_revision = ? WHERE ${SPACE_FILTER}`,
      ).bind(expectedRevision + 1, ...spaceParams(ownerUserId));
}

export async function readHydraulicRevisionForUser(ownerUserId: string): Promise<number> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const row = await db.prepare(
    'SELECT hydraulic_revision FROM irrigation_workspaces WHERE id = ?',
  ).bind(workspaceId).first<{ hydraulic_revision: number }>();
  if (!row) throw new Error('Espace d’irrigation introuvable.');
  return Number(row.hydraulic_revision);
}

/** Placed in the same D1 batch as a validated hydraulic mutation. */
export function hydraulicRevisionStatement(ownerUserId: string, expectedRevision?: number) {
  return expectedRevision === undefined
    ? db.prepare(
        `UPDATE irrigation_workspaces SET hydraulic_revision = hydraulic_revision + 1 WHERE ${SPACE_FILTER}`,
      ).bind(...spaceParams(ownerUserId))
    : db.prepare(
        `UPDATE irrigation_workspaces SET hydraulic_revision = ? WHERE ${SPACE_FILTER}`,
      ).bind(expectedRevision + 1, ...spaceParams(ownerUserId));
}

/** Les clés de tous les espaces, avec ou sans ferme, pour le recalcul quotidien du planning (3.5, R1 ; 4.2, F328). */
export async function listWorkspaceOwnerIds(): Promise<string[]> {
  const result = await db.prepare('SELECT owner_user_id, otf_farm_id FROM irrigation_workspaces ORDER BY owner_user_id, otf_farm_id')
    .all<{ owner_user_id: string; otf_farm_id: string | null }>();
  return result.results.map(spaceKeyOfRow);
}
