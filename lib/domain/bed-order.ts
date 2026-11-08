import type { Bed } from './domain.ts';

/**
 * L'ordre naturel des noms (audit ergonomique, point 4, 3.8 quater) : les
 * nombres d'un nom se comparent comme des nombres (B9-9 avant B9-10, BF-0 à
 * BF-5, la planche zéro en premier), sans tenir compte des majuscules ni des
 * accents. Planches, jardins, parcelles et matériels se rangent par cette seule
 * règle ; deux noms égaux se départagent par leur identifiant, pour un ordre
 * stable d'un affichage à l'autre.
 */
const nameCollator = new Intl.Collator('fr-FR', {
  numeric: true,
  sensitivity: 'base',
});

export function compareNamesNaturally(left: string, right: string): number {
  return nameCollator.compare(left, right);
}

export function sortByNameNaturally<T>(
  items: readonly T[],
  name: (item: T) => string,
  id: (item: T) => string,
): T[] {
  return [...items].sort((left, right) =>
    compareNamesNaturally(name(left), name(right)) || compareNamesNaturally(id(left), id(right)));
}

export function sortBedsByName(beds: readonly Bed[]): Bed[] {
  return sortByNameNaturally(beds, (bed) => bed.name, (bed) => bed.id);
}
