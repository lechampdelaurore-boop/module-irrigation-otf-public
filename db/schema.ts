import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

const updatedAt = () =>
  text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const otfSnapshots = sqliteTable('otf_snapshots', {
  cacheKey: text('cache_key').primaryKey(),
  payload: text('payload').notNull(),
  lastSuccessfulReadAt: text('last_successful_read_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Isolation boundary for irrigation-owned data.
 *
 * OTF remains the source of truth for farms and permissions. `otfFarmId` is
 * deliberately only a nullable external reference until OTF exposes a stable
 * farm identifier through the read contract.
 */
export const irrigationWorkspaces = sqliteTable(
  'irrigation_workspaces',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id').notNull(),
    otfFarmId: text('otf_farm_id'),
    waterBudgetRevision: integer('water_budget_revision').notNull().default(0),
    hydraulicRevision: integer('hydraulic_revision').notNull().default(0),
    feasibilityRevision: integer('feasibility_revision').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_irrigation_workspaces_owner').on(table.ownerUserId),
    uniqueIndex('uq_irrigation_workspaces_owner_otf_farm')
      .on(table.ownerUserId, table.otfFarmId)
      .where(sql`${table.otfFarmId} IS NOT NULL`),
    uniqueIndex('uq_irrigation_workspaces_owner_pending_farm')
      .on(table.ownerUserId)
      .where(sql`${table.otfFarmId} IS NULL`),
  ],
);

export const irrigationNeedPreferences = sqliteTable(
  'irrigation_need_preferences',
  {
    workspaceId: text('workspace_id').primaryKey().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    minimumNeedThresholdMm: real('minimum_need_threshold_mm').notNull().default(0),
    actorUserId: text('actor_user_id').notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [check('chk_irrigation_need_threshold', sql`${table.minimumNeedThresholdMm} >= 0 AND ${table.minimumNeedThresholdMm} <= 500`)],
);

export const irrigationArbitrations = sqliteTable('irrigation_arbitrations', {
  workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
  season: integer('season').notNull(), weekStart: text('week_start').notNull(),
  priority: text('priority', { enum: ['high', 'normal', 'low'] }).notNull(),
  selectedBedIds: text('selected_bed_ids').notNull(), candidateBedIds: text('candidate_bed_ids').notNull(),
  actorUserId: text('actor_user_id').notNull(), decidedAt: text('decided_at').notNull(), invalidatedAt: text('invalidated_at'),
}, (table) => [primaryKey({ columns: [table.workspaceId, table.season, table.weekStart, table.priority] }),
  check('chk_arbitration_priority', sql`${table.priority} IN ('high', 'normal', 'low')`),
  check('chk_arbitration_season', sql`${table.season} BETWEEN 1900 AND 9999`),
  check('chk_arbitration_arrays', sql`json_valid(${table.selectedBedIds}) AND json_type(${table.selectedBedIds}) = 'array' AND json_valid(${table.candidateBedIds}) AND json_type(${table.candidateBedIds}) = 'array'`),
]);

export const irrigationArbitrationLog = sqliteTable('irrigation_arbitration_log', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
  requestId: text('request_id').notNull(), season: integer('season').notNull(), weekStart: text('week_start').notNull(),
  priority: text('priority').notNull(), action: text('action').notNull(), payload: text('payload').notNull(),
  actorUserId: text('actor_user_id').notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex('uq_arbitration_request').on(table.workspaceId, table.requestId), index('idx_arbitration_log_week').on(table.workspaceId, table.season, table.weekStart)]);

export const irrigationBedNeedDecisions = sqliteTable(
  'irrigation_bed_need_decisions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(), weekStart: text('week_start').notNull(),
    otfZoneId: text('otf_zone_id').notNull(), otfPlotId: text('otf_plot_id').notNull(), otfBedId: text('otf_bed_id').notNull(),
    priority: text('priority', { enum: ['low', 'normal', 'high'] }).notNull().default('normal'),
    manualOverrideMm: real('manual_override_mm'), overrideReason: text('override_reason'),
    calculatedNeedAtOverrideMm: real('calculated_need_at_override_mm'), actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(), updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_irrigation_bed_need_week').on(table.workspaceId, table.season, table.weekStart, table.otfBedId),
    index('idx_irrigation_bed_need_plot').on(table.workspaceId, table.season, table.weekStart, table.otfPlotId),
    check('chk_irrigation_bed_need_season', sql`${table.season} BETWEEN 1900 AND 9999`),
    check('chk_irrigation_bed_need_priority', sql`${table.priority} IN ('low', 'normal', 'high')`),
    check('chk_irrigation_bed_need_override', sql`(${table.manualOverrideMm} IS NULL AND ${table.calculatedNeedAtOverrideMm} IS NULL) OR (${table.manualOverrideMm} >= 0 AND ${table.manualOverrideMm} <= 500 AND (${table.calculatedNeedAtOverrideMm} IS NULL OR ${table.calculatedNeedAtOverrideMm} >= 0))`),
  ],
);

export const irrigationNeedDecisionLog = sqliteTable(
  'irrigation_need_decision_log',
  {
    id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(), weekStart: text('week_start').notNull(), otfBedId: text('otf_bed_id'),
    action: text('action', { enum: ['threshold_set', 'priority_set', 'override_set', 'override_cleared'] }).notNull(),
    payload: text('payload').notNull(), actorUserId: text('actor_user_id').notNull(), createdAt: createdAt(),
  },
  (table) => [index('idx_irrigation_need_log_week').on(table.workspaceId, table.season, table.weekStart, table.createdAt)],
);

export const irrigationEquipment = sqliteTable(
  'irrigation_equipment',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['sprinkler', 'drip'] }).notNull(),
    mobility: text('mobility', { enum: ['fixed', 'mobile'] }).notNull(),
    status: text('status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
    archivedAt: text('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_irrigation_equipment_workspace_status').on(
      table.workspaceId,
      table.status,
    ),
    uniqueIndex('uq_irrigation_equipment_workspace_name').on(
      table.workspaceId,
      table.name,
    ),
    check(
      'chk_irrigation_equipment_archive_state',
      sql`(${table.status} = 'active' AND ${table.archivedAt} IS NULL) OR (${table.status} = 'archived' AND ${table.archivedAt} IS NOT NULL)`,
    ),
    check(
      'chk_irrigation_equipment_kind',
      sql`${table.kind} IN ('sprinkler', 'drip')`,
    ),
    check(
      'chk_irrigation_equipment_mobility',
      sql`${table.mobility} IN ('fixed', 'mobile')`,
    ),
  ],
);

export const irrigationEquipmentSettings = sqliteTable(
  'irrigation_equipment_settings',
  {
    id: text('id').primaryKey(),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => irrigationEquipment.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_irrigation_settings_equipment_position').on(
      table.equipmentId,
      table.position,
    ),
    uniqueIndex('uq_irrigation_settings_equipment_name').on(
      table.equipmentId,
      table.name,
    ),
    check(
      'chk_irrigation_settings_position',
      sql`${table.position} BETWEEN 1 AND 10`,
    ),
  ],
);

export const sprinklerProfilePoints = sqliteTable(
  'sprinkler_profile_points',
  {
    id: text('id').primaryKey(),
    settingId: text('setting_id')
      .notNull()
      .references(() => irrigationEquipmentSettings.id, {
        onDelete: 'cascade',
      }),
    side: text('side', { enum: ['left', 'right'] }).notNull(),
    distanceMeters: real('distance_meters').notNull(),
    rateMmPerHour: real('rate_mm_per_hour').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_sprinkler_points_setting_side_distance').on(
      table.settingId,
      table.side,
      table.distanceMeters,
    ),
    index('idx_sprinkler_points_setting_side').on(
      table.settingId,
      table.side,
    ),
    check(
      'chk_sprinkler_points_distance_non_negative',
      sql`${table.distanceMeters} >= 0`,
    ),
    check(
      'chk_sprinkler_points_rate_non_negative',
      sql`${table.rateMmPerHour} >= 0`,
    ),
    check(
      'chk_sprinkler_points_side',
      sql`${table.side} IN ('left', 'right')`,
    ),
  ],
);

export const dripSettingRates = sqliteTable(
  'drip_setting_rates',
  {
    settingId: text('setting_id')
      .primaryKey()
      .references(() => irrigationEquipmentSettings.id, {
        onDelete: 'cascade',
      }),
    rateMmPerHour: real('rate_mm_per_hour').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      'chk_drip_setting_rate_non_negative',
      sql`${table.rateMmPerHour} >= 0`,
    ),
  ],
);

/** La provenance d'un réglage (3.8 bis, migration 0029, docs/irrigation-calculator-contract.md, section 10). */
export const equipmentSettingCalculations = sqliteTable(
  'irrigation_equipment_setting_calculations',
  {
    settingId: text('setting_id')
      .primaryKey()
      .references(() => irrigationEquipmentSettings.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    level: text('level').notNull(),
    method: text('method'),
    inputsJson: text('inputs_json'),
    theoreticalRateMmPerHour: real('theoretical_rate_mm_per_hour'),
    zoneSharePercent: real('zone_share_percent'),
    nominalFlowLitersPerHour: real('nominal_flow_liters_per_hour'),
    calculatedAt: text('calculated_at').notNull(),
  },
  (table) => [
    index('idx_setting_calculations_workspace').on(table.workspaceId),
    check('chk_setting_calculation_level', sql`${table.level} IN ('calculated', 'estimated', 'measured')`),
  ],
);

export const gardenGroups = sqliteTable(
  'irrigation_garden_groups',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    copiedFromGroupId: text('copied_from_group_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_garden_groups_workspace_season_name').on(
      table.workspaceId,
      table.season,
      table.name,
    ),
    uniqueIndex('uq_garden_groups_workspace_season_position').on(
      table.workspaceId,
      table.season,
      table.position,
    ),
    index('idx_garden_groups_workspace_season').on(
      table.workspaceId,
      table.season,
    ),
    check('chk_garden_groups_season', sql`${table.season} BETWEEN 1900 AND 9999`),
    check('chk_garden_groups_position', sql`${table.position} >= 1`),
  ],
);

