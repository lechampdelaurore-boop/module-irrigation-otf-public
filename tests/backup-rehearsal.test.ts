/**
 * L'essai de restauration (4.5, PR 4 ; docs/tranche-4-contract.md, F561, et
 * 10 bis.15), joué contre la fausse D1 en mémoire : il va jusqu'au bout et
 * détruit ses bases ; chaque sabotage le fait échouer (F561, point 3) ; ses
 * gestes ne touchent qu'à la base d'essai ; la reconstruction ne s'écrit que
 * dans une base vide ; le rattrapage d'une ferme ne lit jamais l'autre.
 */
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { assertRehearsalDatabase, REHEARSAL_DATABASE, wranglerD1Operations } from '../scripts/backup/d1-operations.ts';
import { summarizeDatabase } from '../scripts/backup/export-inspection.ts';
import { farmDamageStatements, farmSummary, isRevisionCounter, missingFarmRowStatements, replayedCopy, revisionCounters } from '../scripts/backup/farm-rows.ts';
import { memoryD1Operations, type MemorySabotage } from '../scripts/backup/memory-d1.ts';
import { isolationChecks, vaultChecks } from '../scripts/backup/rehearsal-checks.ts';
import { buildRehearsalSource, newVaultKey, secretsFoundIn } from '../scripts/backup/rehearsal-data.ts';
import { RECONSTRUCTED_DATABASE, runRehearsal } from '../scripts/backup/rehearsal.ts';
import { assertRestoreTarget, importIntoEmptyBase } from '../scripts/backup/restore-import.ts';
import { dumpDatabase, restorableDump } from '../scripts/backup/sqlite-dump.ts';
import { wranglerFailureReason } from '../scripts/backup/wrangler-export.ts';

function simulation(sabotage: MemorySabotage = {}) {
  let moment = Date.parse('2026-11-20T20:30:00.000Z');
  const clock = () => (moment += 1000);
  const operations = memoryD1Operations({ sabotage, clock });
  return { operations, run: () => runRehearsal({ operations, where: 'Essai du dépôt', now: () => new Date(clock()), pause: async () => {} }) };
}

const source = await buildRehearsalSource();
const [farmA, farmB] = source.farms;

// ─── L'essai entier ──────────────────────────────────────────────────────────

test('la simulation joue S1, S2 et S3 jusqu’au bout, sans un échec, et détruit ses bases', async () => {
  const { operations, run } = simulation();
  const report = await run();
  assert.equal(report.failures, 0, report.markdown);
  assert.ok(report.ok);
  assert.ok(!report.markdown.includes('✗'), report.markdown);
  for (const title of ['### Préparation', '### S1 · ', '### S2 · ', '### S3 · ', '### Secrets', '### Fin', '### Comparaisons table par table']) {
    assert.ok(report.markdown.includes(title), title);
  }
  assert.match(report.markdown, /\*\*Résultat : réussi\.\*\*/);
  assert.match(report.markdown, /\| irrigation_events \| 5 \| 2 ≠ \| 5 \| 2 ≠ \| 5 \| 5 \|/, 'le dégât, la restauration, le retour, le rattrapage et la reconstruction se lisent dans le tableau');
  assert.match(report.markdown, /Rattrapage de la ferme A, lu dans l’état restauré T2 : 15 lignes à réinsérer/);
  assert.match(report.markdown, /✓ Ferme B : inchangée, empreinte identique avant et après le rattrapage/);
  assert.match(report.markdown, /L’export brut, tel que Cloudflare le rend, ne s’importe pas tel quel dans une base vide \(no such table: main\.\w+\)/,
    'la fausse D1 refuse, comme D1, une table désignée avant d’être créée : d’où l’import rangé');
  assert.deepEqual(operations.names(), [], 'aucune base ne reste');
  assert.equal(operations.received(REHEARSAL_DATABASE).length, 3, 'les données fictives, le dégât, le rattrapage');
  assert.equal(operations.received(RECONSTRUCTED_DATABASE).length, 1, 'l’export rangé pour l’import, une fois');
  assert.ok(!/essai-(?:acces|renouvellement)-/.test(report.markdown), 'aucun jeton fictif dans le compte rendu');
});

