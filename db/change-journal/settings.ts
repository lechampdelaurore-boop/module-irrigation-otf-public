import { DEFAULT_CROP_ALERT_SETTINGS, type CropAlertSettings } from '@/lib/domain/crop-alerts/settings';
import { FEATURE_IDS, FEATURES_BEFORE_SELECTION, type FeatureId } from '@/lib/domain/features/catalogue';
import { DEFAULT_PLANNING_SETTINGS, type PlanningSettings } from '@/lib/domain/planning/settings';
import { DEFAULT_SOIL_SETTINGS, type SoilRecord, type SoilSettings } from '@/lib/domain/soil-reserve/soil';
import type { RootingStage } from '@/lib/domain/soil-reserve/rooting';
import { EVENING_REMINDER_DEFAULT, EVENING_REMINDER_DEFAULT_TIME } from '@/lib/domain/today/evening-reminder';
import { MORNING_MESSAGE_DEFAULT } from '@/lib/domain/today/morning-message';
import type { DailyWaterLimit } from '@/lib/domain/water-management';
import type { WaterResourceLimit } from '@/lib/domain/water-resources';
import type { WeatherAlertCriterionSettings } from '@/lib/domain/weather/weather-alerts';
import {
  journalCreation,
  journalDeletion,
  journalUpdate,
  latestRevision,
  plainNumber,
  sqlLiteral,
  type JournalField,
  type JournalGesture,
  type JournalLine,
  type JournalTarget,
} from './statements';

/**
 * Les lignes du journal des modifications pour les réglages (amélioration
 * n° 7, PR 5 ; docs/ameliorations-6-2-3-7-contract.md, §5.1 ; D-286) : le
 * planning, les créneaux protégés, les limites d'eau, le sol, les alertes,
 * les fonctionnalités et les messages du téléphone.
 *
 * Chaque fonction rend l'instruction que l'écrivain place dans son lot :
 * **avant** son écriture pour un changement ou une suppression, **après**
 * pour une création (F716). L'écrivain nomme son sujet en premier argument.
 *
 * Un réglage de toute la ferme qui n'a jamais été enregistré vaut ses
 * valeurs de départ, celles du domaine (`COALESCE(current.x, <départ>)`) :
 * son premier enregistrement dit « modifié », de la valeur de départ à la
 * nouvelle. Une table de révisions se lit à sa révision la plus récente, son
 * premier enregistrement dit « créé ».
 */

type Column = { key: string; column: string };

/** Les champs lus sur la ligne `current`, sans valeur nouvelle (création, suppression). */
function read(columns: readonly Column[]): JournalField[] {
  return columns.map(({ key, column }) => ({ key, current: `current.${column}` }));
}

/** Les champs lus sur la ligne `current`, avec la valeur que l'écrivain écrit. */
function written(columns: readonly Column[], values: Readonly<Record<string, unknown>>): JournalField[] {
  return columns.map(({ key, column }) => ({ key, current: `current.${column}`, next: values[key] }));
}

/** `labRfuMmPerMeter` → `lab_rfu_mm_per_meter`. */
function snake(key: string): string {
  return key.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function columns(...keys: string[]): Column[] {
  return keys.map((key) => ({ key, column: snake(key) }));
}

// --- Le planning -----------------------------------------------------------

type Leaf = { key: string; path: string; value: unknown; start: string | number | boolean };

/** Chaque valeur des réglages du planning, aplatie : `doses.sprinkler.minimumMm` devient `dosesSprinklerMinimumMm`. */
function planningLeaves(settings: unknown, start: unknown, path: readonly string[] = []): Leaf[] {
  if (typeof start === 'object' && start !== null) {
    return Object.entries(start).flatMap(([name, value]) =>
      planningLeaves((settings as Record<string, unknown> | undefined)?.[name], value, [...path, name]));
  }
  const key = path.map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1))).join('');
  return [{ key, path: path.join('.'), value: settings, start: start as Leaf['start'] }];
}

/** Les réglages du planning, une valeur par champ ; sans enregistrement, ceux de départ (D-024). */
export function planningSettingsJournal(subject: 'reglages-du-planning', gesture: JournalGesture, settings: PlanningSettings): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: null },
    { table: 'irrigation_planning_settings', where: 'current.workspace_id = ?', params: [gesture.workspaceId] },
    planningLeaves(settings, DEFAULT_PLANNING_SETTINGS).map(({ key, path, value, start }) => ({
      key,
      current: `COALESCE(json_extract(current.payload, '$.${path}'), ${sqlLiteral(start)})`,
      next: value,
    })),
    'defaults',
  );
}

