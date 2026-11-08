import { db } from '../binding';
import {
  MAX_SETTINGS_PER_EQUIPMENT,
  type EquipmentKind,
  type ValidEquipmentDraft,
} from '@/lib/domain/irrigation-domain';
import { copyEquipmentSettings } from '@/lib/domain/equipment-duplication';
import { EquipmentDuplicateKindMismatchError, EquipmentSettingsLimitError } from './errors';
import { assertEquipmentNameAvailable, findWorkspaceId } from './ownership';
import { listEquipmentForUser } from './read';

export type DuplicateEquipmentResult = {
  equipmentId: string;
  settingsCount: number;
};

export async function duplicateEquipmentForUser(
  ownerUserId: string,
  sourceEquipmentId: string,
  equipment: ValidEquipmentDraft,
): Promise<DuplicateEquipmentResult | null> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return null;

  const sourceOwnership = await db.prepare(
    `SELECT id, kind FROM irrigation_equipment
     WHERE id = ? AND workspace_id = ? LIMIT 1`,
  )
    .bind(sourceEquipmentId, workspaceId)
    .first<{ id: string; kind: EquipmentKind }>();
  if (!sourceOwnership) return null;
  if (sourceOwnership.kind !== equipment.kind) {
    throw new EquipmentDuplicateKindMismatchError();
  }

  const source = (await listEquipmentForUser(ownerUserId)).find(
    (item) => item.id === sourceEquipmentId,
  );
  if (!source) return null;
  const settingCopies = copyEquipmentSettings(source.settings);
  if (settingCopies.length > MAX_SETTINGS_PER_EQUIPMENT) {
    throw new EquipmentSettingsLimitError();
  }

  await assertEquipmentNameAvailable(workspaceId, equipment.name);
  const database = db;
  const duplicatedEquipmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `INSERT INTO irrigation_equipment (
           id, workspace_id, name, kind, mobility, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        duplicatedEquipmentId,
        workspaceId,
        equipment.name,
        equipment.kind,
        equipment.mobility,
        now,
      ),
  ];

  for (const copy of settingCopies) {
    const duplicatedSettingId = crypto.randomUUID();
    statements.push(
      database
        .prepare(
          `INSERT INTO irrigation_equipment_settings (
             id, equipment_id, name, position, updated_at
           ) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          duplicatedSettingId,
          duplicatedEquipmentId,
          copy.setting.name,
          copy.position,
          now,
        ),
    );

    if (copy.setting.kind === 'drip') {
      statements.push(
        database
          .prepare(
            `INSERT INTO drip_setting_rates (
               setting_id, rate_mm_per_hour, updated_at
             ) VALUES (?, ?, ?)`,
          )
          .bind(
            duplicatedSettingId,
            copy.setting.rateMmPerHour,
            now,
          ),
      );
      continue;
    }

    for (const [side, points] of [
      ['left', copy.setting.leftProfile],
      ['right', copy.setting.rightProfile],
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
              duplicatedSettingId,
              side,
              point.distanceMeters,
              point.rateMmPerHour,
              now,
            ),
        );
      }
    }
  }

  await database.batch(statements);
  return {
    equipmentId: duplicatedEquipmentId,
    settingsCount: settingCopies.length,
  };
}
