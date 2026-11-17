import { db } from '../binding';
import { EquipmentNameAlreadyExistsError } from './errors';

// L'espace se retrouve en un seul endroit, par la personne et la ferme
// ensemble (docs/tranche-4-contract.md, section 5 bis, F328).
export { ensureWorkspaceForUser as ensureWorkspace, findWorkspaceIdForUser as findWorkspaceId } from '../workspace-repository';

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
