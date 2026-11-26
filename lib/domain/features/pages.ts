import { PAGE_FEATURE_IDS, featureLabel, isPageFeatureId, type FeatureId, type PageFeatureId } from './catalogue';
import { firstEnabledFeature, type FeatureSelection } from './selection';
import { usesSpeciesCorrespondence } from './socle';
import { CUMULS_VIEW_VALUE, SERIES_WATER_ANCHOR, WEEK_VIEW_PARAM, isWeekPageFeature, weekPageExists, weekViewOfFeature, type WeekPageFeature, type WeekViewId } from './week-page';

/**
 * Les pages et leurs adresses (docs/feature-selection-contract.md, section 5) :
 * une page par case, plus « Réglages » et l'écran de la première ouverture.
 * La saison, la parcelle et la semaine suivent d'une page à l'autre dans
 * l'adresse (précision P12).
 */

/**
 * Une case sans page (le calculateur) n'a pas d'adresse : elle vit dans la
 * page d'une autre. « Aujourd'hui », « Semaine », « Ma ferme » et
 * « Réglages » sont des pages sans case. « Ma ferme » est l'entrée de
 * l'endroit du même nom (simplification, lot S3, docs/simplification-s3-contract.md,
 * section 5 ; D-331) : ses fiches mènent aux pages de réglage de la ferme.
 * « Semaine » réunit le planning, les besoins et l'historique (lot S4,
 * docs/simplification-s4-contract.md, section 3 ; précision S4-a) : ces
 * trois identifiants restent ceux des cases et des anciennes adresses, qui
 * mènent à « Semaine » (`weekRedirectHref`).
 */
export type IrrigationPageId = 'aujourdhui' | PageFeatureId | 'semaine' | 'ma-ferme' | 'reglages';

const IRRIGATION_BASE_PATH = '/irrigation';
export const WELCOME_PATH = `${IRRIGATION_BASE_PATH}/bienvenue`;

export function isIrrigationPageId(value: unknown): value is IrrigationPageId {
  return value === 'aujourdhui' || value === 'semaine' || value === 'ma-ferme' || value === 'reglages' || isPageFeatureId(value);
}

/** Toutes les pages du module, dans l'ordre du menu. */
export const IRRIGATION_PAGE_IDS: readonly IrrigationPageId[] = ['aujourdhui', ...PAGE_FEATURE_IDS, 'semaine', 'ma-ferme', 'reglages'];

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
  /**
   * La page demandée n'est pas cochée : la page d'arrivée le dit une fois
   * (P14), en la nommant quand on la connaît (audit final, lot E, J11, F265).
   */
  absent?: boolean | IrrigationPageId;
  /** L'onglet de « Matériel » (audit du 19 novembre 2026, lot J, n° 15, F461) ; le plan sans paramètre. */
  tab?: 'materiel' | 'groupes';
  /** La vue de « Semaine » (lot S4, S4-b) : `cumuls` pour la seconde ; la première n'a pas de paramètre. */
  view?: WeekViewId | null;
};

/** La ligne de la page d'arrivée quand la page demandée n'est pas cochée et qu'on ne sait pas laquelle (section 5, P14). */
export const ABSENT_FEATURE_NOTICE = 'Cette fonctionnalité n’est pas cochée pour votre ferme.';

/** Le bloc de Réglages où se cochent les fonctionnalités, que la ligne d'une page non cochée désigne (F265). */
export const FEATURE_SETTINGS_ANCHOR = 'fonctionnalites';

export type AbsentPageNotice = {
  text: string;
  /** Le lien vers le bloc « Fonctionnalités de la ferme » de Réglages. */
  settingsLabel: string;
};

/**
 * La ligne d'une page non cochée (audit final, lot E, J11, F265) : elle
 * nomme la page demandée, que l'adresse porte (`?absente=arrosages`), et
 * mène à Réglages. « Aujourd'hui » n'a pas de case : elle n'a aucune de ses
 * fonctionnalités cochées. Une ancienne adresse (`?absente=1`) ou une page
 * inconnue garde la phrase d'avant, avec le même lien.
 */
export function absentPageNotice(value: string | string[] | undefined): AbsentPageNotice | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value === 'aujourdhui' || value === 'semaine') {
    return { text: `La page « ${pageLabel(value)} » n’a aucune de ses fonctionnalités cochées pour votre ferme.`, settingsLabel: 'Les cocher dans Réglages' };
  }
  if (isPageFeatureId(value)) return { text: `La page « ${pageLabel(value)} » n’est pas cochée pour votre ferme.`, settingsLabel: 'La cocher dans Réglages' };
  return { text: ABSENT_FEATURE_NOTICE, settingsLabel: 'La cocher dans Réglages' };
}

