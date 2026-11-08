import { curveStages, type ReferenceCrop } from '../crop-water/reference.ts';
import { DEFAULT_P, PROPOSED_DEPTH_M, rootingProfileOn, type RootingProfile, type RootingStage } from './rooting.ts';

/**
 * Le profil racinaire d'une culture de référence tel que la page
 * « Coefficients culturaux » le montre (docs/soil-reserve-contract.md, « La
 * profondeur racinaire et la part utilisable des cultures », « L'écran »,
 * 5 ter, PR 3c) : la part p et la profondeur de chaque stade qui comptent
 * aujourd'hui, d'où elles viennent, le jeu commun à côté quand la ferme a sa
 * révision, et l'histoire de ses révisions. Rien n'est effacé.
 */

type ProfileOrigin = 'common' | 'farm';
type StoredProfile = RootingProfile & { origin: ProfileOrigin };

export type RootingLine = RootingStage & { label: string };

export type RootingProfileView = {
  referenceCropId: string;
  /** Le profil qui compte aujourd'hui ; `null` : aucun, 30 cm et p 0,5 sont proposés. */
  inForce: (StoredProfile & { lines: RootingLine[] }) | null;
  /** Le profil commun, quand la ferme a sa révision ; `null` sinon. */
  common: (StoredProfile & { lines: RootingLine[] }) | null;
  /** La part p comptée aujourd'hui ; `defaultP` : sans valeur, 0,5 s'applique. */
  p: number;
  defaultP: boolean;
  /** Les stades de la culture sans ligne propre ni ligne « tous les stades » : 30 cm proposés. */
  proposedStages: { rank: number; label: string }[];
  /** Les stades de la culture, pour ajouter une ligne. */
  stages: { rank: number; label: string }[];
  /** Les révisions de la ferme, de la plus récente à la plus ancienne, celles d'un jour à venir comprises. */
  history: StoredProfile[];
};

/** Une ligne « tous les stades » : le stade de la ligne est `null`. */
const ALL_STAGES_LABEL = 'Tous les stades';

export function rootingProfileView(crop: ReferenceCrop, profiles: readonly StoredProfile[], today: string): RootingProfileView {
  const own = profiles.filter((profile) => profile.referenceCropId === crop.id);
  const stages = curveStages(crop.curve).map((stage) => ({ rank: stage.rank, label: stage.label }));
  const withLines = (profile: StoredProfile | null) => (profile === null ? null : { ...profile, lines: linesOf(profile, stages) });
  const inForce = rootingProfileOn(own, crop.id, today);
  const common = inForce?.origin === 'farm' ? rootingProfileOn(own.filter((profile) => profile.origin === 'common'), crop.id, today) : null;
  const covered = new Set(inForce?.stages.map((stage) => stage.rank) ?? []);
  return {
    referenceCropId: crop.id,
    inForce: withLines(inForce),
    common: withLines(common),
    p: inForce?.p ?? DEFAULT_P,
    defaultP: inForce === null || inForce.p === null,
    proposedStages: covered.has(null) ? [] : stages.filter((stage) => !covered.has(stage.rank)),
    stages,
    history: own
      .filter((profile) => profile.origin === 'farm')
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.recordedAt.localeCompare(a.recordedAt)),
  };
}

function linesOf(profile: RootingProfile, stages: readonly { rank: number; label: string }[]): RootingLine[] {
  const order = (rank: number | null) => (rank === null ? Number.MAX_SAFE_INTEGER : rank);
  return [...profile.stages]
    .sort((a, b) => order(a.rank) - order(b.rank))
    .map((stage) => ({ ...stage, label: stageLineLabel(stage.rank, stages) }));
}

/** Le nom d'une ligne : son stade, « Stade 2 · Développement », ou « Tous les stades ». */
export function stageLineLabel(rank: number | null, stages: readonly { rank: number; label: string }[]): string {
  if (rank === null) return ALL_STAGES_LABEL;
  const stage = stages.find((candidate) => candidate.rank === rank);
  return stage ? `Stade ${rank} · ${stage.label}` : `Stade ${rank}`;
}

const meters = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Une profondeur fixe, « 0,20 m », ou progressive, « de 0,40 à 0,70 m en 40 jours, puis 0,70 m ». */
export function rootingDepthText(stage: Pick<RootingStage, 'depthM' | 'endDepthM' | 'progressionDays'>): string {
  if (stage.endDepthM === null || stage.progressionDays === null) return `${meters.format(stage.depthM)} m`;
  return `de ${meters.format(stage.depthM)} à ${meters.format(stage.endDepthM)} m en ${stage.progressionDays} jour${stage.progressionDays > 1 ? 's' : ''}, puis ${meters.format(stage.endDepthM)} m`;
}

/** La profondeur proposée à un stade sans ligne, dite comme telle. */
export const PROPOSED_DEPTH_TEXT = `${meters.format(PROPOSED_DEPTH_M)} m proposés, à vérifier`;
