import { db } from './binding';
import { ensureWorkspaceForUser } from './workspace-repository';
import { hydraulicRevisionStatement } from './workspace-repository';
import {
  normalizePumpDraft,
  type EquipmentPumpDefault,
  type IrrigationPump,
  type PumpDraft,
  type PumpOrigin,
  type PumpUsage,
} from '@/lib/domain/pumps';

type PumpRow = {
  id: string;
  name: string;
  maximum_flow_cubic_meters_per_hour: number;
  status: IrrigationPump['status'];
  archived_at: string | null;
  notes: string | null;
};

type OriginRow = {
  id: string;
  pump_id: string;
  source_kind: PumpOrigin['sourceKind'];
  resource_id: string | null;
  reservoir_id: string | null;
  is_default: number;
};

export type PumpConfiguration = {
  pumps: IrrigationPump[];
  equipmentDefaults: EquipmentPumpDefault[];
};

export async function listPumpConfigurationForUser(
  ownerUserId: string,
): Promise<PumpConfiguration> {
  const [pumps, origins, defaults] = await Promise.all([
    db.prepare(`SELECT pump.id, pump.name, pump.maximum_flow_cubic_meters_per_hour,
      pump.status, pump.archived_at, pump.notes
      FROM irrigation_pumps AS pump
      INNER JOIN irrigation_workspaces AS workspace ON workspace.id = pump.workspace_id
      WHERE workspace.owner_user_id = ?
      ORDER BY CASE pump.status WHEN 'active' THEN 0 ELSE 1 END, pump.name COLLATE NOCASE`)
      .bind(ownerUserId).all<PumpRow>(),
    db.prepare(`SELECT origin.id, origin.pump_id, origin.source_kind,
      origin.resource_id, origin.reservoir_id, origin.is_default
      FROM irrigation_pump_origins AS origin
      INNER JOIN irrigation_workspaces AS workspace ON workspace.id = origin.workspace_id
      WHERE workspace.owner_user_id = ? ORDER BY origin.is_default DESC, origin.created_at`)
      .bind(ownerUserId).all<OriginRow>(),
    db.prepare(`SELECT defaults.equipment_id, defaults.pump_id
      FROM irrigation_equipment_pump_defaults AS defaults
      INNER JOIN irrigation_workspaces AS workspace ON workspace.id = defaults.workspace_id
      WHERE workspace.owner_user_id = ?`)
      .bind(ownerUserId).all<{ equipment_id: string; pump_id: string }>(),
  ]);
  const originsByPump = new Map<string, PumpOrigin[]>();
  for (const row of origins.results) {
    const list = originsByPump.get(row.pump_id) ?? [];
    list.push({
      id: row.id,
      pumpId: row.pump_id,
      sourceKind: row.source_kind,
      resourceId: row.resource_id,
      reservoirId: row.reservoir_id,
      isDefault: Boolean(row.is_default),
    });
    originsByPump.set(row.pump_id, list);
  }
  return {
    pumps: pumps.results.map((row) => ({
      id: row.id,
      name: row.name,
      maximumFlowCubicMetersPerHour: Number(row.maximum_flow_cubic_meters_per_hour),
      status: row.status,
      archivedAt: row.archived_at,
      notes: row.notes,
      origins: originsByPump.get(row.id) ?? [],
    })),
    equipmentDefaults: defaults.results.map((row) => ({
      equipmentId: row.equipment_id,
      pumpId: row.pump_id,
    })),
  };
}

