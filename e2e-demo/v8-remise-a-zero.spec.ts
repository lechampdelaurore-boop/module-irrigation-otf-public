import { expect, test } from '@playwright/test';
import { ecarterLInvitation, ouvrirLaDemo, verifierLAccessibiliteDe } from './support/visite.ts';

/**
 * Parcours V8 : « Remettre à zéro » (docs/demo-guided-contract.md, section 8 ;
 * D4). Sur la ferme vierge, l'invité coche une fonctionnalité ; le bouton de
 * la bannière demande d'abord confirmation (Annuler et Échap ne changent rien
 * et rendent le focus au bouton), puis rend à la ferme sa première ouverture :
 * la liste à cocher, rien de coché. La fenêtre tient les cibles de 44 px et
 * les contrastes de 4,5:1 (section 9).
 */
test('V8 Remettre à zéro : rien sans confirmation, puis la ferme vierge revient à sa liste à cocher', async ({ page }) => {
  await ouvrirLaDemo(page, 'vierge', 'ete');
  await expect(page).toHaveURL(/\/irrigation\/bienvenue/);
  await ecarterLInvitation(page);
  await page.locator('[data-tour="fonctionnalites"] input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page).not.toHaveURL(/\/irrigation\/bienvenue/);
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);

  const bouton = page.locator('.demo-reset-button');
  const fenetre = page.getByRole('dialog', { name: 'Remettre à zéro ?' });
  await bouton.click();
  await expect(fenetre).toContainText('Ferme vierge');
  await expect(fenetre).toContainText('Les autres fermes et les autres moments ne changent pas.');
  await verifierLAccessibiliteDe(page, '.demo-reset-dialog');
  await fenetre.getByRole('button', { name: 'Annuler' }).click();
  await expect(fenetre).toHaveCount(0);
  await expect(bouton).toBeFocused();
  await bouton.click();
  await expect(fenetre).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(fenetre).toHaveCount(0);
  await expect(bouton).toBeFocused();
  await page.reload();
  await expect(page).not.toHaveURL(/\/irrigation\/bienvenue/);

  await bouton.click();
  await fenetre.getByRole('button', { name: 'Remettre à zéro' }).click();
  await expect(page).toHaveURL(/\/irrigation\/bienvenue/);
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  await expect(page.locator('[data-tour="fonctionnalites"] input:checked')).toHaveCount(0);
});
