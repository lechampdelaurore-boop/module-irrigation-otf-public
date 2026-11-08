import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

function createMigratedDatabase(through?: string): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');

  const migrations = readdirSync('drizzle')
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort()
    .filter((name) => !through || name <= through);

  for (const migration of migrations) {
    const sql = readFileSync(`drizzle/${migration}`, 'utf8').replaceAll(
      '--> statement-breakpoint',
      '',
    );
    database.exec(sql);
  }

  return database;
}

function applyMigration(database: DatabaseSync, migration: string) {
  const sql = readFileSync(`drizzle/${migration}`, 'utf8').replaceAll(
    '--> statement-breakpoint',
    '',
  );
  database.exec(sql);
}

test('la migration irrigation s’applique sur une base vide', () => {
  const database = createMigratedDatabase();
  const tables = database
    .prepare(
      `SELECT name FROM sqlite_schema
       WHERE type = 'table' AND name LIKE 'irrigation_%'
       ORDER BY name`,
    )
    .all()
    .map((row) => String(row.name));

  assert.deepEqual(tables, [
    'irrigation_arbitration_log',
    'irrigation_arbitrations',
    'irrigation_background_jobs',
    'irrigation_bed_applications',
    // Les treize tables du besoin par culture et par stade (5 quater) et les cinq des alertes par culture (5 quinquies) partagent la ligne de leur voisine, même raison.
    'irrigation_bed_need_decisions', 'irrigation_crop_alert_common', 'irrigation_crop_alert_settings', 'irrigation_crop_alerts', 'irrigation_crop_bed_mulch', 'irrigation_crop_drying_revisions', 'irrigation_crop_etm_days', 'irrigation_crop_frost_links', 'irrigation_crop_kc_overrides', 'irrigation_crop_reference_crops', 'irrigation_crop_reference_season_months', 'irrigation_crop_reference_seasons', 'irrigation_crop_reference_stage_starts', 'irrigation_crop_reference_stages', 'irrigation_crop_shade_nets', 'irrigation_crop_shelter_factors', 'irrigation_crop_species_links', 'irrigation_crop_stage_declarations', 'irrigation_crop_water_options',
    'irrigation_daily_water_limit_revisions',
    'irrigation_equipment',
    // Fichier à la limite de 600 lignes : la table de la 2.11 partage la ligne de sa voisine.
    'irrigation_equipment_placement_history', 'irrigation_equipment_placements',
    'irrigation_equipment_pump_defaults',
    // Même raison : la provenance des réglages (3.8 bis) partage la ligne de sa voisine.
    'irrigation_equipment_setting_calculations', 'irrigation_equipment_settings',
    'irrigation_event_equipment',
    'irrigation_event_log',
    'irrigation_events', 'irrigation_feature_selections',
    'irrigation_garden_group_members',
    'irrigation_garden_groups',
    'irrigation_hydric_goal_revisions',
    'irrigation_need_decision_log',
    'irrigation_need_preferences',
    'irrigation_placement_selected_beds',
    // Même raison : la table des événements de la 3.7 partage la ligne de sa voisine.
    'irrigation_plan_calculations', 'irrigation_plan_events',
    'irrigation_plan_proposals', 'irrigation_plan_suggestion_keeps',
    'irrigation_planning_settings',
    // Même raison : les deux tables des créneaux protégés (3.8 ter, migration 0030) partagent la ligne de leur voisine.
    'irrigation_planning_settings_log', 'irrigation_protected_slots', 'irrigation_protected_slots_log',
    'irrigation_pump_log',
    'irrigation_pump_origins',
    'irrigation_pumps',
    // Les sept tables de la réserve du sol (5 ter) partagent la ligne de leur voisine, même raison.
    'irrigation_season_geometry', 'irrigation_soil_days', 'irrigation_soil_observations', 'irrigation_soil_records', 'irrigation_soil_rooting_profiles', 'irrigation_soil_rooting_stages', 'irrigation_soil_settings', 'irrigation_soil_surface_declarations',
    'irrigation_water_infrastructure_log',
    'irrigation_water_reservoir_links',
    'irrigation_water_reservoirs',
    'irrigation_water_resource_flow_revisions',
    'irrigation_water_resource_limit_revisions',
    'irrigation_water_resource_meter_readings',
    'irrigation_water_resource_reservoir_links',
    'irrigation_water_resources',
    'irrigation_water_stock_movements',
    'irrigation_water_supply_defaults',
    // Les trois tables des alertes météo (5 bis) partagent une ligne, même raison.
    'irrigation_weather_alert_criteria', 'irrigation_weather_alert_criterion_versions', 'irrigation_weather_alerts', 'irrigation_weather_daily_values',
    'irrigation_weather_geocodes',
    'irrigation_weather_preferences',
    'irrigation_workspaces',
  ]);

  database.close();
});