export const seasonGeometry = sqliteTable(
  'irrigation_season_geometry',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    copiedFromSeason: integer('copied_from_season'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.season] }),
    check(
      'chk_season_geometry_season',
      sql`${table.season} BETWEEN 1900 AND 9999`,
    ),
    check(
      'chk_season_geometry_copied_from',
      sql`${table.copiedFromSeason} IS NULL OR (${table.copiedFromSeason} BETWEEN 1900 AND 9999 AND ${table.copiedFromSeason} < ${table.season})`,
    ),
  ],
);

export const gardenGroupMembers = sqliteTable(
  'irrigation_garden_group_members',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => gardenGroups.id, { onDelete: 'cascade' }),
    otfZoneId: text('otf_zone_id').notNull(),
    otfPlotId: text('otf_plot_id').notNull(),
    position: integer('position').notNull(),
    bedOrder: text('bed_order', { enum: ['normal', 'reversed'] })
      .notNull()
      .default('normal'),
    gapBeforeMeters: real('gap_before_meters').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.otfPlotId] }),
    uniqueIndex('uq_garden_group_members_group_position').on(
      table.groupId,
      table.position,
    ),
    index('idx_garden_group_members_plot').on(table.otfPlotId),
    check('chk_garden_group_members_position', sql`${table.position} >= 1`),
    check(
      'chk_garden_group_members_gap_non_negative',
      sql`${table.gapBeforeMeters} >= 0`,
    ),
    check(
      'chk_garden_group_members_bed_order',
      sql`${table.bedOrder} IN ('normal', 'reversed')`,
    ),
  ],
);

export const equipmentPlacements = sqliteTable(
  'irrigation_equipment_placements',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => irrigationEquipment.id, { onDelete: 'restrict' }),
    settingId: text('setting_id')
      .notNull()
      .references(() => irrigationEquipmentSettings.id, {
        onDelete: 'restrict',
      }),
    season: integer('season').notNull(),
    gardenGroupId: text('garden_group_id').references(() => gardenGroups.id, {
      onDelete: 'set null',
    }),
    otfZoneId: text('otf_zone_id').notNull(),
    otfPlotId: text('otf_plot_id').notNull(),
    anchorType: text('anchor_type', {
      enum: ['bed_center', 'between_beds'],
    }).notNull(),
    anchorBedOtfId: text('anchor_bed_otf_id'),
    beforeBedOtfId: text('before_bed_otf_id'),
    afterBedOtfId: text('after_bed_otf_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // 2.11 : date de pose (NULL pour une position antérieure, règle 7) et date
    // de retrait (NULL tant que le matériel est posé).
    placedAt: text('placed_at'),
    removedAt: text('removed_at'),
  },
  (table) => [
    uniqueIndex('uq_equipment_placements_equipment_season').on(
      table.equipmentId,
      table.season,
    ),
    index('idx_equipment_placements_workspace_season').on(
      table.workspaceId,
      table.season,
    ),
    check(
      'chk_equipment_placements_season',
      sql`${table.season} BETWEEN 1900 AND 9999`,
    ),
    check(
      'chk_equipment_placements_anchor',
      sql`(${table.anchorType} = 'bed_center' AND ${table.anchorBedOtfId} IS NOT NULL AND ${table.beforeBedOtfId} IS NULL AND ${table.afterBedOtfId} IS NULL) OR (${table.anchorType} = 'between_beds' AND ${table.anchorBedOtfId} IS NULL AND ${table.beforeBedOtfId} IS NOT NULL AND ${table.afterBedOtfId} IS NOT NULL)`,
    ),
    check(
      'chk_equipment_placements_anchor_type',
      sql`${table.anchorType} IN ('bed_center', 'between_beds')`,
    ),
  ],
);

/**
 * Registre des poses fermées (2.11, docs/equipment-placement-periods-contract.md) :
 * chaque retrait ou déplacement y copie la pose qui se ferme, en ajout seul.
 */
export const equipmentPlacementHistory = sqliteTable(
  'irrigation_equipment_placement_history',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => irrigationEquipment.id, { onDelete: 'restrict' }),
    placementId: text('placement_id').notNull(),
    season: integer('season').notNull(),
    placedAt: text('placed_at'),
    removedAt: text('removed_at').notNull(),
    poseSnapshot: text('pose_snapshot').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_placement_history_equipment_season').on(
      table.equipmentId,
      table.season,
      table.removedAt,
    ),
    check(
      'chk_placement_history_season',
      sql`${table.season} BETWEEN 1900 AND 9999`,
    ),
    check(
      'chk_placement_history_dates',
      sql`${table.placedAt} IS NULL OR ${table.placedAt} <= ${table.removedAt}`,
    ),
  ],
);

export const placementSelectedBeds = sqliteTable(
  'irrigation_placement_selected_beds',
  {
    placementId: text('placement_id')
      .notNull()
      .references(() => equipmentPlacements.id, { onDelete: 'cascade' }),
    otfZoneId: text('otf_zone_id').notNull(),
    otfPlotId: text('otf_plot_id').notNull(),
    otfBedId: text('otf_bed_id').notNull(),
    position: integer('position').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.placementId, table.otfBedId] }),
    uniqueIndex('uq_placement_selected_beds_position').on(
      table.placementId,
      table.position,
    ),
    index('idx_placement_selected_beds_otf_bed').on(table.otfBedId),
    check(
      'chk_placement_selected_beds_position',
      sql`${table.position} >= 1`,
    ),
  ],
);

export const irrigationEvents = sqliteTable(
  'irrigation_events',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    status: text('status', {
      enum: ['planned', 'partially_completed', 'completed', 'canceled'],
    })
      .notNull()
      .default('planned'),
    note: text('note'),
    remainingCanceledAt: text('remaining_canceled_at'),
    canceledAt: text('canceled_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_irrigation_events_workspace_season_status').on(
      table.workspaceId,
      table.season,
      table.status,
    ),
    check('chk_irrigation_events_season', sql`${table.season} BETWEEN 1900 AND 9999`),
    check(
      'chk_irrigation_events_cancel_state',
      sql`(${table.status} = 'canceled' AND ${table.canceledAt} IS NOT NULL) OR (${table.status} != 'canceled' AND ${table.canceledAt} IS NULL)`,
    ),
    check(
      'chk_irrigation_events_remaining_cancel_state',
      sql`${table.remainingCanceledAt} IS NULL OR ${table.status} = 'partially_completed'`,
    ),
    check(
      'chk_irrigation_events_status',
      sql`${table.status} IN ('planned', 'partially_completed', 'completed', 'canceled')`,
    ),
  ],
);

export const irrigationEventEquipment = sqliteTable(
  'irrigation_event_equipment',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => irrigationEvents.id, { onDelete: 'restrict' }),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => irrigationEquipment.id, { onDelete: 'restrict' }),
    settingId: text('setting_id')
      .notNull()
      .references(() => irrigationEquipmentSettings.id, {
        onDelete: 'restrict',
      }),
    placementId: text('placement_id')
      .notNull()
      .references(() => equipmentPlacements.id, { onDelete: 'restrict' }),
    status: text('status', {
      enum: ['planned', 'partially_completed', 'completed', 'canceled'],
    })
      .notNull()
      .default('planned'),
    plannedStartAt: text('planned_start_at'),
    plannedEndAt: text('planned_end_at'),
    actualStartAt: text('actual_start_at'),
    actualEndAt: text('actual_end_at'),
    plannedDurationMinutes: integer('planned_duration_minutes').notNull().default(0),
    actualDurationMinutes: integer('actual_duration_minutes').notNull().default(0),
    plannedDurationSeconds: integer('planned_duration_seconds').notNull().default(0),
    actualDurationSeconds: integer('actual_duration_seconds').notNull().default(0),
    timerState: text('timer_state', {
      enum: ['running', 'paused'],
    }),
    timerStartedAt: text('timer_started_at'),
    timerResumedAt: text('timer_resumed_at'),
    timerPausedAt: text('timer_paused_at'),
    timerTheoreticalEndAt: text('timer_theoretical_end_at'),
    timerAccumulatedSeconds: integer('timer_accumulated_seconds')
      .notNull()
      .default(0),
    timerAlarmRevision: text('timer_alarm_revision'),
    timerAlarmStatus: text('timer_alarm_status', {
      enum: ['pending', 'scheduled', 'failed', 'disabled'],
    }),
    timerAlarmSyncedAt: text('timer_alarm_synced_at'),
    lateAlarmDueAt: text('late_alarm_due_at'),
    pumpId: text('pump_id').references(
      (): AnySQLiteColumn => irrigationPumps.id,
      { onDelete: 'restrict' },
    ),
    pumpOriginId: text('pump_origin_id').references(
      (): AnySQLiteColumn => irrigationPumpOrigins.id,
      { onDelete: 'set null' },
    ),
    requestedFlowCubicMetersPerHour: real('requested_flow_cubic_meters_per_hour'),
    pumpSnapshot: text('pump_snapshot'),
    pumpOriginSnapshot: text('pump_origin_snapshot'),
    equipmentSnapshot: text('equipment_snapshot').notNull(),
    settingSnapshot: text('setting_snapshot').notNull(),
    placementSnapshot: text('placement_snapshot').notNull(),
    remainingCanceledAt: text('remaining_canceled_at'),
    canceledAt: text('canceled_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_irrigation_event_equipment_event').on(table.eventId),
    index('idx_irrigation_event_equipment_equipment_schedule').on(
      table.equipmentId,
      table.plannedStartAt,
      table.plannedEndAt,
    ),
    index('idx_irrigation_event_equipment_pump_schedule').on(
      table.pumpId,
      table.plannedStartAt,
      table.plannedEndAt,
    ),
    uniqueIndex('idx_irrigation_event_equipment_active_equipment')
      .on(table.equipmentId)
      .where(sql`${table.timerState} IS NOT NULL`),
    check(
      'chk_irrigation_event_equipment_durations',
      sql`${table.plannedDurationMinutes} >= 0 AND ${table.actualDurationMinutes} >= 0`,
    ),
    check(
      'chk_irrigation_event_equipment_planned_dates',
      sql`(${table.plannedStartAt} IS NULL AND ${table.plannedEndAt} IS NULL) OR (${table.plannedStartAt} IS NOT NULL AND ${table.plannedEndAt} IS NOT NULL AND ${table.plannedEndAt} > ${table.plannedStartAt})`,
    ),
    check(
      'chk_irrigation_event_equipment_actual_dates',
      sql`(${table.actualStartAt} IS NULL AND ${table.actualEndAt} IS NULL) OR (${table.actualStartAt} IS NOT NULL AND ${table.actualEndAt} IS NOT NULL AND ${table.actualEndAt} > ${table.actualStartAt})`,
    ),
    check(
      'chk_irrigation_event_equipment_cancel_state',
      sql`(${table.status} = 'canceled' AND ${table.canceledAt} IS NOT NULL) OR (${table.status} != 'canceled' AND ${table.canceledAt} IS NULL)`,
    ),
    check(
      'chk_irrigation_event_equipment_remaining_cancel_state',
      sql`${table.remainingCanceledAt} IS NULL OR ${table.status} = 'partially_completed'`,
    ),
    check(
      'chk_irrigation_event_equipment_status',
      sql`${table.status} IN ('planned', 'partially_completed', 'completed', 'canceled')`,
    ),
    check(
      'chk_irrigation_event_equipment_alarm_status',
      sql`${table.timerAlarmStatus} IS NULL OR ${table.timerAlarmStatus} IN ('pending', 'scheduled', 'failed', 'disabled')`,
    ),
  ],
);

