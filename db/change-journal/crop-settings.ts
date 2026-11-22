import { DEFAULT_CROP_WATER_OPTIONS, type CropWaterOptions } from '@/lib/domain/crop-water/etm';
import type { KcOverride } from '@/lib/domain/crop-water/kc';
import type { ReferenceCrop } from '@/lib/domain/crop-water/reference';
import type { CorrespondenceEntry } from '@/lib/domain/crop-water/species';
import { referenceCropPartRows } from '../crop-water/references';
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
 * Les lignes du journal des modifications pour les réglages du besoin par
 * culture (amélioration n° 7, F718 ; D-289) : les Kc corrigés, les cultures
 * de référence de la ferme, la correspondance des espèces, l'effet des
 * abris, le paillage plastique, les filets d'ombrage et les options.
 *
 * Mêmes règles que les autres réglages (D-286, F716) : l'instruction se place
 * dans le lot de l'écrivain, **avant** son écriture pour un changement ou une
 * suppression, **après** pour une création ; l'écrivain nomme son sujet en
 * premier argument. Une valeur désignée par une clé (une culture de
 * référence) se lit par son nom, avant comme après, en SQL dans le lot
 * (F721).
 */

/** Le nom d'une culture de référence pour une ferme : sa version à elle d'abord, sinon la commune. */
const CROP_NAME = `SELECT name FROM irrigation_crop_reference_crops WHERE crop_key = ? AND (workspace_id = ? OR workspace_id IS NULL)
  ORDER BY workspace_id IS NULL LIMIT 1`;

/** Le même nom, lu pour la clé de la ligne `current`. */
const CURRENT_CROP_NAME = `(SELECT crop.name FROM irrigation_crop_reference_crops AS crop
  WHERE crop.crop_key = current.crop_key AND (crop.workspace_id = current.workspace_id OR crop.workspace_id IS NULL)
  ORDER BY crop.workspace_id IS NULL LIMIT 1)`;

function cropName(gesture: JournalGesture, cropKey: string) {
  return { sql: `(${CROP_NAME})`, params: [cropKey, gesture.workspaceId] };
}

// --- Les Kc corrigés ----------------------------------------------------------

/** Un Kc corrigé d'une culture de référence, pour un stade ou l'un des trois Kc de la FAO : sa révision la plus récente. */
export function kcOverrideJournal(subject: 'kc-corrige', gesture: JournalGesture, override: Omit<KcOverride, 'recordedAt'>): D1PreparedStatement {
  const rank = 'rank' in override.target ? override.target.rank : null;
  const fao = 'fao' in override.target ? override.target.fao : null;
  return journalUpdate(
    {
      ...gesture,
      subject,
      objectId: override.referenceCropId,
      context: { name: cropName(gesture, override.referenceCropId), stageRank: { value: rank }, faoPoint: { value: fao } },
    },
    latestRevision(
      'irrigation_crop_kc_overrides',
      'workspace_id = ? AND crop_key = ? AND stage_rank IS ? AND fao_point IS ?',
      [gesture.workspaceId, override.referenceCropId, rank, fao],
      'recorded_at DESC, rowid DESC',
    ),
    [
      { key: 'kc', current: 'current.kc', next: override.kc },
      { key: 'effectiveFrom', current: 'current.effective_from', next: override.effectiveFrom },
    ],
    'create',
  );
}

// --- Les cultures de référence de la ferme --------------------------------------

const STAGES_TEXT = `('' || (SELECT json_group_array(json_array(rank, label, ${plainNumber('kc')}, calendar_start, estimated, establishment_months))
  FROM (SELECT rank, label, kc, calendar_start, estimated, establishment_months FROM irrigation_crop_reference_stages
    WHERE reference_id = current.id ORDER BY rank)))`;

const SEASONS_TEXT = `('' || (SELECT json_group_array(json_array(season.set_number, season.initial_days, season.development_days, season.mid_days, season.late_days,
    json((SELECT json_group_array(month) FROM (SELECT month FROM irrigation_crop_reference_season_months AS months
      WHERE months.reference_id = season.reference_id AND months.set_number = season.set_number ORDER BY month)))))
  FROM (SELECT * FROM irrigation_crop_reference_seasons WHERE reference_id = current.id ORDER BY set_number) AS season))`;

const STARTS_TEXT = `('' || (SELECT json_group_array(json_array(set_number, rank, anchor, duration, estimated))
  FROM (SELECT set_number, rank, anchor, duration, estimated FROM irrigation_crop_reference_stage_starts
    WHERE reference_id = current.id ORDER BY set_number, rank)))`;