test('les migrations sont numérotées sans trou et nommées d’après leur sujet (docs/migrations-contract.md)', () => {
  const names = readdirSync('drizzle').filter((name) => name.endsWith('.sql')).sort();
  assert.ok(names.every((name) => /^[0-9]{4}_[a-z0-9_]+[.]sql$/.test(name)), 'quatre chiffres, un tiret bas, un sujet en minuscules');
  assert.deepEqual(names.map((name) => Number(name.slice(0, 4))), names.map((_, index) => index), 'numéros consécutifs à partir de 0000');
  assert.ok(names.includes('0011_irrigation_needs_priorities.sql'), 'la migration de la sous-tranche 3.3 est présente');
  assert.ok(names.length >= 15, 'au moins les quinze migrations connues');
});

test('3.4 les changements du cache OTF invalident uniquement la révision du propriétaire', () => {
  const db = createMigratedDatabase();
  db.exec("INSERT INTO irrigation_workspaces(id,owner_user_id) VALUES ('a','alice'),('b','bob')");
  const key = JSON.stringify(['v-test','alice',2026]);
  db.prepare('INSERT INTO otf_snapshots(cache_key,payload,last_successful_read_at,updated_at) VALUES(?,?,?,?)').run(key,'{}','now','now');
  const revision = (id: string) => db.prepare('SELECT feasibility_revision r FROM irrigation_workspaces WHERE id=?').get(id)!.r;
  assert.equal(revision('a'),1); assert.equal(revision('b'),0);
  db.prepare('UPDATE otf_snapshots SET payload=? WHERE cache_key=?').run('{"beds":[]}',key);
  assert.equal(revision('a'),2);
  db.prepare('UPDATE otf_snapshots SET updated_at=? WHERE cache_key=?').run('later',key);
  assert.equal(revision('a'),2);
  db.prepare('DELETE FROM otf_snapshots WHERE cache_key=?').run(key);
  assert.equal(revision('a'),3); assert.equal(revision('b'),0); db.close();
});

test('3.4 lecture bornée : une irrigation partielle peut garder un plan futur après son réel passé', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE irrigation_events(id TEXT); CREATE TABLE irrigation_event_equipment(event_id TEXT,timer_state TEXT,actual_start_at TEXT,actual_end_at TEXT,planned_start_at TEXT,planned_end_at TEXT)');
  db.exec("INSERT INTO irrigation_events VALUES('old'),('partial'),('timer'),('future')");
  db.exec(`INSERT INTO irrigation_event_equipment VALUES
    ('old',NULL,'2026-09-01','2026-09-02',NULL,NULL),
    ('partial',NULL,'2026-09-01','2026-09-02','2026-09-08','2026-09-09'),
    ('timer','running',NULL,NULL,'2026-09-01','2026-09-02'),
    ('future',NULL,NULL,NULL,'2026-09-15','2026-09-16')`);
  const source = readFileSync('db/irrigation-event/read.ts','utf8');
  const filter = source.match(/seasonFilter \+= `([\s\S]+?)`;/)![1];
  const result = db.prepare(`SELECT event.id FROM irrigation_events event WHERE 1=1 ${filter} ORDER BY event.id`).all('2026-09-07','2026-09-14','2026-09-07','2026-09-14');
  assert.deepEqual(result.map(r=>r.id),['partial','timer']); db.close();
});