export const irrigationBedApplications = sqliteTable(
  'irrigation_bed_applications',
  {
    eventEquipmentId: text('event_equipment_id')
      .notNull()
      .references(() => irrigationEventEquipment.id, { onDelete: 'restrict' }),
    otfZoneId: text('otf_zone_id').notNull(),
    otfPlotId: text('otf_plot_id').notNull(),
    otfBedId: text('otf_bed_id').notNull(),
    rateMmPerHour: real('rate_mm_per_hour').notNull(),
    bedAreaSquareMeters: real('bed_area_square_meters').notNull(),
    // Surface qui convertit les millimètres en volume (docs/wetted-surface-contract.md) :
    // la planche seule en goutte-à-goutte, planche et passe-pied en aspersion,
    // NULL quand le passe-pied n'était pas connu à l'enregistrement.
    wettedAreaSquareMeters: real('wetted_area_square_meters'),
    plannedAmountMm: real('planned_amount_mm').notNull().default(0),
    actualAmountMm: real('actual_amount_mm').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.eventEquipmentId, table.otfBedId] }),
    index('idx_irrigation_bed_applications_otf_bed').on(table.otfBedId),
    check(
      'chk_irrigation_bed_applications_non_negative',
      sql`${table.rateMmPerHour} >= 0 AND ${table.bedAreaSquareMeters} > 0 AND ${table.plannedAmountMm} >= 0 AND ${table.actualAmountMm} >= 0`,
    ),
  ],
);

export const irrigationEventLog = sqliteTable(
  'irrigation_event_log',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => irrigationEvents.id, { onDelete: 'restrict' }),
    actorUserId: text('actor_user_id').notNull(),
    action: text('action', {
      enum: ['created', 'updated', 'partially_completed', 'completed', 'canceled'],
    }).notNull(),
    payload: text('payload').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_irrigation_event_log_event').on(table.eventId),
    check(
      'chk_irrigation_event_log_action',
      sql`${table.action} IN ('created', 'updated', 'partially_completed', 'completed', 'canceled')`,
    ),
  ],
);

export const hydricGoalRevisions = sqliteTable(
  'irrigation_hydric_goal_revisions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    weekStart: text('week_start').notNull(),
    scopeType: text('scope_type', {
      enum: ['farm', 'zone', 'plot', 'bed'],
    }).notNull(),
    otfZoneId: text('otf_zone_id'),
    otfPlotId: text('otf_plot_id'),
    otfBedId: text('otf_bed_id'),
    amountMm: real('amount_mm'),
    action: text('action', { enum: ['set', 'cleared'] }).notNull(),
    copiedFromGoalId: text('copied_from_goal_id'),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(),
    /** `null` : saisie à la main ; `adopted-proposal` : proposition adoptée (5 quater, migration 0024). */
    origin: text('origin', { enum: ['adopted-proposal'] }),
  },
  (table) => [
    index('idx_hydric_goals_workspace_week').on(
      table.workspaceId,
      table.season,
      table.weekStart,
      table.createdAt,
    ),
    check('chk_hydric_goals_season', sql`${table.season} BETWEEN 1900 AND 9999`),
    check(
      'chk_hydric_goals_action',
      sql`(${table.action} = 'set' AND ${table.amountMm} IS NOT NULL AND ${table.amountMm} >= 0) OR (${table.action} = 'cleared' AND ${table.amountMm} IS NULL)`,
    ),
    check(
      'chk_hydric_goals_scope',
      sql`(${table.scopeType} = 'farm' AND ${table.otfZoneId} IS NULL AND ${table.otfPlotId} IS NULL AND ${table.otfBedId} IS NULL) OR (${table.scopeType} = 'zone' AND ${table.otfZoneId} IS NOT NULL AND ${table.otfPlotId} IS NULL AND ${table.otfBedId} IS NULL) OR (${table.scopeType} = 'plot' AND ${table.otfZoneId} IS NOT NULL AND ${table.otfPlotId} IS NOT NULL AND ${table.otfBedId} IS NULL) OR (${table.scopeType} = 'bed' AND ${table.otfZoneId} IS NOT NULL AND ${table.otfPlotId} IS NOT NULL AND ${table.otfBedId} IS NOT NULL)`,
    ),
  ],
);

export const weatherPreferences = sqliteTable(
  'irrigation_weather_preferences',
  {
    workspaceId: text('workspace_id')
      .primaryKey()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    locationMode: text('location_mode', { enum: ['otf', 'custom'] })
      .notNull()
      .default('otf'),
    customCity: text('custom_city'),
    customPostcode: text('custom_postcode'),
    lastRefreshAttemptAt: text('last_refresh_attempt_at'),
    lastSuccessfulRefreshAt: text('last_successful_refresh_at'),
    lastRefreshError: text('last_refresh_error'),
    refreshNotBeforeAt: text('refresh_not_before_at'),
    lastAutomaticRefreshAttemptAt: text('last_automatic_refresh_attempt_at'),
    lastAutomaticRefreshSuccessAt: text('last_automatic_refresh_success_at'),
    lastAutomaticRefreshError: text('last_automatic_refresh_error'),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      'chk_weather_preferences_location',
      sql`(${table.locationMode} = 'otf' AND ${table.customCity} IS NULL AND ${table.customPostcode} IS NULL) OR (${table.locationMode} = 'custom' AND ${table.customCity} IS NOT NULL)`,
    ),
  ],
);

export const backgroundJobs = sqliteTable('irrigation_background_jobs', {
  jobKey: text('job_key').primaryKey(),
  lockToken: text('lock_token'),
  lockExpiresAt: text('lock_expires_at'),
  lastStartedAt: text('last_started_at'),
  lastCompletedAt: text('last_completed_at'),
  lastSuccessfulAt: text('last_successful_at'),
  lastError: text('last_error'),
  updatedAt: updatedAt(),
});

export const weatherGeocodes = sqliteTable(
  'irrigation_weather_geocodes',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    locationKey: text('location_key').notNull(),
    displayName: text('display_name').notNull(),
    city: text('city').notNull(),
    postcode: text('postcode'),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    timezone: text('timezone').notNull(),
    source: text('source').notNull(),
    resolvedAt: text('resolved_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.locationKey] }),
    check('chk_weather_geocode_latitude', sql`${table.latitude} BETWEEN -90 AND 90`),
    check('chk_weather_geocode_longitude', sql`${table.longitude} BETWEEN -180 AND 180`),
  ],
);

export const weatherDailyValues = sqliteTable(
  'irrigation_weather_daily_values',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    locationKey: text('location_key').notNull(),
    date: text('date').notNull(),
    dataKind: text('data_kind', {
      enum: ['forecast', 'reanalysis', 'manual_precipitation'],
    }).notNull(),
    precipitationMm: real('precipitation_mm'),
    et0Mm: real('et0_mm'),
    // Alertes météo (5 bis, migration 0022) : températures prévues, nulles quand absentes.
    minimumTemperatureCelsius: real('minimum_temperature_celsius'),
    maximumTemperatureCelsius: real('maximum_temperature_celsius'),
    // Aspersions à reconsidérer (5 quinquies, migration 0026) : énergie solaire prévue du jour, nulle quand absente.
    solarEnergyMjPerSquareMeter: real('solar_energy_mj_per_square_meter'),
    source: text('source').notNull(),
    fetchedAt: text('fetched_at').notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.locationKey, table.date, table.dataKind] }),
    index('idx_weather_daily_workspace_date').on(table.workspaceId, table.date),
    check(
      'chk_weather_daily_values_non_negative',
      sql`(${table.precipitationMm} IS NULL OR ${table.precipitationMm} >= 0) AND (${table.et0Mm} IS NULL OR ${table.et0Mm} >= 0)`,
    ),
    check(
      'chk_weather_daily_manual',
      sql`${table.dataKind} != 'manual_precipitation' OR (${table.precipitationMm} IS NOT NULL AND ${table.et0Mm} IS NULL)`,
    ),
  ],
);

