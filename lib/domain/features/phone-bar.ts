import type { IrrigationPageId } from './pages';
import { menuPlacePages, PLACE_IDS, placeMark, placeOfPage, type PlaceId } from './places';

/**
 * La barre du bas du téléphone (simplification, lot S3, PR 2,
 * docs/simplification-s3-contract.md, section 4 ; D-331) : les trois
 * endroits et le « + », à la place des quatre pages et de « Plus » (F6, lot
 * 2 de l'audit ergonomique). Dans cet ordre : Aujourd'hui, Semaine, « + »,
 * Ma ferme. Un endroit sans page cochée disparaît, les autres se partagent
 * la largeur ; le « + » n'existe que si l'un de ses gestes existe
 * (`plusGestures`). Toute page est à deux touches au plus : un endroit, puis
 * une fiche ou la bande de la semaine (« Arrosages » passe par le « + » ou par
 * « Aujourd'hui », section 3.4). Le menu de l'ordinateur ne change pas ici.
 */

type PhoneBarPlace = {
  kind: 'place';
  place: PlaceId;
  /** L'entrée de l'endroit : sa première page cochée (section 3.2). */
  page: IrrigationPageId;
  /** S3-e : `page` sur l'entrée même, `true` sur l'endroit d'une autre de ses pages. */
  current: 'page' | 'true' | null;
};

export type PhoneBarItem = PhoneBarPlace | { kind: 'plus' };

export function phoneBar(menu: readonly IrrigationPageId[], current: IrrigationPageId | null, plus: boolean): PhoneBarItem[] {
  const places = PLACE_IDS.flatMap((place): PhoneBarPlace[] => {
    const page = menuPlacePages(place, menu)[0];
    return page ? [{ kind: 'place', place, page, current: placeMark(place, page, current) }] : [];
  });
  if (!plus) return places;
  // Le « + » se pose avant « Ma ferme », au centre de ce qui reste (règle 1).
  const farm = places.findIndex((item) => item.place === 'ma-ferme');
  const at = farm === -1 ? places.length : farm;
  return [...places.slice(0, at), { kind: 'plus' }, ...places.slice(at)];
}

/**
 * La bande « La semaine » (section 3.3, S3-a) : sur une page de « Semaine »,
 * un lien par page cochée de l'endroit, au nom court ; `null` hors de
 * « Semaine » ou avec moins de deux pages cochées. S4 la retirera.
 */
export function weekBand(menu: readonly IrrigationPageId[], current: IrrigationPageId | null): IrrigationPageId[] | null {
  if (current === null || placeOfPage(current) !== 'semaine') return null;
  const pages = menuPlacePages('semaine', menu);
  return pages.length >= 2 ? pages : null;
}

/** Le retour « ‹ » vers les fiches (section 5.1) : sur toute page de « Ma ferme » hors « Ma ferme » elle-même. */
export function backToFarm(current: IrrigationPageId | null): boolean {
  return current !== null && current !== 'ma-ferme' && placeOfPage(current) === 'ma-ferme';
}

/** Le nom accessible du retour (section 5.1). */
export const BACK_TO_FARM_LABEL = 'Retour à Ma ferme';

/**
 * Le nom court d'une page de la semaine dans sa bande, celui qu'elle portait
 * dans la barre du bas d'avant (section 3.3) ; le nom complet reste le nom
 * accessible du lien.
 */
const SHORT_LABELS: Partial<Record<IrrigationPageId, string>> = {
  planning: 'Planning',
  besoins: 'Besoins',
  historique: 'Historique',
};

export function weekBandLabel(page: IrrigationPageId, fullLabel: string): string {
  return SHORT_LABELS[page] ?? fullLabel;
}
