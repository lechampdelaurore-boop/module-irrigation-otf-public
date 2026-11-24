import { db } from '../binding';
import { WORKSPACE_SPACE_FILTER, spaceParams } from '../workspace-scope';
import type { EquipmentListItem, EquipmentSettingRecord } from '@/lib/domain/equipment-record';
import type {
  IrrigationPushAlarmStatus,
  IrrigationPushScheduleRecord,
} from '@/lib/domain/irrigation-event-record';
import { MAXIMUM_QUIET_HOLD_MINUTES } from '@/lib/domain/notification-quiet-hours';
import { millisecondsFromMinutes, MINUTES_PER_HOUR } from '@/lib/domain/units';
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
           AND ${WORKSPACE_SPACE_FILTER}
       )`,
  )
    .bind(status, nowIso, nowIso, eventEquipmentId, revision, ...spaceParams(ownerUserId))
    .run();
}

/**
 * Le retard d'une irrigation planifiée peut être retenu par les heures de
 * silence jusqu'à la fin de la plage (H2) : treize heures de l'horloge de
 * Paris au plus, quatorze heures réelles la nuit du passage à l'heure
 * d'hiver. La base garde son échéance d'origine ; le Worker, la fin de la
 * plage.
 */
const QUIET_HELD_LATE_ALARM_MS = millisecondsFromMinutes(MAXIMUM_QUIET_HOLD_MINUTES + MINUTES_PER_HOUR);

/** Une alarme confiée au Worker, avec son échéance d'origine et sa nature. */
export type UpcomingPushAlarm = { eventEquipmentId: string; revision: string; dueAt: string; kind: 'finished' | 'late' };

/**
 * Les alarmes de la ferme encore à venir et confiées au Worker de notification
 * (fin d'un minuteur ou retard d'une irrigation planifiée), pour les retirer
 * quand la case Arrosages est décochée (3.8, R1, P29). Avec elles, les retards
 * dont l'échéance est passée depuis moins que la plus longue retenue : les
 * heures de silence peuvent les garder jusqu'à la fin de la plage (H2), et
 * c'est le service qui trie ceux qui attendent encore.
 */
export async function listUpcomingPushAlarmsForUser(
  ownerUserId: string,
  now: Date,
): Promise<UpcomingPushAlarm[]> {
  const result = await db.prepare(
    `SELECT event_equipment.id, event_equipment.timer_alarm_revision,
            event_equipment.timer_theoretical_end_at, event_equipment.late_alarm_due_at
     FROM irrigation_event_equipment AS event_equipment
     INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
     INNER JOIN irrigation_workspaces AS workspace ON workspace.id = event.workspace_id
     WHERE ${WORKSPACE_SPACE_FILTER}
       AND event_equipment.timer_alarm_status IN ('pending', 'scheduled')
       AND event_equipment.timer_alarm_revision IS NOT NULL
       AND (event_equipment.timer_theoretical_end_at > ?
            OR (event_equipment.timer_theoretical_end_at IS NULL AND event_equipment.late_alarm_due_at > ?))
     ORDER BY event_equipment.id`,
  )
    .bind(...spaceParams(ownerUserId), now.toISOString(), new Date(now.getTime() - QUIET_HELD_LATE_ALARM_MS).toISOString())
    .all<{ id: string; timer_alarm_revision: string; timer_theoretical_end_at: string | null; late_alarm_due_at: string }>();
  return result.results.map((row) => ({
    eventEquipmentId: row.id,
    revision: row.timer_alarm_revision,
    dueAt: row.timer_theoretical_end_at ?? row.late_alarm_due_at,
    kind: row.timer_theoretical_end_at === null ? 'late' : 'finished',
  }));
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
