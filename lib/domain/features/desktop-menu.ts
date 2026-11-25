import type { IrrigationPageId } from './pages';
import { menuPlacePages, PLACE_IDS, placeMark, type PlaceId } from './places';

/**
 * Le menu de l'ordinateur (simplification, lot S3, PR 3,
 * docs/simplification-s3-contract.md, section 6 ; D-331) : les trois
 * endroits, tous dépliés, à la place des groupes « Arroser, Équiper,
 * Surveiller » du tableau de bord (T1). À l'ordinateur la place existe : un
 * clic de moins pour changer de page est ce que cherche S3. Le rangement est
 * celui de la barre du bas, de la même fonction (`menuPlacePages`,
 * section 3.1) :
 *
 * - « Aujourd'hui » : la page « Aujourd'hui » dans son encart, avec sa
 *   pastille (F12), puis « Arrosages » ;
 * - « Semaine » : un titre, lien vers la première page cochée de la semaine
 *   (S3-a ; S4 lui donnera sa page), puis Planning de la semaine, Objectifs
 *   et besoins, Historique et cumuls ;
 * - « Ma ferme » : un titre, lien vers la page « Ma ferme », puis ses fiches
 *   dans l'ordre de la section 5, Réglages comprise : elle n'est plus à part.
 *
 * Un endroit sans page cochée disparaît. Le « + Arroser ou noter » en tête
 * vient de `plusGestures`, comme celui de la barre.
 */
type MenuPlace = {
  place: PlaceId;
  /** La page qu'ouvre le titre de l'endroit : son entrée (section 3.2). */
  entry: IrrigationPageId;
  /**
   * La marque du titre (S3-e) : `page` quand le titre mène à la page ouverte
   * et que la liste ne la répète pas ; `true` quand la page ouverte est
   * ailleurs dans l'endroit, ou répétée dans la liste, qui la marque `page` :
   * un lecteur d'écran ne l'entend qu'une fois.
   */
  mark: 'page' | 'true' | null;
  /** Les pages sous le titre ; l'entrée n'y est pas quand elle porte le nom de l'endroit (« Aujourd'hui », « Ma ferme »). */
  pages: IrrigationPageId[];
};

export function menuPlaces(menu: readonly IrrigationPageId[], current: IrrigationPageId | null): MenuPlace[] {
  return PLACE_IDS.flatMap((place): MenuPlace[] => {
    const pages = menuPlacePages(place, menu);
    const entry = pages[0];
    if (!entry) return [];
    // L'endroit qui est lui-même une page : son titre en est le lien, la liste ne la redit pas.
    const own = entry === place;
    const mark = placeMark(place, entry, current);
    return [{ place, entry, mark: own || mark === null ? mark : 'true', pages: own ? pages.slice(1) : pages }];
  });
}
