import { listKcOverridesForWorkspace, listSpeciesCorrespondencesForWorkspace, listStageDeclarationsForWorkspace } from './entries';
import { listReferenceCropsForWorkspace, type StoredReferenceCrop } from './references';
import { readCropWaterSettingsForWorkspace, type CropWaterSettings } from './settings';
import type { Season } from '@/lib/domain/domain';
import type { BedWaterSettings } from '@/lib/domain/crop-water/etm';
import type { KcOverride } from '@/lib/domain/crop-water/kc';
import type { ReferenceCrop } from '@/lib/domain/crop-water/reference';
import type { CorrespondenceEntry } from '@/lib/domain/crop-water/species';
import type { StageDeclaration } from '@/lib/domain/crop-water/stage';

/**
 * Ce que le calcul du besoin par culture et par stade lit en base pour une
 * exploitation et une saison (docs/crop-water-need-contract.md) : les
 * cultures de référence utilisables, la correspondance des espèces, les
 * surcharges, les stades déclarés et les réglages. Les cultures qui ne
 * peuvent pas servir sont rendues à part, avec leurs raisons, pour que
 * l'écran les nomme ; elles ne sont jamais devinées.
 */
export type CropWaterInputs = {
  referenceCrops: ReferenceCrop[];
  unusableCrops: StoredReferenceCrop[];
  correspondences: CorrespondenceEntry[];
  overrides: KcOverride[];
  declarations: StageDeclaration[];
  settings: CropWaterSettings;
};

export async function readCropWaterInputsForWorkspace(workspaceId: string, season: Season): Promise<CropWaterInputs> {
  const [crops, correspondences, overrides, declarations, settings] = await Promise.all([
    listReferenceCropsForWorkspace(workspaceId),
    listSpeciesCorrespondencesForWorkspace(workspaceId),
    listKcOverridesForWorkspace(workspaceId),
    listStageDeclarationsForWorkspace(workspaceId, season),
    readCropWaterSettingsForWorkspace(workspaceId),
  ]);
  return {
    referenceCrops: crops.filter((stored) => stored.problems.length === 0).map((stored) => stored.crop),
    unusableCrops: crops.filter((stored) => stored.problems.length > 0),
    correspondences,
    overrides,
    declarations,
    settings,
  };
}

/** Les réglages d'une planche ; `shelterId` : son jardin quand il est sous abri, sinon `null`. */
export function bedWaterSettings(settings: CropWaterSettings, bedId: string, shelterId: string | null): BedWaterSettings {
  return {
    bedId,
    shelterId,
    shelterFactors: settings.shelterFactors.filter((revision) => revision.shelterId === shelterId),
    mulch: settings.mulch.filter((setting) => setting.bedId === bedId),
    shadeNets: settings.shadeNets.filter((net) => net.bedId === bedId),
  };
}
