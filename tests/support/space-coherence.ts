/**
 * Le contrôle de cohérence des espaces (docs/tranche-4-contract.md, F380 ;
 * constat C1 de la revue de l'isolation du 18 novembre 2026).
 *
 * Après chaque test de `tests/db/`, il parcourt la base de test et relève
 * toute ligne qui désigne une ligne d'un autre espace : une irrigation dont
 * le matériel, le réglage, la pose ou la pompe est d'un autre espace, par
 * exemple. Le garde-fou de `tests/farm-space.test.ts` ne voit que la forme
 * des requêtes ; ce contrôle voit ce qu'elles ont écrit.
 *
 * L'espace d'une ligne est sa colonne `workspace_id` ; une table qui n'en a
 * pas prend l'espace de la ligne qu'elle complète (`OWNER`). Une ligne
 * commune à tous les espaces (`workspace_id` nul, comme une culture de
 * référence commune) peut être désignée par n'importe quel espace. Chaque
 * table et chaque colonne en `_id` doit être rangée ici : une table ou une
 * colonne nouvelle, non rangée, fait échouer le contrôle plutôt que de lui
 * échapper.
 */
import type { DatabaseSync } from 'node:sqlite';

type Reference = {
  table: string;
  columns: string[];
  target: string;
  targetColumns: string[];
  /** Une condition sur la ligne qui désigne, pour une colonne qui désigne plusieurs tables. */
  when?: string;
};

/**
 * Les tables qui n'appartiennent à aucun espace : rien de ce qu'elles gardent
 * n'est d'une ferme, ou leur clé est l'espace lui-même. Le compteur partagé
 * des appels à OTF (migration 0032, F390) compte par ferme d'OTF, pour tous
 * les espaces de la ferme : des fermes, des heures et des nombres. Le
 * raccordement d'une ferme à OTF (migration 0033, F403) a pour clé la ferme,
 * et se lit par la personne et la ferme ensemble, l'espace lui-même ; il ne
 * désigne aucune ligne d'un espace. La notification du jour de la veille de
 * l'exploitant (migration 0038, F609) : un genre, un nombre et des heures.
 * Le journal d'accès du support (migration 0041, F660) note une ferme d'OTF,
 * un jour et une raison, pour tous les espaces de la ferme ; le relevé des
 * coûts du mois (F662), des nombres du déploiement. La liste préremplie des
 * stades sensibles (migration 0045, F730) : des stades des cultures communes.
 */
const COMMON_TABLES = new Set([
  'irrigation_background_jobs',
  'irrigation_cost_readings',
  'irrigation_crop_alert_common',
  'irrigation_crop_sensitive_stage_common',
  'irrigation_operator_notices',
  'irrigation_support_accesses',
  'otf_authentication_failures',
  'otf_call_outcomes',
  'otf_call_pauses',
  'otf_call_starts',
  'otf_daily_calls',
  'otf_deployment_farm',
  'otf_farm_connections',
  'otf_farm_reads',
  'otf_snapshots',
]);

/** Les tables sans `workspace_id` : l'espace d'une ligne est celui de la ligne qu'elle complète. */
const OWNER: Record<string, { column: string; target: string }> = {
  drip_setting_rates: { column: 'setting_id', target: 'irrigation_equipment_settings' },
  sprinkler_profile_points: { column: 'setting_id', target: 'irrigation_equipment_settings' },
  irrigation_equipment_settings: { column: 'equipment_id', target: 'irrigation_equipment' },
  irrigation_event_equipment: { column: 'event_id', target: 'irrigation_events' },
  irrigation_event_log: { column: 'event_id', target: 'irrigation_events' },
  irrigation_bed_applications: { column: 'event_equipment_id', target: 'irrigation_event_equipment' },
  irrigation_garden_group_members: { column: 'group_id', target: 'irrigation_garden_groups' },
  irrigation_placement_selected_beds: { column: 'placement_id', target: 'irrigation_equipment_placements' },
  irrigation_soil_rooting_stages: { column: 'profile_id', target: 'irrigation_soil_rooting_profiles' },
  irrigation_weather_alert_criterion_versions: { column: 'criterion_id', target: 'irrigation_weather_alert_criteria' },
  irrigation_crop_reference_seasons: { column: 'reference_id', target: 'irrigation_crop_reference_crops' },
  irrigation_crop_reference_stages: { column: 'reference_id', target: 'irrigation_crop_reference_crops' },
  irrigation_crop_reference_season_months: { column: 'reference_id', target: 'irrigation_crop_reference_crops' },
  irrigation_crop_reference_stage_starts: { column: 'reference_id', target: 'irrigation_crop_reference_crops' },
};

const ROW = (table: string, column: string, target: string, when?: string): Reference =>
  ({ table, columns: [column], target, targetColumns: ['id'], when });

