'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { logJsonLine } from '@/lib/adapters/log';
import { changeRouteStateForUser, type RouteStateOutcome } from '@/lib/services/start-route';

/**
 * Les trois gestes de la carte « Mise en route » (simplification, lot S6,
 * docs/simplification-s6-contract.md, section 5.4) : « Plus tard »,
 * « Reprendre la mise en route », « Terminer la mise en route ». Chacun
 * écrit l'état de la carte dans l'espace de la personne, et rien d'autre ;
 * la réponse s'écrit à côté du bouton et la page se relit.
 */
export async function saveRouteStateAction(input: { gesture: 'later' | 'resume' | 'done' }): Promise<RouteStateOutcome> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  try {
    const outcome = await changeRouteStateForUser(user.userId, input?.gesture);
    // Un geste et une date, jamais l'identifiant de la personne.
    if (outcome.ok) logJsonLine('info', { event: 'irrigation_route_state_changed', gesture: input.gesture, at: new Date().toISOString() });
    return outcome;
  } catch {
    return { ok: false, message: 'La mise en route n’a pas pu être enregistrée. Réessayez.' };
  }
}
