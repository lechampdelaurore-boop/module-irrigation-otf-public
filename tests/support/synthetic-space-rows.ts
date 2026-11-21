/**
 * Des lignes fabriquées dans **chaque** table d'un espace, pour les preuves
 * de l'effacement d'une ferme (4.5, PR 3 ; docs/tranche-4-contract.md, F563,
 * preuves 2 et 3 ; 10 bis.17, F648).
 *
 * Le test à deux fermes doit voir des lignes de chaque ferme dans chaque
 * table, y compris dans une table ajoutée plus tard : écrire ces lignes par
 * les dépôts suivrait le code d'aujourd'hui, et une table nouvelle resterait
 * vide, donc « effacée » sans preuve. Ici, la base migrée dit elle-même ses
 * tables, ses colonnes et ses clés étrangères ; chaque table d'espace reçoit
 * des lignes de chaque espace, les mères d'abord, chaque clé étrangère
 * désignant une ligne du même espace.
 *
 * Les contraintes `CHECK` sont suspendues le temps d'écrire (les valeurs sont
 * fabriquées, pas vraisemblables) ; les clés étrangères, l'unicité et les
 * déclencheurs restent actifs. L'effacement, lui, se joue ensuite avec toutes
 * les contraintes.
 */
import type { DatabaseSync } from 'node:sqlite';
import { quoteSqlIdentifier, tablesParentsFirst } from '../../scripts/backup/sqlite-dump.ts';
import { spaceExpression } from './space-coherence.ts';

const SYSTEM_TABLE = /^(?:sqlite_|_cf_|d1_migrations$|__drizzle)/;
/** L'espace lui-même, et la note de sa demande d'effacement, qui n'est pas une donnée de l'espace. */
const NOT_FILLED = new Set(['irrigation_workspaces', 'irrigation_farm_erasures']);

type ColumnInfo = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number };
type ForeignKey = { id: number; table: string; from: string; to: string };
type Row = Record<string, unknown>;

/** Les tables de données de la base migrée, par ordre de nom. */
export function dataTables(database: DatabaseSync): string[] {
  return (database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all() as { name: string }[])
    .map(({ name }) => name)
    .filter((name) => !SYSTEM_TABLE.test(name));
}

/** Les tables qui appartiennent à un espace, selon le contrôle de cohérence (F380), l'espace lui-même compris. */
export function spaceTables(database: DatabaseSync): string[] {
  return dataTables(database).filter((table) => spaceExpression(database, table, 'row') !== null);
}

/** Le nombre de lignes de l'espace dans une table ; 0 pour une table commune. */
export function spaceRowCount(database: DatabaseSync, table: string, workspaceId: string): number {
  const space = spaceExpression(database, table, 'row');
  if (space === null) return 0;
  return Number((database.prepare(`SELECT COUNT(*) AS n FROM ${quoteSqlIdentifier(table)} AS row WHERE ${space} = ?`).get(workspaceId) as { n: number }).n);
}

/**
 * Écrit `rowsPerSpace` lignes de chaque espace dans chaque table d'espace
 * (une seule quand la table n'en admet qu'une par espace). Rend le nombre de
 * lignes écrites par table.
 */
