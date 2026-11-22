import { db } from './binding';
import { FARM_TABLES, SPACE_ROOT_TABLE, SPACE_TABLES, spaceRowsCondition, type FarmTableRule } from './farm-erasure-plan';
import { findWorkspaceIdForUser } from './workspace-repository';
import { spaceKeyOfRow } from './workspace-scope';
import { farmErasureDueAt, type FarmErasureCounts, type FarmErasureState } from '@/lib/domain/operations/farm-erasure';
import type { OperatorErasureRequest } from '@/lib/domain/operations/farm-erasure-request';
import { legacySnapshotKey, seasonSnapshotPrefix } from '@/lib/domain/otf/snapshot-keys';

/**
 * Les demandes d'effacement d'un espace et leur exécution, en SQL (4.5, PR 3 ;
 * docs/tranche-4-contract.md, F563, et 10 bis.17, F640 à F645). Le service
 * `lib/services/farm-erasure.ts` enchaîne les lots et tient la borne d'un
 * passage ; ce dépôt ne fait que ce qu'on lui demande, une instruction à la fois.
 */

export type OpenFarmErasure = {
  id: string;
  state: Extract<FarmErasureState, 'pending' | 'erasing'>;
  requestedAt: string;
  eraseAfter: string;
};

type OpenRow = { id: string; state: OpenFarmErasure['state']; requested_at: string; erase_after: string };

const OPEN_STATES = `('pending', 'erasing')`;

/** La demande ouverte (en attente ou en cours) de l'espace, ou `null`. */
export async function readOpenFarmErasure(spaceKey: string): Promise<OpenFarmErasure | null> {
  const workspaceId = await findWorkspaceIdForUser(spaceKey);
  if (workspaceId === null) return null;
  return readOpenFarmErasureOfWorkspace(workspaceId);
}

async function readOpenFarmErasureOfWorkspace(workspaceId: string): Promise<OpenFarmErasure | null> {
  const row = await db.prepare(
    `SELECT id, state, requested_at, erase_after FROM irrigation_farm_erasures
     WHERE workspace_id = ? AND state IN ${OPEN_STATES}`,
  ).bind(workspaceId).first<OpenRow>();
  return row ? { id: row.id, state: row.state, requestedAt: row.requested_at, eraseAfter: row.erase_after } : null;
}

/**
 * Enregistre la demande d'effacement de l'espace, à faire sept jours après
 * (F563). Une demande déjà ouverte est rendue telle quelle : une seconde
 * demande ne repousse ni n'avance la première. `null` quand l'espace n'existe pas.
 */
export async function requestFarmErasure(spaceKey: string, now: Date): Promise<OpenFarmErasure | null> {
  const workspaceId = await findWorkspaceIdForUser(spaceKey);
  if (workspaceId === null) return null;
  await db.prepare(
    `INSERT INTO irrigation_farm_erasures (id, workspace_id, state, requested_at, erase_after)
     SELECT ?, ?, 'pending', ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM irrigation_farm_erasures WHERE workspace_id = ? AND state IN ${OPEN_STATES})`,
  ).bind(crypto.randomUUID(), workspaceId, now.toISOString(), farmErasureDueAt(now).toISOString(), workspaceId).run();
  return readOpenFarmErasureOfWorkspace(workspaceId);
}

/**
 * Annule la demande en attente de l'espace (F563 : annulable pendant les sept
 * jours, et jusqu'à ce que le matin commence l'effacement) ; `false` s'il n'y
 * en a pas, ou si l'effacement a commencé.
 */
export async function cancelFarmErasure(spaceKey: string, now: Date): Promise<boolean> {
  const workspaceId = await findWorkspaceIdForUser(spaceKey);
  if (workspaceId === null) return false;
  const result = await db.prepare(
    `UPDATE irrigation_farm_erasures SET state = 'cancelled', cancelled_at = ?
     WHERE workspace_id = ? AND state = 'pending'`,
  ).bind(now.toISOString(), workspaceId).run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * Les demandes ouvertes, pour l'exploitant (F563, effacement sans attendre ;
 * 10 bis.22, F668) : la ferme de l'espace, lue tant qu'il existe, et les
 * heures. Jamais la personne.
 */
export async function listOpenFarmErasures(): Promise<OperatorErasureRequest[]> {
  const { results } = await db.prepare(
    `SELECT erasure.id, erasure.state, erasure.requested_at, erasure.erase_after, workspace.otf_farm_id
     FROM irrigation_farm_erasures AS erasure
     LEFT JOIN irrigation_workspaces AS workspace ON workspace.id = erasure.workspace_id
     WHERE erasure.state IN ${OPEN_STATES}
     ORDER BY erasure.requested_at, erasure.id`,
  ).all<OpenRow & { otf_farm_id: string | null }>();
  return results.map((row) => ({ id: row.id, state: row.state, requestedAt: row.requested_at, eraseAfter: row.erase_after, otfFarmId: row.otf_farm_id }));
}

