import { db } from '../binding';
import { hydraulicRevisionStatement, waterBudgetRevisionStatement } from '../workspace-repository';
import { isFinalizedIrrigationStatus, type IrrigationEventStatus } from '@/lib/domain/irrigation-domain';
import { IrrigationEventInputError, IrrigationEventNotFoundError, IrrigationEventStateError } from './errors';
import { conditionalFinalizationLogStatement, logStatement } from './event-log';
import { findMutableEventEquipment } from './ownership';
import { activeSecondsFromRow, resolveRequestedEndAt } from './rows';
import type { DoneAsPlannedRecord } from '@/lib/domain/done-as-planned';

export async function finishIrrigationEventForUser(
  ownerUserId: string,
  eventEquipmentId: string,
  requestedEndAt: string | null,
): Promise<IrrigationEventStatus> {
  const row = await findMutableEventEquipment(ownerUserId, eventEquipmentId);
  if (!row) throw new IrrigationEventNotFoundError();
  if (!row.timer_state || !row.timer_started_at) {
    if (isFinalizedIrrigationStatus(row.equipment_status)) {
      return row.equipment_status;
    }
    throw new IrrigationEventStateError('Cette irrigation n’est pas en cours.');
  }

  const now = new Date();
  const endAt = resolveRequestedEndAt(row, requestedEndAt, now);
  const actualSeconds = activeSecondsFromRow(row, endAt);
  if (actualSeconds <= 0) {
    throw new IrrigationEventInputError('La durée réelle doit être supérieure à zéro.');
  }
  const completed = actualSeconds >= row.planned_duration_seconds;
  const status: IrrigationEventStatus = completed
    ? 'completed'
    : 'partially_completed';
  const endIso = endAt.toISOString();
  const startIso = row.actual_start_at ?? row.timer_started_at;
  const nowIso = now.toISOString();
  const logAction = completed ? 'completed' : 'partially_completed';
  await db.batch([
    waterBudgetRevisionStatement(ownerUserId),
    hydraulicRevisionStatement(ownerUserId),
    db.prepare(
      `UPDATE irrigation_event_equipment
       SET status = ?, actual_start_at = ?, actual_end_at = ?,
           actual_duration_minutes = ?, actual_duration_seconds = ?,
           timer_state = NULL, timer_started_at = NULL, timer_resumed_at = NULL,
           timer_paused_at = NULL, timer_theoretical_end_at = NULL,
           timer_accumulated_seconds = 0, timer_alarm_revision = NULL,
           timer_alarm_status = NULL, timer_alarm_synced_at = NULL,
           updated_at = ?
       WHERE id = ? AND timer_state IS NOT NULL`,
    ).bind(
      status,
      startIso,
      endIso,
      Math.round(actualSeconds / 60),
      actualSeconds,
      nowIso,
      eventEquipmentId,
    ),
    db.prepare(
      `UPDATE irrigation_bed_applications
       SET actual_amount_mm = rate_mm_per_hour * (? / 3600.0), updated_at = ?
       WHERE event_equipment_id = ?
         AND EXISTS (
           SELECT 1 FROM irrigation_event_equipment
           WHERE id = ? AND timer_state IS NULL AND status = ?
             AND actual_end_at = ? AND updated_at = ?
         )`,
    ).bind(
      actualSeconds,
      nowIso,
      eventEquipmentId,
      eventEquipmentId,
      status,
      endIso,
      nowIso,
    ),
    db.prepare(
      `UPDATE irrigation_events
       SET status = ?, updated_at = ?
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM irrigation_event_equipment
           WHERE id = ? AND timer_state IS NULL AND status = ?
             AND actual_end_at = ? AND updated_at = ?
         )`,
    ).bind(
      status,
      nowIso,
      row.event_id,
      eventEquipmentId,
      status,
      endIso,
      nowIso,
    ),
    conditionalFinalizationLogStatement(
      row.event_id,
      ownerUserId,
      logAction,
      {
        eventEquipmentId,
        actualDurationSeconds: actualSeconds,
        actualEndAt: endIso,
      },
      eventEquipmentId,
      status,
      endIso,
      nowIso,
    ),
  ]);
  const current = await findMutableEventEquipment(ownerUserId, eventEquipmentId);
  if (current && isFinalizedIrrigationStatus(current.equipment_status)) {
    return current.equipment_status;
  }
  throw new IrrigationEventStateError(
    'Cette irrigation a changé sur un autre appareil. Actualisez la page.',
  );
}

export async function cancelPlannedIrrigationForUser(
  ownerUserId: string,
  eventEquipmentId: string,
): Promise<void> {
  const row = await findMutableEventEquipment(ownerUserId, eventEquipmentId);
  if (!row) throw new IrrigationEventNotFoundError();
  if (row.timer_state || row.equipment_status !== 'planned') {
    throw new IrrigationEventStateError('Cette irrigation ne peut pas être annulée.');
  }
  const nowIso = new Date().toISOString();
  await db.batch([
    waterBudgetRevisionStatement(ownerUserId),
    hydraulicRevisionStatement(ownerUserId),
    db.prepare(
      `UPDATE irrigation_event_equipment
       SET status = 'canceled', canceled_at = ?, timer_alarm_revision = NULL, timer_alarm_status = NULL,
           timer_alarm_synced_at = NULL, late_alarm_due_at = NULL, updated_at = ? WHERE id = ?`,
    ).bind(nowIso, nowIso, eventEquipmentId),
    db.prepare(
      `UPDATE irrigation_events
       SET status = 'canceled', canceled_at = ?, updated_at = ? WHERE id = ?`,
    ).bind(nowIso, nowIso, row.event_id),
    logStatement(row.event_id, ownerUserId, 'canceled', {
      eventEquipmentId,
      reason: 'user',
    }),
  ]);
}

