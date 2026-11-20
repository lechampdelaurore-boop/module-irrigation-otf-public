import type { SpeciesModelLink } from './species.ts';

/**
 * Le modèle copiable des rattachements espèce-culture de la ferme du porteur
 * (4.4, docs/tranche-4-contract.md, F423, F428 réponse 4 ; PR 4c, F587 ;
 * PR 4d, F590) : des liens « nom d'espèce → culture de référence du jeu
 * commun » seulement, jamais un identifiant d'Ouvre ta ferme ni une donnée de
 * ferme.
 *
 * Relevé le 20 novembre 2026, en lecture seule, dans « Réglages »,
 * « Correspondance des espèces » de la ferme du porteur, saison 2026 :
 * 77 espèces, dont 40 rattachées à une culture de référence (11 par
 * analogie), reprises ici telles quelles. Les 36 espèces « sans référence
 * Kc » (fleurs) et l'engrais vert (état de la surface du sol) n'y entrent
 * pas : le modèle ne propose qu'une culture de référence. Une nouvelle ferme
 * voit chaque proposition et décoche celles qu'elle ne garde pas.
 */
export const SPECIES_MODEL_LINKS: readonly SpeciesModelLink[] = [
  { species: 'Ail', referenceCropId: 'criiam-ail', analogy: false },
  { species: 'Arroche', referenceCropId: 'fao-epinard', analogy: true },
  { species: 'Aubergine', referenceCropId: 'criiam-aubergine', analogy: false },
  { species: 'Betterave', referenceCropId: 'criiam-betterave', analogy: false },
  { species: 'Blette', referenceCropId: 'fao-epinard', analogy: true },
  { species: 'Carotte', referenceCropId: 'criiam-carotte', analogy: false },
  { species: 'Céleri branche', referenceCropId: 'fao-celeri', analogy: false },
  { species: 'Céleri-rave', referenceCropId: 'fao-celeri', analogy: true },
  { species: 'Chicorée frisée', referenceCropId: 'criiam-salade-ete', analogy: true },
  { species: 'Chicorée scarole', referenceCropId: 'criiam-salade-ete', analogy: true },
  { species: 'Chou blanc', referenceCropId: 'fao-cruciferes', analogy: false },
  { species: 'Chou de Milan', referenceCropId: 'fao-cruciferes', analogy: false },
  { species: 'Chou kale', referenceCropId: 'fao-cruciferes', analogy: false },
  { species: 'Chou pë-tsaï', referenceCropId: 'fao-cruciferes', analogy: false },
  { species: 'Chou pointu', referenceCropId: 'fao-cruciferes', analogy: false },
  { species: 'Chou rouge', referenceCropId: 'fao-cruciferes', analogy: false },
  { species: 'Concombre', referenceCropId: 'fao-concombre', analogy: false },
  { species: 'Courge', referenceCropId: 'fao-potiron', analogy: false },
  { species: 'Courgette', referenceCropId: 'criiam-courgette', analogy: false },
  { species: 'Épinard', referenceCropId: 'fao-epinard', analogy: false },
  { species: 'Fenouil', referenceCropId: 'fao-celeri', analogy: true },
  { species: 'Fève', referenceCropId: 'fao-feve', analogy: false },
  { species: 'Haricot', referenceCropId: 'criiam-haricot', analogy: false },
  { species: 'Laitue', referenceCropId: 'criiam-salade-ete', analogy: false },
  { species: 'Mâche', referenceCropId: 'criiam-salade-ete', analogy: true },
  { species: 'Melon', referenceCropId: 'criiam-melon', analogy: false },
  { species: 'Mesclun', referenceCropId: 'criiam-salade-ete', analogy: true },
  { species: 'Navet', referenceCropId: 'fao-navet', analogy: false },
  { species: 'Oignon', referenceCropId: 'fao-oignon-vert', analogy: false },
  { species: 'Panais', referenceCropId: 'criiam-carotte', analogy: true },
  { species: 'Pastèque', referenceCropId: 'fao-pasteque', analogy: false },
  { species: 'Patate douce', referenceCropId: 'fao-patate-douce', analogy: false },
  { species: 'Persil', referenceCropId: 'fao-celeri', analogy: true },
  { species: 'Poireau', referenceCropId: 'criiam-poireau', analogy: false },
  { species: 'Pois', referenceCropId: 'fao-petit-pois', analogy: false },
  { species: 'Radis botte', referenceCropId: 'fao-radis', analogy: false },
  { species: 'Radis rave', referenceCropId: 'fao-navet', analogy: true },
  { species: 'Tomate', referenceCropId: 'criiam-tomate', analogy: false },
  { species: 'Tomate ancienne pop mélange', referenceCropId: 'criiam-tomate', analogy: false },
  { species: 'Tomate cerise', referenceCropId: 'criiam-tomate', analogy: false },
];