// --- Les créneaux protégés -------------------------------------------------

const SLOT_COLUMNS = columns('name', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'startMinute', 'endMinute');

function slotLine(subject: 'creneau-protege', gesture: JournalGesture, slotId: string): JournalLine {
  return { ...gesture, subject, objectId: slotId, context: { name: { sql: 'current.name' } } };
}

function slotTarget(gesture: JournalGesture, slotId: string, active: boolean): JournalTarget {
  return {
    table: 'irrigation_protected_slots',
    where: `current.id = ? AND current.workspace_id = ?${active ? " AND current.status = 'active'" : ''}`,
    params: [slotId, gesture.workspaceId],
  };
}

/** Un créneau protégé créé : placée après l'insertion. */
export function protectedSlotCreationJournal(subject: 'creneau-protege', gesture: JournalGesture, slotId: string): D1PreparedStatement {
  return journalCreation(slotLine(subject, gesture, slotId), slotTarget(gesture, slotId, false), read(SLOT_COLUMNS));
}

/** Un créneau protégé modifié, avec ses valeurs écrites (jours en 0 ou 1). */
export function protectedSlotUpdateJournal(
  subject: 'creneau-protege',
  gesture: JournalGesture,
  slotId: string,
  values: Readonly<Record<string, string | number>>,
): D1PreparedStatement {
  return journalUpdate(slotLine(subject, gesture, slotId), slotTarget(gesture, slotId, true), written(SLOT_COLUMNS, values));
}

/** Un créneau protégé supprimé : placée avant la suppression logique, à sa condition. */
export function protectedSlotDeletionJournal(subject: 'creneau-protege', gesture: JournalGesture, slotId: string): D1PreparedStatement {
  return journalDeletion(slotLine(subject, gesture, slotId), slotTarget(gesture, slotId, true), read(SLOT_COLUMNS));
}

// --- Les limites d'eau ------------------------------------------------------

/** La limite d'eau de la journée d'une saison : sa révision la plus récente. */
export function dailyWaterLimitJournal(
  subject: 'limite-d-eau-du-jour',
  gesture: JournalGesture,
  limit: Omit<DailyWaterLimit, 'id' | 'createdAt'>,
): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: null, context: { season: { value: limit.season } } },
    latestRevision('irrigation_daily_water_limit_revisions', 'workspace_id = ? AND season = ?', [gesture.workspaceId, limit.season]),
    written(columns('enabled', 'maxCubicMetersPerDay', 'validFrom', 'validUntil', 'note'), limit),
    'create',
  );
}

/** La limite de prélèvement d'une ressource : sa révision la plus récente. */
export function resourceLimitJournal(
  subject: 'limite-de-ressource',
  gesture: JournalGesture,
  resourceId: string,
  limit: Omit<WaterResourceLimit, 'id' | 'resourceId' | 'createdAt'>,
): D1PreparedStatement {
  return journalUpdate(
    {
      ...gesture,
      subject,
      objectId: resourceId,
      context: { name: { sql: '(SELECT name FROM irrigation_water_resources WHERE id = ? AND workspace_id = ?)', params: [resourceId, gesture.workspaceId] } },
    },
    latestRevision('irrigation_water_resource_limit_revisions', 'workspace_id = ? AND resource_id = ?', [gesture.workspaceId, resourceId]),
    written(columns('enabled', 'maxCubicMetersPerDay', 'validFrom', 'validUntil', 'referenceNote'), limit),
    'create',
  );
}

// --- Le sol -----------------------------------------------------------------

const SOIL_RECORD_COLUMNS = columns(
  'labRfuMmPerMeter', 'stoneSharePercent', 'referenceShare', 'provenance', 'sampledDepthCm', 'source',
  'tewMm', 'rewMm', 'surfaceLayerCm', 'soilDepthCeilingM', 'texture', 'effectiveFrom',
);