export const dailyWaterLimitRevisions = sqliteTable(
  'irrigation_daily_water_limit_revisions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    maxCubicMetersPerDay: real('max_cubic_meters_per_day'),
    validFrom: text('valid_from').notNull(),
    validUntil: text('valid_until'),
    note: text('note'),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_daily_limit_workspace_period').on(
      table.workspaceId,
      table.season,
      table.validFrom,
      table.validUntil,
      table.createdAt,
    ),
    check('chk_daily_limit_season', sql`${table.season} BETWEEN 1900 AND 9999`),
    check('chk_daily_limit_period', sql`${table.validUntil} IS NULL OR ${table.validUntil} >= ${table.validFrom}`),
    check(
      'chk_daily_limit_amount',
      sql`(${table.enabled} = 1 AND ${table.maxCubicMetersPerDay} IS NOT NULL AND ${table.maxCubicMetersPerDay} > 0) OR (${table.enabled} = 0 AND ${table.maxCubicMetersPerDay} IS NULL)`,
    ),
  ],
);

export const waterResources = sqliteTable(
  'irrigation_water_resources',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['borehole', 'well', 'spring', 'network', 'catchment', 'river', 'other'],
    }).notNull(),
    nominalFlowCubicMetersPerHour: real('nominal_flow_cubic_meters_per_hour').notNull(),
    status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
    availableFrom: text('available_from'),
    availableUntil: text('available_until'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_water_resources_workspace_status').on(table.workspaceId, table.status),
    uniqueIndex('uq_water_resources_workspace_name').on(table.workspaceId, table.name),
    check('chk_water_resources_flow', sql`${table.nominalFlowCubicMetersPerHour} >= 0`),
    check('chk_water_resources_status', sql`${table.status} IN ('active', 'inactive')`),
    check('chk_water_resources_period', sql`${table.availableUntil} IS NULL OR ${table.availableFrom} IS NULL OR ${table.availableUntil} >= ${table.availableFrom}`),
  ],
);

export const waterResourceLimitRevisions = sqliteTable(
  'irrigation_water_resource_limit_revisions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    resourceId: text('resource_id')
      .notNull()
      .references(() => waterResources.id, { onDelete: 'restrict' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    maxCubicMetersPerDay: real('max_cubic_meters_per_day'),
    validFrom: text('valid_from').notNull(),
    validUntil: text('valid_until'),
    referenceNote: text('reference_note'),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_water_resource_limits_resource_period').on(
      table.resourceId,
      table.validFrom,
      table.validUntil,
      table.createdAt,
    ),
    index('idx_water_resource_limits_workspace').on(table.workspaceId),
    check('chk_water_resource_limits_period', sql`${table.validUntil} IS NULL OR ${table.validUntil} >= ${table.validFrom}`),
    check(
      'chk_water_resource_limits_amount',
      sql`(${table.enabled} = 1 AND ${table.maxCubicMetersPerDay} IS NOT NULL AND ${table.maxCubicMetersPerDay} > 0) OR (${table.enabled} = 0 AND ${table.maxCubicMetersPerDay} IS NULL)`,
    ),
  ],
);

export const waterResourceMeterReadings = sqliteTable(
  'irrigation_water_resource_meter_readings',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    resourceId: text('resource_id')
      .notNull()
      .references(() => waterResources.id, { onDelete: 'restrict' }),
    takenAt: text('taken_at').notNull(),
    meterIndexCubicMeters: real('meter_index_cubic_meters').notNull(),
    stoppedSeconds: integer('stopped_seconds'),
    meterReplaced: integer('meter_replaced', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('idx_resource_meter_readings_instant').on(table.resourceId, table.takenAt),
    index('idx_resource_meter_readings_workspace').on(table.workspaceId),
    check('chk_resource_meter_readings_index', sql`${table.meterIndexCubicMeters} >= 0`),
    check('chk_resource_meter_readings_stopped', sql`${table.stoppedSeconds} IS NULL OR ${table.stoppedSeconds} >= 0`),
  ],
);

export const waterResourceFlowRevisions = sqliteTable(
  'irrigation_water_resource_flow_revisions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    resourceId: text('resource_id')
      .notNull()
      .references(() => waterResources.id, { onDelete: 'restrict' }),
    flowCubicMetersPerHour: real('flow_cubic_meters_per_hour').notNull(),
    validFrom: text('valid_from').notNull(),
    validUntil: text('valid_until'),
    fromReadingId: text('from_reading_id').references((): AnySQLiteColumn => waterResourceMeterReadings.id, { onDelete: 'set null' }),
    toReadingId: text('to_reading_id').references((): AnySQLiteColumn => waterResourceMeterReadings.id, { onDelete: 'set null' }),
    referenceNote: text('reference_note'),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_resource_flow_revisions_resource_period').on(
      table.resourceId,
      table.validFrom,
      table.validUntil,
      table.createdAt,
    ),
    index('idx_resource_flow_revisions_workspace').on(table.workspaceId),
    check('chk_resource_flow_revisions_flow', sql`${table.flowCubicMetersPerHour} >= 0`),
    check('chk_resource_flow_revisions_period', sql`${table.validUntil} IS NULL OR ${table.validUntil} >= ${table.validFrom}`),
  ],
);

export const waterReservoirs = sqliteTable(
  'irrigation_water_reservoirs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['buffer', 'pond', 'cistern', 'tank', 'reservoir', 'other'],
    }).notNull(),
    capacityCubicMeters: real('capacity_cubic_meters').notNull(),
    currentVolumeCubicMeters: real('current_volume_cubic_meters'),
    currentVolumeObservedAt: text('current_volume_observed_at'),
    minimumSafetyCubicMeters: real('minimum_safety_cubic_meters').notNull().default(0),
    exposedSurfaceSquareMeters: real('exposed_surface_square_meters').notNull().default(0),
    receivesRain: integer('receives_rain', { mode: 'boolean' }).notNull().default(false),
    evaporationEnabled: integer('evaporation_enabled', { mode: 'boolean' }).notNull().default(false),
    evaporationCoefficient: real('evaporation_coefficient').notNull().default(1),
    status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_water_reservoirs_workspace_status').on(table.workspaceId, table.status),
    uniqueIndex('uq_water_reservoirs_workspace_name').on(table.workspaceId, table.name),
    check('chk_water_reservoirs_capacity', sql`${table.capacityCubicMeters} > 0`),
    check('chk_water_reservoirs_current_volume', sql`${table.currentVolumeCubicMeters} IS NULL OR (${table.currentVolumeCubicMeters} >= 0 AND ${table.currentVolumeCubicMeters} <= ${table.capacityCubicMeters})`),
    check('chk_water_reservoirs_observation', sql`(${table.currentVolumeCubicMeters} IS NULL AND ${table.currentVolumeObservedAt} IS NULL) OR (${table.currentVolumeCubicMeters} IS NOT NULL AND ${table.currentVolumeObservedAt} IS NOT NULL)`),
    check('chk_water_reservoirs_minimum', sql`${table.minimumSafetyCubicMeters} >= 0 AND ${table.minimumSafetyCubicMeters} <= ${table.capacityCubicMeters}`),
    check('chk_water_reservoirs_surface', sql`${table.exposedSurfaceSquareMeters} >= 0`),
    check('chk_water_reservoirs_coefficient', sql`${table.evaporationCoefficient} >= 0`),
    check('chk_water_reservoirs_status', sql`${table.status} IN ('active', 'inactive')`),
  ],
);

export const irrigationPumps = sqliteTable(
  'irrigation_pumps',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    maximumFlowCubicMetersPerHour: real('maximum_flow_cubic_meters_per_hour').notNull(),
    status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
    archivedAt: text('archived_at'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_irrigation_pumps_workspace_status').on(table.workspaceId, table.status),
    uniqueIndex('uq_irrigation_pumps_workspace_name').on(table.workspaceId, table.name),
    check('chk_irrigation_pumps_flow', sql`${table.maximumFlowCubicMetersPerHour} > 0`),
    check('chk_irrigation_pumps_status', sql`${table.status} IN ('active', 'archived')`),
    check(
      'chk_irrigation_pumps_archive_state',
      sql`(${table.status} = 'active' AND ${table.archivedAt} IS NULL) OR (${table.status} = 'archived' AND ${table.archivedAt} IS NOT NULL)`,
    ),
  ],
);

export const irrigationPumpOrigins = sqliteTable(
  'irrigation_pump_origins',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    pumpId: text('pump_id')
      .notNull()
      .references(() => irrigationPumps.id, { onDelete: 'cascade' }),
    sourceKind: text('source_kind', { enum: ['resource', 'reservoir'] }).notNull(),
    resourceId: text('resource_id').references(() => waterResources.id, { onDelete: 'restrict' }),
    reservoirId: text('reservoir_id').references(() => waterReservoirs.id, { onDelete: 'restrict' }),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_irrigation_pump_origins_workspace').on(table.workspaceId),
    index('idx_irrigation_pump_origins_pump').on(table.pumpId),
    uniqueIndex('uq_irrigation_pump_origin_resource')
      .on(table.pumpId, table.resourceId)
      .where(sql`${table.resourceId} IS NOT NULL`),
    uniqueIndex('uq_irrigation_pump_origin_reservoir')
      .on(table.pumpId, table.reservoirId)
      .where(sql`${table.reservoirId} IS NOT NULL`),
    uniqueIndex('uq_irrigation_pump_origin_default')
      .on(table.pumpId)
      .where(sql`${table.isDefault} = 1`),
    check(
      'chk_irrigation_pump_origin_source',
      sql`(${table.sourceKind} = 'resource' AND ${table.resourceId} IS NOT NULL AND ${table.reservoirId} IS NULL) OR (${table.sourceKind} = 'reservoir' AND ${table.resourceId} IS NULL AND ${table.reservoirId} IS NOT NULL)`,
    ),
  ],
);

