import { db } from '../binding';
import { readCurrentPose } from '../equipment-placement-poses';
import { IrrigationEquipmentAlreadyRunningError, IrrigationEventStateError } from './errors';
import { type MutableEventEquipmentRow, parseJson } from './rows';
import {
  plannedIrrigationStartBlock,
  plannedStartBlockMessage,
} from '@/lib/domain/equipment-placement-periods';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';

export async function findMutableEventEquipment(
  ownerUserId: string,
  eventEquipmentId: string,
): Promise<MutableEventEquipmentRow | null> {
  return db.prepare(
    `SELECT
       event.id AS event_id,
       event.workspace_id,
       event.season,
       event.status AS event_status,
       event_equipment.status AS equipment_status,
       event_equipment.equipment_id,
       event_equipment.planned_duration_seconds,
       event_equipment.actual_duration_seconds,
       event_equipment.actual_start_at,
       event_equipment.actual_end_at,
       event_equipment.timer_state,
       event_equipment.timer_started_at,
       event_equipment.timer_resumed_at,
       event_equipment.timer_paused_at,
       event_equipment.timer_accumulated_seconds,
       event_equipment.timer_theoretical_end_at,
       event_equipment.timer_alarm_revision,
       event_equipment.timer_alarm_status,
       event_equipment.late_alarm_due_at,
       event_equipment.equipment_snapshot,
       event_equipment.setting_snapshot,
       event_equipment.remaining_canceled_at
     FROM irrigation_event_equipment AS event_equipment
     INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
     INNER JOIN irrigation_workspaces AS workspace ON workspace.id = event.workspace_id
     WHERE event_equipment.id = ? AND workspace.owner_user_id = ? LIMIT 1`,
  )
    .bind(eventEquipmentId, ownerUserId)
    .first<MutableEventEquipmentRow>();
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

export async function assertEquipmentNotRunning(
  workspaceId: string,
  equipmentId: string,
  ignoredEventEquipmentId: string | null = null,
) {
  const row = await db.prepare(
    `SELECT event_equipment.id
     FROM irrigation_event_equipment AS event_equipment
     INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
     WHERE event.workspace_id = ? AND event_equipment.equipment_id = ?
       AND event_equipment.timer_state IS NOT NULL
       AND (? IS NULL OR event_equipment.id != ?)
     LIMIT 1`,
  )
    .bind(
      workspaceId,
      equipmentId,
      ignoredEventEquipmentId,
      ignoredEventEquipmentId,
    )
    .first<{ id: string }>();
  if (row) {
    throw new IrrigationEquipmentAlreadyRunningError();
  }
}

/**
 * Une irrigation planifiée ne démarre pas sur un matériel stocké, ni sur un
 * matériel reposé ailleurs que là où elle a été planifiée ; elle n'est jamais
 * supprimée pour autant : on l'annule, ou on repose le matériel au même
 * endroit (2.11, règle 13).
 */
export async function assertPlannedPlacementStillPosed(
  workspaceId: string,
  eventEquipmentId: string,
  row: Pick<MutableEventEquipmentRow, 'equipment_id' | 'season'>,
) {
  const event = await db.prepare(
    'SELECT placement_snapshot FROM irrigation_event_equipment WHERE id = ? LIMIT 1',
  )
    .bind(eventEquipmentId)
    .first<{ placement_snapshot: string }>();
  const planned = event
    ? parseJson<Partial<EquipmentPlacementRecord>>(event.placement_snapshot)
    : null;
  // Une copie sans ancrage ne dit pas où l'irrigation était prévue : rien ne
  // permet de juger, le démarrage reste possible comme avant la 2.11.
  if (!planned?.anchor) return;
  const current = await readCurrentPose(workspaceId, row.equipment_id, Number(row.season));
  const block = plannedIrrigationStartBlock(
    { anchor: planned.anchor, selectedBeds: planned.selectedBeds ?? [] },
    current,
  );
  if (block) throw new IrrigationEventStateError(plannedStartBlockMessage(block));
}
