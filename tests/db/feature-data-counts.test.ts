import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { countFeatureDataForUser } from '../../db/feature-data-counts';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { uncheckWarning } from '../../lib/domain/features/warnings';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

// docs/feature-selection-contract.md, R2 : l'avertissement compte ce que la ferme a enregistré.

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

function insert(sql: string, ...values: (string | number | null)[]) {
  database.sqlite.prepare(sql).run(...values);
}

async function seedFarm(owner: string) {
  const ws = await ensureWorkspaceForUser(owner);
  insert(`INSERT INTO irrigation_equipment (id, workspace_id, name, kind, mobility) VALUES (?, ?, 'Asperseur', 'sprinkler', 'mobile')`, `${owner}-eq-1`, ws);
  insert(`INSERT INTO irrigation_equipment (id, workspace_id, name, kind, mobility, status, archived_at) VALUES (?, ?, 'Ancien', 'drip', 'fixed', 'archived', '2026-01-01T00:00:00.000Z')`, `${owner}-eq-2`, ws);
  insert(`INSERT INTO irrigation_events (id, workspace_id, season, status) VALUES (?, ?, 2026, 'completed')`, `${owner}-ev-1`, ws);
  insert(`INSERT INTO irrigation_events (id, workspace_id, season, status) VALUES (?, ?, 2026, 'planned')`, `${owner}-ev-2`, ws);
  insert(`INSERT INTO irrigation_events (id, workspace_id, season, status, canceled_at) VALUES (?, ?, 2026, 'canceled', '2026-06-01T00:00:00.000Z')`, `${owner}-ev-3`, ws);
  // Le même objectif de ferme, recopié sur deux semaines, et un objectif de parcelle effacé ensuite.
  const goal = `INSERT INTO irrigation_hydric_goal_revisions (id, workspace_id, season, week_start, scope_type, otf_zone_id, amount_mm, action, actor_user_id) VALUES (?, ?, 2026, ?, ?, ?, ?, ?, ?)`;
  insert(goal, `${owner}-g-1`, ws, '2026-06-01', 'farm', null, 20, 'set', owner);
  insert(goal, `${owner}-g-2`, ws, '2026-06-08', 'farm', null, 20, 'set', owner);
  insert(goal, `${owner}-g-3`, ws, '2026-06-08', 'zone', 'z-1', 15, 'set', owner);
  insert(`INSERT INTO irrigation_weather_daily_values (workspace_id, location_key, date, data_kind, precipitation_mm, source, fetched_at) VALUES (?, 'ferme', '2026-06-02', 'manual_precipitation', 4, 'manual', '2026-06-02T08:00:00.000Z')`, ws);
  insert(`INSERT INTO irrigation_weather_daily_values (workspace_id, location_key, date, data_kind, precipitation_mm, et0_mm, source, fetched_at) VALUES (?, 'ferme', '2026-06-02', 'forecast', 1, 3, 'open-meteo', '2026-06-02T08:00:00.000Z')`, ws);
  const plan = `INSERT INTO irrigation_plan_calculations (id, workspace_id, season, week_start, trigger, computed_at, horizon_start_at, horizon_end_at, settings, summary) VALUES (?, ?, 2026, ?, 'daily', '2026-06-01T05:00:00.000Z', '2026-06-01T05:00:00.000Z', '2026-06-07T21:00:00.000Z', '{}', '{}')`;
  insert(plan, `${owner}-p-1`, ws, '2026-06-01');
  insert(plan, `${owner}-p-2`, ws, '2026-06-01');
  // Un créneau protégé actif, un autre supprimé (3.8 ter) : seul le premier compte.
  const slot = `INSERT INTO irrigation_protected_slots (id, workspace_id, name, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_minute, end_minute, status, actor_user_id) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0, 1260, 1380, ?, ?)`;
  insert(slot, `${owner}-ps-1`, ws, 'Lavage', 'active', owner);
  insert(slot, `${owner}-ps-2`, ws, 'Passage', 'deleted', owner);
  insert(plan, `${owner}-p-3`, ws, '2026-06-08');
  insert(`INSERT INTO irrigation_water_resources (id, workspace_id, name, type, nominal_flow_cubic_meters_per_hour) VALUES (?, ?, 'Forage', 'borehole', 4)`, `${owner}-r-1`, ws);
  insert(`INSERT INTO irrigation_pumps (id, workspace_id, name, maximum_flow_cubic_meters_per_hour) VALUES (?, ?, 'Pompe', 5)`, `${owner}-pu-1`, ws);
  insert(`INSERT INTO irrigation_soil_observations (id, workspace_id, otf_zone_id, percent, observed_at, recorded_at) VALUES (?, ?, 'z-1', 60, '2026-06-02', '2026-06-02T08:00:00.000Z')`, `${owner}-so-1`, ws);
  insert(`INSERT INTO irrigation_crop_species_links (id, workspace_id, plant_id, target_kind, crop_key) VALUES (?, ?, 'carotte', 'reference', 'carrot')`, `${owner}-sl-1`, ws);
  insert(`INSERT INTO irrigation_weather_alert_criteria (id, workspace_id, current_version) VALUES (?, ?, 1)`, `${owner}-wa-1`, ws);
  insert(`INSERT INTO irrigation_weather_alert_criteria (id, workspace_id, current_version, deleted_at) VALUES (?, ?, 1, '2026-06-03T00:00:00.000Z')`, `${owner}-wa-2`, ws);
  const settings = `INSERT INTO irrigation_crop_alert_settings (id, workspace_id, frost_active, drying_active, sprinkler_active, horizon_days, frost_offset_celsius, sprinkler_max_temperature_celsius, sprinkler_radiation_w_per_square_meter, recorded_at) VALUES (?, ?, 1, 1, 0, 3, 0, 18, 250, ?)`;
  insert(settings, `${owner}-ca-1`, ws, '2026-06-01T00:00:00.000Z');
  insert(settings, `${owner}-ca-2`, ws, '2026-06-02T00:00:00.000Z');
  // Un réglage « mesuré » (3.8 bis) ; l'autre réglage, sans provenance, est « saisi » et ne compte pas.
  insert(`INSERT INTO irrigation_equipment_settings (id, equipment_id, name, position) VALUES (?, ?, 'Mesuré', 1)`, `${owner}-st-1`, `${owner}-eq-1`);
  insert(`INSERT INTO irrigation_equipment_settings (id, equipment_id, name, position) VALUES (?, ?, 'Saisi', 2)`, `${owner}-st-2`, `${owner}-eq-1`);
  insert(`INSERT INTO irrigation_equipment_setting_calculations (setting_id, workspace_id, level, calculated_at) VALUES (?, ?, 'measured', '2026-06-01T00:00:00.000Z')`, `${owner}-st-1`, ws);
}

