import {
  journalCreation,
  journalDeletion,
  journalUpdate,
  plainNumber,
  type JournalField,
  type JournalGesture,
  type JournalLine,
  type JournalTarget,
} from './statements';

/**
 * Les lignes du journal des modifications pour le matériel et les ressources
 * (amélioration n° 7, PR 6 ; docs/ameliorations-6-2-3-7-contract.md, §5.1 ;
 * D-287) : le matériel et ses réglages, les pompes, les ressources et les
 * réserves, leurs liaisons, l'alimentation par défaut et les poses.
 *
 * Un enregistrement qui crée ou modifie rend ses instructions des deux côtés
 * de son écriture : `before` (un changement, lu sur la ligne d'avant) ou
 * `after` (une création, lue sur la ligne écrite) ; l'écrivain les place
 * autour de son écriture, dans son lot (F715). Une valeur désignée par un
 * identifiant (le réglage d'une pose, la ressource d'une liaison) se garde
 * par son nom, lu en SQL des deux côtés (F720). L'écrivain nomme son sujet
 * en premier argument (F719).
 */

/** Les instructions d'un geste, de part et d'autre de son écriture. */
export type JournalAround = { before: D1PreparedStatement[]; after: D1PreparedStatement[] };

type Column = { key: string; column: string };

function snake(key: string): string {
  return key.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function columns(...keys: string[]): Column[] {
  return keys.map((key) => ({ key, column: snake(key) }));
}

function read(fields: readonly JournalField[]): JournalField[] {
  return fields.map(({ key, current }) => ({ key, current }));
}

function written(columnList: readonly Column[], values: Readonly<Record<string, unknown>>): JournalField[] {
  return columnList.map(({ key, column }) => ({ key, current: `current.${column}`, next: values[key] }));
}

/**
 * Un enregistrement « créer ou modifier » : un changement est lu avant
 * l'écriture, sur la ligne d'avant ; une création, après, sur la ligne écrite.
 */
function saved(line: JournalLine, target: JournalTarget, fields: readonly JournalField[], existing: boolean): JournalAround {
  return existing
    ? { before: [journalUpdate(line, target, fields)], after: [] }
    : { before: [], after: [journalCreation(line, target, read(fields))] };
}

const NAME_CONTEXT = { name: { sql: 'current.name' } } as const;

function owned(table: string, gesture: JournalGesture, id: string): JournalTarget {
  return { table, where: 'current.id = ? AND current.workspace_id = ?', params: [id, gesture.workspaceId] };
}

/** Le nom d'une ligne désignée par un identifiant donné : la valeur nouvelle d'un champ gardé par son nom. */
function nameOf(table: string, id: string | null, gesture: JournalGesture): JournalField['nextSql'] {
  return { sql: `SELECT name FROM ${table} WHERE id = ? AND workspace_id = ?`, params: [id, gesture.workspaceId] };
}

// --- Le matériel ------------------------------------------------------------

const EQUIPMENT_COLUMNS = columns('name', 'kind', 'mobility');

export type EquipmentJournal = { name: string; kind: string; mobility: string };

/** Un matériel créé (après son insertion) ou modifié (avant, sur la ligne active). */
export function equipmentJournal(subject: 'materiel', gesture: JournalGesture, equipmentId: string, equipment: EquipmentJournal, existing: boolean): JournalAround {
  const target = owned('irrigation_equipment', gesture, equipmentId);
  return saved(
    { ...gesture, subject, objectId: equipmentId, context: NAME_CONTEXT },
    existing ? { ...target, where: `${target.where} AND current.status = 'active'` } : target,
    written(EQUIPMENT_COLUMNS, equipment),
    existing,
  );
}

/** Un matériel copié d'un autre : sa création, avec le nom du matériel d'origine. */
export function duplicatedEquipmentJournal(subject: 'materiel', gesture: JournalGesture, equipmentId: string, sourceId: string): D1PreparedStatement {
  return journalCreation(
    {
      ...gesture,
      subject,
      objectId: equipmentId,
      context: { ...NAME_CONTEXT, copiedFrom: { sql: '(SELECT name FROM irrigation_equipment WHERE id = ? AND workspace_id = ?)', params: [sourceId, gesture.workspaceId] } },
    },
    owned('irrigation_equipment', gesture, equipmentId),
    read(written(EQUIPMENT_COLUMNS, {})),
  );
}

/** Un matériel rangé ou ressorti. */
export function equipmentArchiveJournal(subject: 'materiel', gesture: JournalGesture, equipmentId: string, archived: boolean): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: equipmentId, context: NAME_CONTEXT },
    owned('irrigation_equipment', gesture, equipmentId),
    [{ key: 'status', current: 'current.status', next: archived ? 'archived' : 'active' }],
  );
}

