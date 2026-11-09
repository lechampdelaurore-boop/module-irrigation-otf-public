/** Notifications only; decisions and water quantities remain on the server. */
export function notifyFeasibilityChanged() {
  window.dispatchEvent(new CustomEvent('irrigation-feasibility-source-changed'));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('irrigation-feasibility');
    channel.postMessage('changed'); channel.close();
  }
}

/**
 * La page « Ressources et pompes » : une ressource ou une réserve créée,
 * modifiée ou rendue inactive dans le panneau des ressources, la gestion des
 * pompes relit son tableau au serveur, pour que la fiche d'une pompe la voie
 * sans recharger la page (point ouvert 60, D-093). Le signal ne porte rien.
 */
export const WATER_SOURCES_CHANGED = 'irrigation-water-sources-changed';

export function notifyWaterSourcesChanged() {
  window.dispatchEvent(new CustomEvent(WATER_SOURCES_CHANGED));
}

/**
 * Le volume d'un besoin se calcule sur la surface mouillée du matériel
 * positionné (D-022) : un placement qui change recalcule les besoins, qui
 * préviennent à leur tour la faisabilité.
 */
export function notifyNeedsSourceChanged() {
  window.dispatchEvent(new CustomEvent('irrigation-needs-source-changed'));
}

/** « Ajouter un créneau de sa main » (planning, 3.6) : le formulaire « Planifier » de la 2.7 s'ouvre sur son onglet. */
export const PLANNED_IRRIGATION_FORM_REQUESTED = 'irrigation-planned-form-requested';

export function requestPlannedIrrigationForm() {
  window.dispatchEvent(new CustomEvent(PLANNED_IRRIGATION_FORM_REQUESTED));
}
