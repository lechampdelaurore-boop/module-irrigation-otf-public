import type { SpeciesModelLink } from './species.ts';

/**
 * Le modèle copiable des rattachements espèce-culture de la ferme du porteur
 * (4.4, docs/tranche-4-contract.md, F423, F428 réponse 4 ; F587) : des liens
 * « nom d'espèce → culture de référence du jeu commun » seulement, jamais un
 * identifiant d'Ouvre ta ferme ni une donnée de ferme.
 *
 * Vide jusqu'à la relecture de la liste par le porteur : l'extraction lit sa
 * ferme réelle et ce fichier est public, la liste n'y entre qu'après qu'il
 * l'a relue. Vide, l'étape propose d'après le nom seulement.
 */
export const SPECIES_MODEL_LINKS: readonly SpeciesModelLink[] = [];
