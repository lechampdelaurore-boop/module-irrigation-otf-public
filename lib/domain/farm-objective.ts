import { mmText } from './figure-origin.ts';
import { objectiveOffSeason } from './off-season.ts';

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
 *
 * Une planche hors saison sans objectif sur la période (D-337,
 * `objectiveOffSeason`) sort des comptes et se dit à part : « 7 planches sur
 * 7 ont un objectif, 3 hors saison ». Le tableau des besoins dit aussi hors
 * saison la planche qui l'est le jour du calcul (`needOffSeason`, D-352) :
 * elle sort des comptes de la même façon, l'objectif de ses jours d'avant
 * reste écrit, inactif. Sans planche hors saison, rien ne change.
 */
export type FarmObjectiveBed = {
  areaSquareMeters: number;
  objectiveMm: number | null;
  /** Les jours de la période où la planche est hors saison (D-337) ; absent ou vide : en saison tous les jours. */
  offSeasonDates?: readonly string[];
  /** Hors saison pour le besoin de la semaine (`needOffSeason`, D-352) : hors des comptes, même avec un objectif sur ses jours d'avant. */
  offSeason?: boolean;
};

export type FarmObjective = {
  /** La moyenne pondérée sur les planches qui ont un objectif ; `null` si aucune n'en a. */
  objectiveMm: number | null;
  /** Les planches qui ont un objectif. */
  withObjective: number;
  /** Toutes les planches comptées, hors saison comprises. */
  total: number;
  /**
   * Les planches hors saison sans objectif sur la période, dites à part
   * (D-337). Absent quand il n'y en a aucune : le résultat d'avant.
   */
  offSeason?: number;
};

export function farmObjective(beds: readonly FarmObjectiveBed[]): FarmObjective {
  const counted = beds.filter((bed) => !bedOffSeason(bed) && bed.objectiveMm !== null && Number.isFinite(bed.objectiveMm));
  const area = counted.reduce((sum, bed) => sum + Math.max(0, bed.areaSquareMeters), 0);
  const weighted = counted.reduce((sum, bed) => sum + (bed.objectiveMm ?? 0) * Math.max(0, bed.areaSquareMeters), 0);
  const offSeason = beds.filter(bedOffSeason).length;
  return {
    objectiveMm: counted.length > 0 && area > 0 ? weighted / area : null,
    withObjective: counted.length,
    total: beds.length,
    ...(offSeason > 0 ? { offSeason } : {}),
  };
}

function bedOffSeason(bed: FarmObjectiveBed): boolean {
  return bed.offSeason === true || objectiveOffSeason(bed);
}

/** Les planches comptées : celles qui ont un objectif, sur toutes, et celles hors saison. */
type ObjectiveBedCount = Pick<FarmObjective, 'withObjective' | 'total' | 'offSeason'>;

/**
 * Une partie seulement des planches a un objectif. Une planche hors saison
 * n'en a pas : l'eau reçue se compare alors à l'objectif sur les seules
 * planches qui en ont un, comme toute planche sans objectif (D-329).
 */
export function farmObjectivePartial(objective: ObjectiveBedCount): boolean {
  return objective.withObjective > 0 && objective.withObjective < objective.total;
}

/**
 * Sur quelles planches se lit le chiffre : « ferme entière », ou « 7 planches
 * sur 10 ont un objectif » (un seul « sur » par phrase, F443). Avec des
 * planches hors saison, le compte se fait sur les planches en saison et les
 * dit à part : « 7 planches sur 7 ont un objectif, 3 hors saison » (D-337).
 */
export function farmObjectiveScopeText(objective: ObjectiveBedCount): string {
  const offSeason = objective.offSeason ?? 0;
  if (offSeason > 0) return `${inSeasonText(objective.withObjective, objective.total - offSeason)}, ${offSeason} hors saison`;
  if (!farmObjectivePartial(objective)) return 'ferme entière';
  return withObjectiveText(objective.withObjective, objective.total);
}

/** « 7 planches sur 10 ont un objectif », « 1 planche sur 3 a un objectif ». */
function withObjectiveText(count: number, total: number): string {
  return `${count} planche${count > 1 ? 's' : ''} sur ${total} ${count > 1 ? 'ont' : 'a'} un objectif`;
}

/** Le compte des planches en saison : « aucune planche en saison » quand elles le sont toutes hors saison. */
function inSeasonText(count: number, inSeason: number): string {
  if (inSeason <= 0) return 'aucune planche en saison';
  if (count === 0) return `aucune planche sur ${inSeason} n’a d’objectif`;
  return withObjectiveText(count, inSeason);
}

/**
 * La phrase de l'objectif de la ferme, la même sur chaque page : « 5,2 mm
 * visés, ferme entière » ; « 23,4 mm visés, 7 planches sur 10 ont un
 * objectif » ; « aucune eau visée » quand aucune planche n'a d'objectif,
 * suivie du compte des planches hors saison quand il y en a (D-337).
 */
export function farmObjectiveText(objective: FarmObjective): string {
  if (objective.objectiveMm === null) {
    const offSeason = objective.offSeason ?? 0;
    return offSeason > 0 ? `aucune eau visée, ${offSeason} planche${offSeason > 1 ? 's' : ''} hors saison` : 'aucune eau visée';
  }
  return `${mmText(Math.round(objective.objectiveMm * 10) / 10)} visés, ${farmObjectiveScopeText(objective)}`;
}
