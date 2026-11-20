import { answerSettingsGroupForUser } from '@/db/onboarding-repository';
import type { FeatureId } from '../domain/features/catalogue';
import { settingsAnswers, settingsGroupsFor, type SettingsGroup, type SettingsGroupAnswer, type SettingsGroupId } from '../domain/onboarding/settings-review';
import { getOnboardingForUser } from './onboarding-service';

/**
 * L'étape « Réglages à relire » d'une ferme neuve (4.4,
 * docs/tranche-4-contract.md, F424 ; PR 5a, F588) : les groupes des cases
 * cochées, chacun avec sa réponse. La ferme du porteur (espace d'avant
 * l'accueil) et la démonstration n'ont pas cette étape (F426).
 */

export type SettingsReview = {
  groups: (SettingsGroup & { answer: SettingsGroupAnswer | null })[];
  confirmed: boolean;
};

export async function getSettingsReviewForUser(spaceKey: string, enabled: readonly FeatureId[]): Promise<SettingsReview | null> {
  const onboarding = await getOnboardingForUser(spaceKey);
  if (onboarding.kind !== 'onboarding') return null;
  const step = onboarding.steps.find((item) => item.id === 'settings');
  const answers = settingsAnswers(step?.proposedValue ?? null);
  return {
    groups: settingsGroupsFor(enabled).map((group) => ({ ...group, answer: answers[group.id] ?? null })),
    confirmed: step?.state === 'confirmed',
  };
}

export async function answerSettingsGroupOfUser(input: {
  spaceKey: string;
  enabled: readonly FeatureId[];
  group: SettingsGroupId;
  answer: SettingsGroupAnswer;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const onboarding = await getOnboardingForUser(input.spaceKey);
  if (onboarding.kind !== 'onboarding') return { ok: false, message: 'Cette étape ne concerne qu’une ferme qui fait l’accueil.' };
  const shown = settingsGroupsFor(input.enabled).map((group) => group.id);
  if (!shown.includes(input.group)) return { ok: false, message: 'Ce groupe n’est pas à relire pour les fonctionnalités cochées.' };
  await answerSettingsGroupForUser(input.spaceKey, (current) => {
    const groups = { ...settingsAnswers(current), [input.group]: input.answer };
    return { value: { groups }, complete: shown.every((id) => groups[id] !== undefined) };
  }, input.now);
  return { ok: true };
}
