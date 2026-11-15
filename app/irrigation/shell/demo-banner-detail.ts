/**
 * Le détail de la bannière de la démonstration, au téléphone
 * (docs/audit-ergonomie-final-lot-f-contract.md, section 3 ; F289 et F291) :
 * fermé, il range les deux listes, la remise à zéro et les visites guidées
 * sous « Changer ». Une visite guidée qui doit présenter l'un de ces éléments
 * demande à la bannière de l'ouvrir, plutôt que de sauter l'étape.
 */

const OPEN_REQUEST = 'demonstration:ouvrir-le-detail';

/** Le repère du détail : `ferme` tant qu'il est replié au téléphone, `ouvert` sinon. */
export const DEMO_DETAIL_ATTRIBUTE = 'data-demo-detail';

/** Le bouton « Changer » qui ouvre et ferme le détail. */
export const DEMO_DETAIL_TOGGLE_SELECTOR = '.demo-banner-toggle';

/** L'élément est-il rangé dans le détail replié de la bannière ? */
export function isInFoldedDemoDetail(element: Element): boolean {
  return element.closest(`[${DEMO_DETAIL_ATTRIBUTE}]`)?.getAttribute(DEMO_DETAIL_ATTRIBUTE) === 'ferme';
}

/** Demande à la bannière d'ouvrir son détail ; elle le fait avant de rendre la main. */
export function openDemoDetail(): void {
  document.dispatchEvent(new Event(OPEN_REQUEST));
}

/** La bannière écoute la demande ; la fonction rendue cesse l'écoute. */
export function listenToDemoDetailRequests(open: () => void): () => void {
  document.addEventListener(OPEN_REQUEST, open);
  return () => document.removeEventListener(OPEN_REQUEST, open);
}
