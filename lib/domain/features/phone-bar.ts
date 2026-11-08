import type { IrrigationPageId } from './pages';

/**
 * La barre du bas du téléphone (audit ergonomique, point 2, 3.8 quater lot 2,
 * docs/audit-ergonomie-lot2-contract.md, section 4, précision F6) : quatre
 * entrées et « Plus », au lieu d'une bande de pages qui défile et cache les
 * dernières derrière un geste. Les quatre entrées sont prises, dans l'ordre de
 * priorité, parmi les pages de la ferme ; une page absente (case décochée)
 * laisse sa place à la suivante du menu. « Plus » ouvre toutes les pages du
 * menu, Réglages comprise. Un menu de cinq pages ou moins tient entier dans la
 * barre, sans « Plus ». Le menu de l'ordinateur ne change pas.
 */

/** Les pages de la barre, par ordre de priorité : ce qu'on ouvre au champ, « Aujourd'hui » en tête. */
const PHONE_BAR_PRIORITY: readonly IrrigationPageId[] = ['aujourdhui', 'arrosages', 'planning', 'ressources'];

/** Les entrées de la barre à côté de « Plus ». */
const PHONE_BAR_ENTRIES = 4;

/** Un menu de cette taille ou moins tient entier dans la barre, sans « Plus ». */
const PHONE_BAR_WHOLE_MENU = 5;

export type PhoneBar = {
  /** Les entrées de la barre, dans l'ordre du menu. */
  entries: IrrigationPageId[];
  /** Vrai quand une page du menu n'est pas dans la barre : « Plus » les ouvre toutes. */
  more: boolean;
  /** La page ouverte n'est pas dans la barre : « Plus » porte la pastille verte. */
  moreMarked: boolean;
};

export function phoneBar(menu: readonly IrrigationPageId[], current: IrrigationPageId | null): PhoneBar {
  if (menu.length <= PHONE_BAR_WHOLE_MENU) return { entries: [...menu], more: false, moreMarked: false };
  const chosen = new Set(PHONE_BAR_PRIORITY.filter((page) => menu.includes(page)).slice(0, PHONE_BAR_ENTRIES));
  for (const page of menu) {
    if (chosen.size >= PHONE_BAR_ENTRIES) break;
    chosen.add(page);
  }
  return {
    entries: menu.filter((page) => chosen.has(page)),
    more: true,
    moreMarked: current !== null && !chosen.has(current),
  };
}

/**
 * Le nom court d'une page sous son icône, dans la barre : une barre de
 * 390 px n'a qu'environ 75 px par entrée. Les noms qui tiennent en deux
 * lignes restent entiers ; le nom complet reste le nom accessible du lien.
 */
const PHONE_BAR_LABELS: Partial<Record<IrrigationPageId, string>> = {
  planning: 'Planning',
  besoins: 'Besoins',
  sol: 'Sol',
  cultures: 'Cultures',
  materiel: 'Matériel',
  ressources: 'Ressources',
  historique: 'Historique',
};

export function phoneBarLabel(page: IrrigationPageId, fullLabel: string): string {
  return PHONE_BAR_LABELS[page] ?? fullLabel;
}