test('une restauration qui ne restaure pas fait échouer l’essai', async () => {
  const report = await simulation({ restoreDoesNothing: true }).run();
  assert.ok(!report.ok);
  assert.match(report.markdown, /✗ Restauration au signet noté : identique à T0, table par table \(\d+ tables\)\. — NON : irrigation_bed_applications : 10 lignes attendues, 4 trouvées/);
  assert.match(report.markdown, /\*\*Résultat : PROBLÈME\*\*/);
});

test('un export qui oublie une table arrête l’essai, et les bases sont détruites quand même', async () => {
  const { operations, run } = simulation({ exportDropsTable: 'irrigation_bed_applications' });
  const report = await run();
  assert.ok(!report.ok);
  assert.match(report.markdown, /✗ Export T0 : PROBLÈME — .*irrigation_bed_applications/);
  assert.match(report.markdown, /✗ L’essai s’est arrêté/);
  assert.match(report.markdown, /✓ Bases d’essai détruites : aucune n’existe plus\./);
  assert.deepEqual(operations.names(), []);
});

test('un import qui perd une ligne en route fait échouer la reconstruction (S2)', async () => {
  const { operations, run } = simulation({ importLosesLastRowIn: RECONSTRUCTED_DATABASE });
  const report = await run();
  assert.ok(!report.ok);
  assert.match(report.markdown, /✗ (?:Base reconstruite : identique à l’export T4.*NON|L’essai s’est arrêté)/);
  assert.deepEqual(operations.names(), []);
});

test('une base restée d’un essai interrompu est détruite avant de commencer', async () => {
  const { operations, run } = simulation();
  await operations.create(RECONSTRUCTED_DATABASE);
  const report = await run();
  assert.ok(report.ok, report.markdown);
  assert.match(report.markdown, /Une base restée d’un essai interrompu \(module-irrigation-otf-essai-restauration-reconstruite\) a été détruite d’abord\./);
});

// ─── Les garde-fous ──────────────────────────────────────────────────────────

test('les gestes de l’essai refusent toute base qui n’est pas une base d’essai, avant d’appeler Wrangler', async () => {
  for (const name of ['module-irrigation-otf', 'module-irrigation-otf-demo', 'module-irrigation-otf-essai-restauratio', `x-${REHEARSAL_DATABASE}`]) {
    assert.throws(() => assertRehearsalDatabase(name), /est refusée/, name);
  }
  assertRehearsalDatabase(REHEARSAL_DATABASE);
  assertRehearsalDatabase(RECONSTRUCTED_DATABASE);
  const lines: string[] = [];
  const wrangler = wranglerD1Operations({ cwd: process.cwd(), relay: (line) => lines.push(line) });
  for (const gesture of [() => wrangler.destroy('module-irrigation-otf'), () => wrangler.restore('module-irrigation-otf', 'x'), () => wrangler.executeSql('module-irrigation-otf-demo', 'SELECT 1')]) {
    await assert.rejects(gesture(), /est refusée/);
  }
  assert.deepEqual(lines, [], 'Wrangler n’a pas été lancé');
  await assert.rejects(memoryD1Operations().create('module-irrigation-otf'), /est refusée/);
});

test('la reconstruction ne s’écrit que dans une base vide, et refuse un export infidèle', async () => {
  const operations = memoryD1Operations();
  const target = `${REHEARSAL_DATABASE}-cible`;
  await operations.create(target);
  await operations.executeSql(target, 'CREATE TABLE en_service (x TEXT);');
  const busy = await importIntoEmptyBase(operations, target, source.sql);
  assert.ok(!busy.ok);
  assert.match(busy.lines.join(' '), /n’est pas vide \(1 table\) : rien n’est écrit/);
  assert.equal(operations.received(target).length, 1, 'rien d’autre n’a été envoyé');

  const withoutMigrations = source.sql.split('\n').filter((statement) => !statement.includes('d1_migrations')).join('\n');
  const unfaithful = await importIntoEmptyBase(operations, `${REHEARSAL_DATABASE}-neuve`, withoutMigrations);
  assert.ok(!unfaithful.ok);
  assert.match(unfaithful.lines.join(' '), /ne restaurerait pas la base fidèlement : rien n’est écrit/);
  assert.ok(!operations.names().includes(`${REHEARSAL_DATABASE}-neuve`), 'aucune base créée pour un export refusé');

  const fresh = await importIntoEmptyBase(operations, `${REHEARSAL_DATABASE}-neuve`, source.sql);
  assert.ok(fresh.ok, fresh.lines.join('\n'));
  assert.match(fresh.lines.join(' '), /créée.*identique à l’export, table par table/);
});

