'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { saveIrrigationArbitrationForUser, wasIrrigationArbitrationSavedForUser } from '@/db/irrigation-arbitration-repository';
import { getIrrigationFeasibilityForUser, getIrrigationFeasibilityScreenForUser, type FeasibilityScreen } from '@/lib/services/irrigation-feasibility-service';
import { recalculatePlanAfterEvent } from '@/lib/services/planning-recalculation';
import { adoptStageAdviceForUser } from '@/lib/services/stage-advice-adoption';
import { FEASIBILITY_PRIORITIES } from '@/lib/domain/irrigation-feasibility';
import { isArbitrationEditable } from '@/lib/domain/arbitration-preview';
import type { IrrigationNeedPriority } from '@/lib/domain/irrigation-needs';

/**
 * `crops` : les cultures des planches pour l'écran d'arbitrage, quand un niveau demande un choix (2 bis, D-083) ;
 * `planGap` : le manque du planning que la faisabilité ne voit pas, et d'où il vient (lot I, n° 5, F446) ;
 * `stageAdvice` : en pénurie, le conseil selon le stade sensible (amélioration n° 4, F732).
 */
export type FeasibilityActionResult = ({ ok: true; message: string } & FeasibilityScreen) | { ok: false; message: string };

export async function loadIrrigationFeasibilityAction(input: { season: number }): Promise<FeasibilityActionResult> {
  return withContext(input.season, async (context) => ({ ok: true, message: 'Faisabilité recalculée.', ...await getIrrigationFeasibilityScreenForUser(context) }));
}

export async function saveIrrigationArbitrationAction(input: {
  season: number; weekStart: string; priority: IrrigationNeedPriority; selectedBedIds: string[];
  expectedRevision: number; snapshotSignature: string; requestId: string;
}): Promise<FeasibilityActionResult> {
  return withContext(input.season, async (context) => {
    if (!FEASIBILITY_PRIORITIES.includes(input.priority) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
      || typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId)
      || !Array.isArray(input.selectedBedIds) || input.selectedBedIds.length > 10000 || input.selectedBedIds.some((id) => typeof id !== 'string')
      || new Set(input.selectedBedIds).size !== input.selectedBedIds.length) throw new Error('Sélection invalide.');
    if (await wasIrrigationArbitrationSavedForUser(context.ownerUserId, input)) return { ok: true, message: 'Cette décision avait déjà été enregistrée. Voici la situation actuelle.', ...await getIrrigationFeasibilityScreenForUser(context) };
    const fresh = await getIrrigationFeasibilityForUser(context);
    if (fresh.weekStart !== input.weekStart) throw new Error('La semaine a changé. Rechargez la faisabilité.');
    if (fresh.revision !== input.expectedRevision || fresh.snapshotSignature !== input.snapshotSignature) throw new Error('Les données ont changé dans un autre onglet ou lors du recalcul. Recalculez puis vérifiez votre sélection.');
    const level = fresh.priorities.find((item) => item.priority === input.priority)!;
    if (!isArbitrationEditable(level)) throw new Error('Ce niveau ne nécessite pas de sélection manuelle actuellement.');
    if (input.selectedBedIds.some((id) => !level.candidates.includes(id))) throw new Error('Une planche sélectionnée ne fait plus partie des besoins de ce niveau.');
    await saveIrrigationArbitrationForUser(context.ownerUserId, {
      season: input.season, weekStart: fresh.weekStart, priority: input.priority, selectedBedIds: input.selectedBedIds,
      candidateBedIds: level.candidates, expectedRevision: fresh.revision, requestId: input.requestId,
    });
    // Un arbitrage validé s'impose au moteur : le plan se recalcule (3.7, règle 4).
    await recalculatePlanAfterEvent(context.ownerUserId, { kind: 'arbitration-validated', season: input.season, at: fresh.weekStart, lasting: true });
    return { ok: true, message: 'Répartition enregistrée pour cette semaine. Les quantités ont été recalculées.', ...await getIrrigationFeasibilityScreenForUser(context) };
  });
}

/** « Adopter » un conseil selon le stade sensible (amélioration n° 4, F732) : la règle vit dans le service. */
export async function adoptStageAdviceAction(input: { season: number; weekStart: string; bedId: string }): Promise<FeasibilityActionResult> {
  return withContext(input.season, async (context) => {
    if (typeof input.weekStart !== 'string' || typeof input.bedId !== 'string' || input.bedId.length === 0 || input.bedId.length > 200) throw new Error('Planche invalide.');
    return { ok: true, ...await adoptStageAdviceForUser({ ...context, weekStart: input.weekStart, bedId: input.bedId }) };
  });
}

async function withContext(season: number, operation: (context: { ownerUserId: string; season: number }) => Promise<FeasibilityActionResult>): Promise<FeasibilityActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(season) || season < 1900 || season > 9999) return { ok: false, message: 'Saison invalide.' };
  try {
    return await operation({ ownerUserId: user.userId, season });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return { ok: false, message: /D1|SQL|revision/i.test(message) ? 'Les données viennent de changer. Recalculez la faisabilité avant de valider à nouveau.' : message || 'La faisabilité n’a pas pu être recalculée.' };
  }
}
