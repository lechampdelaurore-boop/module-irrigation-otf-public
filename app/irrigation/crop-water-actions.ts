'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { saveAdoptedGoalForUser } from '@/db/crop-water/adoptions';
import { addKcOverrideForUser, addStageDeclarationForUser, deleteSpeciesCorrespondenceForUser, saveSpeciesCorrespondenceForUser } from '@/db/crop-water/entries';
import { addShadeNetForUser, addShelterFactorForUser, removeShadeNetForUser, saveBedMulchForUser, saveCropWaterOptionsForUser } from '@/db/crop-water/settings';
import { addRootingProfileForUser } from '@/db/soil-reserve/entries';
import type { RootingStage } from '@/lib/domain/soil-reserve/rooting';
import { overrideTargetOfKey } from '@/lib/domain/crop-water/settings-view';
import { adoptionRevision } from '@/lib/domain/crop-water/proposal';
import { dateKeyInTimeZone, FARM_TIME_ZONE, isValidDateKey } from '@/lib/domain/water-management';
import { getBedCropWaterSheetForUser, type BedCropWaterSheet } from '@/lib/services/crop-water-bed';
import { getSeriesCropWaterSheetForUser, type SeriesCropWaterSheet } from '@/lib/services/crop-water-series';
import { recalculatePlanAfterEvent } from '@/lib/services/planning-recalculation';
import type { CorrespondenceEntry } from '@/lib/domain/crop-water/species';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import { getCropCoefficientsViewForUser, type CropCoefficientsView } from '@/lib/services/crop-water-coefficients';
import { resetFarmDurationsForUser, saveFarmDurationsForUser } from '@/lib/services/crop-water-durations';
import type { FarmDurations } from '@/lib/domain/crop-water/farm-durations';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';

/**
 * Les actions de la page « Coefficients culturaux » (5 quater, PR 3) : la
 * correspondance des espèces, par espèce ou par série. Une espèce ou une
 * série doit appartenir au plan de culture de la saison lu chez Ouvre ta
 * ferme ; la culture de référence, aux cultures que la ferme connaît (règle
 * du dépôt, `correspondenceProblem`). Depuis la PR 3c : les surcharges de Kc
 * et les réglages du calcul, chacun vérifié par la règle du dépôt. Depuis
 * la PR 3e : les durées propres à la ferme. Depuis la 5 ter (PR 3c) : le
 * profil racinaire d'une culture, en révision datée.
 */

export type CropWaterActionResult =
  | { ok: true; message: string; view: CropCoefficientsView }
  | { ok: false; message: string };

type Target = CorrespondenceEntry['target'];

export async function saveSpeciesCorrespondenceAction(input: {
  season: number;
  plantId: string;
  seriesId: string | null;
  target: Target;
}): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const problem = scopeProblem(snapshot, input.season, input.plantId, input.seriesId) ?? targetProblem(input.target);
    if (problem) return { ok: false, message: problem };
    const result = await saveSpeciesCorrespondenceForUser(ownerUserId, {
      plantId: input.plantId,
      seriesId: input.seriesId,
      target: normalizedTarget(input.target),
    });
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: input.seriesId === null ? 'Le rattachement de l’espèce est enregistré.' : 'L’exception de la série est enregistrée.',
      view: await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

