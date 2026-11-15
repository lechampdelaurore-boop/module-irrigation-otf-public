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
export function feasibilityHeadTiles(dashboard: Pick<IrrigationFeasibility, 'priorities' | 'forecastAvailableCubicMeters' | 'totalNeedCubicMeters' | 'coveragePercent'>): FeasibilityHeadTiles | null {
  if (dashboard.priorities.some(isArbitrationEditable)) return null;
  const rows = dashboard.priorities.flatMap((level) => level.beds).filter((row) => row.status !== 'no_need');
  return {
    availableCubicMeters: dashboard.forecastAvailableCubicMeters,
    needCubicMeters: dashboard.totalNeedCubicMeters,
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