/** Le sol d'une parcelle (ou la valeur propre d'un jardin) : sa saisie la plus récente. */
export function soilRecordJournal(subject: 'sol-de-parcelle', gesture: JournalGesture, record: Omit<SoilRecord, 'recordedAt'>): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: record.plotId ?? record.zoneId, context: { zoneId: { value: record.zoneId }, plotId: { value: record.plotId } } },
    latestRevision('irrigation_soil_records', 'workspace_id = ? AND otf_zone_id = ? AND otf_plot_id IS ?', [gesture.workspaceId, record.zoneId, record.plotId], 'recorded_at DESC, rowid DESC'),
    written(SOIL_RECORD_COLUMNS, record),
    'create',
  );
}

/** Les réglages du sol de la ferme : leur saisie la plus récente, sinon ceux de départ. */
export function soilSettingsJournal(subject: 'reglages-du-sol', gesture: JournalGesture, settings: SoilSettings & { effectiveFrom: string }): D1PreparedStatement {
  const start = DEFAULT_SOIL_SETTINGS;
  const startPercent = start.threshold.mode === 'farm' ? start.threshold.percent : null;
  const values: Record<string, unknown> = {
    thresholdMode: settings.threshold.mode,
    thresholdPercent: settings.threshold.mode === 'farm' ? settings.threshold.percent : null,
    ...settings.surface,
    plasticMulchRainShare: settings.plasticMulchRainShare,
    effectiveFrom: settings.effectiveFrom,
  };
  const starts: Record<string, string | number | null> = {
    thresholdMode: start.threshold.mode,
    thresholdPercent: startPercent,
    ...start.surface,
    plasticMulchRainShare: start.plasticMulchRainShare,
    effectiveFrom: null,
  };
  return journalUpdate(
    { ...gesture, subject, objectId: null },
    latestRevision('irrigation_soil_settings', 'workspace_id = ?', [gesture.workspaceId], 'recorded_at DESC, rowid DESC'),
    Object.entries(starts).map(([key, startValue]) => ({ key, current: `COALESCE(current.${snake(key)}, ${sqlLiteral(startValue)})`, next: values[key] })),
    'defaults',
  );
}

/** Les stades d'un profil racinaire en un texte : `[[rang, profondeur, fin, jours], …]`, dans leur ordre. */
function rootingStagesText(stages: readonly RootingStage[]): string {
  return JSON.stringify(stages.map((stage) => [stage.rank, stage.depthM, stage.endDepthM, stage.progressionDays]));
}

const ROOTING_STAGES_TEXT = `('' || (SELECT json_group_array(json_array(stage_rank, ${plainNumber('depth_m')}, ${plainNumber('end_depth_m')}, progression_days))
  FROM (SELECT stage_rank, depth_m, end_depth_m, progression_days FROM irrigation_soil_rooting_stages WHERE profile_id = current.id ORDER BY position)))`;

export type RootingProfileJournal = { referenceCropId: string; p: number | null; source: string; note: string | null; effectiveFrom: string; stages: readonly RootingStage[] };

/** Le profil racinaire d'une culture de référence : la révision de la ferme la plus récente, sinon le profil commun. */
export function rootingProfileJournal(subject: 'profil-racinaire', gesture: JournalGesture, profile: RootingProfileJournal): D1PreparedStatement {
  const key = profile.referenceCropId;
  return journalUpdate(
    {
      ...gesture,
      subject,
      objectId: key,
      context: {
        name: {
          sql: '(SELECT name FROM irrigation_crop_reference_crops WHERE crop_key = ? AND (workspace_id = ? OR workspace_id IS NULL) ORDER BY workspace_id IS NULL LIMIT 1)',
          params: [key, gesture.workspaceId],
        },
      },
    },
    {
      table: 'irrigation_soil_rooting_profiles',
      where: `current.id = COALESCE(
        (SELECT id FROM irrigation_soil_rooting_profiles WHERE workspace_id = ? AND crop_key = ? ORDER BY recorded_at DESC, rowid DESC LIMIT 1),
        (SELECT id FROM irrigation_soil_rooting_profiles WHERE workspace_id IS NULL AND crop_key = ?))`,
      params: [gesture.workspaceId, key, key],
    },
    [
      { key: 'p', current: 'current.p', next: profile.p },
      { key: 'stages', current: ROOTING_STAGES_TEXT, next: rootingStagesText(profile.stages) },
      { key: 'source', current: 'current.source', next: profile.source },
      { key: 'note', current: 'current.note', next: profile.note },
      { key: 'effectiveFrom', current: 'current.effective_from', next: profile.effectiveFrom },
    ],
    'create',
  );
}

