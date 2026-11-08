'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/app/access-auth';
import { countText } from '@/lib/domain/today/today-text';
import { todaySeason } from '@/lib/domain/today/today-view';
import { DONE_AS_PLANNED_MAXIMUM, recordDoneAsPlannedForOwner, type DoneAsPlannedOutcome } from '@/lib/services/done-as-planned-service';

/**
 * « Tout est fait » (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.4) : la confirmation envoie les irrigations cochées, rien
 * d'autre. Le propriétaire vient de la session, jamais du formulaire ; la
 * saison est celle du jour (F2) ; chaque irrigation est rejugée par le
 * serveur avant d'être écrite.
 */

export type DoneAsPlannedActionResult =
  | ({ ok: true; message: string } & DoneAsPlannedOutcome)
  | { ok: false; message: string };

export async function recordDoneAsPlannedAction(input: { eventEquipmentIds: unknown }): Promise<DoneAsPlannedActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré. Rechargez la page.' };
  const ids = input?.eventEquipmentIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > DONE_AS_PLANNED_MAXIMUM || !ids.every((id) => typeof id === 'string' && id.length > 0)) {
    return { ok: false, message: 'Cochez au moins une irrigation à enregistrer.' };
  }
  try {
    const now = new Date();
    const outcome = await recordDoneAsPlannedForOwner({ ownerUserId: user.userId, season: todaySeason(now), eventEquipmentIds: ids, now });
    revalidatePath('/irrigation');
    return { ok: true, message: recordedMessage(outcome.recorded), ...outcome };
  } catch {
    return { ok: false, message: 'Les irrigations n’ont pas pu être lues. Rien n’a été enregistré ; rechargez la page.' };
  }
}

/** « 21 irrigations enregistrées comme faites. » */
function recordedMessage(recorded: number): string {
  if (recorded === 0) return 'Aucune irrigation n’a été enregistrée.';
  return `${countText(recorded, 'irrigation enregistrée', 'irrigations enregistrées')} comme faite${recorded > 1 ? 's' : ''}.`;
}
