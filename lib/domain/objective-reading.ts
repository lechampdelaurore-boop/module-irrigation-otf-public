import type { BedIrrigationNeed } from './irrigation-needs.ts';

/**
 * L'objectif d'une planche lu de la même façon sur chaque page (audit
 * ergonomique final, lot A, R2, docs/audit-ergonomie-final-lot-a-contract.md,
 * section 4, précisions F281 et F282). Affichage seul : l'objectif adopté
 * reste celui que `objectiveForBed` lit pour le besoin, le planning, la
 * faisabilité et la fiche de la culture ; rien ici ne le calcule.
 *
 * Cause établie dans le code : chaque page lit le même objectif, mais un
 * total de jardin ou de ferme devient « Non calculable » dès qu'une seule
 * planche n'en a pas (D-003), sans dire pourquoi, et la fiche de la planche
 * nommait « applicable » ce que le reste du module appelle adopter (D-045).
 */

/** F281 : la différence entre les deux objectifs d'une planche, en une phrase. */
export const ADOPTED_OBJECTIVE_HELP = 'L’objectif adopté est celui que le besoin et le planning appliquent ; l’objectif proposé, calculé d’après la culture, ne s’applique que si vous l’adoptez.';

/** « 1 planche sur 5 », « 2 planches sur 5 ». */
function bedsOf(count: number, total: number): string {
  return `${count} planche${count > 1 ? 's' : ''} sur ${total}`;
}

/**
 * F282 : pourquoi le total d'un jardin ne se calcule pas. Le besoin d'une
 * planche n'est inconnu que faute d'objectif adopté (la pluie inconnue est
 * remplacée et listée, D-019) ; `null` quand toutes ont leur valeur.
 */
export function gardenUnknownReason<B extends Pick<BedIrrigationNeed, 'objectiveMm'>>(beds: readonly B[], value: (bed: B) => number | null): string | null {
  const unknown = beds.filter((bed) => value(bed) === null);
  if (unknown.length === 0) return null;
  const withoutObjective = unknown.filter((bed) => bed.objectiveMm === null).length;
  if (withoutObjective === unknown.length) return `${bedsOf(withoutObjective, beds.length)} sans objectif adopté`;
  return `${bedsOf(unknown.length, beds.length)} au besoin inconnu`;
}

/**
 * F282 : pourquoi le besoin de la semaine, sur « Ressources », n'est pas
 * chiffré en entier : les planches sans objectif adopté, puis celles dont la
 * surface mouillée manque pour passer des millimètres aux mètres cubes
 * (D-022). `null` quand aucune ne manque.
 */
export function feasibilityUnknownReason(unknown: { noObjective: number; noWettedArea: number }): string | null {
  const parts = [
    unknown.noObjective > 0 ? `${unknown.noObjective} planche${unknown.noObjective > 1 ? 's' : ''} sans objectif adopté` : null,
    unknown.noWettedArea > 0 ? `${unknown.noWettedArea} planche${unknown.noWettedArea > 1 ? 's' : ''} sans surface mouillée connue` : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(', ');
}
