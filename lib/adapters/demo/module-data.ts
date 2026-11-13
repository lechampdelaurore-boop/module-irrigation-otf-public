/**
 * Ce que chaque ferme fictive a déjà réglé dans le module à sa première
 * ouverture (docs/demo-guided-contract.md, section 6 ; D2) : le rattachement
 * de ses espèces aux cultures de référence du catalogue Kc validé
 * (migration 0023) et au jeu commun des seuils de gel (migration 0026).
 * Aucune valeur agronomique ici : seulement des clés de ces deux jeux, que
 * la ferme choisirait elle-même dans Réglages et dans Alertes cultures.
 */

/** L'espèce d'Ouvre ta ferme (fictive) → la culture de référence du catalogue Kc. */
export const DEMO_SPECIES_REFERENCES: Readonly<Record<string, string>> = {
  'plante-carotte': 'criiam-carotte',
  'plante-epinard': 'fao-epinard',
  'plante-tomate': 'criiam-tomate',
  'plante-courgette': 'criiam-courgette',
  'plante-salade': 'criiam-salade-ete',
  'plante-radis': 'fao-radis',
  'plante-poireau': 'criiam-poireau',
  'plante-oignon': 'criiam-oignon',
  'plante-haricot': 'criiam-haricot',
  'plante-pomme-de-terre': 'criiam-pomme-de-terre',
  'plante-fraisier': 'criiam-fraisier',
};

/**
 * L'espèce → l'entrée du jeu commun des seuils de gel. Le fraisier n'y a
 * aucune valeur (« aucune valeur trouvée ») : il reste sans rattachement,
 * comme le ferait une vraie ferme.
 */
export const DEMO_FROST_COMMON_KEYS: Readonly<Record<string, string>> = {
  'plante-carotte': 'carotte',
  'plante-epinard': 'epinard',
  'plante-tomate': 'tomate',
  'plante-courgette': 'courgette',
  'plante-salade': 'laitue-mesclun',
  'plante-radis': 'radis',
  'plante-poireau': 'poireau',
  'plante-oignon': 'oignon-jaune',
  'plante-haricot': 'haricot',
  'plante-pomme-de-terre': 'pomme-de-terre',
};
