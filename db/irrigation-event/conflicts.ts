import { db } from '../binding';
import type { IrrigationPushScheduleRecord } from '@/lib/domain/irrigation-event-record';

export type IrrigationEventMutationResult = {
  /** L'irrigation créée ou modifiée : le planning (3.5) relie la proposition validée à son irrigation. */
  eventId: string;
  eventEquipmentId: string;
  overlapBedCount: number;
  scheduleConflictCount: number;
  pushSchedule: IrrigationPushScheduleRecord | null;
};

type IrrigationEventWarnings = Pick<
  IrrigationEventMutationResult,
  'overlapBedCount' | 'scheduleConflictCount'
>;

export async function findWarnings(
  workspaceId: string,
  equipmentId: string,
  bedIds: readonly string[],
  plannedStartAt: string | null,
  plannedEndAt: string | null,
  ignoredEventEquipmentId: string,
): Promise<IrrigationEventWarnings> {
  let scheduleConflictCount = 0;
  if (plannedStartAt && plannedEndAt) {
    const scheduleResult = await db.prepare(
      `SELECT COUNT(*) AS count
       FROM irrigation_event_equipment AS event_equipment
       INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
       WHERE event.workspace_id = ? AND event_equipment.equipment_id = ?
         AND event_equipment.id != ? AND event_equipment.status = 'planned'
         AND event_equipment.planned_start_at < ?
         AND event_equipment.planned_end_at > ?`,
    )
      .bind(
        workspaceId,
        equipmentId,
        ignoredEventEquipmentId,
        plannedEndAt,
        plannedStartAt,
      )
      .first<{ count: number }>();
    scheduleConflictCount = Number(scheduleResult?.count ?? 0);
  }

  if (bedIds.length === 0) {
    return { overlapBedCount: 0, scheduleConflictCount };
  }
  const placeholders = bedIds.map(() => '?').join(', ');
  const overlapResult = await db.prepare(
    `SELECT COUNT(DISTINCT application.otf_bed_id) AS count
     FROM irrigation_bed_applications AS application
     INNER JOIN irrigation_event_equipment AS event_equipment
       ON event_equipment.id = application.event_equipment_id
     INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
     WHERE event.workspace_id = ? AND event_equipment.id != ?
       AND event_equipment.timer_state IS NOT NULL
       AND application.otf_bed_id IN (${placeholders})`,
  )
    .bind(workspaceId, ignoredEventEquipmentId, ...bedIds)
    .first<{ count: number }>();

  return {
    overlapBedCount: Number(overlapResult?.count ?? 0),
    scheduleConflictCount,
  };
}

export async function listApplicationBedIds(eventEquipmentId: string) {
  const result = await db.prepare(
    `SELECT otf_bed_id FROM irrigation_bed_applications
     WHERE event_equipment_id = ?`,
  )
    .bind(eventEquipmentId)
    .all<{ otf_bed_id: string }>();
  return result.results.map((row) => row.otf_bed_id);
}
