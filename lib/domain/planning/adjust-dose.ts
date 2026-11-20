import { millimetersNumber } from '../display-numbers.ts';

/**
 * « Ajuster » une proposition (audit du 19 novembre 2026, lot K, n° 17,
 * F464) : le champ de la dose montre le chiffre de la carte, à une décimale
 * (« 8,1 », jamais « 8,06 » à côté de « 8,1 mm ») ; laissé tel quel, il rend
 * la dose exacte de la proposition, qu'un arrondi d'affichage ne change
 * jamais. Une dose tapée se lit telle quelle, à sa précision.
 */
export function adjustDoseText(proposalDoseMm: number): string {
  return millimetersNumber(proposalDoseMm);
}

export function adjustedDoseMm(input: string, proposalDoseMm: number, parse: (text: string) => number): number {
  return input.trim() === adjustDoseText(proposalDoseMm) ? proposalDoseMm : parse(input);
}