export async function deleteSpeciesCorrespondenceAction(input: {
  season: number;
  plantId: string;
  seriesId: string | null;
}): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const problem = scopeProblem(snapshot, input.season, input.plantId, input.seriesId);
    if (problem) return { ok: false, message: problem };
    const removed = await deleteSpeciesCorrespondenceForUser(ownerUserId, input.plantId, input.seriesId);
    return {
      ok: true,
      message: !removed
        ? 'Il n’y avait rien à retirer.'
        : input.seriesId === null ? 'Le rattachement de l’espèce est retiré : elle est de nouveau non rattachée.' : 'L’exception est retirée : la série suit le rattachement de son espèce.',
      view: await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

/**
 * Surcharger un Kc (PR 3c) : une révision datée de la ferme, qui remplace la
 * valeur de la source à partir de son jour ; `kc` nul : retour à la valeur
 * de la source. Rien n'est effacé (D-006).
 */
export async function addKcOverrideAction(input: {
  season: number;
  referenceCropId: string;
  targetKey: string;
  kc: number | null;
  effectiveFrom: string;
}): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const target = overrideTargetOfKey(input.targetKey);
    if (!target) return { ok: false, message: 'Choisissez le Kc à surcharger.' };
    if (!isValidDateKey(input.effectiveFrom)) return { ok: false, message: 'Choisissez le jour à partir duquel la valeur compte.' };
    if (input.kc !== null && !Number.isFinite(input.kc)) return { ok: false, message: 'Saisissez un Kc, par exemple 0,85.' };
    const result = await addKcOverrideForUser(ownerUserId, {
      referenceCropId: input.referenceCropId,
      target,
      kc: input.kc,
      effectiveFrom: input.effectiveFrom,
    });
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: input.kc === null ? 'Le retour à la valeur de la source est enregistré.' : 'La surcharge du Kc est enregistrée.',
      view: await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

/**
 * Régler les durées d'une culture commune pour la ferme (PR 3e) : délais de
 * levée, début des stades, phases de la FAO et abattement, jours du
 * calendrier. Des durées égales à celles du jeu commun le rétablissent.
 */
export async function saveFarmDurationsAction(input: { season: number; referenceCropId: string; durations: FarmDurations }): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const result = await saveFarmDurationsForUser(ownerUserId, input.referenceCropId, input.durations);
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: result.outcome === 'saved'
        ? `Les durées de la ferme sont enregistrées pour ${result.cropName}.`
        : `Ces durées sont celles du jeu commun : ${result.cropName} reprend les durées communes.`,
      view: await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

/** Revenir aux durées du jeu commun : la version de la ferme est retirée. */
export async function resetFarmDurationsAction(input: { season: number; referenceCropId: string }): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const removed = await resetFarmDurationsForUser(ownerUserId, input.referenceCropId);
    return {
      ok: true,
      message: removed ? 'La culture reprend les durées du jeu commun.' : 'La culture avait déjà les durées du jeu commun.',
      view: await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

/**
 * Enregistrer le profil racinaire d'une culture pour la ferme (5 ter, PR 3c) :
 * sa part p et ses profondeurs par stade, à partir d'un jour, avec sa source.
 * Le profil commun reste lisible ; rien n'est effacé.
 */
export async function saveRootingProfileAction(input: {
  season: number;
  referenceCropId: string;
  p: number | null;
  stages: readonly RootingStage[];
  source: string;
  note: string | null;
  effectiveFrom: string;
}): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    if (!isValidDateKey(input.effectiveFrom)) return { ok: false, message: 'Choisissez le jour à partir duquel le profil compte.' };
    if (!Array.isArray(input.stages) || input.stages.length === 0) return { ok: false, message: 'Saisissez au moins une profondeur.' };
    const note = typeof input.note === 'string' && input.note.trim() !== '' ? input.note.trim() : null;
    const result = await addRootingProfileForUser(ownerUserId, {
      referenceCropId: input.referenceCropId,
      p: input.p === null ? null : Number(input.p),
      stages: input.stages.map((stage) => ({
        rank: stage.rank === null ? null : Number(stage.rank),
        depthM: Number(stage.depthM),
        endDepthM: stage.endDepthM === null ? null : Number(stage.endDepthM),
        progressionDays: stage.progressionDays === null ? null : Number(stage.progressionDays),
      })),
      source: typeof input.source === 'string' ? input.source.trim() : '',
      note,
      effectiveFrom: input.effectiveFrom,
    });
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    const view = await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot });
    const name = view.available ? view.crops.find((stored) => stored.crop.id === input.referenceCropId)?.crop.name : undefined;
    return { ok: true, message: name ? `Le profil racinaire est enregistré pour ${name}.` : 'Le profil racinaire est enregistré.', view };
  });
}

/** Régler le K_abri d'un abri, un jardin sous abri de la saison, à partir d'un jour. */
export async function addShelterFactorAction(input: {
  season: number;
  plotId: string;
  value: number;
  effectiveFrom: string;
}): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const plot = snapshot.plots.find((candidate) => candidate.id === input.plotId && candidate.seasons.includes(input.season));
    if (!plot || plot.mode !== 'greenhouse') return { ok: false, message: 'Ce jardin n’est pas sous abri pour cette saison.' };
    if (!isValidDateKey(input.effectiveFrom)) return { ok: false, message: 'Choisissez le jour à partir duquel la valeur compte.' };
    const result = await addShelterFactorForUser(ownerUserId, { shelterId: plot.id, value: input.value, effectiveFrom: input.effectiveFrom });
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: `Le K_abri de ${plot.name} est enregistré.`,
      view: await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

