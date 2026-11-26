import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import {
  InvalidFeatureSelectionError,
  readFeatureSelectionForUser,
  saveFeatureSelectionForUser,
  saveStartChoiceForUser,
} from '../../db/feature-selection-repository';
import { overrideDatabase } from '../../db/binding';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { demoOwnerUserId, resolveDemoChoice } from '../../lib/domain/demo/catalogue';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { resolveFeatureSelection } from '../../lib/domain/features/selection';
import { buildInsertStatements, quoteIdentifier } from '../../lib/services/d1-export-import';
import { resetDemoSpace } from '../../lib/services/demo-reset';
import { getFeatureSelectionForUser } from '../../lib/services/feature-selection-service';
import { chooseStartForUser } from '../../lib/services/start-choice';
import { applyMigrationsAfter, createD1FromSqlite, createMigratedSqliteDatabase, installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * Simplifier l'usage du module, lot S6, PR 1 : ce que la ferme garde de sa
 * première ouverture (docs/simplification-s6-contract.md, sections 3.4, 4,
 * 12 et 14 ; D-336). Le service du choix, la base, la migration 0051 et
 * l'export ; Alice et Bob aux quatre passages d'isolation du dépôt.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const NOW = new Date('2026-11-26T08:00:00.000Z');

/** La ligne du choix d'un espace, telle quelle ; aucune sans espace. */
async function selectionRow(owner: string): Promise<Record<string, unknown> | undefined> {
  const workspaceId = await findWorkspaceIdForUser(owner);
  if (workspaceId === null) return undefined;
  return database.sqlite.prepare('SELECT * FROM irrigation_feature_selections WHERE workspace_id = ?').get(workspaceId) as Record<string, unknown> | undefined;
}

test('chaque façon s’enregistre avec ses cases, calculées par le serveur ; celles du navigateur sont ignorées', async () => {
  const expected = {
    notes: ['arrosages', 'materiel', 'historique'],
    proposals: ['arrosages', 'planning', 'besoins', 'materiel', 'ressources', 'historique'],
    all: [...FEATURE_IDS],
  } as const;
  for (const [index, [way, cases]] of Object.entries(expected).entries()) {
    const owner = `ferme-${index}`;
    // Le navigateur qui impose ses cases (contre-épreuve de la section 14) : elles ne comptent pas.
    const outcome = await chooseStartForUser(owner, { startMode: way, enabled: ['alertes-meteo'] }, NOW);
    assert.deepEqual(outcome, { kind: 'saved', startMode: way, enabled: [...cases], firstPage: 'ma-ferme' }, way);
    const stored = await readFeatureSelectionForUser(owner);
    assert.deepEqual(stored, {
      kind: 'stored',
      enabled: [...cases],
      known: [...FEATURE_IDS],
      chosenAt: NOW.toISOString(),
      bannerDismissedAt: null,
      startMode: way,
      routeState: null,
    }, way);
    const resolved = resolveFeatureSelection(stored);
    assert.deepEqual([resolved.firstVisit, resolved.banner, resolved.startMode, resolved.routeState], [false, null, way, null], `${way} : pas de bandeau, la carte visible`);
  }
});

test('« Choisir moi-même » : ses cases, complétées ; au moins une ; des alertes seules arrivent sur la page d’arrivée', async () => {
  assert.deepEqual(await chooseStartForUser(ALICE, { startMode: 'custom', enabled: [] }, NOW), { kind: 'refused', message: 'Cochez au moins une fonctionnalité pour continuer.' });
  assert.deepEqual(await chooseStartForUser(ALICE, { startMode: 'custom', enabled: ['inconnue', 42] }, NOW), { kind: 'refused', message: 'Cochez au moins une fonctionnalité pour continuer.' });
  assert.equal(await findWorkspaceIdForUser(ALICE), null, 'un refus ne crée rien');
  assert.deepEqual(await chooseStartForUser(ALICE, { startMode: 'custom', enabled: ['planning'] }, NOW), {
    kind: 'saved', startMode: 'custom', enabled: ['arrosages', 'planning', 'besoins', 'materiel'], firstPage: 'ma-ferme',
  });
  assert.equal((await selectionRow(ALICE))?.start_mode, 'custom');
  assert.deepEqual(await chooseStartForUser(BOB, { startMode: 'custom', enabled: ['alertes-meteo'] }, NOW), {
    kind: 'saved', startMode: 'custom', enabled: ['alertes-meteo'], firstPage: 'aujourdhui',
  });
});

test('une façon inconnue est refusée et rien n’est écrit', async () => {
  for (const startMode of [undefined, '', 'tout', null, 3]) {
    assert.deepEqual(await chooseStartForUser(ALICE, { startMode, enabled: [...FEATURE_IDS] }, NOW), { kind: 'refused', message: 'Choisissez une façon de commencer.' });
  }
  assert.equal(await findWorkspaceIdForUser(ALICE), null);
  await assert.rejects(saveStartChoiceForUser(ALICE, 'custom', ['planning'], NOW), InvalidFeatureSelectionError, 'des cases incomplètes, refusées par le dépôt aussi');
  assert.equal(await findWorkspaceIdForUser(ALICE), null);
});

test('section 12 : deux appuis sur « Continuer » ne font qu’un enregistrement ; le second apprend que le choix est fait et reçoit la page d’arrivée', async () => {
  assert.equal((await chooseStartForUser(ALICE, { startMode: 'notes', enabled: [] }, NOW)).kind, 'saved');
  const second = await chooseStartForUser(ALICE, { startMode: 'all', enabled: [] }, new Date('2026-11-26T08:00:05.000Z'));
  assert.deepEqual(second, { kind: 'already-chosen', firstPage: 'aujourdhui' }, 'les ouvertures suivantes gardent la page d’arrivée de F31');
  const row = (await selectionRow(ALICE))!;
  assert.deepEqual([row.start_mode, row.enabled_features, row.chosen_at], ['notes', JSON.stringify(['arrosages', 'materiel', 'historique']), NOW.toISOString()], 'rien n’est réécrit');
  const journal = database.sqlite.prepare("SELECT COUNT(*) AS n FROM irrigation_change_journal WHERE subject = 'fonctionnalites'").get() as { n: number };
  assert.equal(journal.n, 1, 'un seul passage au journal des modifications');
  // Deux appels lancés ensemble : un seul l'emporte.
  const [one, two] = await Promise.all([
    chooseStartForUser(BOB, { startMode: 'proposals', enabled: [] }, NOW),
    chooseStartForUser(BOB, { startMode: 'notes', enabled: [] }, NOW),
  ]);
  assert.deepEqual([one.kind, two.kind].sort(), ['already-chosen', 'saved']);
  const bob = resolveFeatureSelection(await readFeatureSelectionForUser(BOB));
  assert.equal(bob.startMode, one.kind === 'saved' ? 'proposals' : 'notes', 'la ligne est celle de l’appel qui l’a emporté');
});

test('une ferme qui a déjà ouvert le module (d’avant la 3.8, ou d’avant S6) ne repasse pas par le choix de départ', async () => {
  await ensureWorkspaceForUser(ALICE);
  assert.deepEqual(await chooseStartForUser(ALICE, { startMode: 'all', enabled: [] }, NOW), { kind: 'already-chosen', firstPage: 'aujourdhui' });
  assert.equal(await selectionRow(ALICE), undefined, 'une ferme d’avant la 3.8 garde tout coché, sans ligne (R6)');
  await saveFeatureSelectionForUser(BOB, ['alertes-meteo'], NOW);
  assert.equal((await chooseStartForUser(BOB, { startMode: 'all', enabled: [] }, NOW)).kind, 'already-chosen');
  const bob = await selectionRow(BOB);
  assert.deepEqual([bob?.start_mode, bob?.route_state], [null, null], 'une ferme d’avant S6 n’a jamais de façon de commencer');
});

test('Réglages après le choix de départ : les cases changent, la façon de commencer reste, l’état de la carte aussi (S6-e)', async () => {
  await chooseStartForUser(ALICE, { startMode: 'proposals', enabled: [] }, NOW);
  database.sqlite.prepare("UPDATE irrigation_feature_selections SET route_state = 'later'").run();
  await saveFeatureSelectionForUser(ALICE, ['alertes-cultures'], new Date('2026-11-27T08:00:00.000Z'));
  const stored = await readFeatureSelectionForUser(ALICE);
  assert.deepEqual(stored.kind === 'stored' ? [stored.enabled, stored.startMode, stored.routeState] : null, [['alertes-cultures'], 'proposals', 'later']);
});

test('Alice et Bob : le choix de l’une n’apparaît pas chez l’autre', async () => {
  await chooseStartForUser(ALICE, { startMode: 'notes', enabled: [] }, NOW);
  assert.deepEqual(await readFeatureSelectionForUser(BOB), { kind: 'first-visit' }, 'Bob n’a jamais ouvert le module');
  assert.equal((await chooseStartForUser(BOB, { startMode: 'all', enabled: [] }, NOW)).kind, 'saved', 'Bob choisit à son tour');
  const alice = resolveFeatureSelection(await readFeatureSelectionForUser(ALICE));
  const bob = resolveFeatureSelection(await readFeatureSelectionForUser(BOB));
  assert.deepEqual([alice.startMode, alice.enabled], ['notes', ['arrosages', 'materiel', 'historique']]);
  assert.deepEqual([bob.startMode, bob.enabled], ['all', [...FEATURE_IDS]]);
  const count = database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_feature_selections').get() as { n: number };
  assert.equal(count.n, 2, 'une ligne par espace');
});

test('la base refuse une façon ou un état de carte inconnus', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const insert = (startMode: string | null, routeState: string | null) => database.sqlite.prepare(
    `INSERT INTO irrigation_feature_selections (workspace_id, enabled_features, known_features, updated_at, start_mode, route_state)
     VALUES (?, '["materiel"]', '[]', 'x', ?, ?)`,
  ).run(workspaceId, startMode, routeState);
  assert.throws(() => insert('tout', null), /CHECK constraint failed/);
  assert.throws(() => insert('notes', 'plus-tard'), /CHECK constraint failed/);
  insert('custom', 'done');
});

