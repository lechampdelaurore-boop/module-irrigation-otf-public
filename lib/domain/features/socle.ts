import type { FeatureId } from './catalogue';
import type { FeatureSelection } from './selection';

/**
 * Le socle (docs/feature-selection-contract.md, section 3) : ce qui n'est pas
 * une case mais sert à plusieurs, affiché dès qu'une case cochée en a besoin,
 * et les parties de case qui ont besoin d'une case que la leur n'exige pas
 * (précision P1).
 */

const hasAny = (selection: FeatureSelection, ids: readonly FeatureId[]) => ids.some((id) => selection.includes(id));

/** Les cases qui lisent la météo de la ferme : elle n'est relevée que pour elles (P4). */
const WEATHER_FEATURES: readonly FeatureId[] = ['besoins', 'sol', 'cultures', 'alertes-meteo', 'alertes-cultures'];

/** Les cases qui envoient une notification sur le téléphone. */
const PUSH_FEATURES: readonly FeatureId[] = ['arrosages', 'planning', 'alertes-meteo', 'alertes-cultures'];

/** Les cases qui lisent la correspondance des espèces d'Ouvre ta ferme avec les cultures du jeu commun (P3). */
const SPECIES_FEATURES: readonly FeatureId[] = ['cultures', 'alertes-cultures'];

/** Les cases dont un calcul dépend de l'abri d'un jardin : la pluie qu'il reçoit, son coefficient d'abri (4.4, F583). */
const PLOT_SHELTER_FEATURES: readonly FeatureId[] = ['besoins', 'planning', 'sol', 'cultures', 'alertes-cultures'];

export function usesPlotShelters(selection: FeatureSelection): boolean {
  return hasAny(selection, PLOT_SHELTER_FEATURES);
}

export function usesWeather(selection: FeatureSelection): boolean {
  return hasAny(selection, WEATHER_FEATURES);
}

export function usesPushNotifications(selection: FeatureSelection): boolean {
  return hasAny(selection, PUSH_FEATURES);
}

export function usesSpeciesCorrespondence(selection: FeatureSelection): boolean {
  return hasAny(selection, SPECIES_FEATURES);
}

/** Une partie de case qui a besoin d'une autre case (P1). */
export type FeaturePart = {
  id: 'sprinkler-reconsideration' | 'feasibility' | 'stage-advice';
  /** La case qui la porte. */
  feature: FeatureId;
  /** La case dont elle a besoin en plus. */
  needs: FeatureId;
  /** La ligne qui la remplace quand la case manque. */
  missingNotice: string;
};

const FEATURE_PARTS: readonly FeaturePart[] = [
  {
    id: 'sprinkler-reconsideration',
    feature: 'alertes-cultures',
    needs: 'planning',
    missingNotice: 'Les aspersions à reconsidérer demandent le Planning de la semaine.',
  },
  {
    id: 'feasibility',
    feature: 'ressources',
    needs: 'besoins',
    missingNotice: 'La faisabilité et la répartition en cas de manque demandent Objectifs et besoins.',
  },
  {
    // Le conseil lit le stade du jour de chaque culture (5 quater) : amélioration n° 4, F732.
    id: 'stage-advice',
    feature: 'ressources',
    needs: 'cultures',
    missingNotice: 'Le conseil selon le stade sensible des cultures demande Besoin par culture.',
  },
];

export function isPartActive(selection: FeatureSelection, partId: FeaturePart['id']): boolean {
  const part = FEATURE_PARTS.find((item) => item.id === partId);
  if (!part) return false;
  return selection.includes(part.feature) && selection.includes(part.needs);
}

export function featurePart(partId: FeaturePart['id']): FeaturePart {
  const part = FEATURE_PARTS.find((item) => item.id === partId);
  if (!part) throw new Error(`Partie inconnue : ${partId}`);
  return part;
}
