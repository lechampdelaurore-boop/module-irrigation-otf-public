import type { CropWaterDay } from '../crop-water/etm.ts';
import type { BedWaterDay } from '../crop-water/proposal.ts';
import {
  bareSoilCapacity,
  bareSoilGeometry,
  surfaceStateHasThreshold,
  type BareSoilGeometry,
  type SurfaceDeclaration,
  type SurfaceState,
} from './bare-soil.ts';
import type { BedSoilInput } from './gauge.ts';
import { cappedDepth, cropRooting, DEFAULT_P, firstStageDepth, PROPOSED_DEPTH_M, rootingProfileOn } from './rooting.ts';
import type { ResolvedSoil } from './soil.ts';

/**
 * La forme d'un jour de la jauge, avant tout bilan (docs/soil-reserve-contract.md,
 * « Le calcul de la jauge ») : l'état de surface d'une planche sans culture,
 * les cultures présentes avec leur profondeur et leur part p, la profondeur,
 * la capacité et p du jour selon le mode. Elle reste au module, hors du
 * moteur commun (MC-18).
 */

export type GaugeMode = 'crop' | 'bare' | 'cover';

export type SoilCrop = {
  seriesName: string;
  plantName: string;
  referenceCropName: string;
  depthM: number;
  proposedDepth: boolean;
  p: number;
  defaultP: boolean;
};

export type DayShape = { depthM: number | null; capacityMm: number | null; p: number | null; geometry: BareSoilGeometry | null };

/** La profondeur, la capacité et la part p du jour, selon le mode. */
export function dayShape(input: {
  input: BedSoilInput;
  mode: GaugeMode;
  soil: ResolvedSoil;
  crops: readonly SoilCrop[];
  surface: { state: SurfaceState } | null;
  date: string;
}): DayShape {
  const { soil, mode } = input;
  const rfu = soil.soilRfuMmPerMeter;
  const ceiling = soil.record.soilDepthCeilingM;
  if (mode === 'crop') {
    if (input.crops.length === 0) return { depthM: null, capacityMm: null, p: null, geometry: null };
    // Plusieurs cultures : la moins profonde fixe la capacité, la plus sensible le seuil (D-053).
    const depthM = cappedDepth(Math.min(...input.crops.map((crop) => crop.depthM)), ceiling);
    return { depthM, capacityMm: rfu * depthM, p: Math.min(...input.crops.map((crop) => crop.p)), geometry: null };
  }
  if (mode === 'cover') {
    const depthM = cappedDepth(PROPOSED_DEPTH_M, ceiling);
    const p = input.surface && surfaceStateHasThreshold(input.surface.state) ? DEFAULT_P : null;
    return { depthM, capacityMm: rfu * depthM, p, geometry: null };
  }
  const depthM = cappedDepth(referenceDepth(input.input, input.date), ceiling);
  const geometry = bareSoilGeometry({
    soilRfuMmPerMeter: rfu,
    depthM,
    surfaceLayerCm: soil.record.surfaceLayerCm,
    tewMm: soil.record.tewMm,
    rewMm: soil.record.rewMm,
  });
  return { depthM, capacityMm: bareSoilCapacity(geometry), p: null, geometry };
}

/** La profondeur de référence d'une planche sans culture : le premier stade de sa prochaine culture connue, sinon 30 cm. */
function referenceDepth(input: BedSoilInput, date: string): number {
  const next = input.upcomingCrops
    .filter((crop) => crop.presenceStart > date)
    .sort((a, b) => a.presenceStart.localeCompare(b.presenceStart))[0];
  const crop = next?.referenceCropId ? input.referenceCrops.find((candidate) => candidate.id === next.referenceCropId) : undefined;
  if (!next || !crop) return PROPOSED_DEPTH_M;
  return firstStageDepth(rootingProfileOn(input.rootingProfiles, crop.id, date), crop).depthM;
}

/** Les cultures de la planche ce jour-là, avec leur profondeur au stade du jour et leur part p. */
export function soilCrops(input: BedSoilInput, water: BedWaterDay): SoilCrop[] {
  return water.crops.flatMap((crop): SoilCrop[] => {
    if (crop.status !== 'computed' && crop.status !== 'unknown') return [];
    const profile = rootingProfileOn(input.rootingProfiles, crop.trace.referenceCropId, water.date);
    const rooting = cropRooting(profile, crop.trace.stage, water.date);
    return [{
      seriesName: crop.seriesName,
      plantName: crop.plantName,
      referenceCropName: crop.trace.referenceCropName,
      depthM: rooting.depthM,
      proposedDepth: rooting.proposedDepth,
      p: rooting.p,
      defaultP: rooting.defaultP,
    }];
  });
}

/**
 * L'état de surface d'une planche sans culture : la dernière déclaration
 * depuis la fin de sa dernière culture ; sans elle, l'engrais vert levé
 * quand une série d'engrais vert occupe la planche, sinon « nue » (D-053).
 */
export function surfaceStateOf(
  input: BedSoilInput,
  water: BedWaterDay,
  date: string,
  lastCropDate: string | null,
): { state: SurfaceState; declared: boolean; since: string | null } {
  let chosen: SurfaceDeclaration | null = null;
  for (const declaration of input.surfaceDeclarations) {
    if (declaration.bedId !== input.bed.id || declaration.date > date) continue;
    if (lastCropDate !== null && declaration.date <= lastCropDate) continue;
    if (chosen === null || declaration.date > chosen.date || (declaration.date === chosen.date && declaration.recordedAt >= chosen.recordedAt)) {
      chosen = declaration;
    }
  }
  if (chosen) return { state: chosen.state, declared: true, since: chosen.date };
  const greenManure = water.crops.some((crop: CropWaterDay) => crop.status === 'surface-state');
  return { state: greenManure ? 'green-manure-emergence' : 'bare', declared: false, since: null };
}