/** Les colonnes qui désignent une ligne sans clé étrangère déclarée. */
const UNDECLARED: Reference[] = [
  ROW('irrigation_plan_proposals', 'equipment_id', 'irrigation_equipment'),
  ROW('irrigation_plan_proposals', 'setting_id', 'irrigation_equipment_settings'),
  ROW('irrigation_plan_proposals', 'placement_id', 'irrigation_equipment_placements'),
  ROW('irrigation_plan_proposals', 'pump_id', 'irrigation_pumps'),
  ROW('irrigation_plan_proposals', 'pump_origin_id', 'irrigation_pump_origins'),
  ROW('irrigation_plan_proposals', 'validated_event_id', 'irrigation_events'),
  ROW('irrigation_plan_proposals', 'replaced_by_calculation_id', 'irrigation_plan_calculations'),
  ROW('irrigation_equipment_placement_history', 'placement_id', 'irrigation_equipment_placements'),
  ROW('irrigation_garden_groups', 'copied_from_group_id', 'irrigation_garden_groups'),
  ROW('irrigation_hydric_goal_revisions', 'copied_from_goal_id', 'irrigation_hydric_goal_revisions'),
  ROW('irrigation_water_infrastructure_log', 'entity_id', 'irrigation_water_resources', "entity_type = 'resource'"),
  ROW('irrigation_water_infrastructure_log', 'entity_id', 'irrigation_water_reservoirs', "entity_type = 'reservoir'"),
  ROW('irrigation_water_infrastructure_log', 'entity_id', 'irrigation_water_resource_reservoir_links', "entity_type = 'resource_reservoir_link'"),
  ROW('irrigation_water_infrastructure_log', 'entity_id', 'irrigation_water_reservoir_links', "entity_type = 'reservoir_link'"),
  ROW('irrigation_water_infrastructure_log', 'entity_id', 'irrigation_workspaces', "entity_type = 'supply_default'"),
];

/**
 * Les colonnes en `_id` qui ne désignent aucune ligne de la base :
 * identifiants d'Ouvre ta ferme (zones, parcelles, planches, plantes,
 * séries, cultures), personnes, identifiants choisis par le navigateur pour
 * une seule requête, identifiant d'une lecture complète et de son bail,
 * tirés par le serveur pour cette seule lecture (F362, F384).
 */
const NOT_A_ROW = /^(?:otf_[a-z]+_id|[a-z]+_bed_otf_id|actor_user_id|owner_user_id|plant_id|series_id|cultivation_id|local_id|request_id|read_id|lease_id)$/;

/**
 * Les tables qui désignent une culture de référence par sa clé (`crop_key`) :
 * une culture commune, ou une culture de leur espace (qui remplace la commune
 * de même clé), jamais une culture propre à un autre espace.
 */
const CROP_KEY_TABLES = [
  'irrigation_crop_kc_overrides',
  'irrigation_crop_sensitive_stages',
  'irrigation_crop_species_links',
  'irrigation_crop_stage_declarations',
  'irrigation_crop_etm_days',
  'irrigation_soil_rooting_profiles',
];

/**
 * Les colonnes en `_key` qui ne désignent aucune ligne : clé du cache, d'un
 * lieu météo, d'un traitement, d'un sujet d'alerte, et la ferme d'OTF dont le
 * compteur partagé compte les appels (F381).
 */
const NOT_A_ROW_KEY = /^(?:cache_key|location_key|job_key|subject_key|pace_key)$/;

const SYSTEM_TABLE = /^(?:sqlite_|_cf_|d1_migrations$|__drizzle)/;

type ForeignKeyRow = { id: number; seq: number; table: string; from: string; to: string };

export class UnclassifiedSchemaError extends Error {}