// --- Les alertes ------------------------------------------------------------

/** Une valeur de la version en vigueur d'un critère d'alerte météo. */
function criterionVersion(column: string): string {
  return `(SELECT version.${column} FROM irrigation_weather_alert_criterion_versions AS version
    WHERE version.criterion_id = current.id AND version.version = current.current_version)`;
}

const CRITERION_FIELDS: readonly { key: keyof WeatherAlertCriterionSettings; current: string }[] = [
  { key: 'active', current: 'current.active' },
  { key: 'field', current: criterionVersion('field') },
  { key: 'direction', current: criterionVersion('direction') },
  { key: 'threshold', current: criterionVersion('threshold') },
  { key: 'horizonDays', current: criterionVersion('horizon_days') },
  { key: 'label', current: criterionVersion('label') },
];

function criterionLine(subject: 'critere-meteo', gesture: JournalGesture, criterionId: string): JournalLine {
  return { ...gesture, subject, objectId: criterionId, context: { label: { sql: criterionVersion('label') } } };
}

/** Un critère d'alerte météo créé : placée après son insertion et celle de sa première version. */
export function weatherCriterionCreationJournal(subject: 'critere-meteo', gesture: JournalGesture, criterionId: string): D1PreparedStatement {
  return journalCreation(
    criterionLine(subject, gesture, criterionId),
    { table: 'irrigation_weather_alert_criteria', where: 'current.id = ? AND current.workspace_id = ?', params: [criterionId, gesture.workspaceId] },
    CRITERION_FIELDS.map(({ key, current }) => ({ key, current })),
  );
}

/** Un critère modifié, à la condition de l'écriture : la version lue reste celle d'avant. */
export function weatherCriterionUpdateJournal(
  subject: 'critere-meteo',
  gesture: JournalGesture,
  criterionId: string,
  readVersion: number,
  settings: WeatherAlertCriterionSettings,
): D1PreparedStatement {
  return journalUpdate(
    criterionLine(subject, gesture, criterionId),
    {
      table: 'irrigation_weather_alert_criteria',
      where: 'current.id = ? AND current.workspace_id = ? AND current.current_version = ? AND current.deleted_at IS NULL',
      params: [criterionId, gesture.workspaceId, readVersion],
    },
    CRITERION_FIELDS.map(({ key, current }) => ({ key, current, next: settings[key] })),
  );
}

/** Un critère supprimé : placée avant la suppression logique, à sa condition. */
export function weatherCriterionDeletionJournal(subject: 'critere-meteo', gesture: JournalGesture, criterionId: string): D1PreparedStatement {
  return journalDeletion(
    criterionLine(subject, gesture, criterionId),
    {
      table: 'irrigation_weather_alert_criteria',
      where: 'current.id = ? AND current.workspace_id = ? AND current.deleted_at IS NULL',
      params: [criterionId, gesture.workspaceId],
    },
    CRITERION_FIELDS.map(({ key, current }) => ({ key, current })),
  );
}

const CROP_ALERT_COLUMNS: Readonly<Record<keyof CropAlertSettings, string>> = {
  frostActive: 'frost_active',
  dryingActive: 'drying_active',
  sprinklerActive: 'sprinkler_active',
  horizonDays: 'horizon_days',
  frostOffsetCelsius: 'frost_offset_celsius',
  frostMarginSensitiveCelsius: 'frost_margin_sensitive_celsius',
  frostMarginHardyCelsius: 'frost_margin_hardy_celsius',
  sprinklerMaxTemperatureCelsius: 'sprinkler_max_temperature_celsius',
  sprinklerRadiationWattsPerSquareMeter: 'sprinkler_radiation_w_per_square_meter',
};

/** Les réglages des alertes par culture : leur révision la plus récente, sinon ceux du contrat. */
export function cropAlertSettingsJournal(subject: 'alertes-de-culture', gesture: JournalGesture, settings: CropAlertSettings): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: null },
    latestRevision('irrigation_crop_alert_settings', 'workspace_id = ?', [gesture.workspaceId], 'recorded_at DESC, rowid DESC'),
    (Object.keys(CROP_ALERT_COLUMNS) as (keyof CropAlertSettings)[]).map((key) => ({
      key,
      current: `COALESCE(current.${CROP_ALERT_COLUMNS[key]}, ${sqlLiteral(DEFAULT_CROP_ALERT_SETTINGS[key])})`,
      next: settings[key],
    })),
    'defaults',
  );
}

