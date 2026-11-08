/**
 * La bulle « d'où vient ce chiffre » (3.8, docs/feature-selection-contract.md,
 * section 6) : elle met en mots les valeurs que le calcul a déjà produites,
 * avec les mêmes arrondis que l'écran ; elle ne refait jamais le calcul. Les
 * fonctions de chaque bulle vivent dans le module de leur calcul et
 * s'appuient sur ces formats.
 */

const millimeters = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const cubicMeters = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const threeDecimals = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const twoDecimals = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « 12 mm », « 2,5 mm » : comme les besoins et la météo à l'écran. */
export function mmText(value: number): string {
  return `${millimeters.format(value)} mm`;
}

/** « 0,60 m³ » : comme les volumes à l'écran. */
export function cubicMetersText(value: number): string {
  return `${cubicMeters.format(value)} m³`;
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

/** « 12,345 m³ », « 4,2 m³/h » : un volume ou un débit d'eau, trois décimales au plus, comme les ressources à l'écran. */
export function waterText(value: number, unit: 'm³' | 'm³/h'): string {
  return `${threeDecimals.format(value)} ${unit}`;
}
