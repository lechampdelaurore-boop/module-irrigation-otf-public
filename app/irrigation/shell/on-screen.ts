/**
 * L'élément est-il à l'écran ? Le contenu d'un pli fermé (`<details>`) ne
 * l'est pas, même quand Chrome lui donne une boîte et un `offsetParent`
 * (lot S4, PR 3, F933). La règle se lit dans la page, sans
 * `checkVisibility`, que Safari n'offre qu'à partir de sa version 17.4.
 */
export function isOnScreen(element: Element): boolean {
  return element.getClientRects().length > 0 && element.closest('details:not([open]) > :not(summary)') === null;
}
