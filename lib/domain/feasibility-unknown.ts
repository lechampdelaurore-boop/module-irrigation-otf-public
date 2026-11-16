import type { IrrigationFeasibility, PriorityFeasibility } from './irrigation-feasibility.ts';
import { feasibilityUnknownReason } from './objective-reading.ts';
import { namesText } from './today/today-text.ts';

/**
 * Pourquoi un chiffre de la faisabilité, sur « Ressources », ne se calcule
 * pas (audit ergonomique final, lot D, N1, docs/audit-ergonomie-final-lot-d-contract.md,
 * section 5 ter, F315, F316). La raison est celle que le calcul expose déjà :
 * les planches sans objectif adopté ou sans surface mouillée (F282), les
 * réserves dont le volume ou la prévision manque. Quand le calcul ne la
 * connaît pas, la raison générale renvoie à « Fiabilité du calcul ». Aucune
 * règle de calcul ici : la faisabilité reste ce qu'elle est (D-003).
 */

/** La raison quand le calcul ne sait pas laquelle des données manque (F315). */
export const GENERAL_UNKNOWN_REASON = 'une donnée manque : voir Fiabilité du calcul';

export type FeasibilityUnknownReasons = {
  /** Le besoin de la semaine, et tout ce qui se rapporte à lui : déficit, part servie, couverture. */
  need: string;
  /** L'eau mobilisable maintenant, d'après les stocks. */
  current: string;
  /** L'eau disponible d'ici dimanche soir, d'après les prévisions. */
  forecast: string;
};

export function feasibilityUnknownReasons(dashboard: Pick<IrrigationFeasibility, 'priorities' | 'pools'>): FeasibilityUnknownReasons {
  const unknown = dashboard.priorities.flatMap((level) => level.beds).filter((row) => row.status === 'unknown');
  const noObjective = unknown.filter((row) => row.need.objectiveMm === null).length;
  const need = feasibilityUnknownReason({ noObjective, noWettedArea: unknown.length - noObjective });
  return {
    need: need === null ? GENERAL_UNKNOWN_REASON : `besoin non chiffré pour ${need}`,
    current: waterReason(dashboard.pools, (pool) => pool.currentCubicMeters, 'volume non renseigné'),
    forecast: waterReason(dashboard.pools, (pool) => pool.forecastCubicMeters, 'prévision inconnue'),
  };
}

function waterReason(
  pools: IrrigationFeasibility['pools'],
  value: (pool: IrrigationFeasibility['pools'][number]) => number | null,
  missing: string,
): string {
  if (pools.length === 0) return 'aucune ressource en service';
  const names = pools.filter((pool) => value(pool) === null).map((pool) => pool.name);
  return names.length === 0 ? GENERAL_UNKNOWN_REASON : `${missing} pour ${namesText(names)}`;
}

/** Pourquoi les chiffres d'une planche ne se calculent pas : son objectif, sa surface mouillée, ou la raison générale. */
export function bedUnknownReason(need: Pick<PriorityFeasibility['beds'][number]['need'], 'objectiveMm' | 'wettedAreaSquareMeters'>): string {
  if (need.objectiveMm === null) return 'aucun objectif adopté';
  if (need.wettedAreaSquareMeters === null || !(need.wettedAreaSquareMeters > 0)) return 'surface mouillée inconnue';
  return GENERAL_UNKNOWN_REASON;
}

/** Une ligne « Non calculable : raison. », la forme du besoin d'une planche sur « Objectifs et besoins » (F282, F316). */
export function notComputableLine(reason: string): string {
  return `Non calculable : ${reason}.`;
}

/** Dans une phrase, après un nom : « Couverture confirmée : Non calculable (raison) » (F316). */
export function notComputableInline(reason: string): string {
  return `Non calculable (${reason})`;
}
