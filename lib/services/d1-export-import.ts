/**
 * Export et import complets d'une base D1 du module, table par table.
 *
 * Module pur : aucune dépendance à Cloudflare ni à Node. La route d'export et
 * le script d'import lui fournissent les lignes et les clés étrangères ; il
 * produit le format d'échange, l'ordre d'import et le SQL, tous testables.
 *
 * Utilisé par la sous-tranche Q0, phase 2 : exporter la base de l'ancien
 * hébergement, l'importer dans la base D1 du compte Cloudflare, vérifier que
 * les comptages par table sont identiques, remapper l'identité du
 * propriétaire. Aucune ligne n'est transformée : identifiants et dates sont
 * conservés tels quels.
 */

export const D1_EXPORT_FORMAT = 'module-irrigation-otf/d1-export';
export const D1_EXPORT_VERSION = 1;

type D1Scalar = string | number | null;

export type D1TableExport = {
  name: string;
  columns: string[];
  rows: Record<string, D1Scalar>[];
};

export type D1Export = {
  format: typeof D1_EXPORT_FORMAT;
  version: typeof D1_EXPORT_VERSION;
  exportedAt: string;
  source: string;
  tables: D1TableExport[];
};

export type ForeignKeyEdge = { from: string; to: string };

/**
 * Tables techniques jamais exportées ni importées : internes SQLite, tables
 * Cloudflare, journal de migrations de Wrangler, et tables des plateformes
 * d'hébergement dont le nom commence par un double soulignement, comme
 * `__appgarden_migrations` créée par OpenAI Sites.
 */
export function isExportableTable(name: string): boolean {
  return !name.startsWith('sqlite_') && !name.startsWith('_cf_') && !name.startsWith('__') && name !== 'd1_migrations';
}

export function quoteIdentifier(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Identifiant SQL inattendu : ${JSON.stringify(name)}`);
  }
  return `"${name}"`;
}

export function quoteLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Nombre non fini impossible à importer : ${String(value)}`);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  throw new Error(`Type de valeur non pris en charge : ${typeof value}`);
}

export function validateExport(input: unknown): D1Export {
  const candidate = input as Partial<D1Export> | null;
  if (!candidate || candidate.format !== D1_EXPORT_FORMAT) {
    throw new Error('Fichier d’export inconnu : format absent ou différent.');
  }
  if (candidate.version !== D1_EXPORT_VERSION) {
    throw new Error(`Version d’export ${String(candidate.version)} non prise en charge.`);
  }
  if (!Array.isArray(candidate.tables)) throw new Error('Fichier d’export sans tables.');
  for (const table of candidate.tables) {
    if (typeof table.name !== 'string' || !Array.isArray(table.columns) || !Array.isArray(table.rows)) {
      throw new Error('Table d’export mal formée.');
    }
    quoteIdentifier(table.name);
    table.columns.forEach(quoteIdentifier);
  }
  return candidate as D1Export;
}

/**
 * Ordre d'import : une table n'est insérée qu'après toutes celles qu'elle
 * référence. Les tables sans dépendance gardent l'ordre alphabétique pour une
 * sortie stable. Un cycle est refusé explicitement.
 */
export function orderTablesForImport(tables: readonly string[], edges: readonly ForeignKeyEdge[]): string[] {
  const names = [...new Set(tables)].sort();
  const known = new Set(names);
  const dependencies = new Map<string, Set<string>>(names.map((name) => [name, new Set<string>()]));
  for (const edge of edges) {
    if (edge.from === edge.to || !known.has(edge.from) || !known.has(edge.to)) continue;
    dependencies.get(edge.from)!.add(edge.to);
  }
  const ordered: string[] = [];
  const done = new Set<string>();
  let remaining = names;
  while (remaining.length > 0) {
    const ready = remaining.filter((name) => [...dependencies.get(name)!].every((parent) => done.has(parent)));
    if (ready.length === 0) {
      throw new Error(`Dépendances circulaires entre tables : ${remaining.join(', ')}`);
    }
    for (const name of ready) {
      ordered.push(name);
      done.add(name);
    }
    remaining = remaining.filter((name) => !done.has(name));
  }
  return ordered;
}

/** D1 refuse toute instruction SQL de plus de 100 000 octets. */
const D1_MAX_STATEMENT_BYTES = 100_000;

export type InsertBatching = { maxRows?: number; maxBytes?: number };

/**
 * Regroupe les lignes par lots bornés en nombre et en taille : une table de
 * cache dont chaque ligne pèse plusieurs dizaines de kilo-octets tient ainsi
 * sous la limite de D1. Une ligne qui dépasse à elle seule la limite est
 * refusée explicitement plutôt qu'envoyée pour échouer.
 */