export function fillEverySpaceTable(database: DatabaseSync, workspaceIds: readonly string[], rowsPerSpace = 2): Map<string, number> {
  const written = new Map<string, number>();
  const tables = tablesParentsFirst(database, dataTables(database))
    .filter((table) => !NOT_FILLED.has(table) && spaceExpression(database, table, 'row') !== null);
  // Les lignes fabriquées, par table et par espace : une fille désigne la mère de même rang, du même espace.
  const made = new Map<string, Row[][]>();
  database.exec('PRAGMA ignore_check_constraints = ON');
  try {
    for (const table of tables) {
      const columns = database.prepare(`PRAGMA table_info(${quoteSqlIdentifier(table)})`).all() as ColumnInfo[];
      const keys = database.prepare(`PRAGMA foreign_key_list(${quoteSqlIdentifier(table)})`).all() as ForeignKey[];
      const perSpace: Row[][] = [];
      for (const [spaceIndex, workspaceId] of workspaceIds.entries()) {
        const rows: Row[] = [];
        for (let rank = 0; rank < rowsPerSpace; rank += 1) {
          const values = rowValues({ database, table, columns, keys, made, workspaceId, spaceIndex, rank });
          const names = Object.keys(values);
          try {
            database.prepare(`INSERT INTO ${quoteSqlIdentifier(table)} (${names.map(quoteSqlIdentifier).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
              .run(...(Object.values(values) as never[]));
          } catch (error) {
            // Une seule ligne par espace dans cette table (clé ou index unique sur l'espace) : une suffit.
            if (rank > 0 && error instanceof Error && /UNIQUE constraint failed/.test(error.message)) break;
            throw new Error(`Ligne fabriquée refusée dans ${table} : ${error instanceof Error ? error.message : String(error)}`, { cause: error });
          }
          rows.push({ ...(database.prepare(`SELECT * FROM ${quoteSqlIdentifier(table)} WHERE rowid = last_insert_rowid()`).get() as Row) });
        }
        perSpace.push(rows);
        written.set(table, (written.get(table) ?? 0) + rows.length);
      }
      made.set(table, perSpace);
    }
  } finally {
    database.exec('PRAGMA ignore_check_constraints = OFF');
  }
  return written;
}

type RowInput = {
  database: DatabaseSync;
  table: string;
  columns: readonly ColumnInfo[];
  keys: readonly ForeignKey[];
  made: ReadonlyMap<string, Row[][]>;
  workspaceId: string;
  spaceIndex: number;
  rank: number;
};

function rowValues({ database, table, columns, keys, made, workspaceId, spaceIndex, rank }: RowInput): Row {
  const values: Row = {};
  const integerKey = columns.filter((column) => column.pk > 0).length === 1 && columns.some((column) => column.pk > 0 && /INT/i.test(column.type));
  for (const column of columns) {
    if (column.name === 'workspace_id') {
      values[column.name] = workspaceId;
      continue;
    }
    const key = keys.find((candidate) => candidate.from === column.name && candidate.table !== table);
    if (key) {
      values[column.name] = parentValue(database, key, made, workspaceId, spaceIndex, rank);
      continue;
    }
    if (column.pk > 0 && integerKey) continue;
    if (column.pk === 0 && column.notnull === 0) continue;
    if (column.pk === 0 && column.dflt_value !== null) continue;
    values[column.name] = madeValue(column, table, spaceIndex, rank);
  }
  return values;
}

/** La valeur d'une clé étrangère : la mère de même rang, du même espace ; une ligne commune pour une table commune. */
function parentValue(database: DatabaseSync, key: ForeignKey, made: ReadonlyMap<string, Row[][]>, workspaceId: string, spaceIndex: number, rank: number): unknown {
  if (key.table === 'irrigation_workspaces') return workspaceId;
  const parents = made.get(key.table)?.[spaceIndex];
  if (parents && parents.length > 0) return parents[rank % parents.length][key.to];
  const common = database.prepare(`SELECT ${quoteSqlIdentifier(key.to)} AS value FROM ${quoteSqlIdentifier(key.table)} LIMIT 1`).get() as { value: unknown } | undefined;
  if (!common) throw new Error(`Aucune ligne à désigner dans ${key.table}`);
  return common.value;
}

let counter = 0;

function madeValue(column: ColumnInfo, table: string, spaceIndex: number, rank: number): unknown {
  counter += 1;
  if (/INT/i.test(column.type)) return 1_000_000 + counter;
  if (/REAL|FLOA|DOUB|NUM/i.test(column.type)) return counter + 0.5;
  return `fabrique-${table}-${column.name}-${spaceIndex}-${rank}-${counter}`;
}
