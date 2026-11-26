import { pageEnabled, type IrrigationPageId } from './pages';
import type { FeatureSelection } from './selection';

/**
 * Les trois endroits du module (simplification, lot S3,
 * docs/simplification-s3-contract.md, section 3 ; D-331) : le module se
 * range comme la journée, pas comme son calcul. Chaque page est dans un
 * endroit et un seul ; l'endroit répond à une question du maraîcher :
 *
 * - « Aujourd'hui » : qu'est-ce que je fais maintenant ?
 * - « Semaine » : est-ce que ma semaine est bonne ?
 * - « Ma ferme » : qu'est-ce que le module sait de ma ferme ?
 *
 * C'est le seul endroit qui le sait (AGENTS.md, une règle vit en un seul
 * endroit) : la page « Ma ferme », et après elle la barre du bas, le menu de
 * l'ordinateur, la bande de la semaine, le retour et la visite guidée,
 * l'appellent sans recopier la liste. Ajouter une page au module oblige à la
 * ranger : un test échoue pour une page sans endroit ou avec deux.
 *
 * La page d'accueil du module, l'écran de bienvenue, la page introuvable et
 * la page d'état de l'exploitant ne sont dans aucun endroit : ce ne sont pas
 * des pages du menu.
 */
export const PLACE_IDS = ['aujourdhui', 'semaine', 'ma-ferme'] as const;

export type PlaceId = (typeof PLACE_IDS)[number];

/**
 * Les fiches de « Ma ferme », dans l'ordre de la maquette : surtout des
 * réglages, qu'on ouvre à l'installation (contrat, section 5).
 */
export const FARM_CARD_PAGES = ['materiel', 'ressources', 'cultures', 'sol', 'alertes-meteo', 'alertes-cultures', 'reglages'] as const satisfies readonly IrrigationPageId[];

export type FarmCardPage = (typeof FARM_CARD_PAGES)[number];

/**
 * Les pages de chaque endroit, dans l'ordre où l'endroit les montre. La
 * première page cochée est l'entrée de l'endroit, celle qu'ouvre sa place
 * dans la barre (section 3.2) : « Aujourd'hui », la première page cochée de
 * la semaine (S4 lui donnera sa page, S3-a), « Ma ferme ».
 */
const PLACES: Readonly<Record<PlaceId, { label: string; pages: readonly IrrigationPageId[] }>> = {
  aujourdhui: { label: 'Aujourd’hui', pages: ['aujourdhui', 'arrosages'] },
  semaine: { label: 'Semaine', pages: ['planning', 'besoins', 'historique'] },
  'ma-ferme': { label: 'Ma ferme', pages: ['ma-ferme', ...FARM_CARD_PAGES] },
};

/** Le nom de l'endroit : sous son icône dans la barre, en titre de groupe du menu. */
export function placeLabel(place: PlaceId): string {
  return PLACES[place].label;
}

/** Toutes les pages d'un endroit, cochées ou non, dans son ordre. */
export function placePages(place: PlaceId): readonly IrrigationPageId[] {
  return PLACES[place].pages;
}

/** L'endroit d'une page. */
export function placeOfPage(page: IrrigationPageId): PlaceId {
  const place = PLACE_IDS.find((id) => PLACES[id].pages.includes(page));
  // Impossible tant que le test de la correspondance passe : chaque page a un endroit.
  if (!place) throw new RangeError(`Page sans endroit : ${page}`);
  return place;
}

/** Les pages d'un endroit que la ferme a, dans l'ordre de l'endroit : une case décochée retire sa page (section 3.2). */
export function enabledPlacePages(place: PlaceId, selection: FeatureSelection): IrrigationPageId[] {
  return PLACES[place].pages.filter((page) => pageEnabled(page, selection));
}

/**
 * La page qu'ouvre un endroit, ou `null` quand l'endroit n'existe pas pour
 * cette ferme (section 3.2) : « Aujourd'hui » quand l'une des huit cases de F1
 * est cochée, « Semaine » quand Planning, Objectifs et besoins ou Historique
 * l'est, « Ma ferme » toujours (« Réglages » n'a pas de case).
 */
export function placeEntry(place: PlaceId, selection: FeatureSelection): IrrigationPageId | null {
  return enabledPlacePages(place, selection)[0] ?? null;
}

/** Les endroits de la ferme, dans l'ordre de la barre ; un endroit sans page cochée disparaît. */
export function farmPlaces(selection: FeatureSelection): PlaceId[] {
  return PLACE_IDS.filter((place) => placeEntry(place, selection) !== null);
}

/** Les fiches de « Ma ferme » : les pages cochées de l'endroit, Réglages toujours (section 5). */
export function farmCardPages(selection: FeatureSelection): FarmCardPage[] {
  return FARM_CARD_PAGES.filter((page) => pageEnabled(page, selection));
}

/**
 * Les pages d'un endroit présentes dans un menu (`menuPages`, les pages que
 * la ferme a), dans l'ordre de l'endroit. La barre du bas, la bande de la
 * semaine et la page introuvable n'ont que le menu ; il dit les mêmes pages
 * que `enabledPlacePages` (le test des 235 choix de cases le vérifie).
 */
export function menuPlacePages(place: PlaceId, menu: readonly IrrigationPageId[]): IrrigationPageId[] {
  return PLACES[place].pages.filter((page) => menu.includes(page));
}

/**
 * La marque d'un endroit pour la page ouverte (précision S3-e) : `page`
 * quand la page ouverte est l'entrée même de l'endroit, `true` quand c'est
 * une autre page de l'endroit, `null` sinon. Le lecteur d'écran et la marque
 * visuelle disent la même chose.
 */
export function placeMark(place: PlaceId, entry: IrrigationPageId, current: IrrigationPageId | null): 'page' | 'true' | null {
  if (current === null || placeOfPage(current) !== place) return null;
  return current === entry ? 'page' : 'true';
}