const REFERENCE_FIELDS: readonly { key: string; current: string }[] = [
  { key: 'name', current: 'current.name' },
  { key: 'source', current: 'current.source' },
  { key: 'curveShape', current: 'current.curve_shape' },
  { key: 'kcInitial', current: 'current.kc_initial' },
  { key: 'kcMid', current: 'current.kc_mid' },
  { key: 'kcEnd', current: 'current.kc_end' },
  { key: 'abatement', current: 'current.abatement' },
  { key: 'calendarEnd', current: 'current.calendar_end' },
  { key: 'emergenceSowingDays', current: 'current.emergence_sowing_days' },
  { key: 'emergencePlantingDays', current: 'current.emergence_planting_days' },
  { key: 'sourceUrl', current: 'current.source_url' },
  { key: 'datesSource', current: 'current.dates_source' },
  { key: 'stages', current: STAGES_TEXT },
  { key: 'seasons', current: SEASONS_TEXT },
  { key: 'starts', current: STARTS_TEXT },
];

/** Les valeurs d'une culture de référence, comme la ferme les écrit et comme le journal les relit (mêmes textes en JSON). */
function referenceValues(crop: ReferenceCrop, provenance: { sourceUrl: string | null; datesSource: string | null }): Record<string, unknown> {
  const curve = crop.curve;
  const trapezoid = curve.shape === 'trapezoid' ? curve : null;
  const rows = referenceCropPartRows(crop);
  return {
    name: crop.name,
    source: crop.source,
    curveShape: curve.shape,
    kcInitial: trapezoid?.kcInitial ?? null,
    kcMid: trapezoid?.kcMid ?? null,
    kcEnd: trapezoid?.kcEnd ?? null,
    abatement: trapezoid?.abatement ?? null,
    calendarEnd: curve.shape === 'calendar' ? curve.end : null,
    emergenceSowingDays: crop.emergenceDelayDays['direct-sowing'],
    emergencePlantingDays: crop.emergenceDelayDays.planting,
    sourceUrl: provenance.sourceUrl,
    datesSource: provenance.datesSource,
    stages: JSON.stringify([...rows.stages].sort((a, b) => a.rank - b.rank)
      .map((stage) => [stage.rank, stage.label, stage.kc, stage.start, stage.estimated ? 1 : 0, stage.months])),
    seasons: JSON.stringify([...rows.seasons].sort((a, b) => a.setNumber - b.setNumber).map((season) => [
      season.setNumber, season.lengths?.initial ?? null, season.lengths?.development ?? null, season.lengths?.mid ?? null, season.lengths?.late ?? null,
      [...season.months].sort((a, b) => a - b),
    ])),
    starts: JSON.stringify([...rows.starts].sort((a, b) => a.setNumber - b.setNumber || a.rank - b.rank)
      .map((start) => [start.setNumber, start.rank, start.anchor, start.duration, start.estimated ? 1 : 0])),
  };
}

function farmVersion(gesture: JournalGesture, cropKey: string): JournalTarget {
  return { table: 'irrigation_crop_reference_crops', where: 'current.workspace_id = ? AND current.crop_key = ?', params: [gesture.workspaceId, cropKey] };
}

/** La version de la ferme d'une culture de référence, enregistrée : créée la première fois, modifiée ensuite. Placée avant le remplacement. */
export function farmReferenceCropJournal(
  subject: 'culture-de-reference',
  gesture: JournalGesture,
  crop: ReferenceCrop,
  provenance: { sourceUrl: string | null; datesSource: string | null },
): D1PreparedStatement {
  const values = referenceValues(crop, provenance);
  return journalUpdate(
    { ...gesture, subject, objectId: crop.id, context: { name: { value: crop.name } } },
    farmVersion(gesture, crop.id),
    REFERENCE_FIELDS.map(({ key, current }) => ({ key, current, next: values[key] })),
    'create',
  );
}

/** La version de la ferme retirée : la culture commune revient, s'il y en a une. Placée avant l'effacement. */
export function farmReferenceCropDeletionJournal(subject: 'culture-de-reference', gesture: JournalGesture, cropKey: string): D1PreparedStatement {
  return journalDeletion(
    { ...gesture, subject, objectId: cropKey, context: { name: { sql: 'current.name' } } },
    farmVersion(gesture, cropKey),
    REFERENCE_FIELDS.map(({ key, current }) => ({ key, current })),
  );
}

// --- La correspondance des espèces ----------------------------------------------

function linkLine(subject: 'correspondance-d-espece', gesture: JournalGesture, plantId: string, seriesId: string | null): JournalLine {
  return { ...gesture, subject, objectId: seriesId ?? plantId, context: { plantId: { value: plantId }, seriesId: { value: seriesId } } };
}

function linkTarget(gesture: JournalGesture, plantId: string, seriesId: string | null): JournalTarget {
  return {
    table: 'irrigation_crop_species_links',
    where: 'current.workspace_id = ? AND current.plant_id = ? AND current.series_id IS ?',
    params: [gesture.workspaceId, plantId, seriesId],
  };
}

const LINK_FIELDS: readonly { key: string; current: string }[] = [
  { key: 'targetKind', current: 'current.target_kind' },
  { key: 'referenceCrop', current: CURRENT_CROP_NAME },
  { key: 'analogy', current: 'current.analogy' },
];

