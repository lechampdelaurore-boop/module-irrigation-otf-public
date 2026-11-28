import { db } from '../binding';
import { rememberedRead } from '../request-memo';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../workspace-repository';
import { listReferenceCropsForWorkspace, type CropWaterWriteResult } from './references';
import type { Season } from '@/lib/domain/domain';
import type { KcOverride } from '@/lib/domain/crop-water/kc';
import type { ReferenceCrop } from '@/lib/domain/crop-water/reference';
import { correspondenceProblem, kcOverrideProblem, stageDeclarationProblem } from '@/lib/domain/crop-water/records';
import type { CorrespondenceEntry } from '@/lib/domain/crop-water/species';
import type { StageDeclaration } from '@/lib/domain/crop-water/stage';
import { kcOverrideJournal, speciesLinkDeletionJournal, speciesLinkJournal } from '../change-journal/crop-settings';

/**
 * Persistance des saisies de la ferme pour le besoin par culture et par
 * stade (docs/crop-water-need-contract.md, « Les données », migration 0023) :
 * les surcharges de Kc et les stades déclarés, révisions datées jamais
 * modifiées ni effacées (D-006, déclencheurs de la migration), et la
 * correspondance des espèces, par espèce avec une exception possible par
 * série. Une surcharge de Kc et un rattachement écrivent leur ligne du
 * journal des modifications dans leur lot (amélioration n° 7, D-289).
 */

type OverrideRow = {
  crop_key: string;
  stage_rank: number | null;
  fao_point: 'initial' | 'mid' | 'end' | null;
  kc: number | null;
  effective_from: string;
  recorded_at: string;
};
type LinkRow = {
  plant_id: string;
  series_id: string | null;
  target_kind: CorrespondenceEntry['target']['kind'];
  crop_key: string | null;
  analogy: number;
};
type DeclarationRow = {
  series_id: string;
  otf_bed_id: string | null;
  crop_key: string;
  stage_rank: number;
  stage_date: string;
  recorded_at: string;
};

