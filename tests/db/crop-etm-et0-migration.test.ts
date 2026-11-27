import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { overrideDatabase } from '../../db/binding';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { demoOwnerUserId, resolveDemoChoice } from '../../lib/domain/demo/catalogue';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { applyMigrationsAfter, createD1FromSqlite, createMigratedSqliteDatabase } from '../support/d1-sqlite';

/**
 * La migration 0042 (borne haute de l'ET0 portée à 15 mm/j, MC-37 ; F591,
 * D-232) recrée la table des ETM du jour pour changer sa contrainte : l'essai
 * se fait sur une copie, une base arrêtée à la 0041, remplie comme une ferme
 * de la démonstration et de jours d'ETM écrits à la main (ET0 de 0 et 12,
 * bornes d'avant comprises). Aucune ligne d'aucune table ne change ; l'index
 * est recréé ; seule la borne de la contrainte change.
 */

const BEFORE = '0041_support_accesses_cost_readings.sql';
/** La migration éprouvée, seule : celles d'après (0043, les messages du téléphone) ajoutent leurs tables. */
const MIGRATION = '0042_crop_etm_et0_15.sql';
const TABLE = 'irrigation_crop_etm_days';

function dump(database: DatabaseSync): Record<string, string[]> {
  const tables = (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(({ name }) => name);
  return Object.fromEntries(tables.map((table) => [
    table,
    (database.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]).map((row) => JSON.stringify(row)).sort(),
  ]));
}

const tableSql = (database: DatabaseSync) => (database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(TABLE) as { sql: string }).sql;
const normalized = (sql: string) => sql.replace(/^CREATE TABLE [`"]?irrigation_crop_etm_days(_new)?[`"]? \(/, 'CREATE TABLE (').replace(/\s+/g, ' ');

function insertDay(database: DatabaseSync, workspace: string, date: string, et0: number | null) {
  database.prepare(`INSERT INTO ${TABLE} (workspace_id, season, otf_bed_id, date, status, etm_mm, et0_mm, et0_nature, computed_at)
    VALUES (?, 2026, 'planche-essai', ?, 'no-crop', 0, ?, ?, '2026-07-01T05:00:00.000Z')`).run(workspace, date, et0, et0 === null ? null : 'reanalysis');
}

test('la migration 0037 recrée la table des ETM du jour, borne de l’ET0 à 15 mm/j, sans changer une ligne', async () => {
  const savedDemoMode = process.env.DEMO_MODE;
  const sqlite = createMigratedSqliteDatabase('drizzle', BEFORE);
  overrideDatabase(createD1FromSqlite(sqlite));
  try {
    process.env.DEMO_MODE = 'true';
    // Les dépôts d'aujourd'hui écrivent aussi au journal des modifications (0044, amélioration n° 7) : sur la copie
    // arrêtée à la 0041, ses lignes vont dans une table temporaire, hors de la copie, effacée avant la migration.
    sqlite.exec(`CREATE TEMP TABLE irrigation_change_journal (id, workspace_id, family, subject, object_id, object_context, action,
      before_values, after_values, actor_user_id, created_at)`);
    // Même raison : ils lisent le réglage de l'objectif automatique (0047, D-317), vide, donc éteint.
    sqlite.exec('CREATE TEMP TABLE irrigation_automatic_objective_revisions (id, workspace_id, enabled, actor_user_id, created_at)');
    // Même raison : ils lisent la façon de commencer (0051, lot S6, D-336) : ses deux colonnes, sans contrainte, le temps de remplir la copie.
    sqlite.exec('ALTER TABLE irrigation_feature_selections ADD COLUMN start_mode text');
    sqlite.exec('ALTER TABLE irrigation_feature_selections ADD COLUMN route_state text');
    // Et les gestes « hors saison » (0052, D-352), aucun : rien n'est hors saison.
    sqlite.exec('CREATE TEMP TABLE irrigation_off_season_revisions (id, workspace_id, scope_level, scope_id, off_season, actor_user_id, created_at)');
    // Même raison : la démonstration sème l'archive des prévisions (0046, D-297 ; D-344, F1007).
    sqlite.exec(`CREATE TEMP TABLE irrigation_weather_forecast_archive (workspace_id, location_key, issued_on, target_date, horizon_days,
      precipitation_mm, et0_mm, minimum_temperature_celsius, maximum_temperature_celsius, solar_energy_mj_per_square_meter, source, fetched_at,
      UNIQUE (workspace_id, location_key, issued_on, target_date))`);
    const choice = resolveDemoChoice('maraichage', 'ete');
    await prepareDemoSpace(demoOwnerUserId('copie', choice), choice);
    delete process.env.DEMO_MODE;
    const workspace = await ensureWorkspaceForUser('ferme-essai');
    insertDay(sqlite, workspace, '2026-07-01', 0);
    insertDay(sqlite, workspace, '2026-07-02', 12);
    insertDay(sqlite, workspace, '2026-07-03', null);
    assert.throws(() => insertDay(sqlite, workspace, '2026-07-04', 12.1), /CHECK constraint failed/, 'avant : 12 au plus');
    const sqlBefore = tableSql(sqlite);
    sqlite.exec('DROP TABLE temp.irrigation_change_journal');
    sqlite.exec('DROP TABLE temp.irrigation_automatic_objective_revisions');
    sqlite.exec('ALTER TABLE irrigation_feature_selections DROP COLUMN start_mode');
    sqlite.exec('ALTER TABLE irrigation_feature_selections DROP COLUMN route_state');
    sqlite.exec('DROP TABLE temp.irrigation_off_season_revisions');
    sqlite.exec('DROP TABLE temp.irrigation_weather_forecast_archive');

    const before = dump(sqlite);
    assert.ok(before[TABLE].length >= 3);
    const filled = Object.entries(before).filter(([, rows]) => rows.length > 0).length;
    assert.ok(filled >= 15, `la copie est une ferme complète (${filled} tables remplies)`);

    applyMigrationsAfter(sqlite, BEFORE, 'drizzle', MIGRATION);

    assert.deepEqual(dump(sqlite), before, 'aucune ligne d’aucune table ne change');
    assert.equal(normalized(tableSql(sqlite)), normalized(sqlBefore).replace('`et0_mm` <= 12', '`et0_mm` <= 15'), 'seule la borne change');
    assert.deepEqual(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_%'").all(TABLE).map((row) => (row as { name: string }).name), ['idx_crop_etm_days_date']);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'irrigation_crop_etm_days_new'").get()?.n, 0);
    for (const [date, et0] of [['2026-07-04', 12.1], ['2026-07-05', 14.9], ['2026-07-06', 15]] as const) insertDay(sqlite, workspace, date, et0);
    assert.throws(() => insertDay(sqlite, workspace, '2026-07-07', 15.1), /CHECK constraint failed/, 'après : 15 au plus');
    assert.throws(() => insertDay(sqlite, workspace, '2026-07-08', -0.1), /CHECK constraint failed/);
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = savedDemoMode;
    sqlite.close();
  }
});
