'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { dismissFeatureBannerForUser, InvalidFeatureSelectionError } from '@/db/feature-selection-repository';
import { logJsonLine } from '@/lib/adapters/log';
import { normalizeSelection, firstEnabledFeature } from '@/lib/domain/features/selection';
import { landingPage, pageHref } from '@/lib/domain/features/pages';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import { chooseStartForUser, EMPTY_SELECTION_MESSAGE } from '@/lib/services/start-choice';
import { dateKeyInTimeZone, FARM_TIME_ZONE } from '@/lib/domain/water-management';
import { changeFeatureSelectionForUser } from '@/lib/services/feature-selection-change';

/**
 * Le choix des cases (docs/feature-selection-contract.md, section 4) : à la
 * première ouverture, avec la façon de commencer (simplification, lot S6,
 * D-336), et dans Réglages. Le domaine complète les cases dont une case
 * cochée a besoin (R3) ; un choix vide est refusé (P7). Décocher n'efface
 * rien (R1) : seule la ligne du choix change, et ce qui en dépend hors de
 * l'écran suit (R9 : les alarmes des arrosages, le plan de la semaine).
 */

export type FeatureSelectionActionResult =
  | { ok: true; message: string; firstPage: string }
  /** `firstPage` : le choix de départ était déjà fait (un second appui) ; la page d'arrivée s'ouvre quand même (lot S6, section 12). */
  | { ok: false; message: string; firstPage?: string };

/** La saison de la page, pour le plan à recalculer ; sinon celle de l'année. */
function seasonOf(value: unknown, now: Date): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 9999) return value;
  return Number(dateKeyInTimeZone(now, FARM_TIME_ZONE).slice(0, 4));
}

/**
 * Le choix de la première ouverture (simplification, lot S6,
 * docs/simplification-s6-contract.md, sections 3.4 et 12 ; D-336), par le
 * service qui calcule les cases d'une façon de commencer : un second appui
 * apprend que le choix est déjà fait, et la page d'arrivée s'ouvre quand même.
 */
async function saveStartChoice(userId: string, startMode: unknown, enabled: readonly unknown[]): Promise<FeatureSelectionActionResult> {
  try {
    const outcome = await chooseStartForUser(userId, { startMode, enabled });
    if (outcome.kind === 'refused') return { ok: false, message: outcome.message };
    if (outcome.kind === 'already-chosen') return { ok: false, message: 'Vous avez déjà choisi comment commencer.', firstPage: pageHref(outcome.firstPage) };
    // Des noms de cases et une façon, jamais l'identifiant de la personne.
    logJsonLine('info', { event: 'irrigation_features_chosen', startMode: outcome.startMode, enabled: outcome.enabled, at: new Date().toISOString() });
    return { ok: true, message: 'Le choix des fonctionnalités est enregistré.', firstPage: pageHref(outcome.firstPage) };
  } catch (error) {
    if (error instanceof InvalidFeatureSelectionError) return { ok: false, message: error.message };
    return { ok: false, message: 'Le choix n’a pas pu être enregistré. Réessayez.' };
  }
}

export async function saveFeatureSelectionAction(input: { enabled?: readonly string[]; season?: number | null; startMode?: string }): Promise<FeatureSelectionActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  const enabledInput: readonly unknown[] = Array.isArray(input.enabled) ? input.enabled : [];
  if (input.startMode !== undefined) return saveStartChoice(user.userId, input.startMode, enabledInput);
  // Des cases sans façon de commencer, pour une ferme qui n'a jamais ouvert le module (une page d'avant S6) : ses cases à elle.
  if ((await getFeatureSelectionForUser(user.userId)).firstVisit) return saveStartChoice(user.userId, 'custom', enabledInput);
  const enabled = normalizeSelection(enabledInput);
  const first = firstEnabledFeature(enabled);
  if (first === null) return { ok: false, message: EMPTY_SELECTION_MESSAGE };
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