test('3.4 migration, garde atomique et arbitrages isolés par workspace', () => {
  const database = createMigratedDatabase();
  database.exec("INSERT INTO irrigation_workspaces(id,owner_user_id) VALUES ('a','alice'),('b','bob')");
  database.exec("INSERT INTO irrigation_arbitrations(workspace_id,season,week_start,priority,selected_bed_ids,candidate_bed_ids,actor_user_id,decided_at) VALUES ('a',2026,'2026-09-07','high','[\"A\"]','[\"A\",\"B\"]','alice','2026-09-08T12:00:00Z')");
  assert.equal(database.prepare("SELECT * FROM irrigation_arbitrations a JOIN irrigation_workspaces w ON w.id=a.workspace_id WHERE w.owner_user_id=?").all('bob').length, 0);
  database.exec("UPDATE irrigation_workspaces SET feasibility_revision=1 WHERE id='a'");
  assert.throws(() => database.exec("UPDATE irrigation_workspaces SET feasibility_revision=1 WHERE id='a'"), /stale_feasibility_revision/);
  database.exec("INSERT INTO irrigation_need_preferences(workspace_id,actor_user_id) VALUES ('a','alice')");
  assert.equal(database.prepare("SELECT feasibility_revision r FROM irrigation_workspaces WHERE id='a'").get()!.r, 2);
  assert.equal(database.prepare("SELECT feasibility_revision r FROM irrigation_workspaces WHERE id='b'").get()!.r, 0);
  database.exec('BEGIN');
  try {
    database.exec("UPDATE irrigation_workspaces SET feasibility_revision=2 WHERE id='a'");
    database.exec("UPDATE irrigation_arbitrations SET selected_bed_ids='[]' WHERE workspace_id='a'");
    database.exec('COMMIT'); assert.fail('Stale batch must not succeed');
  } catch { database.exec('ROLLBACK'); }
  assert.equal(database.prepare("SELECT selected_bed_ids s FROM irrigation_arbitrations WHERE workspace_id='a'").get()!.s, '["A"]');
  assert.throws(() => database.exec("INSERT INTO irrigation_arbitrations(workspace_id,season,week_start,priority,selected_bed_ids,candidate_bed_ids,actor_user_id,decided_at) VALUES ('a',2026,'2026-09-07','urgent','[]','[]','alice','now')"));
  assert.throws(() => database.exec("UPDATE irrigation_arbitrations SET selected_bed_ids='null' WHERE workspace_id='a'"));
  const row = "('request','a','nonce',2026,'2026-09-07','high','selected','{}','alice')";
  database.exec(`INSERT INTO irrigation_arbitration_log(id,workspace_id,request_id,season,week_start,priority,action,payload,actor_user_id) VALUES ${row}`);
  assert.throws(() => database.exec(`INSERT INTO irrigation_arbitration_log(id,workspace_id,request_id,season,week_start,priority,action,payload,actor_user_id) VALUES ${row.replace("'request'", "'another'")}`));
  database.close();
});

test('la migration 3.3 protège les besoins hebdomadaires et les espaces de travail', () => {
  const database = createMigratedDatabase();
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('needs-a', 'user-a');
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('needs-b', 'user-b');
  database.prepare(`INSERT INTO irrigation_need_preferences (workspace_id, minimum_need_threshold_mm, actor_user_id) VALUES ('needs-a', 2, 'user-a')`).run();
  database.prepare(`INSERT INTO irrigation_bed_need_decisions
    (id, workspace_id, season, week_start, otf_zone_id, otf_plot_id, otf_bed_id, priority, manual_override_mm, calculated_need_at_override_mm, actor_user_id)
    VALUES ('decision-a', 'needs-a', 2026, '2026-09-07', 'zone-a', 'plot-a', 'bed-a', 'high', 0, 18, 'user-a')`).run();
  assert.throws(() => database.prepare(`INSERT INTO irrigation_bed_need_decisions
    (id, workspace_id, season, week_start, otf_zone_id, otf_plot_id, otf_bed_id, priority, actor_user_id)
    VALUES ('bad-priority', 'needs-a', 2026, '2026-09-07', 'zone-a', 'plot-a', 'bed-b', 'urgent', 'user-a')`).run());
  assert.throws(() => database.prepare(`UPDATE irrigation_need_preferences SET minimum_need_threshold_mm = -1 WHERE workspace_id = 'needs-a'`).run());
  const visibleToA = database.prepare(`SELECT decision.id FROM irrigation_bed_need_decisions AS decision INNER JOIN irrigation_workspaces AS workspace ON workspace.id = decision.workspace_id WHERE workspace.owner_user_id = ?`).all('user-a');
  const visibleToB = database.prepare(`SELECT decision.id FROM irrigation_bed_need_decisions AS decision INNER JOIN irrigation_workspaces AS workspace ON workspace.id = decision.workspace_id WHERE workspace.owner_user_id = ?`).all('user-b');
  assert.equal(visibleToA.length, 1);
  assert.equal(visibleToB.length, 0);
  database.close();
});

