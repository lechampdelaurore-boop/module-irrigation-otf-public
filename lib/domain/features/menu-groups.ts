import type { PageFeatureId } from './catalogue';
import type { IrrigationPageId } from './pages';

/**
 * Le menu du tableau de bord (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.1, précision T1) : « Aujourd'hui » détaché en tête, dans son
 * encart, puis les pages des cases cochées rangées en trois groupes titrés,
 * Réglages à part en bas. L'ordre des pages ne change pas : celui de la
 * liste des cases (P36), que les groupes suivent. Un groupe sans page cochée
 * disparaît.
 */

const MENU_GROUPS: readonly { title: string; pages: readonly PageFeatureId[] }[] = [
  { title: 'Arroser', pages: ['arrosages', 'planning', 'besoins', 'sol', 'cultures'] },
  { title: 'Équiper', pages: ['materiel', 'ressources'] },
  { title: 'Surveiller', pages: ['alertes-meteo', 'alertes-cultures', 'historique'] },
];

type MenuGroup = { title: string; pages: IrrigationPageId[] };

export type MenuLayout = {
  /** « Aujourd'hui » dans son encart, en tête. */
  today: boolean;
  groups: MenuGroup[];
  /** Réglages, à part en bas. */
  settings: boolean;
};

export function menuLayout(menu: readonly IrrigationPageId[]): MenuLayout {
  return {
    today: menu.includes('aujourdhui'),
    groups: MENU_GROUPS
      .map((group) => ({ title: group.title, pages: menu.filter((page) => (group.pages as readonly IrrigationPageId[]).includes(page)) }))
      .filter((group) => group.pages.length > 0),
    settings: menu.includes('reglages'),
  };
}
