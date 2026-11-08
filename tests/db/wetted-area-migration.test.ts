import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMigrationsAfter, createMigratedSqliteDatabase } from '../support/d1-sqlite';

/**
 * La migration 0016 ajoute la surface mouillée aux applications d'irrigation et
 * remplit les lignes existantes avec leur surface de planche (décision D-023 :
 * les volumes déjà enregistrés restent tels quels). Ce test rejoue ce qui se
 * passe sur une base qui a déjà des irrigations : il s'arrête à la 0015, y pose
 * une application, puis applique la suite.
 */
test('la migration 0016 donne aux applications existantes leur surface de planche comme surface mouillée', () => {
  const database = createMigratedSqliteDatabase('drizzle', '0015_resource_meter_readings.sql');
  const columnsBefore = (database.prepare('PRAGMA table_info("irrigation_bed_applications")').all() as { name: string }[]).map((column) => column.name);
  assert.ok(!columnsBefore.includes('wetted_area_square_meters'), 'la colonne n’existe pas encore avant la 0016');

  database.exec(`
    INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES ('workspace', 'alice');
    INSERT INTO irrigation_events (id, workspace_id, season, status) VALUES ('event', 'workspace', 2026, 'completed');
    INSERT INTO irrigation_equipment (id, workspace_id, name, kind, mobility) VALUES ('equipment', 'workspace', 'Rampe', 'sprinkler', 'mobile');
    INSERT INTO irrigation_equipment_settings (id, equipment_id, name, position) VALUES ('setting', 'equipment', 'Réglage', 1);
    INSERT INTO irrigation_equipment_placements (id, workspace_id, equipment_id, setting_id, season, otf_zone_id, otf_plot_id, anchor_type, anchor_bed_otf_id)
      VALUES ('placement', 'workspace', 'equipment', 'setting', 2026, 'zone', 'plot', 'bed_center', 'bed');
    INSERT INTO irrigation_event_equipment (id, event_id, equipment_id, setting_id, placement_id, status, equipment_snapshot, setting_snapshot, placement_snapshot)
      VALUES ('event-equipment', 'event', 'equipment', 'setting', 'placement', 'completed', '{}', '{}', '{}');
    INSERT INTO irrigation_bed_applications (event_equipment_id, otf_zone_id, otf_plot_id, otf_bed_id, rate_mm_per_hour, bed_area_square_meters, planned_amount_mm, actual_amount_mm)
      VALUES ('event-equipment', 'zone', 'plot', 'bed', 10, 16.5, 10, 10);
  `);

  applyMigrationsAfter(database, '0015_resource_meter_readings.sql');

  const row = database.prepare('SELECT bed_area_square_meters, wetted_area_square_meters FROM irrigation_bed_applications').get() as {
    bed_area_square_meters: number;
    wetted_area_square_meters: number | null;
  };
  assert.equal(row.bed_area_square_meters, 16.5, 'la surface de planche est intacte');
  assert.equal(row.wetted_area_square_meters, 16.5, 'la ligne ancienne garde son volume : planche seule');

  // Après la migration, NULL n'a plus qu'un sens : inconnue à l'enregistrement.
  database.exec(`
    INSERT INTO irrigation_bed_applications (event_equipment_id, otf_zone_id, otf_plot_id, otf_bed_id, rate_mm_per_hour, bed_area_square_meters, wetted_area_square_meters, planned_amount_mm, actual_amount_mm)
      VALUES ('event-equipment', 'zone', 'plot', 'bed-2', 10, 16.5, NULL, 10, 10);
  `);
  const unknown = database.prepare("SELECT wetted_area_square_meters FROM irrigation_bed_applications WHERE otf_bed_id = 'bed-2'").get() as { wetted_area_square_meters: number | null };
  assert.equal(unknown.wetted_area_square_meters, null);
  assert.throws(
    () => database.exec(`
      INSERT INTO irrigation_bed_applications (event_equipment_id, otf_zone_id, otf_plot_id, otf_bed_id, rate_mm_per_hour, bed_area_square_meters, wetted_area_square_meters, planned_amount_mm, actual_amount_mm)
        VALUES ('event-equipment', 'zone', 'plot', 'bed-3', 10, 16.5, 0, 10, 10);
    `),
    /CHECK|constraint/i,
    'une surface mouillée nulle ou négative est refusée : inconnue se dit NULL',
  );
});
