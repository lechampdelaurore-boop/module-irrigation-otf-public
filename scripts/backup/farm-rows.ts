/**
 * Les lignes d'une seule ferme (4.5, PR 4 ; docs/tranche-4-contract.md, F561,
 * point 4, et 10 bis.15). Time Travel restaure toute la base, donc toutes les
 * fermes : pour l'erreur d'une seule, on lit ses lignes dans l'état d'avant,
 * on les compare à l'état présent, on réinsère celles qui manquent, et l'on
 * vérifie que les autres fermes n'ont pas bougé.
 *
 * L'espace d'une ligne est celui que lit le contrôle de cohérence des
 * espaces (F380) : sa colonne `workspace_id`, sinon celui de la ligne
 * qu'elle complète. Les tables communes ne sont d'aucune ferme.
 *
 * Les compteurs de révision de l'espace (`…_revision` de
 * `irrigation_workspaces`) avancent d'eux-mêmes, par les déclencheurs, à
 * chaque ligne effacée ou réinsérée : ils ne reviennent jamais en arrière
 * (un calcul fait sur l'état abîmé doit rester tenu pour périmé), et leurs
 * déclencheurs de garde refusent qu'on les réécrive.
 */
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { spaceExpression } from '../../tests/support/space-coherence.ts';
import { canonicalRow } from './export-inspection.ts';
import { insertStatement, quoteSqlIdentifier, sqlLiteral, tablesParentsFirst } from './sqlite-dump.ts';

const SYSTEM_TABLE = /^(?:sqlite_|_cf_|d1_migrations$|__drizzle)/;
const REVISION_COLUMN = /_revision$/;

type Row = Record<string, unknown>;
type ColumnFilter = (table: string, column: string) => boolean;

/** Les compteurs de révision de l'espace, que les déclencheurs font avancer. */
export const isRevisionCounter: ColumnFilter = (table, column) => table === 'irrigation_workspaces' && REVISION_COLUMN.test(column);

/** Un export rejoué en mémoire, clés étrangères contrôlées à part (comme `inspectExport`). */
export function replayedCopy(sql: string): DatabaseSync {
  const database = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  database.exec(sql);
  return database;
}

function dataTables(database: DatabaseSync): string[] {
  return (database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all() as { name: string }[])
    .map(({ name }) => name)
    .filter((name) => !SYSTEM_TABLE.test(name));
}

type ColumnInfo = { name: string; pk: number };

function columnInfo(database: DatabaseSync, table: string): ColumnInfo[] {
  return database.prepare(`PRAGMA table_info(${quoteSqlIdentifier(table)})`).all() as ColumnInfo[];
}

function columnsOf(database: DatabaseSync, table: string, ignore?: ColumnFilter): string[] {
  return columnInfo(database, table).map(({ name }) => name).filter((name) => !ignore?.(table, name)).sort();
}

/** La clé d'une ligne : sa clé primaire déclarée, sinon toute la ligne. */
function keyColumnsOf(database: DatabaseSync, table: string): string[] {
  const primary = columnInfo(database, table).filter(({ pk }) => pk > 0).sort((left, right) => left.pk - right.pk).map(({ name }) => name);
  return primary.length > 0 ? primary : columnsOf(database, table);
}

/** Les lignes de la ferme dans une table ; aucune pour une table commune. */
function farmRowsOf(database: DatabaseSync, table: string, workspaceId: string): Row[] {
  const space = spaceExpression(database, table, 'child');
  if (space === null) return [];
  return database.prepare(`SELECT child.* FROM ${quoteSqlIdentifier(table)} AS child WHERE ${space} = ?`).all(workspaceId) as Row[];
}

type FarmTable = { name: string; rows: number; digest: string };
export type FarmSummary = { rows: number; digest: string; tables: FarmTable[] };

/**
 * Le nombre de lignes de la ferme et leur empreinte, table par table et en
 * tout, indépendantes de l'ordre ; les colonnes écartées ne comptent pas.
 */
export function farmSummary(database: DatabaseSync, workspaceId: string, ignore?: ColumnFilter): FarmSummary {
  const whole = createHash('sha256');
  const tables: FarmTable[] = [];
  for (const table of dataTables(database)) {
    const columns = columnsOf(database, table, ignore);
    const lines = farmRowsOf(database, table, workspaceId).map((row) => canonicalRow(columns, row)).sort();
    const digest = createHash('sha256').update(`${table}\n${JSON.stringify(columns)}\n${lines.join('\n')}\n`).digest('hex');
    whole.update(`${table} ${lines.length} ${digest}\n`);
    tables.push({ name: table, rows: lines.length, digest });
  }
  return { rows: tables.reduce((sum, table) => sum + table.rows, 0), digest: whole.digest('hex'), tables };
}