/** Un matériel effacé : placée avant l'effacement de ses réglages et de ses poses. */
export function equipmentDeletionJournal(subject: 'materiel', gesture: JournalGesture, equipmentId: string): D1PreparedStatement {
  return journalDeletion(
    { ...gesture, subject, objectId: equipmentId, context: NAME_CONTEXT },
    owned('irrigation_equipment', gesture, equipmentId),
    read(written([...EQUIPMENT_COLUMNS, ...columns('status')], {})),
  );
}

// --- Les réglages du matériel -----------------------------------------------

type ProfilePoint = { distanceMeters: number; rateMmPerHour: number };

/** Un profil d'aspersion en texte, `[[distance, débit], …]` par distance croissante, depuis des lignes `(distance, rate)`. */
function profileText(rows: string): string {
  return `('' || (SELECT json_group_array(json_array(${plainNumber('distance')}, ${plainNumber('rate')}))
    FROM (${rows} ORDER BY distance, rate)))`;
}

function currentProfile(side: 'left' | 'right'): string {
  return profileText(`SELECT distance_meters AS distance, rate_mm_per_hour AS rate FROM sprinkler_profile_points
    WHERE setting_id = current.id AND side = '${side}'`);
}

function nextProfile(points: readonly ProfilePoint[]): JournalField['nextSql'] {
  return {
    sql: profileText(`SELECT json_extract(value, '$[0]') AS distance, json_extract(value, '$[1]') AS rate FROM json_each(?)`),
    params: [JSON.stringify(points.map((point) => [point.distanceMeters, point.rateMmPerHour]))],
  };
}

const SETTING_RATE = `(SELECT ${plainNumber('rate_mm_per_hour')} FROM drip_setting_rates WHERE setting_id = current.id)`;

export type SettingJournal =
  | { kind: 'drip'; name: string; rateMmPerHour: number }
  | { kind: 'sprinkler'; name: string; leftProfile: readonly ProfilePoint[]; rightProfile: readonly ProfilePoint[] };

function settingFields(setting: SettingJournal): JournalField[] {
  const sprinkler = setting.kind === 'sprinkler';
  return [
    { key: 'name', current: 'current.name', next: setting.name },
    { key: 'rateMmPerHour', current: SETTING_RATE, next: sprinkler ? null : setting.rateMmPerHour },
    { key: 'leftProfile', current: currentProfile('left'), nextSql: nextProfile(sprinkler ? setting.leftProfile : []) },
    { key: 'rightProfile', current: currentProfile('right'), nextSql: nextProfile(sprinkler ? setting.rightProfile : []) },
  ];
}

function settingLine(subject: 'reglage-de-materiel', gesture: JournalGesture, settingId: string): JournalLine {
  return {
    ...gesture,
    subject,
    objectId: settingId,
    context: { equipment: { sql: '(SELECT name FROM irrigation_equipment WHERE id = current.equipment_id)' }, ...NAME_CONTEXT },
  };
}

function settingTarget(gesture: JournalGesture, settingId: string, equipmentId: string): JournalTarget {
  return {
    table: 'irrigation_equipment_settings',
    where: 'current.id = ? AND current.equipment_id = ? AND current.equipment_id IN (SELECT id FROM irrigation_equipment WHERE workspace_id = ?)',
    params: [settingId, equipmentId, gesture.workspaceId],
  };
}

/** Un réglage créé (après ses débits) ou modifié (avant l'effacement de ses anciens débits). */
export function equipmentSettingJournal(
  subject: 'reglage-de-materiel',
  gesture: JournalGesture,
  ids: { settingId: string; equipmentId: string },
  setting: SettingJournal,
  existing: boolean,
): JournalAround {
  return saved(settingLine(subject, gesture, ids.settingId), settingTarget(gesture, ids.settingId, ids.equipmentId), settingFields(setting), existing);
}

/** Un réglage effacé : placée avant l'effacement de ses débits et de ses poses. */
export function equipmentSettingDeletionJournal(subject: 'reglage-de-materiel', gesture: JournalGesture, settingId: string, equipmentId: string): D1PreparedStatement {
  return journalDeletion(settingLine(subject, gesture, settingId), settingTarget(gesture, settingId, equipmentId), read(settingFields({ kind: 'drip', name: '', rateMmPerHour: 0 })));
}

