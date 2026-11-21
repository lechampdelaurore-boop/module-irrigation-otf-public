import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { newPushAlarmRevision } from '@/db/irrigation-event/push-schedule';
import {
  claimPhoneNotice,
  DEFAULT_PHONE_NOTICE_SETTINGS,
  listPhoneNoticeSettings,
  markPhoneNoticeSent,
  releasePhoneNotice,
} from '@/db/phone-notice-repository';
import { logJsonLine, type LogLevel } from '../adapters/log';
import { errorClassWords } from '../domain/operations/morning-task-outcomes';
import { eveningPassUseful, eveningReminder, eveningReminderDue } from '../domain/today/evening-reminder';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, localDateStartUtc } from '../domain/water-management';
import { listFarmsWithFeature } from './feature-selection-service';
import { scheduleIrrigationPushAlarm } from './irrigation-push-service';
import type { PlanningAlarmScheduler } from './morning-message';
import { recordTaskOutcomes } from './task-runs';

/**
 * Le passage du rappel du soir (amélioration n° 2,
 * docs/ameliorations-6-2-3-7-contract.md, section 4.3, F704, F705, F714) :
 * chaque heure, le planificateur appelle la route interne. Seules les fermes
 * qui cochent « Arrosages » et ne sont pas figées par une demande
 * d'effacement sont lues ; parmi elles, celles dont le rappel est activé et
 * dû à cette heure. Pour chacune, le rappel part par l'alarme à échéance
 * immédiate du Worker de notification, sous la clé de l'espace, une fois par
 * jour au plus : la prise du jour se garde en base avant l'envoi et se rend
 * s'il échoue. Une ferme en panne n'arrête pas les autres. Le passage
 * s'enregistre comme une tâche du registre (`evening-reminder`). Le journal
 * ne porte que des nombres.
 */

export type EveningPassResult = {
  /** Les fermes dont le rappel était dû à ce passage. */
  due: number;
  sent: number;
  alreadySent: number;
  failed: number;
  successful: boolean;
};

export async function runEveningReminders({
  now = new Date(),
  schedule = scheduleIrrigationPushAlarm,
  log = logJsonLine,
}: {
  now?: Date;
  schedule?: PlanningAlarmScheduler;
  log?: (level: LogLevel, entry: Record<string, unknown>) => void;
} = {}): Promise<EveningPassResult> {
  const at = now.toISOString();
  const result: EveningPassResult = { due: 0, sent: 0, alreadySent: 0, failed: 0, successful: true };
  let error: string | null = null;
  try {
    if (eveningPassUseful(now)) {
      const [farms, settings] = await Promise.all([listFarmsWithFeature('arrosages'), listPhoneNoticeSettings()]);
      for (const farm of farms) {
        const setting = settings.get(farm.workspaceId) ?? DEFAULT_PHONE_NOTICE_SETTINGS;
        if (!setting.eveningReminder || !eveningReminderDue(setting.eveningTime, now)) continue;
        result.due += 1;
        const outcome = await remindFarm(farm, now, schedule);
        if (outcome === 'sent') result.sent += 1;
        else if (outcome === 'already-sent') result.alreadySent += 1;
        else if (outcome === 'failed') result.failed += 1;
      }
    }
    if (result.failed > 0) error = `${result.failed} ferme${result.failed > 1 ? 's' : ''} sans rappel (panne du service de notification ou de la lecture)`;
  } catch (caught) {
    error = `interrompu avant la fin (${errorClassWords(caught instanceof Error ? caught.name : undefined)})`;
  }
  result.successful = error === null;
  await recordTaskOutcomes([{ task: 'evening-reminder', successful: result.successful, error }], { at, log });
  log(result.successful ? 'info' : 'warn', {
    event: result.successful ? 'evening_reminder_pass_completed' : 'evening_reminder_pass_failed',
    due: result.due,
    sent: result.sent,
    alreadySent: result.alreadySent,
    failed: result.failed,
    summary: error ?? undefined,
  });
  return result;
}

type FarmOutcome = 'sent' | 'already-sent' | 'nothing' | 'failed';

/** Le rappel d'une ferme : rien si tout est confirmé ; la prise du jour avant l'envoi, rendue s'il échoue. */
async function remindFarm(farm: { workspaceId: string; ownerUserId: string }, now: Date, schedule: PlanningAlarmScheduler): Promise<FarmOutcome> {
  let claimedDay: string | null = null;
  try {
    const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
    const events = await listIrrigationEventsForUser(farm.ownerUserId, undefined, false, {
      startAt: localDateStartUtc(today, FARM_TIME_ZONE).toISOString(),
      endAt: localDateStartUtc(addDaysToDateKey(today, 1), FARM_TIME_ZONE).toISOString(),
    });
    const reminder = eveningReminder({ now, events });
    if (!reminder) return 'nothing';
    if (!(await claimPhoneNotice(farm.workspaceId, 'evening', reminder.parisDay, now.toISOString()))) return 'already-sent';
    claimedDay = reminder.parisDay;
    const sent = await schedule({
      eventEquipmentId: reminder.alarmId,
      recipientKey: farm.workspaceId,
      revision: newPushAlarmRevision(now),
      dueAt: now.toISOString(),
      notification: { title: reminder.title, body: reminder.body, tag: reminder.tag, data: { url: reminder.url } },
    });
    if (sent.status === 'ok') {
      await markPhoneNoticeSent(farm.workspaceId, 'evening', reminder.parisDay, now.toISOString());
      return 'sent';
    }
    await releasePhoneNotice(farm.workspaceId, 'evening', reminder.parisDay);
    // Le service non configuré n'est pas une panne de la ferme : rien n'est parti, rien n'est compté.
    return sent.status === 'disabled' ? 'nothing' : 'failed';
  } catch {
    if (claimedDay) await releasePhoneNotice(farm.workspaceId, 'evening', claimedDay).catch(() => undefined);
    return 'failed';
  }
}
