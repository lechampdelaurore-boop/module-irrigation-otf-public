import { expect } from '@playwright/test';
import { cubicMetersFromLiters } from '../../lib/domain/units.ts';

/**
 * Un volume tel que l'écran l'écrit (audit final, lot E, J8, F258) : en m³ à
 * deux décimales au plus (« 3,14 m³ », « 1 250 m³ »), en litres entiers sous
 * 1 m³ (« 425 L »), « moins de 1 L » sous le demi-litre. À glisser dans une
 * expression régulière.
 */
export const VOLUME_ECRIT = String.raw`(?:\d[\d  ]*(?:,\d{1,2})? m³|\d[\d  ]* L|moins de 1 L)`;

/** Le premier volume écrit que suit `suivant` dans le texte, en m³ ; « moins de 1 L » vaut 0. */
export function metresCubesLus(texte: string, suivant = ''): number {
  const trouve = texte.match(new RegExp(`(${VOLUME_ECRIT})${suivant ? ` ${suivant}` : ''}`));
  expect(trouve, `un volume écrit dans « ${texte} »`).not.toBeNull();
  const ecrit = trouve![1];
  if (ecrit === 'moins de 1 L') return 0;
  const nombre = Number(ecrit.replace(/ (m³|L)$/, '').replace(/[  ]/g, '').replace(',', '.'));
  return ecrit.endsWith(' L') ? cubicMetersFromLiters(nombre) : nombre;
}
