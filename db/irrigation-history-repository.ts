import { db } from './binding';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type {
  EquipmentListItem,
  EquipmentSettingRecord,
} from '@/lib/domain/equipment-record';
import type {
  IrrigationBedApplicationRecord,
  IrrigationEventRecord,
  IrrigationPushAlarmStatus,
} from '@/lib/domain/irrigation-event-record';
import type {
  IrrigationEventStatus,
  IrrigationTimerState,
} from '@/lib/domain/irrigation-domain';
import type { PumpOriginSnapshot, PumpSnapshot } from '@/lib/domain/pumps';

export type IrrigationHistoryScopeFilter = {
  level: 'farm' | 'zone' | 'plot' | 'bed';
  zoneId: string | null;
  plotId: string | null;
  bedId: string | null;
};

export type IrrigationHistoryPeriodQuery = {
  /**
   * `null` : toutes les saisons. Le suivi par série borne sa lecture par les
   * instants de la période d'occupation, qui peut commencer l'année précédant
   * la saison de la série (docs/series-contract.md, « La période d'occupation »).
   */
  season: number | null;
  startAt: string;
  endAtExclusive: string;
  scope: IrrigationHistoryScopeFilter;
};

type EventRow = {
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

type ApplicationRow = {
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

type HistoryRow = {
  event_id: string;
  action: string;
  payload: string;
  created_at: string;
};

/**
 * Read-only projection over the immutable 2.7 history. The query is bounded by
 * the selected season, civil period and OTF scope; no second history store is
 * introduced for the analytics screen.
 */
export async function listIrrigationHistoryForUser(
  ownerUserId: string,
  query: IrrigationHistoryPeriodQuery,
): Promise<IrrigationEventRecord[]> {
  const period = periodPredicate('event_equipment', 'event');
  const scope = scopePredicate(query.scope);
  const commonArguments = [
    ownerUserId,
    query.season,
    query.season,
    ...periodArguments(query),
    ...scope.arguments,
  ];

  const [eventsResult, applicationsResult, historyResult] = await Promise.all([
    db.prepare(
      `${eventSelectSql()}
       WHERE workspace.owner_user_id = ?
         AND (? IS NULL OR event.season = ?)
         AND ${period.sql}
         AND EXISTS (
           SELECT 1
           FROM irrigation_bed_applications AS scoped_application
           WHERE scoped_application.event_equipment_id = event_equipment.id
             ${scope.sql('scoped_application')}
         )
       ORDER BY
         COALESCE(event_equipment.actual_start_at,
                  event_equipment.planned_start_at,
                  event_equipment.canceled_at,
                  event.created_at) DESC,
         event.id DESC`,
    ).bind(...commonArguments).all<EventRow>(),
    db.prepare(
      `SELECT application.event_equipment_id, application.otf_zone_id,
              application.otf_plot_id, application.otf_bed_id,
              application.rate_mm_per_hour,
              application.bed_area_square_meters,
              application.wetted_area_square_meters,
              application.planned_amount_mm,
              application.actual_amount_mm
       FROM irrigation_bed_applications AS application
       INNER JOIN irrigation_event_equipment AS event_equipment
         ON event_equipment.id = application.event_equipment_id
       INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
       INNER JOIN irrigation_workspaces AS workspace ON workspace.id = event.workspace_id
       WHERE workspace.owner_user_id = ?
         AND (? IS NULL OR event.season = ?)
         AND ${period.sql}
         ${scope.sql('application')}
       ORDER BY application.event_equipment_id,
                application.otf_plot_id,
                application.otf_bed_id`,
    ).bind(...commonArguments).all<ApplicationRow>(),
    db.prepare(
      `SELECT DISTINCT log.event_id, log.action, log.payload, log.created_at
       FROM irrigation_event_log AS log
       INNER JOIN irrigation_events AS event ON event.id = log.event_id
       INNER JOIN irrigation_event_equipment AS event_equipment
         ON event_equipment.event_id = event.id
       INNER JOIN irrigation_workspaces AS workspace ON workspace.id = event.workspace_id
       WHERE workspace.owner_user_id = ?
         AND (? IS NULL OR event.season = ?)
         AND ${period.sql}
         AND EXISTS (
           SELECT 1
           FROM irrigation_bed_applications AS scoped_application
           WHERE scoped_application.event_equipment_id = event_equipment.id
             ${scope.sql('scoped_application')}
         )
       ORDER BY log.created_at, log.event_id`,
    ).bind(...commonArguments).all<HistoryRow>(),
  ]);

  const applicationsByEquipment = new Map<string, IrrigationBedApplicationRecord[]>();
  for (const row of applicationsResult.results) {
    const applications = applicationsByEquipment.get(row.event_equipment_id) ?? [];
    applications.push({
      otfZoneId: row.otf_zone_id,
      otfPlotId: row.otf_plot_id,
      otfBedId: row.otf_bed_id,
      rateMmPerHour: Number(row.rate_mm_per_hour),
      bedAreaSquareMeters: Number(row.bed_area_square_meters),
      wettedAreaSquareMeters: row.wetted_area_square_meters === null ? null : Number(row.wetted_area_square_meters),
      plannedAmountMm: Number(row.planned_amount_mm),
      actualAmountMm: Number(row.actual_amount_mm),
    });
    applicationsByEquipment.set(row.event_equipment_id, applications);
  }

  const historyByEvent = new Map<
    string,
    NonNullable<IrrigationEventRecord['timerHistory']>
  >();
  for (const row of historyResult.results) {
    const history = historyByEvent.get(row.event_id) ?? [];
    history.push({
      action: row.action,
      at: row.created_at,
      payload: parseJson<Record<string, unknown>>(row.payload),
    });
    historyByEvent.set(row.event_id, history);
  }

  return eventsResult.results.map((row) => ({
    timerHistory: historyByEvent.get(row.event_id) ?? [],
    id: row.event_id,
    season: Number(row.season),
    status: row.event_status,
    note: row.note,
    remainingCanceledAt: row.event_remaining_canceled_at,
    canceledAt: row.event_canceled_at,
    createdAt: row.event_created_at,
    updatedAt: row.event_updated_at,
    equipment: {
      id: row.event_equipment_id,
      equipmentId: row.equipment_id,
      settingId: row.setting_id,
      placementId: row.placement_id,
      status: row.equipment_status,
      pumpId: row.pump_id,
      pumpOriginId: row.pump_origin_id,
      requestedFlowCubicMetersPerHour: row.requested_flow_cubic_meters_per_hour === null ? null : Number(row.requested_flow_cubic_meters_per_hour),
      pumpSnapshot: row.pump_snapshot ? parseJson<PumpSnapshot>(row.pump_snapshot) : null,
      pumpOriginSnapshot: row.pump_origin_snapshot ? parseJson<PumpOriginSnapshot>(row.pump_origin_snapshot) : null,
      plannedStartAt: row.planned_start_at,
      plannedEndAt: row.planned_end_at,
      actualStartAt: row.actual_start_at,
      actualEndAt: row.actual_end_at,
      plannedDurationSeconds: Number(row.planned_duration_seconds),
      actualDurationSeconds: Number(row.actual_duration_seconds),
      equipmentSnapshot: parseJson<Pick<
        EquipmentListItem,
        'id' | 'name' | 'kind' | 'mobility'
      >>(row.equipment_snapshot),
      settingSnapshot: parseJson<EquipmentSettingRecord>(row.setting_snapshot),
      placementSnapshot: parseJson<EquipmentPlacementRecord>(row.placement_snapshot),
      timerState: row.timer_state,
      timerStartedAt: row.timer_started_at,
      timerResumedAt: row.timer_resumed_at,
      timerPausedAt: row.timer_paused_at,
      timerTheoreticalEndAt: row.timer_theoretical_end_at,
      timerAccumulatedSeconds: Number(row.timer_accumulated_seconds),
      timerAlarmRevision: row.timer_alarm_revision,
      timerAlarmStatus: row.timer_alarm_status,
      timerAlarmSyncedAt: row.timer_alarm_synced_at,
      remainingCanceledAt: row.equipment_remaining_canceled_at,
      canceledAt: row.equipment_canceled_at,
      applications: applicationsByEquipment.get(row.event_equipment_id) ?? [],
    },
  }));
}

function eventSelectSql() {
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

function periodPredicate(equipmentAlias: string, eventAlias: string) {
  return {
    sql: `(
      (${equipmentAlias}.actual_start_at IS NOT NULL
        AND ${equipmentAlias}.actual_start_at < ?
        AND COALESCE(${equipmentAlias}.actual_end_at, ${equipmentAlias}.actual_start_at) > ?)
      OR (${equipmentAlias}.actual_start_at IS NULL
        AND ${equipmentAlias}.planned_start_at IS NOT NULL
        AND ${equipmentAlias}.planned_start_at < ?
        AND COALESCE(${equipmentAlias}.planned_end_at, ${equipmentAlias}.planned_start_at) > ?)
      OR (${equipmentAlias}.actual_start_at IS NULL
        AND ${equipmentAlias}.planned_start_at IS NULL
        AND COALESCE(${equipmentAlias}.canceled_at, ${eventAlias}.created_at) >= ?
        AND COALESCE(${equipmentAlias}.canceled_at, ${eventAlias}.created_at) < ?)
    )`,
  };
}

function periodArguments(query: IrrigationHistoryPeriodQuery) {
  return [
    query.endAtExclusive,
    query.startAt,
    query.endAtExclusive,
    query.startAt,
    query.startAt,
    query.endAtExclusive,
  ];
}

function scopePredicate(scope: IrrigationHistoryScopeFilter) {
  const clauses: string[] = [];
  const arguments_: string[] = [];
  if (scope.zoneId) {
    clauses.push('{alias}.otf_zone_id = ?');
    arguments_.push(scope.zoneId);
  }
  if (scope.plotId) {
    clauses.push('{alias}.otf_plot_id = ?');
    arguments_.push(scope.plotId);
  }
  if (scope.bedId) {
    clauses.push('{alias}.otf_bed_id = ?');
    arguments_.push(scope.bedId);
  }
  return {
    arguments: arguments_,
    sql: (alias: string) => clauses.length === 0
      ? ''
      : `AND ${clauses.map((clause) => clause.replace('{alias}', alias)).join(' AND ')}`,
  };
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
