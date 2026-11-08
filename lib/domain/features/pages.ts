import { PAGE_FEATURE_IDS, featureLabel, isPageFeatureId, type FeatureId, type PageFeatureId } from './catalogue';
import { firstEnabledFeature, type FeatureSelection } from './selection';
import { usesSpeciesCorrespondence } from './socle';

/**
 * Les pages et leurs adresses (docs/feature-selection-contract.md, section 5) :
 * une page par case, plus « Réglages » et l'écran de la première ouverture.
 * La saison, la parcelle et la semaine suivent d'une page à l'autre dans
 * l'adresse (précision P12).
 */

/**
 * Une case sans page (le calculateur) n'a pas d'adresse : elle vit dans la
 * page d'une autre. « Aujourd'hui » et « Réglages » sont des pages sans case.
 */
export type IrrigationPageId = 'aujourdhui' | PageFeatureId | 'reglages';

const IRRIGATION_BASE_PATH = '/irrigation';
export const WELCOME_PATH = `${IRRIGATION_BASE_PATH}/bienvenue`;

export function isIrrigationPageId(value: unknown): value is IrrigationPageId {
  return value === 'aujourdhui' || value === 'reglages' || isPageFeatureId(value);
}

/**
 * La page « Aujourd'hui » (audit ergonomique, point 1, 3.8 quater lot 2,
 * docs/audit-ergonomie-lot2-contract.md, section 5, précision F1) existe
 * quand l'une de ces huit cases est cochée ; Matériel, Calculateur et
 * Historique seuls ne la font pas naître.
 */
const TODAY_FEATURES = [
  'arrosages',
  'planning',
  'besoins',
  'sol',
  'cultures',
  'ressources',
  'alertes-meteo',
  'alertes-cultures',
] as const satisfies readonly FeatureId[];

export function hasTodayPage(selection: FeatureSelection): boolean {
  return TODAY_FEATURES.some((feature) => selection.includes(feature));
}

/**
 * La page d'arrivée du module (F1) : « Aujourd'hui » quand elle existe, sinon
 * la première page cochée, et « Réglages » pour un choix vide.
 */
export function landingPage(selection: FeatureSelection): IrrigationPageId {
  if (hasTodayPage(selection)) return 'aujourdhui';
  return firstEnabledFeature(selection) ?? 'reglages';
}

export type PageQuery = {
  season?: number | null;
  /** La parcelle choisie sur le plan. */
  zone?: string | null;
  /** Un jour de la semaine à ouvrir, `AAAA-MM-JJ`. */
  week?: string | null;
  refresh?: boolean;
  /** La page demandée n'est pas cochée : la page d'arrivée le dit une fois (P14). */
  absent?: boolean;
};

/** La ligne de la page d'arrivée quand la page demandée n'est pas cochée (section 5, P14). */
export const ABSENT_FEATURE_NOTICE = 'Cette fonctionnalité n’est pas cochée pour votre ferme.';

/** Le nom d'une page, au menu, en titre et dans l'onglet du navigateur. */
export function pageLabel(page: IrrigationPageId): string {
  if (page === 'aujourdhui') return 'Aujourd’hui';
  return page === 'reglages' ? 'Réglages' : featureLabel(page);
}

/**
 * Le titre de l'onglet du navigateur (audit ergonomique, point 7, 3.8
 * quater) : le nom de la page puis celui du module, pour reconnaître chaque
 * onglet et chaque page de l'historique du navigateur.
 */
const MODULE_TITLE = 'Irrigation';
export const PAGE_TITLE_TEMPLATE = `%s · ${MODULE_TITLE}`;
export const NOT_FOUND_LABEL = 'Page introuvable';

export function pageDocumentTitle(label: string): string {
  return PAGE_TITLE_TEMPLATE.replace('%s', label);
}

export type ReturnLink = { href: string; label: string };

/**
 * La page introuvable (audit ergonomique, point 7, 3.8 quater) ramène à la
 * page d'arrivée de la ferme — « Aujourd'hui » quand elle existe (lot 2, F1),
 * sinon la première page cochée —, au choix des fonctionnalités pour une
 * ferme qui n'a jamais ouvert le module, et à l'entrée du module quand la
 * session n'est pas lue.
 */
export function notFoundReturnLink(farm: { firstVisit: boolean; enabled: FeatureSelection } | null): ReturnLink {
  if (!farm) return { href: IRRIGATION_BASE_PATH, label: 'Revenir au module d’irrigation' };
  if (farm.firstVisit) return { href: WELCOME_PATH, label: 'Choisir vos fonctionnalités' };
  const landing = landingPage(farm.enabled);
  return { href: pageHref(landing), label: `Revenir à « ${pageLabel(landing)} »` };
}

/**
 * Le choix de la saison n'apparaît que là où il change ce que la page montre
 * (audit ergonomique, point 9, 3.8 quater). Les alertes météo valent pour
 * l'exploitation, quelle que soit la saison ; Réglages ne dépend de la saison
 * que par la correspondance des espèces, celles de la saison choisie.
 * « Aujourd'hui » montre toujours le jour du jour (lot 2, F2). La saison
 * reste dans l'adresse et suit vers les autres pages.
 */