/** Les compteurs de révision de l'espace de la ferme, par nom. */
export function revisionCounters(database: DatabaseSync, workspaceId: string): Record<string, number> {
  const row = database.prepare('SELECT * FROM irrigation_workspaces WHERE id = ?').get(workspaceId) as Row | undefined;
  if (!row) return {};
  return Object.fromEntries(Object.entries(row).filter(([column]) => isRevisionCounter('irrigation_workspaces', column)).map(([column, value]) => [column, Number(value)]));
}

/** Les tables qui dépendent d'une table, elle comprise, par leurs clés étrangères déclarées, parents d'abord. */
function dependentTables(database: DatabaseSync, root: string): string[] {
  const tables = dataTables(database);
  const found = new Set([root]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const table of tables) {
      if (found.has(table)) continue;
      const keys = database.prepare(`PRAGMA foreign_key_list(${quoteSqlIdentifier(table)})`).all() as { table: string }[];
      if (keys.some((key) => found.has(key.table))) {
        found.add(table);
        grew = true;
      }
    }
  }
  return tablesParentsFirst(database, [...found]);
}

/** Le dégât de l'essai : les lignes de la ferme dans une table et dans celles qui en dépendent, les dépendantes d'abord. */
export function farmDamageStatements(database: DatabaseSync, root: string, workspaceId: string): string[] {
  return dependentTables(database, root).reverse().flatMap((table) => {
    const space = spaceExpression(database, table, 'child');
    if (space === null) return [];
    const quoted = quoteSqlIdentifier(table);
    return [`DELETE FROM ${quoted} WHERE rowid IN (SELECT child.rowid FROM ${quoted} AS child WHERE ${space} = ${sqlLiteral(workspaceId)});`];
  });
}

type ChangedRows = { table: string; rows: number; columns: string[] };

export type FarmRecovery = {
  /** Les instructions à jouer sur la base, parents d'abord ; vide s'il ne manque rien. */
  statements: string[];
  /** Les lignes réinsérées, en tout et par table. */
  inserted: number;
  insertedByTable: { table: string; rows: number }[];
  /** Les lignes présentes des deux côtés mais différentes : laissées telles quelles, dites par table et par colonne. */
  changed: ChangedRows[];
};

/**
 * Les lignes de la ferme présentes dans l'état d'avant et absentes de l'état
 * présent (par leur clé primaire), à réinsérer, parents d'abord. Une ligne
 * encore présente n'est jamais réécrite : si elle a changé depuis, elle est
 * signalée (table, nombre, colonnes), pas remplacée. Les lignes d'une autre
 * ferme ne sont jamais lues.
 */
export function missingFarmRowStatements(before: DatabaseSync, present: DatabaseSync, workspaceId: string): FarmRecovery {
  const statements: string[] = [];
  const insertedByTable: { table: string; rows: number }[] = [];
  const changed: ChangedRows[] = [];
  for (const table of tablesParentsFirst(before, dataTables(before))) {
    const keyColumns = keyColumnsOf(before, table);
    const columns = columnsOf(before, table);
    const presentRows = new Map(farmRowsOf(present, table, workspaceId).map((row) => [canonicalRow(keyColumns, row), row]));
    let inserted = 0;
    let changedRows = 0;
    const changedColumns = new Set<string>();
    for (const row of farmRowsOf(before, table, workspaceId)) {
      const current = presentRows.get(canonicalRow(keyColumns, row));
      if (current === undefined) {
        statements.push(insertStatement(table, row));
        inserted += 1;
        continue;
      }
      const differing = columns.filter((column) => canonicalRow([column], row) !== canonicalRow([column], current));
      if (differing.length > 0) {
        changedRows += 1;
        for (const column of differing) changedColumns.add(column);
      }
    }
    if (inserted > 0) insertedByTable.push({ table, rows: inserted });
    if (changedRows > 0) changed.push({ table, rows: changedRows, columns: [...changedColumns].sort() });
  }
  const inserted = insertedByTable.reduce((sum, entry) => sum + entry.rows, 0);
  return { statements: inserted > 0 ? ['PRAGMA defer_foreign_keys=TRUE;', ...statements] : [], inserted, insertedByTable, changed };
}
