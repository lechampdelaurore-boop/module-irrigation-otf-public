import type { FeatureId } from './catalogue';
import type { FeatureSelection } from './selection';

/**
 * La page « Semaine » (simplification, lot S4, docs/simplification-s4-contract.md,
 * sections 3.1 et 3.2) : une page, pas une case de plus. Elle réunit ce que
 * montraient « Planning de la semaine », « Objectifs et besoins » et
 * « Historique et cumuls », en deux vues : « La semaine » et « Les cumuls ».
 *
 * C'est le seul endroit qui sait, pour une sélection de cases, si la page
 * existe, quelles vues et quelles sections elle contient (AGENTS.md, une
 * règle vit en un seul endroit) : la page, le menu de l'ordinateur, la barre
 * du bas, les anciennes adresses et la visite l'appellent sans recopier la
 * liste. Les trois cases, leur page de réglage et leurs dépendances ne
 * changent pas : une case décochée retire ce qu'elle apporte.
 */

/** Les trois cases dont la page « Semaine » porte le contenu (section 3.1). */
export const WEEK_PAGE_FEATURES = ['planning', 'besoins', 'historique'] as const satisfies readonly FeatureId[];

export type WeekPageFeature = (typeof WEEK_PAGE_FEATURES)[number];

export function isWeekPageFeature(value: unknown): value is WeekPageFeature {
  return (WEEK_PAGE_FEATURES as readonly unknown[]).includes(value);
}

/** La page existe quand l'une des trois cases est cochée ; sans aucune, pas de page. */
export function weekPageExists(selection: FeatureSelection): boolean {
  return WEEK_PAGE_FEATURES.some((feature) => selection.includes(feature));
}

/**
 * Les deux vues (précision S4-b) : « La semaine » répond à « est-ce que ma
 * semaine est bonne ? », « Les cumuls » est l'analyse qu'on fait rarement
 * (mois, saison, dates à la main, filtres, série). Une seconde vue de la
 * même page, pas une page à part : `?vue=cumuls` dans l'adresse.
 */
const WEEK_VIEW_IDS = ['semaine', 'cumuls'] as const;

export type WeekViewId = (typeof WEEK_VIEW_IDS)[number];

/** Le paramètre de l'adresse qui dit la vue, et la valeur de la seconde ; la première n'en a pas. */
export const WEEK_VIEW_PARAM = 'vue';
export const CUMULS_VIEW_VALUE = 'cumuls';

/**
 * La demande « Noter la pluie » portée par l'adresse (lot S4, PR 4, section
 * 9) : `?pluie=1` ouvre la fenêtre de « Noter la pluie » de « Semaine »
 * (8.3), comme `?recalculer=1` recalcule le plan (`useUrlIntent`). La ligne
 * « Pluie réelle incomplète » de la fiabilité y mène.
 */
export const WEEK_RAIN_INTENT = 'pluie';

/** La case d'où vient chaque vue : le planning exige « Objectifs et besoins », dont la vue « La semaine » suit. */
const VIEW_FEATURE: Readonly<Record<WeekViewId, WeekPageFeature>> = {
  semaine: 'besoins',
  cumuls: 'historique',
};

/**
 * Les vues de la ferme, dans l'ordre du sélecteur ; vide quand la page
 * n'existe pas. Se lit des cases cochées, ou des pages du menu, qui portent
 * les mêmes identifiants (`menuPages`).
 */
export function weekViews(selection: readonly string[]): WeekViewId[] {
  return WEEK_VIEW_IDS.filter((view) => selection.includes(VIEW_FEATURE[view]));
}

/** Le nom de la vue, au sélecteur et au menu de l'ordinateur (S4-m). */
export function weekViewLabel(view: WeekViewId): string {
  return view === 'semaine' ? 'La semaine' : 'Les cumuls';
}

/**
 * La vue qu'ouvre une adresse (section 3.2) : `?vue=cumuls` quand la ferme a
 * les cumuls ; sinon la première de ses vues, « La semaine » quand elle
 * existe, « Les cumuls » pour une ferme qui n'a coché que l'historique ;
 * `null` quand la page n'existe pas.
 */
export function resolveWeekView(value: string | string[] | undefined, selection: FeatureSelection): WeekViewId | null {
  const views = weekViews(selection);
  if (value === CUMULS_VIEW_VALUE && views.includes('cumuls')) return 'cumuls';
  return views[0] ?? null;
}

/**
 * Le sélecteur de vue (section 3.2) n'existe que quand les deux vues
 * existent : il se place sous le titre, dans la ligne que S3 réservait à la
 * bande de la semaine.
 */
export function weekViewSelector(selection: readonly string[]): WeekViewId[] | null {
  const views = weekViews(selection);
  return views.length >= 2 ? views : null;
}

/**
 * Les sections de la vue « La semaine », dans l'ordre de la section 7.1 du
 * contrat, chacune avec la case qui l'apporte. Une case décochée retire ses
 * sections, rien d'autre.
 */
