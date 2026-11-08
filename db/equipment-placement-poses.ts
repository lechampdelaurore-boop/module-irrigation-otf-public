import { db } from './binding';
import type { PlacementBedInput } from '@/lib/domain/equipment-placement-domain';
import type {
  PlacementIrrigationUse,
  PlacementPose,
} from '@/lib/domain/equipment-placement-periods';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { PlacementAnchor } from '@/lib/domain/irrigation-domain';
import type { IrrigationTimerState } from '@/lib/domain/irrigation-timer';

/**
 * Lecture des poses du matériel et registre des poses fermées (sous-tranche
 * 2.11, docs/equipment-placement-periods-contract.md). Le dépôt des positions
 * (`equipment-placement-repository.ts`) écrit ; ce module lit les poses, et
 * prépare la copie d'une pose qui se ferme.
 */

/** Une pose fermée, lue dans le registre des poses, avec le nom du réglage qu'elle appliquait. */
export type ClosedPlacementPose = PlacementPose & {
  historyId: string;
  removedAt: string;
  settingName: string;
};

/** Ce que le registre garde d'une pose fermée : elle-même, et le nom de son réglage à la fermeture. */
type PoseSnapshot = PlacementPose & { settingName: string };

type PlacementRow = {
  id: string;
  equipment_id: string;
  setting_id: string;
  season: number;
  garden_group_id: string | null;
  otf_zone_id: string;
  otf_plot_id: string;
  anchor_type: 'bed_center' | 'between_beds';
  anchor_bed_otf_id: string | null;
  before_bed_otf_id: string | null;
  after_bed_otf_id: string | null;
  placed_at: string | null;
  removed_at: string | null;
};

type SelectedBedRow = {
  placement_id: string;
  otf_zone_id: string;
  otf_plot_id: string;
  otf_bed_id: string;
};

type CurrentPose = PlacementPose & { updatedAt: string; settingName: string };

const PLACEMENT_COLUMNS = `
  placement.id,
  placement.equipment_id,
  placement.setting_id,
  placement.season,
  placement.garden_group_id,
  placement.otf_zone_id,
  placement.otf_plot_id,
  placement.anchor_type,
  placement.anchor_bed_otf_id,
  placement.before_bed_otf_id,
  placement.after_bed_otf_id,
  placement.placed_at,
  placement.removed_at`;

/**
 * La pose courante est encore celle qui a été lue : ouverte, inchangée, et
 * sans irrigation en cours (règle 6). Liée à l'identifiant, à l'espace et à la
 * date de mise à jour lue.
 */
export const OPEN_POSE_UNCHANGED = `id = ? AND workspace_id = ? AND removed_at IS NULL AND updated_at = ?
  AND NOT EXISTS (
    SELECT 1 FROM irrigation_event_equipment AS running
    WHERE running.placement_id = irrigation_equipment_placements.id
      AND running.timer_state IS NOT NULL
  )`;

/** Les poses courantes d'une saison, posées ou stockées, avec leurs dates. */
export async function listEquipmentPosesForUser(
  ownerUserId: string,
  season: number,
): Promise<PlacementPose[]> {
  const [placementsResult, selectedBedsResult] = await Promise.all([
    db.prepare(
      `SELECT ${PLACEMENT_COLUMNS}
       FROM irrigation_equipment_placements AS placement
       INNER JOIN irrigation_workspaces AS workspace
         ON workspace.id = placement.workspace_id
       WHERE workspace.owner_user_id = ? AND placement.season = ?
       ORDER BY placement.created_at, placement.id`,
    )
      .bind(ownerUserId, season)
      .all<PlacementRow>(),
    db.prepare(
      `SELECT
         selected.placement_id,
         selected.otf_zone_id,
         selected.otf_plot_id,
         selected.otf_bed_id
       FROM irrigation_placement_selected_beds AS selected
       INNER JOIN irrigation_equipment_placements AS placement
         ON placement.id = selected.placement_id
       INNER JOIN irrigation_workspaces AS workspace
         ON workspace.id = placement.workspace_id
       WHERE workspace.owner_user_id = ? AND placement.season = ?
       ORDER BY selected.placement_id, selected.position`,
    )
      .bind(ownerUserId, season)
      .all<SelectedBedRow>(),
  ]);

  const selectedBedsByPlacement = groupSelectedBeds(selectedBedsResult.results);
  return placementsResult.results.flatMap((row) => {
    const pose = poseFromRow(row, selectedBedsByPlacement.get(row.id) ?? []);
    return pose ? [pose] : [];
  });
}

