import { readPhoneNoticeSettingsForWorkspace } from '@/db/phone-notice-repository';
import type { LogLevel } from '../adapters/log';
import type { IrrigationPushAlarmRequest, IrrigationPushSendRequest } from '../domain/irrigation-push-contract';
import {
  DEFAULT_QUIET_HOURS,
  quietHoldAlarmId,
  quietHoursDecision,
  type QuietHoursDecision,
  type QuietHoursNotification,
  type QuietHoursSettings,
} from '../domain/notification-quiet-hours';
import type { IrrigationPushSendResult, PhoneNoticeAlarmResult } from './irrigation-push-service';

/**
 * Les envoyeurs et les heures de silence (6 undecies, PR H2,
 * docs/heures-de-silence-contract.md, sections 3 et 5 ; D-322) : ce que les
 * cinq envoyeurs partagent. La règle elle-même vit dans le domaine
 * (`quietHoursDecision`) ; ici, la lecture du réglage d'une ferme, l'alarme
 * qui retient une alerte jusqu'à la fin de la plage, et le repli quand la
 * retenue échoue (S8). Le journal ne nomme ni ferme ni personne.
 */

type Log = (level: LogLevel, entry: Record<string, unknown>) => void;

export type QuietAlertSender = (request: IrrigationPushSendRequest) => Promise<IrrigationPushSendResult>;
export type QuietAlarmScheduler = (request: IrrigationPushAlarmRequest) => Promise<PhoneNoticeAlarmResult>;

/**
 * Le réglage d'une ferme, lu au premier envoi qui en a besoin, une seule fois
 * pour toute une évaluation. Illisible, la plage compte pour éteinte et le
 * message part comme avant (S8) : une alerte de gel perdue coûte plus cher
 * qu'une alerte qui sonne la nuit.
 */
export function quietHoursReader(workspaceId: string, now: Date, log: Log): () => Promise<QuietHoursSettings> {
  let settings: Promise<QuietHoursSettings> | null = null;
  return () => {
    settings ??= readPhoneNoticeSettingsForWorkspace(workspaceId)
      .then((read) => read.quietHours)
      .catch(() => {
        log('warn', { event: 'quiet_hours_unreadable', at: now.toISOString() });
        return DEFAULT_QUIET_HOURS;
      });
    return settings;
  };
}

/** Un défaut de la règle (S7, S17) se dit au journal, sans nom ; la notification part quand même. */
export function logQuietHoursDefect(decision: QuietHoursDecision, now: Date, log: Log): void {
  if (decision.action === 'send' && decision.defect) log('warn', { event: 'quiet_hours_defect', defect: decision.defect, at: now.toISOString() });
}

/** Ce qu'est devenue une alerte : le résultat de son envoi immédiat, ou retenue jusqu'à la fin de la plage. */
export type QuietAlertResult = IrrigationPushSendResult | { status: 'held'; until: string };

/**
 * Une alerte météo ou par culture, qui part d'ordinaire par l'envoi immédiat
 * (S3, S4, S9, S10). Hors de la plage, ou quand elle passe toujours (le gel,
 * case cochée), elle part tout de suite, comme avant. Dans la plage, elle est
 * retenue : une alarme du Worker sous l'identifiant de l'espace et de son
 * étiquette (F800), même révision, même message, à échéance de la fin de la
 * plage. Le Worker la garde (`scheduled`), ou garde déjà sous cet
 * identifiant une retenue plus récente de la même étiquette (`stale`), qui
 * partira à la même fin : dans les deux cas l'alerte est retenue. Le Worker ne
 * dit jamais ce que devient une alarme : une retenue gardée compte comme
 * envoyée, comme le message du matin (F745). Une retenue refusée ou un
 * service injoignable : l'alerte part tout de suite, et l'incident se dit
 * sans nom (S8) ; sans service configuré, elle part comme avant, sans
 * incident.
 */
export async function sendAlertWithQuietHours({
  settings,
  notification,
  request,
  now,
  send,
  schedule,
  log,
}: {
  settings: QuietHoursSettings;
  notification: QuietHoursNotification;
  request: IrrigationPushSendRequest;
  now: Date;
  send: QuietAlertSender;
  schedule: QuietAlarmScheduler;
  log: Log;
}): Promise<QuietAlertResult> {
  const decision = quietHoursDecision(settings, notification, now);
  logQuietHoursDefect(decision, now, log);
  if (decision.action === 'hold') {
    const held = await scheduleSafely(schedule, {
      eventEquipmentId: quietHoldAlarmId(request.recipientKey, request.notification.tag),
      recipientKey: request.recipientKey,
      revision: request.revision,
      dueAt: decision.until,
      notification: request.notification,
    });
    if (held.status === 'ok' || held.status === 'stale') return { status: 'held', until: decision.until };
    if (held.status === 'failed') log('warn', { event: 'quiet_hold_failed', error: held.message, at: now.toISOString() });
  }
  return sendSafely(send, request);
}

async function scheduleSafely(schedule: QuietAlarmScheduler, request: IrrigationPushAlarmRequest): Promise<PhoneNoticeAlarmResult> {
  try {
    return await schedule(request);
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : 'Le service d’alerte est indisponible.' };
  }
}

/** L'envoi immédiat, qui ne lève jamais : une panne devient un service injoignable, comme avant. */
export async function sendSafely(send: QuietAlertSender, request: IrrigationPushSendRequest): Promise<IrrigationPushSendResult> {
  try {
    return await send(request);
  } catch (error) {
    return { status: 'unreachable', message: error instanceof Error ? error.message : 'Le service d’alerte est indisponible.' };
  }
}
