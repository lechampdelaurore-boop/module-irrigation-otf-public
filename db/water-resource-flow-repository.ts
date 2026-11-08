import { db } from './binding';
import { ensureWorkspaceForUser } from './workspace-repository';
import {
  validateMeterReading,
  type MeterReadingDraft,
  type MeterReadingRejection,
  type ResourceMeterReading,
} from '@/lib/domain/resource-flow';

/**
 * Relevés du compteur d'une ressource et décisions de débit de référence
 * (`docs/resource-flow-contract.md`).
 *
 * Un relevé est une lecture : il se corrige et se supprime. Une révision de
 * débit est une décision : elle ne se réécrit pas (D-006).
 */

export class ResourceMeterReadingError extends Error {
  // Champ déclaré à part : Node exécute les tests en mode « strip-types », qui
  // refuse une propriété déclarée dans la signature du constructeur.
  rejection: MeterReadingRejection;

  constructor(rejection: MeterReadingRejection) {
    super(rejection);
    this.name = 'ResourceMeterReadingError';
    this.rejection = rejection;
  }
}

export class ResourceNotFoundError extends Error {
  constructor() {
    super('Ressource introuvable.');
    this.name = 'ResourceNotFoundError';
  }
}

export type ResourceMeterReadingRecord = ResourceMeterReading & {
  resourceId: string;
  note: string | null;
  createdAt: string;
};

export type ResourceFlowRevisionRecord = {
  id: string;
  resourceId: string;
  flowCubicMetersPerHour: number;
  validFrom: string;
  validUntil: string | null;
  fromReadingId: string | null;
  toReadingId: string | null;
  referenceNote: string | null;
  createdAt: string;
};

type ReadingRow = {
  id: string;
  resource_id: string;
  taken_at: string;
  meter_index_cubic_meters: number;
  stopped_seconds: number | null;
  meter_replaced: number;
  note: string | null;
  created_at: string;
};

type RevisionRow = {
  id: string;
  resource_id: string;
  flow_cubic_meters_per_hour: number;
  valid_from: string;
  valid_until: string | null;
  from_reading_id: string | null;
  to_reading_id: string | null;
  reference_note: string | null;
  created_at: string;
};

export async function listResourceMeterReadingsForUser(
  ownerUserId: string,
  resourceId?: string,
): Promise<ResourceMeterReadingRecord[]> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return [];
  const result = await db.prepare(
    `SELECT id, resource_id, taken_at, meter_index_cubic_meters, stopped_seconds,
            meter_replaced, note, created_at
     FROM irrigation_water_resource_meter_readings
     WHERE workspace_id = ? AND (? IS NULL OR resource_id = ?)
     ORDER BY resource_id, taken_at`,
  ).bind(workspaceId, resourceId ?? null, resourceId ?? null).all<ReadingRow>();
  return result.results.map(readingFromRow);
}

export async function listResourceFlowRevisionsForUser(
  ownerUserId: string,
  resourceId?: string,
): Promise<ResourceFlowRevisionRecord[]> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return [];
  const result = await db.prepare(
    `SELECT id, resource_id, flow_cubic_meters_per_hour, valid_from, valid_until,
            from_reading_id, to_reading_id, reference_note, created_at
     FROM irrigation_water_resource_flow_revisions
     WHERE workspace_id = ? AND (? IS NULL OR resource_id = ?)
     ORDER BY resource_id, valid_from, created_at`,
  ).bind(workspaceId, resourceId ?? null, resourceId ?? null).all<RevisionRow>();
  return result.results.map((row) => ({
    id: row.id,
    resourceId: row.resource_id,
    flowCubicMetersPerHour: row.flow_cubic_meters_per_hour,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    fromReadingId: row.from_reading_id,
    toReadingId: row.to_reading_id,
    referenceNote: row.reference_note,
    createdAt: row.created_at,
  }));
}