export const irrigationEquipmentPumpDefaults = sqliteTable(
  'irrigation_equipment_pump_defaults',
  {
    equipmentId: text('equipment_id')
      .primaryKey()
      .references(() => irrigationEquipment.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    pumpId: text('pump_id')
      .notNull()
      .references(() => irrigationPumps.id, { onDelete: 'restrict' }),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_irrigation_equipment_pump_defaults_workspace').on(table.workspaceId),
    index('idx_irrigation_equipment_pump_defaults_pump').on(table.pumpId),
  ],
);

export const irrigationPumpLog = sqliteTable(
  'irrigation_pump_log',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    pumpId: text('pump_id')
      .references(() => irrigationPumps.id, { onDelete: 'restrict' }),
    action: text('action', { enum: ['created', 'updated', 'archived', 'restored', 'configured'] }).notNull(),
    payload: text('payload').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_irrigation_pump_log_entity').on(table.workspaceId, table.pumpId, table.createdAt),
  ],
);

export const waterResourceReservoirLinks = sqliteTable(
  'irrigation_water_resource_reservoir_links',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    resourceId: text('resource_id')
      .notNull()
      .references(() => waterResources.id, { onDelete: 'restrict' }),
    reservoirId: text('reservoir_id')
      .notNull()
      .references(() => waterReservoirs.id, { onDelete: 'restrict' }),
    fillMode: text('fill_mode', { enum: ['automatic', 'manual'] }).notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_water_resource_reservoir_link').on(table.resourceId, table.reservoirId),
    index('idx_water_resource_links_workspace').on(table.workspaceId),
    index('idx_water_resource_links_reservoir').on(table.reservoirId),
    check('chk_water_resource_links_mode', sql`${table.fillMode} IN ('automatic', 'manual')`),
  ],
);

export const waterReservoirLinks = sqliteTable(
  'irrigation_water_reservoir_links',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    upstreamReservoirId: text('upstream_reservoir_id')
      .notNull()
      .references((): AnySQLiteColumn => waterReservoirs.id, { onDelete: 'restrict' }),
    downstreamReservoirId: text('downstream_reservoir_id')
      .notNull()
      .references((): AnySQLiteColumn => waterReservoirs.id, { onDelete: 'restrict' }),
    transferMode: text('transfer_mode', { enum: ['automatic', 'manual'] }).notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_water_reservoir_link').on(table.upstreamReservoirId, table.downstreamReservoirId),
    index('idx_water_reservoir_links_workspace').on(table.workspaceId),
    index('idx_water_reservoir_links_downstream').on(table.downstreamReservoirId),
    check('chk_water_reservoir_links_distinct', sql`${table.upstreamReservoirId} != ${table.downstreamReservoirId}`),
    check('chk_water_reservoir_links_mode', sql`${table.transferMode} IN ('automatic', 'manual')`),
  ],
);

export const waterIrrigationSupplyDefaults = sqliteTable(
  'irrigation_water_supply_defaults',
  {
    workspaceId: text('workspace_id')
      .primaryKey()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    sourceKind: text('source_kind', { enum: ['resource', 'reservoir'] }).notNull(),
    resourceId: text('resource_id').references(() => waterResources.id, { onDelete: 'restrict' }),
    reservoirId: text('reservoir_id').references(() => waterReservoirs.id, { onDelete: 'restrict' }),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      'chk_water_supply_default_source',
      sql`(${table.sourceKind} = 'resource' AND ${table.resourceId} IS NOT NULL AND ${table.reservoirId} IS NULL) OR (${table.sourceKind} = 'reservoir' AND ${table.resourceId} IS NULL AND ${table.reservoirId} IS NOT NULL)`,
    ),
  ],
);

export const waterStockMovements = sqliteTable(
  'irrigation_water_stock_movements',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    reservoirId: text('reservoir_id')
      .references(() => waterReservoirs.id, { onDelete: 'restrict' }),
    resourceId: text('resource_id').references(() => waterResources.id, { onDelete: 'restrict' }),
    kind: text('kind', {
      enum: ['resource_input', 'direct_irrigation_withdrawal', 'rain', 'irrigation_output', 'evaporation', 'overflow', 'manual_correction', 'transfer_in', 'transfer_out'],
    }).notNull(),
    volumeDeltaCubicMeters: real('volume_delta_cubic_meters').notNull(),
    occurredAt: text('occurred_at').notNull(),
    previousVolumeCubicMeters: real('previous_volume_cubic_meters'),
    resultingVolumeCubicMeters: real('resulting_volume_cubic_meters'),
    reason: text('reason'),
    actorUserId: text('actor_user_id'),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_water_stock_movements_reservoir_time').on(table.reservoirId, table.occurredAt),
    index('idx_water_stock_movements_resource_time').on(table.resourceId, table.occurredAt),
    index('idx_water_stock_movements_workspace').on(table.workspaceId),
    check('chk_water_stock_movements_non_zero', sql`${table.volumeDeltaCubicMeters} != 0 OR ${table.kind} = 'manual_correction'`),
    check('chk_water_stock_movements_target', sql`${table.reservoirId} IS NOT NULL OR (${table.kind} = 'direct_irrigation_withdrawal' AND ${table.resourceId} IS NOT NULL)`),
  ],
);

export const waterInfrastructureLog = sqliteTable(
  'irrigation_water_infrastructure_log',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    entityType: text('entity_type', {
      enum: ['resource', 'reservoir', 'resource_reservoir_link', 'reservoir_link', 'supply_default'],
    }).notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action', { enum: ['created', 'updated', 'configured'] }).notNull(),
    payload: text('payload').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_water_infrastructure_log_entity').on(table.workspaceId, table.entityType, table.entityId, table.createdAt),
  ],
);

// Planning hebdomadaire (3.5) : réglages avec leur journal, calculs et propositions
// versionnées par calcul, distinctes de l'historique réel (docs/planning-contract.md).
export const irrigationPlanningSettings = sqliteTable(
  'irrigation_planning_settings',
  {
    workspaceId: text('workspace_id').primaryKey().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    payload: text('payload').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [check('chk_planning_settings_payload', sql`json_valid(${table.payload}) AND json_type(${table.payload}) = 'object'`)],
);

export const irrigationPlanningSettingsLog = sqliteTable(
  'irrigation_planning_settings_log',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    payload: text('payload').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_planning_settings_log_workspace').on(table.workspaceId, table.createdAt),
    check('chk_planning_settings_log_payload', sql`json_valid(${table.payload}) AND json_type(${table.payload}) = 'object'`),
  ],
);

/** Les jours d'un créneau protégé, un indicateur 0 ou 1 par jour (migration 0030). */
const protectedSlotDays = () => ({
  monday: integer('monday').notNull(),
  tuesday: integer('tuesday').notNull(),
  wednesday: integer('wednesday').notNull(),
  thursday: integer('thursday').notNull(),
  friday: integer('friday').notNull(),
  saturday: integer('saturday').notNull(),
  sunday: integer('sunday').notNull(),
});

/** Les créneaux protégés nommés d'une exploitation (3.8 ter, docs/protected-slots-contract.md, section 5). */
export const irrigationProtectedSlots = sqliteTable(
  'irrigation_protected_slots',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    ...protectedSlotDays(),
    startMinute: integer('start_minute').notNull(),
    endMinute: integer('end_minute').notNull(),
    status: text('status').notNull().default('active'),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_protected_slots_workspace').on(table.workspaceId, table.status),
    check('chk_protected_slot_status', sql`${table.status} IN ('active', 'deleted')`),
  ],
);

/** Chaque version d'un créneau protégé, valeurs comprises : création, modification, suppression. */
export const irrigationProtectedSlotsLog = sqliteTable(
  'irrigation_protected_slots_log',
  {
    id: text('id').primaryKey(),
    slotId: text('slot_id').notNull().references(() => irrigationProtectedSlots.id, { onDelete: 'restrict' }),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    change: text('change').notNull(),
    name: text('name').notNull(),
    ...protectedSlotDays(),
    startMinute: integer('start_minute').notNull(),
    endMinute: integer('end_minute').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_protected_slots_log_workspace').on(table.workspaceId, table.createdAt),
    check('chk_protected_slot_log_change', sql`${table.change} IN ('created', 'updated', 'deleted')`),
  ],
);

export const irrigationPlanCalculations = sqliteTable(
  'irrigation_plan_calculations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    weekStart: text('week_start').notNull(),
    trigger: text('trigger', { enum: ['manual', 'daily', 'event'] }).notNull(),
    /** Le nom de l'événement qui a déclenché un calcul « sur événement » (3.7, règle 7) ; nul pour les autres déclencheurs et les calculs antérieurs. */
    triggerEvent: text('trigger_event'),
    computedAt: text('computed_at').notNull(),
    horizonStartAt: text('horizon_start_at').notNull(),
    horizonEndAt: text('horizon_end_at').notNull(),
    settings: text('settings').notNull(),
    summary: text('summary').notNull(),
    actorUserId: text('actor_user_id'),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_plan_calculations_week').on(table.workspaceId, table.season, table.weekStart, table.computedAt),
    check('chk_plan_calculation_season', sql`${table.season} BETWEEN 1900 AND 9999`),
    check('chk_plan_calculation_trigger', sql`${table.trigger} IN ('manual', 'daily', 'event')`),
    check('chk_plan_calculation_horizon', sql`${table.horizonEndAt} >= ${table.horizonStartAt}`),
    check('chk_plan_calculation_json', sql`json_valid(${table.settings}) AND json_valid(${table.summary})`),
  ],
);

