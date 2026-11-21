import { db } from '../binding';
import { aEcritUneLigne } from '../write-result';
import { type EquipmentKind, type ValidEquipmentDraft } from '@/lib/domain/irrigation-domain';
import type { EquipmentStatus } from '@/lib/domain/equipment-record';
import { EquipmentKindLockedBySettingsError } from './errors';
import { assertEquipmentNameAvailable, ensureWorkspace, findWorkspaceId } from './ownership';
import { equipmentArchiveJournal, equipmentDeletionJournal, equipmentJournal } from '../change-journal/equipment';

export type DeleteEquipmentResult = 'deleted' | 'has_history' | 'not_found';

export async function createEquipmentForUser(
  ownerUserId: string,
  equipment: ValidEquipmentDraft,
): Promise<string> {
  const workspaceId = await ensureWorkspace(ownerUserId);
  await assertEquipmentNameAvailable(workspaceId, equipment.name);
  const equipmentId = crypto.randomUUID();
  // Le journal des modifications, après l'insertion : l'après lu sur la ligne écrite (amélioration n° 7, D-287).
  const journal = equipmentJournal('materiel', { workspaceId, actorUserId: ownerUserId, at: new Date().toISOString() }, equipmentId, equipment, false);

  await db.batch([
    db.prepare(
      `INSERT INTO irrigation_equipment (
         id, workspace_id, name, kind, mobility
       ) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        equipmentId,
        workspaceId,
        equipment.name,
        equipment.kind,
        equipment.mobility,
      ),
    ...journal.after,
  ]);

  return equipmentId;
}

export async function updateEquipmentForUser(
  ownerUserId: string,
  equipmentId: string,
  equipment: ValidEquipmentDraft,
): Promise<boolean> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return false;

  const current = await db.prepare(
    `SELECT equipment.kind, COUNT(settings.id) AS settings_count
     FROM irrigation_equipment AS equipment
     LEFT JOIN irrigation_equipment_settings AS settings
       ON settings.equipment_id = equipment.id
     WHERE equipment.id = ?
       AND equipment.workspace_id = ?
       AND equipment.status = 'active'
     GROUP BY equipment.id`,
  )
    .bind(equipmentId, workspaceId)
    .first<{ kind: EquipmentKind; settings_count: number }>();
  if (!current) return false;
  if (current.kind !== equipment.kind && Number(current.settings_count) > 0) {
    throw new EquipmentKindLockedBySettingsError();
  }

  await assertEquipmentNameAvailable(workspaceId, equipment.name, equipmentId);
  const now = new Date().toISOString();
  // Le journal des modifications d'abord, à la condition même de l'écriture : l'avant est la ligne active (amélioration n° 7, D-287).
  const journal = equipmentJournal('materiel', { workspaceId, actorUserId: ownerUserId, at: now }, equipmentId, equipment, true);
  const results = await db.batch([
    ...journal.before,
    db.prepare(
      `UPDATE irrigation_equipment
       SET name = ?, kind = ?, mobility = ?, updated_at = ?
       WHERE id = ?
         AND workspace_id = ?
         AND status = 'active'`,
    )
      .bind(
        equipment.name,
        equipment.kind,
        equipment.mobility,
        now,
        equipmentId,
        workspaceId,
      ),
  ]);

  return aEcritUneLigne(results.at(-1)?.meta);
}

export async function setEquipmentArchivedForUser(
  ownerUserId: string,
  equipmentId: string,
  archived: boolean,
): Promise<boolean> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return false;

  const now = new Date().toISOString();
  const status: EquipmentStatus = archived ? 'archived' : 'active';
  const results = await db.batch([
    // Le journal des modifications d'abord : rangé ou ressorti, rien si l'état ne change pas (amélioration n° 7, D-287).
    equipmentArchiveJournal('materiel', { workspaceId, actorUserId: ownerUserId, at: now }, equipmentId, archived),
    db.prepare(
      `UPDATE irrigation_equipment
       SET status = ?, archived_at = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
    )
      .bind(status, archived ? now : null, now, equipmentId, workspaceId),
  ]);

  return aEcritUneLigne(results.at(-1)?.meta);
}

export async function deleteEquipmentForUser(
  ownerUserId: string,
  equipmentId: string,
): Promise<DeleteEquipmentResult> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return 'not_found';

  const ownedEquipment = await db.prepare(
    `SELECT id FROM irrigation_equipment
     WHERE id = ? AND workspace_id = ? LIMIT 1`,
  )
    .bind(equipmentId, workspaceId)
    .first<{ id: string }>();
  if (!ownedEquipment) return 'not_found';

  const historicalUse = await db.prepare(
    `SELECT event_equipment.id
     FROM irrigation_event_equipment AS event_equipment
     INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
     WHERE event_equipment.equipment_id = ? AND event.workspace_id = ? LIMIT 1`,
  )
    .bind(equipmentId, workspaceId)
    .first<{ id: string }>();
  if (historicalUse) return 'has_history';

  const database = db;
  let results: D1Result[];
  try {
    results = await database.batch([
      // Le journal des modifications d'abord : l'avant du matériel effacé (amélioration n° 7, D-287).
      equipmentDeletionJournal('materiel', { workspaceId, actorUserId: ownerUserId, at: new Date().toISOString() }, equipmentId),
      // Le registre des poses ne s'efface qu'avec son matériel, quand
      // celui-ci n'a jamais arrosé (2.11, règle 8).
      database
        .prepare(
          `DELETE FROM irrigation_equipment_placement_history
           WHERE equipment_id = ? AND workspace_id = ?`,
        )
        .bind(equipmentId, workspaceId),
      database
        .prepare(
          `DELETE FROM irrigation_placement_selected_beds
           WHERE placement_id IN (
             SELECT id FROM irrigation_equipment_placements
             WHERE equipment_id = ? AND workspace_id = ?
           )`,
        )
        .bind(equipmentId, workspaceId),
      database
        .prepare(
          `DELETE FROM irrigation_equipment_placements
           WHERE equipment_id = ? AND workspace_id = ?`,
        )
        .bind(equipmentId, workspaceId),
      database
        .prepare(
          'DELETE FROM irrigation_equipment_settings WHERE equipment_id = ?',
        )
        .bind(equipmentId),
      database
        .prepare(
          'DELETE FROM irrigation_equipment WHERE id = ? AND workspace_id = ?',
        )
        .bind(equipmentId, workspaceId),
    ]);
  } catch (error) {
    const concurrentHistoricalUse = await db.prepare(
      `SELECT id FROM irrigation_event_equipment
       WHERE equipment_id = ? LIMIT 1`,
    )
      .bind(equipmentId)
      .first<{ id: string }>();
    if (concurrentHistoricalUse) return 'has_history';
    throw error;
  }

  return aEcritUneLigne(results.at(-1)?.meta) ? 'deleted' : 'not_found';
}
