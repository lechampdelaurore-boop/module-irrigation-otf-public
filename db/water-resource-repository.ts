import { db } from './binding';
import { ensureWorkspaceForUser } from './workspace-repository';
import {
  hasReservoirCycle,
  type IrrigationSupplyDefault,
  type ReservoirLink,
  type ResourceReservoirLink,
  type WaterInfrastructure,
  type WaterReservoir,
  type WaterReservoirDraft,
  type WaterResource,
  type WaterResourceDraft,
  type WaterResourceLimit,
  type WaterStockMovement,
} from '@/lib/domain/water-resources';

type ResourceRow = {
  id: string;
  name: string;
  type: WaterResource['type'];
  nominal_flow_cubic_meters_per_hour: number;
  status: WaterResource['status'];
  available_from: string | null;
  available_until: string | null;
  notes: string | null;
};

type ReservoirRow = {
  id: string;
  name: string;
  type: WaterReservoir['type'];
  capacity_cubic_meters: number;
  current_volume_cubic_meters: number | null;
  current_volume_observed_at: string | null;
  minimum_safety_cubic_meters: number;
  exposed_surface_square_meters: number;
  receives_rain: number;
  evaporation_enabled: number;
  evaporation_coefficient: number;
  status: WaterReservoir['status'];
  notes: string | null;
};

export async function listWaterInfrastructureForUser(ownerUserId: string, movementPeriod?: { startAt: string; endAt: string }): Promise<WaterInfrastructure> {
  const queries = await Promise.all([
    db.prepare(`SELECT resource.id, resource.name, resource.type,
      resource.nominal_flow_cubic_meters_per_hour, resource.status,
      resource.available_from, resource.available_until, resource.notes
      FROM irrigation_water_resources AS resource
      INNER JOIN irrigation_workspaces AS workspace ON workspace.id = resource.workspace_id
      WHERE workspace.owner_user_id = ? ORDER BY resource.name COLLATE NOCASE`).bind(ownerUserId).all<ResourceRow>(),
    db.prepare(`SELECT reservoir.id, reservoir.name, reservoir.type,
      reservoir.capacity_cubic_meters, reservoir.current_volume_cubic_meters,
      reservoir.current_volume_observed_at, reservoir.minimum_safety_cubic_meters,
      reservoir.exposed_surface_square_meters, reservoir.receives_rain,
      reservoir.evaporation_enabled, reservoir.evaporation_coefficient,
      reservoir.status, reservoir.notes
      FROM irrigation_water_reservoirs AS reservoir
      INNER JOIN irrigation_workspaces AS workspace ON workspace.id = reservoir.workspace_id
      WHERE workspace.owner_user_id = ? ORDER BY reservoir.name COLLATE NOCASE`).bind(ownerUserId).all<ReservoirRow>(),
    // Départage par rowid, l'ordre d'insertion : l'identifiant est tiré au sort (docs/revision-order-contract.md).
    db.prepare(`SELECT limits.id, limits.resource_id, limits.enabled,
      limits.max_cubic_meters_per_day, limits.valid_from, limits.valid_until,
      limits.reference_note, limits.created_at
      FROM irrigation_water_resource_limit_revisions AS limits
      INNER JOIN irrigation_workspaces AS workspace ON workspace.id = limits.workspace_id
      WHERE workspace.owner_user_id = ?
      ORDER BY limits.created_at DESC, limits.rowid DESC`).bind(ownerUserId).all<Record<string, unknown>>(),
    db.prepare(`SELECT links.id, links.resource_id, links.reservoir_id,
      links.fill_mode, links.active
      FROM irrigation_water_resource_reservoir_links AS links
      INNER JOIN irrigation_workspaces AS workspace ON workspace.id = links.workspace_id
      WHERE workspace.owner_user_id = ? ORDER BY links.created_at, links.id`).bind(ownerUserId).all<Record<string, unknown>>(),
    db.prepare(`SELECT links.id, links.upstream_reservoir_id,
      links.downstream_reservoir_id, links.transfer_mode, links.active
      FROM irrigation_water_reservoir_links AS links
      INNER JOIN irrigation_workspaces AS workspace ON workspace.id = links.workspace_id
      WHERE workspace.owner_user_id = ? ORDER BY links.created_at, links.id`).bind(ownerUserId).all<Record<string, unknown>>(),
    db.prepare(`SELECT supply.source_kind, supply.resource_id, supply.reservoir_id
      FROM irrigation_water_supply_defaults AS supply
      INNER JOIN irrigation_workspaces AS workspace ON workspace.id = supply.workspace_id
      WHERE workspace.owner_user_id = ? LIMIT 1`).bind(ownerUserId).first<Record<string, unknown>>(),
    db.prepare(`SELECT movement.id, movement.reservoir_id, movement.resource_id,
      movement.kind, movement.volume_delta_cubic_meters, movement.occurred_at,
      movement.previous_volume_cubic_meters, movement.resulting_volume_cubic_meters,
      movement.reason
      FROM irrigation_water_stock_movements AS movement
      INNER JOIN irrigation_workspaces AS workspace ON workspace.id = movement.workspace_id
      WHERE workspace.owner_user_id = ?
      ${movementPeriod ? 'AND movement.occurred_at >= ? AND movement.occurred_at < ?' : ''}
      ORDER BY movement.occurred_at DESC, movement.created_at DESC
      ${movementPeriod ? '' : 'LIMIT 500'}`).bind(...(movementPeriod ? [ownerUserId, movementPeriod.startAt, movementPeriod.endAt] : [ownerUserId])).all<Record<string, unknown>>(),
  ]);
  const [resources, reservoirs, limits, resourceLinks, reservoirLinks, supply, movements] = queries;
  return {
    resources: resources.results.map(mapResource),
    reservoirs: reservoirs.results.map(mapReservoir),
    resourceLimits: limits.results.map((row) => ({
      id: String(row.id), resourceId: String(row.resource_id), enabled: Boolean(row.enabled),
      maxCubicMetersPerDay: nullableNumber(row.max_cubic_meters_per_day),
      validFrom: String(row.valid_from), validUntil: nullableString(row.valid_until),
      referenceNote: nullableString(row.reference_note), createdAt: String(row.created_at),
    })),
    resourceReservoirLinks: resourceLinks.results.map((row) => ({
      id: String(row.id), resourceId: String(row.resource_id), reservoirId: String(row.reservoir_id),
      fillMode: row.fill_mode as ResourceReservoirLink['fillMode'], active: Boolean(row.active),
    })),
    reservoirLinks: reservoirLinks.results.map((row) => ({
      id: String(row.id), upstreamReservoirId: String(row.upstream_reservoir_id),
      downstreamReservoirId: String(row.downstream_reservoir_id),
      transferMode: row.transfer_mode as ReservoirLink['transferMode'], active: Boolean(row.active),
    })),
    defaultSupply: supply ? mapSupply(supply) : null,
    movements: movements.results.map((row) => ({
      id: String(row.id), reservoirId: nullableString(row.reservoir_id), resourceId: nullableString(row.resource_id),
      kind: row.kind as WaterStockMovement['kind'], volumeDeltaCubicMeters: Number(row.volume_delta_cubic_meters),
      occurredAt: String(row.occurred_at), previousVolumeCubicMeters: nullableNumber(row.previous_volume_cubic_meters),
      resultingVolumeCubicMeters: nullableNumber(row.resulting_volume_cubic_meters), reason: nullableString(row.reason),
    })),
  };
}

