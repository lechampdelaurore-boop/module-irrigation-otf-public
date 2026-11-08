import { db } from '../binding';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../workspace-repository';
import type { CropWaterWriteResult } from './references';
import type { Season } from '@/lib/domain/domain';
import {
  DEFAULT_CROP_WATER_OPTIONS,
  shadeNetProblem,
  shelterFactorSettingProblem,
  type BedWaterSettings,
  type CropWaterOptions,
  type ShadeNet,
} from '@/lib/domain/crop-water/etm';
import { isValidDateKey } from '@/lib/domain/water-management';

/**
 * Persistance des réglages du besoin par culture et par stade
 * (docs/crop-water-need-contract.md, « Les facteurs », « Les données »,
 * migration 0023) : le K_abri de chaque abri, révisions datées jamais
 * modifiées ni effacées ; le paillage plastique par planche et par saison ;
 * les filets d'ombrage, datés ; les options de la ferme, lissage et ombrage,
 * désactivées tant que rien n'est enregistré (D-054).
 */

type ShelterRevision = BedWaterSettings['shelterFactors'][number];
type MulchSetting = BedWaterSettings['mulch'][number];
export type StoredShadeNet = ShadeNet & { id: string };

/** Les réglages d'une exploitation que le calcul lit, planche par planche. */
export type CropWaterSettings = {
  shelterFactors: ShelterRevision[];
  mulch: MulchSetting[];
  shadeNets: StoredShadeNet[];
  options: CropWaterOptions;
};

