import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { overrideDatabase } from '../../db/binding';
import { attachPendingWorkspace, ensureWorkspaceForUser } from '../../db/workspace-repository';
import { demoOwnerUserId, resolveDemoChoice } from '../../lib/domain/demo/catalogue';
import { farmSpaceKey } from '../../lib/domain/farm-space';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { getOnboardingForUser } from '../../lib/services/onboarding-service';
import { applyMigrationsAfter, createD1FromSqlite, createMigratedSqliteDatabase } from '../support/d1-sqlite';

/**
 * Le marquage des espaces existants par la migration 0034 (4.4,
 * docs/tranche-4-contract.md, F426, F581 ; preuve 4 de la section 8 bis.6) :
 * l'essai se fait sur une copie, une base arrêtée à la 0033 et remplie comme
 * une ferme complète (une ferme de la démonstration, préparée par les dépôts
 * ordinaires : matériel, eau, arrosages, météo, espèces, objectifs, plan de
 * la semaine), plus un espace rattaché à sa ferme. La migration ne change
 * aucune ligne d'aucune autre table, et marque chaque espace, et lui seul,
 * « accueil fait avant la 4.4 ».
 */

const BEFORE = '0033_otf_token_vault.sql';
const NEW_TABLE = 'irrigation_onboarding_steps';

/** Les deux colonnes de la 0051 (lot S6, D-336), vides pour une ferme existante (voir son essai) : la comparaison porte sur les autres. */
function withoutLaterColumns(table: string, row: Record<string, unknown>): Record<string, unknown> {
  if (table !== 'irrigation_feature_selections') return row;
  const { start_mode: startMode, route_state: routeState, ...rest } = row;
  assert.equal(startMode ?? null, null);
  assert.equal(routeState ?? null, null);
  return rest;
}

function dump(database: DatabaseSync): Record<string, string[]> {
  const tables = (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[])
    .map(({ name }) => name)
    .filter((name) => name !== NEW_TABLE);
  return Object.fromEntries(tables.map((table) => [
    table,
    (database.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]).map((row) => JSON.stringify(withoutLaterColumns(table, row))).sort(),
  ]));
}

test('la migration 0034 marque chaque espace existant « avant l’accueil » sans changer une valeur', async () => {
  const savedDemoMode = process.env.DEMO_MODE;
  const sqlite = createMigratedSqliteDatabase('drizzle', BEFORE);
  overrideDatabase(createD1FromSqlite(sqlite));
  try {
    process.env.DEMO_MODE = 'true';
    // Les dépôts d'aujourd'hui écrivent aussi au journal des modifications (0044, amélioration n° 7) : sur la copie
    // arrêtée à la 0033, ses lignes vont dans une table temporaire, hors de la copie, effacée avant les migrations.
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
    // Et le modèle de prévision de la ferme (0053, D-346), vide, donc « Automatique » : une colonne, ajoutée le temps de
    // remplir la copie, retirée avant les migrations.
    sqlite.exec('ALTER TABLE irrigation_weather_preferences ADD forecast_model text');
    const choice = resolveDemoChoice('maraichage', 'ete');
    const farm = demoOwnerUserId('copie', choice);
    await prepareDemoSpace(farm, choice);
    delete process.env.DEMO_MODE;
    await ensureWorkspaceForUser('ancienne-personne');
    assert.equal(await attachPendingWorkspace('ancienne-personne', '4394'), true);

    sqlite.exec('DROP TABLE temp.irrigation_change_journal');
    sqlite.exec('DROP TABLE temp.irrigation_automatic_objective_revisions');
    sqlite.exec('ALTER TABLE irrigation_feature_selections DROP COLUMN start_mode');
    sqlite.exec('ALTER TABLE irrigation_feature_selections DROP COLUMN route_state');
    sqlite.exec('DROP TABLE temp.irrigation_off_season_revisions');
    sqlite.exec('DROP TABLE temp.irrigation_weather_forecast_archive');
    sqlite.exec('ALTER TABLE irrigation_weather_preferences DROP COLUMN forecast_model');
    const before = dump(sqlite);
    const filled = Object.entries(before).filter(([, rows]) => rows.length > 0).map(([table]) => table);
    assert.ok(filled.length >= 15, `la copie est une ferme complète (${filled.length} tables remplies : ${filled.join(', ')})`);
    const workspaces = (sqlite.prepare('SELECT id FROM irrigation_workspaces ORDER BY id').all() as { id: string }[]).map(({ id }) => id);
    assert.equal(workspaces.length, 2);

    applyMigrationsAfter(sqlite, BEFORE);

    const after = dump(sqlite);
    // Les migrations suivantes ajoutent leurs tables ; la 0035 (classement des jardins, F583) n'écrit rien pour un espace existant.
    assert.deepEqual(after.irrigation_plot_shelters, [], 'aucun jardin n’est classé à la place d’un espace existant');
    assert.deepEqual(Object.fromEntries(Object.keys(before).map((table) => [table, after[table]])), before, 'aucune ligne d’aucune autre table ne change');
    const marks = sqlite.prepare(`SELECT workspace_id, step, state, origin, proposed_value, confirmed_at FROM ${NEW_TABLE} ORDER BY workspace_id, step`).all() as {
      workspace_id: string; step: string; state: string; origin: string; proposed_value: string | null; confirmed_at: string | null;
    }[];
    assert.equal(marks.length, workspaces.length * 5, 'cinq étapes par espace existant');
    for (const workspace of workspaces) {
      assert.deepEqual(marks.filter((mark) => mark.workspace_id === workspace).map((mark) => mark.step), ['crops', 'location', 'plots', 'settings', 'soil']);
    }
    assert.ok(marks.every((mark) => mark.state === 'confirmed' && mark.origin === 'before-onboarding' && mark.proposed_value === null && mark.confirmed_at !== null));
    assert.equal((await getOnboardingForUser(farmSpaceKey('ancienne-personne', '4394'))).kind, 'before-onboarding');

    // Un espace créé après la migration n'est pas marqué : il commence l'accueil.
    await ensureWorkspaceForUser('nouvelle-personne');
    const fresh = await getOnboardingForUser('nouvelle-personne');
    assert.equal(fresh.kind, 'onboarding');
  } finally {
    overrideDatabase(null);
    sqlite.close();
    if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = savedDemoMode;
  }
});