/** Les lignes qui désignent une ligne d'un autre espace, décrites une par une ; vide si tout est cohérent. */
export function crossSpaceReferences(database: DatabaseSync): string[] {
  const tables = (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
    .map(({ name }) => name)
    .filter((name) => !SYSTEM_TABLE.test(name));
  const columns = new Map(tables.map((table) => [table, columnsOf(database, table)]));
  const references = [...tables.flatMap((table) => declaredReferences(database, table)), ...UNDECLARED];
  assertClassified(tables, columns, references);

  const spaceOf = (table: string, alias: string): string | null => spaceOfRow(columns, table, alias);

  const found: string[] = [];
  for (const reference of references) {
    const childSpace = spaceOf(reference.table, 'child');
    const targetSpace = spaceOf(reference.target, 'target');
    if (childSpace === null || targetSpace === null) continue;
    const join = reference.columns
      .map((column, index) => `target."${reference.targetColumns[index]}" = child."${column}"`)
      .join(' AND ');
    const rows = database.prepare(`SELECT child.rowid AS row, ${childSpace} AS space, ${targetSpace} AS other
      FROM "${reference.table}" AS child JOIN "${reference.target}" AS target ON ${join}
      WHERE ${targetSpace} IS NOT NULL AND ${childSpace} IS NOT ${targetSpace}
      ${reference.when ? `AND child.${reference.when}` : ''}`).all() as { row: number; space: string | null; other: string }[];
    for (const { row, space, other } of rows) {
      found.push(`${reference.table}.${reference.columns.join(', ')} → ${reference.target} : la ligne ${row} de l’espace ${space ?? 'commun'} désigne une ligne de l’espace ${other}`);
    }
  }
  for (const table of CROP_KEY_TABLES) {
    const rows = database.prepare(`SELECT child.rowid AS row, child.workspace_id AS space, child.crop_key AS cropKey
      FROM "${table}" AS child
      WHERE child.crop_key IS NOT NULL
        AND EXISTS (SELECT 1 FROM irrigation_crop_reference_crops AS crop
          WHERE crop.crop_key = child.crop_key AND crop.workspace_id IS NOT NULL AND crop.workspace_id IS NOT child.workspace_id)
        AND NOT EXISTS (SELECT 1 FROM irrigation_crop_reference_crops AS crop
          WHERE crop.crop_key = child.crop_key AND (crop.workspace_id IS NULL OR crop.workspace_id IS child.workspace_id))`)
      .all() as { row: number; space: string; cropKey: string }[];
    for (const { row, space, cropKey } of rows) {
      found.push(`${table}.crop_key → irrigation_crop_reference_crops : la ligne ${row} de l’espace ${space} désigne « ${cropKey} », une culture propre à un autre espace`);
    }
  }
  return found;
}

/** L'espace d'une ligne : sa colonne `workspace_id`, sinon celui de la ligne qu'elle complète ; `null` pour une table commune. */
function spaceOfRow(columns: ReadonlyMap<string, string[]>, table: string, alias: string): string | null {
  if (COMMON_TABLES.has(table)) return null;
  if (table === 'irrigation_workspaces') return `${alias}.id`;
  if (columns.get(table)?.includes('workspace_id')) return `${alias}.workspace_id`;
  const owner = OWNER[table];
  if (!owner) throw new UnclassifiedSchemaError(`Table sans espace connu : ${table}`);
  const parent = `${alias}_up`;
  const parentSpace = spaceOfRow(columns, owner.target, parent);
  return parentSpace === null
    ? null
    : `(SELECT ${parentSpace} FROM "${owner.target}" AS ${parent} WHERE ${parent}.id = ${alias}."${owner.column}")`;
}

/**
 * L'expression SQL de l'espace d'une ligne de `table`, sous l'alias donné, ou
 * `null` pour une table commune à tous les espaces. L'essai de restauration
 * s'en sert pour lire, réinsérer et comparer les lignes d'une seule ferme
 * (docs/tranche-4-contract.md, F561, point 4 ; 10 bis.15).
 */
export function spaceExpression(database: DatabaseSync, table: string, alias: string): string | null {
  const tables = (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
    .map(({ name }) => name)
    .filter((name) => !SYSTEM_TABLE.test(name));
  return spaceOfRow(new Map(tables.map((name) => [name, columnsOf(database, name)])), table, alias);
}

function columnsOf(database: DatabaseSync, table: string): string[] {
  return (database.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(({ name }) => name);
}

function declaredReferences(database: DatabaseSync, table: string): Reference[] {
  const rows = database.prepare(`PRAGMA foreign_key_list("${table}")`).all() as ForeignKeyRow[];
  const byKey = new Map<number, ForeignKeyRow[]>();
  for (const row of rows) byKey.set(row.id, [...(byKey.get(row.id) ?? []), row]);
  return [...byKey.values()].map((key) => {
    const ordered = [...key].sort((left, right) => left.seq - right.seq);
    return { table, columns: ordered.map(({ from }) => from), target: ordered[0].table, targetColumns: ordered.map(({ to }) => to) };
  });
}

/** Chaque table a son espace, et chaque colonne en `_id` ou en `_key` est une référence connue ou n'en est pas une. */
function assertClassified(tables: string[], columns: Map<string, string[]>, references: Reference[]): void {
  const unclassified: string[] = [];
  for (const table of tables) {
    const own = columns.get(table) ?? [];
    if (!COMMON_TABLES.has(table) && table !== 'irrigation_workspaces' && !own.includes('workspace_id') && !OWNER[table]) {
      unclassified.push(`table ${table} : ni workspace_id, ni ligne qu’elle complète, ni commune`);
    }
    for (const column of own) {
      if (!isClassified(table, column, references)) {
        unclassified.push(`colonne ${table}.${column} : ni référence connue, ni identifiant extérieur`);
      }
    }
  }
  if (unclassified.length > 0) {
    throw new UnclassifiedSchemaError(`Contrôle de cohérence des espaces : à ranger dans tests/support/space-coherence.ts\n${unclassified.join('\n')}`);
  }
}

function isClassified(table: string, column: string, references: Reference[]): boolean {
  if (column.endsWith('_key')) {
    if (NOT_A_ROW_KEY.test(column)) return true;
    if (column === 'crop_key' && (table === 'irrigation_crop_reference_crops' || CROP_KEY_TABLES.includes(table))) return true;
  } else if (!column.endsWith('_id') || column === 'workspace_id' || NOT_A_ROW.test(column)) {
    return true;
  }
  return references.some((reference) => reference.table === table && reference.columns.includes(column));
}