export function pageUsesSeason(page: IrrigationPageId, selection: FeatureSelection): boolean {
  if (page === 'alertes-meteo' || page === 'aujourdhui') return false;
  if (page === 'reglages') return usesSpeciesCorrespondence(selection);
  return true;
}

export function pagePath(page: IrrigationPageId): string {
  return `${IRRIGATION_BASE_PATH}/${page}`;
}

export function pageHref(page: IrrigationPageId, query: PageQuery = {}, hash?: string): string {
  const params = new URLSearchParams();
  if (query.season !== undefined && query.season !== null) params.set('season', String(query.season));
  if (query.zone) params.set('zone', query.zone);
  if (query.week) params.set('week', query.week);
  if (query.refresh) params.set('refresh', '1');
  if (query.absent) params.set('absente', '1');
  const search = params.toString();
  return `${pagePath(page)}${search ? `?${search}` : ''}${hash ? `#${hash.replace(/^#/, '')}` : ''}`;
}

/** La page qu'une adresse désigne, ou `null` pour `/irrigation` seule et toute autre adresse. */
export function pageFromPathname(pathname: string): IrrigationPageId | null {
  const match = /^\/irrigation\/([a-z-]+)\/?$/.exec(pathname);
  return match && isIrrigationPageId(match[1]) ? match[1] : null;
}

export type PageAccess =
  | { kind: 'open' }
  /** La ferme n'a jamais ouvert le module : elle choisit d'abord ses cases (R5). */
  | { kind: 'welcome' }
  /** La page n'est pas cochée : la page d'arrivée, avec la ligne qui le dit. */
  | { kind: 'not-enabled'; page: IrrigationPageId };

/**
 * Ce qu'une page fait de la ferme qui la demande : s'ouvrir, ou conduire
 * ailleurs (R1, R5, P10). « Aujourd'hui » sans aucune de ses huit cases se
 * comporte comme une page non cochée (F1).
 */
export function pageAccess(page: IrrigationPageId, firstVisit: boolean, selection: FeatureSelection): PageAccess {
  if (firstVisit) return { kind: 'welcome' };
  if (page === 'reglages') return { kind: 'open' };
  if (page === 'aujourdhui' ? hasTodayPage(selection) : selection.includes(page)) return { kind: 'open' };
  return { kind: 'not-enabled', page: landingPage(selection) };
}

/** Les pages du menu, dans l'ordre de la liste : « Aujourd'hui » en tête quand elle existe, les cases cochées, puis Réglages. */
export function menuPages(selection: FeatureSelection): IrrigationPageId[] {
  const today: IrrigationPageId[] = hasTodayPage(selection) ? ['aujourdhui'] : [];
  return [...today, ...PAGE_FEATURE_IDS.filter((id) => selection.includes(id)), 'reglages'];
}

/**
 * Les anciennes adresses (précision P14). Avant la 3.8, tout tenait sur
 * `/irrigation` et les notifications désignaient un bloc par son ancre ;
 * l'ancre dit désormais quelle page porte ce bloc, par ordre de préférence.
 */
const LEGACY_ANCHOR_PAGES: readonly { matches: (anchor: string) => boolean; pages: readonly PageFeatureId[] }[] = [
  // Les alertes météo ouvraient le tableau des jours de la semaine, sur la
  // page des besoins ; sans elle, la page des alertes garde leur historique.
  { matches: (anchor) => anchor === 'weather', pages: ['besoins', 'alertes-meteo'] },
  // La fin d'un arrosage ouvrait sa carte.
  { matches: (anchor) => anchor.startsWith('irrigation-'), pages: ['arrosages'] },
  // L'arrêt d'arrosage avant récolte ouvrait le suivi par série.
  { matches: (anchor) => anchor === 'series-water-title', pages: ['historique', 'alertes-cultures'] },
  // La notification du matin et les aspersions à reconsidérer ouvraient le planning.
  { matches: (anchor) => anchor === 'planning' || anchor === 'planning-title', pages: ['planning', 'alertes-cultures'] },
];

export type LegacyRedirect = {
  page: IrrigationPageId;
  /** Vrai quand l'ancre désignait une fonctionnalité que la ferme n'a pas cochée. */
  notEnabled: boolean;
};

/** Où conduire une ancienne adresse `/irrigation#…` ; sans ancre, à la page d'arrivée (P10, F1). */
export function legacyRedirect(hash: string, selection: FeatureSelection): LegacyRedirect {
  const anchor = decodeURIComponent(hash.replace(/^#/, ''));
  const first = landingPage(selection);
  if (!anchor) return { page: first, notEnabled: false };
  const rule = LEGACY_ANCHOR_PAGES.find((item) => item.matches(anchor));
  if (!rule) return { page: first, notEnabled: false };
  const page = rule.pages.find((id) => selection.includes(id));
  return page ? { page, notEnabled: false } : { page: first, notEnabled: true };
}
