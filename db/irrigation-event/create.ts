import { db } from '../binding';
import { listPosesOfEquipment } from '../equipment-placement-poses';
import { hydraulicRevisionStatement, waterBudgetRevisionStatement } from '../workspace-repository';
import {
  completedIrrigationPoseRefusalMessage,
  poseForCompletedIrrigation,
  samePlace,
} from '@/lib/domain/equipment-placement-periods';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentListItem, EquipmentSettingRecord } from '@/lib/domain/equipment-record';
import type {
  IrrigationBedApplicationDraft,
  IrrigationEventCreationKind,
} from '@/lib/domain/irrigation-event-record';
import { type IrrigationEventStatus } from '@/lib/domain/irrigation-domain';
import { millimetersForDurationSeconds, timerTheoreticalEndAt } from '@/lib/domain/irrigation-timer';
import { lateAlarmDueAt } from '@/lib/domain/planned-irrigation';
import type { PumpAssignment } from '@/lib/domain/pumps';
import { type IrrigationEventMutationResult, findWarnings } from './conflicts';
import { IrrigationEventInputError, IrrigationEventNotFoundError, IrrigationEventStateError } from './errors';
import { logStatement } from './event-log';
import { assertEquipmentNotRunning, findMutableEventEquipment, findWorkspaceId } from './ownership';
import { newPushAlarmRevision, pushScheduleFromValues } from './push-schedule';
import { equipmentSnapshot, nonNegativeInteger } from './rows';

export type CreateIrrigationEventDraft = {
  waterBudgetRevision?: number;
  hydraulicRevision?: number;
  kind: IrrigationEventCreationKind;
  season: number;
  note: string | null;
  equipment: EquipmentListItem;
  setting: EquipmentSettingRecord;
  placement: EquipmentPlacementRecord;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  applications: IrrigationBedApplicationDraft[];
  pumpAssignment: PumpAssignment | null;
};

/**
 * La tolérance R14 de l'exploitation : une irrigation planifiée porte dès sa
 * création l'alerte « en retard » pour son début plus cette tolérance (3.7,
 * règles 21 et 24). Sans tolérance donnée, pas d'alerte.
 */
export type IrrigationAlarmOptions = { lateToleranceMinutes?: number | null };