/** Le rattachement d'une espèce, ou l'exception d'une série : il remplace le précédent au même niveau. Placée avant le remplacement. */
export function speciesLinkJournal(subject: 'correspondance-d-espece', gesture: JournalGesture, entry: CorrespondenceEntry): D1PreparedStatement {
  const target = entry.target;
  const cropKey = target.kind === 'reference' ? target.referenceCropId : null;
  const fields: JournalField[] = [
    { ...LINK_FIELDS[0], next: target.kind },
    { ...LINK_FIELDS[1], nextSql: { sql: CROP_NAME, params: [cropKey, gesture.workspaceId] } },
    { ...LINK_FIELDS[2], next: target.kind === 'reference' && target.analogy },
  ];
  return journalUpdate(linkLine(subject, gesture, entry.plantId, entry.seriesId), linkTarget(gesture, entry.plantId, entry.seriesId), fields, 'create');
}

/** Un rattachement ou une exception retirée. Placée avant l'effacement. */
export function speciesLinkDeletionJournal(
  subject: 'correspondance-d-espece',
  gesture: JournalGesture,
  plantId: string,
  seriesId: string | null,
): D1PreparedStatement {
  return journalDeletion(linkLine(subject, gesture, plantId, seriesId), linkTarget(gesture, plantId, seriesId), LINK_FIELDS);
}

// --- Les abris, le paillage, les filets et les options ----------------------------

/** L'effet d'un abri (K_abri), révision datée : sa révision la plus récente. */
export function shelterFactorJournal(
  subject: 'k-abri',
  gesture: JournalGesture,
  revision: { shelterId: string; value: number; effectiveFrom: string },
): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: revision.shelterId, context: { plotId: { value: revision.shelterId } } },
    latestRevision('irrigation_crop_shelter_factors', 'workspace_id = ? AND otf_plot_id = ?', [gesture.workspaceId, revision.shelterId], 'recorded_at DESC, rowid DESC'),
    [
      { key: 'factor', current: 'current.factor', next: revision.value },
      { key: 'effectiveFrom', current: 'current.effective_from', next: revision.effectiveFrom },
    ],
    'create',
  );
}

/** Le paillage plastique d'une planche pour une saison ; sans réglage, pas de paillage. */
export function bedMulchJournal(
  subject: 'paillage-plastique',
  gesture: JournalGesture,
  setting: { bedId: string; season: number; plasticMulch: boolean },
): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: setting.bedId, context: { bedId: { value: setting.bedId }, season: { value: setting.season } } },
    {
      table: 'irrigation_crop_bed_mulch',
      where: 'current.workspace_id = ? AND current.season = ? AND current.otf_bed_id = ?',
      params: [gesture.workspaceId, setting.season, setting.bedId],
    },
    [{ key: 'plasticMulch', current: 'COALESCE(current.plastic_mulch, 0)', next: setting.plasticMulch }],
    'defaults',
  );
}

function shadeNetLine(subject: 'filet-d-ombrage', gesture: JournalGesture, netId: string): JournalLine {
  return { ...gesture, subject, objectId: netId, context: { bedId: { sql: 'current.otf_bed_id' } } };
}

function shadeNetTarget(gesture: JournalGesture, netId: string): JournalTarget {
  return { table: 'irrigation_crop_shade_nets', where: 'current.id = ? AND current.workspace_id = ?', params: [netId, gesture.workspaceId] };
}

/** Un filet d'ombrage posé : placée après l'insertion. */
export function shadeNetCreationJournal(subject: 'filet-d-ombrage', gesture: JournalGesture, netId: string): D1PreparedStatement {
  return journalCreation(shadeNetLine(subject, gesture, netId), shadeNetTarget(gesture, netId), [
    { key: 'rate', current: 'current.rate' },
    { key: 'placedOn', current: 'current.placed_on' },
    { key: 'removedOn', current: 'current.removed_on' },
  ]);
}

/** Un filet d'ombrage retiré à un jour dit : son histoire est gardée, la ligne dit le jour du retrait. */
export function shadeNetRemovalJournal(subject: 'filet-d-ombrage', gesture: JournalGesture, netId: string, removedOn: string): D1PreparedStatement {
  return journalUpdate(shadeNetLine(subject, gesture, netId), shadeNetTarget(gesture, netId), [
    { key: 'removedOn', current: 'current.removed_on', next: removedOn },
  ]);
}

/** Les options du besoin par culture ; sans enregistrement, désactivées (D-054). */
export function cropWaterOptionsJournal(subject: 'options-du-besoin', gesture: JournalGesture, options: CropWaterOptions): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: null },
    { table: 'irrigation_crop_water_options', where: 'current.workspace_id = ?', params: [gesture.workspaceId] },
    (['smoothing', 'shading'] as const).map((key) => ({
      key,
      current: `COALESCE(current.${key}, ${sqlLiteral(DEFAULT_CROP_WATER_OPTIONS[key])})`,
      next: options[key],
    })),
    'defaults',
  );
}
