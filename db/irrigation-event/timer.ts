import { db } from '../binding';
import { hydraulicRevisionStatement, waterBudgetRevisionStatement } from '../workspace-repository';
import { timerTheoreticalEndAt } from '@/lib/domain/irrigation-timer';
import { type IrrigationEventMutationResult, findWarnings, listApplicationBedIds } from './conflicts';
import { IrrigationEventNotFoundError, IrrigationEventStateError } from './errors';
import { logStatement } from './event-log';
import {
  assertEquipmentNotRunning,
  assertPlannedPlacementStillPosed,
  findMutableEventEquipment,
  findWorkspaceId,
} from './ownership';
import { newPushAlarmRevision, pushScheduleFromRow } from './push-schedule';
import { activeSecondsFromRow, nonNegativeInteger } from './rows';

export async function startIrrigationEventForUser(
  ownerUserId: string,
  eventEquipmentId: string,
  waterBudgetRevision?: number,
  hydraulicRevision?: number,
): Promise<IrrigationEventMutationResult> {
  const row = await findMutableEventEquipment(ownerUserId, eventEquipmentId);
  if (!row) throw new IrrigationEventNotFoundError();
  if (
    row.timer_state ||
    row.equipment_status === 'completed' ||
    row.equipment_status === 'canceled' ||
    row.remaining_canceled_at
  ) {
    throw new IrrigationEventStateError('Cette irrigation ne peut pas être démarrée.');
  }
  if (row.planned_duration_seconds <= row.actual_duration_seconds) {
    throw new IrrigationEventStateError('Cette irrigation est déjà entièrement réalisée.');
  }

  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) throw new IrrigationEventNotFoundError();
  await assertEquipmentNotRunning(workspaceId, row.equipment_id, eventEquipmentId);
  await assertPlannedPlacementStillPosed(workspaceId, eventEquipmentId, row);

  const now = new Date();
  const nowIso = now.toISOString();
  const accumulated = nonNegativeInteger(row.actual_duration_seconds);
  const timerStartedAt = row.actual_start_at ?? nowIso;
  const timerEndAt = timerTheoreticalEndAt(
    row.planned_duration_seconds,
    accumulated,
    now,
  );
  const timerAlarmRevision = newPushAlarmRevision(now);
  await db.batch([
    waterBudgetRevisionStatement(ownerUserId, waterBudgetRevision),
    hydraulicRevisionStatement(ownerUserId, hydraulicRevision),
    db.prepare(
      `UPDATE irrigation_event_equipment
       SET timer_state = 'running', timer_started_at = ?, timer_resumed_at = ?,
           timer_paused_at = NULL, timer_theoretical_end_at = ?,
           timer_accumulated_seconds = ?, timer_alarm_revision = ?,
           timer_alarm_status = 'pending', timer_alarm_synced_at = NULL,
           late_alarm_due_at = NULL, updated_at = ?
       WHERE id = ? AND timer_state IS NULL`,
    ).bind(
      timerStartedAt,
      nowIso,
      timerEndAt,
      accumulated,
      timerAlarmRevision,
      nowIso,
      eventEquipmentId,
    ),
    logStatement(row.event_id, ownerUserId, 'updated', {
      timerAction: 'started',
      eventEquipmentId,
    }),
  ]);

  const bedIds = await listApplicationBedIds(eventEquipmentId);
  const warnings = await findWarnings(
    workspaceId,
    row.equipment_id,
    bedIds,
    nowIso,
    timerEndAt,
    eventEquipmentId,
  );
  return {
    ...warnings,
    eventId: row.event_id,
    eventEquipmentId,
    pushSchedule: pushScheduleFromRow(
      {
        ...row,
        timer_theoretical_end_at: timerEndAt,
        timer_alarm_revision: timerAlarmRevision,
        timer_alarm_status: 'pending',
      },
      eventEquipmentId,
    ),
  };
}

export async function pauseIrrigationEventForUser(
  ownerUserId: string,
  eventEquipmentId: string,
): Promise<void> {
  const row = await findMutableEventEquipment(ownerUserId, eventEquipmentId);
  if (!row) throw new IrrigationEventNotFoundError();
  if (row.timer_state !== 'running') {
    throw new IrrigationEventStateError('Cette irrigation n’est pas en cours.');
  }
  const now = new Date();
  const accumulated = activeSecondsFromRow(row, now);
  const nowIso = now.toISOString();
  await db.batch([
    waterBudgetRevisionStatement(ownerUserId),
    hydraulicRevisionStatement(ownerUserId),
    db.prepare(
      `UPDATE irrigation_event_equipment
       SET timer_state = 'paused', timer_resumed_at = NULL, timer_paused_at = ?,
           timer_theoretical_end_at = NULL, timer_accumulated_seconds = ?,
           timer_alarm_revision = NULL, timer_alarm_status = NULL,
           timer_alarm_synced_at = NULL, updated_at = ?
       WHERE id = ? AND timer_state = 'running'`,
    ).bind(nowIso, accumulated, nowIso, eventEquipmentId),
    logStatement(row.event_id, ownerUserId, 'updated', {
      timerAction: 'paused',
      eventEquipmentId,
      accumulatedSeconds: accumulated,
    }),
  ]);
}

export async function resumeIrrigationEventForUser(
  ownerUserId: string,
  eventEquipmentId: string,
  waterBudgetRevision?: number,
  hydraulicRevision?: number,
): Promise<IrrigationEventMutationResult> {
  const row = await findMutableEventEquipment(ownerUserId, eventEquipmentId);
  if (!row) throw new IrrigationEventNotFoundError();
  if (row.timer_state !== 'paused') {
    throw new IrrigationEventStateError('Cette irrigation n’est pas en pause.');
  }

  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) throw new IrrigationEventNotFoundError();
  await assertEquipmentNotRunning(workspaceId, row.equipment_id, eventEquipmentId);
  const now = new Date();
  const nowIso = now.toISOString();
  const timerEndAt = timerTheoreticalEndAt(
    row.planned_duration_seconds,
    row.timer_accumulated_seconds,
    now,
  );
  const timerAlarmRevision = newPushAlarmRevision(now);
  await db.batch([
    waterBudgetRevisionStatement(ownerUserId, waterBudgetRevision),
    hydraulicRevisionStatement(ownerUserId, hydraulicRevision),
    db.prepare(
      `UPDATE irrigation_event_equipment
       SET timer_state = 'running', timer_resumed_at = ?, timer_paused_at = NULL,
           timer_theoretical_end_at = ?, timer_alarm_revision = ?,
           timer_alarm_status = 'pending', timer_alarm_synced_at = NULL,
           updated_at = ?
       WHERE id = ? AND timer_state = 'paused'`,
    ).bind(
      nowIso,
      timerEndAt,
      timerAlarmRevision,
      nowIso,
      eventEquipmentId,
    ),
    logStatement(row.event_id, ownerUserId, 'updated', {
      timerAction: 'resumed',
      eventEquipmentId,
    }),
  ]);

  const bedIds = await listApplicationBedIds(eventEquipmentId);
  const warnings = await findWarnings(
    workspaceId,
    row.equipment_id,
    bedIds,
    nowIso,
    timerEndAt,
    eventEquipmentId,
  );
  return {
    ...warnings,
    eventId: row.event_id,
    eventEquipmentId,
    pushSchedule: pushScheduleFromRow(
      {
        ...row,
        timer_theoretical_end_at: timerEndAt,
        timer_alarm_revision: timerAlarmRevision,
        timer_alarm_status: 'pending',
      },
      eventEquipmentId,
    ),
  };
}
