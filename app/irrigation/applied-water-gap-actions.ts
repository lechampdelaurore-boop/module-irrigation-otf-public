'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/app/access-auth';
import { parseGapAdoption } from '@/lib/domain/applied-water-gap';
import { adoptAppliedWaterGapForUser, type GapAdoptionResult } from '@/lib/services/applied-water-gap-adoption';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';

/**
 * « Adopter » une proposition du bloc « L'eau apportée s'écarte du prévu »
 * (amélioration n° 5, F735) : le propriétaire vient de la session, la
 * proposition montrée par l'écran est relue sans rien croire ; la règle et
 * la vérification vivent dans le service.
 */

export type GapAdoptionActionResult = ({ ok: true } & GapAdoptionResult) | { ok: false; message: string };

export async function adoptAppliedWaterGapAction(input: { season: number; weekStart: string; adoption: unknown }): Promise<GapAdoptionActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(input.season) || input.season < 1900 || input.season > 9999) return { ok: false, message: 'La saison sélectionnée est invalide.' };
  const adoption = parseGapAdoption(input.adoption);
  if (typeof input.weekStart !== 'string' || !adoption) return { ok: false, message: 'Proposition invalide.' };
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season: input.season });
    const result = await adoptAppliedWaterGapForUser({ ownerUserId: user.userId, season: input.season, snapshot, weekStart: input.weekStart, adoption });
    if (result.adopted) revalidatePath('/irrigation');
    return { ok: true, ...result };
  } catch (error) {
    // Une erreur de la base ne se montre pas telle quelle : elle dit seulement que les données ont changé (comme la faisabilité).
    const message = error instanceof Error ? error.message : '';
    return { ok: false, message: /D1|SQL|revision/i.test(message) ? 'Les données viennent de changer. Rechargez le planning.' : message || 'L’adoption a échoué. Réessayez.' };
  }
}