/** Le nom d'une page, au menu, en titre et dans l'onglet du navigateur. */
export function pageLabel(page: IrrigationPageId): string {
  if (page === 'aujourdhui') return 'Aujourd’hui';
  if (page === 'semaine') return 'Semaine';
  if (page === 'ma-ferme') return 'Ma ferme';
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
 * « Aujourd'hui » montre toujours le jour du jour (lot 2, F2). Sur
 * « Arrosages », on travaille presque toujours dans la saison en cours : le
 * choix la quitte (simplification, lot S1, F824). La saison reste dans
 * l'adresse et suit vers les autres pages ; une autre saison s'ouvre depuis
 * « Historique et cumuls » (F825). « Ma ferme » la montre et la transmet à
 * chaque fiche, qui s'en sert presque toutes ; ses marques « À faire »
 * comptent les jardins, les parcelles et les espèces de la saison (lot S3,
 * section 5).
 */
export function pageUsesSeason(page: IrrigationPageId, selection: FeatureSelection): boolean {
  if (page === 'alertes-meteo' || page === 'aujourdhui' || page === 'arrosages') return false;
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
  if (query.absent) params.set('absente', query.absent === true ? '1' : query.absent);
  if (query.tab) params.set('onglet', query.tab);
  if (query.view === 'cumuls') params.set(WEEK_VIEW_PARAM, CUMULS_VIEW_VALUE);
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
  /** La page n'est pas cochée : la page d'arrivée, avec la ligne qui nomme la page demandée (F265). */
  | { kind: 'not-enabled'; page: IrrigationPageId; requested: IrrigationPageId };

/**
 * La ferme a-t-elle cette page ? « Réglages » et « Ma ferme » toujours (elles
 * n'ont pas de case), « Aujourd'hui » quand l'une de ses huit cases est
 * cochée (F1), « Semaine » quand l'une de ses trois l'est (lot S4,
 * section 3.1), toute autre page quand sa case l'est.
 */
export function pageEnabled(page: IrrigationPageId, selection: FeatureSelection): boolean {
  if (page === 'reglages' || page === 'ma-ferme') return true;
  if (page === 'semaine') return weekPageExists(selection);
  return page === 'aujourdhui' ? hasTodayPage(selection) : selection.includes(page);
}

/**
 * Ce qu'une page fait de la ferme qui la demande : s'ouvrir, ou conduire
 * ailleurs (R1, R5, P10). « Aujourd'hui » sans aucune de ses huit cases se
 * comporte comme une page non cochée (F1) ; « Ma ferme », comme « Réglages »,
 * s'ouvre toujours, sauf à la première visite (lot S3, section 5).
 */
export function pageAccess(page: IrrigationPageId, firstVisit: boolean, selection: FeatureSelection): PageAccess {
  if (firstVisit) return { kind: 'welcome' };
  if (pageEnabled(page, selection)) return { kind: 'open' };
  return { kind: 'not-enabled', page: landingPage(selection), requested: page };
}

/**
 * Les pages du menu, dans l'ordre de la liste : « Aujourd'hui » en tête quand
 * elle existe, les cases cochées, « Semaine » quand elle existe (lot S4),
 * puis « Ma ferme » et Réglages. La barre du bas et le menu de l'ordinateur
 * les rangent en trois endroits (lot S3, PR 2 et 3 : `phoneBar`,
 * `menuPlaces`) ; la liste dit seulement lesquelles existent. Les cases du
 * planning, des besoins et de l'historique y restent : elles disent ce que
 * « Semaine » contient, et ce que les gestes du « + » et la visite trouvent.
 */
export function menuPages(selection: FeatureSelection): IrrigationPageId[] {
  const today: IrrigationPageId[] = hasTodayPage(selection) ? ['aujourdhui'] : [];
  const week: IrrigationPageId[] = weekPageExists(selection) ? ['semaine'] : [];
  return [...today, ...PAGE_FEATURE_IDS.filter((id) => selection.includes(id)), ...week, 'ma-ferme', 'reglages'];
}

/**
 * La page qui montre ce que porte une page de la liste : elle-même, sauf le
 * planning, les besoins et l'historique, que montre « Semaine » depuis le
 * lot S4 (section 3.3). La visite guidée y joue leurs étapes.
 */
export function displayedPage(page: IrrigationPageId): IrrigationPageId {
  return isWeekPageFeature(page) ? 'semaine' : page;
}

/**
 * Où mène l'adresse d'une des trois anciennes pages de la semaine (lot S4,
 * section 3.3, précision S4-o) : à « Semaine », sur la vue qui porte son
 * contenu (l'historique, « Les cumuls »), avec tous les paramètres de
 * l'adresse (saison, semaine, parcelle, « Actualiser », l'intention d'un
 * lien comme `recalculer`). L'ancre, qui ne parvient jamais au serveur, est
 * gardée par le navigateur à travers la redirection. Ces adresses ne sont
 * jamais retirées : les notifications déjà envoyées les portent.
 */
export function weekRedirectHref(feature: WeekPageFeature, params: Readonly<Record<string, string | string[] | undefined>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === WEEK_VIEW_PARAM) continue;
    for (const item of typeof value === 'string' ? [value] : value ?? []) search.append(key, item);
  }
  if (weekViewOfFeature(feature) === 'cumuls') search.set(WEEK_VIEW_PARAM, CUMULS_VIEW_VALUE);
  const query = search.toString();
  return `${pagePath('semaine')}${query ? `?${query}` : ''}`;
}

