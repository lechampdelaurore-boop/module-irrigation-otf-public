import type { IrrigationPushScheduleRecord } from '@/lib/domain/irrigation-event-record';
import type { IrrigationPushAlarmRequest } from '@/lib/domain/irrigation-push-contract';
import type { IrrigationEventMutationResult } from '@/db/irrigation-event/conflicts';
import {
  getIrrigationPushScheduleForUser,
  listUpcomingPushAlarmsForUser,
  markIrrigationPushScheduleStatusForUser,
} from '@/db/irrigation-event/push-schedule';
import { readPhoneNoticeSettingsForUser, readPhoneNoticeSettingsForWorkspace } from '@/db/phone-notice-repository';
import { logJsonLine, type LogLevel } from '@/lib/adapters/log';
import { pageHref } from '@/lib/domain/features/pages';
import { quietHoursDecision, type QuietHoursSettings } from '@/lib/domain/notification-quiet-hours';
import {
  cancelIrrigationPushAlarm,
  type IrrigationPushServiceResult,
  scheduleIrrigationPushAlarm,
} from './irrigation-push-service';
import { logQuietHoursDefect } from './quiet-hours-delivery';

export async function synchronizeIrrigationPushSchedule(
  ownerUserId: string,
  result: IrrigationEventMutationResult,
): Promise<string | undefined> {
  const schedule = result.pushSchedule;
  if (!schedule) return undefined;

  const serviceResult = await scheduleIrrigationPushAlarm(
    await alarmRequestInQuietHours(schedule),
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
 * Un retard dont l'échéance est passée mais que les heures de silence de la
 * ferme retiennent encore n'est pas parti : il est retiré aussi (H2) ; une
 * alarme passée, elle, ne se retire pas.
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
    const alarms = await listUpcomingPushAlarmsForUser(ownerUserId, now);
    const past = alarms.filter((alarm) => Date.parse(alarm.dueAt) <= now.getTime());
    const quietHours = past.length > 0 ? await readQuietHoursOrNothing(ownerUserId, now, log) : null;
    for (const alarm of alarms) {
      if (past.includes(alarm) && !stillHeld(alarm, quietHours, now)) continue;
      const request = { eventEquipmentId: alarm.eventEquipmentId, revision: alarm.revision };
      const result = await cancel(request).catch((): IrrigationPushServiceResult => ({ status: 'failed', message: 'unreachable' }));
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
 * L'enregistrement des heures de silence (H3, F807, F820) : les retards
 * d'irrigation encore à venir de la ferme, programmés avec la plage d'avant,
 * prennent l'échéance que la plage nouvelle leur donne : la fin de la plage
 * s'ils y tombent, leur échéance d'origine sinon. Même identifiant, même
 * révision, même texte : le Worker remplace l'alarme. Un retard échu que la
 * plage d'avant retenait encore n'est pas parti : la plage éteinte ou
 * raccourcie le fait partir tout de suite. Un retard déjà parti, la fin d'un
 * minuteur, une alarme dont l'échéance ne change pas : rien n'est envoyé.
 * `before` vaut `null` quand le réglage d'avant était illisible : chaque
 * retard à venir est alors reprogrammé. Ne lève jamais ; un échec se compte
 * et se dit sans nom, l'alarme garde son échéance d'avant.
 */
export async function rescheduleLateAlarmsForQuietHours(
  ownerUserId: string,
  before: QuietHoursSettings | null,
  after: QuietHoursSettings,
  {
    now = new Date(),
    schedule = scheduleIrrigationPushAlarm,
    log = logJsonLine,
  }: {
    now?: Date;
    schedule?: typeof scheduleIrrigationPushAlarm;
    log?: (level: LogLevel, entry: Record<string, unknown>) => void;
  } = {},
): Promise<{ rescheduled: number; failed: number }> {
  let rescheduled = 0;
  let failed = 0;
  try {
    const alarms = await listUpcomingPushAlarmsForUser(ownerUserId, now);
    for (const alarm of alarms) {
      if (alarm.kind !== 'late') continue;
      const due = new Date(alarm.dueAt);
      if (due.getTime() <= now.getTime() && !stillHeld(alarm, before, now)) continue;
      const dueAt = workerDueAt(after, due);
      if (before && dueAt === workerDueAt(before, due)) continue;
      // Démarrée entre-temps, l'irrigation a une révision nouvelle et l'alarme de sa fin : rien à reprogrammer.
      const record = await getIrrigationPushScheduleForUser(ownerUserId, alarm.eventEquipmentId);
      if (!record || record.revision !== alarm.revision) continue;
      const result = await schedule({ ...pushAlarmRequest(record), dueAt })
        .catch((): IrrigationPushServiceResult => ({ status: 'failed', message: 'unreachable' }));
      if (result.status === 'failed') failed += 1;
      else if (result.status === 'ok') rescheduled += 1;
    }
  } catch (error) {
    failed += 1;
    log('warn', { event: 'quiet_hours_reschedule_failed', error: error instanceof Error ? error.message : 'unknown', failedAt: now.toISOString() });
  }
  if (rescheduled + failed > 0) log(failed > 0 ? 'warn' : 'info', { event: 'quiet_hours_late_alarms_rescheduled', rescheduled, failed, at: now.toISOString() });
  return { rescheduled, failed };
}

/** L'échéance que le Worker donne au retard d'échéance `due` sous ce réglage : la fin de la plage s'il y tombe. */
function workerDueAt(settings: QuietHoursSettings, due: Date): string {
  const decision = quietHoursDecision(settings, { kind: 'irrigation-late' }, due);
  return decision.action === 'hold' ? decision.until : due.toISOString();
}

/**
 * Le réglage des heures de silence de la ferme, ou rien s'il est illisible
 * (S8) : la plage compte alors pour éteinte, un retard échu pour parti, et
 * les alarmes à venir se retirent quand même. L'incident se dit sans nom.
 */
async function readQuietHoursOrNothing(
  ownerUserId: string,
  now: Date,
  log: (level: LogLevel, entry: Record<string, unknown>) => void,
): Promise<QuietHoursSettings | null> {
  try {
    return (await readPhoneNoticeSettingsForUser(ownerUserId)).quietHours;
  } catch {
    log('warn', { event: 'quiet_hours_unreadable', at: now.toISOString() });
    return null;
  }
}

/** Un retard à l'échéance passée que les heures de silence retiennent encore : sa fin de plage n'est pas venue. */
function stillHeld(alarm: { dueAt: string; kind: 'finished' | 'late' }, quietHours: QuietHoursSettings | null, now: Date): boolean {
  if (alarm.kind !== 'late' || !quietHours) return false;
  const decision = quietHoursDecision(quietHours, { kind: 'irrigation-late' }, new Date(alarm.dueAt));
  return decision.action === 'hold' && Date.parse(decision.until) > now.getTime();
}

/**
 * Les heures de silence (H2, S3, S4 ; F797) : la fin du minuteur part
 * toujours, sans lire le réglage. Le retard d'une irrigation planifiée se
 * juge à son échéance, avec le réglage de la ferme au moment où l'alarme est
 * programmée : dans la plage, son échéance devient la fin de la plage, même
 * identifiant, même révision, même texte. Un réglage illisible laisse
 * l'échéance telle quelle (S8) ; un défaut de la règle se dit sans nom.
 */
async function alarmRequestInQuietHours(schedule: IrrigationPushScheduleRecord): Promise<IrrigationPushAlarmRequest> {
  const request = pushAlarmRequest(schedule);
  if (schedule.kind !== 'late') return request;
  const now = new Date();
  try {
    const settings = await readPhoneNoticeSettingsForWorkspace(schedule.workspaceId);
    const decision = quietHoursDecision(settings.quietHours, { kind: 'irrigation-late' }, new Date(schedule.dueAt));
    logQuietHoursDefect(decision, now, logJsonLine);
    return decision.action === 'hold' ? { ...request, dueAt: decision.until } : request;
  } catch {
    logJsonLine('warn', { event: 'quiet_hours_unreadable', at: now.toISOString() });
    return request;
  }
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
