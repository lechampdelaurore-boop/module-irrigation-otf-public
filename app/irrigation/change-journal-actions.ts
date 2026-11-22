'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import type { ChangeJournalCursor } from '@/lib/domain/change-journal/entry';
import { changeFamilyFilter, type ChangeJournalPage } from '@/lib/domain/change-journal/view';
import { getChangeJournalPageForUser } from '@/lib/services/change-journal-view';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';

export type ChangeJournalActionResult =
  | { ok: true; page: ChangeJournalPage }
  | { ok: false; message: string };

/**
 * Une page du journal des modifications (amélioration n° 7, §5.5 ; D-288) :
 * le filtre par famille et « Voir plus ». Lecture seule ; l'espace vient de
 * la session, jamais du navigateur. Sans instantané lisible, les lieux se
 * disent par leur sorte, et la page se lit quand même.
 */
export async function loadChangeJournalPageAction(input: { season: number; family: unknown; after: unknown }): Promise<ChangeJournalActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(input.season) || input.season < 1900 || input.season > 9999) {
    return { ok: false, message: 'La saison sélectionnée est invalide.' };
  }
  const after = input.after === null || input.after === undefined ? null : cursorOf(input.after);
  if (after === undefined) return { ok: false, message: 'La suite du journal est introuvable : rechargez la page.' };
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season: input.season }).catch(() => null);
    return { ok: true, page: await getChangeJournalPageForUser({ ownerUserId: user.userId, snapshot, family: changeFamilyFilter(input.family), after }) };
  } catch {
    return { ok: false, message: 'Le journal des modifications est momentanément illisible.' };
  }
}

/** Un repère de reprise venu du navigateur : un instant et un ordre d'écriture ; `undefined` s'il n'en est pas un. */
function cursorOf(value: unknown): ChangeJournalCursor | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { createdAt, sequence } = value as Record<string, unknown>;
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return undefined;
  if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 0) return undefined;
  return { createdAt, sequence };
}
