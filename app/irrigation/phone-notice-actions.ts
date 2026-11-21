'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { InvalidEveningTimeError, saveEveningReminderForUser, saveMorningMessageForUser } from '@/db/phone-notice-repository';
import { eveningTimeText, isEveningTime } from '@/lib/domain/today/evening-reminder';
import { logJsonLine } from '@/lib/adapters/log';

/**
 * Les réglages des messages du téléphone, dans Réglages (améliorations n° 3
 * et n° 2, docs/ameliorations-6-2-3-7-contract.md, section 4.1, F702, F712,
 * F714) : le message du matin, le rappel du soir et son heure, par ferme,
 * enregistrés avec la personne qui les change et l'heure.
 */

export type PhoneNoticeActionResult =
  | { ok: true; message: string; morningMessage: boolean }
  | { ok: false; message: string };

export async function saveMorningMessageAction(input: { enabled: boolean }): Promise<PhoneNoticeActionResult> {
  if (typeof input?.enabled !== 'boolean') return { ok: false, message: 'Réponse invalide.' };
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  try {
    const at = new Date().toISOString();
    const settings = await saveMorningMessageForUser(user.userId, user.userId, input.enabled, at);
    // Une case et une date, jamais l'identifiant de la personne.
    logJsonLine('info', { event: 'morning_message_setting_saved', enabled: settings.morningMessage, at });
    return {
      ok: true,
      message: settings.morningMessage ? 'Le message du matin est activé.' : 'Le message du matin est coupé.',
      morningMessage: settings.morningMessage,
    };
  } catch {
    return { ok: false, message: 'Le réglage n’a pas pu être enregistré. Réessayez.' };
  }
}

export type EveningReminderActionResult =
  | { ok: true; message: string; enabled: boolean; time: string }
  | { ok: false; message: string };

export async function saveEveningReminderAction(input: { enabled: boolean; time: string }): Promise<EveningReminderActionResult> {
  if (typeof input?.enabled !== 'boolean' || !isEveningTime(input.time)) return { ok: false, message: 'Choisissez une heure de 17 h à 22 h, au quart d’heure.' };
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  try {
    const at = new Date().toISOString();
    const settings = await saveEveningReminderForUser(user.userId, user.userId, { enabled: input.enabled, time: input.time }, at);
    // Une case, une heure et une date, jamais l'identifiant de la personne.
    logJsonLine('info', { event: 'evening_reminder_setting_saved', enabled: settings.eveningReminder, time: settings.eveningTime, at });
    return {
      ok: true,
      message: settings.eveningReminder ? `Le rappel du soir est activé, à ${eveningTimeText(settings.eveningTime)}.` : 'Le rappel du soir est coupé.',
      enabled: settings.eveningReminder,
      time: settings.eveningTime,
    };
  } catch (error) {
    if (error instanceof InvalidEveningTimeError) return { ok: false, message: error.message };
    return { ok: false, message: 'Le réglage n’a pas pu être enregistré. Réessayez.' };
  }
}
