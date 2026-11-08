import { millisecondsFromMinutes } from '@/lib/domain/units';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import type { IrrigationPushAlarmStatus } from '@/lib/domain/irrigation-event-record';
import { type IrrigationEventStatus } from '@/lib/domain/irrigation-domain';
import { activeTimerSeconds, type IrrigationTimerState } from '@/lib/domain/irrigation-timer';
import { IrrigationEventInputError } from './errors';

export type EventRow = {
  event_id: string;
  season: number;
  event_status: IrrigationEventStatus;
  note: string | null;
  event_remaining_canceled_at: string | null;
  event_canceled_at: string | null;
  event_created_at: string;
  event_updated_at: string;
  event_equipment_id: string;
  equipment_id: string;
  setting_id: string;
  placement_id: string;
  equipment_status: IrrigationEventStatus;
  pump_id: string | null;
  pump_origin_id: string | null;
  requested_flow_cubic_meters_per_hour: number | null;
  pump_snapshot: string | null;
  pump_origin_snapshot: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  planned_duration_seconds: number;
  actual_duration_seconds: number;
  equipment_snapshot: string;
  setting_snapshot: string;
  placement_snapshot: string;
  timer_state: IrrigationTimerState | null;
  timer_started_at: string | null;
  timer_resumed_at: string | null;
  timer_paused_at: string | null;
  timer_theoretical_end_at: string | null;
  timer_accumulated_seconds: number;
  timer_alarm_revision: string | null;
  timer_alarm_status: IrrigationPushAlarmStatus | null;
  timer_alarm_synced_at: string | null;
  equipment_remaining_canceled_at: string | null;
  equipment_canceled_at: string | null;
};

export type ApplicationRow = {
  event_equipment_id: string;
  otf_zone_id: string;
  otf_plot_id: string;
  otf_bed_id: string;
  rate_mm_per_hour: number;
  bed_area_square_meters: number;
  wetted_area_square_meters: number | null;
  planned_amount_mm: number;
  actual_amount_mm: number;
};

export type MutableEventEquipmentRow = {
  event_id: string;
  workspace_id: string;
  season: number;
  event_status: IrrigationEventStatus;
  equipment_status: IrrigationEventStatus;
  equipment_id: string;
  planned_duration_seconds: number;
  actual_duration_seconds: number;
  actual_start_at: string | null;
  actual_end_at: string | null;
  timer_state: IrrigationTimerState | null;
  timer_started_at: string | null;
  timer_resumed_at: string | null;
  timer_paused_at: string | null;
  timer_accumulated_seconds: number;
  timer_theoretical_end_at: string | null;
  timer_alarm_revision: string | null;
  timer_alarm_status: IrrigationPushAlarmStatus | null;
  /** L'échéance de l'alerte « en retard » d'une irrigation planifiée (3.7, règle 24) ; nulle dès le démarrage. */
  late_alarm_due_at: string | null;
  equipment_snapshot: string;
  setting_snapshot: string;
  remaining_canceled_at: string | null;
};

export function eventSelectSql() {
  return `SELECT
     event.id AS event_id,
     event.season,
     event.status AS event_status,
     event.note,
     event.remaining_canceled_at AS event_remaining_canceled_at,
     event.canceled_at AS event_canceled_at,
     event.created_at AS event_created_at,
     event.updated_at AS event_updated_at,
     event_equipment.id AS event_equipment_id,
     event_equipment.equipment_id,
     event_equipment.setting_id,
     event_equipment.placement_id,
     event_equipment.status AS equipment_status,
     event_equipment.pump_id,
     event_equipment.pump_origin_id,
     event_equipment.requested_flow_cubic_meters_per_hour,
     event_equipment.pump_snapshot,
     event_equipment.pump_origin_snapshot,
     event_equipment.planned_start_at,
     event_equipment.planned_end_at,
     event_equipment.actual_start_at,
     event_equipment.actual_end_at,
     event_equipment.planned_duration_seconds,
     event_equipment.actual_duration_seconds,
     event_equipment.equipment_snapshot,
     event_equipment.setting_snapshot,
     event_equipment.placement_snapshot,
     event_equipment.timer_state,
     event_equipment.timer_started_at,
     event_equipment.timer_resumed_at,
     event_equipment.timer_paused_at,
     event_equipment.timer_theoretical_end_at,
     event_equipment.timer_accumulated_seconds,
     event_equipment.timer_alarm_revision,
     event_equipment.timer_alarm_status,
     event_equipment.timer_alarm_synced_at,
     event_equipment.remaining_canceled_at AS equipment_remaining_canceled_at,
     event_equipment.canceled_at AS equipment_canceled_at
   FROM irrigation_events AS event
   INNER JOIN irrigation_event_equipment AS event_equipment
     ON event_equipment.event_id = event.id
   INNER JOIN irrigation_workspaces AS workspace ON workspace.id = event.workspace_id`;
}

export function activeSecondsFromRow(row: MutableEventEquipmentRow, at: Date) {
  if (!row.timer_state) return nonNegativeInteger(row.actual_duration_seconds);
  return activeTimerSeconds(
    {
      state: row.timer_state,
      resumedAt: row.timer_resumed_at,
      pausedAt: row.timer_paused_at,
      accumulatedSeconds: row.timer_accumulated_seconds,
      targetDurationSeconds: row.planned_duration_seconds,
    },
    at,
  );
}

export function resolveRequestedEndAt(
  row: MutableEventEquipmentRow,
  requestedEndAt: string | null,
  now: Date,
) {
  const defaultEnd = row.timer_state === 'paused' && row.timer_paused_at
    ? new Date(row.timer_paused_at)
    : now;
  const endAt = requestedEndAt ? new Date(requestedEndAt) : defaultEnd;
  const startedAt = new Date(row.timer_started_at!);
  if (
    !Number.isFinite(endAt.getTime()) ||
    endAt <= startedAt ||
    endAt.getTime() > now.getTime() + millisecondsFromMinutes(1)
  ) {
    throw new IrrigationEventInputError('L’heure réelle de fin est invalide.');
  }
  if (
    row.timer_state === 'running' &&
    row.timer_resumed_at &&
    endAt < new Date(row.timer_resumed_at)
  ) {
    throw new IrrigationEventInputError(
      'L’heure de fin ne peut pas précéder la dernière reprise.',
    );
  }
  return endAt;
}

export function equipmentSnapshot(equipment: EquipmentListItem) {
  return {
    id: equipment.id,
    name: equipment.name,
    kind: equipment.kind,
    mobility: equipment.mobility,
  };
}

export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function nonNegativeInteger(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