/** Ajoute une surcharge de Kc, valable à partir de son jour ; `kc` nul : retour à la valeur de la source. */
export async function addKcOverrideForUser(
  ownerUserId: string,
  override: Omit<KcOverride, 'recordedAt'>,
  now = new Date(),
): Promise<CropWaterWriteResult<KcOverride>> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const crops = await listReferenceCropsForWorkspace(workspaceId);
  const problem = kcOverrideProblem(crops.find((stored) => stored.crop.id === override.referenceCropId)?.crop, override);
  if (problem) return { ok: false, problems: [problem] };
  const recordedAt = now.toISOString();
  await db.batch([kcOverrideJournal('kc-corrige', { workspaceId, actorUserId: ownerUserId, at: recordedAt }, override), db.prepare(
    `INSERT INTO irrigation_crop_kc_overrides (id, workspace_id, crop_key, stage_rank, fao_point, kc, effective_from, recorded_at, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), workspaceId, override.referenceCropId,
    'rank' in override.target ? override.target.rank : null,
    'fao' in override.target ? override.target.fao : null,
    override.kc, override.effectiveFrom, recordedAt, ownerUserId,
  )]);
  return { ok: true, value: { ...override, recordedAt } };
}

/** Les surcharges de Kc d'une exploitation, dans l'ordre de leur enregistrement. */
export async function listKcOverridesForWorkspace(workspaceId: string): Promise<KcOverride[]> {
  const result = await db.prepare(
    `SELECT crop_key, stage_rank, fao_point, kc, effective_from, recorded_at
     FROM irrigation_crop_kc_overrides
     WHERE workspace_id = ?
     ORDER BY recorded_at, rowid`,
  ).bind(workspaceId).all<OverrideRow>();
  return result.results.map((row) => ({
    referenceCropId: row.crop_key,
    target: row.fao_point !== null ? { fao: row.fao_point } : { rank: row.stage_rank ?? 0 },
    kc: row.kc,
    effectiveFrom: row.effective_from,
    recordedAt: row.recorded_at,
  }));
}

/**
 * Enregistre le rattachement d'une espèce, ou l'exception d'une série ; il
 * remplace le rattachement précédent au même niveau. Refusé vers une culture
 * de référence que la ferme ne connaît pas.
 */
export async function saveSpeciesCorrespondenceForUser(
  ownerUserId: string,
  entry: CorrespondenceEntry,
  now = new Date(),
): Promise<CropWaterWriteResult<CorrespondenceEntry>> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const crops = await listReferenceCropsForWorkspace(workspaceId);
  const statements = speciesCorrespondenceStatements(
    { workspaceId, ownerUserId, at: now.toISOString() },
    crops.map((stored) => stored.crop),
    entry,
  );
  if (!statements.ok) return statements;
  await db.batch(statements.value);
  return { ok: true, value: entry };
}

/**
 * Le lot que `saveSpeciesCorrespondenceForUser` envoie, pour une ferme dont
 * les cultures de référence sont déjà lues, ou ses problèmes ; il peut partir
 * avec d'autres gestes, dans leur ordre (accélérer le site, A2, D-359).
 */
export function speciesCorrespondenceStatements(
  gesture: { workspaceId: string; ownerUserId: string; at: string },
  crops: readonly ReferenceCrop[],
  entry: CorrespondenceEntry,
): CropWaterWriteResult<D1PreparedStatement[]> {
  const problem = correspondenceProblem(entry, crops);
  if (problem) return { ok: false, problems: [problem] };
  return { ok: true, value: linkStatements(gesture.workspaceId, gesture.ownerUserId, entry, gesture.at) };
}

/**
 * Rattache d'un geste les espèces que la personne a gardées parmi les
 * propositions de l'étape « Rattachez vos espèces » (4.4, F587), dans un
 * seul lot : toutes ou aucune. Refusé si l'une vise une culture que la ferme
 * ne connaît pas. Chaque espèce reçoit un rattachement d'espèce, par
 * analogie quand la proposition le dit ; les exceptions de séries ne sont
 * pas touchées.
 */
export async function linkSpeciesForUser(
  ownerUserId: string,
  links: readonly { plantId: string; referenceCropId: string; analogy: boolean }[],
  now = new Date(),
): Promise<CropWaterWriteResult<number>> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const crops = (await listReferenceCropsForWorkspace(workspaceId)).map((stored) => stored.crop);
  const entries: CorrespondenceEntry[] = links.map((link) => ({
    plantId: link.plantId,
    seriesId: null,
    target: { kind: 'reference', referenceCropId: link.referenceCropId, analogy: link.analogy },
  }));
  const problems = entries.flatMap((entry) => correspondenceProblem(entry, crops) ?? []);
  if (problems.length > 0) return { ok: false, problems: [...new Set(problems)] };
  if (entries.length === 0) return { ok: true, value: 0 };
  const at = now.toISOString();
  await db.batch(entries.flatMap((entry) => linkStatements(workspaceId, ownerUserId, entry, at)));
  return { ok: true, value: entries.length };
}

/** Retire un rattachement ou une exception de série. `false` quand il n'existait pas. */
export async function deleteSpeciesCorrespondenceForUser(
  ownerUserId: string,
  plantId: string,
  seriesId: string | null,
  now = new Date(),
): Promise<boolean> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return false;
  // `meta.changes` n'est pas fiable sur D1 (db/write-result.ts) : on lit d'abord.
  const row = await db.prepare(
    `SELECT id FROM irrigation_crop_species_links WHERE workspace_id = ? AND plant_id = ? AND series_id IS ?`,
  ).bind(workspaceId, plantId, seriesId).first<{ id: string }>();
  if (!row) return false;
  await db.batch([
    speciesLinkDeletionJournal('correspondance-d-espece', { workspaceId, actorUserId: ownerUserId, at: now.toISOString() }, plantId, seriesId),
    db.prepare(`DELETE FROM irrigation_crop_species_links WHERE workspace_id = ? AND plant_id = ? AND series_id IS ?`).bind(workspaceId, plantId, seriesId),
  ]);
  return true;
}

/**
 * La correspondance des espèces d'une exploitation : rattachements par espèce
 * et exceptions par série. Lue une fois par requête (accélérer le site, A3,
 * F1112 ; `db/request-memo.ts`).
 */
export async function listSpeciesCorrespondencesForWorkspace(workspaceId: string): Promise<CorrespondenceEntry[]> {
  return rememberedRead('species-correspondences', [workspaceId], () => listSpeciesCorrespondences(workspaceId));
}

async function listSpeciesCorrespondences(workspaceId: string): Promise<CorrespondenceEntry[]> {
  const result = await db.prepare(
    `SELECT plant_id, series_id, target_kind, crop_key, analogy
     FROM irrigation_crop_species_links
     WHERE workspace_id = ?
     ORDER BY plant_id, series_id IS NOT NULL, series_id`,
  ).bind(workspaceId).all<LinkRow>();
  return result.results.map((row) => ({
    plantId: row.plant_id,
    seriesId: row.series_id,
    target: row.target_kind === 'reference'
      ? { kind: 'reference', referenceCropId: row.crop_key ?? '', analogy: row.analogy === 1 }
      : { kind: row.target_kind },
  }));
}

/**
 * Ajoute un stade déclaré pour une série, ou pour une de ses planches, d'une
 * saison. Une déclaration n'est jamais effacée : une correction est une
 * déclaration nouvelle. Refusé pour un stade que la table de la culture ne
 * connaît pas.
 */
export async function addStageDeclarationForUser(
  ownerUserId: string,
  season: Season,
  declaration: Omit<StageDeclaration, 'recordedAt'>,
  now = new Date(),
): Promise<CropWaterWriteResult<StageDeclaration>> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const crops = await listReferenceCropsForWorkspace(workspaceId);
  const problem = stageDeclarationProblem(crops.find((stored) => stored.crop.id === declaration.referenceCropId)?.crop, declaration);
  if (problem) return { ok: false, problems: [problem] };
  const recordedAt = now.toISOString();
  await db.prepare(
    `INSERT INTO irrigation_crop_stage_declarations
       (id, workspace_id, season, series_id, otf_bed_id, crop_key, stage_rank, stage_date, recorded_at, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), workspaceId, season, declaration.seriesId, declaration.bedId,
    declaration.referenceCropId, declaration.rank, declaration.date, recordedAt, ownerUserId,
  ).run();
  return { ok: true, value: { ...declaration, recordedAt } };
}

/** Les stades déclarés d'une exploitation pour une saison, dans l'ordre de leur enregistrement. */
export async function listStageDeclarationsForWorkspace(workspaceId: string, season: Season): Promise<StageDeclaration[]> {
  const result = await db.prepare(
    `SELECT series_id, otf_bed_id, crop_key, stage_rank, stage_date, recorded_at
     FROM irrigation_crop_stage_declarations
     WHERE workspace_id = ? AND season = ?
     ORDER BY recorded_at, rowid`,
  ).bind(workspaceId, season).all<DeclarationRow>();
  return result.results.map((row) => ({
    seriesId: row.series_id,
    bedId: row.otf_bed_id,
    referenceCropId: row.crop_key,
    rank: row.stage_rank,
    date: row.stage_date,
    recordedAt: row.recorded_at,
  }));
}

/** Le rattachement d'une espèce ou d'une série remplace le précédent au même niveau ; le journal d'abord, l'avant est l'ancien. */
function linkStatements(workspaceId: string, ownerUserId: string, entry: CorrespondenceEntry, at: string) {
  const target = entry.target;
  return [
    speciesLinkJournal('correspondance-d-espece', { workspaceId, actorUserId: ownerUserId, at }, entry),
    db.prepare(`DELETE FROM irrigation_crop_species_links WHERE workspace_id = ? AND plant_id = ? AND series_id IS ?`).bind(workspaceId, entry.plantId, entry.seriesId),
    db.prepare(
      `INSERT INTO irrigation_crop_species_links (id, workspace_id, plant_id, series_id, target_kind, crop_key, analogy, actor_user_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), workspaceId, entry.plantId, entry.seriesId, target.kind,
      target.kind === 'reference' ? target.referenceCropId : null,
      target.kind === 'reference' && target.analogy ? 1 : 0,
      ownerUserId, at,
    ),
  ];
}
