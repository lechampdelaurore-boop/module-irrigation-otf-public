import type { IrrigationPushScheduleRecord } from '@/lib/domain/irrigation-event-record';
import type { IrrigationPushAlarmRequest } from '@/lib/domain/irrigation-push-contract';
import type { IrrigationEventMutationResult } from '@/db/irrigation-event/conflicts';
import {
  getIrrigationPushScheduleForUser,
  listUpcomingPushAlarmsForUser,
  markIrrigationPushScheduleStatusForUser,
} from '@/db/irrigation-event/push-schedule';
import { logJsonLine, type LogLevel } from '@/lib/adapters/log';
import { pageHref } from '@/lib/domain/features/pages';
import {
  cancelIrrigationPushAlarm,
  type IrrigationPushServiceResult,
  scheduleIrrigationPushAlarm,
} from './irrigation-push-service';

export async function synchronizeIrrigationPushSchedule(
  ownerUserId: string,
  result: IrrigationEventMutationResult,
): Promise<string | undefined> {
  const schedule = result.pushSchedule;
  if (!schedule) return undefined;

  const serviceResult = await scheduleIrrigationPushAlarm(
    pushAlarmRequest(schedule),
  );
  const status = serviceResult.status === 'ok'
    ? 'scheduled'
    : serviceResult.status === 'disabled'
      ? 'disabled'
      : 'failed';
  await markIrrigationPushScheduleStatusForUser(
    ownerUserId,
    schedule.eventEquipmentId,
    schedule.revision,
    status,
  );

  if (status === 'scheduled') return undefined;
  if (schedule.kind === 'late') {
    // L'irrigation est planifiée quoi qu'il arrive à l'alerte (3.7, règle 23) ;
    // sans service configuré, rien à dire : le retard se lit à l'écran.
    return status === 'disabled'
      ? undefined
      : 'L’irrigation est enregistrée, mais l’alerte de retard n’a pas pu être programmée.';
  }
  if (status === 'disabled') {
    return 'Le minuteur fonctionne, mais l’alerte serveur n’est pas encore configurée.';
  }
  return 'Le minuteur fonctionne, mais l’alerte serveur n’a pas pu être programmée. Réessayez depuis la page avant de la fermer.';
}

export async function cancelIrrigationPushScheduleBeforeMutation(
  ownerUserId: string,
  eventEquipmentId: string,
): Promise<void> {
  const schedule = await getIrrigationPushScheduleForUser(
    ownerUserId,
    eventEquipmentId,
  );
  if (!schedule) return;

  const result = await cancelIrrigationPushAlarm({
    eventEquipmentId,
    revision: schedule.revision,
  });
  if (result.status === 'ok') return;
  if (result.status === 'disabled' && schedule.status === 'disabled') return;

  throw new IrrigationPushCancellationError();
}

/**
 * Arrosages décochée (3.8, docs/feature-selection-contract.md, R1, P29) : les
 * alarmes encore à venir de la ferme sont retirées du Worker de notification
 * et marquées « non programmées » ; les irrigations restent telles quelles. Ce
 * qui n'est pas parti ne se rattrape pas en recochant (P5). Un retrait refusé
 * se journalise sans nommer personne ; le choix reste enregistré. Ne lève jamais.
 */
export async function cancelUpcomingIrrigationAlarmsForUser(
  ownerUserId: string,
  {
    now = new Date(),
    cancel = cancelIrrigationPushAlarm,
    log = logJsonLine,
  }: {
    now?: Date;
    cancel?: typeof cancelIrrigationPushAlarm;
    log?: (level: LogLevel, entry: Record<string, unknown>) => void;
  } = {},
): Promise<{ canceled: number; failed: number }> {
  let canceled = 0;
  let failed = 0;
  try {
    for (const alarm of await listUpcomingPushAlarmsForUser(ownerUserId, now)) {
      const result = await cancel(alarm).catch((): IrrigationPushServiceResult => ({ status: 'failed', message: 'unreachable' }));
      if (result.status === 'failed') {
        failed += 1;
        continue;
      }
      await markIrrigationPushScheduleStatusForUser(ownerUserId, alarm.eventEquipmentId, alarm.revision, 'disabled');
      canceled += 1;
    }
  } catch (error) {
    failed += 1;
    log('warn', { event: 'irrigation_alarms_feature_cancel_failed', error: error instanceof Error ? error.message : 'unknown', failedAt: now.toISOString() });
  }
  if (canceled + failed > 0) log(failed > 0 ? 'warn' : 'info', { event: 'irrigation_alarms_feature_canceled', canceled, failed, at: now.toISOString() });
  return { canceled, failed };
}

/**
 * L'alarme telle que le Worker la reçoit : la fin du minuteur, ou le retard
 * d'une irrigation planifiée non démarrée (3.7, règles 21 et 24), sous le
 * même identifiant et la même révision ; un clic ouvre l'irrigation.
 */
export function pushAlarmRequest(schedule: IrrigationPushScheduleRecord): IrrigationPushAlarmRequest {
  const late = schedule.kind === 'late';
  return {
    eventEquipmentId: schedule.eventEquipmentId,
    recipientKey: schedule.workspaceId,
    revision: schedule.revision,
    dueAt: schedule.dueAt,
    notification: {
      title: late ? 'Irrigation en retard' : 'Irrigation terminée',
      body: late
        ? `${schedule.equipmentName} · ${schedule.settingName}, non démarrée à l’heure prévue`
        : `${schedule.equipmentName} · ${schedule.settingName}`,
      tag: `irrigation-${late ? 'late' : 'finished'}-${schedule.eventEquipmentId}-${schedule.revision}`,
      data: {
        url: pageHref('arrosages', { season: schedule.season }, `irrigation-${schedule.eventEquipmentId}`),
      },
    },
  };
}

export class IrrigationPushCancellationError extends Error {
  constructor() {
    super(
      'L’alerte distante n’a pas pu être annulée de façon sûre. Réessayez dans quelques instants.',
    );
    this.name = 'IrrigationPushCancellationError';
  }
}
