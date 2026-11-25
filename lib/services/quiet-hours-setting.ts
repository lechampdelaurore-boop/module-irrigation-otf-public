import { readPhoneNoticeSettingsForUser, saveQuietHoursForUser, type PhoneNoticeSettings } from '@/db/phone-notice-repository';
import { logJsonLine, type LogLevel } from '@/lib/adapters/log';
import type { QuietHoursSettings } from '@/lib/domain/notification-quiet-hours';
import { rescheduleLateAlarmsForQuietHours } from './irrigation-push-orchestration';
import type { scheduleIrrigationPushAlarm } from './irrigation-push-service';

/**
 * L'enregistrement des heures de silence depuis l'écran (H3,
 * docs/heures-de-silence-contract.md, section 4 et section 13 ; F807, F820) :
 * le réglage s'enregistre (avec le journal des modifications), puis les
 * retards d'irrigation encore à venir de la ferme suivent la plage nouvelle
 * avant la réponse. Le réglage d'avant est lu avant l'écriture ; illisible,
 * il ne bloque rien : chaque retard à venir est reprogrammé. Un retard qui
 * n'a pas pu suivre ne défait pas le réglage : il se compte, et l'écran le dit.
 * Lève `InvalidQuietHoursError` pour un réglage hors des bornes (S1).
 */
export async function saveQuietHoursSettingForUser(
  ownerUserId: string,
  actorUserId: string,
  setting: QuietHoursSettings,
  {
    now = new Date(),
    schedule,
    log = logJsonLine,
  }: {
    now?: Date;
    schedule?: typeof scheduleIrrigationPushAlarm;
    log?: (level: LogLevel, entry: Record<string, unknown>) => void;
  } = {},
): Promise<{ settings: PhoneNoticeSettings; lateAlarms: { rescheduled: number; failed: number } }> {
  const before = await readPhoneNoticeSettingsForUser(ownerUserId).then((settings) => settings.quietHours, () => null);
  const settings = await saveQuietHoursForUser(ownerUserId, actorUserId, setting, now.toISOString());
  const lateAlarms = await rescheduleLateAlarmsForQuietHours(ownerUserId, before, settings.quietHours, { now, schedule, log });
  return { settings, lateAlarms };
}
