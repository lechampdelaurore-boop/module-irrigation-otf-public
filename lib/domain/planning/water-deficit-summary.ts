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
 * Une planche en manque dont la surface mouillée est inconnue n'a pas de
 * volume : le total que son manque aurait grossi, le manque d'eau ou le
 * temps de pompage, se lit de même « au moins », ou « non chiffré » à zéro
 * (point ouvert 64, D-098).
 */

const EPSILON = 1e-9;
const WATER_DEFICIT_DETAIL = 'Ce que le stock et les ressources ne couvrent pas';
const PUMP_TIME_DEFICIT_DETAIL = 'Ce qui ne tient pas dans les plages horaires';
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
 * Ce que le manque d'eau ne chiffre pas : les chaînes servies à l'eau
 * inconnue (D-089) et les planches dont le manque d'eau a un volume inconnu
 * (D-098).
 */
export function uncountedWaterCount(deficit: Pick<WeeklyPlan['deficit'], 'unknownVolumeBeds'>, unknownChains: number): number {
  return unknownChains + (deficit.unknownVolumeBeds?.water ?? 0);
}

/**
 * Le manque d'eau tel que le résumé l'écrit : le volume chiffré quand rien
 * ne manque au compte ; sinon « non chiffré » quand rien d'autre n'en
 * chiffre, « au moins » ce que le reste chiffre. `uncounted` compte ce qui
 * n'est pas chiffré : les chaînes à l'eau inconnue et les planches au volume
 * inconnu (`uncountedWaterCount`).
 */
export function waterDeficitValue(waterCubicMeters: number, uncounted: number, formatVolume: (cubicMeters: number) => string): string {
  if (uncounted === 0) return formatVolume(waterCubicMeters);
  return waterCubicMeters > 0 ? `au moins ${formatVolume(waterCubicMeters)}` : 'non chiffré';
}

/** Le manque d'eau à signaler : chiffré, ou d'une planche au volume inconnu, dont le manque est sûr même sans volume. */
export function hasWaterDeficit(deficit: Pick<WeeklyPlan['deficit'], 'waterCubicMeters' | 'unknownVolumeBeds'>): boolean {
  return deficit.waterCubicMeters > 0 || (deficit.unknownVolumeBeds?.water ?? 0) > 0;
}

const capitalized = (text: string) => `${text.charAt(0).toLocaleUpperCase('fr-FR')}${text.slice(1)}`;
const unknownBedsText = (count: number) => (count > 1 ? `${count} planches au volume inconnu` : 'une planche au volume inconnu');

/**
 * Le sous-titre de la carte : la limite journalière nommée comme avant, puis
 * ce qui n'est pas chiffré, les chaînes à l'eau inconnue et les planches au
 * volume inconnu, comptées.
 */
export function waterDeficitTileDetail(deficit: Pick<WeeklyPlan['deficit'], 'waterCubicMeters' | 'byReason' | 'unknownVolumeBeds'>, unknownChains: number): string {
  const beds = deficit.unknownVolumeBeds?.water ?? 0;
  if (unknownChains === 0 && beds === 0) return waterDeficitDetail(deficit);
  const uncounted = [
    ...(unknownChains > 0 ? [`eau mobilisable inconnue sur ${unknownChains > 1 ? `${unknownChains} chaînes` : 'une chaîne'}`] : []),
    ...(beds > 0 ? [unknownBedsText(beds)] : []),
  ].join(' et ');
  if (deficit.waterCubicMeters <= 0) return `${capitalized(uncounted)} : le manque ne peut pas y être chiffré`;
  return `${waterDeficitDetail(deficit)} ; ${uncounted}, où le manque ne peut pas être chiffré`;
}

/** Le temps de pompage manquant tel que le résumé l'écrit : « au moins », ou « non chiffré » à zéro, quand une planche en manque a un volume inconnu. */
export function pumpTimeDeficitValue(deficit: Pick<WeeklyPlan['deficit'], 'pumpTimeCubicMeters' | 'unknownVolumeBeds'>, formatVolume: (cubicMeters: number) => string): string {
  return waterDeficitValue(deficit.pumpTimeCubicMeters, deficit.unknownVolumeBeds?.pumpTime ?? 0, formatVolume);
}

/** Le temps de pompage manquant à signaler : chiffré, ou d'une planche au volume inconnu. */
export function hasPumpTimeDeficit(deficit: Pick<WeeklyPlan['deficit'], 'pumpTimeCubicMeters' | 'unknownVolumeBeds'>): boolean {
  return deficit.pumpTimeCubicMeters > 0 || (deficit.unknownVolumeBeds?.pumpTime ?? 0) > 0;
}

/** Le sous-titre de la carte du temps de pompage : les plages horaires, puis les planches au volume inconnu comptées. */
export function pumpTimeDeficitDetail(deficit: Pick<WeeklyPlan['deficit'], 'pumpTimeCubicMeters' | 'unknownVolumeBeds'>): string {
  const beds = deficit.unknownVolumeBeds?.pumpTime ?? 0;
  if (beds === 0) return PUMP_TIME_DEFICIT_DETAIL;
  if (deficit.pumpTimeCubicMeters <= 0) return `${capitalized(unknownBedsText(beds))} : le manque ne peut pas y être chiffré`;
  return `${PUMP_TIME_DEFICIT_DETAIL} ; ${unknownBedsText(beds)}, où le manque ne peut pas être chiffré`;
}