export async function saveWaterResourceForUser(
  ownerUserId: string,
  actorUserId: string,
  resourceId: string | null,
  draft: WaterResourceDraft,
) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const id = resourceId ?? crypto.randomUUID();
  if (resourceId) await assertOwned('irrigation_water_resources', resourceId, workspaceId, 'Ressource introuvable.');
  await assertNameAvailable('irrigation_water_resources', workspaceId, draft.name, resourceId);
  const statement = resourceId
    ? db.prepare(`UPDATE irrigation_water_resources SET name = ?, type = ?,
        nominal_flow_cubic_meters_per_hour = ?, status = ?, available_from = ?,
        available_until = ?, notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND workspace_id = ?`).bind(draft.name, draft.type, draft.nominalFlowCubicMetersPerHour,
          draft.status, draft.availableFrom, draft.availableUntil, draft.notes, id, workspaceId)
    : db.prepare(`INSERT INTO irrigation_water_resources
        (id, workspace_id, name, type, nominal_flow_cubic_meters_per_hour,
         status, available_from, available_until, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, workspaceId, draft.name, draft.type,
          draft.nominalFlowCubicMetersPerHour, draft.status, draft.availableFrom, draft.availableUntil, draft.notes);
  await db.batch([statement, auditStatement(workspaceId, 'resource', id, resourceId ? 'updated' : 'created', draft, actorUserId)]);
  return id;
}

export async function saveWaterResourceLimitForUser(
  ownerUserId: string,
  actorUserId: string,
  resourceId: string,
  limit: Omit<WaterResourceLimit, 'id' | 'resourceId' | 'createdAt'>,
) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await assertOwned('irrigation_water_resources', resourceId, workspaceId, 'Ressource introuvable.');
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO irrigation_water_resource_limit_revisions
      (id, workspace_id, resource_id, enabled, max_cubic_meters_per_day,
       valid_from, valid_until, reference_note, actor_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, workspaceId, resourceId, limit.enabled ? 1 : 0,
        limit.maxCubicMetersPerDay, limit.validFrom, limit.validUntil, limit.referenceNote, actorUserId),
    auditStatement(workspaceId, 'resource', resourceId, 'configured', { limit }, actorUserId),
  ]);
  return id;
}

export async function saveWaterReservoirForUser(
  ownerUserId: string,
  actorUserId: string,
  reservoirId: string | null,
  draft: WaterReservoirDraft,
  observedAt: string,
) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const id = reservoirId ?? crypto.randomUUID();
  if (reservoirId) await assertOwned('irrigation_water_reservoirs', reservoirId, workspaceId, 'Réserve introuvable.');
  await assertNameAvailable('irrigation_water_reservoirs', workspaceId, draft.name, reservoirId);
  const currentObservation = draft.currentVolumeCubicMeters === null ? null : observedAt;
  const statement = reservoirId
    ? db.prepare(`UPDATE irrigation_water_reservoirs SET name = ?, type = ?, capacity_cubic_meters = ?,
        minimum_safety_cubic_meters = ?,
        exposed_surface_square_meters = ?, receives_rain = ?, evaporation_enabled = ?,
        evaporation_coefficient = ?, status = ?, notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND workspace_id = ?`).bind(draft.name, draft.type, draft.capacityCubicMeters,
          draft.minimumSafetyCubicMeters,
          draft.exposedSurfaceSquareMeters, draft.receivesRain ? 1 : 0, draft.evaporationEnabled ? 1 : 0,
          draft.evaporationCoefficient, draft.status, draft.notes, id, workspaceId)
    : db.prepare(`INSERT INTO irrigation_water_reservoirs
        (id, workspace_id, name, type, capacity_cubic_meters, current_volume_cubic_meters,
         current_volume_observed_at, minimum_safety_cubic_meters, exposed_surface_square_meters,
         receives_rain, evaporation_enabled, evaporation_coefficient, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, workspaceId, draft.name, draft.type,
          draft.capacityCubicMeters, draft.currentVolumeCubicMeters, currentObservation,
          draft.minimumSafetyCubicMeters, draft.exposedSurfaceSquareMeters, draft.receivesRain ? 1 : 0,
          draft.evaporationEnabled ? 1 : 0, draft.evaporationCoefficient, draft.status, draft.notes);
  await db.batch([statement, auditStatement(workspaceId, 'reservoir', id, reservoirId ? 'updated' : 'created', draft, actorUserId)]);
  return id;
}