/** Les poses fermées d'une saison, de la plus récente à la plus ancienne. */
export async function listEquipmentPoseHistoryForUser(
  ownerUserId: string,
  season: number,
): Promise<ClosedPlacementPose[]> {
  const rows = await db.prepare(
    `SELECT history.id, history.placed_at, history.removed_at, history.pose_snapshot
     FROM irrigation_equipment_placement_history AS history
     INNER JOIN irrigation_workspaces AS workspace
       ON workspace.id = history.workspace_id
     WHERE workspace.owner_user_id = ? AND history.season = ?
     ORDER BY history.removed_at DESC, history.created_at DESC, history.id`,
  )
    .bind(ownerUserId, season)
    .all<{ id: string; placed_at: string | null; removed_at: string; pose_snapshot: string }>();

  return rows.results.map((row) => {
    const snapshot = JSON.parse(row.pose_snapshot) as PoseSnapshot;
    return {
      ...placementRecord(snapshot),
      historyId: row.id,
      placedAt: row.placed_at,
      removedAt: row.removed_at,
      settingName: snapshot.settingName,
    };
  });
}

/**
 * Les poses d'un matériel pour une saison : les poses fermées du registre,
 * puis la pose courante si elle est ouverte. Une pose courante stockée est
 * déjà au registre, copiée à son retrait : elle n'est pas comptée deux fois.
 * De quoi retrouver la pose ouverte à un instant (règle 12).
 */
export async function listPosesOfEquipment(
  workspaceId: string,
  equipmentId: string,
  season: number,
): Promise<PlacementPose[]> {
  const [current, history] = await Promise.all([
    readCurrentPose(workspaceId, equipmentId, season),
    db.prepare(
      `SELECT placed_at, removed_at, pose_snapshot
       FROM irrigation_equipment_placement_history
       WHERE workspace_id = ? AND equipment_id = ? AND season = ?
       ORDER BY removed_at, created_at, id`,
    )
      .bind(workspaceId, equipmentId, season)
      .all<{ placed_at: string | null; removed_at: string; pose_snapshot: string }>(),
  ]);
  const closed: PlacementPose[] = history.results.map((row) => ({
    ...placementRecord(JSON.parse(row.pose_snapshot) as PoseSnapshot),
    placedAt: row.placed_at,
    removedAt: row.removed_at,
  }));
  if (current === null || current.removedAt !== null) return closed;
  return [...closed, { ...placementRecord(current), placedAt: current.placedAt, removedAt: null }];
}

/** Copie au registre la pose qui se ferme, à la condition qu'elle soit encore celle qui a été lue. */
export function historyInsertStatement(
  workspaceId: string,
  current: CurrentPose,
  removedAt: string,
): D1PreparedStatement {
  const snapshot: PoseSnapshot = {
    ...placementRecord(current),
    placedAt: current.placedAt,
    removedAt,
    settingName: current.settingName,
  };
  return db.prepare(
    `INSERT INTO irrigation_equipment_placement_history (
       id, workspace_id, equipment_id, placement_id, season,
       placed_at, removed_at, pose_snapshot
     )
     SELECT ?, workspace_id, equipment_id, id, season, placed_at, ?, ?
     FROM irrigation_equipment_placements
     WHERE ${OPEN_POSE_UNCHANGED}`,
  ).bind(
    crypto.randomUUID(),
    removedAt,
    JSON.stringify(snapshot),
    current.id,
    workspaceId,
    current.updatedAt,
  );
}

