import type { StagedDay } from '../crop-water/stage.ts';
import { curveStages, type ReferenceCrop } from '../crop-water/reference.ts';
import { daysFromTo } from '../crop-water/crop-calendar.ts';
import { latestEffective, PERCENT, type ThresholdSetting } from './soil.ts';

/**
 * La profondeur racinaire par stade et la part utilisable p des cultures de
 * référence (docs/soil-reserve-contract.md, « La profondeur racinaire et la
 * part utilisable des cultures », « Le seuil de déclenchement », D-053,
 * D-056, D-059).
 *
 * Une culture de référence porte un profil : sa part p (FAO-56, tableau 22)
 * et une profondeur par stade, fixe ou progressive. Un profil se modifie par
 * révision datée, la valeur d'origine et sa source gardées par la
 * persistance. Sans profil ni ligne pour le stade, 30 cm sont proposés avec
 * un avertissement ; sans p, p vaut 0,5.
 */

export type RootingStage = {
  /** Le rang du stade dans la table de la culture ; `null` : tous les stades sans ligne propre. */
  rank: number | null;
  depthM: number;
  /** Profondeur progressive : jusqu'à `endDepthM` en `progressionDays` jours, puis constante. */
  endDepthM: number | null;
  progressionDays: number | null;
};

export type RootingProfile = {
  referenceCropId: string;
  /** Part utilisable de la FAO-56 ; `null` : sans valeur, 0,5 s'applique. */
  p: number | null;
  stages: readonly RootingStage[];
  source: string;
  note: string | null;
  effectiveFrom: string;
  recordedAt: string;
};

/** Profondeur proposée à une culture sans profondeur saisie, et à une planche sans culture (D-047, D-053). */
export const PROPOSED_DEPTH_M = 0.3;
/** Part p d'une culture sans valeur, et d'un engrais vert : les légumes les moins sensibles (D-053). */
export const DEFAULT_P = 0.5;
/** Une profondeur au-delà de 3 m n'est pas une profondeur racinaire de légume. */
const MAX_DEPTH_M = 3;

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** Ce qui empêche d'enregistrer un profil, en phrases. */
export function rootingProfileProblems(profile: Pick<RootingProfile, 'p' | 'stages'>, cropName: string): string[] {
  const problems: string[] = [];
  if (profile.p !== null && !(Number.isFinite(profile.p) && profile.p > 0 && profile.p < 1)) {
    problems.push(`${cropName} : part utilisable p invalide (${decimal.format(profile.p)}), strictement entre 0 et 1.`);
  }
  const ranks = new Set<number | null>();
  for (const stage of profile.stages) {
    if (ranks.has(stage.rank)) problems.push(`${cropName} : deux profondeurs pour le même stade.`);
    ranks.add(stage.rank);
    if (!isDepth(stage.depthM)) problems.push(`${cropName} : profondeur invalide (${decimal.format(stage.depthM)} m).`);
    const progressive = stage.endDepthM !== null || stage.progressionDays !== null;
    if (progressive && !(stage.endDepthM !== null && isDepth(stage.endDepthM)
      && stage.progressionDays !== null && Number.isInteger(stage.progressionDays) && stage.progressionDays > 0)) {
      problems.push(`${cropName} : profondeur progressive incomplète (profondeur finale et nombre de jours).`);
    }
  }
  return problems;
}

/** Le profil d'une culture de référence un jour donné : sa dernière révision en vigueur. */
export function rootingProfileOn<T extends RootingProfile>(profiles: readonly T[], referenceCropId: string, date: string): T | null {
  return latestEffective(profiles.filter((profile) => profile.referenceCropId === referenceCropId), date);
}

/** La profondeur d'une culture un jour donné, et si elle est proposée faute de saisie. */
export type CropRooting = { depthM: number; proposedDepth: boolean; p: number; defaultP: boolean };

/**
 * La profondeur d'une culture à son stade du jour : la ligne de son stade,
 * sinon celle de tous les stades, sinon 30 cm proposés. Une profondeur
 * progressive se compte depuis le début du stade ; pour la ligne de tous les
 * stades d'un trapèze de la FAO, depuis l'origine du cycle (scénario 40).
 */
export function cropRooting(profile: RootingProfile | null, stage: StagedDay, date: string): CropRooting {
  const p = profile?.p ?? null;
  const pPart = { p: p ?? DEFAULT_P, defaultP: p === null };
  const row = profile?.stages.find((candidate) => candidate.rank === stage.rank)
    ?? profile?.stages.find((candidate) => candidate.rank === null);
  if (!row) return { depthM: PROPOSED_DEPTH_M, proposedDepth: true, ...pPart };
  const days = row.rank === null && stage.position.shape === 'trapezoid'
    ? stage.position.daysSinceOrigin
    : daysFromTo(stage.startedOn, date);
  return { depthM: rowDepth(row, days), proposedDepth: false, ...pPart };
}

/** La profondeur d'une ligne `days` jours après son début : `min(fin ; début + (fin − début) × jours / jours_progression)`. */
export function rowDepth(row: RootingStage, days: number): number {
  if (row.endDepthM === null || row.progressionDays === null) return row.depthM;
  if (row.progressionDays <= 0) return row.endDepthM;
  const progress = Math.min(1, Math.max(0, days) / row.progressionDays);
  return row.depthM + (row.endDepthM - row.depthM) * progress;
}

/**
 * La profondeur au premier stade d'une culture, à son début : celle qui sert
 * de profondeur de référence à une planche sans culture avant elle (D-053).
 */
export function firstStageDepth(profile: RootingProfile | null, crop: ReferenceCrop): { depthM: number; proposedDepth: boolean } {
  const firstRank = curveStages(crop.curve)[0]?.rank ?? null;
  const row = profile?.stages.find((candidate) => candidate.rank === firstRank)
    ?? profile?.stages.find((candidate) => candidate.rank === null);
  return row ? { depthM: row.depthM, proposedDepth: false } : { depthM: PROPOSED_DEPTH_M, proposedDepth: true };
}

/** Un plafond de sol, s'il est renseigné, borne la profondeur (D-056). */
export function cappedDepth(depthM: number, ceilingM: number | null): number {
  return ceilingM === null ? depthM : Math.min(depthM, ceilingM);
}

/**
 * Le seuil de déclenchement, en mm (D-053, D-059). Par défaut, selon la
 * culture : `capacité × (1 − min(1 ; p / part de référence))`, la plus petite
 * part p des cultures présentes ; quand l'exploitation règle son propre
 * seuil, `capacité × X %`, pour toutes les cultures.
 */
export function thresholdMm(capacityMm: number, p: number, referenceShare: number, setting: ThresholdSetting): number {
  if (setting.mode === 'farm') return capacityMm * setting.percent / PERCENT;
  return capacityMm * (1 - Math.min(1, p / referenceShare));
}

/** Le seuil selon la culture, en % du plein : l'écran le rappelle quand le seuil de la ferme passe dessous. */
export function cropThresholdPercent(p: number, referenceShare: number): number {
  return (1 - Math.min(1, p / referenceShare)) * PERCENT;
}

function isDepth(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_DEPTH_M;
}
