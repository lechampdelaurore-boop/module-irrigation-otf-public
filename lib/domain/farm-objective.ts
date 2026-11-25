import { mmText } from './figure-origin.ts';

/**
 * L'objectif de la ferme, un seul calcul et une seule phrase (simplification,
 * lot S1, PR 3, docs/simplification-s1-contract.md, section 5 ; D-328).
 *
 * L'objectif de chaque planche est celui du besoin (`objectiveForBed` : le
 * plus précis des objectifs saisis, sinon l'objectif automatique). Celui de
 * la ferme en est la moyenne pondérée par la surface, Σ(mm × m²) / Σ(m²),
 * sur les seules planches qui ont un objectif ; celles qui n'en ont pas sont
 * comptées à voix haute, jamais à zéro (D-003). Aucune page ne refait cette
 * moyenne : « Aujourd'hui » et « Objectifs et besoins » l'appellent, et
 * « Historique et cumuls » pour l'objectif d'une période et d'une série
 * (PR 3 bis, D-329, section 5 bis du contrat).
 *
 * Ce n'est pas l'objectif « Toute la ferme » saisi : celui-là n'est qu'un
 * réglage, que l'objectif d'un jardin ou d'une planche remplace là où il est
 * posé (cause du point S1-O1, contrat, section 9.6).
 */
export type FarmObjectiveBed = {
  areaSquareMeters: number;
  objectiveMm: number | null;
};

export type FarmObjective = {
  /** La moyenne pondérée sur les planches qui ont un objectif ; `null` si aucune n'en a. */
  objectiveMm: number | null;
  /** Les planches qui ont un objectif. */
  withObjective: number;
  /** Toutes les planches comptées. */
  total: number;
};

export function farmObjective(beds: readonly FarmObjectiveBed[]): FarmObjective {
  const counted = beds.filter((bed) => bed.objectiveMm !== null && Number.isFinite(bed.objectiveMm));
  const area = counted.reduce((sum, bed) => sum + Math.max(0, bed.areaSquareMeters), 0);
  const weighted = counted.reduce((sum, bed) => sum + (bed.objectiveMm ?? 0) * Math.max(0, bed.areaSquareMeters), 0);
  return {
    objectiveMm: counted.length > 0 && area > 0 ? weighted / area : null,
    withObjective: counted.length,
    total: beds.length,
  };
}

/** Les planches comptées : celles qui ont un objectif, sur toutes. */
type ObjectiveBedCount = Pick<FarmObjective, 'withObjective' | 'total'>;

/** Une partie seulement des planches a un objectif. */
export function farmObjectivePartial(objective: ObjectiveBedCount): boolean {
  return objective.withObjective > 0 && objective.withObjective < objective.total;
}

/**
 * Sur quelles planches se lit le chiffre : « ferme entière », ou « 7 planches
 * sur 10 ont un objectif » (un seul « sur » par phrase, F443).
 */
export function farmObjectiveScopeText(objective: ObjectiveBedCount): string {
  if (!farmObjectivePartial(objective)) return 'ferme entière';
  const count = objective.withObjective;
  return `${count} planche${count > 1 ? 's' : ''} sur ${objective.total} ${count > 1 ? 'ont' : 'a'} un objectif`;
}

/**
 * La phrase de l'objectif de la ferme, la même sur chaque page : « 5,2 mm
 * visés, ferme entière » ; « 23,4 mm visés, 7 planches sur 10 ont un
 * objectif » ; « aucune eau visée » quand aucune planche n'a d'objectif.
 */
export function farmObjectiveText(objective: FarmObjective): string {
  if (objective.objectiveMm === null) return 'aucune eau visée';
  return `${mmText(Math.round(objective.objectiveMm * 10) / 10)} visés, ${farmObjectiveScopeText(objective)}`;
}
