import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test, { after } from 'node:test';
import {
  ExportDecryptionError,
  MINIMUM_PASSPHRASE_LENGTH,
  decryptExport,
  encryptExport,
  samePassphrase,
} from '../scripts/backup/export-crypto.ts';
import { assertOutsideRepository, exportFileName, inspectionLines, repositoryRoot } from '../scripts/backup/export-files.ts';
import {
  compareSummaries,
  differenceWords,
  inspectExport,
  migratedReference,
  summarizeDatabase,
} from '../scripts/backup/export-inspection.ts';
import { askHidden, askNewPassphrase, typedText } from '../scripts/backup/passphrase-prompt.ts';
import { ExportCaptureError, captureWranglerExport, maskedWranglerLine, wranglerExportArguments } from '../scripts/backup/wrangler-export.ts';
import { dumpDatabase, dumpStatements, quoteSqlIdentifier, recordD1Migrations, sqlLiteral } from '../scripts/backup/sqlite-dump.ts';

/**
 * L'export hebdomadaire chiffré (4.5, PR 4 ; docs/tranche-4-contract.md,
 * F561, 10 bis.9, et 10 bis.14, F620 à F624) : le chiffrement refuse un
 * mot de passe faux et un octet changé ; le contrôle d'un export trouve
 * chaque sabotage (table retirée, ligne corrompue, migration oubliée, ligne
 * orpheline) sans jamais citer une valeur ; l'export de Wrangler arrive en
 * mémoire, jamais en clair sur le disque, et son adresse de téléchargement
 * ne s'affiche pas.
 */

const PASSPHRASE = 'phrase de passe des essais';
/** Un réglage de scrypt léger pour les essais ; le réglage par défaut est essayé une fois. */
const LIGHT = { N: 2 ** 10, r: 8, p: 1 };
const CANARY = 'Ferme des Hirondelles canari';
const MIGRATIONS = readdirSync('drizzle').filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
const OUTCOMES_MIGRATION = MIGRATIONS.find((name) => /otf_call_outcomes/.test(name))!;