/** Le paillage plastique d'une planche pour la saison ; il remplace le réglage précédent. */
export async function saveBedMulchAction(input: { season: number; bedId: string; plasticMulch: boolean }): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const bed = seasonBed(snapshot, input.season, input.bedId);
    if (!bed) return { ok: false, message: 'Cette planche n’existe pas pour cette saison.' };
    await saveBedMulchForUser(ownerUserId, { bedId: bed.id, season: input.season, plasticMulch: input.plasticMulch === true });
    return {
      ok: true,
      message: input.plasticMulch ? `La planche ${bed.name} porte un paillage plastique.` : `La planche ${bed.name} n’a plus de paillage plastique.`,
      view: await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

/** Poser un filet d'ombrage sur une planche, d'un jour à un autre ; `to` nul : toujours posé. */
export async function addShadeNetAction(input: {
  season: number;
  bedId: string;
  ratePercent: number;
  from: string;
  to: string | null;
}): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const bed = seasonBed(snapshot, input.season, input.bedId);
    if (!bed) return { ok: false, message: 'Cette planche n’existe pas pour cette saison.' };
    if (!Number.isFinite(input.ratePercent)) return { ok: false, message: 'Saisissez le taux du filet, en %.' };
    if (!isValidDateKey(input.from)) return { ok: false, message: 'Choisissez le jour de pose du filet.' };
    const result = await addShadeNetForUser(ownerUserId, { bedId: bed.id, rate: input.ratePercent / 100, from: input.from, to: input.to || null });
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: `Le filet d’ombrage de la planche ${bed.name} est enregistré.`,
      view: await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

/** Retirer un filet : il reste posé jusqu'au jour dit, compris ; son histoire est gardée. */
export async function removeShadeNetAction(input: { season: number; netId: string; removedOn: string }): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    const result = await removeShadeNetForUser(ownerUserId, input.netId, input.removedOn);
    if (result === null) return { ok: false, message: 'Ce filet n’existe pas.' };
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: 'Le filet est retiré ; il compte jusqu’au jour du retrait, compris.',
      view: await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

/** Les options de la ferme : le lissage des passages de stade et l'ombrage, désactivées par défaut (D-054). */
export async function saveCropWaterOptionsAction(input: { season: number; smoothing: boolean; shading: boolean }): Promise<CropWaterActionResult> {
  return withContext(input.season, async ({ ownerUserId, snapshot }) => {
    await saveCropWaterOptionsForUser(ownerUserId, { smoothing: input.smoothing === true, shading: input.shading === true });
    return {
      ok: true,
      message: 'Les options sont enregistrées.',
      view: await getCropCoefficientsViewForUser({ ownerUserId, season: input.season, snapshot }),
    };
  });
}

function seasonBed(snapshot: IrrigationSnapshot, season: number, bedId: string) {
  return snapshot.beds.find((candidate) => candidate.id === bedId && candidate.seasons.includes(season)) ?? null;
}

export type BedCropWaterActionResult =
  | { ok: true; message: string | null; sheet: BedCropWaterSheet }
  | { ok: false; message: string };

/** La fiche d'une planche pour une semaine : stade, Kc, ETM, objectif proposé (5 quater, PR 3b). */
export async function loadBedCropWaterAction(input: { season: number; bedId: string; weekStart: string | null }): Promise<BedCropWaterActionResult> {
  return withSheetContext(input.season, async ({ ownerUserId, snapshot }) => ({
    ok: true,
    message: null,
    sheet: await getBedCropWaterSheetForUser({ ownerUserId, season: input.season, snapshot, bedId: input.bedId, weekStart: input.weekStart ?? undefined }),
  }));
}

/**
 * « Adopter la proposition » : la proposition est recalculée ici, jamais
 * reprise de l'écran ; seule une proposition complète d'une semaine qui
 * n'est pas finie s'adopte. Elle devient l'objectif de la planche par une
 * révision ordinaire, valable à partir du jour de l'adoption (D-039), et le
 * plan se recalcule comme pour tout objectif enregistré.
 */
export async function adoptCropWaterProposalAction(input: { season: number; bedId: string; weekStart: string }): Promise<BedCropWaterActionResult> {
  return withSheetContext(input.season, async ({ ownerUserId, snapshot }) => {
    const now = new Date();
    const sheet = await getBedCropWaterSheetForUser({ ownerUserId, season: input.season, snapshot, bedId: input.bedId, weekStart: input.weekStart, now });
    if (!sheet.available) return { ok: false, message: 'Cette planche n’a pas de proposition à adopter.' };
    if (!sheet.weekOpen) return { ok: false, message: 'Cette semaine est finie : sa proposition ne compterait pour aucun jour.' };
    const bed = snapshot.beds.find((candidate) => candidate.id === sheet.bedId);
    const revision = bed ? adoptionRevision(sheet.bed.week, bed, now.toISOString()) : null;
    if (!revision) return { ok: false, message: 'La proposition n’est pas complète : un jour ou une culture manque, elle ne s’adopte pas.' };
    await saveAdoptedGoalForUser(ownerUserId, input.season, revision);
    await recalculatePlanAfterEvent(ownerUserId, { kind: 'objective-changed', season: input.season, at: revision.weekStart, lasting: true });
    return {
      ok: true,
      message: `La proposition est adoptée : ${revision.amountMm.toLocaleString('fr-FR')} mm par semaine deviennent l’objectif de la planche à partir d’aujourd’hui.`,
      sheet: await getBedCropWaterSheetForUser({ ownerUserId, season: input.season, snapshot, bedId: input.bedId, weekStart: input.weekStart }),
    };
  });
}

/**
 * « Déclarer un stade » : pour la planche, ou pour toute la série. Un stade
 * se déclare le jour où il est atteint, aujourd'hui ou avant ; une
 * correction est une déclaration nouvelle, rien n'est effacé (D-006, D-057).
 */
export async function declareCropStageAction(input: {
  season: number;
  bedId: string;
  weekStart: string | null;
  seriesId: string;
  referenceCropId: string;
  rank: number;
  date: string;
  wholeSeries: boolean;
}): Promise<BedCropWaterActionResult> {
  return withSheetContext(input.season, async ({ ownerUserId, snapshot }) => {
    const today = dateKeyInTimeZone(new Date(), FARM_TIME_ZONE);
    if (!isValidDateKey(input.date)) return { ok: false, message: 'Choisissez le jour où le stade a été atteint.' };
    if (input.date > today) return { ok: false, message: 'Un stade se déclare le jour où il est atteint, aujourd’hui ou avant.' };
    const onBed = snapshot.cropPlan?.places.some((place) => place.bedId === input.bedId && place.seriesId === input.seriesId) ?? false;
    if (!onBed) return { ok: false, message: 'Cette série n’est pas posée sur cette planche.' };
    const result = await addStageDeclarationForUser(ownerUserId, input.season, {
      seriesId: input.seriesId,
      bedId: input.wholeSeries ? null : input.bedId,
      referenceCropId: input.referenceCropId,
      rank: input.rank,
      date: input.date,
    });
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: input.wholeSeries ? 'Le stade est déclaré pour toute la série.' : 'Le stade est déclaré pour cette planche.',
      sheet: await getBedCropWaterSheetForUser({ ownerUserId, season: input.season, snapshot, bedId: input.bedId, weekStart: input.weekStart ?? undefined }),
    };
  });
}

