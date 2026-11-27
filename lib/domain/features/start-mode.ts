/**
 * Ce que la ferme garde de sa première ouverture (simplification, lot S6,
 * docs/simplification-s6-contract.md, section 4 ; D-336), dans la ligne de
 * son choix des cases : comment elle a commencé (`start_mode`) et l'état de
 * sa carte « Mise en route » (`route_state`). Deux colonnes nullables : une
 * ferme d'avant S6 n'a ni l'une ni l'autre. Ce fichier ne dépend de rien,
 * pour que la lecture du choix (`selection.ts`) le lise sans boucle.
 */

export const START_WAY_IDS = ['notes', 'proposals', 'all'] as const;
/** Je note mes arrosages, le module me propose quoi arroser, tout. */
export type StartWay = (typeof START_WAY_IDS)[number];

/** Comment la ferme a commencé : une des trois façons, ou ses cases choisies elle-même (`custom`). */
export type StartMode = StartWay | 'custom';
const START_MODES: readonly StartMode[] = [...START_WAY_IDS, 'custom'];

/**
 * L'état de la carte (section 4) : `null` visible, `later` remise à plus tard
 * par la personne, `done` terminée par la personne. Écrit par un appui,
 * jamais par une lecture.
 */
export type RouteState = 'later' | 'done';

export function isStartWay(value: unknown): value is StartWay {
  return typeof value === 'string' && (START_WAY_IDS as readonly string[]).includes(value);
}

/** `start_mode` tel que la base le rend : une valeur connue, ou `null` (ferme d'avant S6, valeur illisible). */
export function storedStartMode(value: unknown): StartMode | null {
  return typeof value === 'string' && (START_MODES as readonly string[]).includes(value) ? value as StartMode : null;
}

/** `route_state` tel que la base le rend : une valeur connue, ou `null`. */
export function storedRouteState(value: unknown): RouteState | null {
  return value === 'later' || value === 'done' ? value : null;
}
