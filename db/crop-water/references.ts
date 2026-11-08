import { db } from '../binding';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../workspace-repository';
import type { ImplantationTask } from '@/lib/domain/domain';
import { farmReferenceCropProblems } from '@/lib/domain/crop-water/records';
import {
  referenceCropProblems,
  type CalendarCurve,
  type FaoPhaseLengths,
  type KcSource,
  type ReferenceCrop,
  type StageAnchor,
  type StageStart,
} from '@/lib/domain/crop-water/reference';

/**
 * Persistance des cultures de référence (docs/crop-water-need-contract.md,
 * « Le jeu de référence est une donnée », migration 0023). Le jeu commun est
 * écrit par la migration et n'est jamais modifié ici ; une ferme enregistre
 * sa propre version d'une culture commune, ou une culture qu'elle saisit, et
 * sa version remplace la commune pour elle seule.
 */

export type StoredReferenceCrop = {
  crop: ReferenceCrop;
  /** `common` : le jeu commun ; `farm` : la version de la ferme, qui remplace la commune. */
  origin: 'common' | 'farm';
  sourceUrl: string | null;
  surveyedOn: string | null;
  datesSource: string | null;
  /** Ce qui empêche d'utiliser la culture ; vide : utilisable par le calcul. */
  problems: string[];
};

export type CropWaterWriteResult<T> = { ok: true; value: T } | { ok: false; problems: string[] };

type CropRow = {
  id: string;
  crop_key: string;
  workspace_id: string | null;
  name: string;
  source: KcSource;
  curve_shape: ReferenceCrop['curve']['shape'];
  kc_initial: number | null;
  kc_mid: number | null;
  kc_end: number | null;
  abatement: number | null;
  calendar_end: string | null;
  emergence_sowing_days: number;
  emergence_planting_days: number;
  source_url: string | null;
  surveyed_on: string | null;
  dates_source: string | null;
};
type StageRow = {
  reference_id: string;
  rank: number;
  label: string;
  kc: number;
  calendar_start: string | null;
  estimated: number;
  establishment_months: number | null;
};
type SeasonRow = {
  reference_id: string;
  set_number: number;
  initial_days: number | null;
  development_days: number | null;
  mid_days: number | null;
  late_days: number | null;
};
type MonthRow = { reference_id: string; month: number; set_number: number };
type StartRow = {
  reference_id: string;
  set_number: number;
  rank: number;
  anchor: StageAnchor['from'];
  duration: number | null;
  duration_unit: 'days' | 'degree-days';
  estimated: number;
};

type CropParts = { stages: StageRow[]; seasons: SeasonRow[]; months: MonthRow[]; starts: StartRow[] };

const DEGREE_DAYS_PROBLEM = 'des durées en degrés-jours, hors de cette extension';

/**
 * Les cultures de référence d'une exploitation : le jeu commun, où chaque
 * culture dont la ferme a enregistré sa version est remplacée par elle, puis
 * ses cultures saisies, par nom.
 */
export async function listReferenceCropsForWorkspace(workspaceId: string | null): Promise<StoredReferenceCrop[]> {
  const crops = await db.prepare(
    `SELECT id, crop_key, workspace_id, name, source, curve_shape, kc_initial, kc_mid, kc_end, abatement, calendar_end,
            emergence_sowing_days, emergence_planting_days, source_url, surveyed_on, dates_source
     FROM irrigation_crop_reference_crops
     WHERE workspace_id IS NULL OR workspace_id = ?`,
  ).bind(workspaceId).all<CropRow>();
  const farmKeys = new Set(crops.results.filter((row) => row.workspace_id !== null).map((row) => row.crop_key));
  const retained = crops.results.filter((row) => row.workspace_id !== null || !farmKeys.has(row.crop_key));
  const parts = await readParts(
    `reference_id IN (SELECT id FROM irrigation_crop_reference_crops WHERE workspace_id IS NULL OR workspace_id = ?)`,
    workspaceId,
  );
  return retained
    .map((row) => storedCrop(row, parts.get(row.id) ?? { stages: [], seasons: [], months: [], starts: [] }))
    .sort((a, b) => a.crop.name.localeCompare(b.crop.name, 'fr') || a.crop.id.localeCompare(b.crop.id));
}

/** La culture commune d'une clé, telle que la migration l'a écrite, avec sa provenance ; `null` si la clé n'est pas commune. */
export async function readCommonReferenceCrop(cropKey: string): Promise<StoredReferenceCrop | null> {
  const row = await db.prepare(
    `SELECT id, crop_key, workspace_id, name, source, curve_shape, kc_initial, kc_mid, kc_end, abatement, calendar_end,
            emergence_sowing_days, emergence_planting_days, source_url, surveyed_on, dates_source
     FROM irrigation_crop_reference_crops
     WHERE workspace_id IS NULL AND crop_key = ?`,
  ).bind(cropKey).first<CropRow>();
  if (!row) return null;
  const parts = await readParts('reference_id = ?', row.id);
  return storedCrop(row, parts.get(row.id) ?? { stages: [], seasons: [], months: [], starts: [] });
}