export async function correctWaterReservoirVolumeForUser(
  ownerUserId: string,
  actorUserId: string,
  reservoirId: string,
  newVolumeCubicMeters: number,
  observedAt: string,
  reason: string | null,
) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const row = await db.prepare(`SELECT current_volume_cubic_meters, capacity_cubic_meters
    FROM irrigation_water_reservoirs WHERE id = ? AND workspace_id = ? LIMIT 1`)
    .bind(reservoirId, workspaceId).first<{ current_volume_cubic_meters: number | null; capacity_cubic_meters: number }>();
  if (!row) throw new Error('Réserve introuvable.');
  if (!Number.isFinite(newVolumeCubicMeters) || newVolumeCubicMeters < 0 || newVolumeCubicMeters > Number(row.capacity_cubic_meters)) {
    throw new Error('Le volume observé doit être compris entre 0 et la capacité de la réserve.');
  }
  const oldVolume = nullableNumber(row.current_volume_cubic_meters);
  const movementId = crypto.randomUUID();
  await db.batch([
    db.prepare(`UPDATE irrigation_water_reservoirs SET current_volume_cubic_meters = ?,
      current_volume_observed_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? AND workspace_id = ?`).bind(newVolumeCubicMeters, observedAt, reservoirId, workspaceId),
    db.prepare(`INSERT INTO irrigation_water_stock_movements
      (id, workspace_id, reservoir_id, kind, volume_delta_cubic_meters, occurred_at,
       previous_volume_cubic_meters, resulting_volume_cubic_meters, reason, actor_user_id)
      VALUES (?, ?, ?, 'manual_correction', ?, ?, ?, ?, ?, ?)`).bind(movementId, workspaceId,
        reservoirId, newVolumeCubicMeters - (oldVolume ?? newVolumeCubicMeters), observedAt,
        oldVolume, newVolumeCubicMeters, reason, actorUserId),
  ]);
  return movementId;
}

