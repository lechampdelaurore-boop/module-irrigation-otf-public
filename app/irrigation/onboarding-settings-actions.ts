'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { isSettingsGroupId, type SettingsGroupAnswer } from '@/lib/domain/onboarding/settings-review';
import { getEnabledFeaturesForUser } from '@/lib/services/feature-selection-service';
import { answerSettingsGroupOfUser, getSettingsReviewForUser, type SettingsReview } from '@/lib/services/onboarding-settings';

/**
 * « Réglages à relire », dans Réglages (4.4, docs/tranche-4-contract.md,
 * F424 ; PR 5a, F588) : la personne valide ou passe chaque groupe des cases
 * cochées. Un espace qui ne fait pas l'accueil n'a rien à relire ici (F426).
 */

export type SettingsReviewActionResult =
  | { ok: true; message: string; review: SettingsReview }
  | { ok: false; message: string };

export async function answerSettingsGroupAction(input: { group: string; answer: SettingsGroupAnswer }): Promise<SettingsReviewActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!isSettingsGroupId(input.group) || (input.answer !== 'validated' && input.answer !== 'skipped')) return { ok: false, message: 'Réponse invalide.' };
  try {
    const enabled = await getEnabledFeaturesForUser(user.userId);
    const result = await answerSettingsGroupOfUser({ spaceKey: user.userId, enabled, group: input.group, answer: input.answer });
    if (!result.ok) return result;
    const review = await getSettingsReviewForUser(user.userId, enabled);
    if (!review) return { ok: false, message: 'Cette étape ne concerne qu’une ferme qui fait l’accueil.' };
    const label = review.groups.find((group) => group.id === input.group)?.label ?? input.group;
    return { ok: true, message: `${label} : ${input.answer === 'validated' ? 'validé' : 'passé'}.`, review };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'L’enregistrement n’a pas pu se faire.' };
  }
}