test('la migration 3.1 protège les volumes, relations et espaces de travail', () => {
  const database = createMigratedDatabase();
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('water-a', 'user-a');
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('water-b', 'user-b');
  database.prepare(`INSERT INTO irrigation_water_resources
    (id, workspace_id, name, type, nominal_flow_cubic_meters_per_hour)
    VALUES ('source-a', 'water-a', 'Forage A', 'borehole', 1.125)`).run();
  database.prepare(`INSERT INTO irrigation_water_reservoirs
    (id, workspace_id, name, type, capacity_cubic_meters, current_volume_cubic_meters,
     current_volume_observed_at, minimum_safety_cubic_meters)
    VALUES ('reserve-a', 'water-a', 'Réserve A', 'buffer', 60, NULL, NULL, 5)`).run();
  assert.throws(() => database.prepare(`INSERT INTO irrigation_water_reservoirs
    (id, workspace_id, name, type, capacity_cubic_meters, current_volume_cubic_meters,
     current_volume_observed_at, minimum_safety_cubic_meters)
    VALUES ('bad-volume', 'water-a', 'Trop pleine', 'tank', 60, 61,
     '2026-09-07T10:00:00Z', 5)`).run());
  assert.throws(() => database.prepare(`INSERT INTO irrigation_water_reservoir_links
    (id, workspace_id, upstream_reservoir_id, downstream_reservoir_id, transfer_mode)
    VALUES ('self', 'water-a', 'reserve-a', 'reserve-a', 'manual')`).run());
  const visibleToA = database.prepare(`SELECT resource.id FROM irrigation_water_resources AS resource
    INNER JOIN irrigation_workspaces AS workspace ON workspace.id = resource.workspace_id
    WHERE workspace.owner_user_id = ?`).all('user-a');
  const visibleToB = database.prepare(`SELECT resource.id FROM irrigation_water_resources AS resource
    INNER JOIN irrigation_workspaces AS workspace ON workspace.id = resource.workspace_id
    WHERE workspace.owner_user_id = ?`).all('user-b');
  assert.equal(visibleToA.length, 1);
  assert.equal(visibleToB.length, 0);
  database.close();
});

test('la migration 3.2 protège les pompes, leurs origines et les workspaces', () => {
  const database = createMigratedDatabase();
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('pump-a', 'user-a');
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('pump-b', 'user-b');
  database.prepare(`INSERT INTO irrigation_water_reservoirs
    (id, workspace_id, name, type, capacity_cubic_meters, current_volume_cubic_meters, current_volume_observed_at)
    VALUES ('reserve-a', 'pump-a', 'Réserve 60', 'buffer', 60, 60, '2026-09-08T08:00:00Z')`).run();
  database.prepare(`INSERT INTO irrigation_pumps
    (id, workspace_id, name, maximum_flow_cubic_meters_per_hour)
    VALUES ('p-a', 'pump-a', 'Pompe principale', 8)`).run();
  database.prepare(`INSERT INTO irrigation_pump_origins
    (id, workspace_id, pump_id, source_kind, reservoir_id, is_default)
    VALUES ('o-a', 'pump-a', 'p-a', 'reservoir', 'reserve-a', 1)`).run();
  assert.throws(() => database.prepare(`INSERT INTO irrigation_pumps
    (id, workspace_id, name, maximum_flow_cubic_meters_per_hour)
    VALUES ('bad', 'pump-a', 'Invalide', 0)`).run());
  assert.throws(() => database.prepare(`INSERT INTO irrigation_pump_origins
    (id, workspace_id, pump_id, source_kind, reservoir_id, is_default)
    VALUES ('bad-origin', 'pump-a', 'p-a', 'resource', 'reserve-a', 0)`).run());
  const visibleToA = database.prepare(`SELECT pump.id FROM irrigation_pumps AS pump
    INNER JOIN irrigation_workspaces AS workspace ON workspace.id = pump.workspace_id
    WHERE workspace.owner_user_id = ?`).all('user-a');
  const visibleToB = database.prepare(`SELECT pump.id FROM irrigation_pumps AS pump
    INNER JOIN irrigation_workspaces AS workspace ON workspace.id = pump.workspace_id
    WHERE workspace.owner_user_id = ?`).all('user-b');
  assert.equal(visibleToA.length, 1);
  assert.equal(visibleToB.length, 0);
  database.prepare(`UPDATE irrigation_pumps SET status = 'archived', archived_at = '2026-09-08T12:00:00Z' WHERE id = 'p-a'`).run();
  assert.equal(database.prepare(`SELECT status FROM irrigation_pumps WHERE id = 'p-a'`).get()?.status, 'archived');
  database.close();
});

test('la révision hydraulique empêche deux validations concurrentes', () => {
  const database = createMigratedDatabase();
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('hydraulic', 'user');
  database.prepare('UPDATE irrigation_workspaces SET hydraulic_revision = 1 WHERE id = ?').run('hydraulic');
  assert.throws(() => database.prepare('UPDATE irrigation_workspaces SET hydraulic_revision = 1 WHERE id = ?').run('hydraulic'), /HYDRAULIC_CHANGED/);
  database.close();
});