export const WEEK_SECTIONS = [
  /** Ce qu'il reste à arroser : le besoin par planche, par jardin. */
  { id: 'reste-a-arroser', feature: 'besoins' },
  /** Le plan de la semaine : ses créneaux à valider, son calcul, ses budgets, ses suggestions, ses planches non servies. */
  { id: 'plan', feature: 'planning' },
  /** L'eau visée : les objectifs, l'objectif automatique, le choix du lieu. */
  { id: 'eau-visee', feature: 'besoins' },
  /** La pluie mesurée : saisir un autre jour, remplacer, retirer. */
  { id: 'pluie-mesuree', feature: 'besoins' },
  /** La météo de référence : le lieu, l'actualisation. */
  { id: 'meteo', feature: 'besoins' },
  /** Les jours de la semaine, un par un : pluie, ET0, volumes, limite. */
  { id: 'jours', feature: 'besoins' },
  /** L'écart du prévu des trois dernières semaines, lu à la demande. */
  { id: 'ecart-du-prevu', feature: 'planning' },
  /**
   * Les réglages de la semaine : ceux du planning et les heures où l'on
   * n'arrose pas (Planning coché), le seuil minimal de planification des
   * besoins (S4, PR 2) ; la section existe avec la vue.
   */
  { id: 'reglages', feature: 'besoins' },
] as const satisfies readonly { id: string; feature: WeekPageFeature }[];

export type WeekSectionId = (typeof WEEK_SECTIONS)[number]['id'];

/**
 * Les ancres de deux sections du détail, que d'autres pages visent (lot S4,
 * PR 4) : la fiche d'une planche de « Matériel » mène à « Ce qu'il reste à
 * arroser », le manque que la faisabilité de « Ressources » ne voit pas à
 * « Le plan, chaîne par chaîne ».
 */
export const NEEDS_SECTION_ANCHOR = 'reste-a-arroser';
export const PLAN_SECTION_ANCHOR = 'le-plan';

/** Les sections que la vue « La semaine » contient pour ces cases, dans l'ordre. */
export function weekSections(selection: FeatureSelection): WeekSectionId[] {
  return WEEK_SECTIONS.filter((section) => selection.includes(section.feature)).map((section) => section.id);
}

/**
 * La vue qui porte le contenu d'une ancienne page (section 3.3) : le planning
 * et les besoins sont dans « La semaine », l'historique dans « Les cumuls ».
 */
export function weekViewOfFeature(feature: WeekPageFeature): WeekViewId {
  return feature === 'historique' ? 'cumuls' : 'semaine';
}

/**
 * L'ancre du suivi par série, dans la vue « Les cumuls » : elle ouvre sa
 * lecture « Par série » (section 7.4), que visaient les anciennes
 * notifications d'arrêt avant la récolte (`legacyRedirect`).
 */
export const SERIES_WATER_ANCHOR = 'series-water-title';

/**
 * Le relevé des ancres (section 7.4) : chaque identifiant qu'un lien, une
 * notification, une visite ou un parcours vise sur l'une des trois anciennes
 * pages, avec la case qui le porte ; tous vivent dans la vue « La semaine »,
 * sauf le suivi par série, dans « Les cumuls ». `prefix` : l'identifiant est
 * suivi de celui d'une proposition (`proposalAnchor`) ou d'un jardin
 * (`needsGardenAnchor`). Un test vérifie que chacun est posé dans le code de
 * la page, un parcours qu'il existe à l'écran ; les plis du détail (PR 2)
 * s'ouvrent sur eux.
 */
export const WEEK_ANCHORS = [
  { anchor: 'irrigation-needs-title', feature: 'besoins' },
  { anchor: 'besoin-jardin-', feature: 'besoins', prefix: true },
  { anchor: 'planning', feature: 'planning' },
  { anchor: 'planning-title', feature: 'planning' },
  { anchor: 'proposal-', feature: 'planning', prefix: true },
  { anchor: 'objectifs-de-la-semaine', feature: 'besoins' },
  { anchor: 'manual-rain', feature: 'besoins' },
  { anchor: 'meteo-de-reference', feature: 'besoins' },
  { anchor: 'weather', feature: 'besoins' },
  { anchor: 'reglages-de-la-page', feature: 'besoins' },
  { anchor: SERIES_WATER_ANCHOR, feature: 'historique' },
] as const satisfies readonly { anchor: string; feature: WeekPageFeature; prefix?: true }[];

/** L'entrée du relevé qui porte une ancre (`#` compris ou non), ou `null` pour une ancre qui n'est pas de la page. */
export function weekAnchor(hash: string): (typeof WEEK_ANCHORS)[number] | null {
  const id = hash.replace(/^#/, '');
  return WEEK_ANCHORS.find((entry) => ('prefix' in entry ? id.startsWith(entry.anchor) && id.length > entry.anchor.length : id === entry.anchor)) ?? null;
}