export async function saveResourceMeterReadingForUser(
  ownerUserId: string,
  actorUserId: string,
  resourceId: string,
  draft: MeterReadingDraft & { note: string | null },
  readingId: string | null = null,
): Promise<string> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await assertResourceOwned(resourceId, workspaceId);
  if (readingId) await assertReadingOwned(readingId, workspaceId);

  await assertValid(workspaceId, resourceId, draft, readingId);

  const id = readingId ?? crypto.randomUUID();
  const statement = readingId
    ? db.prepare(
      `UPDATE irrigation_water_resource_meter_readings
       SET taken_at = ?, meter_index_cubic_meters = ?, stopped_seconds = ?,
           meter_replaced = ?, note = ?
       WHERE id = ? AND workspace_id = ?`,
    ).bind(draft.takenAt, draft.meterIndexCubicMeters, stoppedForStorage(draft),
      draft.meterReplaced ? 1 : 0, draft.note, id, workspaceId)
    : db.prepare(
      `INSERT INTO irrigation_water_resource_meter_readings
       (id, workspace_id, resource_id, taken_at, meter_index_cubic_meters,
        stopped_seconds, meter_replaced, note, actor_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, workspaceId, resourceId, draft.takenAt, draft.meterIndexCubicMeters,
      stoppedForStorage(draft), draft.meterReplaced ? 1 : 0, draft.note, actorUserId);

  await statement.run();
  return id;
}

export async function deleteResourceMeterReadingForUser(
  ownerUserId: string,
  readingId: string,
): Promise<void> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) throw new ResourceNotFoundError();
  await assertReadingOwned(readingId, workspaceId);
  await db.prepare(
    'DELETE FROM irrigation_water_resource_meter_readings WHERE id = ? AND workspace_id = ?',
  ).bind(readingId, workspaceId).run();
}

/**
 * Applique un débit mesuré à la ressource : une révision est écrite, la
 * précédente se ferme à la même date, et le débit de référence de la ressource
 * est remplacé.
 */
export async function applyResourceFlowForUser(
  ownerUserId: string,
  actorUserId: string,
  input: {
    resourceId: string;
    flowCubicMetersPerHour: number;
    fromReadingId: string | null;
    toReadingId: string | null;
    referenceNote: string | null;
  },
): Promise<string> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await assertResourceOwned(input.resourceId, workspaceId);
  if (!Number.isFinite(input.flowCubicMetersPerHour) || input.flowCubicMetersPerHour < 0) {
    throw new Error('Débit mesuré invalide.');
  }

  const id = crypto.randomUUID();
  const validFrom = new Date().toISOString();
  await db.batch([
    db.prepare(
      `UPDATE irrigation_water_resource_flow_revisions SET valid_until = ?
       WHERE workspace_id = ? AND resource_id = ? AND valid_until IS NULL`,
    ).bind(validFrom, workspaceId, input.resourceId),
    db.prepare(
      `INSERT INTO irrigation_water_resource_flow_revisions
       (id, workspace_id, resource_id, flow_cubic_meters_per_hour, valid_from,
        from_reading_id, to_reading_id, reference_note, actor_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, workspaceId, input.resourceId, input.flowCubicMetersPerHour, validFrom,
      input.fromReadingId, input.toReadingId, input.referenceNote, actorUserId),
    db.prepare(
      `UPDATE irrigation_water_resources
       SET nominal_flow_cubic_meters_per_hour = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND workspace_id = ?`,
    ).bind(input.flowCubicMetersPerHour, input.resourceId, workspaceId),
  ]);
  return id;
}

/**
 * Vérifie le relevé contre ses voisins immédiats, celui qu'on modifie étant
 * exclu de la recherche : sinon il serait son propre voisin.
 */
async function assertValid(
  workspaceId: string,
  resourceId: string,
  draft: MeterReadingDraft,
  readingId: string | null,
): Promise<void> {
  const [previous, next] = await Promise.all([
    neighbour(workspaceId, resourceId, draft.takenAt, readingId, 'previous'),
    neighbour(workspaceId, resourceId, draft.takenAt, readingId, 'next'),
  ]);
  const rejection = validateMeterReading(draft, { previous, next }, new Date());
  if (rejection) throw new ResourceMeterReadingError(rejection);
}

async function neighbour(
  workspaceId: string,
  resourceId: string,
  takenAt: string,
  exceptId: string | null,
  side: 'previous' | 'next',
): Promise<ResourceMeterReading | null> {
  // Le côté précédent compare avec `<=` : un relevé déjà posé au même instant
  // devient ainsi le voisin immédiat, et le domaine le refuse pour durée
  // écoulée nulle. Sans cela, seule la contrainte d'unicité de la base
  // l'attraperait, avec un message qui ne dit rien au maraîcher.
  const comparison = side === 'previous' ? '<=' : '>';
  const order = side === 'previous' ? 'DESC' : 'ASC';
  const row = await db.prepare(
    `SELECT id, resource_id, taken_at, meter_index_cubic_meters, stopped_seconds,
            meter_replaced, note, created_at
     FROM irrigation_water_resource_meter_readings
     WHERE workspace_id = ? AND resource_id = ? AND taken_at ${comparison} ?
       AND (? IS NULL OR id != ?)
     ORDER BY taken_at ${order} LIMIT 1`,
  ).bind(workspaceId, resourceId, takenAt, exceptId, exceptId).first<ReadingRow>();
  return row ? readingFromRow(row) : null;
}

function readingFromRow(row: ReadingRow): ResourceMeterReadingRecord {
  return {
    id: row.id,
    resourceId: row.resource_id,
    takenAt: row.taken_at,
    meterIndexCubicMeters: row.meter_index_cubic_meters,
    stoppedSeconds: row.stopped_seconds,
    meterReplaced: row.meter_replaced === 1,
    note: row.note,
    createdAt: row.created_at,
  };
}

/**
 * La durée d'arrêt n'a pas de sens sur un relevé qui n'a pas de prédécesseur
 * utile — le premier, ou celui qui déclare un compteur remplacé.
 */
function stoppedForStorage(draft: MeterReadingDraft): number | null {
  return draft.meterReplaced ? null : draft.stoppedSeconds;
}

async function assertResourceOwned(resourceId: string, workspaceId: string): Promise<void> {
  const row = await db.prepare(
    'SELECT id FROM irrigation_water_resources WHERE id = ? AND workspace_id = ? LIMIT 1',
  ).bind(resourceId, workspaceId).first();
  if (!row) throw new ResourceNotFoundError();
}

async function assertReadingOwned(readingId: string, workspaceId: string): Promise<void> {
  const row = await db.prepare(
    'SELECT id FROM irrigation_water_resource_meter_readings WHERE id = ? AND workspace_id = ? LIMIT 1',
  ).bind(readingId, workspaceId).first();
  if (!row) throw new Error('Relevé introuvable.');
}

async function findWorkspaceId(ownerUserId: string): Promise<string | null> {
  const row = await db.prepare(
    'SELECT id FROM irrigation_workspaces WHERE owner_user_id = ? LIMIT 1',
  ).bind(ownerUserId).first<{ id: string }>();
  return row?.id ?? null;
}