const scratch = mkdtempSync(path.join(tmpdir(), 'essai-export-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

// ─── Le chiffrement ──────────────────────────────────────────────────────────

test('le fichier chiffré rend l’export à l’octet près, avec le bon mot de passe seulement', () => {
  const plain = Buffer.from(`INSERT INTO "t" VALUES('${CANARY}');\n`, 'utf8');
  const sealed = encryptExport(plain, PASSPHRASE, LIGHT);
  assert.deepEqual(decryptExport(sealed, PASSPHRASE), plain);
  assert.ok(!sealed.includes(Buffer.from('Hirondelles')), 'rien du contenu ne se lit dans le fichier');
  const header = sealed.subarray(0, sealed.indexOf(0x0a)).toString('utf8');
  assert.deepEqual(Object.keys(JSON.parse(header)).sort(), ['format', 'iv', 'kdf', 'salt', 'scrypt', 'version'], 'l’en-tête ne dit que le format et les réglages');
  assert.notDeepEqual(encryptExport(plain, PASSPHRASE, LIGHT), sealed, 'un sel et un vecteur neufs à chaque export');
  assert.throws(() => decryptExport(sealed, 'un autre mot de passe'), ExportDecryptionError);
});

test('le réglage par défaut de scrypt chiffre et déchiffre (mémoire permise comprise)', () => {
  const plain = Buffer.from('PRAGMA defer_foreign_keys=TRUE;\n', 'utf8');
  assert.deepEqual(decryptExport(encryptExport(plain, PASSPHRASE), PASSPHRASE), plain);
});

test('un octet changé, dans le contenu, l’étiquette ou l’en-tête, et le fichier est refusé', () => {
  const sealed = encryptExport(Buffer.from('contenu à protéger'), PASSPHRASE, LIGHT);
  const newline = sealed.indexOf(0x0a);
  for (const [where, offset] of [['contenu', newline + 2], ['étiquette', sealed.length - 1]] as const) {
    const damaged = Buffer.from(sealed);
    damaged[offset] ^= 0x01;
    assert.throws(() => decryptExport(damaged, PASSPHRASE), ExportDecryptionError, where);
  }
  // Un en-tête encore valide, mais réécrit : il est authentifié avec le contenu.
  const header = JSON.parse(sealed.subarray(0, newline).toString('utf8'));
  const rewritten = Buffer.concat([Buffer.from(`${JSON.stringify({ ...header, scrypt: { ...header.scrypt, p: 2 } })}\n`), sealed.subarray(newline + 1)]);
  assert.throws(() => decryptExport(rewritten, PASSPHRASE), /ne se déchiffre pas/);
  assert.throws(() => decryptExport(sealed.subarray(0, newline + 5), PASSPHRASE), /tronqué/);
  assert.throws(() => decryptExport(Buffer.from('PRAGMA defer_foreign_keys=TRUE;'), PASSPHRASE), /pas un export chiffré/);
});

test('un en-tête qui demanderait des milliards d’octets à scrypt, ou d’un format inconnu, est refusé avant tout calcul', () => {
  const sealed = encryptExport(Buffer.from('x'), PASSPHRASE, LIGHT);
  const newline = sealed.indexOf(0x0a);
  const header = JSON.parse(sealed.subarray(0, newline).toString('utf8'));
  const withHeader = (changed: object) => Buffer.concat([Buffer.from(`${JSON.stringify({ ...header, ...changed })}\n`), sealed.subarray(newline + 1)]);
  const started = Date.now();
  assert.throws(() => decryptExport(withHeader({ scrypt: { N: 2 ** 30, r: 8, p: 1 } }), PASSPHRASE), /format est inconnu/);
  assert.ok(Date.now() - started < 1000, 'refusé sans calcul');
  assert.throws(() => decryptExport(withHeader({ version: 2 }), PASSPHRASE), /Format d’export 2 inconnu/);
  assert.throws(() => decryptExport(withHeader({ format: 'autre' }), PASSPHRASE), /pas un export chiffré/);
});

test('le mot de passe : 12 caractères au moins, comptés en lettres ; la même phrase tapée autrement est la même', () => {
  assert.equal(MINIMUM_PASSPHRASE_LENGTH, 12);
  assert.throws(() => encryptExport(Buffer.from('x'), 'trop court', LIGHT), /au moins 12 caractères/);
  assert.throws(() => encryptExport(Buffer.from('x'), 'éééééééééé', LIGHT), /au moins 12/, 'dix lettres accentuées font dix caractères');
  const composed = 'phrase été 2026';
  const decomposed = composed.normalize('NFD');
  assert.notEqual(composed, decomposed);
  assert.ok(samePassphrase(composed, decomposed));
  assert.ok(!samePassphrase(composed, `${composed}!`));
  assert.deepEqual(decryptExport(encryptExport(Buffer.from('x'), composed, LIGHT), decomposed), Buffer.from('x'), 'la même phrase, venue d’un autre clavier');
});

// ─── La saisie ───────────────────────────────────────────────────────────────

test('la saisie : l’effacement, les flèches et les touches de contrôle ne passent pas dans le mot de passe', () => {
  assert.deepEqual(typedText('abc\u007fd\r'), { text: 'abd', submitted: true, interrupted: false });
  assert.deepEqual(typedText('ab\bc\u001b[Dd\n'), { text: 'acd', submitted: true, interrupted: false });
  assert.deepEqual(typedText('été\u001b[3~ !\r'), { text: 'été !', submitted: true, interrupted: false });
  assert.deepEqual(typedText('abc\u0003'), { text: '', submitted: false, interrupted: true });
  assert.deepEqual(typedText('abc'), { text: 'abc', submitted: false, interrupted: false });
});

test('la saisie est refusée hors d’un terminal, et un mot de passe neuf se tape deux fois à l’identique', async () => {
  const notATerminal = { isTTY: false } as unknown as NodeJS.ReadStream;
  await assert.rejects(askHidden('?', notATerminal, { write: () => true }), /au clavier, dans un terminal/);
  const answers = (...typed: string[]) => async () => typed.shift() ?? '';
  assert.equal(await askNewPassphrase(answers(PASSPHRASE, PASSPHRASE)), PASSPHRASE);
  await assert.rejects(askNewPassphrase(answers(PASSPHRASE, `${PASSPHRASE}.`)), /deux saisies diffèrent/);
  await assert.rejects(askNewPassphrase(answers('court', 'court')), /au moins 12/);
});

// ─── Le contrôle d'un export ─────────────────────────────────────────────────

/** Une base où les migrations nommées ont été appliquées, et la liste que garde D1. */
function sourceDatabase({ applied = MIGRATIONS, listed = applied }: { applied?: readonly string[]; listed?: readonly string[] } = {}): DatabaseSync {
  const database = migratedReference('drizzle', applied);
  recordD1Migrations(database, listed, '2026-11-20 20:30:00');
  return database;
}

/** L'export sans une table : ni sa création, ni ses lignes, ni ses index, ni son compteur (ni la table des compteurs, s'il était le seul). */
function withoutTable(database: DatabaseSync, table: string): string {
  const statements = dumpStatements(database)
    .filter((statement) => !statement.includes(`\`${table}\``) && !statement.includes(`"${table}"`) && !statement.includes(`'${table}'`));
  const counters = statements.some((statement) => statement.startsWith('INSERT INTO "sqlite_sequence"'));
  return statements.filter((statement) => counters || statement !== 'DELETE FROM sqlite_sequence;').join('\n');
}

const source = sourceDatabase();
const goodDump = dumpDatabase(source);
const sourceSummary = summarizeDatabase(source);

test('un export fidèle : rejoué dans une base vide, il ne montre aucun problème et rend la même empreinte que la base d’origine', () => {
  const inspection = inspectExport(goodDump);
  assert.deepEqual(inspection.problems, []);
  assert.deepEqual(inspection.migrations, { applied: MIGRATIONS, missingFromExport: [], unknownToRepository: [] });
  assert.ok(inspection.totalRows > 0, 'les références livrées par les migrations comptent');
  assert.ok(!inspection.tables.some(({ name }) => name === 'd1_migrations' || name.startsWith('sqlite_')), 'les tables de données seulement');
  assert.deepEqual(inspection.tables, sourceSummary.tables, 'table par table, mêmes lignes et même empreinte');
  assert.equal(inspection.digest, sourceSummary.digest);
  assert.deepEqual(compareSummaries(sourceSummary.tables, inspection.tables), []);
});

test('l’empreinte d’une table ne dépend pas de l’ordre de ses lignes, mais de chaque valeur', () => {
  const make = (rows: readonly [string, number][]) => {
    const database = new DatabaseSync(':memory:');
    database.exec('CREATE TABLE t (a TEXT, b INTEGER)');
    for (const [a, b] of rows) database.prepare('INSERT INTO t VALUES (?, ?)').run(a, b);
    return summarizeDatabase(database).tables[0];
  };
  assert.equal(make([['x', 1], ['y', 2]]).digest, make([['y', 2], ['x', 1]]).digest);
  assert.notEqual(make([['x', 1], ['y', 2]]).digest, make([['x', 1], ['y', 3]]).digest);
  assert.notEqual(make([['x', 1]]).digest, make([['x', 1], ['x', 1]]).digest, 'une ligne en double compte');
});

test('sabotage : une table retirée de l’export est trouvée, par son nom', () => {
  const inspection = inspectExport(withoutTable(source, 'otf_call_outcomes'));
  assert.ok(inspection.problems.includes('Schéma : table otf_call_outcomes absente de l’export.'), inspection.problems.join('\n'));
  assert.deepEqual(compareSummaries(sourceSummary.tables, inspection.tables).map(differenceWords), ['otf_call_outcomes : table absente']);
});

test('sabotage : une ligne corrompue est trouvée, par sa contrainte ou par l’empreinte de sa table, sans que sa valeur soit citée', () => {
  const refused = inspectExport(`${goodDump}\nINSERT INTO "otf_call_outcomes" ("pace_key","hour_start_ms","outcome","calls") VALUES('${CANARY}',0,'${CANARY}',1);`);
  assert.equal(refused.problems.length, 1);
  assert.match(refused.problems[0], /^L’export ne se rejoue pas jusqu’au bout : contrainte CHECK/);
  assert.ok(!refused.problems[0].includes('canari'), 'la contrainte, jamais la valeur');

  const changed = sourceDatabase();
  const table = sourceSummary.tables.find(({ rows }) => rows > 1)!.name;
  const column = (changed.prepare(`PRAGMA table_info(${quoteSqlIdentifier(table)})`).all() as { name: string; type: string }[]).find(({ type }) => type.toUpperCase() === 'TEXT')!.name;
  changed.exec(`UPDATE ${quoteSqlIdentifier(table)} SET ${quoteSqlIdentifier(column)} = ${sqlLiteral(CANARY)} WHERE rowid = (SELECT MIN(rowid) FROM ${quoteSqlIdentifier(table)})`);
  const corrupted = inspectExport(dumpDatabase(changed));
  assert.deepEqual(corrupted.problems, [], 'une valeur changée reste un export lisible…');
  const differences = compareSummaries(sourceSummary.tables, corrupted.tables).map(differenceWords);
  assert.deepEqual(differences, [`${table} : même nombre de lignes (${sourceSummary.tables.find(({ name }) => name === table)!.rows}), contenu différent`], '… mais son empreinte la trahit');
  assert.ok(!differences.join().includes('canari'));

  changed.exec(`DELETE FROM ${quoteSqlIdentifier(table)} WHERE rowid = (SELECT MIN(rowid) FROM ${quoteSqlIdentifier(table)})`);
  const rows = sourceSummary.tables.find(({ name }) => name === table)!.rows;
  assert.deepEqual(compareSummaries(sourceSummary.tables, inspectExport(dumpDatabase(changed)).tables).map(differenceWords), [
    `${table} : ${rows} lignes attendues, ${rows - 1} trouvée${rows - 1 > 1 ? 's' : ''}`,
  ]);
});

test('sabotage : une migration oubliée se voit, que la base dise l’avoir reçue ou non', () => {
  const forgotten = inspectExport(dumpDatabase(sourceDatabase({ applied: MIGRATIONS.filter((name) => name !== OUTCOMES_MIGRATION), listed: MIGRATIONS })));
  assert.ok(forgotten.problems.includes('Schéma : table otf_call_outcomes absente de l’export.'), forgotten.problems.join('\n'));
  assert.ok(forgotten.problems.includes('Schéma : table otf_farm_reads : colonne last_complete_at absente de l’export.'));

  const unlisted = inspectExport(dumpDatabase(sourceDatabase({ listed: MIGRATIONS.filter((name) => name !== OUTCOMES_MIGRATION) })));
  assert.ok(unlisted.problems.includes('Schéma : table otf_call_outcomes inconnue des migrations.'), unlisted.problems.join('\n'));
  assert.deepEqual(unlisted.migrations.missingFromExport, [OUTCOMES_MIGRATION]);

  const behind = inspectExport(dumpDatabase(sourceDatabase({ applied: MIGRATIONS.slice(0, -1) })));
  assert.deepEqual(behind.problems, [], 'une base qui n’a pas encore reçu la dernière migration du dépôt reste bien sauvegardée');
  assert.deepEqual(behind.migrations.missingFromExport, MIGRATIONS.slice(-1));
});

test('un export venu d’une base plus récente que le dépôt, ou sans la liste de ses migrations, est signalé', () => {
  const ahead = inspectExport(dumpDatabase(sourceDatabase({ listed: [...MIGRATIONS, '9999_venue_du_futur.sql'] })));
  assert.deepEqual(ahead.migrations.unknownToRepository, ['9999_venue_du_futur.sql']);
  assert.ok(ahead.problems.some((problem) => problem.includes('mettez le dépôt à jour')));

  const withoutList = inspectExport(withoutTable(source, 'd1_migrations'));
  assert.ok(withoutList.problems.includes('L’export n’a pas la liste des migrations reçues par la base (d1_migrations).'));
});

test('sabotage : une ligne qui désigne une ligne absente est comptée, par table', () => {
  const orphan = `INSERT INTO "irrigation_garden_group_members" ("group_id","otf_zone_id","otf_plot_id","position") VALUES('${CANARY}','z','p',1);`;
  const inspection = inspectExport(`${goodDump}\n${orphan}`);
  assert.deepEqual(inspection.problems, ['irrigation_garden_group_members : 1 ligne désigne une ligne absente.']);
});

test('un export coupé en route ne se rejoue pas, et le dit sans citer la ligne coupée', () => {
  const cut = goodDump.slice(0, goodDump.indexOf('INSERT INTO', goodDump.length / 2) + 40);
  const inspection = inspectExport(cut);
  assert.equal(inspection.problems.length, 1);
  assert.match(inspection.problems[0], /^L’export ne se rejoue pas jusqu’au bout : /);
  assert.equal(inspection.tables.length, 0);
});

test('ce que disent les commandes : des nombres, des noms de migrations et une empreinte, jamais une valeur', () => {
  const changed = sourceDatabase();
  changed.exec(`INSERT INTO otf_call_outcomes (pace_key, hour_start_ms, outcome, calls) VALUES (${sqlLiteral(CANARY)}, 0, 'ok', 1)`);
  const lines = inspectionLines(inspectExport(dumpDatabase(changed)));
  assert.match(lines[0], /^\d+ tables, [\d  ]+ lignes ; \d+ migrations reçues, la dernière : \d{4}_.+\.sql\.$/);
  assert.match(lines[1], /^Empreinte de la base : [0-9a-f]{16}$/);
  assert.ok(!lines.join('\n').includes('canari'));
  const problems = inspectionLines(inspectExport(withoutTable(source, 'otf_call_outcomes')));
  assert.ok(problems.includes('PROBLÈME : Schéma : table otf_call_outcomes absente de l’export.'));
});

// ─── L'export de Wrangler, en mémoire ────────────────────────────────────────

/** Un faux Wrangler : il affiche une adresse de téléchargement, puis écrit l'export dans le fichier de `--output`, comme le vrai. */
function fakeWrangler(name: string, body: string): string {
  const file = path.join(scratch, `${name}.mjs`);
  writeFileSync(file, `import fsPromises from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
const output = process.argv.find((argument) => argument.startsWith('--output=')).slice('--output='.length);
console.log('You can also download your export from the following URL manually: https://export.example/d1?signature=canari-signe');
console.error('arguments ' + process.argv.slice(2).filter((argument) => !argument.startsWith('--output=')).join(' '));
${body}
`);
  return file;
}

const SQL = `PRAGMA defer_foreign_keys=TRUE;\nINSERT INTO "t" VALUES('${CANARY}');\n`;

test('l’export de Wrangler arrive en mémoire : rien n’est écrit sur le disque, et l’adresse de téléchargement ne s’affiche pas', async () => {
  const lines: string[] = [];
  const captured = await captureWranglerExport({ database: 'base-essai', location: 'remote' }, {
    cli: fakeWrangler('chaine', `await fsPromises.writeFile(output, ${JSON.stringify(SQL)});`),
    relay: (line) => lines.push(line),
  });
  assert.equal(captured.sql.toString('utf8'), SQL);
  assert.match(captured.sha256, /^[0-9a-f]{64}$/);
  assert.ok(lines.some((line) => line.includes('(adresse masquée)')));
  assert.ok(!lines.join('\n').includes('canari-signe') && !lines.join('\n').includes('https://'), 'l’adresse qui ouvre l’export ne s’affiche jamais');
  assert.ok(lines.includes('arguments d1 export base-essai --remote --skip-confirmation'), lines.join('\n'));
  assert.ok(!readdirSync(tmpdir()).some((name) => name.startsWith('module-irrigation-export-sans-dossier-')), 'le dossier convenu n’existe jamais');
});

test('un export en flux, de plusieurs morceaux, arrive entier', async () => {
  const captured = await captureWranglerExport({ database: 'base-essai', location: 'local' }, {
    cli: fakeWrangler('flux', `const parts = Array.from({ length: 6 }, (_, index) => new TextEncoder().encode(String(index).repeat(400 * 1024)));
await fsPromises.writeFile(output, new ReadableStream({ start(controller) { for (const part of parts) controller.enqueue(part); controller.close(); } }));`),
  });
  assert.equal(captured.sql.length, 6 * 400 * 1024);
  assert.equal(captured.sql.subarray(5 * 400 * 1024, 5 * 400 * 1024 + 3).toString(), '555');
});

test('si Wrangler change sa façon d’écrire, l’export n’est pas capté et rien n’est écrit en clair : l’erreur le dit', async () => {
  await assert.rejects(captureWranglerExport({ database: 'base-essai', location: 'remote' }, {
    cli: fakeWrangler('autre-ecriture', `try { writeFileSync(output, ${JSON.stringify(SQL)}); } catch { console.error('écriture impossible'); }`),
  }), (error: unknown) => error instanceof ExportCaptureError && /sans remettre d’export/.test(error.message));
  assert.ok(!readdirSync(tmpdir()).some((name) => name.startsWith('module-irrigation-export-sans-dossier-')));
  await assert.rejects(captureWranglerExport({ database: 'base-essai', location: 'remote' }, {
    cli: fakeWrangler('echec', `process.exitCode = 1;`),
  }), /s’est arrêté en erreur \(code 1\)/);
});

test('les arguments de Wrangler, et le masque des adresses', () => {
  assert.deepEqual(wranglerExportArguments({ database: 'module-irrigation-otf', location: 'remote' }, '/x/export.sql'), [
    'd1', 'export', 'module-irrigation-otf', '--remote', '--output=/x/export.sql', '--skip-confirmation',
  ]);
  assert.deepEqual(wranglerExportArguments({ database: 'b', location: 'local', config: 'wrangler.essai.jsonc' }, 'o').slice(3), ['--local', '--output=o', '--skip-confirmation', '--config=wrangler.essai.jsonc']);
  assert.equal(maskedWranglerLine('URL : https://a.example/b?c=d, valable une heure'), 'URL : (adresse masquée) valable une heure');
  assert.equal(
    maskedWranglerLine('Executing on remote database essai (4f0c7f3e-1a2b-4c3d-8e9f-0123456789ab), account 0123456789abcdef0123456789ABCDEF'),
    'Executing on remote database essai ((identifiant masqué)), account (identifiant masqué)',
    'les identifiants du compte et des bases ne passent pas dans les journaux publics du flux',
  );
  assert.equal(
    maskedWranglerLine('  internal error; reference = e_xSb5mO_0c3d6226eaff4afeb9c1bcbd5e44a2de [code: 7500]'),
    '  internal error; reference = (référence masquée) [code: 7500]',
    'la référence d’une requête, comme Cloudflare la donne avec une erreur (20 novembre 2026)',
  );
  assert.equal(maskedWranglerLine('base_0123456789abcdef0123456789abcdef'), 'base_(identifiant masqué)', 'un identifiant collé à un autre mot');
});

// ─── Où va le fichier ────────────────────────────────────────────────────────

test('le fichier chiffré ne va jamais dans le dépôt, même par un lien, et porte la date et l’heure de Paris', () => {
  const root = repositoryRoot();
  assert.ok(existsSync(path.join(root, 'package.json')), 'la racine du dépôt est trouvée');
  for (const inside of [root, path.join(root, 'work', 'exports'), path.join(root, 'drizzle')]) {
    assert.throws(() => assertOutsideRepository(inside, root), /jamais dans le dossier du dépôt/, inside);
  }
  assertOutsideRepository(path.join(scratch, 'sauvegardes'), root);
  const link = path.join(scratch, 'lien-vers-le-depot');
  symlinkSync(root, link);
  assert.throws(() => assertOutsideRepository(path.join(link, 'exports'), root), /jamais dans le dossier du dépôt/, 'un lien vers le dépôt');
  mkdirSync(path.join(scratch, 'a'));
  assertOutsideRepository(path.join(scratch, 'a', '..', 'b'), root);

  assert.equal(exportFileName(new Date('2026-11-20T20:30:00.000Z')), 'module-irrigation-export-2026-11-20-21h30.chiffre');
  assert.equal(exportFileName(new Date('2026-07-01T05:05:00.000Z')), 'module-irrigation-export-2026-07-01-07h05.chiffre', 'à l’heure d’été');
});
