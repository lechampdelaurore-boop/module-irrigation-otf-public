import type { ActionReplyTone } from '../shell/action-reply';

/**
 * Les endroits où s'écrit la réponse d'un geste de « Aujourd'hui »
 * (docs/aujourdhui-liens-contract.md, L4, D-313) : sous le bouton pressé,
 * par `ActionReply` (lot G, F404, étendu à la page). Une irrigation porte
 * son identifiant : démarrée, sa réponse la suit dans « En cours » ; partie
 * de la page (« Fait comme prévu »), sa réponse se lit en tête de « Votre
 * journée », sous « Tout est fait ».
 */
export const DAY_REPLY = 'journee';
export const PLAN_HEADER_REPLY = 'plan-entete';
export const PLAN_RELIABILITY_REPLY = 'fiabilite-plan';

export function irrigationReply(eventEquipmentId: string): string {
  return `irrigation:${eventEquipmentId}`;
}

/** Le dessin de la page pour chaque ton : le vert calme, le rouge du refus. */
export const TODAY_REPLY_CLASSES: Record<ActionReplyTone, string> = {
  notice: 'today-notice',
  warning: 'today-notice',
  error: 'today-error',
};
