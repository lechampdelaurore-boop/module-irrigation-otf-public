import type { ActionReplyTone } from '../shell/action-reply';

/**
 * Les endroits où s'écrit la réponse d'un geste de « Aujourd'hui »
 * (docs/aujourdhui-liens-contract.md, L4, D-313) : sous le bouton pressé,
 * par `ActionReply` (lot G, F404, étendu à la page). Une irrigation porte
 * son identifiant : démarrée, sa réponse la suit dans « En cours » ; partie
 * de la page (« Fait comme prévu »), sa réponse se lit en tête de « Votre
 * journée », sous « Tout est fait ». Une proposition porte le sien
 * (simplification, lot S2) : validée, sa réponse suit l'irrigation créée ;
 * refusée, elle se lit en tête du bloc.
 */
export const DAY_REPLY = 'journee';
export const PLAN_HEADER_REPLY = 'plan-entete';
export const PLAN_RELIABILITY_REPLY = 'fiabilite-plan';

export function irrigationReply(eventEquipmentId: string): string {
  return `irrigation:${eventEquipmentId}`;
}

export function proposalReply(proposalId: string): string {
  return `proposition:${proposalId}`;
}

/** L'endroit d'une carte de « Votre journée » : une irrigation ou une proposition. */
export function isCardReply(origin: string): boolean {
  return origin.startsWith(irrigationReply('')) || origin.startsWith(proposalReply(''));
}

/** Le dessin de la page pour chaque ton : le vert calme, le rouge du refus. */
export const TODAY_REPLY_CLASSES: Record<ActionReplyTone, string> = {
  notice: 'today-notice',
  warning: 'today-notice',
  error: 'today-error',
};