export const irrigationPlanProposals = sqliteTable(
  'irrigation_plan_proposals',
  {
    id: text('id').primaryKey(),
    calculationId: text('calculation_id').notNull().references(() => irrigationPlanCalculations.id, { onDelete: 'restrict' }),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    weekStart: text('week_start').notNull(),
    localId: text('local_id').notNull(),
    equipmentId: text('equipment_id').notNull(),
    equipmentName: text('equipment_name').notNull(),
    kind: text('kind', { enum: ['sprinkler', 'drip'] }).notNull(),
    settingId: text('setting_id').notNull(),
    settingName: text('setting_name').notNull(),
    placementId: text('placement_id').notNull(),
    startAt: text('start_at').notNull(),
    endAt: text('end_at').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    doseMm: real('dose_mm').notNull(),
    volumeCubicMeters: real('volume_cubic_meters'),
    flowCubicMetersPerHour: real('flow_cubic_meters_per_hour'),
    pumpId: text('pump_id'),
    pumpOriginId: text('pump_origin_id'),
    status: text('status', { enum: ['proposed', 'validated', 'refused', 'replaced', 'expired'] }).notNull().default('proposed'),
    payload: text('payload').notNull(),
    validatedEventId: text('validated_event_id'),
    replacedByCalculationId: text('replaced_by_calculation_id'),
    decidedAt: text('decided_at'),
    actorUserId: text('actor_user_id'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('uq_plan_proposal_local').on(table.calculationId, table.localId),
    index('idx_plan_proposals_week_status').on(table.workspaceId, table.season, table.weekStart, table.status),
    check('chk_plan_proposal_season', sql`${table.season} BETWEEN 1900 AND 9999`),
    check('chk_plan_proposal_kind', sql`${table.kind} IN ('sprinkler', 'drip')`),
    check('chk_plan_proposal_status', sql`${table.status} IN ('proposed', 'validated', 'refused', 'replaced', 'expired')`),
    check('chk_plan_proposal_interval', sql`${table.endAt} > ${table.startAt} AND ${table.durationSeconds} > 0`),
    check('chk_plan_proposal_quantities', sql`${table.doseMm} >= 0 AND (${table.volumeCubicMeters} IS NULL OR ${table.volumeCubicMeters} >= 0) AND (${table.flowCubicMetersPerHour} IS NULL OR ${table.flowCubicMetersPerHour} >= 0)`),
    check('chk_plan_proposal_payload', sql`json_valid(${table.payload}) AND json_type(${table.payload}) = 'object'`),
    check('chk_plan_proposal_decision', sql`(${table.status} IN ('validated', 'refused') AND ${table.decidedAt} IS NOT NULL) OR (${table.status} NOT IN ('validated', 'refused') AND ${table.validatedEventId} IS NULL)`),
  ],
);

/**
 * Les événements qui font recalculer le plan (3.7, docs/replanning-contract.md,
 * règles 4 à 8) : le nom, l'heure et le sort du recalcul de chacun, dans la
 * semaine et la saison qu'il concerne. L'événement lui-même vit dans sa table.
 */
export const irrigationPlanEvents = sqliteTable(
  'irrigation_plan_events',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    weekStart: text('week_start').notNull(),
    kind: text('kind').notNull(),
    occurredAt: text('occurred_at').notNull(),
    status: text('status', { enum: ['pending', 'recalculated', 'failed'] }).notNull().default('pending'),
    calculationId: text('calculation_id').references(() => irrigationPlanCalculations.id, { onDelete: 'restrict' }),
    settledAt: text('settled_at'),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_plan_events_week').on(table.workspaceId, table.season, table.weekStart, table.occurredAt),
    check('chk_plan_event_season', sql`${table.season} BETWEEN 1900 AND 9999`),
    check('chk_plan_event_status', sql`${table.status} IN ('pending', 'recalculated', 'failed')`),
    check('chk_plan_event_settlement', sql`(${table.status} = 'pending' AND ${table.calculationId} IS NULL AND ${table.settledAt} IS NULL) OR (${table.status} = 'recalculated' AND ${table.calculationId} IS NOT NULL AND ${table.settledAt} IS NOT NULL) OR (${table.status} = 'failed' AND ${table.calculationId} IS NULL AND ${table.settledAt} IS NOT NULL)`),
  ],
);

/**
 * « Garder » une suggestion du planning (3.7, docs/replanning-contract.md,
 * règle 17) : par irrigation planifiée, la suggestion tue avec sa dose.
 */
export const irrigationPlanSuggestionKeeps = sqliteTable(
  'irrigation_plan_suggestion_keeps',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    eventEquipmentId: text('event_equipment_id').notNull().references(() => irrigationEventEquipment.id, { onDelete: 'restrict' }),
    suggestion: text('suggestion', { enum: ['cancel', 'reduce'] }).notNull(),
    doseMm: real('dose_mm'),
    actorUserId: text('actor_user_id'),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_plan_suggestion_keeps_season').on(table.workspaceId, table.season, table.eventEquipmentId),
    check('chk_plan_keep_season', sql`${table.season} BETWEEN 1900 AND 9999`),
    check('chk_plan_keep_suggestion', sql`${table.suggestion} IN ('cancel', 'reduce')`),
    check('chk_plan_keep_dose', sql`(${table.suggestion} = 'cancel' AND ${table.doseMm} IS NULL) OR (${table.suggestion} = 'reduce' AND ${table.doseMm} IS NOT NULL AND ${table.doseMm} > 0)`),
  ],
);

/**
 * Alertes météo paramétrables (5 bis, docs/weather-alerts-contract.md, D-050) :
 * le critère d'une exploitation, ses versions immuables, et une alerte au plus
 * par version et par jour visé.
 */
export const weatherAlertCriteria = sqliteTable(
  'irrigation_weather_alert_criteria',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    currentVersion: integer('current_version').notNull(),
    active: integer('active').notNull().default(1),
    deletedAt: text('deleted_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_weather_alert_criteria_workspace').on(table.workspaceId, table.deletedAt),
    check('chk_weather_alert_criteria_version', sql`${table.currentVersion} >= 1`),
    check('chk_weather_alert_criteria_active', sql`${table.active} IN (0, 1)`),
  ],
);

export const weatherAlertCriterionVersions = sqliteTable(
  'irrigation_weather_alert_criterion_versions',
  {
    criterionId: text('criterion_id').notNull().references(() => weatherAlertCriteria.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    field: text('field', { enum: ['minimum-temperature', 'maximum-temperature', 'precipitation'] }).notNull(),
    direction: text('direction', { enum: ['below', 'above'] }).notNull(),
    threshold: real('threshold').notNull(),
    horizonDays: integer('horizon_days').notNull(),
    label: text('label'),
    actorUserId: text('actor_user_id'),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.criterionId, table.version] }),
    check('chk_weather_alert_version_number', sql`${table.version} >= 1`),
    check('chk_weather_alert_version_field', sql`${table.field} IN ('minimum-temperature', 'maximum-temperature', 'precipitation')`),
    check('chk_weather_alert_version_direction', sql`${table.direction} IN ('below', 'above')`),
    check('chk_weather_alert_version_threshold', sql`(${table.field} = 'precipitation' AND ${table.threshold} BETWEEN 0 AND 300) OR (${table.field} != 'precipitation' AND ${table.threshold} BETWEEN -30 AND 50)`),
    check('chk_weather_alert_version_horizon', sql`${table.horizonDays} BETWEEN 1 AND 7`),
    check('chk_weather_alert_version_label', sql`${table.label} IS NULL OR length(${table.label}) BETWEEN 1 AND 60`),
  ],
);

export const weatherAlerts = sqliteTable(
  'irrigation_weather_alerts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    criterionId: text('criterion_id').notNull(),
    criterionVersion: integer('criterion_version').notNull(),
    targetDate: text('target_date').notNull(),
    forecastValue: real('forecast_value').notNull(),
    unit: text('unit', { enum: ['°C', 'mm'] }).notNull(),
    forecastedAt: text('forecasted_at').notNull(),
    sentAt: text('sent_at').notNull(),
    deliveryStatus: text('delivery_status', { enum: ['pending', 'sent', 'no-subscriber', 'retrying', 'failed'] }).notNull().default('pending'),
  },
  (table) => [
    uniqueIndex('uq_weather_alert_criterion_day').on(table.criterionId, table.criterionVersion, table.targetDate),
    index('idx_weather_alerts_workspace_sent').on(table.workspaceId, table.sentAt),
    check('chk_weather_alert_unit', sql`${table.unit} IN ('°C', 'mm')`),
    check('chk_weather_alert_status', sql`${table.deliveryStatus} IN ('pending', 'sent', 'no-subscriber', 'retrying', 'failed')`),
  ],
);

// Extension 5 quater, le besoin en eau par culture et par stade (migration 0023,
// docs/crop-water-need-contract.md). Les clés étrangères composées des tables
// de référence sont dans le SQL ; le test de dérive compare colonnes et clés.
export const cropReferenceCrops = sqliteTable(
  'irrigation_crop_reference_crops',
  {
    id: text('id').primaryKey(),
    cropKey: text('crop_key').notNull(),
    workspaceId: text('workspace_id').references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    source: text('source', { enum: ['criiam', 'fao56', 'local'] }).notNull(),
    curveShape: text('curve_shape', { enum: ['steps', 'trapezoid', 'calendar'] }).notNull(),
    kcInitial: real('kc_initial'),
    kcMid: real('kc_mid'),
    kcEnd: real('kc_end'),
    abatement: real('abatement'),
    calendarEnd: text('calendar_end'),
    emergenceSowingDays: integer('emergence_sowing_days').notNull(),
    emergencePlantingDays: integer('emergence_planting_days').notNull(),
    sourceUrl: text('source_url'),
    surveyedOn: text('surveyed_on'),
    datesSource: text('dates_source'),
    actorUserId: text('actor_user_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_crop_reference_common_key').on(table.cropKey).where(sql`${table.workspaceId} IS NULL`),
    uniqueIndex('uq_crop_reference_farm_key').on(table.workspaceId, table.cropKey).where(sql`${table.workspaceId} IS NOT NULL`),
    check('chk_crop_reference_source', sql`${table.source} IN ('criiam', 'fao56', 'local')`),
    check('chk_crop_reference_emergence', sql`${table.emergenceSowingDays} >= 0 AND ${table.emergencePlantingDays} >= 0`),
  ],
);

