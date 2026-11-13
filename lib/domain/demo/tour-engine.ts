import { TOURS, tourById, type Tour, type TourId, type TourPage, type TourStep } from './tours.ts';

/**
 * Le déroulé des visites guidées (docs/demo-guided-contract.md, section 7 ;
 * D3), sans navigateur : quelle étape se joue où, laquelle vient ensuite, et
 * comment l'étape en cours se range et se relit. Le composant de la bulle ne
 * fait qu'appliquer ces réponses ; il ajoute seulement la règle qui demande
 * l'écran (l'élément visé est-il là et visible ?).
 */

/** Une visite en cours : laquelle, et l'indice de l'étape dans `tour.steps`. */
export type TourPosition = { tour: TourId; step: number };

/** La page ouverte et les pages que la ferme peut ouvrir (son menu). */
export type TourContext = { current: TourPage; reachable: readonly TourPage[] };

/**
 * La page où l'étape se joue : la page ouverte quand elle convient, sinon la
 * première des pages de l'étape que la ferme peut ouvrir ; `null` quand
 * aucune ne l'est (case décochée) : l'étape est alors sautée.
 */
export function stepPage(step: TourStep, context: TourContext): TourPage | null {
  if (!step.pages) return context.current;
  if (step.pages.includes(context.current)) return context.current;
  return step.pages.find((page) => context.reachable.includes(page)) ?? null;
}

export type PlayableStep = { index: number; page: TourPage };

/**
 * La première étape jouable à partir de `from` (incluse), en avançant
 * (`direction` 1) ou en reculant (-1) ; `null` quand il n'y en a plus.
 */
export function playableStep(tour: Tour, from: number, direction: 1 | -1, context: TourContext): PlayableStep | null {
  for (let index = from; index >= 0 && index < tour.steps.length; index += direction) {
    const page = stepPage(tour.steps[index], context);
    if (page !== null) return { index, page };
  }
  return null;
}

/**
 * Une visite s'offre quand la ferme a l'une des pages qu'elle demande et
 * qu'au moins une de ses étapes peut se jouer.
 */
export function isTourAvailable(tour: Tour, context: TourContext): boolean {
  if (tour.requires && !tour.requires.some((page) => context.reachable.includes(page) || context.current === page)) return false;
  return playableStep(tour, 0, 1, context) !== null;
}

export function availableTours(context: TourContext): readonly Tour[] {
  return TOURS.filter((tour) => isTourAvailable(tour, context));
}

/** La visite offerte après celle-ci, pour « Passer » ; `null` après la dernière. */
export function nextAvailableTour(id: TourId, context: TourContext): Tour | null {
  const tours = availableTours(context);
  const index = tours.findIndex((tour) => tour.id === id);
  return index >= 0 && index + 1 < tours.length ? tours[index + 1] : null;
}

/**
 * « Étape n sur N » : le rang de l'étape parmi celles que cette ferme peut
 * jouer, et leur nombre. `visible` dit, pour une étape de la page ouverte,
 * si son élément est à l'écran (le navigateur seul le sait) : une étape
 * sautée ne compte pas. Une étape d'une autre page compte d'avance.
 */
export function stepCount(
  tour: Tour,
  index: number,
  context: TourContext,
  visible: (step: TourStep) => boolean = () => true,
): { rank: number; total: number } {
  let rank = 0;
  let total = 0;
  tour.steps.forEach((step, stepIndex) => {
    const page = stepPage(step, context);
    if (page === null) return;
    if (stepIndex !== index && page === context.current && !visible(step)) return;
    total += 1;
    if (stepIndex <= index) rank += 1;
  });
  return { rank, total };
}

/** Le nom du paramètre d'adresse qui porte l'étape d'une page à l'autre, et de la clé rangée dans le navigateur. */
export const TOUR_URL_PARAMETER = 'visite';
export const TOUR_STORAGE_KEY = 'demo-visite';
export const TOURS_SEEN_STORAGE_KEY = 'demo-visites-vues';
export const TOUR_INVITATION_STORAGE_KEY = 'demo-visite-invitation';

/** `bienvenue.2` : la visite et l'indice de l'étape. */
export function serializePosition(position: TourPosition): string {
  return `${position.tour}.${position.step}`;
}

/**
 * L'étape lue dans l'adresse ou dans le navigateur. Une valeur abîmée, une
 * visite inconnue ou une étape hors de la visite donnent `null` : la visite
 * ne reprend pas, sans erreur.
 */
export function parsePosition(raw: string | null | undefined): TourPosition | null {
  if (!raw) return null;
  const match = /^([a-z-]+)\.(\d{1,3})$/.exec(raw);
  if (!match) return null;
  const tour = tourById(match[1]);
  const step = Number(match[2]);
  if (!tour || step >= tour.steps.length) return null;
  return { tour: tour.id, step };
}

/** Les visites déjà finies, rangées comme une liste d'identifiants séparés par des virgules. */
export function parseSeenTours(raw: string | null | undefined): TourId[] {
  if (!raw) return [];
  return raw.split(',').map((id) => tourById(id)?.id).filter((id): id is TourId => id !== undefined);
}

export function withSeenTour(seen: readonly TourId[], id: TourId): TourId[] {
  return seen.includes(id) ? [...seen] : [...seen, id];
}