export async function readCurrentPose(
  workspaceId: string,
  equipmentId: string,
  season: number,
): Promise<CurrentPose | null> {
  const row = await db.prepare(
    `SELECT ${PLACEMENT_COLUMNS}, placement.updated_at, setting.name AS setting_name
     FROM irrigation_equipment_placements AS placement
     INNER JOIN irrigation_equipment_settings AS setting
       ON setting.id = placement.setting_id
     WHERE placement.equipment_id = ? AND placement.season = ?
       AND placement.workspace_id = ?
     LIMIT 1`,
  )
    .bind(equipmentId, season, workspaceId)
    .first<PlacementRow & { updated_at: string; setting_name: string }>();
  if (!row) return null;

  const beds = await db.prepare(
    `SELECT placement_id, otf_zone_id, otf_plot_id, otf_bed_id
     FROM irrigation_placement_selected_beds
     WHERE placement_id = ?
     ORDER BY position`,
  )
    .bind(row.id)
    .all<SelectedBedRow>();
  const pose = poseFromRow(row, groupSelectedBeds(beds.results).get(row.id) ?? []);
  if (!pose) return null;
  return { ...pose, updatedAt: row.updated_at, settingName: row.setting_name };
}

/** Les irrigations enregistrées sur une ligne de position : leur fin réelle et leur minuteur. */
export async function readIrrigationUses(
  workspaceId: string,
  placementId: string,
): Promise<PlacementIrrigationUse[]> {
  const rows = await db.prepare(
    `SELECT event_equipment.placement_id, event_equipment.actual_end_at,
            event_equipment.timer_state
     FROM irrigation_event_equipment AS event_equipment
     INNER JOIN irrigation_events AS event
       ON event.id = event_equipment.event_id
     WHERE event.workspace_id = ? AND event_equipment.placement_id = ?`,
  )
    .bind(workspaceId, placementId)
    .all<{ placement_id: string; actual_end_at: string | null; timer_state: IrrigationTimerState | null }>();
  return rows.results.map((row) => ({
    equipment: {
      placementId: row.placement_id,
      actualEndAt: row.actual_end_at,
      timerState: row.timer_state,
    },
  }));
}

function groupSelectedBeds(rows: readonly SelectedBedRow[]) {
  const selectedBedsByPlacement = new Map<string, PlacementBedInput[]>();
  for (const row of rows) {
    const beds = selectedBedsByPlacement.get(row.placement_id) ?? [];
    beds.push({
      otfZoneId: row.otf_zone_id,
      otfPlotId: row.otf_plot_id,
      otfBedId: row.otf_bed_id,
    });
    selectedBedsByPlacement.set(row.placement_id, beds);
  }
  return selectedBedsByPlacement;
}

function poseFromRow(row: PlacementRow, selectedBeds: PlacementBedInput[]): PlacementPose | null {
  const anchor = placementAnchorFromRow(row);
  if (!anchor) return null;
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    settingId: row.setting_id,
    season: Number(row.season),
    gardenGroupId: row.garden_group_id,
    otfZoneId: row.otf_zone_id,
    otfPlotId: row.otf_plot_id,
    anchor,
    selectedBeds,
    placedAt: row.placed_at,
    removedAt: row.removed_at,
  };
}

/** La position seule, sans les dates de la pose. */
export function placementRecord(pose: EquipmentPlacementRecord): EquipmentPlacementRecord {
  return {
    id: pose.id,
    equipmentId: pose.equipmentId,
    settingId: pose.settingId,
    season: pose.season,
    gardenGroupId: pose.gardenGroupId,
    otfZoneId: pose.otfZoneId,
    otfPlotId: pose.otfPlotId,
    anchor: pose.anchor,
    selectedBeds: pose.selectedBeds,
  };
}

function placementAnchorFromRow(row: PlacementRow): PlacementAnchor | null {
  if (row.anchor_type === 'bed_center' && row.anchor_bed_otf_id) {
    return { type: 'bed_center', anchorBedOtfId: row.anchor_bed_otf_id };
  }
  if (
    row.anchor_type === 'between_beds' &&
    row.before_bed_otf_id &&
    row.after_bed_otf_id
  ) {
    return {
      type: 'between_beds',
      beforeBedOtfId: row.before_bed_otf_id,
      afterBedOtfId: row.after_bed_otf_id,
    };
  }
  return null;
}