test('les colonnes de pompe historiques restent facultatives', () => {
  const database = createMigratedDatabase();
  const columns = database.prepare("PRAGMA table_info('irrigation_event_equipment')").all().map((row) => String(row.name));
  for (const name of ['pump_id', 'pump_origin_id', 'requested_flow_cubic_meters_per_hour', 'pump_snapshot', 'pump_origin_snapshot']) assert.ok(columns.includes(name));
  const pumpColumn = database.prepare("PRAGMA table_info('irrigation_event_equipment')").all().find((row) => row.name === 'pump_id');
  assert.equal(pumpColumn?.notnull, 0);
  database.close();
});

test('une correction de stock reste append-only et conserve ancien et nouveau volumes', () => {
  const database = createMigratedDatabase();
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('w', 'u');
  database.prepare(`INSERT INTO irrigation_water_reservoirs
    (id, workspace_id, name, type, capacity_cubic_meters, current_volume_cubic_meters,
     current_volume_observed_at)
    VALUES ('r', 'w', 'Réserve', 'buffer', 60, 42.6, '2026-09-07T08:00:00Z')`).run();
  database.prepare(`INSERT INTO irrigation_water_stock_movements
    (id, workspace_id, reservoir_id, kind, volume_delta_cubic_meters, occurred_at,
     previous_volume_cubic_meters, resulting_volume_cubic_meters, reason, actor_user_id)
    VALUES ('m', 'w', 'r', 'manual_correction', -2.6, '2026-09-07T10:00:00Z',
      42.6, 40, 'Jauge', 'u')`).run();
  const movement = database.prepare(`SELECT previous_volume_cubic_meters, resulting_volume_cubic_meters,
    reason FROM irrigation_water_stock_movements WHERE id = 'm'`).get();
  assert.deepEqual({ ...movement }, { previous_volume_cubic_meters: 42.6, resulting_volume_cubic_meters: 40, reason: 'Jauge' });
  database.close();
});

test('la migration météo mémorise Retry-After et permet un seul verrou de rafraîchissement', () => {
  const database = createMigratedDatabase();
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('weather-workspace', 'weather-user');
  database.prepare(`INSERT INTO irrigation_weather_preferences
    (workspace_id, location_mode, last_refresh_attempt_at, refresh_not_before_at)
    VALUES (?, 'otf', ?, ?)`).run(
    'weather-workspace',
    '2026-09-03T10:00:00.000Z',
    '2026-09-03T10:02:00.000Z',
  );
  const claim = database.prepare(`UPDATE irrigation_weather_preferences
    SET last_refresh_attempt_at = ?
    WHERE workspace_id = ?
      AND (refresh_not_before_at IS NULL OR refresh_not_before_at <= ?)
      AND (last_refresh_attempt_at IS NULL OR last_refresh_attempt_at <= ?)`);
  assert.equal(claim.run(
    '2026-09-03T10:01:00.000Z', 'weather-workspace',
    '2026-09-03T10:01:00.000Z', '2026-09-03T10:00:30.000Z',
  ).changes, 0);
  assert.equal(claim.run(
    '2026-09-03T10:02:00.000Z', 'weather-workspace',
    '2026-09-03T10:02:00.000Z', '2026-09-03T10:01:30.000Z',
  ).changes, 1);
  assert.equal(claim.run(
    '2026-09-03T10:02:01.000Z', 'weather-workspace',
    '2026-09-03T10:02:01.000Z', '2026-09-03T10:01:31.000Z',
  ).changes, 0);
  database.close();
});

test('deux validations concurrentes ne peuvent pas consommer le même budget journalier', () => {
  const database = createMigratedDatabase();
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('water-workspace', 'water-user');
  const observedRevision = 0;
  database.prepare('UPDATE irrigation_workspaces SET water_budget_revision = ? WHERE id = ?').run(observedRevision + 1, 'water-workspace');
  assert.throws(() => database.prepare('UPDATE irrigation_workspaces SET water_budget_revision = ? WHERE id = ?').run(observedRevision + 1, 'water-workspace'), /WATER_BUDGET_CHANGED/);
  assert.equal(database.prepare('SELECT water_budget_revision FROM irrigation_workspaces WHERE id = ?').get('water-workspace')?.water_budget_revision, 1);
  database.close();
});

