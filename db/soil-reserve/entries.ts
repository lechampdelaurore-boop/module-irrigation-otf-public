import { db } from '../binding';
import { listReferenceCropsForWorkspace, type CropWaterWriteResult } from '../crop-water/references';
import { ensureWorkspaceForUser } from '../workspace-repository';
import type { SurfaceDeclaration } from '@/lib/domain/soil-reserve/bare-soil';
import type { SoilObservation } from '@/lib/domain/soil-reserve/gauge';
import { soilObservationProblems, soilObservationTimeAt, surfaceDeclarationProblems } from '@/lib/domain/soil-reserve/records';
import { rootingProfileProblems, type RootingProfile } from '@/lib/domain/soil-reserve/rooting';
import { soilRecordProblems, soilSettingsProblems, type SoilRecord, type SoilSettingsRevision } from '@/lib/domain/soil-reserve/soil';
import { isValidDateKey } from '@/lib/domain/water-management';

/**
 * Les saisies de la réserve du sol (docs/soil-reserve-contract.md, « Données
 * saisies par l'utilisateur », migration 0025) : le sol d'une parcelle ou
 * d'un jardin, les réglages de l'exploitation, le profil racinaire d'une
 * culture, une observation du curseur, l'état de surface d'une planche.
 * Chacune est une ligne nouvelle, jamais modifiée ni effacée (D-006) : la
 * plus récente vaut à partir de son jour ou de son heure. Les règles sont
 * celles du domaine ; ce dépôt n'en ajoute pas.
 */

type WriteResult<T> = CropWaterWriteResult<T>;

/** Enregistre le sol d'une parcelle (`plotId` nul) ou la valeur propre d'un jardin ou d'un abri. */
export async function addSoilRecordForUser(
  ownerUserId: string,
  record: Omit<SoilRecord, 'recordedAt'>,
  now = new Date(),
): Promise<WriteResult<SoilRecord>> {
  const problems = [
    ...soilRecordProblems(record),
    ...placeProblems(record.zoneId, record.plotId),
    ...(isValidDateKey(record.effectiveFrom) ? [] : [`Jour de la saisie invalide : ${record.effectiveFrom}.`]),
    ...(record.source.length > MAX_TEXT ? [`Source trop longue : ${MAX_TEXT} caractères au plus.`] : []),
  ];
  if (problems.length > 0) return { ok: false, problems };
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const recordedAt = now.toISOString();
  await db.prepare(
    `INSERT INTO irrigation_soil_records
       (id, workspace_id, otf_zone_id, otf_plot_id, lab_rfu_mm_per_meter, stone_share_percent, reference_share, provenance,
        sampled_depth_cm, source, tew_mm, rew_mm, surface_layer_cm, soil_depth_ceiling_m, effective_from, recorded_at, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), workspaceId, record.zoneId, record.plotId, record.labRfuMmPerMeter, record.stoneSharePercent,
    record.referenceShare, record.provenance, record.sampledDepthCm, record.source, record.tewMm, record.rewMm,
    record.surfaceLayerCm, record.soilDepthCeilingM, record.effectiveFrom, recordedAt, ownerUserId,
  ).run();
  return { ok: true, value: { ...record, recordedAt } };
}

/** Enregistre les réglages de l'exploitation : seuil d'arrosage (D-059), coefficients des états de surface, pluie sous paillage. */
export async function addSoilSettingsForUser(
  ownerUserId: string,
  revision: Omit<SoilSettingsRevision, 'recordedAt'>,
  now = new Date(),
): Promise<WriteResult<SoilSettingsRevision>> {
  const problems = [
    ...soilSettingsProblems(revision),
    ...(isValidDateKey(revision.effectiveFrom) ? [] : [`Jour des réglages invalide : ${revision.effectiveFrom}.`]),
  ];
  if (problems.length > 0) return { ok: false, problems };
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const recordedAt = now.toISOString();
  const { threshold, surface } = revision;
  await db.prepare(
    `INSERT INTO irrigation_soil_settings
       (id, workspace_id, threshold_mode, threshold_percent, permeable_tarp_evaporation, mulched_evaporation,
        green_manure_emergence_kc, green_manure_partial_kc, green_manure_full_kc, grass_kc, plastic_mulch_rain_share,
        effective_from, recorded_at, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), workspaceId, threshold.mode, threshold.mode === 'farm' ? threshold.percent : null,
    surface.permeableTarpEvaporation, surface.mulchedEvaporation, surface.greenManureEmergenceKc,
    surface.greenManurePartialKc, surface.greenManureFullKc, surface.grassKc, revision.plasticMulchRainShare,
    revision.effectiveFrom, recordedAt, ownerUserId,
  ).run();
  return { ok: true, value: { ...revision, recordedAt } };
}

