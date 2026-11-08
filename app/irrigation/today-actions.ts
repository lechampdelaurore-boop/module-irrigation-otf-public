'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { hasTodayPage } from '@/lib/domain/features/pages';
import { todaySeason, type TodayView } from '@/lib/domain/today/today-view';
import { getFeatureSelectionForUser } from '@/lib/services/feature-selection-service';
import { getIrrigationSnapshot, readCachedIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { getTodayBadgeForUser, getTodayViewForUser } from '@/lib/services/today-service';

/**
 * Les lectures de la page « Aujourd'hui » après un geste, et la pastille du
 * menu (audit ergonomique, points 1 et 3, 3.8 quater lot 2, F12). Le
 * propriétaire vient de la session, jamais du formulaire ; la saison est
 * celle du jour (F2). Rien n'est écrit ici : « Démarrer maintenant » et
 * « Recalculer le plan » restent les actions existantes.
 */

export type TodayViewActionResult = { ok: true; view: TodayView } | { ok: false; message: string };

/** La page relue après un geste : le même modèle que l'affichage, avec l'instantané de la page. */
export async function loadTodayViewAction(): Promise<TodayViewActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  try {
    const now = new Date();
    const season = todaySeason(now);
    const selection = await getFeatureSelectionForUser(user.userId);
    const snapshot = await getIrrigationSnapshot(user.userId, { season });
    return { ok: true, view: await getTodayViewForUser({ ownerUserId: user.userId, season, snapshot, enabled: selection.enabled, now }) };
  } catch {
    return { ok: false, message: 'La page n’a pas pu être relue. Rechargez-la.' };
  }
}

/**
 * La pastille de « Aujourd'hui » au menu des autres pages, lue après leur
 * affichage. Elle ne lit jamais Ouvre ta ferme : sans instantané en cache,
 * pas de pastille. Une erreur ne montre rien, plutôt qu'un nombre faux.
 */
export async function readTodayBadgeAction(): Promise<number | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  try {
    const now = new Date();
    const season = todaySeason(now);
    const selection = await getFeatureSelectionForUser(user.userId);
    if (selection.firstVisit || !hasTodayPage(selection.enabled)) return null;
    const snapshot = await readCachedIrrigationSnapshot(user.userId, season);
    if (!snapshot) return null;
    return await getTodayBadgeForUser({ ownerUserId: user.userId, season, snapshot, enabled: selection.enabled, now });
  } catch {
    return null;
  }
}
