import { db } from './binding';
import { aEcritUneLigne } from './write-result';
import type {
  GardenBedOrder,
  ValidGardenGroupInput,
} from '@/lib/domain/garden-group-domain';
import type {
  GardenGroupConfiguration,
  GardenGroupMemberRecord,
  GardenGroupRecord,
} from '@/lib/domain/garden-group-record';

export type AvailableGardenReference = {
  otfZoneId: string;
  otfPlotId: string;
};

type GroupRow = {
  id: string;
  name: string;
  position: number;
  copied_from_group_id: string | null;
};

type MemberRow = {
  group_id: string;
  otf_zone_id: string;
  otf_plot_id: string;
  position: number;
  bed_order: GardenBedOrder;
  gap_before_meters: number;
};

export async function listGardenGroupConfigurationForUser(
  ownerUserId: string,
  season: number,
  availableGardens: readonly AvailableGardenReference[],
): Promise<GardenGroupConfiguration> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return { groups: [], copiedFromSeason: null };

  const [groups, marker] = await Promise.all([
    loadGroups(workspaceId, season),
    loadSeasonMarker(workspaceId, season),
  ]);
  if (groups.length > 0) {
    if (!marker) await insertSeasonMarker(workspaceId, season, null);
    return {
      groups,
      copiedFromSeason: marker?.copied_from_season ?? null,
    };
  }
  if (marker) {
    return { groups: [], copiedFromSeason: marker.copied_from_season };
  }

  const previousSeason = season - 1;
  const previousGroups = await loadGroups(workspaceId, previousSeason);
  if (previousGroups.length === 0) {
    return { groups: [], copiedFromSeason: null };
  }

  const currentGardens = new Map(
    availableGardens.map((garden) => [garden.otfPlotId, garden.otfZoneId]),
  );
  const copies = previousGroups
    .map((group) => ({
      source: group,
      id: crypto.randomUUID(),
      members: group.members
        .filter((member) => currentGardens.has(member.otfPlotId))
        .map((member, index) => ({
          ...member,
          otfZoneId: currentGardens.get(member.otfPlotId)!,
          position: index + 1,
          gapBeforeMeters: index === 0 ? 0 : member.gapBeforeMeters,
        })),
    }))
    .filter((copy) => copy.members.length >= 2);

  const database = db;
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `INSERT INTO irrigation_season_geometry (
           workspace_id, season, copied_from_season, updated_at
         ) VALUES (?, ?, ?, ?)`,
      )
      .bind(workspaceId, season, previousSeason, now),
  ];

  copies.forEach((copy, groupIndex) => {
    statements.push(
      database
        .prepare(
          `INSERT INTO irrigation_garden_groups (
             id, workspace_id, season, name, position,
             copied_from_group_id, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          copy.id,
          workspaceId,
          season,
          copy.source.name,
          groupIndex + 1,
          copy.source.id,
          now,
        ),
    );
    copy.members.forEach((member) => {
      statements.push(
        database
          .prepare(
            `INSERT INTO irrigation_garden_group_members (
               group_id, otf_zone_id, otf_plot_id, position,
               bed_order, gap_before_meters, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            copy.id,
            member.otfZoneId,
            member.otfPlotId,
            member.position,
            member.bedOrder,
            member.gapBeforeMeters,
            now,
          ),
      );
    });
  });

  try {
    await database.batch(statements);
  } catch (error) {
    const concurrentMarker = await loadSeasonMarker(workspaceId, season);
    if (!concurrentMarker) throw error;
  }

  return {
    groups: await loadGroups(workspaceId, season),
    copiedFromSeason: previousSeason,
  };
}

export async function saveGardenGroupForUser(
  ownerUserId: string,
  groupId: string | null,
  group: ValidGardenGroupInput,
): Promise<string | null> {
  const workspaceId = await ensureWorkspace(ownerUserId);
  const currentGroups = await loadGroups(workspaceId, group.season);
  const editedGroup = groupId
    ? currentGroups.find((item) => item.id === groupId)
    : null;
  if (groupId && !editedGroup) return null;

  const duplicateName = currentGroups.some(
    (item) =>
      item.id !== groupId &&
      item.name.localeCompare(group.name, 'fr-FR', {
        sensitivity: 'base',
      }) === 0,
  );
  if (duplicateName) throw new GardenGroupNameAlreadyExistsError(group.name);

  const occupiedPlotIds = new Set(
    currentGroups
      .filter((item) => item.id !== groupId)
      .flatMap((item) => item.members.map((member) => member.otfPlotId)),
  );
  const conflictingMember = group.members.find((member) =>
    occupiedPlotIds.has(member.otfPlotId),
  );
  if (conflictingMember) {
    throw new GardenAlreadyGroupedError();
  }

  const savedGroupId = groupId ?? crypto.randomUUID();
  const position =
    editedGroup?.position ??
    currentGroups.reduce((highest, item) => Math.max(highest, item.position), 0) + 1;
  const now = new Date().toISOString();
  const database = db;
  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `INSERT OR IGNORE INTO irrigation_season_geometry (
           workspace_id, season, copied_from_season, updated_at
         ) VALUES (?, ?, NULL, ?)`,
      )
      .bind(workspaceId, group.season, now),
  ];

  if (groupId) {
    statements.push(
      database
        .prepare(
          `UPDATE irrigation_garden_groups
           SET name = ?, updated_at = ?
           WHERE id = ? AND workspace_id = ? AND season = ?`,
        )
        .bind(group.name, now, savedGroupId, workspaceId, group.season),
    );
  } else {
    statements.push(
      database
        .prepare(
          `INSERT INTO irrigation_garden_groups (
             id, workspace_id, season, name, position, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          savedGroupId,
          workspaceId,
          group.season,
          group.name,
          position,
          now,
        ),
    );
  }

  statements.push(
    database
      .prepare('DELETE FROM irrigation_garden_group_members WHERE group_id = ?')
      .bind(savedGroupId),
  );
  group.members.forEach((member) => {
    statements.push(
      database
        .prepare(
          `INSERT INTO irrigation_garden_group_members (
             group_id, otf_zone_id, otf_plot_id, position,
             bed_order, gap_before_meters, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          savedGroupId,
          member.otfZoneId,
          member.otfPlotId,
          member.position,
          member.bedOrder,
          member.gapBeforeMeters,
          now,
        ),
    );
  });

  await database.batch(statements);
  return savedGroupId;
}

