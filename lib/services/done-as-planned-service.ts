import { recordDoneAsPlannedForUser } from '@/db/irrigation-event/completion';
import { IrrigationEventNotFoundError, IrrigationEventStateError } from '@/db/irrigation-event/errors';
import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { logJsonLine } from '@/lib/adapters/log';
import { DONE_AS_PLANNED_REFUSAL_TEXT, doneAsPlanned } from '@/lib/domain/done-as-planned';
import { cancelIrrigationPushScheduleBeforeMutation, IrrigationPushCancellationError } from './irrigation-push-orchestration';
import { recalculatePlanAfterEvent } from './planning-recalculation';

/**
 * « Tout est fait » (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.4) : les irrigations cochées dans la confirmation s'enregistrent
 * réalisées telles que prévues, une à une, chacune tout ou rien. Le serveur
 * relit les irrigations du propriétaire pour la saison et rejuge chacune
 * (`doneAsPlanned`) : une irrigation d'une autre ferme ou d'une autre saison
 * est introuvable, une irrigation qui a changé depuis l'affichage est
 * refusée avec son nom, et les autres restent enregistrées. Le plan de la
 * semaine se recalcule une fois, après tout (3.7, règle 4).
 */

/** Ce qu'une confirmation peut demander d'un coup : bien plus qu'une saison de retards, sans requête sans fin. */
export const DONE_AS_PLANNED_MAXIMUM = 500;

export type DoneAsPlannedOutcome = {
  recorded: number;
  /** « Goutte-à-goutte B · Réglage 1 » et la raison, pour chaque irrigation non enregistrée. */
  refused: { eventEquipmentId: string; title: string; reason: string }[];
};

type Dependencies = {
  cancelPushSchedule?: (ownerUserId: string, eventEquipmentId: string) => Promise<void>;
  recalculatePlan?: typeof recalculatePlanAfterEvent;
};

/** Le message d'un refus que la base ou l'alerte disent ; une panne inattendue reste dite, sans détail. */
function refusalReason(error: unknown): string {
  if (error instanceof IrrigationEventNotFoundError || error instanceof IrrigationEventStateError || error instanceof IrrigationPushCancellationError) {
    return error.message;
  }
  if (error instanceof Error && /WATER_BUDGET_CHANGED|HYDRAULIC_CHANGED/.test(error.message)) {
    return 'Une autre modification était en cours. Réessayez.';
  }
  return 'L’enregistrement a échoué. Réessayez.';
}

export async function recordDoneAsPlannedForOwner(
  request: { ownerUserId: string; season: number; eventEquipmentIds: readonly string[]; now?: Date },
  {
    cancelPushSchedule = cancelIrrigationPushScheduleBeforeMutation,
    recalculatePlan = recalculatePlanAfterEvent,
  }: Dependencies = {},
): Promise<DoneAsPlannedOutcome> {
  const { ownerUserId, season, now = new Date() } = request;
  const ids = [...new Set(request.eventEquipmentIds)];
  const events = await listIrrigationEventsForUser(ownerUserId, season);
  const byId = new Map(events.map((event) => [event.equipment.id, event]));
  const refused: DoneAsPlannedOutcome['refused'] = [];
  let latestStartAt: string | null = null;
  let recorded = 0;
  for (const eventEquipmentId of ids) {
    const event = byId.get(eventEquipmentId);
    if (!event) {
      refused.push({ eventEquipmentId, title: 'Une irrigation', reason: new IrrigationEventNotFoundError().message });
      continue;
    }
    const title = `${event.equipment.equipmentSnapshot.name} · ${event.equipment.settingSnapshot.name}`;
    const result = doneAsPlanned(event, now);
    if (!result.ok) {
      refused.push({ eventEquipmentId, title, reason: DONE_AS_PLANNED_REFUSAL_TEXT[result.refusal] });
      continue;
    }
    try {
      // L'alerte « en retard » part avec l'irrigation, comme à l'annulation (3.7, règle 24).
      await cancelPushSchedule(ownerUserId, eventEquipmentId);
      await recordDoneAsPlannedForUser(ownerUserId, result.record);
      recorded += 1;
      if (latestStartAt === null || result.record.actualStartAt > latestStartAt) latestStartAt = result.record.actualStartAt;
    } catch (error) {
      logJsonLine('warn', { event: 'done_as_planned_refused', error: error instanceof Error ? error.name : 'unknown', failedAt: now.toISOString() });
      refused.push({ eventEquipmentId, title, reason: refusalReason(error) });
    }
  }
  // La plus récente date l'événement : si l'une est de la semaine en cours, le plan se recalcule (règle 5).
  if (latestStartAt !== null) {
    try {
      await recalculatePlan(ownerUserId, { kind: 'irrigation-completed', season, at: new Date(latestStartAt) });
    } catch (error) {
      // Les irrigations sont enregistrées ; le plan se recalculera au prochain événement ou à la demande.
      logJsonLine('warn', { event: 'done_as_planned_plan_failed', error: error instanceof Error ? error.message : 'unknown', failedAt: now.toISOString() });
    }
  }
  return { recorded, refused };
}