// --- Les pompes ---------------------------------------------------------------

/** Les origines d'une pompe en texte, `[[nature, nom, par défaut], …]`, depuis des lignes `(kind, resource_id, reservoir_id, is_default)`. */
function originsText(rows: string): string {
  return `('' || (SELECT json_group_array(json_array(kind, name, is_default)) FROM (
    SELECT origin.kind, COALESCE(resource.name, reservoir.name) AS name, origin.is_default
    FROM (${rows}) AS origin
    LEFT JOIN irrigation_water_resources AS resource ON resource.id = origin.resource_id
    LEFT JOIN irrigation_water_reservoirs AS reservoir ON reservoir.id = origin.reservoir_id
    ORDER BY 1, 2, 3)))`;
}

const CURRENT_ORIGINS = originsText('SELECT source_kind AS kind, resource_id, reservoir_id, is_default FROM irrigation_pump_origins WHERE pump_id = current.id');
const NEXT_ORIGINS = originsText(`SELECT json_extract(value, '$[0]') AS kind, json_extract(value, '$[1]') AS resource_id,
  json_extract(value, '$[2]') AS reservoir_id, json_extract(value, '$[3]') AS is_default FROM json_each(?)`);

export type PumpJournal = {
  name: string;
  maximumFlowCubicMetersPerHour: number;
  status: string;
  notes: string | null;
  origins: readonly { sourceKind: string; resourceId: string | null; reservoirId: string | null; isDefault: boolean }[];
};

/** Une pompe créée (après ses origines) ou modifiée (avant l'effacement de ses anciennes origines). */
export function pumpJournal(subject: 'pompe', gesture: JournalGesture, pumpId: string, pump: PumpJournal, existing: boolean): JournalAround {
  const origins = JSON.stringify(pump.origins.map((origin) => [origin.sourceKind, origin.resourceId, origin.reservoirId, origin.isDefault ? 1 : 0]));
  return saved({ ...gesture, subject, objectId: pumpId, context: NAME_CONTEXT }, owned('irrigation_pumps', gesture, pumpId), [
    ...written(columns('name', 'maximumFlowCubicMetersPerHour', 'status', 'notes'), pump),
    { key: 'origins', current: CURRENT_ORIGINS, nextSql: { sql: NEXT_ORIGINS, params: [origins] } },
  ], existing);
}

/** Une pompe rangée ou ressortie. */
export function pumpArchiveJournal(subject: 'pompe', gesture: JournalGesture, pumpId: string, archived: boolean): D1PreparedStatement {
  return journalUpdate({ ...gesture, subject, objectId: pumpId, context: NAME_CONTEXT }, owned('irrigation_pumps', gesture, pumpId), [
    { key: 'status', current: 'current.status', next: archived ? 'archived' : 'active' },
  ]);
}

/** La pompe par défaut d'un matériel, par son nom ; sans réglage, aucune. Placée avant l'écriture ou l'effacement. */
export function defaultPumpJournal(subject: 'pompe-par-defaut', gesture: JournalGesture, equipmentId: string, pumpId: string | null): D1PreparedStatement {
  return journalUpdate(
    {
      ...gesture,
      subject,
      objectId: equipmentId,
      context: { equipment: { sql: '(SELECT name FROM irrigation_equipment WHERE id = ? AND workspace_id = ?)', params: [equipmentId, gesture.workspaceId] } },
    },
    { table: 'irrigation_equipment_pump_defaults', where: 'current.equipment_id = ? AND current.workspace_id = ?', params: [equipmentId, gesture.workspaceId] },
    [{ key: 'pump', current: '(SELECT name FROM irrigation_pumps WHERE id = current.pump_id)', nextSql: nameOf('irrigation_pumps', pumpId, gesture) }],
    'defaults',
  );
}

// --- Les ressources, les réserves et leurs liaisons ----------------------------

const RESOURCE_COLUMNS = columns('name', 'type', 'nominalFlowCubicMetersPerHour', 'status', 'availableFrom', 'availableUntil', 'notes');

/** Une ressource créée (après son insertion) ou modifiée (avant). */
export function waterResourceJournal(subject: 'ressource', gesture: JournalGesture, resourceId: string, resource: Readonly<Record<string, unknown>>, existing: boolean): JournalAround {
  return saved({ ...gesture, subject, objectId: resourceId, context: NAME_CONTEXT }, owned('irrigation_water_resources', gesture, resourceId), written(RESOURCE_COLUMNS, resource), existing);
}

