import { db } from '../binding';
import type {
  IrrigationBedApplicationRecord,
  IrrigationEventRecord,
} from '@/lib/domain/irrigation-event-record';
import { findWorkspaceId } from './ownership';
import { type ApplicationRow, type EventRow, eventSelectSql, parseJson } from './rows';

export type IrrigationStartLimitCandidate = {
  season: number;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  plannedCubicMeters: number;
  actualCubicMeters: number;
  /** Faux quand une application n'a pas de surface mouillée connue : les volumes ci-dessus sont incomplets. */
  volumeComplete: boolean;
};

export async function listIrrigationEventsForUser(
  ownerUserId: string,
  season?: number,
  includeTimerHistory = false,
  period?: { startAt: string; endAt: string },
): Promise<IrrigationEventRecord[]> {
  let seasonFilter = season === undefined ? '' : ' AND event.season = ?';
  const queryArguments = season === undefined ? [ownerUserId] : [ownerUserId, season];
  if (period) {
    seasonFilter += ` AND EXISTS (SELECT 1 FROM irrigation_event_equipment scoped
      WHERE scoped.event_id = event.id AND (scoped.timer_state IS NOT NULL OR
        (scoped.actual_end_at >= ? AND scoped.actual_start_at < ?) OR
        (scoped.planned_end_at >= ? AND scoped.planned_start_at < ?)))`;
    queryArguments.push(period.startAt, period.endAt, period.startAt, period.endAt);
  }
  const [eventsResult, applicationsResult, historyResult] = await Promise.all([
    db.prepare(
      `${eventSelectSql()}
       WHERE workspace.owner_user_id = ?${seasonFilter}
       ORDER BY
         CASE WHEN event_equipment.timer_state IS NOT NULL THEN 0 ELSE 1 END,
         COALESCE(event_equipment.actual_end_at, event_equipment.planned_start_at, event.created_at) DESC,
         event.id DESC`,
    )
      .bind(...queryArguments)
      .all<EventRow>(),
    db.prepare(
      `SELECT
         application.event_equipment_id,
         application.otf_zone_id,
         application.otf_plot_id,
         application.otf_bed_id,
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
       WHERE workspace.owner_user_id = ?${seasonFilter}
       ORDER BY application.event_equipment_id, application.otf_plot_id, application.otf_bed_id`,
    )
      .bind(...queryArguments)
      .all<ApplicationRow>(),
    includeTimerHistory ? db.prepare(
      `SELECT log.event_id, log.action, log.payload, log.created_at
       FROM irrigation_event_log AS log
       INNER JOIN irrigation_events AS event ON event.id = log.event_id
       INNER JOIN irrigation_workspaces AS workspace ON workspace.id = event.workspace_id
       WHERE workspace.owner_user_id = ?${seasonFilter}
       ORDER BY log.created_at, log.rowid`,
    ).bind(...queryArguments).all<{ event_id: string; action: string; payload: string; created_at: string }>()
      : Promise.resolve({ results: [] }),
  ]);

  const historyByEvent = new Map<string, NonNullable<IrrigationEventRecord['timerHistory']>>();
  for (const row of historyResult.results) {
    const history = historyByEvent.get(row.event_id) ?? [];
    history.push({ action: row.action, at: row.created_at, payload: parseJson(row.payload) });
    historyByEvent.set(row.event_id, history);
  }

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

  return eventsResult.results.map((row) => ({
    ...(includeTimerHistory ? { timerHistory: historyByEvent.get(row.event_id) ?? [] } : {}),
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
      pumpSnapshot: row.pump_snapshot ? parseJson(row.pump_snapshot) : null,
      pumpOriginSnapshot: row.pump_origin_snapshot ? parseJson(row.pump_origin_snapshot) : null,
      plannedStartAt: row.planned_start_at,
      plannedEndAt: row.planned_end_at,
      actualStartAt: row.actual_start_at,
      actualEndAt: row.actual_end_at,
      plannedDurationSeconds: Number(row.planned_duration_seconds),
      actualDurationSeconds: Number(row.actual_duration_seconds),
      equipmentSnapshot: parseJson(row.equipment_snapshot),
      settingSnapshot: parseJson(row.setting_snapshot),
      placementSnapshot: parseJson(row.placement_snapshot),
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

export async function findIrrigationWorkspaceIdForUser(
  ownerUserId: string,
): Promise<string | null> {
  return findWorkspaceId(ownerUserId);
}

/**
 * La saison d'une irrigation et l'instant qui la date pour le plan (3.7) :
 * son début réel quand elle a commencé, son début prévu sinon.
 */
export async function readIrrigationEventAnchorForUser(
  ownerUserId: string,
  eventEquipmentId: string,
): Promise<{ season: number; startAt: string } | null> {
  const row = await db.prepare(
    `SELECT event.season,
            COALESCE(event_equipment.actual_start_at, event_equipment.planned_start_at, event.created_at) AS start_at
     FROM irrigation_event_equipment AS event_equipment
     INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
     INNER JOIN irrigation_workspaces AS workspace ON workspace.id = event.workspace_id
     WHERE event_equipment.id = ? AND workspace.owner_user_id = ? LIMIT 1`,
  ).bind(eventEquipmentId, ownerUserId).first<{ season: number; start_at: string }>();
  return row ? { season: Number(row.season), startAt: row.start_at } : null;
}

export async function readIrrigationStartLimitCandidateForUser(
  ownerUserId: string,
  eventEquipmentId: string,
): Promise<IrrigationStartLimitCandidate | null> {
  const row = await db.prepare(
    `SELECT event.season, event_equipment.planned_duration_seconds,
            event_equipment.actual_duration_seconds,
            SUM(application.planned_amount_mm * application.wetted_area_square_meters / 1000.0) AS planned_cubic_meters,
            SUM(application.actual_amount_mm * application.wetted_area_square_meters / 1000.0) AS actual_cubic_meters,
            SUM(CASE WHEN application.wetted_area_square_meters IS NULL THEN 1 ELSE 0 END) AS unknown_applications
     FROM irrigation_event_equipment AS event_equipment
     INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
     INNER JOIN irrigation_workspaces AS workspace ON workspace.id = event.workspace_id
     INNER JOIN irrigation_bed_applications AS application
       ON application.event_equipment_id = event_equipment.id
     WHERE event_equipment.id = ? AND workspace.owner_user_id = ?
     GROUP BY event.season, event_equipment.planned_duration_seconds,
              event_equipment.actual_duration_seconds`,
  ).bind(eventEquipmentId, ownerUserId).first<{
    season: number;
    planned_duration_seconds: number;
    actual_duration_seconds: number;
    planned_cubic_meters: number | null;
    actual_cubic_meters: number | null;
    unknown_applications: number;
  }>();
  // SUM ignore les surfaces nulles : le volume est alors incomplet, et le dit.
  return row ? {
    season: Number(row.season),
    plannedDurationSeconds: Number(row.planned_duration_seconds),
    actualDurationSeconds: Number(row.actual_duration_seconds),
    plannedCubicMeters: Number(row.planned_cubic_meters ?? 0),
    actualCubicMeters: Number(row.actual_cubic_meters ?? 0),
    volumeComplete: Number(row.unknown_applications) === 0,
  } : null;
}