test('la migration 2.8 protège les objectifs, corrections météo et limites', () => {
  const database = createMigratedDatabase();
  database.prepare(
    `INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)`,
  ).run('workspace-1', 'user-1');

  assert.throws(() => database.prepare(
    `INSERT INTO irrigation_hydric_goal_revisions
       (id, workspace_id, season, week_start, scope_type, amount_mm, action, actor_user_id)
     VALUES (?, ?, ?, ?, 'farm', ?, 'set', ?)`,
  ).run('goal-bad', 'workspace-1', 2026, '2026-08-31', -1, 'user-1'));

  database.prepare(
    `INSERT INTO irrigation_weather_daily_values
       (workspace_id, location_key, date, data_kind, precipitation_mm,
        source, fetched_at)
     VALUES (?, ?, ?, 'forecast', ?, 'open-meteo', ?)`,
  ).run('workspace-1', 'otf:rennes:35000', '2026-09-02', 2, '2026-09-02T08:00:00Z');
  database.prepare(
    `INSERT INTO irrigation_weather_daily_values
       (workspace_id, location_key, date, data_kind, precipitation_mm,
        source, fetched_at)
     VALUES (?, ?, ?, 'manual_precipitation', ?, 'user', ?)`,
  ).run('workspace-1', 'otf:rennes:35000', '2026-09-02', 4, '2026-09-02T09:00:00Z');
  const rows = database.prepare(
    `SELECT data_kind, precipitation_mm FROM irrigation_weather_daily_values
     ORDER BY data_kind`,
  ).all();
  assert.deepEqual(rows.map((row) => row.data_kind), ['forecast', 'manual_precipitation']);

  assert.throws(() => database.prepare(
    `INSERT INTO irrigation_daily_water_limit_revisions
       (id, workspace_id, season, enabled, max_cubic_meters_per_day,
        valid_from, valid_until, actor_user_id)
     VALUES (?, ?, ?, 1, NULL, ?, ?, ?)`,
  ).run('limit-bad', 'workspace-1', 2026, '2026-01-01', '2026-12-31', 'user-1'));
  database.close();
});

test('les données 2.8 restent isolées par exploitation, saison et semaine', () => {
  const database = createMigratedDatabase();
  database.prepare(
    `INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)`,
  ).run('workspace-a', 'user-a');
  database.prepare(
    `INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)`,
  ).run('workspace-b', 'user-b');

  const insert = database.prepare(
    `INSERT INTO irrigation_hydric_goal_revisions
       (id, workspace_id, season, week_start, scope_type, amount_mm, action, actor_user_id)
     VALUES (?, ?, ?, ?, 'farm', ?, 'set', ?)`,
  );
  insert.run('a-2026-w1', 'workspace-a', 2026, '2026-08-31', 35, 'user-a');
  insert.run('a-2026-w2', 'workspace-a', 2026, '2026-09-07', 30, 'user-a');
  insert.run('a-2027-w1', 'workspace-a', 2027, '2027-08-30', 25, 'user-a');
  insert.run('b-2026-w1', 'workspace-b', 2026, '2026-08-31', 40, 'user-b');

  const selected = database.prepare(
    `SELECT amount_mm FROM irrigation_hydric_goal_revisions
     WHERE workspace_id = ? AND season = ? AND week_start = ?`,
  ).all('workspace-a', 2026, '2026-08-31');
  assert.deepEqual(selected.map((row) => row.amount_mm), [35]);
  database.close();
});

test('modifier puis vider un objectif conserve toutes ses révisions', () => {
  const database = createMigratedDatabase();
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('w', 'u');
  const insert = database.prepare(`INSERT INTO irrigation_hydric_goal_revisions
    (id, workspace_id, season, week_start, scope_type, amount_mm, action, actor_user_id)
    VALUES (?, 'w', 2026, '2026-08-31', 'farm', ?, ?, 'u')`);
  const latest = () => database.prepare(`SELECT amount_mm, action FROM irrigation_hydric_goal_revisions
    WHERE workspace_id = 'w' AND season = 2026 AND week_start = '2026-08-31'
    ORDER BY created_at DESC, id DESC LIMIT 1`).get();
  insert.run('1', 35, 'set');
  assert.equal(latest()?.amount_mm, 35);
  insert.run('2', 42, 'set');
  assert.equal(latest()?.amount_mm, 42);
  insert.run('3', null, 'cleared');
  assert.equal(latest()?.action, 'cleared');
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM irrigation_hydric_goal_revisions').get()?.n, 3);
  database.close();
});

