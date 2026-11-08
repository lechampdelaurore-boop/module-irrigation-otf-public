/**
 * Import d'un export complet de la base du module dans une base D1 Cloudflare.
 *
 *   node --experimental-strip-types scripts/import-d1-export.ts \
 *     --file chemin/vers/export.d1-export.json [--remote] \
 *     [--database module-irrigation-otf] [--dry-run] \
 *     [--owner-from-existing | --new-owner <identifiant>] [--previous-owner <identifiant>]
 *
 * Étapes : lecture et validation du fichier, calcul de l'ordre d'import à
 * partir des clés étrangères du schéma (migrations rejouées en mémoire),
 * génération du SQL (vidage, insertions par lots, remappage du propriétaire),
 * exécution par Wrangler, puis comparaison des comptages par table entre le
 * fichier et la base cible. Tout écart fait échouer le script.
 *
 * `--owner-from-existing` lit la base cible avant l'import : elle doit contenir
 * exactement un espace de travail, créé par la première connexion du porteur
 * sur le nouvel hébergement ; son propriétaire devient le nouvel identifiant.
 * Le propriétaire précédent vient du fichier (`exportedBy`) ou de
 * `--previous-owner`. Sans option de propriétaire, aucune identité n'est
 * modifiée.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  OWNER_COLUMN,
  OWNER_TABLE,
  buildCountQuery,
  buildImportPlan,
  compareCounts,
  countsFromRow,
  isExportableTable,
  quoteIdentifier,
  validateExport,
  type ForeignKeyEdge,
} from '../lib/services/d1-export-import.ts';

type Options = {
  file: string;
  database: string;
  remote: boolean;
  dryRun: boolean;
  verifyOnly: boolean;
  ownerFromExisting: boolean;
  newOwner: string | null;
  previousOwner: string | null;
};

function parseOptions(argv: readonly string[]): Options {
  const options: Options = {
    file: '', database: 'module-irrigation-otf', remote: false, dryRun: false, verifyOnly: false,
    ownerFromExisting: false, newOwner: null, previousOwner: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`Valeur manquante après ${argument}`);
      index += 1;
      return value;
    };
    if (argument === '--file') options.file = next();
    else if (argument === '--database') options.database = next();
    else if (argument === '--remote') options.remote = true;
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--verify-only') options.verifyOnly = true;
    else if (argument === '--owner-from-existing') options.ownerFromExisting = true;
    else if (argument === '--new-owner') options.newOwner = next();
    else if (argument === '--previous-owner') options.previousOwner = next();
    else throw new Error(`Option inconnue : ${argument}`);
  }
  if (!options.file) throw new Error('--file est obligatoire.');
  if (options.ownerFromExisting && options.newOwner) throw new Error('--owner-from-existing et --new-owner sont exclusifs.');
  return options;
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function schemaFromMigrations(): { tables: string[]; edges: ForeignKeyEdge[] } {
  const database = new DatabaseSync(':memory:');
  const migrationsDir = path.join(root, 'drizzle');
  for (const migration of readdirSync(migrationsDir).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) {
    database.exec(readFileSync(path.join(migrationsDir, migration), 'utf8').replaceAll('--> statement-breakpoint', ''));
  }
  const tables = (database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all() as { name: string }[])
    .map((row) => row.name)
    .filter(isExportableTable);
  const edges = tables.flatMap((name) =>
    (database.prepare(`PRAGMA foreign_key_list(${quoteIdentifier(name)})`).all() as { table: string }[])
      .map((row) => ({ from: name, to: row.table })),
  );
  return { tables, edges };
}

function runWrangler(args: string[]): string {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), ...args],
    { cwd: root, encoding: 'utf8', env: { ...process.env, CI: '1' }, maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`Wrangler a échoué (${result.status ?? 'signal'}) : ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function queryJson<T>(options: Options, sql: string): T[] {
  const output = runWrangler(['d1', 'execute', options.database, options.remote ? '--remote' : '--local', '--json', '--command', sql]);
  const start = output.indexOf('[');
  const parsed = JSON.parse(output.slice(start)) as Array<{ results: T[] }>;
  return parsed.flatMap((entry) => entry.results);
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  const raw = JSON.parse(readFileSync(path.resolve(options.file), 'utf8')) as { exportedBy?: string };
  const data = validateExport(raw);
  const schema = schemaFromMigrations();

  if (options.verifyOnly) {
    const plan = buildImportPlan({ data, edges: schema.edges, schemaTables: schema.tables });
    verifyCounts(options, plan.orderedTables, plan.expectedCounts);
    return;
  }

  let ownerRemap: { previousOwner: string; newOwner: string } | null = null;
  const previousOwner = options.previousOwner ?? raw.exportedBy ?? null;
  if (options.newOwner || options.ownerFromExisting) {
    if (!previousOwner) throw new Error('Propriétaire précédent inconnu : fournissez --previous-owner.');
    let newOwner = options.newOwner;
    if (options.ownerFromExisting) {
      const existing = queryJson<{ id: string; owner_user_id: string }>(
        options,
        `SELECT id, ${OWNER_COLUMN} FROM ${OWNER_TABLE} ORDER BY created_at`,
      );
      if (existing.length !== 1) {
        throw new Error(`La base cible doit contenir exactement un espace de travail, trouvé ${existing.length}.`);
      }
      newOwner = existing[0].owner_user_id;
    }
    ownerRemap = { previousOwner, newOwner: newOwner! };
  }

  const plan = buildImportPlan({ data, edges: schema.edges, schemaTables: schema.tables, ownerRemap });
  const totalRows = Object.values(plan.expectedCounts).reduce((sum, count) => sum + count, 0);
  const outDir = path.join(root, '.wrangler', 'tmp');
  mkdirSync(outDir, { recursive: true });
  const sqlPath = path.join(outDir, `import-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
  writeFileSync(sqlPath, plan.statements.join('\n\n') + '\n', 'utf8');

  console.log(`Export du ${data.exportedAt} depuis ${data.source} : ${data.tables.length} tables, ${totalRows} lignes.`);
  console.log(`Ordre d'import : ${plan.orderedTables.join(' → ')}`);
  console.log(`SQL généré (${plan.statements.length} instructions) : ${sqlPath}`);
  if (ownerRemap) console.log(`Remappage du propriétaire : ${ownerRemap.previousOwner} → ${ownerRemap.newOwner}`);
  if (options.dryRun) {
    console.log('Mode --dry-run : rien n’a été exécuté.');
    return;
  }

  runWrangler(['d1', 'execute', options.database, options.remote ? '--remote' : '--local', '--file', sqlPath]);
  verifyCounts(options, plan.orderedTables, plan.expectedCounts);
}

function verifyCounts(options: Options, tables: readonly string[], expected: Record<string, number>) {
  const [row] = queryJson<Record<string, unknown>>(options, buildCountQuery(tables));
  const actual = countsFromRow(row ?? {});
  const differences = compareCounts(expected, actual);
  if (differences.length > 0) {
    for (const difference of differences) {
      console.error(`ÉCART ${difference.table} : attendu ${difference.expected}, trouvé ${difference.actual}`);
    }
    process.exit(1);
  }
  const totalRows = Object.values(expected).reduce((sum, count) => sum + count, 0);
  console.log(`Comptages identiques sur ${tables.length} tables (${totalRows} lignes).`);
}

main();