export async function createIrrigationEventForUser(
  ownerUserId: string,
  draft: CreateIrrigationEventDraft,
  options: IrrigationAlarmOptions = {},
): Promise<IrrigationEventMutationResult> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) throw new IrrigationEventInputError('Espace d’irrigation introuvable.');
  await assertOwnedEventReferences(workspaceId, draft);
  if (draft.applications.length === 0) {
    throw new IrrigationEventInputError('Ce réglage n’irrigue aucune planche depuis sa position actuelle.');
  }
  if (draft.kind === 'running') {
    await assertEquipmentNotRunning(workspaceId, draft.equipment.id);
  }

  const eventId = crypto.randomUUID();
  const eventEquipmentId = crypto.randomUUID();
  const now = new Date();
  const nowIso = now.toISOString();
  const isCompleted = draft.kind === 'completed';
  const isRunning = draft.kind === 'running';
  const status: IrrigationEventStatus = isCompleted ? 'completed' : 'planned';
  const plannedSeconds = nonNegativeInteger(draft.plannedDurationSeconds);
  const actualSeconds = nonNegativeInteger(draft.actualDurationSeconds);
  const timerEndAt = isRunning
    ? timerTheoreticalEndAt(plannedSeconds, 0, now)
    : null;
  const lateDueAt = isRunning || isCompleted ? null : plannedLateAlarmDueAt(draft, options, now);
  const alarmDueAt = isRunning ? timerEndAt : lateDueAt;
  const timerAlarmRevision = alarmDueAt ? newPushAlarmRevision(now) : null;
  const plannedAmountsDuration = plannedSeconds;
  const actualAmountsDuration = actualSeconds;

  const statements: D1PreparedStatement[] = [
    waterBudgetRevisionStatement(ownerUserId, draft.kind === 'completed' ? undefined : draft.waterBudgetRevision),
    hydraulicRevisionStatement(ownerUserId, draft.kind === 'completed' ? undefined : draft.hydraulicRevision),
    db.prepare(
      `INSERT INTO irrigation_events (
         id, workspace_id, season, status, note, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(eventId, workspaceId, draft.season, status, draft.note, nowIso),
    db.prepare(
      `INSERT INTO irrigation_event_equipment (
         id, event_id, equipment_id, setting_id, placement_id, status,
         planned_start_at, planned_end_at, actual_start_at, actual_end_at,
         planned_duration_minutes, actual_duration_minutes,
         planned_duration_seconds, actual_duration_seconds,
         equipment_snapshot, setting_snapshot, placement_snapshot,
         timer_state, timer_started_at, timer_resumed_at, timer_paused_at,
         timer_theoretical_end_at, timer_accumulated_seconds,
         timer_alarm_revision, timer_alarm_status, timer_alarm_synced_at, late_alarm_due_at,
         pump_id, pump_origin_id, requested_flow_cubic_meters_per_hour,
         pump_snapshot, pump_origin_snapshot,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      eventEquipmentId,
      eventId,
      draft.equipment.id,
      draft.setting.id,
      draft.placement.id,
      status,
      draft.plannedStartAt,
      draft.plannedEndAt,
      draft.actualStartAt,
      draft.actualEndAt,
      Math.round(plannedSeconds / 60),
      Math.round(actualSeconds / 60),
      plannedSeconds,
      actualSeconds,
      JSON.stringify(equipmentSnapshot(draft.equipment)),
      JSON.stringify(draft.setting),
      JSON.stringify(draft.placement),
      isRunning ? 'running' : null,
      isRunning ? nowIso : null,
      isRunning ? nowIso : null,
      null,
      timerEndAt,
      0,
      timerAlarmRevision,
      timerAlarmRevision ? 'pending' : null,
      null,
      lateDueAt,
      draft.pumpAssignment?.pumpId ?? null,
      draft.pumpAssignment?.pumpOriginId ?? null,
      draft.pumpAssignment?.requestedFlowCubicMetersPerHour ?? null,
      draft.pumpAssignment ? JSON.stringify(draft.pumpAssignment.pumpSnapshot) : null,
      draft.pumpAssignment?.pumpOriginSnapshot ? JSON.stringify(draft.pumpAssignment.pumpOriginSnapshot) : null,
      nowIso,
    ),
  ];

  for (const application of draft.applications) {
    statements.push(
      db.prepare(
        `INSERT INTO irrigation_bed_applications (
           event_equipment_id, otf_zone_id, otf_plot_id, otf_bed_id,
           rate_mm_per_hour, bed_area_square_meters, wetted_area_square_meters,
           planned_amount_mm, actual_amount_mm, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        eventEquipmentId,
        application.otfZoneId,
        application.otfPlotId,
        application.otfBedId,
        application.rateMmPerHour,
        application.bedAreaSquareMeters,
        application.wettedAreaSquareMeters,
        millimetersForDurationSeconds(
          application.rateMmPerHour,
          plannedAmountsDuration,
        ),
        millimetersForDurationSeconds(
          application.rateMmPerHour,
          actualAmountsDuration,
        ),
        nowIso,
      ),
    );
  }
  statements.push(logStatement(eventId, ownerUserId, 'created', {
    kind: draft.kind,
    eventEquipmentId,
  }));

  await db.batch(statements);
  const warnings = await findWarnings(
    workspaceId,
    draft.equipment.id,
    draft.applications.map((application) => application.otfBedId),
    draft.plannedStartAt,
    draft.plannedEndAt,
    eventEquipmentId,
  );
  return {
    ...warnings,
    eventId,
    eventEquipmentId,
    pushSchedule:
      alarmDueAt && timerAlarmRevision
        ? pushScheduleFromValues({
            workspaceId,
            eventEquipmentId,
            season: draft.season,
            kind: isRunning ? 'finished' : 'late',
            revision: timerAlarmRevision,
            dueAt: alarmDueAt,
            status: 'pending',
            equipmentName: draft.equipment.name,
            settingName: draft.setting.name,
          })
        : null,
  };
}

/** L'échéance de l'alerte « en retard » d'une irrigation planifiée, quand la tolérance R14 est donnée (règle 24). */
function plannedLateAlarmDueAt(draft: CreateIrrigationEventDraft, options: IrrigationAlarmOptions, now: Date): string | null {
  if (draft.kind !== 'planned' || !draft.plannedStartAt || !draft.plannedEndAt) return null;
  if (options.lateToleranceMinutes === undefined || options.lateToleranceMinutes === null) return null;
  return lateAlarmDueAt(draft.plannedStartAt, draft.plannedEndAt, options.lateToleranceMinutes, now);
}

export async function updatePlannedIrrigationForUser(
  ownerUserId: string,
  eventEquipmentId: string,
  draft: CreateIrrigationEventDraft,
  options: IrrigationAlarmOptions = {},
): Promise<IrrigationEventMutationResult> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  const current = await findMutableEventEquipment(ownerUserId, eventEquipmentId);
  if (!workspaceId || !current) throw new IrrigationEventNotFoundError();
  if (current.timer_state || current.equipment_status !== 'planned') {
    throw new IrrigationEventStateError('Seule une irrigation planifiée et non démarrée peut être modifiée.');
  }
  if (draft.kind !== 'planned' || !draft.plannedStartAt || !draft.plannedEndAt) {
    throw new IrrigationEventInputError('La modification doit conserver une période planifiée valide.');
  }
  await assertOwnedEventReferences(workspaceId, draft);
  if (draft.applications.length === 0) throw new IrrigationEventInputError('Ce réglage n’irrigue aucune planche depuis sa position actuelle.');
  const now = new Date();
  const nowIso = now.toISOString();
  const plannedSeconds = nonNegativeInteger(draft.plannedDurationSeconds);
  // L'alerte « en retard » suit le nouveau créneau, sous une révision plus récente que le Worker préfère (règle 24).
  const lateDueAt = plannedLateAlarmDueAt(draft, options, now);
  const timerAlarmRevision = lateDueAt ? newPushAlarmRevision(now) : null;
  const statements: D1PreparedStatement[] = [
    waterBudgetRevisionStatement(ownerUserId, draft.waterBudgetRevision),
    hydraulicRevisionStatement(ownerUserId, draft.hydraulicRevision),
    db.prepare('UPDATE irrigation_events SET season = ?, note = ?, updated_at = ? WHERE id = ? AND workspace_id = ?')
      .bind(draft.season, draft.note, nowIso, current.event_id, workspaceId),
    db.prepare(`UPDATE irrigation_event_equipment SET equipment_id = ?, setting_id = ?, placement_id = ?,
      planned_start_at = ?, planned_end_at = ?, planned_duration_minutes = ?, planned_duration_seconds = ?,
      pump_id = ?, pump_origin_id = ?, requested_flow_cubic_meters_per_hour = ?, pump_snapshot = ?, pump_origin_snapshot = ?,
      late_alarm_due_at = ?, timer_alarm_revision = ?, timer_alarm_status = ?, timer_alarm_synced_at = NULL,
      equipment_snapshot = ?, setting_snapshot = ?, placement_snapshot = ?, updated_at = ?
      WHERE id = ? AND status = 'planned' AND timer_state IS NULL`)
      .bind(draft.equipment.id, draft.setting.id, draft.placement.id,
        draft.plannedStartAt, draft.plannedEndAt, Math.round(plannedSeconds / 60), plannedSeconds,
        draft.pumpAssignment?.pumpId ?? null, draft.pumpAssignment?.pumpOriginId ?? null,
        draft.pumpAssignment?.requestedFlowCubicMetersPerHour ?? null,
        draft.pumpAssignment ? JSON.stringify(draft.pumpAssignment.pumpSnapshot) : null,
        draft.pumpAssignment?.pumpOriginSnapshot ? JSON.stringify(draft.pumpAssignment.pumpOriginSnapshot) : null,
        lateDueAt, timerAlarmRevision, timerAlarmRevision ? 'pending' : null,
        JSON.stringify(equipmentSnapshot(draft.equipment)), JSON.stringify(draft.setting),
        JSON.stringify(draft.placement), nowIso, eventEquipmentId),
    db.prepare('DELETE FROM irrigation_bed_applications WHERE event_equipment_id = ?').bind(eventEquipmentId),
  ];
  for (const application of draft.applications) {
    statements.push(db.prepare(`INSERT INTO irrigation_bed_applications
      (event_equipment_id, otf_zone_id, otf_plot_id, otf_bed_id,
       rate_mm_per_hour, bed_area_square_meters, wetted_area_square_meters, planned_amount_mm, actual_amount_mm, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
      .bind(eventEquipmentId, application.otfZoneId, application.otfPlotId, application.otfBedId,
        application.rateMmPerHour, application.bedAreaSquareMeters, application.wettedAreaSquareMeters,
        millimetersForDurationSeconds(application.rateMmPerHour, plannedSeconds), nowIso));
  }
  statements.push(logStatement(current.event_id, ownerUserId, 'updated', {
    eventEquipmentId, timerAction: 'planning_modified',
  }));
  await db.batch(statements);
  const warnings = await findWarnings(workspaceId, draft.equipment.id,
    draft.applications.map((application) => application.otfBedId),
    draft.plannedStartAt, draft.plannedEndAt, eventEquipmentId);
  return {
    ...warnings,
    eventId: current.event_id,
    eventEquipmentId,
    pushSchedule: lateDueAt && timerAlarmRevision
      ? pushScheduleFromValues({
          workspaceId, eventEquipmentId, season: draft.season, kind: 'late', revision: timerAlarmRevision, dueAt: lateDueAt,
          status: 'pending', equipmentName: draft.equipment.name, settingName: draft.setting.name,
        })
      : null,
  };
}

/**
 * Le matériel, son réglage et sa ligne de position appartiennent à l'espace.
 * Une irrigation à venir ou en cours demande le matériel posé (règle 11) ;
 * une irrigation saisie après coup demande la pose ouverte à son heure de
 * début, même fermée depuis, et doit porter cette pose-là (règle 12).
 */
async function assertOwnedEventReferences(
  workspaceId: string,
  draft: CreateIrrigationEventDraft,
) {
  const completed = draft.kind === 'completed';
  const row = await db.prepare(
    `SELECT placement.id
     FROM irrigation_equipment AS equipment
     INNER JOIN irrigation_equipment_settings AS setting
       ON setting.equipment_id = equipment.id
     INNER JOIN irrigation_equipment_placements AS placement
       ON placement.equipment_id = equipment.id
     WHERE equipment.id = ? AND setting.id = ? AND placement.id = ?
       AND equipment.workspace_id = ? AND placement.workspace_id = ?
       AND placement.season = ? AND equipment.status = 'active'
       AND (placement.removed_at IS NULL OR ? = 1)
     LIMIT 1`,
  )
    .bind(
      draft.equipment.id,
      draft.setting.id,
      draft.placement.id,
      workspaceId,
      workspaceId,
      draft.season,
      completed ? 1 : 0,
    )
    .first<{ id: string }>();
  if (!row) {
    throw new IrrigationEventInputError(
      'Le matériel, son réglage ou sa position n’est plus disponible.',
    );
  }
  if (completed) await assertCompletedIrrigationPose(workspaceId, draft);
}

async function assertCompletedIrrigationPose(workspaceId: string, draft: CreateIrrigationEventDraft) {
  if (draft.actualStartAt === null || draft.actualEndAt === null) {
    throw new IrrigationEventInputError('Indiquez l’heure de début et l’heure de fin.');
  }
  const poses = await listPosesOfEquipment(workspaceId, draft.equipment.id, draft.season);
  const found = poseForCompletedIrrigation(poses, draft.actualStartAt, draft.actualEndAt);
  if (!found.ok) throw new IrrigationEventInputError(completedIrrigationPoseRefusalMessage(found.refusal));
  if (!samePlace(found.pose, draft.placement)) {
    throw new IrrigationEventInputError(
      'Ce matériel n’était pas posé à cet endroit à l’heure de début : recommencez la saisie.',
    );
  }
}
