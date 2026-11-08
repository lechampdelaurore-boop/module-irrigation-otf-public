/**
 * La recherche tapée dans une liste de noms (audit ergonomique, point 4,
 * 3.8 quater) : sans majuscules ni accents, chaque mot tapé doit se trouver
 * dans le libellé, dans n'importe quel ordre (« b9 clem » trouve « Planche ·
 * B9-3 » de la parcelle Clémentière quand le libellé porte les deux). Une
 * recherche vide garde tout.
 */
function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesSearch(label: string, query: string): boolean {
  const words = normalizeForSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const text = normalizeForSearch(label);
  return words.every((word) => text.includes(word));
}
