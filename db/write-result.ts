/**
 * Est-ce qu'une écriture a bien touché une ligne ?
 *
 * `meta.changes` ne se lit pas seul. Le D1 réel ne le renseigne pas toujours
 * là où l'adaptateur SQLite des tests le fait, et un dépôt qui s'y fie annonce
 * alors un échec après une écriture réussie. Le défaut s'est vu deux fois sur
 * le site : archiver un matériel affichait « Ce matériel est introuvable »
 * alors que l'archivage avait eu lieu, et retirer la position d'une aspersion
 * répondait « Aucune position enregistrée » alors que la ligne était bien
 * partie — trouvé le 25 septembre 2026 par le parcours navigateur P8.
 *
 * `rows_written` dit la même chose par un autre chemin. Les deux sont donc
 * consultés, comme le faisait déjà `weatherRefreshClaimed` : la première
 * rencontre de ce piège avait été contournée sur place, sans être nommée.
 */
export function aEcritUneLigne(meta: {
  changes?: number;
  rows_written?: number;
} | undefined): boolean {
  if (!meta) return false;
  return Number(meta.changes ?? 0) > 0 || Number(meta.rows_written ?? 0) > 0;
}
