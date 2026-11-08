import { newPushAlarmRevision } from '@/db/irrigation-event/push-schedule';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import { logJsonLine, type LogLevel } from '../adapters/log';
import { morningSuggestionNotification } from '../domain/planning/notifications';
import type { StoredPlanCalculation, StoredWeeklyPlan } from '../domain/planning/contract';
import type { IrrigationPushAlarmRequest } from '../domain/irrigation-push-contract';
import { type IrrigationPushServiceResult, scheduleIrrigationPushAlarm } from './irrigation-push-service';

export type PlanningAlarmScheduler = (request: IrrigationPushAlarmRequest) => Promise<IrrigationPushServiceResult>;

/**
 * La notification du matin (docs/replanning-contract.md, règles 21 à 24) :
 * après le calcul quotidien, une alarme à échéance immédiate du Worker de
 * notification, sous un identifiant du calcul, regroupe les suggestions sur
 * les arrosages validés des prochaines 24 heures. Rien pour un calcul lancé
 * ou provoqué par le maraîcher : il a le plan sous les yeux (règle 22). Une
 * panne n'altère jamais le plan : la fonction ne lève pas, elle journalise
 * sans nommer personne (règle 23).
 */
export async function notifyMorningSuggestions({
  ownerUserId,
  plan,
  now,
  schedule = scheduleIrrigationPushAlarm,
  log = logJsonLine,
}: {
  ownerUserId: string;
  plan: Pick<StoredWeeklyPlan, 'suggestions'> & { calculation: Pick<StoredPlanCalculation, 'id' | 'season'> };
  now: Date;
  schedule?: PlanningAlarmScheduler;
  log?: (level: LogLevel, entry: Record<string, unknown>) => void;
}): Promise<void> {
  const notification = morningSuggestionNotification(plan, now);
  if (!notification) return;
  const calculationId = plan.calculation.id;
  try {
    const workspaceId = await findWorkspaceIdForUser(ownerUserId);
    if (!workspaceId) return;
    const result = await schedule({
      eventEquipmentId: notification.alarmId,
      recipientKey: workspaceId,
      revision: newPushAlarmRevision(now),
      dueAt: now.toISOString(),
      notification: { title: notification.title, body: notification.body, tag: notification.tag, data: { url: notification.url } },
    });
    if (result.status === 'ok') {
      log('info', { event: 'planning_suggestion_notification_sent', calculationId, suggestions: notification.count, sentAt: now.toISOString() });
    } else if (result.status === 'failed') {
      log('warn', { event: 'planning_suggestion_notification_failed', calculationId, suggestions: notification.count, error: result.message, failedAt: now.toISOString() });
    }
  } catch (error) {
    log('warn', { event: 'planning_suggestion_notification_failed', calculationId, suggestions: notification.count, error: error instanceof Error ? error.message : 'unknown', failedAt: now.toISOString() });
  }
}
