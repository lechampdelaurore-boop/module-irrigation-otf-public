import { db } from '../binding';
import { aEcritUneLigne } from '../write-result';
import {
  MAX_SETTINGS_PER_EQUIPMENT,
  type EquipmentKind,
  type ValidEquipmentSettingInput,
} from '@/lib/domain/irrigation-domain';
import {
  EquipmentSettingKindMismatchError,
  EquipmentSettingNameAlreadyExistsError,
  EquipmentSettingsLimitError,
} from './errors';
import { findWorkspaceId } from './ownership';
import {
  decideProvenance,
  settingValuesOf,
  type SubmittedProvenance,
} from '@/lib/domain/irrigation-calculator/provenance';
import { provenanceStatements, readSettingStateForWorkspace } from './setting-calculations';

/** Un réglage enregistré sans rien dire de sa provenance, calculateur décoché (3.8 bis, section 10). */
const WITHOUT_CALCULATOR: SubmittedProvenance = { calculation: null, measured: null };

export type DeleteEquipmentSettingResult =
  | 'deleted'
  | 'has_history'
  | 'not_found';

export async function saveEquipmentSettingForUser(
  ownerUserId: string,
  equipmentId: string,
  settingId: string | null,
  setting: ValidEquipmentSettingInput,
  submittedProvenance: SubmittedProvenance = WITHOUT_CALCULATOR,
): Promise<string | null> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return null;

  const equipment = await db.prepare(
    `SELECT id, kind FROM irrigation_equipment
     WHERE id = ? AND workspace_id = ? AND status = 'active' LIMIT 1`,
  )
    .bind(equipmentId, workspaceId)
    .first<{ id: string; kind: EquipmentKind }>();
  if (!equipment) return null;
  if (equipment.kind !== setting.kind) {
    throw new EquipmentSettingKindMismatchError();
  }

  const existingResult = await db.prepare(
    `SELECT id, name, position FROM irrigation_equipment_settings
     WHERE equipment_id = ? ORDER BY position`,
  )
    .bind(equipmentId)
    .all<{ id: string; name: string; position: number }>();
  const existingSettings = existingResult.results;
  const editedSetting = settingId
    ? existingSettings.find((item) => item.id === settingId)
    : null;
  if (settingId && !editedSetting) return null;
  if (!settingId && existingSettings.length >= MAX_SETTINGS_PER_EQUIPMENT) {
    throw new EquipmentSettingsLimitError();
  }

  const duplicateName = existingSettings.some(
    (item) =>
      item.id !== settingId &&
      item.name.localeCompare(setting.name, 'fr-FR', {
        sensitivity: 'base',
      }) === 0,
  );
  if (duplicateName) {
    throw new EquipmentSettingNameAlreadyExistsError(setting.name);
  }

  // La provenance se décide sur les valeurs d'avant : retouchées à la main, elles redeviennent « saisies ».
  const previous = settingId ? await readSettingStateForWorkspace(workspaceId, settingId, equipment.kind) : null;
  const provenanceDecision = decideProvenance({
    submitted: submittedProvenance,
    values: settingValuesOf(setting),
    previous,
  });

  const savedSettingId = settingId ?? crypto.randomUUID();
  const position =
    editedSetting?.position ?? firstAvailableSettingPosition(existingSettings);
  const now = new Date().toISOString();
  const database = db;
  const statements: D1PreparedStatement[] = [];

  if (settingId) {
    statements.push(
      database
        .prepare(
          `UPDATE irrigation_equipment_settings
           SET name = ?, updated_at = ?
           WHERE id = ? AND equipment_id = ?`,
        )
        .bind(setting.name, now, savedSettingId, equipmentId),
    );
  } else {
    statements.push(
      database
        .prepare(
          `INSERT INTO irrigation_equipment_settings (
             id, equipment_id, name, position
           ) VALUES (?, ?, ?, ?)`,
        )
        .bind(savedSettingId, equipmentId, setting.name, position),
    );
  }

  statements.push(
    database
      .prepare('DELETE FROM sprinkler_profile_points WHERE setting_id = ?')
      .bind(savedSettingId),
    database
      .prepare('DELETE FROM drip_setting_rates WHERE setting_id = ?')
      .bind(savedSettingId),
  );

  if (setting.kind === 'drip') {
    statements.push(
      database
        .prepare(
          `INSERT INTO drip_setting_rates (
             setting_id, rate_mm_per_hour, updated_at
           ) VALUES (?, ?, ?)`,
        )
        .bind(savedSettingId, setting.rateMmPerHour, now),
    );
  } else {
    for (const [side, points] of [
      ['left', setting.leftProfile],
      ['right', setting.rightProfile],
    ] as const) {
      for (const point of points) {
        statements.push(
          database
            .prepare(
              `INSERT INTO sprinkler_profile_points (
                 id, setting_id, side, distance_meters, rate_mm_per_hour,
                 updated_at
               ) VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              crypto.randomUUID(),
              savedSettingId,
              side,
              point.distanceMeters,
              point.rateMmPerHour,
              now,
            ),
        );
      }
    }
  }

  statements.push(...provenanceStatements(provenanceDecision, workspaceId, savedSettingId, now));

  await database.batch(statements);
  return savedSettingId;
}

export async function deleteEquipmentSettingForUser(
  ownerUserId: string,
  equipmentId: string,
  settingId: string,
): Promise<DeleteEquipmentSettingResult> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return 'not_found';

  const setting = await db.prepare(
    `SELECT settings.id
     FROM irrigation_equipment_settings AS settings
     INNER JOIN irrigation_equipment AS equipment
       ON equipment.id = settings.equipment_id
     WHERE settings.id = ?
       AND settings.equipment_id = ?
       AND equipment.workspace_id = ?
     LIMIT 1`,
  )
    .bind(settingId, equipmentId, workspaceId)
    .first<{ id: string }>();
  if (!setting) return 'not_found';

  const historicalUse = await db.prepare(
    `SELECT event_equipment.id
     FROM irrigation_event_equipment AS event_equipment
     INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
     WHERE event_equipment.setting_id = ? AND event.workspace_id = ? LIMIT 1`,
  )
    .bind(settingId, workspaceId)
    .first<{ id: string }>();
  if (historicalUse) return 'has_history';

  const database = db;
  const results = await database.batch([
    database
      .prepare(
        `DELETE FROM irrigation_placement_selected_beds
         WHERE placement_id IN (
           SELECT id FROM irrigation_equipment_placements
           WHERE setting_id = ? AND workspace_id = ?
         )`,
      )
      .bind(settingId, workspaceId),
    database
      .prepare(
        `DELETE FROM irrigation_equipment_placements
         WHERE setting_id = ? AND workspace_id = ?`,
      )
      .bind(settingId, workspaceId),
    database
      .prepare('DELETE FROM sprinkler_profile_points WHERE setting_id = ?')
      .bind(settingId),
    database
      .prepare('DELETE FROM drip_setting_rates WHERE setting_id = ?')
      .bind(settingId),
    database
      .prepare('DELETE FROM irrigation_equipment_setting_calculations WHERE setting_id = ? AND workspace_id = ?')
      .bind(settingId, workspaceId),
    database
      .prepare(
        `DELETE FROM irrigation_equipment_settings
         WHERE id = ? AND equipment_id = ?`,
      )
      .bind(settingId, equipmentId),
  ]);

  return aEcritUneLigne(results.at(-1)?.meta) ? 'deleted' : 'not_found';
}

function firstAvailableSettingPosition(
  settings: readonly { position: number }[],
): number {
  const used = new Set(settings.map((setting) => Number(setting.position)));
  for (let position = 1; position <= MAX_SETTINGS_PER_EQUIPMENT; position += 1) {
    if (!used.has(position)) return position;
  }
  throw new EquipmentSettingsLimitError();
}