export async function saveResourceReservoirLinkForUser(
  ownerUserId: string,
  actorUserId: string,
  input: Omit<ResourceReservoirLink, 'id'> & { id?: string },
) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await Promise.all([
    assertOwned('irrigation_water_resources', input.resourceId, workspaceId, 'Ressource introuvable.'),
    assertOwned('irrigation_water_reservoirs', input.reservoirId, workspaceId, 'Réserve introuvable.'),
  ]);
  const id = input.id ?? crypto.randomUUID();
  if (input.id) await assertOwned('irrigation_water_resource_reservoir_links', input.id, workspaceId, 'Liaison introuvable.');
  const statement = input.id
    ? db.prepare(`UPDATE irrigation_water_resource_reservoir_links SET resource_id = ?, reservoir_id = ?,
        fill_mode = ?, active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND workspace_id = ?`).bind(input.resourceId, input.reservoirId, input.fillMode, input.active ? 1 : 0, id, workspaceId)
    : db.prepare(`INSERT INTO irrigation_water_resource_reservoir_links
        (id, workspace_id, resource_id, reservoir_id, fill_mode, active)
        VALUES (?, ?, ?, ?, ?, ?)`).bind(id, workspaceId, input.resourceId, input.reservoirId, input.fillMode, input.active ? 1 : 0);
  await db.batch([statement, auditStatement(workspaceId, 'resource_reservoir_link', id, input.id ? 'updated' : 'created', input, actorUserId)]);
  return id;
}

export async function saveReservoirLinkForUser(
  ownerUserId: string,
  actorUserId: string,
  input: Omit<ReservoirLink, 'id'> & { id?: string },
) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  if (input.upstreamReservoirId === input.downstreamReservoirId) throw new Error('Une réserve ne peut pas être reliée à elle-même.');
  await Promise.all([
    assertOwned('irrigation_water_reservoirs', input.upstreamReservoirId, workspaceId, 'Réserve source introuvable.'),
    assertOwned('irrigation_water_reservoirs', input.downstreamReservoirId, workspaceId, 'Réserve destinataire introuvable.'),
  ]);
  const existing = await db.prepare(`SELECT id, upstream_reservoir_id, downstream_reservoir_id, active
    FROM irrigation_water_reservoir_links WHERE workspace_id = ?`).bind(workspaceId).all<Record<string, unknown>>();
  const candidate: ReservoirLink = {
    id: input.id ?? crypto.randomUUID(), upstreamReservoirId: input.upstreamReservoirId,
    downstreamReservoirId: input.downstreamReservoirId, transferMode: input.transferMode, active: input.active,
  };
  const graph: ReservoirLink[] = existing.results.filter((row) => String(row.id) !== input.id).map((row) => ({
    id: String(row.id), upstreamReservoirId: String(row.upstream_reservoir_id),
    downstreamReservoirId: String(row.downstream_reservoir_id),
    transferMode: String(row.transfer_mode) as ReservoirLink['transferMode'],
    active: Boolean(row.active),
  })).concat(candidate);
  if (hasReservoirCycle(graph)) throw new Error('Cette liaison créerait un cycle de réserves, non supporté dans cette version.');
  const id = candidate.id;
  if (input.id) await assertOwned('irrigation_water_reservoir_links', input.id, workspaceId, 'Liaison introuvable.');
  const statement = input.id
    ? db.prepare(`UPDATE irrigation_water_reservoir_links SET upstream_reservoir_id = ?,
        downstream_reservoir_id = ?, transfer_mode = ?, active = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND workspace_id = ?`)
        .bind(input.upstreamReservoirId, input.downstreamReservoirId, input.transferMode, input.active ? 1 : 0, id, workspaceId)
    : db.prepare(`INSERT INTO irrigation_water_reservoir_links
        (id, workspace_id, upstream_reservoir_id, downstream_reservoir_id, transfer_mode, active)
        VALUES (?, ?, ?, ?, ?, ?)`).bind(id, workspaceId, input.upstreamReservoirId,
          input.downstreamReservoirId, input.transferMode, input.active ? 1 : 0);
  await db.batch([statement, auditStatement(workspaceId, 'reservoir_link', id, input.id ? 'updated' : 'created', input, actorUserId)]);
  return id;
}

