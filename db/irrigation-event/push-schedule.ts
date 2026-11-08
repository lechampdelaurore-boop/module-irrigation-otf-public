import { db } from '../binding';
import type { EquipmentListItem, EquipmentSettingRecord } from '@/lib/domain/equipment-record';
import type {
  IrrigationPushAlarmStatus,
  IrrigationPushScheduleRecord,
} from '@/lib/domain/irrigation-event-record';
import { findMutableEventEquipment } from './ownership';
import { type MutableEventEquipmentRow, parseJson } from './rows';

export async function getIrrigationPushScheduleForUser(
  ownerUserId: string,
  eventEquipmentId: string,
): Promise<IrrigationPushScheduleRecord | null> {
  const row = await findMutableEventEquipment(ownerUserId, eventEquipmentId);
  return row ? pushScheduleFromRow(row, eventEquipmentId) : null;
}

export async function markIrrigationPushScheduleStatusForUser(
  ownerUserId: string,
  eventEquipmentId: string,
  revision: string,
  status: IrrigationPushAlarmStatus,
): Promise<void> {
  const nowIso = new Date().toISOString();
  await db.prepare(
    `UPDATE irrigation_event_equipment
     SET timer_alarm_status = ?, timer_alarm_synced_at = ?, updated_at = ?
     WHERE id = ? AND timer_alarm_revision = ?
       AND EXISTS (
         SELECT 1
         FROM irrigation_events AS event
         INNER JOIN irrigation_workspaces AS workspace
           ON workspace.id = event.workspace_id
         WHERE event.id = irrigation_event_equipment.event_id
           AND workspace.owner_user_id = ?
       )`,
  )
    .bind(status, nowIso, nowIso, eventEquipmentId, revision, ownerUserId)
    .run();
}

/**
 * Les alarmes de la ferme encore à venir et confiées au Worker de notification
 * (fin d'un minuteur ou retard d'une irrigation planifiée), pour les retirer
 * quand la case Arrosages est décochée (3.8, R1, P29).
 */
export async function listUpcomingPushAlarmsForUser(
  ownerUserId: string,
  now: Date,
): Promise<{ eventEquipmentId: string; revision: string }[]> {
  const result = await db.prepare(
    `SELECT event_equipment.id, event_equipment.timer_alarm_revision
     FROM irrigation_event_equipment AS event_equipment
     INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
     INNER JOIN irrigation_workspaces AS workspace ON workspace.id = event.workspace_id
     WHERE workspace.owner_user_id = ?
       AND event_equipment.timer_alarm_status IN ('pending', 'scheduled')
       AND event_equipment.timer_alarm_revision IS NOT NULL
       AND COALESCE(event_equipment.timer_theoretical_end_at, event_equipment.late_alarm_due_at) > ?
     ORDER BY event_equipment.id`,
  )
    .bind(ownerUserId, now.toISOString())
    .all<{ id: string; timer_alarm_revision: string }>();
  return result.results.map((row) => ({ eventEquipmentId: row.id, revision: row.timer_alarm_revision }));
}

/**
 * L'alarme que porte la ligne : la fin du minuteur quand il tourne, sinon le
 * retard d'une irrigation planifiée (3.7, règle 24) ; nulle sans révision.
 */
export function pushScheduleFromRow(
  row: MutableEventEquipmentRow,
  eventEquipmentId: string,
): IrrigationPushScheduleRecord | null {
  const dueAt = row.timer_theoretical_end_at ?? row.late_alarm_due_at;
  if (!dueAt || !row.timer_alarm_revision || !row.timer_alarm_status) {
    return null;
  }
  const equipment = parseJson<Pick<EquipmentListItem, 'name'>>(
    row.equipment_snapshot,
  );
  const setting = parseJson<Pick<EquipmentSettingRecord, 'name'>>(
    row.setting_snapshot,
  );
  return pushScheduleFromValues({
    workspaceId: row.workspace_id,
    eventEquipmentId,
    season: Number(row.season),
    kind: row.timer_theoretical_end_at ? 'finished' : 'late',
    revision: row.timer_alarm_revision,
    dueAt,
    status: row.timer_alarm_status,
    equipmentName: equipment.name,
    settingName: setting.name,
  });
}

export function pushScheduleFromValues(
  value: IrrigationPushScheduleRecord,
): IrrigationPushScheduleRecord {
  return value;
}

export function newPushAlarmRevision(now: Date) {
  return `${String(now.getTime()).padStart(13, '0')}-${crypto.randomUUID()}`;
}
