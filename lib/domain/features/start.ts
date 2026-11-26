import { FEATURE_IDS, type FeatureId } from './catalogue.ts';
import { landingPage, type IrrigationPageId } from './pages.ts';
import { withRequirements, type FeatureSelection } from './selection.ts';
import { routeStepsFor } from '../onboarding/route.ts';
import type { StartMode, StartWay } from './start-mode.ts';

/**
 * Les trois façons de commencer (simplification, lot S6,
 * docs/simplification-s6-contract.md, sections 3 et 4 ; D-336) : à la
 * première ouverture, à la place des onze cases, trois choix qui cochent
 * chacun les cases qu'il faut ; « Choisir moi-même » garde la liste. Les noms
 * et les phrases sont ceux de la maquette, relus par le test de garde des
 * mots (lot S1). C'est le seul endroit qui sait quelles cases coche chaque
 * façon : le serveur les calcule ici, jamais le navigateur (section 3.4).
 */

export type StartWayDefinition = {
  id: StartWay;
  name: string;
  text: string;
  /** L'étiquette « Conseillé » : elle désigne la façon, jamais ne la choisit (S6-a). */
  recommended: boolean;
  /** Les cases que la façon coche ; celles dont elles ont besoin s'y ajoutent (`startWaySelection`). */
  checks: readonly FeatureId[];
};

export const START_WAYS: readonly StartWayDefinition[] = [
  {
    id: 'notes',
    name: 'Je note mes arrosages',
    text: 'Je décide seul. Le module lance le minuteur et compte l’eau donnée à chaque planche.',
    recommended: false,
    checks: ['arrosages', 'historique'],
  },
  {
    id: 'proposals',
    name: 'Le module me propose quoi arroser',
    text: 'Chaque matin, une proposition selon la météo et l’eau que je vise. Je valide, rien ne part sans moi.',
    recommended: true,
    checks: ['planning', 'ressources', 'historique'],
  },
  {
    id: 'all',
    name: 'Tout : sol, cultures et alertes',
    text: 'En plus : ce que le sol retient, la soif de chaque culture selon son stade, les alertes de gel et de chaleur.',
    recommended: false,
    checks: FEATURE_IDS,
  },
];

export const WELCOME_EYEBROW = 'Bienvenue';
export const WELCOME_HEADING = 'Comment voulez-vous commencer ?';
export const WELCOME_INTRO = 'Choisissez ce qui vous ressemble. Vous pourrez changer à tout moment, sans rien perdre.';
export const CHOOSE_MYSELF_LABEL = 'Choisir moi-même les fonctionnalités';

function startWayDefinition(id: StartWay): StartWayDefinition {
  const way = START_WAYS.find((candidate) => candidate.id === id);
  if (!way) throw new Error(`Façon de commencer inconnue : ${id}`);
  return way;
}

/** Les cases d'une façon de commencer, avec celles dont elles ont besoin (fermeture de la 3.8, R3). */
export function startWaySelection(id: StartWay): FeatureId[] {
  return withRequirements(startWayDefinition(id).checks);
}

/**
 * La page où l'on arrive après « Continuer » (section 3.4) : « Ma ferme »
 * quand la mise en route a au moins une étape, sinon la page d'arrivée
 * habituelle (F31). C'est la seule fois où l'on arrive sur « Ma ferme ».
 */
export function firstArrivalPage(enabled: FeatureSelection): IrrigationPageId {
  return routeStepsFor(enabled).length > 0 ? 'ma-ferme' : landingPage(enabled);
}

/**
 * La ligne en tête des fonctionnalités de Réglages (section 9) : comment la
 * ferme a commencé. Rien pour une ferme d'avant S6.
 */
export function startedWithText(mode: StartMode | null): string | null {
  if (mode === null) return null;
  if (mode === 'custom') return 'Vous avez choisi vous-même vos fonctionnalités.';
  return `Vous avez commencé par : « ${startWayDefinition(mode).name} ».`;
}