export async function saveDefaultWaterSupplyForUser(
  ownerUserId: string,
  actorUserId: string,
  supply: IrrigationSupplyDefault | null,
) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  if (supply?.sourceKind === 'resource') await assertOwned('irrigation_water_resources', supply.resourceId, workspaceId, 'Ressource introuvable.');
  if (supply?.sourceKind === 'reservoir') await assertOwned('irrigation_water_reservoirs', supply.reservoirId, workspaceId, 'Réserve introuvable.');
  const statement = supply
    ? db.prepare(`INSERT INTO irrigation_water_supply_defaults
        (workspace_id, source_kind, resource_id, reservoir_id)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(workspace_id) DO UPDATE SET source_kind = excluded.source_kind,
          resource_id = excluded.resource_id, reservoir_id = excluded.reservoir_id,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
        .bind(workspaceId, supply.sourceKind, supply.resourceId, supply.reservoirId)
    : db.prepare('DELETE FROM irrigation_water_supply_defaults WHERE workspace_id = ?').bind(workspaceId);
  await db.batch([statement, auditStatement(workspaceId, 'supply_default', workspaceId, 'configured', supply, actorUserId)]);
}

function mapResource(row: ResourceRow): WaterResource {
  return { id: row.id, name: row.name, type: row.type,
    nominalFlowCubicMetersPerHour: Number(row.nominal_flow_cubic_meters_per_hour), status: row.status,
    availableFrom: row.available_from, availableUntil: row.available_until, notes: row.notes };
}

function mapReservoir(row: ReservoirRow): WaterReservoir {
  return { id: row.id, name: row.name, type: row.type, capacityCubicMeters: Number(row.capacity_cubic_meters),
    currentVolumeCubicMeters: nullableNumber(row.current_volume_cubic_meters), currentVolumeObservedAt: row.current_volume_observed_at,
    minimumSafetyCubicMeters: Number(row.minimum_safety_cubic_meters), exposedSurfaceSquareMeters: Number(row.exposed_surface_square_meters),
    receivesRain: Boolean(row.receives_rain), evaporationEnabled: Boolean(row.evaporation_enabled),
    evaporationCoefficient: Number(row.evaporation_coefficient), status: row.status, notes: row.notes };
}

function mapSupply(row: Record<string, unknown>): IrrigationSupplyDefault | null {
  if (row.source_kind === 'resource' && row.resource_id) return { sourceKind: 'resource', resourceId: String(row.resource_id), reservoirId: null };
  if (row.source_kind === 'reservoir' && row.reservoir_id) return { sourceKind: 'reservoir', resourceId: null, reservoirId: String(row.reservoir_id) };
  return null;
}

async function assertOwned(table: string, id: string, workspaceId: string, message: string) {
  const allowed = new Set(['irrigation_water_resources', 'irrigation_water_reservoirs',
    'irrigation_water_resource_reservoir_links', 'irrigation_water_reservoir_links']);
  if (!allowed.has(table)) throw new Error('Table de vérification invalide.');
  const row = await db.prepare(`SELECT id FROM ${table} WHERE id = ? AND workspace_id = ? LIMIT 1`).bind(id, workspaceId).first();
  if (!row) throw new Error(message);
}

async function assertNameAvailable(table: string, workspaceId: string, name: string, exceptId: string | null) {
  const allowed = new Set(['irrigation_water_resources', 'irrigation_water_reservoirs']);
  if (!allowed.has(table)) throw new Error('Table de vérification invalide.');
  const row = await db.prepare(`SELECT id FROM ${table}
    WHERE workspace_id = ? AND name = ? COLLATE NOCASE AND (? IS NULL OR id != ?) LIMIT 1`)
    .bind(workspaceId, name, exceptId, exceptId).first();
  if (row) throw new Error('Ce nom est déjà utilisé dans cette liste.');
}

function auditStatement(workspaceId: string, entityType: string, entityId: string, action: string, payload: unknown, actorUserId: string) {
  return db.prepare(`INSERT INTO irrigation_water_infrastructure_log
    (id, workspace_id, entity_type, entity_id, action, payload, actor_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), workspaceId, entityType, entityId, action, JSON.stringify(payload), actorUserId);
}

function nullableString(value: unknown) { return value === null || value === undefined ? null : String(value); }
function nullableNumber(value: unknown) { return value === null || value === undefined ? null : Number(value); }