/** Ajoute un K_abri pour un abri, valable à partir de son jour ; il se règle de 0,6 à 1. */
export async function addShelterFactorForUser(
  ownerUserId: string,
  revision: Omit<ShelterRevision, 'recordedAt'>,
  now = new Date(),
): Promise<CropWaterWriteResult<ShelterRevision>> {
  const problems = [
    shelterFactorSettingProblem(revision.value),
    isValidDateKey(revision.effectiveFrom) ? null : `Jour invalide : ${revision.effectiveFrom}.`,
  ].filter((problem): problem is string => problem !== null);
  if (problems.length > 0) return { ok: false, problems };
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const recordedAt = now.toISOString();
  await db.prepare(
    `INSERT INTO irrigation_crop_shelter_factors (id, workspace_id, otf_plot_id, factor, effective_from, recorded_at, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), workspaceId, revision.shelterId, revision.value, revision.effectiveFrom, recordedAt, ownerUserId).run();
  return { ok: true, value: { ...revision, recordedAt } };
}

/** Le paillage plastique d'une planche pour une saison, l'année civile ; il remplace le réglage précédent. */
export async function saveBedMulchForUser(
  ownerUserId: string,
  setting: MulchSetting,
  now = new Date(),
): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await db.prepare(
    `INSERT INTO irrigation_crop_bed_mulch (workspace_id, season, otf_bed_id, plastic_mulch, actor_user_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id, season, otf_bed_id)
     DO UPDATE SET plastic_mulch = excluded.plastic_mulch, actor_user_id = excluded.actor_user_id, updated_at = excluded.updated_at`,
  ).bind(workspaceId, setting.season, setting.bedId, setting.plasticMulch ? 1 : 0, ownerUserId, now.toISOString()).run();
}

/** Pose un filet d'ombrage sur une planche, d'un jour à un autre ; `to` nul : toujours posé. */
export async function addShadeNetForUser(
  ownerUserId: string,
  net: ShadeNet,
  now = new Date(),
): Promise<CropWaterWriteResult<StoredShadeNet>> {
  const problems = [
    shadeNetProblem(net),
    isValidDateKey(net.from) && (net.to === null || isValidDateKey(net.to)) ? null : 'Jour du filet invalide.',
  ].filter((problem): problem is string => problem !== null);
  if (problems.length > 0) return { ok: false, problems };
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO irrigation_crop_shade_nets (id, workspace_id, otf_bed_id, rate, placed_on, removed_on, actor_user_id, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, workspaceId, net.bedId, net.rate, net.from, net.to, ownerUserId, now.toISOString()).run();
  return { ok: true, value: { ...net, id } };
}

/**
 * Retire un filet d'ombrage : il reste posé jusqu'au jour dit, compris, et
 * son histoire est gardée. `null` quand le filet n'existe pas pour cette
 * exploitation ; refusé avant le jour de pose.
 */
export async function removeShadeNetForUser(
  ownerUserId: string,
  netId: string,
  removedOn: string,
): Promise<CropWaterWriteResult<StoredShadeNet> | null> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return null;
  const row = await db.prepare(
    `SELECT id, otf_bed_id, rate, placed_on FROM irrigation_crop_shade_nets WHERE id = ? AND workspace_id = ?`,
  ).bind(netId, workspaceId).first<{ id: string; otf_bed_id: string; rate: number; placed_on: string }>();
  if (!row) return null;
  const net: StoredShadeNet = { id: row.id, bedId: row.otf_bed_id, rate: row.rate, from: row.placed_on, to: removedOn };
  const problem = isValidDateKey(removedOn) ? shadeNetProblem(net) : 'Jour du filet invalide.';
  if (problem) return { ok: false, problems: [problem] };
  await db.prepare(
    `UPDATE irrigation_crop_shade_nets SET removed_on = ? WHERE id = ? AND workspace_id = ?`,
  ).bind(removedOn, netId, workspaceId).run();
  return { ok: true, value: net };
}

/** Enregistre les options de la ferme : lissage des passages de stade et ombrage. */
export async function saveCropWaterOptionsForUser(
  ownerUserId: string,
  options: CropWaterOptions,
  now = new Date(),
): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  await db.prepare(
    `INSERT INTO irrigation_crop_water_options (workspace_id, smoothing, shading, actor_user_id, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id)
     DO UPDATE SET smoothing = excluded.smoothing, shading = excluded.shading,
                   actor_user_id = excluded.actor_user_id, updated_at = excluded.updated_at`,
  ).bind(workspaceId, options.smoothing ? 1 : 0, options.shading ? 1 : 0, ownerUserId, now.toISOString()).run();
}

/** Les réglages d'une exploitation : K_abri, paillages, filets et options, désactivées par défaut. */
export async function readCropWaterSettingsForWorkspace(workspaceId: string): Promise<CropWaterSettings> {
  const [shelters, mulch, nets, options] = await db.batch([
    db.prepare(
      `SELECT otf_plot_id, factor, effective_from, recorded_at FROM irrigation_crop_shelter_factors
       WHERE workspace_id = ? ORDER BY recorded_at, rowid`,
    ).bind(workspaceId),
    db.prepare(
      `SELECT season, otf_bed_id, plastic_mulch FROM irrigation_crop_bed_mulch
       WHERE workspace_id = ? ORDER BY season, otf_bed_id`,
    ).bind(workspaceId),
    db.prepare(
      `SELECT id, otf_bed_id, rate, placed_on, removed_on FROM irrigation_crop_shade_nets
       WHERE workspace_id = ? ORDER BY placed_on, rowid`,
    ).bind(workspaceId),
    db.prepare(`SELECT smoothing, shading FROM irrigation_crop_water_options WHERE workspace_id = ?`).bind(workspaceId),
  ]);
  const optionRow = (options.results as { smoothing: number; shading: number }[])[0];
  return {
    shelterFactors: (shelters.results as { otf_plot_id: string; factor: number; effective_from: string; recorded_at: string }[])
      .map((row) => ({ shelterId: row.otf_plot_id, value: row.factor, effectiveFrom: row.effective_from, recordedAt: row.recorded_at })),
    mulch: (mulch.results as { season: Season; otf_bed_id: string; plastic_mulch: number }[])
      .map((row) => ({ bedId: row.otf_bed_id, season: row.season, plasticMulch: row.plastic_mulch === 1 })),
    shadeNets: (nets.results as { id: string; otf_bed_id: string; rate: number; placed_on: string; removed_on: string | null }[])
      .map((row) => ({ id: row.id, bedId: row.otf_bed_id, rate: row.rate, from: row.placed_on, to: row.removed_on })),
    options: optionRow
      ? { smoothing: optionRow.smoothing === 1, shading: optionRow.shading === 1 }
      : { ...DEFAULT_CROP_WATER_OPTIONS },
  };
}
