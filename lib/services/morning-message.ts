import { newPushAlarmRevision } from '@/db/irrigation-event/push-schedule';
import { claimPhoneNotice, markPhoneNoticeSent, readPhoneNoticeSettingsForWorkspace, releasePhoneNotice } from '@/db/phone-notice-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import { logJsonLine, type LogLevel } from '../adapters/log';
import type { IrrigationSnapshot } from '../domain/domain';
import type { FeatureSelection } from '../domain/features/selection';
import type { IrrigationEventRecord } from '../domain/irrigation-event-record';
import type { IrrigationPushAlarmRequest } from '../domain/irrigation-push-contract';
import type { StoredWeeklyPlan } from '../domain/planning/contract';
import { morningMessage } from '../domain/today/morning-message';
import { type PhoneNoticeAlarmResult, schedulePhoneNoticeAlarm } from './irrigation-push-service';
import { countTodayAlertsForUser } from './today-weather';

/** Le refus du Worker (`stale`), dit au journal : il garde une alarme plus récente sous le même identifiant (F745). */
export const STALE_ALARM_WORDS = 'Le service d’alerte garde une alarme plus récente sous cet identifiant : rien n’est parti.';

export type PlanningAlarmScheduler = (request: IrrigationPushAlarmRequest) => Promise<PhoneNoticeAlarmResult>;

/**
 * Le message unique du matin (amélioration n° 3,
 * docs/ameliorations-6-2-3-7-contract.md, section 4.2, F703, F712, F713 ;
 * docs/replanning-contract.md, règles 21 à 24) : après le calcul quotidien,
 * une alarme à échéance immédiate du Worker de notification, sous
 * l'identifiant de l'espace et du jour de Paris (§4.4, F744), dit les
 * arrosages planifiés d'aujourd'hui, la pluie prévue, les alertes en cours
 * et les suggestions du planning. Rien
 * pour un calcul lancé ou provoqué par le maraîcher : il a le plan sous les
 * yeux (règle 22). Rien si la ferme a coupé le message, ni s'il est déjà
 * parti aujourd'hui : la prise du jour se garde en base avant l'envoi et se
 * rend s'il échoue, ou si le Worker refuse l'alarme (`stale`, F745). Une
 * panne n'altère jamais le plan : la fonction ne lève
 * pas, elle journalise sans nommer personne (règle 23).
 */
export async function sendMorningMessage({
  ownerUserId,
  season,
  snapshot,
  enabled,
  plan,
  events,
  forecastRainMm,
  now,
  schedule = schedulePhoneNoticeAlarm,
  log = logJsonLine,
  countAlerts = countTodayAlertsForUser,
}: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  enabled: FeatureSelection;
  plan: Pick<StoredWeeklyPlan, 'suggestions'>;
  events: readonly IrrigationEventRecord[];
  forecastRainMm: number | null;
  now: Date;
  schedule?: PlanningAlarmScheduler;
  log?: (level: LogLevel, entry: Record<string, unknown>) => void;
  /** Les alertes en cours, remplaçables en test. */
  countAlerts?: typeof countTodayAlertsForUser;
}): Promise<void> {
  let claimed: { workspaceId: string; parisDay: string } | null = null;
  let counts: Record<string, number> = {};
  try {
    const workspaceId = await findWorkspaceIdForUser(ownerUserId);
    if (!workspaceId) return;
    if (!(await readPhoneNoticeSettingsForWorkspace(workspaceId)).morningMessage) return;
    const alerts = await countAlerts({ ownerUserId, snapshot, season, enabled, now });
    const message = morningMessage({ now, workspaceId, events, forecastRainMm, alerts, suggestions: plan.suggestions });
    if (!message) return;
    counts = message.counts;
    if (!(await claimPhoneNotice(workspaceId, 'morning', message.parisDay, now.toISOString()))) {
      log('info', { event: 'morning_message_already_sent', parisDay: message.parisDay, at: now.toISOString() });
      return;
    }
    claimed = { workspaceId, parisDay: message.parisDay };
    const result = await schedule({
      eventEquipmentId: message.alarmId,
      recipientKey: workspaceId,
      revision: newPushAlarmRevision(now),
      dueAt: now.toISOString(),
      notification: { title: message.title, body: message.body, tag: message.tag, data: { url: message.url } },
    });
    if (result.status === 'ok') {
      await markPhoneNoticeSent(workspaceId, 'morning', message.parisDay, now.toISOString());
      log('info', { event: 'morning_message_sent', parisDay: message.parisDay, ...counts, sentAt: now.toISOString() });
      return;
    }
    // Le service non configuré se tait, comme avant ; une panne ou un refus du Worker se dit. Dans tous les cas, la prise est rendue.
    await releasePhoneNotice(workspaceId, 'morning', message.parisDay);
    if (result.status === 'failed' || result.status === 'stale') {
      const error = result.status === 'stale' ? STALE_ALARM_WORDS : result.message;
      log('warn', { event: 'morning_message_failed', parisDay: message.parisDay, ...counts, error, failedAt: now.toISOString() });
    }
  } catch (error) {
    if (claimed) await releasePhoneNotice(claimed.workspaceId, 'morning', claimed.parisDay).catch(() => undefined);
    log('warn', { event: 'morning_message_failed', ...counts, error: error instanceof Error ? error.message : 'unknown', failedAt: now.toISOString() });
  }
}