export type SeriesCropWaterActionResult =
  | { ok: true; message: string | null; sheet: SeriesCropWaterSheet }
  | { ok: false; message: string };

/** La fiche d'une série : sur chacune de ses planches, le stade, le Kc et l'ETM du jour (PR 3e). */
export async function loadSeriesCropWaterAction(input: { season: number; seriesId: string }): Promise<SeriesCropWaterActionResult> {
  return withSeriesContext(input.season, async ({ ownerUserId, snapshot }) => ({
    ok: true,
    message: null,
    sheet: await getSeriesCropWaterSheetForUser({ ownerUserId, season: input.season, snapshot, seriesId: input.seriesId }),
  }));
}

/**
 * « Déclarer un stade » depuis la fiche de la série : pour toutes ses
 * planches, le jour où il est atteint, aujourd'hui ou avant (D-057).
 */
export async function declareSeriesStageAction(input: {
  season: number;
  seriesId: string;
  referenceCropId: string;
  rank: number;
  date: string;
}): Promise<SeriesCropWaterActionResult> {
  return withSeriesContext(input.season, async ({ ownerUserId, snapshot }) => {
    const today = dateKeyInTimeZone(new Date(), FARM_TIME_ZONE);
    if (!isValidDateKey(input.date)) return { ok: false, message: 'Choisissez le jour où le stade a été atteint.' };
    if (input.date > today) return { ok: false, message: 'Un stade se déclare le jour où il est atteint, aujourd’hui ou avant.' };
    const known = snapshot.cropPlan?.series.some((item) => item.id === input.seriesId && item.season === input.season) ?? false;
    if (!known) return { ok: false, message: 'Cette série n’est pas dans le plan de culture de la saison.' };
    const result = await addStageDeclarationForUser(ownerUserId, input.season, {
      seriesId: input.seriesId,
      bedId: null,
      referenceCropId: input.referenceCropId,
      rank: input.rank,
      date: input.date,
    });
    if (!result.ok) return { ok: false, message: result.problems.join(' ') };
    return {
      ok: true,
      message: 'Le stade est déclaré pour toute la série.',
      sheet: await getSeriesCropWaterSheetForUser({ ownerUserId, season: input.season, snapshot, seriesId: input.seriesId }),
    };
  });
}