export function buildInsertStatements(table: D1TableExport, batching: InsertBatching = {}): string[] {
  if (table.rows.length === 0) return [];
  const maxRows = batching.maxRows ?? 50;
  const maxBytes = batching.maxBytes ?? 64_000;
  const prefix = `INSERT INTO ${quoteIdentifier(table.name)} (${table.columns.map(quoteIdentifier).join(', ')}) VALUES\n  `;
  const encoder = new TextEncoder();
  const statements: string[] = [];
  let batch: string[] = [];
  let batchBytes = encoder.encode(prefix).length;
  const flush = () => {
    if (batch.length > 0) statements.push(`${prefix}${batch.join(',\n  ')};`);
    batch = [];
    batchBytes = encoder.encode(prefix).length;
  };
  for (const row of table.rows) {
    const tuple = `(${table.columns.map((column) => quoteLiteral(row[column])).join(', ')})`;
    const tupleBytes = encoder.encode(tuple).length + 4;
    if (encoder.encode(prefix).length + tupleBytes > D1_MAX_STATEMENT_BYTES) {
      throw new Error(`Ligne de ${table.name} trop volumineuse pour une instruction D1 (${tupleBytes} octets).`);
    }
    if (batch.length > 0 && (batch.length >= maxRows || batchBytes + tupleBytes > maxBytes)) flush();
    batch.push(tuple);
    batchBytes += tupleBytes;
  }
  flush();
  return statements;
}

function buildDeleteStatements(orderedTables: readonly string[]): string[] {
  return [...orderedTables].reverse().map((name) => `DELETE FROM ${quoteIdentifier(name)};`);
}

/**
 * Une seule ligne dont chaque colonne porte le nombre de lignes d'une table.
 * Des sous-requêtes scalaires plutôt qu'un `UNION ALL` : D1 limite le nombre
 * de termes d'un SELECT composé.
 */
export function buildCountQuery(tables: readonly string[]): string {
  if (tables.length === 0) throw new Error('Aucune table à compter.');
  return `SELECT ${tables
    .map((name) => `(SELECT count(*) FROM ${quoteIdentifier(name)}) AS ${quoteIdentifier(name)}`)
    .join(',\n  ')}`;
}

export function countsFromRow(row: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(Object.entries(row).map(([name, value]) => [name, Number(value)]));
}

export const OWNER_TABLE = 'irrigation_workspaces';
export const OWNER_COLUMN = 'owner_user_id';

export function buildOwnerRemapStatement(previousOwner: string, newOwner: string): string {
  if (!previousOwner.trim() || !newOwner.trim()) throw new Error('Identifiants de propriétaire vides.');
  return `UPDATE ${quoteIdentifier(OWNER_TABLE)} SET ${quoteIdentifier(OWNER_COLUMN)} = ${quoteLiteral(newOwner)} WHERE ${quoteIdentifier(OWNER_COLUMN)} = ${quoteLiteral(previousOwner)};`;
}

export type ImportPlan = {
  orderedTables: string[];
  statements: string[];
  expectedCounts: Record<string, number>;
};

/**
 * Plan complet : vidage des tables cibles dans l'ordre inverse, insertion
 * dans l'ordre des dépendances, remappage facultatif du propriétaire. Les
 * clés étrangères sont différées pendant le lot par sécurité.
 */
export function buildImportPlan(input: {
  data: D1Export;
  edges: readonly ForeignKeyEdge[];
  schemaTables: readonly string[];
  ownerRemap?: { previousOwner: string; newOwner: string } | null;
}): ImportPlan {
  const exported = new Map(input.data.tables.filter((table) => isExportableTable(table.name)).map((table) => [table.name, table]));
  const unknown = [...exported.keys()].filter((name) => !input.schemaTables.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Tables absentes du schéma cible : ${unknown.join(', ')}`);
  }
  const orderedTables = orderTablesForImport(input.schemaTables.filter(isExportableTable), input.edges);
  const statements = ['PRAGMA defer_foreign_keys = true;', ...buildDeleteStatements(orderedTables)];
  const expectedCounts: Record<string, number> = {};
  for (const name of orderedTables) {
    const table = exported.get(name);
    expectedCounts[name] = table?.rows.length ?? 0;
    if (table) statements.push(...buildInsertStatements(table));
  }
  if (input.ownerRemap) {
    statements.push(buildOwnerRemapStatement(input.ownerRemap.previousOwner, input.ownerRemap.newOwner));
  }
  return { orderedTables, statements, expectedCounts };
}

export function compareCounts(
  expected: Record<string, number>,
  actual: Record<string, number>,
): Array<{ table: string; expected: number; actual: number }> {
  const names = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  return [...names]
    .sort()
    .filter((name) => (expected[name] ?? 0) !== (actual[name] ?? 0))
    .map((name) => ({ table: name, expected: expected[name] ?? 0, actual: actual[name] ?? 0 }));
}
