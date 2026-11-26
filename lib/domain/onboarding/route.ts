import { joinLabels } from '../features/choice.ts';
import type { FeatureId } from '../features/catalogue.ts';
import type { FeatureSelection } from '../features/selection.ts';

/**
 * La mise en route d'une ferme (simplification, lot S6,
 * docs/simplification-s6-contract.md, section 5 ; D-336) : jusqu'à cinq
 * étapes pour décrire la ferme, dans cet ordre. Une étape **existe quand sa
 * case est cochée** (une case décochée retire sa page, donc sa fiche, donc
 * son étape). C'est le seul endroit qui le sait : l'écran de la première
 * ouverture compte ses étapes ici (section 3.3), la carte « Mise en route »
 * de « Ma ferme » les montre d'ici (section 5.2) ; un test échoue si les
 * deux divergent.
 */

const ROUTE_STEP_IDS = ['equipment', 'placement', 'water', 'objective', 'soil'] as const;
type RouteStepId = (typeof ROUTE_STEP_IDS)[number];

export type RouteStepDefinition = {
  id: RouteStepId;
  /** Le nom de l'étape sur la carte. */
  label: string;
  /** La case qui la fait exister. */
  feature: FeatureId;
  /** Ce qu'elle décrit, dans la phrase de la première ouverture (« le matériel, où il est posé… »). */
  inSentence: string;
};

const ROUTE_STEPS: readonly RouteStepDefinition[] = [
  { id: 'equipment', label: 'Mon matériel', feature: 'materiel', inSentence: 'le matériel' },
  { id: 'placement', label: 'Où il est posé', feature: 'materiel', inSentence: 'où il est posé' },
  { id: 'water', label: 'D’où vient l’eau', feature: 'ressources', inSentence: 'd’où vient l’eau' },
  { id: 'objective', label: 'Combien je vise par semaine', feature: 'besoins', inSentence: 'combien vous visez' },
  { id: 'soil', label: 'Mon sol', feature: 'sol', inSentence: 'votre sol' },
];

/** Les étapes d'une ferme, dans l'ordre : celles dont la case est cochée. */
export function routeStepsFor(selection: FeatureSelection): RouteStepDefinition[] {
  return ROUTE_STEPS.filter((step) => selection.includes(step.feature));
}

const COUNT_WORDS = ['aucune', 'une', 'deux', 'trois', 'quatre', 'cinq'] as const;

/** « deux étapes », « une étape » : le nombre en lettres, comme dans la maquette. */
export function routeStepCountText(count: number): string {
  const word = COUNT_WORDS[count] ?? String(count);
  return `${word} étape${count > 1 ? 's' : ''}`;
}

/**
 * La phrase qui dit ce qui suit le choix (section 3.3) : le nombre d'étapes
 * et ce qu'elles décrivent, tirés des étapes de ces cases. Sans choix, ou pour
 * des cases qui n'ont aucune étape, la phrase ne promet pas de nombre.
 */
export function whatFollowsText(selection: FeatureSelection | null): string {
  const steps = selection === null ? [] : routeStepsFor(selection);
  if (steps.length === 0) return 'Ensuite, quelques étapes pour décrire votre ferme, en plusieurs fois si vous voulez.';
  return `Ensuite, ${routeStepCountText(steps.length)} pour décrire votre ferme : ${joinLabels(steps.map((step) => step.inSentence))}. En plusieurs fois si vous voulez.`;
}
