'use client';

/**
 * Les icônes de la charte du module (docs/charte-module.md, « Icônes ») : au
 * trait, d'une seule couleur, celle du texte, épaisseur 1,7 px ; jamais
 * d'emoji ni de picto coloré. Toujours décoratives : le texte voisin porte le
 * sens. Le jeu grandit avec les écrans qui en ont besoin.
 */
const PATHS = {
  coche: 'M4.5 12.5l4.5 4.5L19.5 6.5',
  plus: 'M12 5v14M5 12h14',
  // Les entrées du menu (3.8, docs/feature-selection-contract.md, section 5) ;
  // goutte, calendrier, pousse, pluie, jauge, réglages et alerte sont ceux des maquettes de la charte.
  plan: 'M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2zM9 4.5v13M15 6.5v13',
  goutte: 'M12 3c3.5 4.2 6 7.2 6 10.2A6 6 0 0 1 6 13.2C6 10.2 8.5 7.2 12 3z',
  pluie: 'M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8a3.5 3.5 0 0 1 0 7M8 18l-1 3M12 18l-1 3M16 18l-1 3',
  calendrier: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M9 3v4M15 3v4',
  cuve: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3v12c0 1.7-3.1 3-7 3s-7-1.3-7-3zM5 6c0 1.7 3.1 3 7 3s7-1.3 7-3',
  jauge: 'M4 17a8 8 0 1 1 16 0M12 17l4-5',
  pousse: 'M12 21v-9M12 12C12 8 9 6 5 6c0 4 2 6 7 6zM12 14c0-3 2-5 6-5 0 3-2 5-6 5z',
  cloche: 'M6.5 16v-5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14zM10 20.5a2 2 0 0 0 4 0',
  alerte: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  courbe: 'M4 20h16M7 16v-4M12 16V8M17 16v-6',
  reglages: 'M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1',
  // Le calculateur d'irrigation (3.8 bis) : une calculette au trait.
  calcul: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 7h8v3H8zM8.5 14h.5M12 14h.5M15.5 14h.5M8.5 17.5h.5M12 17.5h.5M15.5 17.5h.5',
  aide: 'M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 17v.5',
  // Les tuiles de totaux (troisième passe, docs/charte-module.md) : l'objectif de la ferme.
  cible: 'M12 20a8 8 0 1 0 0-16a8 8 0 1 0 0 16zM12 15a3 3 0 1 0 0-6a3 3 0 1 0 0 6z',
  // La page « Aujourd'hui » (audit ergonomique, lot 2) : un soleil au trait.
  soleil: 'M12 16a4 4 0 1 0 0-8a4 4 0 1 0 0 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4',
  // La flèche d'un pli : vers le bas replié, retournée une fois déplié.
  'fleche-bas': 'M6 9l6 6 6-6',
  // Le tableau de bord « Aujourd'hui » (docs/aujourdhui-tableau-de-bord-contract.md) :
  // l'heure, le gel, la fiabilité, une prévision manquante, et les deux sortes de matériel.
  horloge: 'M12 20.5a8.5 8.5 0 1 0 0-17a8.5 8.5 0 1 0 0 17zM12 7.5V12l3 2',
  flocon: 'M12 2v20M4 7l16 10M4 17L20 7M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5',
  bouclier: 'M12 3l7 3v5.5c0 4.3-3 7.7-7 9.5-4-1.8-7-5.2-7-9.5V6zM9 12l2.2 2.2L15.5 10',
  nuage: 'M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 9a4.5 4.5 0 0 1 0 9z',
  asperseur: 'M12 21v-8M9 21h6M12 13c-3-1-5-3.5-6-6M12 13c3-1 5-3.5 6-6M12 13V5',
  rampe: 'M3 8h18M7 8v3M12 8v3M17 8v3M7 14.5c.6.8 1 1.3 1 1.9a1 1 0 0 1-2 0c0-.6.4-1.1 1-1.9zM12 14.5c.6.8 1 1.3 1 1.9a1 1 0 0 1-2 0c0-.6.4-1.1 1-1.9zM17 14.5c.6.8 1 1.3 1 1.9a1 1 0 0 1-2 0c0-.6.4-1.1 1-1.9z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