test('la pluie mesurée reste accessible lorsque la commune météo change', () => {
  const database = createMigratedDatabase();
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('w', 'u');
  database.prepare(`INSERT INTO irrigation_weather_daily_values
    (workspace_id, location_key, date, data_kind, precipitation_mm, source, fetched_at)
    VALUES ('w', 'farm:manual', '2026-09-02', 'manual_precipitation', 4.5, 'user', '2026-09-02T10:00:00Z')`).run();
  const measured = database.prepare(`SELECT precipitation_mm FROM irrigation_weather_daily_values
    WHERE workspace_id = ? AND (location_key = ? OR data_kind = 'manual_precipitation') AND date BETWEEN ? AND ?`)
    .get('w', 'custom:tronget:03240', '2026-08-31', '2026-09-06');
  assert.equal(measured?.precipitation_mm, 4.5);
  database.close();
});

test('une réponse météo incomplète ne remplace pas les dernières valeurs valides par null', () => {
  const database = createMigratedDatabase();
  database.prepare('INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)').run('weather-cache', 'weather-user');
  database.prepare(`INSERT INTO irrigation_weather_daily_values
    (workspace_id, location_key, date, data_kind, precipitation_mm, et0_mm, source, fetched_at)
    VALUES (?, ?, ?, 'forecast', ?, ?, 'open-meteo', ?)`).run(
    'weather-cache', 'custom:tronget:03240', '2026-09-03', 2.4, 3.8,
    '2026-09-03T08:00:00.000Z',
  );
  database.prepare(`INSERT INTO irrigation_weather_daily_values
    (workspace_id, location_key, date, data_kind, precipitation_mm, et0_mm, source, fetched_at)
    VALUES (?, ?, ?, 'forecast', NULL, ?, 'open-meteo', ?)
    ON CONFLICT(workspace_id, location_key, date, data_kind) DO UPDATE SET
      precipitation_mm = COALESCE(excluded.precipitation_mm, irrigation_weather_daily_values.precipitation_mm),
      et0_mm = COALESCE(excluded.et0_mm, irrigation_weather_daily_values.et0_mm)`).run(
    'weather-cache', 'custom:tronget:03240', '2026-09-03', 4.1,
    '2026-09-03T09:00:00.000Z',
  );
  const row = database.prepare(`SELECT precipitation_mm, et0_mm
    FROM irrigation_weather_daily_values WHERE workspace_id = ?`).get('weather-cache');
  assert.equal(row?.precipitation_mm, 2.4);
  assert.equal(row?.et0_mm, 4.1);
  database.close();
});

test('la migration du minuteur conserve son état après rechargement', () => {
  const database = createMigratedDatabase();
  const columns = database
    .prepare("PRAGMA table_info('irrigation_event_equipment')")
    .all()
    .map((row) => String(row.name));

  assert.ok(columns.includes('planned_duration_seconds'));
  assert.ok(columns.includes('actual_duration_seconds'));
  assert.ok(columns.includes('timer_state'));
  assert.ok(columns.includes('timer_started_at'));
  assert.ok(columns.includes('timer_resumed_at'));
  assert.ok(columns.includes('timer_paused_at'));
  assert.ok(columns.includes('timer_theoretical_end_at'));
  assert.ok(columns.includes('timer_accumulated_seconds'));
  assert.ok(columns.includes('timer_alarm_revision'));
  assert.ok(columns.includes('timer_alarm_status'));
  assert.ok(columns.includes('timer_alarm_synced_at'));

  const index = database
    .prepare(
      `SELECT sql FROM sqlite_schema
       WHERE type = 'index'
         AND name = 'idx_irrigation_event_equipment_active_equipment'`,
    )
    .get();
  assert.match(
    String(index?.sql),
    /CREATE UNIQUE INDEX.*WHERE `timer_state` IS NOT NULL/,
  );
  const alarmIndex = database
    .prepare(
      `SELECT sql FROM sqlite_schema
       WHERE type = 'index'
         AND name = 'idx_irrigation_event_equipment_alarm_status'`,
    )
    .get();
  assert.match(String(alarmIndex?.sql), /WHERE `timer_state` IS NOT NULL/);
  database.close();
});

test('la reprise géométrique ne peut venir que d’une saison antérieure', () => {
  const database = createMigratedDatabase();
  database
    .prepare(
      `INSERT INTO irrigation_workspaces (id, owner_user_id)
       VALUES (?, ?)`,
    )
    .run('workspace-1', 'user-1');

  const insertGeometry = database.prepare(
    `INSERT INTO irrigation_season_geometry
     (workspace_id, season, copied_from_season)
     VALUES (?, ?, ?)`,
  );
  insertGeometry.run('workspace-1', 2027, 2026);
  assert.throws(() => insertGeometry.run('workspace-1', 2028, 2028));
  assert.throws(() => insertGeometry.run('workspace-1', 2029, 2030));
  database.close();
});