/**
 * Les anciennes adresses (précision P14). Avant la 3.8, tout tenait sur
 * `/irrigation` et les notifications désignaient un bloc par son ancre ;
 * l'ancre dit désormais quelle page porte ce bloc, par ordre de préférence :
 * la case qui porte le bloc, et la page où il vit. Depuis le lot S4
 * (section 9), les blocs du planning, des besoins et de l'historique vivent
 * sur « Semaine », l'historique dans la vue « Les cumuls ».
 */
type LegacyTarget = { feature: PageFeatureId; page: IrrigationPageId; view?: WeekViewId };

const LEGACY_ANCHOR_PAGES: readonly { matches: (anchor: string) => boolean; targets: readonly LegacyTarget[] }[] = [
  // Les alertes météo ouvraient le tableau des jours de la semaine, sur la
  // page des besoins ; sans elle, la page des alertes garde leur historique.
  { matches: (anchor) => anchor === 'weather', targets: [{ feature: 'besoins', page: 'semaine' }, { feature: 'alertes-meteo', page: 'alertes-meteo' }] },
  // La fin d'un arrosage ouvrait sa carte.
  { matches: (anchor) => anchor.startsWith('irrigation-'), targets: [{ feature: 'arrosages', page: 'arrosages' }] },
  // L'arrêt d'arrosage avant récolte ouvrait le suivi par série.
  { matches: (anchor) => anchor === SERIES_WATER_ANCHOR, targets: [{ feature: 'historique', page: 'semaine', view: 'cumuls' }, { feature: 'alertes-cultures', page: 'alertes-cultures' }] },
  // La notification du matin et les aspersions à reconsidérer ouvraient le planning.
  { matches: (anchor) => anchor === 'planning' || anchor === 'planning-title', targets: [{ feature: 'planning', page: 'semaine' }, { feature: 'alertes-cultures', page: 'alertes-cultures' }] },
];

export type LegacyRedirect = {
  page: IrrigationPageId;
  /** La vue de « Semaine » qui porte le bloc, quand c'est « Les cumuls ». */
  view?: WeekViewId;
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
  const target = rule.targets.find((item) => selection.includes(item.feature));
  if (!target) return { page: first, notEnabled: true };
  return target.view ? { page: target.page, view: target.view, notEnabled: false } : { page: target.page, notEnabled: false };
}

/**
 * Le script qui conduit `/irrigation` sans ancre à la page d'arrivée dès que
 * le navigateur lit la page (lenteur du module, N2, D-323) : l'application
 * installée s'ouvre sur `/irrigation`, et la conduite attendait jusque-là que
 * tous les scripts du module soient chargés et l'écran repris, pour recharger
 * ensuite. Une ancre, qui ne parvient jamais au serveur, laisse la conduite à
 * `legacyRedirect`, côté navigateur, comme avant.
 */
export function landingRedirectScript(href: string): string {
  if (!/^\/irrigation\/[a-z-]+(\?[A-Za-z0-9=&%-]*)?$/.test(href)) throw new RangeError('Adresse de la page d’arrivée illisible.');
  return `if(!window.location.hash)window.location.replace(${JSON.stringify(href)});`;
}
