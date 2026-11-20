/**
 * Reconstruire une base D1 depuis un export (4.5, PR 4 ;
 * docs/tranche-4-contract.md, F561, scénario S2, et 10 bis.15). Le même geste
 * sert à l'essai (S2, sur la base d'essai) et à la vraie restauration
 * (`pnpm backup:restore`, base perdue).
 *
 * 1. L'export est contrôlé (F621) : un export qui ne restaurerait pas
 *    fidèlement est refusé, rien n'est écrit.
 * 2. La base visée doit être **vide** (aucune table du module) : elle est
 *    créée si elle n'existe pas ; une base qui a des tables est refusée,
 *    jamais écrasée. C'est le garde-fou de la vraie restauration : aucune base
 *    en service ne peut être remplacée par ce geste.
 * 3. L'export est rejoué en mémoire, puis envoyé **rangé pour l'import**
 *    (`restorableStatements`) : toutes les tables, puis les lignes, chaque
 *    table après celles qu'elle désigne, puis index et déclencheurs. L'export
 *    porte son schéma et sa liste de migrations : aucune migration n'est
 *    appliquée avant ; les plus récentes s'appliquent après, à l'ordinaire.
 * 4. La base reconstruite est exportée à son tour et comparée à l'export de
 *    départ, table par table.
 */
import type { D1Operations } from './d1-operations.ts';
import { compareSummaries, differenceWords, inspectExport, summarizeDatabase, type ExportInspection } from './export-inspection.ts';
import { replayedCopy } from './farm-rows.ts';
import { restorableDump } from './sqlite-dump.ts';

const D1_INTERNAL_TABLE = /^(?:_cf_|sqlite_)/;

/** Un nom de base D1 lisible : lettres minuscules, chiffres et tirets. */
export function assertRestoreTarget(database: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(database)) {
    throw new Error(`Nom de base refusé : « ${database} ». Lettres minuscules, chiffres et tirets seulement.`);
  }
}

export type ImportOperations = Pick<D1Operations, 'exists' | 'create' | 'tableNames' | 'executeSql' | 'exportSql'>;

export type ImportOutcome = {
  ok: boolean;
  /** Ce qui s'est passé, en lignes sans donnée. */
  lines: string[];
  /** L'export de la base reconstruite, quand elle l'a été. */
  rebuilt: { sql: string; durationMs: number; inspection: ExportInspection } | null;
};

export async function importIntoEmptyBase(
  operations: ImportOperations,
  database: string,
  exportSql: string,
  { migrationsDir = 'drizzle', progress = () => {} }: { migrationsDir?: string; progress?: (line: string) => void } = {},
): Promise<ImportOutcome> {
  const lines: string[] = [];
  const refuse = (line: string): ImportOutcome => ({ ok: false, lines: [...lines, line], rebuilt: null });

  progress('Contrôle de l’export…');
  const inspection = inspectExport(exportSql, migrationsDir);
  if (inspection.problems.length > 0) return refuse(`L’export ne restaurerait pas la base fidèlement : rien n’est écrit. ${inspection.problems.join(' ')}`);

  if (await operations.exists(database)) {
    const tables = (await operations.tableNames(database)).filter((name) => !D1_INTERNAL_TABLE.test(name));
    if (tables.length > 0) return refuse(`La base « ${database} » n’est pas vide (${tables.length} table${tables.length > 1 ? 's' : ''}) : rien n’est écrit. La restauration ne se fait que dans une base neuve.`);
    lines.push(`Base « ${database} » trouvée, vide.`);
  } else {
    progress(`Création de la base ${database}…`);
    await operations.create(database);
    lines.push(`Base « ${database} » créée.`);
  }

  const copy = replayedCopy(exportSql);
  let expected: ReturnType<typeof summarizeDatabase>;
  let sql: string;
  try {
    expected = summarizeDatabase(copy);
    sql = restorableDump(copy);
  } finally {
    copy.close();
  }
  progress('Import…');
  await operations.executeSql(database, sql);
  progress('Export de la base reconstruite, pour la comparer…');
  const rebuilt = await operations.exportSql(database);
  const rebuiltInspection = inspectExport(rebuilt.sql, migrationsDir);
  const differences = compareSummaries(expected.tables, rebuiltInspection.tables);
  const faithful = rebuiltInspection.problems.length === 0 && differences.length === 0;
  lines.push(faithful
    ? `Base reconstruite : identique à l’export, table par table (${expected.tables.length} tables, ${expected.totalRows} lignes ; empreinte ${expected.digest.slice(0, 16)}).`
    : `Base reconstruite : PROBLÈME — ${[...rebuiltInspection.problems, ...differences.map(differenceWords)].join(' ; ')}.`);
  return { ok: faithful, lines, rebuilt: { ...rebuilt, inspection: rebuiltInspection } };
}
