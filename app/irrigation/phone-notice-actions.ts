'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { saveMorningMessageForUser } from '@/db/phone-notice-repository';
import { logJsonLine } from '@/lib/adapters/log';

/**
 * Le réglage du message du matin, dans Réglages (amélioration n° 3,
 * docs/ameliorations-6-2-3-7-contract.md, section 4.1, F702, F712) : une
 * case par ferme, enregistrée avec la personne qui la change et l'heure.
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
