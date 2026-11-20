import type { RootingProfile, RootingStage } from '../soil-reserve/rooting.ts';
import type { ResolvedOnboarding } from './steps.ts';

/**
 * Les racines d'une ferme neuve (4.4, docs/tranche-4-contract.md, F423 ;
 * PR 4a, F585) : le jeu commun des profils racinaires porte, pour l'asperge
 * et le melon, le plafond de 0,60 m de la ferme du porteur (D-056), et non
 * la profondeur de la FAO-56. Une ferme neuve ne l'hérite pas : elle part de
 * la FAO, borne basse de la fourchette du tableau 22, comme les autres
 * profils construits sur la FAO (D-056), dit « estimation, à vérifier à la
 * tarière ». Elle règle ensuite son propre plafond de parcelle.
 *
 * La ferme du porteur (espace d'avant l'accueil) et la démonstration gardent
 * le jeu commun tel quel (F426) : la base ne change pas, la correction se
 * pose à la lecture, pour un espace qui fait l'accueil seulement.
 */

type CommonCorrection = { stages: RootingStage[]; source: string; note: string };

const stage = (rank: number | null, depthM: number): RootingStage => ({ rank, depthM, endDepthM: null, progressionDays: null });

const NOTE = 'Estimation. Le plafond de 0,60 m du jeu commun est celui de la ferme du porteur (D-056) : une ferme neuve ne l’hérite pas, '
  + 'et règle son propre plafond de parcelle.';

/** Les profils du jeu commun qui portent un plafond de la ferme du porteur, et leur profondeur de la FAO-56 (tableau 22, borne basse). */
const FAO_INSTEAD_OF_CARRIER_CEILING: Record<string, CommonCorrection> = {
  'criiam-asperge': {
    stages: [stage(null, 1.2)],
    source: 'Maximum : FAO 1,2-1,8 m, borne basse. p : FAO-56, tableau 22. Culture installée. Proposé à une ferme neuve (4.4, F585), à vérifier à la tarière.',
    note: NOTE,
  },
  'criiam-melon': {
    stages: [stage(1, 0.3), stage(2, 0.55), stage(3, 0.8), stage(4, 0.8)],
    source: 'Maximum : FAO 0,8-1,5 m (melon), borne basse. p : FAO-56, tableau 22. Stades 1 et 2 du jeu commun, puis la borne de la FAO. '
      + 'Proposé à une ferme neuve (4.4, F585), à vérifier à la tarière.',
    note: NOTE,
  },
};

/** Les cultures dont le profil commun change pour une ferme neuve. */
export const CORRECTED_COMMON_PROFILES = Object.keys(FAO_INSTEAD_OF_CARRIER_CEILING);

/**
 * Les profils que lit un espace : pour un espace qui fait l'accueil, le
 * profil commun d'une culture plafonnée par la ferme du porteur prend la
 * profondeur de la FAO ; ses dates restent celles du jeu commun, si bien
 * qu'une révision de la ferme le remplace toujours. Les autres espaces
 * lisent le jeu commun tel quel.
 */
export function rootingProfilesForSpace<T extends RootingProfile & { origin: 'common' | 'farm' }>(
  profiles: readonly T[],
  onboarding: ResolvedOnboarding,
): T[] {
  if (onboarding.kind !== 'onboarding') return [...profiles];
  return profiles.map((profile) => {
    const correction = profile.origin === 'common' ? FAO_INSTEAD_OF_CARRIER_CEILING[profile.referenceCropId] : undefined;
    return correction ? { ...profile, stages: correction.stages, source: correction.source, note: correction.note } : profile;
  });
}