test('une ferme sans espace n’a rien enregistré, et la lecture ne crée rien', async () => {
  assert.deepEqual(await countFeatureDataForUser('alice'), {});
  assert.equal(await findWorkspaceIdForUser('alice'), null);
});

test('les comptes disent ce que la ferme reconnaît comme siens, sans ceux d’une autre ferme', async () => {
  await seedFarm('alice');
  await seedFarm('bruno');
  assert.deepEqual(await countFeatureDataForUser('alice'), {
    equipment: 1,
    irrigationEvents: 2,
    goals: 2,
    rainMeasures: 1,
    plans: 2,
    protectedSlots: 1,
    resources: 1,
    pumps: 1,
    soilRecords: 1,
    cropSettings: 1,
    weatherAlertCriteria: 1,
    cropAlertSettings: 1,
    settingCalculations: 1,
  });
  await ensureWorkspaceForUser('carole');
  const empty = await countFeatureDataForUser('carole');
  assert.ok(Object.values(empty).every((value) => value === 0), 'une ferme neuve : zéro partout');
});

test('les comptes donnent le texte de l’avertissement (R2)', async () => {
  await seedFarm('alice');
  const counts = await countFeatureDataForUser('alice');
  assert.equal(
    uncheckWarning('ressources', counts),
    '1 ressource et 1 pompe restent enregistrées. Le planning ne tiendra plus compte de leurs débits ni de leurs stocks : il se calculera comme pour une ferme sans pompe ni ressource déclarée.',
  );
  assert.match(uncheckWarning('besoins', counts) ?? '', /^2 objectifs et 1 mesure de pluie restent enregistrés\./);
  assert.match(uncheckWarning('planning', counts) ?? '', /^2 plans déjà calculés et 1 créneau protégé restent enregistrés\. /, 'les créneaux protégés sont un réglage du planning (3.8 ter)');
  assert.equal(
    uncheckWarning('calculateur', counts),
    '1 réglage garde sa provenance (calculé, estimé ou mesuré). Le bouton « Calculer depuis le matériel » et les étiquettes ne s’affichent plus ; les valeurs des réglages ne changent pas.',
  );
});
