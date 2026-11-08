import { db } from '../binding';
import { type SprinklerProfilePoint } from '@/lib/domain/irrigation-domain';
import type { EquipmentListItem, EquipmentSettingRecord } from '@/lib/domain/equipment-record';
import type { DripRateRow, EquipmentRow, ProfilePointRow, SettingRow } from './rows';

export async function listEquipmentForUser(
  ownerUserId: string,
): Promise<EquipmentListItem[]> {
  const database = db;
  const [equipmentResult, settingResult, profileResult, dripRateResult] =
    await Promise.all([
      database
        .prepare(
          `SELECT
             equipment.id,
             equipment.name,
             equipment.kind,
             equipment.mobility,
             equipment.status,
             equipment.archived_at
           FROM irrigation_equipment AS equipment
           INNER JOIN irrigation_workspaces AS workspace
             ON workspace.id = equipment.workspace_id
           WHERE workspace.owner_user_id = ?
           ORDER BY
             CASE equipment.status WHEN 'active' THEN 0 ELSE 1 END,
             equipment.name COLLATE NOCASE`,
        )
        .bind(ownerUserId)
        .all<EquipmentRow>(),
      database
        .prepare(
          `SELECT
             settings.id,
             settings.equipment_id,
             settings.name,
             settings.position,
             equipment.kind
           FROM irrigation_equipment_settings AS settings
           INNER JOIN irrigation_equipment AS equipment
             ON equipment.id = settings.equipment_id
           INNER JOIN irrigation_workspaces AS workspace
             ON workspace.id = equipment.workspace_id
           WHERE workspace.owner_user_id = ?
           ORDER BY settings.equipment_id, settings.position`,
        )
        .bind(ownerUserId)
        .all<SettingRow>(),
      database
        .prepare(
          `SELECT
             points.setting_id,
             points.side,
             points.distance_meters,
             points.rate_mm_per_hour
           FROM sprinkler_profile_points AS points
           INNER JOIN irrigation_equipment_settings AS settings
             ON settings.id = points.setting_id
           INNER JOIN irrigation_equipment AS equipment
             ON equipment.id = settings.equipment_id
           INNER JOIN irrigation_workspaces AS workspace
             ON workspace.id = equipment.workspace_id
           WHERE workspace.owner_user_id = ?
           ORDER BY points.setting_id, points.side, points.distance_meters`,
        )
        .bind(ownerUserId)
        .all<ProfilePointRow>(),
      database
        .prepare(
          `SELECT rates.setting_id, rates.rate_mm_per_hour
           FROM drip_setting_rates AS rates
           INNER JOIN irrigation_equipment_settings AS settings
             ON settings.id = rates.setting_id
           INNER JOIN irrigation_equipment AS equipment
             ON equipment.id = settings.equipment_id
           INNER JOIN irrigation_workspaces AS workspace
             ON workspace.id = equipment.workspace_id
           WHERE workspace.owner_user_id = ?`,
        )
        .bind(ownerUserId)
        .all<DripRateRow>(),
    ]);

  const profilePoints = new Map<
    string,
    { left: SprinklerProfilePoint[]; right: SprinklerProfilePoint[] }
  >();
  for (const row of profileResult.results) {
    const profiles = profilePoints.get(row.setting_id) ?? {
      left: [],
      right: [],
    };
    profiles[row.side].push({
      distanceMeters: Number(row.distance_meters),
      rateMmPerHour: Number(row.rate_mm_per_hour),
    });
    profilePoints.set(row.setting_id, profiles);
  }

  const dripRates = new Map(
    dripRateResult.results.map((row) => [
      row.setting_id,
      Number(row.rate_mm_per_hour),
    ]),
  );
  const settingsByEquipment = new Map<string, EquipmentSettingRecord[]>();

  for (const row of settingResult.results) {
    const settings = settingsByEquipment.get(row.equipment_id) ?? [];
    if (row.kind === 'sprinkler') {
      const profiles = profilePoints.get(row.id) ?? { left: [], right: [] };
      settings.push({
        id: row.id,
        name: row.name,
        position: Number(row.position),
        kind: 'sprinkler',
        leftProfile: profiles.left,
        rightProfile: profiles.right,
      });
    } else {
      settings.push({
        id: row.id,
        name: row.name,
        position: Number(row.position),
        kind: 'drip',
        rateMmPerHour: dripRates.get(row.id) ?? 0,
      });
    }
    settingsByEquipment.set(row.equipment_id, settings);
  }

  return equipmentResult.results.map((row) => {
    const settings = settingsByEquipment.get(row.id) ?? [];
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      mobility: row.mobility,
      status: row.status,
      settingsCount: settings.length,
      settings,
      archivedAt: row.archived_at,
    };
  });
}