/**
 * L'effacement sans attendre, sur demande écrite (F563) : le délai de la
 * demande s'arrête à `at` (une demande déjà échue le reste). Seulement une
 * demande encore en attente ; `false` sinon (annulée, commencée ou faite
 * entre-temps).
 */
export async function advanceFarmErasure(id: string, at: string): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE irrigation_farm_erasures SET erase_after = MIN(erase_after, ?) WHERE id = ? AND state = 'pending'`,
  ).bind(at, id).run();
  return (result.meta.changes ?? 0) > 0;
}

/** Fait passer « en cours » les demandes dont le délai est échu ; rend leur nombre. */
export async function startDueFarmErasures(at: string): Promise<number> {
  const result = await db.prepare(
    `UPDATE irrigation_farm_erasures SET state = 'erasing', started_at = ?
     WHERE state = 'pending' AND erase_after <= ?`,
  ).bind(at, at).run();
  return result.meta.changes ?? 0;
}

export type ErasingRequest = { id: string; workspaceId: string };

/** Les effacements en cours, les plus anciens d'abord : ceux d'avant reprennent là où ils en étaient. */
export async function listErasingFarmErasures(): Promise<ErasingRequest[]> {
  const result = await db.prepare(
    `SELECT id, workspace_id FROM irrigation_farm_erasures WHERE state = 'erasing' ORDER BY started_at, id`,
  ).all<{ id: string; workspace_id: string }>();
  return result.results.map((row) => ({ id: row.id, workspaceId: row.workspace_id }));
}

/** L'espace à effacer, tel que les tables communes le désignent. */
export type ErasedSpace = {
  workspaceId: string;
  spaceKey: string;
  ownerUserId: string;
  otfFarmId: string | null;
  /** D'autres espaces gardent la même ferme : son journal des appels reste. */
  farmKeptByOthers: boolean;
  /** La personne a fait le raccordement de la ferme à Ouvre ta ferme : il part avec ses jetons. */
  madeConnection: boolean;
  /** La personne a un espace sans ferme : les instantanés gardés sous elle seule sont les siens. */
  personHasSpaceWithoutFarm: boolean;
};

/** L'espace d'une demande en cours, ou `null` s'il n'existe plus. */
export async function readErasedSpace(workspaceId: string): Promise<ErasedSpace | null> {
  const row = await db.prepare(
    `SELECT workspace.owner_user_id, workspace.otf_farm_id,
            EXISTS (SELECT 1 FROM irrigation_workspaces AS other
                    WHERE other.otf_farm_id = workspace.otf_farm_id AND other.id <> workspace.id) AS farm_kept,
            EXISTS (SELECT 1 FROM otf_farm_connections AS connection
                    WHERE connection.otf_farm_id = workspace.otf_farm_id AND connection.owner_user_id = workspace.owner_user_id) AS made_connection
     FROM irrigation_workspaces AS workspace WHERE workspace.id = ?`,
  ).bind(workspaceId).first<{ owner_user_id: string; otf_farm_id: string | null; farm_kept: number; made_connection: number }>();
  if (!row) return null;
  // L'espace de la personne seule, sans ferme, s'il existe à côté de celui-ci.
  const withoutFarm = row.otf_farm_id === null ? null : await findWorkspaceIdForUser(row.owner_user_id);
  return {
    workspaceId,
    spaceKey: spaceKeyOfRow(row),
    ownerUserId: row.owner_user_id,
    otfFarmId: row.otf_farm_id,
    farmKeptByOthers: row.farm_kept === 1,
    madeConnection: row.made_connection === 1,
    personHasSpaceWithoutFarm: withoutFarm !== null,
  };
}

/**
 * Un lot d'effacement : une table, et la condition qui y retient les lignes
 * de l'espace. Une table de l'espace (`spaceScoped`) n'a qu'un paramètre,
 * l'identifiant de l'espace.
 */
export type ErasureBatch = { table: string; condition: string; params: readonly (string | null)[]; spaceScoped: boolean };

/**
 * Tout ce que l'espace garde, dans l'ordre : ses tables, les dépendantes
 * d'abord, puis ce que les tables communes gardent de lui (F643). L'espace
 * lui-même part à la fin, avec `finishFarmErasure`.
 */
export function farmErasureBatches(space: ErasedSpace): ErasureBatch[] {
  const own: ErasureBatch[] = SPACE_TABLES.map(({ table }) => ({ table, condition: spaceRowsCondition(table), params: [space.workspaceId], spaceScoped: true }));
  const shared = Object.entries(FARM_TABLES).flatMap(([table, { rule, column }]) => farmTableBatches(space, table, rule, column));
  return [...own, ...shared];
}

const SNAPSHOT_FARM = `(CASE WHEN json_valid(payload) THEN CAST(json_extract(payload, '$.structure.id') AS TEXT) END)`;

function farmTableBatches(space: ErasedSpace, table: string, rule: FarmTableRule, column: string): ErasureBatch[] {
  switch (rule) {
    case 'space-snapshots': {
      const ownSnapshots: ErasureBatch = {
        table,
        condition: `(instr("${column}", ?) = 1 OR "${column}" = ?)`,
        params: [seasonSnapshotPrefix(space.spaceKey), legacySnapshotKey(space.spaceKey)],
        spaceScoped: false,
      };
      // Ceux de la même ferme gardés sous la personne seule, d'avant le rattachement (F343), s'ils ne sont plus à un autre espace.
      if (space.otfFarmId === null || space.personHasSpaceWithoutFarm) return [ownSnapshots];
      return [ownSnapshots, {
        table,
        condition: `(instr("${column}", ?) = 1 OR "${column}" = ?) AND ${SNAPSHOT_FARM} = ?`,
        params: [seasonSnapshotPrefix(space.ownerUserId), legacySnapshotKey(space.ownerUserId), space.otfFarmId],
        spaceScoped: false,
      }];
    }
    case 'farm-connection':
      // Le raccordement et ses jetons partent si la personne l'a fait, ou si aucun autre espace ne garde la ferme.
      if (space.otfFarmId === null || (space.farmKeptByOthers && !space.madeConnection)) return [];
      return [{ table, condition: `"${column}" = ?`, params: [space.otfFarmId], spaceScoped: false }];
    case 'farm-calls':
      // Le journal des appels compte pour tous les espaces de la ferme : il part avec le dernier.
      if (space.otfFarmId === null || space.farmKeptByOthers) return [];
      return [{ table, condition: `"${column}" = ?`, params: [space.otfFarmId], spaceScoped: false }];
  }
}

/**
 * Les lots qui ont encore des lignes, dans l'ordre, en une seule requête : un
 * passage qui reprend ne dépense pas une instruction par table déjà vide (la
 * base D1 borne aussi le nombre de requêtes d'une exécution). L'identifiant de
 * l'espace n'est lié qu'une fois, pour rester loin de la borne des paramètres.
 */
export async function remainingErasureBatches(workspaceId: string, batches: readonly ErasureBatch[]): Promise<ErasureBatch[]> {
  if (batches.length === 0) return [];
  const terms = batches.map((batch, index) => {
    const condition = batch.spaceScoped ? batch.condition.replace('?', '(SELECT id FROM erased)') : batch.condition;
    return `SELECT ${index} AS step WHERE EXISTS (SELECT 1 FROM "${batch.table}" WHERE ${condition})`;
  });
  const result = await db.prepare(`WITH erased(id) AS (VALUES (?)) ${terms.join(' UNION ALL ')}`)
    .bind(workspaceId, ...batches.flatMap((batch) => (batch.spaceScoped ? [] : batch.params)))
    .all<{ step: number }>();
  const remaining = new Set(result.results.map((row) => Number(row.step)));
  return batches.filter((_, index) => remaining.has(index));
}

/** Efface au plus `limit` lignes du lot ; rend le nombre effacé (moins que `limit` : le lot est fini). */
export async function runErasureBatch(batch: ErasureBatch, limit: number): Promise<number> {
  const result = await db.prepare(
    `DELETE FROM "${batch.table}" WHERE rowid IN (SELECT rowid FROM "${batch.table}" WHERE ${batch.condition} LIMIT ?)`,
  ).bind(...batch.params, limit).run();
  return result.meta.changes ?? 0;
}

/**
 * Efface l'espace et note la demande « faite », d'un bloc (F645) : si une
 * ligne de l'espace restait, les clés étrangères refusent, rien n'est écrit,
 * et la demande reste « en cours ». Jamais une ferme notée faite à moitié.
 */
export async function finishFarmErasure(request: ErasingRequest, at: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM ${SPACE_ROOT_TABLE} WHERE id = ?`).bind(request.workspaceId),
    db.prepare(`UPDATE irrigation_farm_erasures SET state = 'erased', erased_at = ? WHERE id = ? AND state = 'erasing'`).bind(at, request.id),
  ]);
}

/** Les demandes, comptées pour la page d'état (F646) : en attente du délai, échues ou commencées, faites. */
export async function readFarmErasureCounts(now: Date): Promise<FarmErasureCounts> {
  const at = now.toISOString();
  const row = await db.prepare(
    `SELECT
       COALESCE(SUM(state = 'pending' AND erase_after > ?), 0) AS waiting,
       COALESCE(SUM(state = 'erasing' OR (state = 'pending' AND erase_after <= ?)), 0) AS due,
       COALESCE(SUM(state = 'erased'), 0) AS erased,
       MAX(erased_at) AS last_erased_at
     FROM irrigation_farm_erasures`,
  ).bind(at, at).first<{ waiting: number; due: number; erased: number; last_erased_at: string | null }>();
  return {
    waiting: Number(row?.waiting ?? 0),
    due: Number(row?.due ?? 0),
    erased: Number(row?.erased ?? 0),
    lastErasedAt: row?.last_erased_at ?? null,
  };
}
