import { expect, test } from '@playwright/test';
import { commencerLaVisite, ecarterLInvitation, etapeSuivante, jouerLaVisite, ouvrirLaDemo, verifierLEtapeDeVisite } from './support/visite.ts';

/**
 * Parcours V6 : la visite « Le module à la carte » (contrat, section 7,
 * visite 6 ; D3) pour la ferme qui ne coche presque rien, puis pour la ferme
 * vierge, sur sa première ouverture : l'étape du menu, absent, y est sautée
 * sans message. « Passer » mène à la visite suivante.
 */
async function visitesOffertes(page: import('@playwright/test').Page): Promise<string[]> {
  await page.getByRole('button', { name: 'Visites guidées' }).click();
  const titres = await page.locator('.tour-list li button strong').allInnerTexts();
  await page.keyboard.press('Escape');
  return titres;
}

test('V6 Le module à la carte : Réglages, puis la première ouverture de la ferme vierge', async ({ page }) => {
  const visite = await ouvrirLaDemo(page, 'vannes-alertes', 'ete');
  await ecarterLInvitation(page);
  expect(await visitesOffertes(page)).toEqual(['Bienvenue', 'Les alertes', 'Le module à la carte', 'Et pour ma ferme ?']);
  await commencerLaVisite(page, 'Le module à la carte');
  await jouerLaVisite(page, visite, [
    { titre: 'Cochez ce qui vous sert', rang: 'étape 1 sur 3', ancre: 'fonctionnalites', chemin: '/irrigation/reglages' },
    { titre: 'Sans rien perdre', rang: 'étape 2 sur 3', ancre: 'fonctionnalites', chemin: '/irrigation/reglages' },
    { titre: 'Le menu suit vos cases', rang: 'étape 3 sur 3', ancre: 'menu', chemin: '/irrigation/reglages' },
  ]);

  // La ferme vierge s'ouvre sur la liste à cocher, sans menu.
  const vierge = await ouvrirLaDemo(page, 'vierge', 'ete');
  await expect(page).toHaveURL(/\/irrigation\/bienvenue/);
  expect(await visitesOffertes(page)).toEqual(['Bienvenue', 'Le module à la carte', 'Et pour ma ferme ?']);
  await commencerLaVisite(page, 'Bienvenue');
  await verifierLEtapeDeVisite(page, vierge, { titre: 'Bienvenue dans la démonstration', rang: 'étape 1 sur 5', chemin: '/irrigation/bienvenue' });
  await page.locator('.tour-bubble').getByRole('button', { name: /^Passer/ }).click();
  await verifierLEtapeDeVisite(page, vierge, { titre: 'Cochez ce qui vous sert', rang: 'étape 1 sur 2', ancre: 'fonctionnalites', chemin: '/irrigation/bienvenue' });
  await etapeSuivante(page);
  await verifierLEtapeDeVisite(page, vierge, { titre: 'Sans rien perdre', rang: 'étape 2 sur 2', ancre: 'fonctionnalites', chemin: '/irrigation/bienvenue' });
  await etapeSuivante(page, 'Terminer');
  await expect(page.locator('.tour-bubble')).toHaveCount(0);
  // Rien n'a été coché à la place du visiteur.
  await expect(page.locator('[data-tour="fonctionnalites"] input:checked')).toHaveCount(0);
});
