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

function dump(database: DatabaseSync): Record<string, string[]> {
  const tables = (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[])
    .map(({ name }) => name)
    .filter((name) => name !== NEW_TABLE);
  return Object.fromEntries(tables.map((table) => [
    table,
    (database.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]).map((row) => JSON.stringify(row)).sort(),
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
    const choice = resolveDemoChoice('maraichage', 'ete');
    const farm = demoOwnerUserId('copie', choice);
    await prepareDemoSpace(farm, choice);
    delete process.env.DEMO_MODE;
    await ensureWorkspaceForUser('ancienne-personne');
    assert.equal(await attachPendingWorkspace('ancienne-personne', '4394'), true);

    sqlite.exec('DROP TABLE temp.irrigation_change_journal');
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