/** Le débit nominal d'une ressource remplacé par un débit mesuré au compteur. */
export function measuredFlowJournal(subject: 'ressource', gesture: JournalGesture, resourceId: string, flowCubicMetersPerHour: number): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: resourceId, context: { ...NAME_CONTEXT, origin: { value: 'debit-mesure' } } },
    owned('irrigation_water_resources', gesture, resourceId),
    written(columns('nominalFlowCubicMetersPerHour'), { nominalFlowCubicMetersPerHour: flowCubicMetersPerHour }),
  );
}

const RESERVOIR_COLUMNS = columns(
  'name', 'type', 'capacityCubicMeters', 'minimumSafetyCubicMeters', 'exposedSurfaceSquareMeters',
  'receivesRain', 'evaporationEnabled', 'evaporationCoefficient', 'status', 'notes',
);

/** Une réserve créée (après son insertion) ou modifiée (avant) ; son volume observé est une mesure, hors du journal. */
export function waterReservoirJournal(subject: 'reserve', gesture: JournalGesture, reservoirId: string, reservoir: Readonly<Record<string, unknown>>, existing: boolean): JournalAround {
  return saved({ ...gesture, subject, objectId: reservoirId, context: NAME_CONTEXT }, owned('irrigation_water_reservoirs', gesture, reservoirId), written(RESERVOIR_COLUMNS, reservoir), existing);
}

const RESOURCE_NAME = (column: string) => `(SELECT name FROM irrigation_water_resources WHERE id = current.${column})`;
const RESERVOIR_NAME = (column: string) => `(SELECT name FROM irrigation_water_reservoirs WHERE id = current.${column})`;

/** Une liaison d'une ressource vers une réserve, ses deux bouts par leur nom. */
export function resourceReservoirLinkJournal(
  subject: 'liaison-ressource-reserve',
  gesture: JournalGesture,
  linkId: string,
  link: { resourceId: string; reservoirId: string; fillMode: string; active: boolean },
  existing: boolean,
): JournalAround {
  return saved({ ...gesture, subject, objectId: linkId }, owned('irrigation_water_resource_reservoir_links', gesture, linkId), [
    { key: 'resource', current: RESOURCE_NAME('resource_id'), nextSql: nameOf('irrigation_water_resources', link.resourceId, gesture) },
    { key: 'reservoir', current: RESERVOIR_NAME('reservoir_id'), nextSql: nameOf('irrigation_water_reservoirs', link.reservoirId, gesture) },
    ...written(columns('fillMode', 'active'), link),
  ], existing);
}

/** Une liaison entre deux réserves, ses deux bouts par leur nom. */
export function reservoirLinkJournal(
  subject: 'liaison-entre-reserves',
  gesture: JournalGesture,
  linkId: string,
  link: { upstreamReservoirId: string; downstreamReservoirId: string; transferMode: string; active: boolean },
  existing: boolean,
): JournalAround {
  return saved({ ...gesture, subject, objectId: linkId }, owned('irrigation_water_reservoir_links', gesture, linkId), [
    { key: 'upstream', current: RESERVOIR_NAME('upstream_reservoir_id'), nextSql: nameOf('irrigation_water_reservoirs', link.upstreamReservoirId, gesture) },
    { key: 'downstream', current: RESERVOIR_NAME('downstream_reservoir_id'), nextSql: nameOf('irrigation_water_reservoirs', link.downstreamReservoirId, gesture) },
    ...written(columns('transferMode', 'active'), link),
  ], existing);
}

/** L'alimentation par défaut de la ferme, par sa nature et son nom ; sans réglage, aucune. Placée avant l'écriture ou l'effacement. */
export function defaultSupplyJournal(
  subject: 'alimentation-par-defaut',
  gesture: JournalGesture,
  supply: { sourceKind: string; resourceId: string | null; reservoirId: string | null } | null,
): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: null },
    { table: 'irrigation_water_supply_defaults', where: 'current.workspace_id = ?', params: [gesture.workspaceId] },
    [
      { key: 'sourceKind', current: 'current.source_kind', next: supply?.sourceKind ?? null },
      {
        key: 'source',
        current: `COALESCE(${RESOURCE_NAME('resource_id')}, ${RESERVOIR_NAME('reservoir_id')})`,
        nextSql: {
          sql: `SELECT COALESCE((SELECT name FROM irrigation_water_resources WHERE id = ? AND workspace_id = ?),
            (SELECT name FROM irrigation_water_reservoirs WHERE id = ? AND workspace_id = ?))`,
          params: [supply?.resourceId ?? null, gesture.workspaceId, supply?.reservoirId ?? null, gesture.workspaceId],
        },
      },
    ],
    'defaults',
  );
}