/**
 * Enregistre la révision par une ferme du profil racinaire d'une de ses
 * cultures de référence, commune ou saisie par elle : sa part p et ses
 * profondeurs par stade. Le profil commun reste, avec sa source.
 */
export async function addRootingProfileForUser(
  ownerUserId: string,
  profile: Omit<RootingProfile, 'recordedAt'>,
  now = new Date(),
): Promise<WriteResult<RootingProfile>> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const crop = (await listReferenceCropsForWorkspace(workspaceId)).find((stored) => stored.crop.id === profile.referenceCropId);
  if (!crop) return { ok: false, problems: [`Culture de référence inconnue : ${profile.referenceCropId}.`] };
  const problems = [
    ...rootingProfileProblems(profile, crop.crop.name),
    ...(isValidDateKey(profile.effectiveFrom) ? [] : [`Jour du profil invalide : ${profile.effectiveFrom}.`]),
    ...(profile.source.trim() === '' || profile.source.length > MAX_TEXT || (profile.note?.length ?? 0) > MAX_TEXT
      ? [`Source obligatoire et note facultative, ${MAX_TEXT} caractères au plus.`]
      : []),
  ];
  if (problems.length > 0) return { ok: false, problems };
  const id = crypto.randomUUID();
  const recordedAt = now.toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO irrigation_soil_rooting_profiles (id, workspace_id, crop_key, p, source, note, effective_from, recorded_at, actor_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, workspaceId, profile.referenceCropId, profile.p, profile.source, profile.note, profile.effectiveFrom, recordedAt, ownerUserId),
    ...profile.stages.map((stage, index) => db.prepare(
      `INSERT INTO irrigation_soil_rooting_stages (profile_id, position, stage_rank, depth_m, end_depth_m, progression_days)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, index + 1, stage.rank, stage.depthM, stage.endDepthM, stage.progressionDays)),
  ]);
  return { ok: true, value: { ...profile, recordedAt } };
}

/** Enregistre un réglage du curseur, d'une parcelle (`plotId` nul : son plein champ) ou d'un jardin ou d'un abri. */
export async function addSoilObservationForUser(
  ownerUserId: string,
  input: Omit<SoilObservation, 'recordedAt'>,
  now = new Date(),
): Promise<WriteResult<SoilObservation>> {
  const observation = { ...input, observedAt: soilObservationTimeAt(input.observedAt, now) };
  const problems = [...soilObservationProblems(observation, now), ...placeProblems(observation.zoneId, observation.plotId)];
  if (problems.length > 0) return { ok: false, problems };
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const recordedAt = now.toISOString();
  const observedAt = new Date(observation.observedAt).toISOString();
  await db.prepare(
    `INSERT INTO irrigation_soil_observations (id, workspace_id, otf_zone_id, otf_plot_id, percent, observed_at, recorded_at, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), workspaceId, observation.zoneId, observation.plotId, observation.percent, observedAt, recordedAt, ownerUserId).run();
  return { ok: true, value: { ...observation, observedAt, recordedAt } };
}

/** Enregistre l'état de surface d'une planche sans culture à partir d'un jour ; il vaut jusqu'à la prochaine culture. */
export async function addSurfaceDeclarationForUser(
  ownerUserId: string,
  declaration: Omit<SurfaceDeclaration, 'recordedAt'>,
  now = new Date(),
): Promise<WriteResult<SurfaceDeclaration>> {
  const problems = surfaceDeclarationProblems(declaration);
  if (problems.length > 0) return { ok: false, problems };
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const recordedAt = now.toISOString();
  await db.prepare(
    `INSERT INTO irrigation_soil_surface_declarations (id, workspace_id, otf_bed_id, date, state, recorded_at, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), workspaceId, declaration.bedId, declaration.date, declaration.state, recordedAt, ownerUserId).run();
  return { ok: true, value: { ...declaration, recordedAt } };
}

const MAX_TEXT = 500;

function placeProblems(zoneId: string, plotId: string | null): string[] {
  return zoneId.trim() === '' || (plotId !== null && plotId.trim() === '') ? ['Parcelle ou jardin manquant.'] : [];
}