test('la correction replace le jardin fleurs après les blocs 1 à 6', () => {
  const database = createMigratedDatabase('0002_outgoing_thunderbolts.sql');
  database
    .prepare(
      `INSERT INTO irrigation_workspaces (id, owner_user_id)
       VALUES (?, ?)`,
    )
    .run('workspace-1', 'user-1');
  database
    .prepare(
      `INSERT INTO irrigation_garden_groups
       (id, workspace_id, season, name, position)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      'e23f91f7-405a-4caa-81b1-f93299fdf260',
      'workspace-1',
      2026,
      'Ouest',
      1,
    );

  const insertMember = database.prepare(
    `INSERT INTO irrigation_garden_group_members
     (group_id, otf_zone_id, otf_plot_id, position, bed_order, gap_before_meters)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  [
    ['51', 1, 0],
    ['30564', 2, 0],
    ['54', 3, 1.65],
    ['55', 4, 1.65],
    ['56', 5, 1.65],
    ['57', 6, 1.65],
    ['58', 7, 1.65],
  ].forEach(([plotId, position, gap]) => {
    insertMember.run(
      'e23f91f7-405a-4caa-81b1-f93299fdf260',
      '14',
      plotId,
      position,
      'normal',
      gap,
    );
  });

  applyMigration(database, '0003_realign_west_gardens.sql');
  const members = database
    .prepare(
      `SELECT otf_plot_id, position, gap_before_meters
       FROM irrigation_garden_group_members
       ORDER BY position`,
    )
    .all();

  assert.deepEqual(
    members.map((member) => member.otf_plot_id),
    ['51', '54', '55', '56', '57', '58', '30564'],
  );
  assert.deepEqual(
    members.map((member) => Number(member.gap_before_meters)),
    [0, 1.65, 1.65, 1.65, 1.65, 1.65, 1],
  );
  database.close();
});

test('la base limite réellement un matériel à dix réglages', () => {
  const database = createMigratedDatabase();
  database
    .prepare(
      `INSERT INTO irrigation_workspaces (id, owner_user_id)
       VALUES (?, ?)`,
    )
    .run('workspace-1', 'user-1');
  database
    .prepare(
      `INSERT INTO irrigation_equipment
       (id, workspace_id, name, kind, mobility)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run('equipment-1', 'workspace-1', 'Rampe 1', 'sprinkler', 'mobile');

  const insertSetting = database.prepare(
    `INSERT INTO irrigation_equipment_settings
     (id, equipment_id, name, position)
     VALUES (?, ?, ?, ?)`,
  );
  for (let position = 1; position <= 10; position += 1) {
    insertSetting.run(
      `setting-${position}`,
      'equipment-1',
      `Réglage ${position}`,
      position,
    );
  }

  assert.throws(() =>
    insertSetting.run('setting-11', 'equipment-1', 'Réglage 11', 11),
  );
  database.close();
});

test('les catégories et les valeurs physiques invalides sont rejetées', () => {
  const database = createMigratedDatabase();
  database
    .prepare(
      `INSERT INTO irrigation_workspaces (id, owner_user_id)
       VALUES (?, ?)`,
    )
    .run('workspace-1', 'user-1');

  const insertEquipment = database.prepare(
    `INSERT INTO irrigation_equipment
     (id, workspace_id, name, kind, mobility)
     VALUES (?, ?, ?, ?, ?)`,
  );
  assert.throws(() =>
    insertEquipment.run(
      'equipment-invalid',
      'workspace-1',
      'Matériel invalide',
      'unknown',
      'mobile',
    ),
  );

  insertEquipment.run(
    'equipment-1',
    'workspace-1',
    'Rampe 1',
    'sprinkler',
    'mobile',
  );
  database
    .prepare(
      `INSERT INTO irrigation_equipment_settings
       (id, equipment_id, name, position)
       VALUES (?, ?, ?, ?)`,
    )
    .run('setting-1', 'equipment-1', 'Réglage 1', 1);

  assert.throws(() =>
    database
      .prepare(
        `INSERT INTO sprinkler_profile_points
         (id, setting_id, side, distance_meters, rate_mm_per_hour)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run('point-invalid', 'setting-1', 'left', -1, 8),
  );
  database.close();
});