test('la restauration réelle n’accepte qu’un nom de base lisible', () => {
  assertRestoreTarget('module-irrigation-otf-2');
  for (const name of ['', 'Module', '../base', 'base neuve', '-base']) assert.throws(() => assertRestoreTarget(name), /Nom de base refusé/, name);
});

test('la raison d’un échec de Wrangler se dit par un nom, jamais par une valeur', () => {
  assert.equal(wranglerFailureReason('{"error":{"text":"no such table: main.irrigation_equipment_settings: SQLITE_ERROR"}}'), 'no such table: main.irrigation_equipment_settings');
  assert.equal(wranglerFailureReason("UNIQUE constraint failed: irrigation_events.id ('valeur')"), 'UNIQUE constraint failed: irrigation_events.id');
  assert.equal(wranglerFailureReason('Authentication error [code: 10000]'), null);
});

// ─── Les lignes d'une seule ferme ────────────────────────────────────────────

test('le rattrapage d’une ferme ne réinsère que ses lignes, ne lit jamais l’autre ferme, et ne réécrit rien', () => {
  const before = replayedCopy(source.sql);
  const present = replayedCopy(source.sql);
  try {
    for (const farm of [farmA, farmB]) present.exec(farmDamageStatements(present, 'irrigation_events', farm.workspaceId).join('\n'));
    const damagedB = farmSummary(present, farmB.workspaceId).digest;
    const countersBefore = revisionCounters(present, farmA.workspaceId);
    const recovery = missingFarmRowStatements(before, present, farmA.workspaceId);
    assert.equal(recovery.inserted, farmSummary(before, farmA.workspaceId).rows - farmSummary(present, farmA.workspaceId).rows);
    assert.deepEqual(recovery.changed, [{ table: 'irrigation_workspaces', rows: 1, columns: ['feasibility_revision'] }]);
    assert.ok(!recovery.statements.some((statement) => statement.includes(farmB.workspaceId)), 'aucune ligne de la ferme B');
    present.exec(recovery.statements.join('\n'));
    assert.equal(farmSummary(present, farmA.workspaceId, isRevisionCounter).digest, farmSummary(before, farmA.workspaceId, isRevisionCounter).digest);
    assert.equal(farmSummary(present, farmB.workspaceId).digest, damagedB, 'la ferme B reste telle qu’elle est');
    assert.ok(revisionCounters(present, farmA.workspaceId).feasibility_revision > countersBefore.feasibility_revision, 'le compteur avance, jamais en arrière');
    assert.deepEqual(missingFarmRowStatements(before, present, farmA.workspaceId).statements, [], 'rejoué, il n’a plus rien à faire');
  } finally {
    before.close();
    present.close();
  }
});

test('le dégât de l’essai efface les lignes dépendantes d’abord, celles de la seule ferme visée', () => {
  const copy = replayedCopy(source.sql);
  try {
    const statements = farmDamageStatements(copy, 'irrigation_events', farmA.workspaceId);
    const position = (table: string) => statements.findIndex((statement) => statement.startsWith(`DELETE FROM "${table}"`));
    assert.ok(position('irrigation_bed_applications') >= 0 && position('irrigation_bed_applications') < position('irrigation_event_equipment'));
    assert.ok(statements.at(-1)?.startsWith('DELETE FROM "irrigation_events"'));
    copy.exec(statements.join('\n'));
    assert.equal((copy.prepare('SELECT COUNT(*) AS n FROM irrigation_events WHERE workspace_id = ?').get(farmA.workspaceId) as { n: number }).n, 0);
    assert.equal((copy.prepare('SELECT COUNT(*) AS n FROM irrigation_events WHERE workspace_id = ?').get(farmB.workspaceId) as { n: number }).n, farmB.events);
    assert.deepEqual(copy.prepare('PRAGMA foreign_key_check').all(), [], 'aucune ligne orpheline');
  } finally {
    copy.close();
  }
});

// ─── L'export de D1 et l'import rangé ────────────────────────────────────────