// --- Les poses ------------------------------------------------------------------

const SELECTED_BEDS = `('' || (SELECT json_group_array(otf_bed_id) FROM
  (SELECT otf_bed_id FROM irrigation_placement_selected_beds WHERE placement_id = current.id ORDER BY position)))`;

const POSE_PLACE_COLUMNS: readonly Column[] = [
  { key: 'zoneId', column: 'otf_zone_id' },
  { key: 'plotId', column: 'otf_plot_id' },
  { key: 'anchorType', column: 'anchor_type' },
  { key: 'anchorBedId', column: 'anchor_bed_otf_id' },
  { key: 'beforeBedId', column: 'before_bed_otf_id' },
  { key: 'afterBedId', column: 'after_bed_otf_id' },
  { key: 'placedAt', column: 'placed_at' },
  { key: 'removedAt', column: 'removed_at' },
];

export type PoseJournal = {
  settingId: string;
  gardenGroupId: string | null;
  zoneId: string;
  plotId: string;
  anchorType: string;
  anchorBedId: string | null;
  beforeBedId: string | null;
  afterBedId: string | null;
  placedAt: string | null;
  removedAt: string | null;
  beds: readonly string[];
};

function poseLine(subject: 'pose', gesture: JournalGesture, placementId: string): JournalLine {
  return {
    ...gesture,
    subject,
    objectId: placementId,
    context: {
      equipment: { sql: '(SELECT name FROM irrigation_equipment WHERE id = current.equipment_id)' },
      season: { sql: 'current.season' },
    },
  };
}

function poseFields(gesture: JournalGesture, pose: PoseJournal): JournalField[] {
  return [
    { key: 'setting', current: '(SELECT name FROM irrigation_equipment_settings WHERE id = current.setting_id)', nextSql: { sql: 'SELECT name FROM irrigation_equipment_settings WHERE id = ?', params: [pose.settingId] } },
    { key: 'gardenGroup', current: '(SELECT name FROM irrigation_garden_groups WHERE id = current.garden_group_id)', nextSql: nameOf('irrigation_garden_groups', pose.gardenGroupId, gesture) },
    ...written(POSE_PLACE_COLUMNS, pose),
    { key: 'beds', current: SELECTED_BEDS, next: JSON.stringify(pose.beds) },
  ];
}

/**
 * Une pose créée (après ses planches) ou changée : reposée, déplacée, ses
 * planches ou son réglage changés (avant, à la condition de l'écriture : la
 * pose telle qu'elle a été lue).
 */
export function poseJournal(subject: 'pose', gesture: JournalGesture, placementId: string, pose: PoseJournal, readUpdatedAt: string | null): JournalAround {
  const target = owned('irrigation_equipment_placements', gesture, placementId);
  return readUpdatedAt === null
    ? { before: [], after: [journalCreation(poseLine(subject, gesture, placementId), target, read(poseFields(gesture, pose)))] }
    : {
        before: [journalUpdate(poseLine(subject, gesture, placementId), { ...target, where: `${target.where} AND current.updated_at = ?`, params: [...(target.params ?? []), readUpdatedAt] }, poseFields(gesture, pose))],
        after: [],
      };
}

/** Le réglage d'une pose en place changé, sans la déplacer. */
export function poseSettingJournal(subject: 'pose', gesture: JournalGesture, placementId: string, settingId: string): D1PreparedStatement {
  const target = owned('irrigation_equipment_placements', gesture, placementId);
  return journalUpdate(poseLine(subject, gesture, placementId), { ...target, where: `${target.where} AND current.removed_at IS NULL` }, [
    { key: 'setting', current: '(SELECT name FROM irrigation_equipment_settings WHERE id = current.setting_id)', nextSql: { sql: 'SELECT name FROM irrigation_equipment_settings WHERE id = ?', params: [settingId] } },
  ]);
}

/** Une pose retirée, le matériel stocké : à la condition de l'écriture. */
export function poseRemovalJournal(subject: 'pose', gesture: JournalGesture, placementId: string, readUpdatedAt: string, removedAt: string): D1PreparedStatement {
  const target = owned('irrigation_equipment_placements', gesture, placementId);
  return journalUpdate(
    poseLine(subject, gesture, placementId),
    { ...target, where: `${target.where} AND current.removed_at IS NULL AND current.updated_at = ?`, params: [...(target.params ?? []), readUpdatedAt] },
    [{ key: 'removedAt', current: 'current.removed_at', next: removedAt }],
  );
}