/** Le rattachement au gel d'une espèce, ou d'une seule série : sa révision la plus récente (la plus récente fait foi). */
export function frostLinkJournal(
  subject: 'seuil-de-gel',
  gesture: JournalGesture,
  link: { plantId: string; seriesId: string | null; commonKey: string | null; damageCelsius: number | null },
): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: link.seriesId ?? link.plantId, context: { plantId: { value: link.plantId }, seriesId: { value: link.seriesId } } },
    latestRevision('irrigation_crop_frost_links', 'workspace_id = ? AND plant_id = ? AND series_id IS ?', [gesture.workspaceId, link.plantId, link.seriesId], 'recorded_at DESC, id DESC'),
    written(columns('commonKey', 'damageCelsius'), link),
    'create',
  );
}

/** Le délai de séchage corrigé d'une espèce : sa révision la plus récente. */
export function dryingDaysJournal(subject: 'jours-de-sechage', gesture: JournalGesture, plantId: string, dryingDays: number | null): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: plantId, context: { plantId: { value: plantId } } },
    latestRevision('irrigation_crop_drying_revisions', 'workspace_id = ? AND plant_id = ?', [gesture.workspaceId, plantId], 'recorded_at DESC, id DESC'),
    [{ key: 'dryingDays', current: 'current.drying_days', next: dryingDays }],
    'create',
  );
}

// --- Les fonctionnalités et le téléphone -------------------------------------

/** `alertes-meteo` → `alertesMeteo` : le nom du champ d'une fonctionnalité. */
function featureFieldKey(feature: FeatureId): string {
  return feature.replaceAll(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Les cases cochées, une par fonctionnalité (0 ou 1) ; sans choix enregistré, celles d'avant le choix (R6). */
export function featureSelectionJournal(subject: 'fonctionnalites', gesture: JournalGesture, enabled: readonly FeatureId[]): D1PreparedStatement {
  const before = sqlLiteral(JSON.stringify(FEATURES_BEFORE_SELECTION));
  return journalUpdate(
    { ...gesture, subject, objectId: null },
    { table: 'irrigation_feature_selections', where: 'current.workspace_id = ?', params: [gesture.workspaceId] },
    FEATURE_IDS.map((feature) => ({
      key: featureFieldKey(feature),
      current: `EXISTS (SELECT 1 FROM json_each(COALESCE(current.enabled_features, ${before})) WHERE json_each.value = ${sqlLiteral(feature)})`,
      next: enabled.includes(feature),
    })),
    'defaults',
  );
}

const PHONE_TARGET = (gesture: JournalGesture): JournalTarget =>
  ({ table: 'irrigation_phone_notice_settings', where: 'current.workspace_id = ?', params: [gesture.workspaceId] });

/** Le message du matin, activé ou coupé ; une colonne vide vaut le défaut. */
export function morningMessageJournal(subject: 'message-du-matin', gesture: JournalGesture, enabled: boolean): D1PreparedStatement {
  return journalUpdate({ ...gesture, subject, objectId: null }, PHONE_TARGET(gesture), [
    { key: 'enabled', current: `COALESCE(current.morning_message, ${sqlLiteral(MORNING_MESSAGE_DEFAULT)})`, next: enabled },
  ], 'defaults');
}

/** Le rappel du soir, activé ou coupé, et son heure ; une colonne vide vaut le défaut. */
export function eveningReminderJournal(subject: 'rappel-du-soir', gesture: JournalGesture, setting: { enabled: boolean; time: string }): D1PreparedStatement {
  return journalUpdate({ ...gesture, subject, objectId: null }, PHONE_TARGET(gesture), [
    { key: 'enabled', current: `COALESCE(current.evening_reminder, ${sqlLiteral(EVENING_REMINDER_DEFAULT)})`, next: setting.enabled },
    { key: 'time', current: `COALESCE(current.evening_time, ${sqlLiteral(EVENING_REMINDER_DEFAULT_TIME)})`, next: setting.time },
  ], 'defaults');
}
