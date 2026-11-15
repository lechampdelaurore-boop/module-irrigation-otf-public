import { litersFromCubicMeters } from './units.ts';

/**
 * Les volumes et les millimètres tels que l'écran les écrit (audit
 * ergonomique final, lot E, J8, docs/audit-ergonomie-final-lot-e-contract.md,
 * section 4, précisions F258 à F260). Un affichage seulement : le calcul
 * garde toute sa précision, et rien de ce qui est écrit ici ne revient dans
 * un calcul, un champ de saisie ou l'export.
 *
 * Hors de ces règles : les débits (m³/h, L/h), les vitesses (mm/h), les
 * limites en m³ par jour, les Kc, les surfaces et les distances.
 */

const cubicMeters = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const liters = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const millimeters = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Sous un litre entier, un volume non nul se dit « moins de 1 L », jamais « 0 L » (D-003). */
const SMALLEST_SHOWN_LITERS = 1;
/** Mille litres font un mètre cube : au-delà, le volume se lit en m³. */
const LITERS_SHOWN_IN_CUBIC_METERS = litersFromCubicMeters(1);

/**
 * « 3,14 m³ », « 12 m³ », « 425 L », « moins de 1 L », « 0 m³ » (F258) : en
 * m³ à deux décimales au plus, sans zéro inutile ; sous 1 m³, en litres
 * entiers. Un volume qui s'arrondit à 1 000 L se lit « 1 m³ ». Le signe d'un
 * écart se garde : « −300 L ».
 */
export function volumeText(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0 m³';
  const roundedLiters = Math.round(Math.abs(litersFromCubicMeters(value)));
  if (roundedLiters >= LITERS_SHOWN_IN_CUBIC_METERS) return `${cubicMeters.format(value)} m³`;
  if (roundedLiters < SMALLEST_SHOWN_LITERS) return 'moins de 1 L';
  return `${liters.format(litersFromCubicMeters(value))} L`;
}

/** Le nombre seul, à une décimale au plus : « 16,5 », « 12 » (F259). */
export function millimetersNumber(value: number): string {
  return millimeters.format(value);
}

/** « 16,5 mm », « 12 mm » (F259). */
export function millimetersText(value: number): string {
  return `${millimetersNumber(value)} mm`;
}
