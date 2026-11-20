import { expect, test } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P41 : l'audit ergonomique du 19 novembre 2026, lot K,
 * « Finitions de charte » (docs/audit-ergonomie-2026-11-19-lot-k-contract.md ;
 * docs/browser-journeys-contract.md).
 *
 * - Planning (n° 17, F465 et F467) : la ligne d'état en deux lignes, la
 *   semaine et l'heure du calcul d'abord, ses sources dessous, plus
 *   discrètes ; « Réglages du planning » porte le signe des autres plis.
 *
 * Ce qu'il ne prouve pas : la tuile neutre des planches en attente et le
 * « Valider » unique d'un jour à une proposition (les tests du domaine,
 * `tests/audit-ergonomie-2026-11-19-lot-k.test.ts`, les vérifient), la ferme
 * réelle, un vrai téléphone.
 */

test('planning : la ligne d’état en deux lignes, le pli des réglages signé comme les autres', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'lotk-planning');
  await attendreLaPageIrrigation(page, 'planning');
  const planning = page.locator('section.planning-section');
  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  const principale = planning.locator('.planning-meta-main');
  const sources = planning.locator('.planning-meta-sources');
  await expect(principale).toContainText('calculé le', { timeout: 30_000 });
  await expect(principale).toHaveText(/^Semaine du \d{2}\/\d{2} au \d{2}\/\d{2} · calculé le \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} \(à la demande\)$/);
  await expect(sources).toHaveText(/^Prévision météo sur \d+ jours?/);
  const [haut, bas] = await Promise.all([principale.boundingBox(), sources.boundingBox()]);
  expect(haut && bas && bas.y >= haut.y + haut.height - 1, 'les sources sous la semaine').toBe(true);
  await expect(sources).toHaveCSS('font-size', '12px');
  const signe = await planning.locator('details.planning-settings > summary').evaluate((summary) => getComputedStyle(summary, '::after').content);
  expect(signe, 'le chevron des plis').toBe('""');
  await verifierLEtape(page, journal, 'ligne d’état et pli des réglages');
});
