'use server';

import { refusalReply, validateAndStartReply, validationReply, type TodayCardReply } from '@/lib/domain/today/card-action';
import { startIrrigationEventAction } from './irrigation-event-actions';
import { refusePlanProposalAction, validatePlanProposalsAction } from './planning-actions';
import { oneValidation, validateThenStart } from './today/card-gestures';

/**
 * Les gestes de la carte d'« Aujourd'hui » sur une proposition du plan
 * (simplification, lot S2, docs/simplification-s2-contract.md, section 5).
 * Chacun est l'action du planning, la même, donc avec les mêmes gardes :
 * le matériel, son réglage et sa position à cet instant, la pompe, la limite
 * journalière, le recalcul du plan ; le propriétaire vient de la session.
 * Rien n'est validé ni démarré sans appui (D-028).
 */

/** « Valider » : une seule proposition. */
export async function validateProposalFromTodayAction(input: { season: number; proposalId: string }): Promise<TodayCardReply> {
  return validationReply(oneValidation(await validatePlanProposalsAction({ season: input.season, proposalIds: [input.proposalId] })));
}

/** « Démarrer tout de suite » : valider, puis démarrer (S2-c). */
export async function validateAndStartProposalFromTodayAction(input: { season: number; proposalId: string }): Promise<TodayCardReply> {
  const { validation, start } = await validateThenStart({
    validate: () => validatePlanProposalsAction({ season: input.season, proposalIds: [input.proposalId] }),
    start: (eventEquipmentId) => startIrrigationEventAction(eventEquipmentId),
  });
  return validateAndStartReply(validation, start);
}

/** « Pas à cette heure » : le refus du planning (D-030, S2-b). */
export async function refuseProposalFromTodayAction(input: { season: number; proposalId: string }): Promise<TodayCardReply> {
  const result = await refusePlanProposalAction({ season: input.season, proposalId: input.proposalId });
  return result.ok ? refusalReply(result.refused) : { tone: 'error', text: result.message, eventEquipmentId: null };
}
