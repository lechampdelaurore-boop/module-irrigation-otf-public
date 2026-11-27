import type { ObjectiveBedReading } from './objective-reading.ts';

/**
 * Notifications only; decisions and water quantities remain on the server.
 * `source` names the block that sends it, so that it does not reread what it
 * has just saved and received (D-129).
 */
export function notifyFeasibilityChanged(source?: string) {
  window.dispatchEvent(new CustomEvent('irrigation-feasibility-source-changed', { detail: { source } }));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('irrigation-feasibility');
    channel.postMessage({ source }); channel.close();
  }
}

/** La source d'une notification de faisabilité, sur l'événement de la fenêtre comme sur le message du canal ; aucune pour les autres signaux. */
export function feasibilityNoticeSource(event: Event): string | undefined {
  const payload: unknown = 'data' in event ? (event as MessageEvent).data : (event as CustomEvent<unknown>).detail;
  if (typeof payload !== 'object' || payload === null || !('source' in payload)) return undefined;
  const { source } = payload as { source?: unknown };
  return typeof source === 'string' ? source : undefined;
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

/**
 * Le « + » de la barre du bas (simplification S3, section 4.1) : « Arroser
 * maintenant » et « Noter un arrosage déjà fait » ouvrent « Arrosages » sur
 * le formulaire « Arroser maintenant » ou « Déjà fait ». Le signal porte
 * le formulaire.
 */
export const IRRIGATION_FORM_REQUESTED = 'irrigation-form-requested';

export function requestIrrigationForm(kind: 'running' | 'completed') {
  window.dispatchEvent(new CustomEvent(IRRIGATION_FORM_REQUESTED, { detail: kind }));
}

/**
 * « Réglages » : un geste qui écrit au journal des modifications le dit une
 * fois réussi, et la section du journal se relit au serveur, sa ligne avec,
 * sans recharger la page (amélioration n° 7, écart E1 de la recette du
 * 22 novembre 2026 ; F746, D-294). Le signal ne porte rien.
 */
export const CHANGE_JOURNAL_CHANGED = 'irrigation-change-journal-changed';

export function notifyChangeJournalChanged() {
  window.dispatchEvent(new CustomEvent(CHANGE_JOURNAL_CHANGED));
}

/**
 * L'objectif de la ferme de la semaine, relu avec les besoins (S1, PR 3) :
 * la ligne de résumé et la tuile d'« Objectifs et besoins » le reprennent
 * tel quel, sans refaire la moyenne. Le signal porte la semaine, pour qu'une
 * réponse d'une autre semaine ne s'affiche pas.
 */
export const FARM_OBJECTIVE_READ = 'irrigation-farm-objective-read';

export type FarmObjectiveNotice = {
  weekStart: string;
  objective: { objectiveMm: number | null; withObjective: number; total: number };
  /**
   * L'objectif de chaque planche, tel que le besoin l'applique : le volet
   * « Objectifs de la semaine » en tire ses lignes « automatique » et la
   * valeur du champ (6 quaterdecies, A1, D-337), sans rien recalculer.
   */
  beds: ObjectiveBedReading[];
};

export function notifyFarmObjectiveRead(notice: FarmObjectiveNotice) {
  window.dispatchEvent(new CustomEvent<FarmObjectiveNotice>(FARM_OBJECTIVE_READ, { detail: notice }));
}