export async function listPumpUsagesForUser(
  ownerUserId: string,
  pumpId: string,
  startsAt: string,
  endsAt: string,
  excludedEventEquipmentId: string | null = null,
): Promise<PumpUsage[]> {
  const rows = await db.prepare(`SELECT event_equipment.id,
      event_equipment.pump_id, event_equipment.requested_flow_cubic_meters_per_hour,
      event_equipment.equipment_snapshot,
      CASE WHEN event_equipment.timer_state = 'running'
        THEN COALESCE(event_equipment.timer_resumed_at, event_equipment.actual_start_at, event_equipment.planned_start_at)
        ELSE event_equipment.planned_start_at END AS usage_start,
      CASE WHEN event_equipment.timer_state = 'running'
        THEN event_equipment.timer_theoretical_end_at
        ELSE event_equipment.planned_end_at END AS usage_end
    FROM irrigation_event_equipment AS event_equipment
    INNER JOIN irrigation_events AS event ON event.id = event_equipment.event_id
    INNER JOIN irrigation_workspaces AS workspace ON workspace.id = event.workspace_id
    WHERE workspace.owner_user_id = ? AND event_equipment.pump_id = ?
      AND event_equipment.id != COALESCE(?, '')
      AND event_equipment.requested_flow_cubic_meters_per_hour IS NOT NULL
      AND (
        (event_equipment.timer_state = 'running'
          AND event_equipment.timer_theoretical_end_at > ?
          AND COALESCE(event_equipment.timer_resumed_at, event_equipment.actual_start_at, event_equipment.planned_start_at) < ?)
        OR
        (event_equipment.timer_state IS NULL
          AND event_equipment.status IN ('planned', 'partially_completed')
          AND event_equipment.canceled_at IS NULL
          AND event_equipment.remaining_canceled_at IS NULL
          AND event_equipment.planned_end_at > ?
          AND event_equipment.planned_start_at < ?)
      )`)
    .bind(ownerUserId, pumpId, excludedEventEquipmentId, startsAt, endsAt, startsAt, endsAt)
    .all<{ id: string; pump_id: string; requested_flow_cubic_meters_per_hour: number; equipment_snapshot: string; usage_start: string; usage_end: string }>();
  return rows.results.map((row) => {
    const snapshot = JSON.parse(row.equipment_snapshot) as { name?: string };
    return {
      eventEquipmentId: row.id,
      label: snapshot.name ?? 'Irrigation',
      pumpId: row.pump_id,
      startsAt: row.usage_start,
      endsAt: row.usage_end,
      requestedFlowCubicMetersPerHour: Number(row.requested_flow_cubic_meters_per_hour),
    };
  });
}

export async function savePumpForUser(
  ownerUserId: string,
  actorUserId: string,
  pumpId: string | null,
  input: PumpDraft,
) {
  const draft = normalizePumpDraft(input);
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const id = pumpId ?? crypto.randomUUID();
  if (pumpId) await assertOwnedPump(workspaceId, pumpId);
  await assertPumpNameAvailable(workspaceId, draft.name, pumpId);
  await assertOriginsOwned(workspaceId, draft);
  const now = new Date().toISOString();
  const statusChangedToArchived = draft.status === 'archived';
  const statements: D1PreparedStatement[] = [
    hydraulicRevisionStatement(ownerUserId),
    pumpId
    ? db.prepare(`UPDATE irrigation_pumps SET name = ?, maximum_flow_cubic_meters_per_hour = ?,
        status = ?, archived_at = ?, notes = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`)
        .bind(draft.name, draft.maximumFlowCubicMetersPerHour, draft.status,
          statusChangedToArchived ? now : null, draft.notes, now, id, workspaceId)
    : db.prepare(`INSERT INTO irrigation_pumps
        (id, workspace_id, name, maximum_flow_cubic_meters_per_hour, status, archived_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, workspaceId, draft.name, draft.maximumFlowCubicMetersPerHour,
          draft.status, statusChangedToArchived ? now : null, draft.notes),
  ];
  if (pumpId) {
    statements.push(db.prepare('DELETE FROM irrigation_pump_origins WHERE pump_id = ? AND workspace_id = ?')
      .bind(id, workspaceId));
  }
  for (const origin of draft.origins) {
    statements.push(db.prepare(`INSERT INTO irrigation_pump_origins
      (id, workspace_id, pump_id, source_kind, resource_id, reservoir_id, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), workspaceId, id, origin.sourceKind,
        origin.resourceId, origin.reservoirId, origin.isDefault ? 1 : 0));
  }
  statements.push(auditStatement(workspaceId, id, pumpId ? 'updated' : 'created', draft, actorUserId));
  await db.batch(statements);
  return id;
}

