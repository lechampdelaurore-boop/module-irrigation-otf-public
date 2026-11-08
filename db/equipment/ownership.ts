import { db } from '../binding';
import { EquipmentNameAlreadyExistsError } from './errors';

export async function ensureWorkspace(ownerUserId: string): Promise<string> {
  const existingId = await findWorkspaceId(ownerUserId);
  if (existingId) return existingId;

  const workspaceId = crypto.randomUUID();
  try {
    await db.prepare(
      'INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)',
    )
      .bind(workspaceId, ownerUserId)
      .run();
    return workspaceId;
  } catch (error) {
    const concurrentId = await findWorkspaceId(ownerUserId);
    if (concurrentId) return concurrentId;
    throw error;
  }
}

export async function findWorkspaceId(ownerUserId: string): Promise<string | null> {
  const row = await db.prepare(
    `SELECT id FROM irrigation_workspaces
     WHERE owner_user_id = ? AND otf_farm_id IS NULL LIMIT 1`,
  )
    .bind(ownerUserId)
    .first<{ id: string }>();

  return row?.id ?? null;
}

export async function assertEquipmentNameAvailable(
  workspaceId: string,
  name: string,
  ignoredEquipmentId?: string,
): Promise<void> {
  const row = await db.prepare(
    `SELECT id FROM irrigation_equipment
     WHERE workspace_id = ?
       AND lower(name) = lower(?)
       AND (? IS NULL OR id != ?)
     LIMIT 1`,
  )
    .bind(
      workspaceId,
      name,
      ignoredEquipmentId ?? null,
      ignoredEquipmentId ?? null,
    )
    .first<{ id: string }>();

  if (row) throw new EquipmentNameAlreadyExistsError(name);
}
