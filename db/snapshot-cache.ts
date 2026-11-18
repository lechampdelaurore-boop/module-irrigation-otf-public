import { db } from './binding';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import { isIrrigationSnapshot } from '@/lib/domain/snapshot-validation';

const createSnapshotTableSql = `
  CREATE TABLE IF NOT EXISTS otf_snapshots (
    cache_key TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    last_successful_read_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

let initialized = false;

async function ensureSnapshotTable() {
  if (initialized) return;
  await db.prepare(createSnapshotTableSql).run();
  initialized = true;
}

export async function readCachedSnapshot(
  cacheKey: string,
): Promise<IrrigationSnapshot | null> {
  await ensureSnapshotTable();
  const row = await db.prepare(
    `SELECT payload, last_successful_read_at
     FROM otf_snapshots
     WHERE cache_key = ?
     LIMIT 1`,
  )
    .bind(cacheKey)
    .first<{ payload: string; last_successful_read_at: string }>();

  return row ? parseCachedRow(row) : null;
}

function parseCachedRow(row: { payload: string; last_successful_read_at: string }): IrrigationSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(row.payload);
    if (!isIrrigationSnapshot(parsed)) return null;
    return {
      ...parsed,
      source: 'cache',
      lastSuccessfulReadAt: row.last_successful_read_at,
    };
  } catch {
    return null;
  }
}

/**
 * Le plus récent des instantanés gardés (4.1, docs/tranche-4-contract.md,
 * F331, F339) : parmi tous, ou parmi ceux dont la clé commence par `prefix`
 * ou vaut `exactKey`, comparées signe à signe. `null` si le plus récent est
 * illisible : rien n'est deviné.
 */
export async function readLatestCachedSnapshot(
  keys?: { prefix: string; exactKey: string },
): Promise<IrrigationSnapshot | null> {
  await ensureSnapshotTable();
  const statement = keys
    ? db.prepare(
        `SELECT payload, last_successful_read_at FROM otf_snapshots
         WHERE instr(cache_key, ?) = 1 OR cache_key = ?
         ORDER BY last_successful_read_at DESC LIMIT 1`,
      ).bind(keys.prefix, keys.exactKey)
    : db.prepare(
        `SELECT payload, last_successful_read_at FROM otf_snapshots
         ORDER BY last_successful_read_at DESC LIMIT 1`,
      );
  const row = await statement.first<{ payload: string; last_successful_read_at: string }>();
  return row ? parseCachedRow(row) : null;
}

export async function saveCachedSnapshot(
  cacheKey: string,
  snapshot: IrrigationSnapshot,
): Promise<void> {
  await ensureSnapshotTable();
  const updatedAt = new Date().toISOString();

  await db.prepare(
    `INSERT INTO otf_snapshots (
       cache_key, payload, last_successful_read_at, updated_at
     ) VALUES (?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       payload = excluded.payload,
       last_successful_read_at = excluded.last_successful_read_at,
       updated_at = excluded.updated_at`,
  )
    .bind(
      cacheKey,
      JSON.stringify(snapshot),
      snapshot.lastSuccessfulReadAt,
      updatedAt,
    )
    .run();
}