export async function setPumpArchivedForUser(
  ownerUserId: string,
  actorUserId: string,
  pumpId: string,
  archived: boolean,
) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await assertOwnedPump(workspaceId, pumpId);
  const now = new Date().toISOString();
  await db.batch([
    hydraulicRevisionStatement(ownerUserId),
    db.prepare(`UPDATE irrigation_pumps SET status = ?, archived_at = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ?`)
      .bind(archived ? 'archived' : 'active', archived ? now : null, now, pumpId, workspaceId),
    auditStatement(workspaceId, pumpId, archived ? 'archived' : 'restored', {}, actorUserId),
  ]);
}

export async function saveEquipmentDefaultPumpForUser(
  ownerUserId: string,
  actorUserId: string,
  equipmentId: string,
  pumpId: string | null,
) {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const equipment = await db.prepare(
    'SELECT id FROM irrigation_equipment WHERE id = ? AND workspace_id = ? LIMIT 1',
  ).bind(equipmentId, workspaceId).first();
  if (!equipment) throw new Error('Matériel introuvable.');
  if (pumpId) {
    await assertOwnedPump(workspaceId, pumpId);
    const pump = await db.prepare(
      "SELECT id FROM irrigation_pumps WHERE id = ? AND workspace_id = ? AND status = 'active' LIMIT 1",
    ).bind(pumpId, workspaceId).first();
    if (!pump) throw new Error('La pompe par défaut doit être active.');
  }
  const statement = pumpId
    ? db.prepare(`INSERT INTO irrigation_equipment_pump_defaults
        (equipment_id, workspace_id, pump_id, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(equipment_id) DO UPDATE SET pump_id = excluded.pump_id,
          workspace_id = excluded.workspace_id, updated_at = excluded.updated_at`)
        .bind(equipmentId, workspaceId, pumpId, new Date().toISOString())
    : db.prepare('DELETE FROM irrigation_equipment_pump_defaults WHERE equipment_id = ? AND workspace_id = ?')
        .bind(equipmentId, workspaceId);
  await db.batch([
    statement,
    // Sans pompe (retrait de la pompe par défaut), le journal reçoit NULL : la
    // colonne est nullable et sa clé étrangère refuserait toute autre valeur.
    auditStatement(workspaceId, pumpId, 'configured', { equipmentId, pumpId }, actorUserId),
  ]);
}

async function assertOwnedPump(workspaceId: string, pumpId: string) {
  const row = await db.prepare(
    'SELECT id FROM irrigation_pumps WHERE id = ? AND workspace_id = ? LIMIT 1',
  ).bind(pumpId, workspaceId).first();
  if (!row) throw new Error('Pompe introuvable.');
}

async function assertPumpNameAvailable(workspaceId: string, name: string, excludedId: string | null) {
  const row = await db.prepare(`SELECT id FROM irrigation_pumps
    WHERE workspace_id = ? AND name = ? COLLATE NOCASE AND (? IS NULL OR id != ?) LIMIT 1`)
    .bind(workspaceId, name, excludedId, excludedId).first();
  if (row) throw new Error('Une pompe porte déjà ce nom.');
}

async function assertOriginsOwned(workspaceId: string, draft: PumpDraft) {
  for (const origin of draft.origins) {
    const table = origin.sourceKind === 'resource'
      ? 'irrigation_water_resources'
      : 'irrigation_water_reservoirs';
    const id = origin.sourceKind === 'resource' ? origin.resourceId : origin.reservoirId;
    const row = await db.prepare(`SELECT id FROM ${table} WHERE id = ? AND workspace_id = ? LIMIT 1`)
      .bind(id, workspaceId).first();
    if (!row) throw new Error('Une origine sélectionnée est introuvable.');
  }
}

function auditStatement(
  workspaceId: string,
  pumpId: string | null,
  action: 'created' | 'updated' | 'archived' | 'restored' | 'configured',
  payload: unknown,
  actorUserId: string,
) {
  return db.prepare(`INSERT INTO irrigation_pump_log
    (id, workspace_id, pump_id, action, payload, actor_user_id)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), workspaceId, pumpId, action, JSON.stringify(payload), actorUserId);
}