export async function deleteGardenGroupForUser(
  ownerUserId: string,
  season: number,
  groupId: string,
): Promise<boolean> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return false;

  const ownedGroup = await db.prepare(
    `SELECT id FROM irrigation_garden_groups
     WHERE id = ? AND workspace_id = ? AND season = ? LIMIT 1`,
  )
    .bind(groupId, workspaceId, season)
    .first<{ id: string }>();
  if (!ownedGroup) return false;

  const database = db;
  const results = await database.batch([
    database
      .prepare(
        `UPDATE irrigation_equipment_placements
         SET garden_group_id = NULL, updated_at = ?
         WHERE garden_group_id = ? AND workspace_id = ? AND season = ?`,
      )
      .bind(new Date().toISOString(), groupId, workspaceId, season),
    database
      .prepare('DELETE FROM irrigation_garden_group_members WHERE group_id = ?')
      .bind(groupId),
    database
      .prepare(
        `DELETE FROM irrigation_garden_groups
         WHERE id = ? AND workspace_id = ? AND season = ?`,
      )
      .bind(groupId, workspaceId, season),
  ]);

  return aEcritUneLigne(results.at(-1)?.meta);
}

async function loadGroups(
  workspaceId: string,
  season: number,
): Promise<GardenGroupRecord[]> {
  const database = db;
  const [groupResult, memberResult] = await Promise.all([
    database
      .prepare(
        `SELECT id, name, position, copied_from_group_id
         FROM irrigation_garden_groups
         WHERE workspace_id = ? AND season = ?
         ORDER BY position`,
      )
      .bind(workspaceId, season)
      .all<GroupRow>(),
    database
      .prepare(
        `SELECT
           members.group_id,
           members.otf_zone_id,
           members.otf_plot_id,
           members.position,
           members.bed_order,
           members.gap_before_meters
         FROM irrigation_garden_group_members AS members
         INNER JOIN irrigation_garden_groups AS groups
           ON groups.id = members.group_id
         WHERE groups.workspace_id = ? AND groups.season = ?
         ORDER BY members.group_id, members.position`,
      )
      .bind(workspaceId, season)
      .all<MemberRow>(),
  ]);

  const membersByGroup = new Map<string, GardenGroupMemberRecord[]>();
  memberResult.results.forEach((row) => {
    const members = membersByGroup.get(row.group_id) ?? [];
    members.push({
      otfZoneId: row.otf_zone_id,
      otfPlotId: row.otf_plot_id,
      position: Number(row.position),
      bedOrder: row.bed_order,
      gapBeforeMeters: Number(row.gap_before_meters),
    });
    membersByGroup.set(row.group_id, members);
  });

  return groupResult.results.map((row) => ({
    id: row.id,
    name: row.name,
    position: Number(row.position),
    copiedFromGroupId: row.copied_from_group_id,
    members: membersByGroup.get(row.id) ?? [],
  }));
}

async function loadSeasonMarker(workspaceId: string, season: number) {
  return db.prepare(
    `SELECT copied_from_season
     FROM irrigation_season_geometry
     WHERE workspace_id = ? AND season = ? LIMIT 1`,
  )
    .bind(workspaceId, season)
    .first<{ copied_from_season: number | null }>();
}

async function insertSeasonMarker(
  workspaceId: string,
  season: number,
  copiedFromSeason: number | null,
) {
  await db.prepare(
    `INSERT OR IGNORE INTO irrigation_season_geometry (
       workspace_id, season, copied_from_season, updated_at
     ) VALUES (?, ?, ?, ?)`,
  )
    .bind(workspaceId, season, copiedFromSeason, new Date().toISOString())
    .run();
}

async function ensureWorkspace(ownerUserId: string): Promise<string> {
  const existingId = await findWorkspaceId(ownerUserId);
  if (existingId) return existingId;

  const workspaceId = crypto.randomUUID();
  try {
    await db.prepare(
      'INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES (?, ?)',
    )
      .bind(workspaceId, ownerUserId)
      .run();
    return workspaceId;
  } catch (error) {
    const concurrentId = await findWorkspaceId(ownerUserId);
    if (concurrentId) return concurrentId;
    throw error;
  }
}

async function findWorkspaceId(ownerUserId: string): Promise<string | null> {
  const row = await db.prepare(
    `SELECT id FROM irrigation_workspaces
     WHERE owner_user_id = ? AND otf_farm_id IS NULL LIMIT 1`,
  )
    .bind(ownerUserId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export class GardenGroupNameAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Un groupe nommé « ${name} » existe déjà pour cette saison.`);
    this.name = 'GardenGroupNameAlreadyExistsError';
  }
}

export class GardenAlreadyGroupedError extends Error {
  constructor() {
    super('Un des jardins sélectionnés appartient déjà à un autre groupe.');
    this.name = 'GardenAlreadyGroupedError';
  }
}
