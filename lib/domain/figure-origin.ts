import { millimetersText, volumeText } from './display-numbers.ts';

/**
 * La bulle « d'où vient ce chiffre » (3.8, docs/feature-selection-contract.md,
 * section 6) : elle met en mots les valeurs que le calcul a déjà produites,
 * avec les mêmes arrondis que l'écran ; elle ne refait jamais le calcul. Les
 * fonctions de chaque bulle vivent dans le module de leur calcul et
 * s'appuient sur ces formats.
 */

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const threeDecimals = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const twoDecimals = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « 12 mm », « 2,5 mm » : comme partout à l'écran (lot E, J8, F259). */
export function mmText(value: number): string {
  return millimetersText(value);
}

/** « 0,6 m³ », « 425 L » : comme partout à l'écran (lot E, J8, F258). */
export function cubicMetersText(value: number): string {
  return volumeText(value);
}

/** Un nombre à deux décimales au plus, sans unité : un coefficient, un débit. */
export function decimalText(value: number): string {
  return decimal.format(value);
}

/** « 64 % » : une part ou une jauge, à l'unité. */
export function percentText(value: number): string {
  return `${percent.format(value)} %`;
}

/** « 0,30 m », « 0,80 » : une profondeur ou un Kc, toujours à deux décimales, comme à l'écran. */
export function fixedTwoText(value: number): string {
  return twoDecimals.format(value);
}

/** « 6,67 mm/h » : un apport par heure. */
export function rateText(value: number): string {
  return `${decimal.format(value)} mm/h`;
}

/**
 * « 12,35 m³ », « 425 L » : un volume, comme partout à l'écran (lot E, J8,
 * F258) ; « 4,2 m³/h » : un débit, trois décimales au plus, hors de la règle
 * des volumes (F260).
 */
export function waterText(value: number, unit: 'm³' | 'm³/h'): string {
  return unit === 'm³' ? volumeText(value) : `${threeDecimals.format(value)} ${unit}`;
}