export async function cancelRemainingIrrigationForUser(
  ownerUserId: string,
  eventEquipmentId: string,
): Promise<void> {
  const row = await findMutableEventEquipment(ownerUserId, eventEquipmentId);
  if (!row) throw new IrrigationEventNotFoundError();
  if (
    row.timer_state ||
    row.equipment_status !== 'partially_completed' ||
    row.remaining_canceled_at
  ) {
    throw new IrrigationEventStateError('Le reliquat de cette irrigation ne peut pas être annulé.');
  }
  const nowIso = new Date().toISOString();
  await db.batch([
    waterBudgetRevisionStatement(ownerUserId),
    hydraulicRevisionStatement(ownerUserId),
    db.prepare(
      `UPDATE irrigation_event_equipment
       SET remaining_canceled_at = ?, updated_at = ? WHERE id = ?`,
    ).bind(nowIso, nowIso, eventEquipmentId),
    db.prepare(
      `UPDATE irrigation_events
       SET remaining_canceled_at = ?, updated_at = ? WHERE id = ?`,
    ).bind(nowIso, nowIso, row.event_id),
    logStatement(row.event_id, ownerUserId, 'updated', {
      eventEquipmentId,
      timerAction: 'remaining_canceled',
    }),
  ]);
}

/**
 * « Fait comme prévu » (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.4) : une irrigation planifiée qui attend encore devient réalisée
 * telle que prévue. Ses heures et sa durée réelles sont les prévues, la dose
 * reçue de chaque planche sa dose prévue ; son matériel, son réglage, sa
 * position et sa pompe restent ceux qu'elle porte. Tout ou rien pour cette
 * irrigation : la base ne l'écrit que si elle la trouve encore planifiée, non
 * démarrée, aux heures et à la durée lues (`record.expected`) ; sinon rien
 * n'est écrit et l'appelant le dit. L'alerte « en retard » part avec elle.
 */
export async function recordDoneAsPlannedForUser(
  ownerUserId: string,
  record: DoneAsPlannedRecord,
): Promise<void> {
  const row = await findMutableEventEquipment(ownerUserId, record.eventEquipmentId);
  if (!row) throw new IrrigationEventNotFoundError();
  if (
    row.timer_state || row.timer_started_at || row.equipment_status !== 'planned'
    || row.event_status !== 'planned' || row.remaining_canceled_at
  ) {
    throw new IrrigationEventStateError('Cette irrigation a changé sur un autre appareil. Actualisez la page.');
  }
  const nowIso = new Date().toISOString();
  const { eventEquipmentId, actualStartAt, actualEndAt, actualDurationSeconds, expected } = record;
  /** L'irrigation telle que la ligne précédente l'a laissée : les suivantes n'agissent qu'après elle. */
  const recorded = `SELECT 1 FROM irrigation_event_equipment
    WHERE id = ? AND status = 'completed' AND timer_state IS NULL
      AND actual_end_at = ? AND updated_at = ?`;
  await db.batch([
    waterBudgetRevisionStatement(ownerUserId),
    hydraulicRevisionStatement(ownerUserId),
    db.prepare(
      `UPDATE irrigation_event_equipment
       SET status = 'completed', actual_start_at = ?, actual_end_at = ?,
           actual_duration_minutes = ?, actual_duration_seconds = ?,
           timer_alarm_revision = NULL, timer_alarm_status = NULL,
           timer_alarm_synced_at = NULL, late_alarm_due_at = NULL,
           updated_at = ?
       WHERE id = ? AND status = 'planned' AND timer_state IS NULL
         AND timer_started_at IS NULL AND remaining_canceled_at IS NULL
         AND planned_start_at = ? AND planned_end_at = ?
         AND planned_duration_seconds = ?`,
    ).bind(
      actualStartAt,
      actualEndAt,
      Math.round(actualDurationSeconds / 60),
      actualDurationSeconds,
      nowIso,
      eventEquipmentId,
      expected.plannedStartAt,
      expected.plannedEndAt,
      expected.plannedDurationSeconds,
    ),
    db.prepare(
      `UPDATE irrigation_bed_applications
       SET actual_amount_mm = planned_amount_mm, updated_at = ?
       WHERE event_equipment_id = ? AND EXISTS (${recorded})`,
    ).bind(nowIso, eventEquipmentId, eventEquipmentId, actualEndAt, nowIso),
    db.prepare(
      `UPDATE irrigation_events
       SET status = 'completed', updated_at = ?
       WHERE id = ? AND status = 'planned' AND EXISTS (${recorded})`,
    ).bind(nowIso, row.event_id, eventEquipmentId, actualEndAt, nowIso),
    conditionalFinalizationLogStatement(
      row.event_id,
      ownerUserId,
      'completed',
      { eventEquipmentId, actualDurationSeconds, actualEndAt, asPlanned: true },
      eventEquipmentId,
      'completed',
      actualEndAt,
      nowIso,
    ),
  ]);
  const current = await findMutableEventEquipment(ownerUserId, eventEquipmentId);
  if (current?.equipment_status === 'completed' && current.actual_end_at === actualEndAt) return;
  throw new IrrigationEventStateError('Cette irrigation a changé sur un autre appareil. Actualisez la page.');
}