test('section 4 : la migration 0051 garde chaque ligne existante telle quelle, ses deux colonnes vides', () => {
  const sqlite = createMigratedSqliteDatabase('drizzle', '0050_quiet_hours_held_alerts.sql');
  try {
    sqlite.prepare("INSERT INTO irrigation_workspaces (id, owner_user_id, otf_farm_id) VALUES ('w-1', 'alice', NULL), ('w-2', 'bob', NULL)").run();
    sqlite.prepare(`INSERT INTO irrigation_feature_selections (workspace_id, enabled_features, known_features, chosen_at, banner_dismissed_at, updated_at)
      VALUES ('w-1', '["materiel"]', '["materiel"]', '2026-11-07T13:30:00.000Z', NULL, '2026-11-07T13:30:00.000Z'),
             ('w-2', '["alertes-meteo"]', '[]', NULL, '2026-11-08T07:00:00.000Z', '2026-11-08T07:00:00.000Z')`).run();
    const before = sqlite.prepare('SELECT * FROM irrigation_feature_selections ORDER BY workspace_id').all();
    applyMigrationsAfter(sqlite, '0050_quiet_hours_held_alerts.sql', 'drizzle', '0051_start_mode_route_state.sql');
    const after = sqlite.prepare('SELECT * FROM irrigation_feature_selections ORDER BY workspace_id').all() as Record<string, unknown>[];
    assert.deepEqual(after.map((row) => ({ ...row })), before.map((row) => ({ ...row, start_mode: null, route_state: null })));
  } finally {
    sqlite.close();
  }
});

