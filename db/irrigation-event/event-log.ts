import { db } from '../binding';
import { type IrrigationEventStatus } from '@/lib/domain/irrigation-domain';

export function logStatement(
  eventId: string,
  actorUserId: string,
  action: 'created' | 'updated' | 'partially_completed' | 'completed' | 'canceled',
  payload: Record<string, unknown>,
) {
  return db.prepare(
    `INSERT INTO irrigation_event_log (id, event_id, actor_user_id, action, payload)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    eventId,
    actorUserId,
    action,
    JSON.stringify(payload),
  );
}

export function conditionalFinalizationLogStatement(
  eventId: string,
  actorUserId: string,
  action: 'partially_completed' | 'completed',
  payload: Record<string, unknown>,
  eventEquipmentId: string,
  status: IrrigationEventStatus,
  actualEndAt: string,
  updatedAt: string,
) {
  return db.prepare(
    `INSERT INTO irrigation_event_log
       (id, event_id, actor_user_id, action, payload)
     SELECT ?, ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM irrigation_event_equipment
       WHERE id = ? AND timer_state IS NULL AND status = ?
         AND actual_end_at = ? AND updated_at = ?
     )`,
  ).bind(
    crypto.randomUUID(),
    eventId,
    actorUserId,
    action,
    JSON.stringify(payload),
    eventEquipmentId,
    status,
    actualEndAt,
    updatedAt,
  );
}
