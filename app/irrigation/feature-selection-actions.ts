'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { dismissFeatureBannerForUser, InvalidFeatureSelectionError } from '@/db/feature-selection-repository';
import { logJsonLine } from '@/lib/adapters/log';
import { normalizeSelection, firstEnabledFeature } from '@/lib/domain/features/selection';
import { landingPage, pageHref } from '@/lib/domain/features/pages';
import { dateKeyInTimeZone, FARM_TIME_ZONE } from '@/lib/domain/water-management';
import { changeFeatureSelectionForUser } from '@/lib/services/feature-selection-change';

/**
 * Le choix des cases (docs/feature-selection-contract.md, section 4) : à la
 * première ouverture et dans Réglages. Le domaine complète les cases dont une
 * case cochée a besoin (R3) ; un choix vide est refusé (P7). Décocher
 * n'efface rien (R1) : seule la ligne du choix change, et ce qui en dépend
 * hors de l'écran suit (R9 : les alarmes des arrosages, le plan de la semaine).
 */

export type FeatureSelectionActionResult =
  | { ok: true; message: string; firstPage: string }
  | { ok: false; message: string };

/** La saison de la page, pour le plan à recalculer ; sinon celle de l'année. */
function seasonOf(value: unknown, now: Date): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 9999) return value;
  return Number(dateKeyInTimeZone(now, FARM_TIME_ZONE).slice(0, 4));
}

export async function saveFeatureSelectionAction(input: { enabled: readonly string[]; season?: number | null }): Promise<FeatureSelectionActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  const enabled = normalizeSelection(Array.isArray(input.enabled) ? input.enabled : []);
  const first = firstEnabledFeature(enabled);
  if (first === null) return { ok: false, message: 'Cochez au moins une fonctionnalité pour continuer.' };
  try {
    const now = new Date();
    await changeFeatureSelectionForUser(user.userId, enabled, { season: seasonOf(input.season, now), now });
    // Des noms de cases et une date, jamais l'identifiant de la personne.
    logJsonLine('info', { event: 'irrigation_features_chosen', enabled, at: new Date().toISOString() });
    // La page d'arrivée : « Aujourd'hui » quand elle existe (audit ergonomique, lot 2, F1), sinon la première page cochée.
    return { ok: true, message: 'Le choix des fonctionnalités est enregistré.', firstPage: pageHref(landingPage(enabled)) };
  } catch (error) {
    if (error instanceof InvalidFeatureSelectionError) return { ok: false, message: error.message };
    return { ok: false, message: 'Le choix n’a pas pu être enregistré. Réessayez.' };
  }
}

export async function dismissFeatureBannerAction(): Promise<{ ok: boolean }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false };
  try {
    await dismissFeatureBannerForUser(user.userId, new Date());
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
