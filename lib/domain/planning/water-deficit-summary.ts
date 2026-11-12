import { formatWaterVolumeForMessage } from '../irrigation-format.ts';
import type { SupplyBudget, WeeklyPlan } from './contract.ts';

/**
 * Le manque d'eau du résumé quand l'eau d'une chaîne servie est inconnue
 * (docs/planning-contract.md, « Interface (3.6) », le résumé ; point ouvert
 * 51, D-089) : sur une chaîne sans eau mobilisable connue — une réserve sans
 * stock observé, un matériel sans pompe ou sans origine —, le manque ne peut
 * pas être chiffré, et le résumé le dit au lieu d'un zéro que rien ne prouve
 * (D-003). Sous un arbitrage, aucune ligne de budget : rien ne change. Le
 * pli des changements d'un recalcul l'écrit de même (point ouvert 59, D-090).
 */

const EPSILON = 1e-9;
const WATER_DEFICIT_DETAIL = 'Ce que le stock et les ressources ne couvrent pas';
/** Un manque sous un millième de litre est un résidu d'arrondi, pas une part à nommer. */
const NEGLIGIBLE_CUBIC_METERS = 1e-6;

/**
 * Le sous-titre du manque d'eau du résumé : nomme la limite journalière
 * quand c'est elle qui coupe, en tout ou en partie (docs/planning-contract.md,
 * « Pénurie », point ouvert 35, corrigé le 9 octobre 2026).
 */
export function waterDeficitDetail(deficit: Pick<WeeklyPlan['deficit'], 'waterCubicMeters' | 'byReason'>): string {
  const byLimit = deficit.byReason['daily-limit'] ?? 0;
  if (byLimit <= NEGLIGIBLE_CUBIC_METERS) return WATER_DEFICIT_DETAIL;
  if (byLimit >= deficit.waterCubicMeters - NEGLIGIBLE_CUBIC_METERS) return 'Ce que la limite journalière ne laisse pas placer';
  return `${WATER_DEFICIT_DETAIL}, dont ${formatWaterVolumeForMessage(byLimit)} m³ par la limite journalière`;
}

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