export const cropReferenceStages = sqliteTable(
  'irrigation_crop_reference_stages',
  {
    referenceId: text('reference_id').notNull().references(() => cropReferenceCrops.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    label: text('label').notNull(),
    kc: real('kc').notNull(),
    calendarStart: text('calendar_start'),
    estimated: integer('estimated').notNull().default(0),
    establishmentMonths: integer('establishment_months'),
  },
  (table) => [
    primaryKey({ columns: [table.referenceId, table.rank] }),
    check('chk_crop_stage_kc', sql`${table.kc} >= 0 AND ${table.kc} <= 1.3`),
  ],
);

export const cropReferenceSeasons = sqliteTable(
  'irrigation_crop_reference_seasons',
  {
    referenceId: text('reference_id').notNull().references(() => cropReferenceCrops.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    initialDays: integer('initial_days'),
    developmentDays: integer('development_days'),
    midDays: integer('mid_days'),
    lateDays: integer('late_days'),
  },
  (table) => [primaryKey({ columns: [table.referenceId, table.setNumber] })],
);

export const cropReferenceSeasonMonths = sqliteTable(
  'irrigation_crop_reference_season_months',
  {
    referenceId: text('reference_id').notNull(),
    month: integer('month').notNull(),
    setNumber: integer('set_number').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.referenceId, table.month] }),
    check('chk_crop_season_month', sql`${table.month} BETWEEN 1 AND 12`),
  ],
);

export const cropReferenceStageStarts = sqliteTable(
  'irrigation_crop_reference_stage_starts',
  {
    referenceId: text('reference_id').notNull(),
    setNumber: integer('set_number').notNull(),
    rank: integer('rank').notNull(),
    anchor: text('anchor', { enum: ['implantation', 'emergence', 'before-harvest', 'first-harvest', 'mid-harvest'] }).notNull(),
    duration: integer('duration'),
    durationUnit: text('duration_unit', { enum: ['days', 'degree-days'] }).notNull().default('days'),
    estimated: integer('estimated').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.referenceId, table.setNumber, table.rank] })],
);

export const cropKcOverrides = sqliteTable(
  'irrigation_crop_kc_overrides',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    cropKey: text('crop_key').notNull(),
    stageRank: integer('stage_rank'),
    faoPoint: text('fao_point', { enum: ['initial', 'mid', 'end'] }),
    kc: real('kc'),
    effectiveFrom: text('effective_from').notNull(),
    recordedAt: text('recorded_at').notNull(),
    actorUserId: text('actor_user_id'),
  },
  (table) => [
    index('idx_crop_kc_overrides_workspace').on(table.workspaceId, table.cropKey),
    check('chk_crop_kc_override_value', sql`${table.kc} IS NULL OR (${table.kc} >= 0 AND ${table.kc} <= 1.3)`),
  ],
);

export const cropSpeciesLinks = sqliteTable(
  'irrigation_crop_species_links',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    plantId: text('plant_id').notNull(),
    seriesId: text('series_id'),
    targetKind: text('target_kind', { enum: ['reference', 'without-reference', 'surface-state'] }).notNull(),
    cropKey: text('crop_key'),
    analogy: integer('analogy').notNull().default(0),
    actorUserId: text('actor_user_id'),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('uq_crop_species_link_species').on(table.workspaceId, table.plantId).where(sql`${table.seriesId} IS NULL`),
    uniqueIndex('uq_crop_species_link_series').on(table.workspaceId, table.plantId, table.seriesId).where(sql`${table.seriesId} IS NOT NULL`),
  ],
);

export const cropStageDeclarations = sqliteTable(
  'irrigation_crop_stage_declarations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    seriesId: text('series_id').notNull(),
    otfBedId: text('otf_bed_id'),
    cropKey: text('crop_key').notNull(),
    stageRank: integer('stage_rank').notNull(),
    stageDate: text('stage_date').notNull(),
    recordedAt: text('recorded_at').notNull(),
    actorUserId: text('actor_user_id'),
  },
  (table) => [
    index('idx_crop_stage_declarations_series').on(table.workspaceId, table.season, table.seriesId),
    check('chk_crop_stage_declaration_season', sql`${table.season} BETWEEN 1900 AND 9999`),
  ],
);

export const cropShelterFactors = sqliteTable(
  'irrigation_crop_shelter_factors',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    otfPlotId: text('otf_plot_id').notNull(),
    factor: real('factor').notNull(),
    effectiveFrom: text('effective_from').notNull(),
    recordedAt: text('recorded_at').notNull(),
    actorUserId: text('actor_user_id'),
  },
  (table) => [
    index('idx_crop_shelter_factors_plot').on(table.workspaceId, table.otfPlotId),
    check('chk_crop_shelter_factor_value', sql`${table.factor} >= 0.6 AND ${table.factor} <= 1`),
  ],
);

export const cropBedMulch = sqliteTable(
  'irrigation_crop_bed_mulch',
  {
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    otfBedId: text('otf_bed_id').notNull(),
    plasticMulch: integer('plastic_mulch').notNull(),
    actorUserId: text('actor_user_id'),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.season, table.otfBedId] }),
    check('chk_crop_bed_mulch_value', sql`${table.plasticMulch} IN (0, 1)`),
  ],
);

export const cropShadeNets = sqliteTable(
  'irrigation_crop_shade_nets',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    otfBedId: text('otf_bed_id').notNull(),
    rate: real('rate').notNull(),
    placedOn: text('placed_on').notNull(),
    removedOn: text('removed_on'),
    actorUserId: text('actor_user_id'),
    recordedAt: text('recorded_at').notNull(),
  },
  (table) => [
    index('idx_crop_shade_nets_bed').on(table.workspaceId, table.otfBedId),
    check('chk_crop_shade_net_rate', sql`${table.rate} >= 0 AND ${table.rate} < 1`),
  ],
);

export const cropWaterOptions = sqliteTable(
  'irrigation_crop_water_options',
  {
    workspaceId: text('workspace_id').primaryKey().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    smoothing: integer('smoothing').notNull().default(0),
    shading: integer('shading').notNull().default(0),
    actorUserId: text('actor_user_id'),
    updatedAt: updatedAt(),
  },
  (table) => [check('chk_crop_water_options', sql`${table.smoothing} IN (0, 1) AND ${table.shading} IN (0, 1)`)],
);

export const cropEtmDays = sqliteTable(
  'irrigation_crop_etm_days',
  {
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    season: integer('season').notNull(),
    otfBedId: text('otf_bed_id').notNull(),
    date: text('date').notNull(),
    status: text('status', { enum: ['no-crop', 'computed', 'partial', 'no-etm', 'unknown'] }).notNull(),
    etmMm: real('etm_mm'),
    et0Mm: real('et0_mm'),
    et0Nature: text('et0_nature', { enum: ['reanalysis', 'estimated', 'forecast'] }),
    irrigationStop: integer('irrigation_stop').notNull().default(0),
    seriesId: text('series_id'),
    cultivationId: text('cultivation_id'),
    plantId: text('plant_id'),
    cropKey: text('crop_key'),
    kcSource: text('kc_source', { enum: ['criiam', 'fao56', 'local'] }),
    stageRank: integer('stage_rank'),
    stageOrigin: text('stage_origin', { enum: ['calculated', 'observed'] }),
    kc: real('kc'),
    referenceKc: real('reference_kc'),
    kcOverridden: integer('kc_overridden'),
    abatement: real('abatement'),
    kcSmoothed: integer('kc_smoothed'),
    shelterFactor: real('shelter_factor'),
    mulchFactor: real('mulch_factor'),
    shadeFactor: real('shade_factor'),
    shadeNetRate: real('shade_net_rate'),
    computedAt: text('computed_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.season, table.otfBedId, table.date] }),
    index('idx_crop_etm_days_date').on(table.workspaceId, table.season, table.date),
    check('chk_crop_etm_season', sql`${table.season} BETWEEN 1900 AND 9999`),
  ],
);

// 5 ter, la réserve du sol (migration 0025, docs/soil-reserve-contract.md).
const DATE_GLOB = sql`GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'`;

export const soilRecords = sqliteTable(
  'irrigation_soil_records',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    otfZoneId: text('otf_zone_id').notNull(),
    otfPlotId: text('otf_plot_id'),
    labRfuMmPerMeter: real('lab_rfu_mm_per_meter').notNull(),
    stoneSharePercent: real('stone_share_percent'),
    referenceShare: real('reference_share').notNull(),
    provenance: text('provenance', { enum: ['analysis', 'estimate', 'default'] }).notNull(),
    sampledDepthCm: real('sampled_depth_cm'),
    source: text('source').notNull(),
    tewMm: real('tew_mm').notNull(),
    rewMm: real('rew_mm').notNull(),
    surfaceLayerCm: real('surface_layer_cm').notNull(),
    soilDepthCeilingM: real('soil_depth_ceiling_m'),
    effectiveFrom: text('effective_from').notNull(),
    recordedAt: text('recorded_at').notNull(),
    actorUserId: text('actor_user_id'),
  },
  (table) => [
    index('idx_soil_records_zone').on(table.workspaceId, table.otfZoneId),
    check('chk_soil_record_rfu', sql`${table.labRfuMmPerMeter} > 0`),
    check('chk_soil_record_reference_share', sql`${table.referenceShare} > 0 AND ${table.referenceShare} < 1`),
    check('chk_soil_record_date', sql`${table.effectiveFrom} ${DATE_GLOB}`),
  ],
);

export const soilRootingProfiles = sqliteTable(
  'irrigation_soil_rooting_profiles',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    cropKey: text('crop_key').notNull(),
    p: real('p'),
    source: text('source').notNull(),
    note: text('note'),
    effectiveFrom: text('effective_from').notNull(),
    recordedAt: text('recorded_at').notNull(),
    actorUserId: text('actor_user_id'),
  },
  (table) => [
    uniqueIndex('uq_soil_rooting_common_key').on(table.cropKey).where(sql`${table.workspaceId} IS NULL`),
    index('idx_soil_rooting_farm').on(table.workspaceId, table.cropKey),
    check('chk_soil_rooting_p', sql`${table.p} IS NULL OR (${table.p} > 0 AND ${table.p} < 1)`),
  ],
);