test('l’export imité de D1 et l’import rangé rendent la même base, valeurs délicates comprises', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE parent (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE child (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id TEXT NOT NULL REFERENCES parent(id), note TEXT, data BLOB, amount REAL);
    CREATE TABLE "parent_new" (id TEXT PRIMARY KEY NOT NULL, label TEXT);
    INSERT INTO parent_new (id, label) VALUES ('p1', 'a''b');
    DROP TABLE parent;
    ALTER TABLE parent_new RENAME TO parent;
    CREATE INDEX idx_child_parent ON child (parent_id);
    CREATE TRIGGER child_note AFTER INSERT ON child BEGIN UPDATE parent SET label = 'déclenché' WHERE id = NEW.parent_id; END;
  `);
  database.prepare('INSERT INTO child (parent_id, note, data, amount) VALUES (?, ?, ?, ?)').run('p1', "ligne 1\nligne 2\r\nfin 'citée'", new Uint8Array([0, 255, 16]), 1e308 * 10);
  database.prepare("UPDATE parent SET label = 'a''b'").run();
  const original = summarizeDatabase(database);

  const exported = dumpDatabase(database);
  assert.ok(exported.split('\n').every((line) => !line.startsWith('INSERT') || line.endsWith(');')), 'une ligne de données par ligne de texte');
  assert.match(exported, /CREATE TABLE IF NOT EXISTS "parent"/, 'la table refaite vient après celle qui la désigne, comme chez D1');
  assert.ok(exported.indexOf('CREATE TABLE child') < exported.indexOf('CREATE TABLE IF NOT EXISTS "parent"'));

  const withKeys = () => {
    const target = new DatabaseSync(':memory:');
    target.exec('PRAGMA foreign_keys = ON');
    return target;
  };
  const raw = withKeys();
  assert.throws(() => { raw.exec('BEGIN'); raw.exec(exported); }, /no such table: main\.parent/, 'brut, l’export ne s’importe pas là où les clés étrangères sont actives');
  raw.close();

  const replayed = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  replayed.exec(exported);
  assert.deepEqual(summarizeDatabase(replayed), original, 'rejoué sans clés étrangères, l’export rend la base');
  const imported = withKeys();
  imported.exec('BEGIN');
  imported.exec(restorableDump(replayed));
  imported.exec('COMMIT');
  assert.deepEqual(summarizeDatabase(imported), original, 'rangé pour l’import, il entre avec les clés étrangères actives, sans déclencher');
  assert.equal((imported.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'child'").get() as { seq: number }).seq, 1, 'les compteurs suivent');
  for (const handle of [database, replayed, imported]) handle.close();
});

// ─── Le coffre et l'isolation, sabotés ───────────────────────────────────────

test('le contrôle du coffre échoue avec une autre clé que la bonne, et ne laisse rien passer au journal', async () => {
  const copy = replayedCopy(source.sql);
  try {
    const good = await vaultChecks(copy, source);
    assert.ok(good.every((check) => check.ok), good.map((check) => check.text).join('\n'));
    const wrong = await vaultChecks(copy, { ...source, vaultKey: newVaultKey() });
    assert.ok(!wrong[0].ok, 'avec une autre clé, les jetons ne se lisent pas');
  } finally {
    copy.close();
  }
  assert.equal(secretsFoundIn(`texte ${source.secrets[1]} fin`, source.secrets), 1);
  assert.equal(secretsFoundIn('rien', source.secrets), 0);
});

test('le contrôle d’isolation voit une irrigation de la ferme A qui désigne le matériel de la ferme B', async () => {
  const copy = replayedCopy(source.sql);
  try {
    const clean = await isolationChecks(copy, source.farms);
    assert.ok(clean.every((check) => check.ok), clean.map((check) => check.text).join('\n'));
    const equipmentB = (copy.prepare('SELECT id FROM irrigation_equipment WHERE workspace_id = ?').get(farmB.workspaceId) as { id: string }).id;
    copy.prepare(`UPDATE irrigation_event_equipment SET equipment_id = ?
      WHERE event_id IN (SELECT id FROM irrigation_events WHERE workspace_id = ?)`).run(equipmentB, farmA.workspaceId);
    const crossed = await isolationChecks(copy, source.farms);
    assert.ok(!crossed[0].ok);
    assert.match(crossed[0].text, /Cohérence des espaces \(F380\) : \d+ lignes? désignen?t? une ligne d’une autre ferme\./);
  } finally {
    copy.close();
  }
});
