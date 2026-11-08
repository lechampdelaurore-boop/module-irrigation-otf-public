import { listKcOverridesForWorkspace, listSpeciesCorrespondencesForWorkspace } from '@/db/crop-water/entries';
import { listReferenceCropsForWorkspace, readCommonReferenceCrop, type StoredReferenceCrop } from '@/db/crop-water/references';
import { readCropWaterSettingsForWorkspace } from '@/db/crop-water/settings';
import { listRootingProfilesForWorkspace, type StoredRootingProfile } from '@/db/soil-reserve/inputs';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import { DEFAULT_CROP_WATER_OPTIONS } from '../domain/crop-water/etm';
import type { KcOverride } from '../domain/crop-water/kc';
import type { ReferenceCrop } from '../domain/crop-water/reference';
import { cropWaterSettingsView, type CropWaterSettingsView } from '../domain/crop-water/settings-view';
import { dateKeyInTimeZone, FARM_TIME_ZONE } from '../domain/water-management';
import { seasonSpecies, speciesWithoutReference, type SeasonSpecies, type SpeciesWithoutReference } from '../domain/crop-water/species';

/**
 * La page « Coefficients culturaux » (docs/crop-water-need-contract.md,
 * « L'écran », 5 quater, PR 3) : les cultures de référence de la ferme, le
 * jeu commun ou sa version, avec ce qui empêche d'en utiliser une ; les
 * espèces de la saison et leur rattachement ; la liste « sans référence Kc ».
 * Rien n'est deviné : une espèce sans rattachement est dite telle. Depuis
 * la PR 3c : les surcharges de Kc et les réglages du calcul (K_abri,
 * paillage, filets d'ombrage, options). Depuis la PR 3e : pour chaque culture
 * dont la ferme a réglé ses durées, la culture commune, lisible à côté.
 * Depuis la 5 ter (PR 3c) : les profils racinaires, communs et de la ferme
 * (docs/soil-reserve-contract.md).
 */
export type CropCoefficientsView =
  | {
      available: true;
      season: number;
      crops: StoredReferenceCrop[];
      /** La culture commune de chaque culture dont la ferme a sa version, par identifiant. */
      commonVersions: Record<string, ReferenceCrop>;
      species: SeasonSpecies[];
      withoutReference: SpeciesWithoutReference[];
      overrides: KcOverride[];
      settings: CropWaterSettingsView;
      rootingProfiles: StoredRootingProfile[];
    }
  | { available: false; season: number; reason: 'crop-plan-not-read' };

export async function getCropCoefficientsViewForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  now?: Date;
}): Promise<CropCoefficientsView> {
  const cropPlan = input.snapshot.cropPlan;
  if (!cropPlan) return { available: false, season: input.season, reason: 'crop-plan-not-read' };
  const workspaceId = await findWorkspaceIdForUser(input.ownerUserId);
  const [crops, entries, overrides, settings, rootingProfiles] = await Promise.all([
    listReferenceCropsForWorkspace(workspaceId),
    workspaceId === null ? Promise.resolve([]) : listSpeciesCorrespondencesForWorkspace(workspaceId),
    workspaceId === null ? Promise.resolve([]) : listKcOverridesForWorkspace(workspaceId),
    workspaceId === null
      ? Promise.resolve({ shelterFactors: [], mulch: [], shadeNets: [], options: { ...DEFAULT_CROP_WATER_OPTIONS } })
      : readCropWaterSettingsForWorkspace(workspaceId),
    listRootingProfilesForWorkspace(workspaceId),
  ]);
  const series = cropPlan.series.filter((item) => item.season === input.season);
  const commons = await Promise.all(crops.filter((stored) => stored.origin === 'farm').map((stored) => readCommonReferenceCrop(stored.crop.id)));
  return {
    available: true,
    season: input.season,
    crops,
    commonVersions: Object.fromEntries(commons.flatMap((common) => (common ? [[common.crop.id, common.crop]] : []))),
    species: seasonSpecies(series, entries),
    withoutReference: speciesWithoutReference(series, entries),
    overrides,
    settings: cropWaterSettingsView({
      plots: input.snapshot.plots,
      beds: input.snapshot.beds,
      settings,
      season: input.season,
      today: dateKeyInTimeZone(input.now ?? new Date(), FARM_TIME_ZONE),
    }),
    rootingProfiles,
  };
}