export const soilRootingStages = sqliteTable(
  'irrigation_soil_rooting_stages',
  {
    profileId: text('profile_id').notNull().references(() => soilRootingProfiles.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    stageRank: integer('stage_rank'),
    depthM: real('depth_m').notNull(),
    endDepthM: real('end_depth_m'),
    progressionDays: integer('progression_days'),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.position] }),
    uniqueIndex('uq_soil_rooting_stage_rank').on(table.profileId, sql`coalesce(${table.stageRank}, 0)`),
    check('chk_soil_rooting_stage_depth', sql`${table.depthM} > 0 AND ${table.depthM} <= 3`),
  ],
);

export const soilSurfaceDeclarations = sqliteTable(
  'irrigation_soil_surface_declarations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    otfBedId: text('otf_bed_id').notNull(),
    date: text('date').notNull(),
    state: text('state', {
      enum: ['bare', 'impermeable-tarp', 'permeable-tarp', 'mulched', 'green-manure-emergence', 'green-manure-partial', 'green-manure-full', 'green-manure-destroyed', 'grass'],
    }).notNull(),
    recordedAt: text('recorded_at').notNull(),
    actorUserId: text('actor_user_id'),
  },
  (table) => [
    index('idx_soil_surface_declarations_bed').on(table.workspaceId, table.otfBedId),
    check('chk_soil_surface_date', sql`${table.date} ${DATE_GLOB}`),
  ],
);

export const soilSettings = sqliteTable(
  'irrigation_soil_settings',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    thresholdMode: text('threshold_mode', { enum: ['crop', 'farm'] }).notNull(),
    thresholdPercent: integer('threshold_percent'),
    permeableTarpEvaporation: real('permeable_tarp_evaporation').notNull(),
    mulchedEvaporation: real('mulched_evaporation').notNull(),
    greenManureEmergenceKc: real('green_manure_emergence_kc').notNull(),
    greenManurePartialKc: real('green_manure_partial_kc').notNull(),
    greenManureFullKc: real('green_manure_full_kc').notNull(),
    grassKc: real('grass_kc').notNull(),
    plasticMulchRainShare: real('plastic_mulch_rain_share').notNull(),
    effectiveFrom: text('effective_from').notNull(),
    recordedAt: text('recorded_at').notNull(),
    actorUserId: text('actor_user_id'),
  },
  (table) => [
    index('idx_soil_settings_workspace').on(table.workspaceId),
    check('chk_soil_settings_threshold', sql`(${table.thresholdMode} = 'crop' AND ${table.thresholdPercent} IS NULL)
      OR (${table.thresholdMode} = 'farm' AND ${table.thresholdPercent} BETWEEN 20 AND 80 AND ${table.thresholdPercent} % 5 = 0)`),
  ],
);

export const soilObservations = sqliteTable(
  'irrigation_soil_observations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    otfZoneId: text('otf_zone_id').notNull(),
    otfPlotId: text('otf_plot_id'),
    percent: real('percent').notNull(),
    observedAt: text('observed_at').notNull(),
    recordedAt: text('recorded_at').notNull(),
    actorUserId: text('actor_user_id'),
  },
  (table) => [
    index('idx_soil_observations_zone').on(table.workspaceId, table.otfZoneId, table.observedAt),
    check('chk_soil_observation_percent', sql`${table.percent} >= 0 AND ${table.percent} <= 100`),
  ],
);

export const soilDays = sqliteTable(
  'irrigation_soil_days',
  {
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    otfBedId: text('otf_bed_id').notNull(),
    date: text('date').notNull(),
    mode: text('mode', { enum: ['crop', 'bare', 'cover'] }),
    surfaceState: text('surface_state'),
    depthM: real('depth_m'),
    capacityMm: real('capacity_mm'),
    thresholdMm: real('threshold_mm'),
    startMm: real('start_mm'),
    stateMm: real('state_mm'),
    depletionMm: real('depletion_mm'),
    deepMm: real('deep_mm'),
    rainMm: real('rain_mm'),
    irrigationMm: real('irrigation_mm').notNull().default(0),
    consumptionMm: real('consumption_mm'),
    drainageMm: real('drainage_mm').notNull().default(0),
    restart: text('restart', { enum: ['observation', 'inflow'] }),
    unknownKind: text('unknown_kind', { enum: ['no-soil', 'not-started', 'missing-rain', 'missing-et0', 'crop-without-etm', 'blocked'] }),
    unknownDate: text('unknown_date'),
    computedAt: text('computed_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.otfBedId, table.date] }),
    index('idx_soil_days_date').on(table.workspaceId, table.date),
    check('chk_soil_day_date', sql`${table.date} ${DATE_GLOB}`),
  ],
);

// ---------------------------------------------------------------------------
// Alertes météo par culture (5 quinquies, migration 0026,
// docs/weather-crop-alerts-contract.md, D-058, D-060).
// ---------------------------------------------------------------------------

export const cropAlertCommon = sqliteTable(
  'irrigation_crop_alert_common',
  {
    key: text('key').primaryKey(),
    name: text('name').notNull(),
    damageCelsius: real('damage_celsius'),
    dryingDays: integer('drying_days'),
    confidence: text('confidence').notNull(),
    source: text('source').notNull(),
    recordedOn: text('recorded_on').notNull(),
  },
  (table) => [
    check('chk_crop_alert_common_damage', sql`${table.damageCelsius} IS NULL OR ${table.damageCelsius} BETWEEN -30 AND 10`),
    check('chk_crop_alert_common_drying', sql`${table.dryingDays} IS NULL OR ${table.dryingDays} BETWEEN 1 AND 60`),
  ],
);

export const cropFrostLinks = sqliteTable(
  'irrigation_crop_frost_links',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    plantId: text('plant_id').notNull(),
    seriesId: text('series_id'),
    commonKey: text('common_key').references(() => cropAlertCommon.key, { onDelete: 'restrict' }),
    damageCelsius: real('damage_celsius'),
    actorUserId: text('actor_user_id'),
    recordedAt: text('recorded_at').notNull(),
  },
  (table) => [
    index('idx_crop_frost_links_plant').on(table.workspaceId, table.plantId, table.recordedAt),
  ],
);

export const cropDryingRevisions = sqliteTable(
  'irrigation_crop_drying_revisions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    plantId: text('plant_id').notNull(),
    dryingDays: integer('drying_days'),
    actorUserId: text('actor_user_id'),
    recordedAt: text('recorded_at').notNull(),
  },
  (table) => [
    index('idx_crop_drying_revisions_plant').on(table.workspaceId, table.plantId, table.recordedAt),
    check('chk_crop_drying_days', sql`${table.dryingDays} IS NULL OR ${table.dryingDays} BETWEEN 1 AND 60`),
  ],
);

export const cropAlertSettings = sqliteTable(
  'irrigation_crop_alert_settings',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    frostActive: integer('frost_active').notNull(),
    dryingActive: integer('drying_active').notNull(),
    sprinklerActive: integer('sprinkler_active').notNull(),
    horizonDays: integer('horizon_days').notNull(),
    frostOffsetCelsius: real('frost_offset_celsius').notNull(),
    frostMarginSensitiveCelsius: real('frost_margin_sensitive_celsius').notNull().default(3),
    frostMarginHardyCelsius: real('frost_margin_hardy_celsius').notNull().default(2),
    sprinklerMaxTemperatureCelsius: real('sprinkler_max_temperature_celsius').notNull(),
    sprinklerRadiationWPerSquareMeter: integer('sprinkler_radiation_w_per_square_meter').notNull(),
    actorUserId: text('actor_user_id'),
    recordedAt: text('recorded_at').notNull(),
  },
  (table) => [
    index('idx_crop_alert_settings_workspace').on(table.workspaceId, table.recordedAt),
  ],
);

export const cropAlerts = sqliteTable(
  'irrigation_crop_alerts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    kind: text('kind', { enum: ['frost', 'drying', 'sprinkler'] }).notNull(),
    subjectKey: text('subject_key').notNull(),
    subjectVersion: text('subject_version').notNull(),
    plantId: text('plant_id'),
    seriesId: text('series_id'),
    name: text('name').notNull(),
    targetDate: text('target_date').notNull(),
    damageCelsius: real('damage_celsius'),
    marginCelsius: real('margin_celsius'),
    offsetCelsius: real('offset_celsius'),
    dryingDays: integer('drying_days'),
    forecastValue: real('forecast_value'),
    unit: text('unit'),
    forecastedAt: text('forecasted_at'),
    detail: text('detail'),
    sentAt: text('sent_at').notNull(),
    deliveryStatus: text('delivery_status').notNull().default('pending'),
  },
  (table) => [
    index('idx_crop_alerts_workspace_sent').on(table.workspaceId, table.sentAt),
    check('chk_crop_alert_date', sql`${table.targetDate} ${DATE_GLOB}`),
  ],
);

/**
 * Le choix des fonctionnalités d'une exploitation (3.8,
 * docs/feature-selection-contract.md, D-067) : une ligne par espace, les
 * cases cochées et les cases connues en tableaux JSON. Pas de ligne : une
 * ferme d'avant la 3.8, tout coché.
 */
export const featureSelections = sqliteTable(
  'irrigation_feature_selections',
  {
    workspaceId: text('workspace_id').primaryKey().references(() => irrigationWorkspaces.id, { onDelete: 'restrict' }),
    enabledFeatures: text('enabled_features').notNull(),
    knownFeatures: text('known_features').notNull(),
    chosenAt: text('chosen_at'),
    bannerDismissedAt: text('banner_dismissed_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    check('chk_feature_selection_enabled', sql`json_valid(${table.enabledFeatures}) AND json_type(${table.enabledFeatures}) = 'array'`),
    check('chk_feature_selection_known', sql`json_valid(${table.knownFeatures}) AND json_type(${table.knownFeatures}) = 'array'`),
  ],
);