async function withSeriesContext(
  season: number,
  operation: (context: { ownerUserId: string; snapshot: IrrigationSnapshot }) => Promise<SeriesCropWaterActionResult>,
): Promise<SeriesCropWaterActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(season) || season < 1900 || season > 9999) return { ok: false, message: 'Saison invalide.' };
  try {
    return await operation({ ownerUserId: user.userId, snapshot: await getIrrigationSnapshot(user.userId, { season }) });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Le besoin de la culture n’a pas pu être lu.' };
  }
}

async function withSheetContext(
  season: number,
  operation: (context: { ownerUserId: string; snapshot: IrrigationSnapshot }) => Promise<BedCropWaterActionResult>,
): Promise<BedCropWaterActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(season) || season < 1900 || season > 9999) return { ok: false, message: 'Saison invalide.' };
  try {
    return await operation({ ownerUserId: user.userId, snapshot: await getIrrigationSnapshot(user.userId, { season }) });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Le besoin de la culture n’a pas pu être lu.' };
  }
}

/** L'espèce, et la série d'une exception, doivent porter une culture de la saison. */
function scopeProblem(snapshot: IrrigationSnapshot, season: number, plantId: string, seriesId: string | null): string | null {
  const series = (snapshot.cropPlan?.series ?? []).filter((item) => item.season === season && item.use === 'bed');
  const carrying = series.filter((item) => item.cultivations.some((cultivation) => cultivation.plantId === plantId));
  if (carrying.length === 0) return 'Cette espèce ne porte aucune série de la saison sur une planche.';
  if (seriesId !== null && !carrying.some((item) => item.id === seriesId)) return 'Cette série ne porte pas cette espèce.';
  return null;
}

function targetProblem(target: Target): string | null {
  if (target.kind === 'reference') {
    return typeof target.referenceCropId === 'string' && target.referenceCropId.length > 0 ? null : 'Choisissez une culture de référence.';
  }
  return target.kind === 'without-reference' || target.kind === 'surface-state' ? null : 'Rattachement invalide.';
}

/** Ne garde que les champs du rattachement : rien d'autre n'entre en base. */
function normalizedTarget(target: Target): Target {
  if (target.kind === 'reference') return { kind: 'reference', referenceCropId: target.referenceCropId, analogy: target.analogy === true };
  return { kind: target.kind };
}

async function withContext(
  season: number,
  operation: (context: { ownerUserId: string; snapshot: IrrigationSnapshot }) => Promise<CropWaterActionResult>,
): Promise<CropWaterActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(season) || season < 1900 || season > 9999) return { ok: false, message: 'Saison invalide.' };
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season });
    return await operation({ ownerUserId: user.userId, snapshot });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'L’enregistrement n’a pas pu se faire.' };
  }
}
