import { isArbitrationEditable } from './arbitration-preview.ts';
import type { IrrigationFeasibility, PriorityFeasibility } from './irrigation-feasibility.ts';

/**
 * La faisabilité lue sur « Ressources » (docs/audit-ergonomie-final-lot-b-contract.md,
 * lot B de l'audit ergonomique final, R3) : quatre tuiles au plus, le reste
 * dans « Le détail du calcul », aucun bloc de priorité sans besoin.
 * Affichage seul : les nombres sont ceux du calcul de la faisabilité.
 */

/** Ce que montrent les quatre tuiles de tête quand rien n'attend un choix (F245). */
export type FeasibilityHeadTiles = {
  availableCubicMeters: number | null;
  needCubicMeters: number | null;
  /** Le besoin des planches chiffrées seulement, quand d'autres ne le sont pas : « au moins » (audit final, lot A, R2, F282). */
  knownNeedCubicMeters: number;
  /** Les planches au besoin non chiffré, et pourquoi : sans objectif adopté, ou sans surface mouillée connue (F282). */
  unknownNeed: { noObjective: number; noWettedArea: number };
  coveragePercent: number | null;
  /** Les planches servies en entier, parmi celles qui ont un besoin. */
  fullyServedBeds: number;
  bedsWithNeed: number;
};

/**
 * Les quatre tuiles de tête, ou `null` quand un niveau attend un choix :
 * l'écran de répartition porte alors les siennes (eau disponible, besoin,
 * part servie, planches servies), et la faisabilité n'en ajoute aucune.
 */
export function feasibilityHeadTiles(dashboard: Pick<IrrigationFeasibility, 'priorities' | 'forecastAvailableCubicMeters' | 'totalNeedCubicMeters' | 'knownNeedCubicMeters' | 'coveragePercent'>): FeasibilityHeadTiles | null {
  if (dashboard.priorities.some(isArbitrationEditable)) return null;
  const all = dashboard.priorities.flatMap((level) => level.beds);
  const rows = all.filter((row) => row.status !== 'no_need');
  const unknown = all.filter((row) => row.status === 'unknown');
  const noObjective = unknown.filter((row) => row.need.objectiveMm === null).length;
  return {
    availableCubicMeters: dashboard.forecastAvailableCubicMeters,
    needCubicMeters: dashboard.totalNeedCubicMeters,
    knownNeedCubicMeters: dashboard.knownNeedCubicMeters,
    unknownNeed: { noObjective, noWettedArea: unknown.length - noObjective },
    coveragePercent: dashboard.coveragePercent,
    fullyServedBeds: rows.filter((row) => row.status === 'full').length,
    bedsWithNeed: rows.length,
  };
}

/**
 * Un niveau de priorité à montrer (F246) : il a au moins une planche qui
 * n'est pas « Aucun besoin ». Une planche aux données insuffisantes compte :
 * une donnée inconnue ne se tait pas (D-003).
 */
export function isPriorityLevelShown(level: Pick<PriorityFeasibility, 'beds'>): boolean {
  return level.beds.some((row) => row.status !== 'no_need');
}
