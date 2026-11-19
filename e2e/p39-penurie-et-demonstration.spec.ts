import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P39 : l'audit ergonomique du 19 novembre 2026, lot I,
 * « Pénurie et démonstration » (docs/audit-ergonomie-2026-11-19-lot-i-contract.md ;
 * docs/browser-journeys-contract.md).
 *
 * Sur la ferme de démonstration, sans rien écrire :
 *
 * - le manque dit d'où il vient (n° 5, F447) : l'écran de répartition de
 *   « Ressources » dit ce que son calcul ne compte pas en notes de texte
 *   ordinaire, jamais en avertissements orange en jargon ; « Recalculer la
 *   faisabilité » est un bouton secondaire.
 *
 * Ce qu'il ne prouve pas : la phrase de l'eau versée sur des planches sans
 * besoin et l'écran d'un manque que la faisabilité ne voit pas (la
 * démonstration « Pic d'été » les montre ; les tests de
 * `tests/db/audit-ergonomie-2026-11-19-lot-i.test.ts` les chiffrent), la
 * ferme réelle.
 */

test('la répartition dit ce qu’elle ne compte pas sans jargon', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'ressources');
  const faisabilite = page.locator('section#repartition');
  await faisabilite.scrollIntoViewIfNeeded();
  await expect(faisabilite.locator('.feasibility-meta')).toBeVisible({ timeout: 30_000 });
  await expect(faisabilite.locator('.feasibility-note').filter({ hasText: 'Calcul en volume seulement' })).toBeVisible();
  await expect(faisabilite.locator('.feasibility-warning').filter({ hasText: /Analyse volumétrique|non calculable/ })).toHaveCount(0);
  // « Recalculer la faisabilité » en contour, plus en vert plein.
  const recalculer = faisabilite.getByRole('button', { name: 'Recalculer la faisabilité' });
  const fond = await recalculer.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(fond === 'rgba(0, 0, 0, 0)' || fond === 'transparent', `fond ${fond}`).toBe(true);
  await verifierLEtape(page, journal, 'faisabilité lue sans jargon');
});
