/**
 * Le jour à partir duquel une révision d'objectif hydrique compte.
 *
 * Règle du tableau des besoins (D-034), relue par l'historique et les cumuls
 * par série (D-039, point ouvert 40) : elle vit ici, en un seul endroit
 * (docs/irrigation-needs-contract.md, docs/series-contract.md).
 */
import type { GoalRevisionLike } from './irrigation-history/contract.ts';
import { FARM_TIME_ZONE, addDaysToDateKey, dateKeyInTimeZone } from './water-management.ts';

/** Une semaine va du lundi au dimanche (D-004) : sept jours civils. */
const DAYS_PER_WEEK = 7;

/**
 * Premier jour civil (clé `AAAA-MM-JJ`) à partir duquel la révision compte,
 * dans la semaine pour laquelle elle est posée :
 * - une reprise automatique de la semaine précédente compte dès le lundi ;
 * - posée avant ou pendant sa semaine, elle compte dès son jour de pose en
 *   heure de Paris, au plus tôt le lundi ;
 * - posée après sa semaine, elle ne la couvre pas : elle compte dès le lundi
 *   suivant, pour les semaines qui n'ont pas de révision plus récente.
 */
export function goalRevisionFirstDate(
  revision: Pick<GoalRevisionLike, 'weekStart' | 'createdAt' | 'copiedFromGoalId'>,
): string {
  if (revision.copiedFromGoalId) return revision.weekStart;
  const posedOn = dateKeyInTimeZone(revision.createdAt, FARM_TIME_ZONE);
  if (posedOn <= revision.weekStart) return revision.weekStart;
  const weekEnd = addDaysToDateKey(revision.weekStart, DAYS_PER_WEEK - 1);
  return posedOn <= weekEnd ? posedOn : addDaysToDateKey(revision.weekStart, DAYS_PER_WEEK);
}
