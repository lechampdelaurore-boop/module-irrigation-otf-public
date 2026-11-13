import { expect, test } from '@playwright/test';
import { commencerLaVisite, jouerLaVisite, ouvrirLaDemo } from './support/visite.ts';

/**
 * Parcours V2 : la visite « Un arrosage de A à Z » (contrat, section 7,
 * visite 2 ; D3), dans un navigateur qui refuse le stockage : aucune
 * invitation (elle reviendrait à chaque page), mais la visite passe quand
 * même d'« Arrosages » à « Aujourd'hui » par l'adresse. Elle montre le
 * formulaire et son résultat sans rien remplir ni rien démarrer.
 */
test('V2 Un arrosage de A à Z : d’une page à l’autre, stockage refusé, sans rien démarrer', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Stockage refusé', 'SecurityError');
      },
    });
  });
  const visite = await ouvrirLaDemo(page, 'maraichage', 'ete');
  await expect(page.getByRole('button', { name: 'Visites guidées' })).toBeVisible();
  await expect(page.locator('.tour-bubble')).toHaveCount(0);

  await commencerLaVisite(page, 'Un arrosage de A à Z');
  await jouerLaVisite(page, visite, [
    { titre: 'Trois façons d’enregistrer un arrosage', rang: 'étape 1 sur 6', ancre: 'arrosage-actions', chemin: '/irrigation/arrosages' },
    { titre: 'Le matériel et la quantité', rang: 'étape 2 sur 6', ancre: 'arrosage-champs', chemin: '/irrigation/arrosages' },
    { titre: 'D’où vient ce chiffre', rang: 'étape 3 sur 6', ancre: 'arrosage-resultat', chemin: '/irrigation/arrosages' },
    { titre: 'Vous seul validez', rang: 'étape 4 sur 6', ancre: 'arrosage-resultat', chemin: '/irrigation/arrosages' },
    { titre: 'L’eau du jour', rang: 'étape 5 sur 6', ancre: 'eau-du-jour', chemin: '/irrigation/arrosages' },
    { titre: 'Retrouver ses arrosages', rang: 'étape 6 sur 6', ancre: 'aujourdhui-journee', chemin: '/irrigation/aujourdhui' },
  ]);
  // Rien n'a démarré : aucune irrigation en cours.
  await page.goto('/irrigation/arrosages');
  await expect(page.locator('.irrigation-event-counts')).toContainText('0 en cours');
});
