/** Notifications only; decisions and water quantities remain on the server. */
export function notifyFeasibilityChanged() {
  window.dispatchEvent(new CustomEvent('irrigation-feasibility-source-changed'));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('irrigation-feasibility');
    channel.postMessage('changed'); channel.close();
  }
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
