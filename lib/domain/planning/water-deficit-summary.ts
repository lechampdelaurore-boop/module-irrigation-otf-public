import type { SupplyBudget, WeeklyPlan } from './contract.ts';
import { waterDeficitDetail } from './presentation.ts';

/**
 * Le manque d'eau du résumé quand l'eau d'une chaîne servie est inconnue
 * (docs/planning-contract.md, « Interface (3.6) », le résumé ; point ouvert
 * 51, D-089) : sur une chaîne sans eau mobilisable connue — une réserve sans
 * stock observé, un matériel sans pompe ou sans origine —, le manque ne peut
 * pas être chiffré, et le résumé le dit au lieu d'un zéro que rien ne prouve
 * (D-003). Sous un arbitrage, aucune ligne de budget : rien ne change.
 */

const EPSILON = 1e-9;

/** Les chaînes servies dont l'eau mobilisable est inconnue : une ligne de budget sans eau chiffrée, pour une demande. */
export function unknownWaterChainCount(budgets: readonly SupplyBudget[]): number {
  return budgets.filter((budget) => budget.availableCubicMeters === null && budget.demandCubicMeters > EPSILON).length;
}

/**
 * Le manque d'eau tel que le résumé l'écrit : le volume chiffré quand toute
 * l'eau est connue ; sinon « non chiffré » quand aucune autre chaîne n'en
 * chiffre, « au moins » ce que les autres chiffrent.
 */
export function waterDeficitValue(waterCubicMeters: number, unknownChains: number, formatVolume: (cubicMeters: number) => string): string {
  if (unknownChains === 0) return formatVolume(waterCubicMeters);
  return waterCubicMeters > 0 ? `au moins ${formatVolume(waterCubicMeters)}` : 'non chiffré';
}

/** Le sous-titre de la carte : la limite journalière nommée comme avant, puis les chaînes à l'eau inconnue comptées. */
export function waterDeficitTileDetail(deficit: Pick<WeeklyPlan['deficit'], 'waterCubicMeters' | 'byReason'>, unknownChains: number): string {
  if (unknownChains === 0) return waterDeficitDetail(deficit);
  const chains = unknownChains > 1 ? `${unknownChains} chaînes` : 'une chaîne';
  if (deficit.waterCubicMeters <= 0) return `Eau mobilisable inconnue sur ${chains} : le manque ne peut pas y être chiffré`;
  return `${waterDeficitDetail(deficit)} ; eau mobilisable inconnue sur ${chains}, où le manque ne peut pas être chiffré`;
}