test('section 4 : l’export de la base porte les deux colonnes, et la restauration les rend', async () => {
  await chooseStartForUser(ALICE, { startMode: 'proposals', enabled: [] }, NOW);
  database.sqlite.prepare("UPDATE irrigation_feature_selections SET route_state = 'done'").run();
  const name = 'irrigation_feature_selections';
  const columns = (database.sqlite.prepare(`PRAGMA table_info(${quoteIdentifier(name)})`).all() as { name: string }[]).map((column) => column.name);
  assert.ok(columns.includes('start_mode') && columns.includes('route_state'), columns.join(', '));
  const rows = database.sqlite.prepare(`SELECT * FROM ${quoteIdentifier(name)}`).all() as Record<string, string | number | null>[];
  const workspaces = database.sqlite.prepare('SELECT * FROM irrigation_workspaces').all() as Record<string, string | number | null>[];
  const workspaceColumns = (database.sqlite.prepare('PRAGMA table_info(irrigation_workspaces)').all() as { name: string }[]).map((column) => column.name);

  const copy = createMigratedSqliteDatabase();
  try {
    for (const statement of buildInsertStatements({ name: 'irrigation_workspaces', columns: workspaceColumns, rows: workspaces })) copy.exec(statement);
    for (const statement of buildInsertStatements({ name, columns, rows })) copy.exec(statement);
    overrideDatabase(createD1FromSqlite(copy));
    const restored = await readFeatureSelectionForUser(ALICE);
    assert.deepEqual(restored.kind === 'stored' ? [restored.startMode, restored.routeState] : null, ['proposals', 'done']);
  } finally {
    overrideDatabase(database.d1);
    copy.close();
  }
});

test('section 10 : la ferme vierge de la démonstration choisit, puis la remise à zéro la rend vierge, façon de commencer comprise', async () => {
  const savedDemoMode = process.env.DEMO_MODE;
  process.env.DEMO_MODE = 'true';
  try {
    const blank = demoOwnerUserId('invite-s6', resolveDemoChoice('vierge', undefined));
    assert.equal((await getFeatureSelectionForUser(blank)).firstVisit, true);
    assert.equal((await chooseStartForUser(blank, { startMode: 'notes', enabled: [] }, NOW)).kind, 'saved');
    assert.equal((await selectionRow(blank))?.start_mode, 'notes');
    await resetDemoSpace(blank, NOW);
    assert.equal(await selectionRow(blank), undefined);
    const fresh = resolveFeatureSelection(await readFeatureSelectionForUser(blank));
    assert.deepEqual([fresh.firstVisit, fresh.startMode, fresh.routeState], [true, null, null]);
    // Vierge de nouveau : elle peut choisir une autre façon.
    assert.equal((await chooseStartForUser(blank, { startMode: 'all', enabled: [] }, NOW)).kind, 'saved');
    assert.equal((await selectionRow(blank))?.start_mode, 'all');
  } finally {
    if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = savedDemoMode;
  }
});