/**
 * Enregistre la version de la ferme d'une culture commune, ou une culture
 * saisie par la ferme ; une version précédente de la ferme est remplacée,
 * d'un seul lot. Refusée, avec ses raisons, quand la culture n'est pas
 * utilisable ou qu'elle change les Kc d'une culture commune.
 */
export async function saveFarmReferenceCropForUser(
  ownerUserId: string,
  crop: ReferenceCrop,
  provenance: { sourceUrl: string | null; datesSource: string | null },
  now = new Date(),
): Promise<CropWaterWriteResult<StoredReferenceCrop>> {
  const common = (await readCommonReferenceCrop(crop.id))?.crop ?? null;
  const problems = farmReferenceCropProblems(crop, common);
  if (problems.length > 0) return { ok: false, problems };
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const id = crypto.randomUUID();
  const at = now.toISOString();
  const curve = crop.curve;
  const trapezoid = curve.shape === 'trapezoid' ? curve : null;
  const statements = [
    db.prepare(`DELETE FROM irrigation_crop_reference_crops WHERE workspace_id = ? AND crop_key = ?`).bind(workspaceId, crop.id),
    db.prepare(
      `INSERT INTO irrigation_crop_reference_crops
         (id, crop_key, workspace_id, name, source, curve_shape, kc_initial, kc_mid, kc_end, abatement, calendar_end,
          emergence_sowing_days, emergence_planting_days, source_url, surveyed_on, dates_source, actor_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
    ).bind(
      id, crop.id, workspaceId, crop.name, crop.source, curve.shape,
      trapezoid?.kcInitial ?? null, trapezoid?.kcMid ?? null, trapezoid?.kcEnd ?? null, trapezoid?.abatement ?? null,
      curve.shape === 'calendar' ? curve.end : null,
      crop.emergenceDelayDays['direct-sowing'], crop.emergenceDelayDays.planting,
      provenance.sourceUrl, provenance.datesSource, ownerUserId, at, at,
    ),
    ...partStatements(id, crop),
  ];
  await db.batch(statements);
  return {
    ok: true,
    value: { crop, origin: 'farm', sourceUrl: provenance.sourceUrl, surveyedOn: null, datesSource: provenance.datesSource, problems: [] },
  };
}

/** Retire la version de la ferme : la culture commune revient. `false` quand la ferme n'en avait pas. */
export async function deleteFarmReferenceCropForUser(ownerUserId: string, cropKey: string): Promise<boolean> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return false;
  // `meta.changes` n'est pas fiable sur D1 (db/write-result.ts) : on lit d'abord.
  const row = await db.prepare(
    `SELECT id FROM irrigation_crop_reference_crops WHERE workspace_id = ? AND crop_key = ?`,
  ).bind(workspaceId, cropKey).first<{ id: string }>();
  if (!row) return false;
  await db.prepare(`DELETE FROM irrigation_crop_reference_crops WHERE id = ? AND workspace_id = ?`).bind(row.id, workspaceId).run();
  return true;
}

function partStatements(id: string, crop: ReferenceCrop) {
  const curve = crop.curve;
  const statements = [];
  const stages = curve.shape === 'trapezoid' ? [] : curve.shape === 'steps'
    ? curve.stages.map((stage) => ({ ...stage, start: null, estimated: false, months: null }))
    : calendarStageRows(curve);
  for (const stage of stages) {
    statements.push(db.prepare(
      `INSERT INTO irrigation_crop_reference_stages (reference_id, rank, label, kc, calendar_start, estimated, establishment_months)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, stage.rank, stage.label, stage.kc, stage.start, stage.estimated ? 1 : 0, stage.months));
  }
  if (curve.shape === 'calendar') return statements;
  curve.sets.forEach((set, index) => {
    const setNumber = index + 1;
    const lengths: FaoPhaseLengths | null = curve.shape === 'trapezoid' ? curve.sets[index].value : null;
    statements.push(db.prepare(
      `INSERT INTO irrigation_crop_reference_seasons (reference_id, set_number, initial_days, development_days, mid_days, late_days)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, setNumber, lengths?.initial ?? null, lengths?.development ?? null, lengths?.mid ?? null, lengths?.late ?? null));
    for (const month of set.months) {
      statements.push(db.prepare(
        `INSERT INTO irrigation_crop_reference_season_months (reference_id, month, set_number) VALUES (?, ?, ?)`,
      ).bind(id, month, setNumber));
    }
    if (curve.shape !== 'steps') return;
    curve.sets[index].value.forEach((start, position) => {
      const anchor = start.anchor;
      statements.push(db.prepare(
        `INSERT INTO irrigation_crop_reference_stage_starts (reference_id, set_number, rank, anchor, duration, duration_unit, estimated)
         VALUES (?, ?, ?, ?, ?, 'days', ?)`,
      ).bind(id, setNumber, curve.stages[position].rank, anchor.from, 'days' in anchor ? anchor.days : null, start.estimated ? 1 : 0));
    });
  });
  return statements;
}

function calendarStageRows(curve: CalendarCurve) {
  const rows = curve.stages.map((stage) => ({ ...stage, months: null as number | null }));
  const establishment = curve.establishment;
  if (establishment === null) return rows;
  return [{ ...establishment, start: null as string | null, estimated: false }, ...rows];
}

/** Les stades, jeux de saison, mois et débuts de stade des cultures que `scope` désigne, rangés par culture. */
async function readParts(scope: string, binding: string | null): Promise<Map<string, CropParts>> {
  const parts = new Map<string, CropParts>();
  const of = (id: string) => {
    const existing = parts.get(id);
    if (existing) return existing;
    const created: CropParts = { stages: [], seasons: [], months: [], starts: [] };
    parts.set(id, created);
    return created;
  };
  const [stages, seasons, months, starts] = await db.batch([
    db.prepare(`SELECT reference_id, rank, label, kc, calendar_start, estimated, establishment_months
                FROM irrigation_crop_reference_stages WHERE ${scope} ORDER BY reference_id, rank`).bind(binding),
    db.prepare(`SELECT reference_id, set_number, initial_days, development_days, mid_days, late_days
                FROM irrigation_crop_reference_seasons WHERE ${scope} ORDER BY reference_id, set_number`).bind(binding),
    db.prepare(`SELECT reference_id, month, set_number
                FROM irrigation_crop_reference_season_months WHERE ${scope} ORDER BY reference_id, set_number, month`).bind(binding),
    db.prepare(`SELECT reference_id, set_number, rank, anchor, duration, duration_unit, estimated
                FROM irrigation_crop_reference_stage_starts WHERE ${scope} ORDER BY reference_id, set_number, rank`).bind(binding),
  ]);
  for (const row of stages.results as StageRow[]) of(row.reference_id).stages.push(row);
  for (const row of seasons.results as SeasonRow[]) of(row.reference_id).seasons.push(row);
  for (const row of months.results as MonthRow[]) of(row.reference_id).months.push(row);
  for (const row of starts.results as StartRow[]) of(row.reference_id).starts.push(row);
  return parts;
}

function storedCrop(row: CropRow, parts: CropParts): StoredReferenceCrop {
  const emergenceDelayDays: Record<ImplantationTask['kind'], number> = {
    'direct-sowing': row.emergence_sowing_days,
    planting: row.emergence_planting_days,
  };
  const crop: ReferenceCrop = { id: row.crop_key, name: row.name, source: row.source, curve: curveOf(row, parts), emergenceDelayDays };
  const problems = referenceCropProblems(crop);
  if (parts.starts.some((start) => start.duration_unit === 'degree-days')) problems.push(`${row.name} : ${DEGREE_DAYS_PROBLEM}.`);
  return {
    crop,
    origin: row.workspace_id === null ? 'common' : 'farm',
    sourceUrl: row.source_url,
    surveyedOn: row.surveyed_on,
    datesSource: row.dates_source,
    problems,
  };
}

function curveOf(row: CropRow, parts: CropParts): ReferenceCrop['curve'] {
  const monthsOf = (setNumber: number) => parts.months.filter((month) => month.set_number === setNumber).map((month) => month.month);
  if (row.curve_shape === 'trapezoid') {
    return {
      shape: 'trapezoid',
      kcInitial: row.kc_initial ?? Number.NaN,
      kcMid: row.kc_mid ?? Number.NaN,
      kcEnd: row.kc_end ?? Number.NaN,
      abatement: row.abatement ?? Number.NaN,
      sets: parts.seasons.map((season) => ({
        months: monthsOf(season.set_number),
        value: {
          initial: season.initial_days ?? Number.NaN,
          development: season.development_days ?? Number.NaN,
          mid: season.mid_days ?? Number.NaN,
          late: season.late_days ?? Number.NaN,
        },
      })),
    };
  }
  if (row.curve_shape === 'calendar') {
    const establishment = parts.stages.find((stage) => stage.establishment_months !== null);
    return {
      shape: 'calendar',
      stages: parts.stages
        .filter((stage) => stage.establishment_months === null)
        .map((stage) => ({ rank: stage.rank, label: stage.label, kc: stage.kc, start: stage.calendar_start ?? '', estimated: stage.estimated === 1 })),
      end: row.calendar_end ?? '',
      establishment: establishment
        ? { rank: establishment.rank, label: establishment.label, kc: establishment.kc, months: establishment.establishment_months ?? 0 }
        : null,
    };
  }
  const stages = parts.stages.map((stage) => ({ rank: stage.rank, label: stage.label, kc: stage.kc }));
  return {
    shape: 'steps',
    stages,
    sets: parts.seasons.map((season) => ({
      months: monthsOf(season.set_number),
      value: stages.flatMap((stage): StageStart[] => {
        const start = parts.starts.find((candidate) => candidate.set_number === season.set_number && candidate.rank === stage.rank);
        return start ? [{ anchor: anchorOf(start), estimated: start.estimated === 1 }] : [];
      }),
    })),
  };
}

function anchorOf(start: StartRow): StageAnchor {
  if (start.anchor === 'first-harvest' || start.anchor === 'mid-harvest') return { from: start.anchor };
  return { from: start.anchor, days: start.duration ?? Number.NaN };
}
