import { expect, test } from '@playwright/test';
import { ciblesTropPetites, textesPeuContrastes } from '../e2e/support/accessibilite.ts';
import { ecarterLInvitation, ouvrirLaDemo } from './support/visite.ts';

/**
 * Parcours V9 : la bannière de la démonstration en une ligne au téléphone
 * (docs/audit-ergonomie-final-lot-f-contract.md, section 3 ; J1, cas 1 à 3).
 * Au téléphone, une ligne de 44 px dit la ferme et le moment, et « Changer »
 * ouvre le reste dessous : les deux listes, la remise à zéro, les visites ;
 * le détail est replié à chaque page. À l'ordinateur, rien ne change.
 */
const TEXTE = 'Démonstration : données fictives. Rien ici ne touche une vraie ferme.';

test('V9 La bannière : une ligne au téléphone, « Changer » ouvre le reste ; à l’ordinateur, tout reste en vue', async ({ page }) => {
  const visite = await ouvrirLaDemo(page, 'maraichage', 'penurie', '/irrigation/aujourdhui');
  await ecarterLInvitation(page);
  const banniere = page.locator('aside.demo-banner');
  const changer = banniere.locator('.demo-banner-toggle');
  const choix = banniere.locator('[data-tour="banniere-choix"]');
  const remise = banniere.locator('.demo-reset-button');
  const visites = banniere.getByRole('button', { name: 'Visites guidées' });
  const texte = banniere.getByText(TEXTE);
  const telephone = page.viewportSize()!.width <= 600;

  if (!telephone) {
    // Cas 3 : identique à avant le lot.
    await expect(changer).toBeHidden();
    await expect(banniere.locator('.demo-banner-line')).toBeHidden();
    for (const element of [texte, choix, remise, visites]) await expect(element).toBeVisible();
    expect(visite.journal.erreurs).toEqual([]);
    return;
  }

  // Cas 1 : une ligne de 44 px ; le texte reste lu par un lecteur d'écran.
  const boite = await banniere.boundingBox();
  expect(boite!.height, 'la bannière tient en une ligne de 44 px').toBeLessThanOrEqual(45);
  // L'invitation écartée n'ouvre pas le détail : le focus va à « Changer ».
  await expect(changer).toBeFocused();
  await expect(banniere.locator('.demo-banner-line')).toHaveText('Démonstration · Maraîchage diversifié · Pic d’été');
  await expect(changer).toHaveText('Changer');
  await expect(changer).toHaveAttribute('aria-expanded', 'false');
  await expect(texte).toHaveCount(1);
  for (const element of [choix, remise, visites]) await expect(element).toBeHidden();
  expect(await ciblesTropPetites(page, 44, 'aside.demo-banner')).toEqual([]);

  // Cas 2 : « Changer » ouvre les deux listes, la remise à zéro et les visites, sans défilement de côté.
  await changer.click();
  await expect(changer).toHaveAttribute('aria-expanded', 'true');
  await expect(changer).toHaveText('Fermer');
  for (const element of [texte, choix, remise, visites]) await expect(element).toBeVisible();
  await expect(banniere.getByRole('combobox')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'défilement de côté').toBe(true);
  expect(await ciblesTropPetites(page, 44, 'aside.demo-banner')).toEqual([]);
  expect(await textesPeuContrastes(page, 'aside.demo-banner')).toEqual([]);
  await changer.click();
  await expect(changer).toHaveAttribute('aria-expanded', 'false');
  await expect(choix).toBeHidden();

  // Replié à chaque page.
  await changer.click();
  await page.goto('/irrigation/planning');
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  await expect(changer).toHaveAttribute('aria-expanded', 'false');
  await expect(choix).toBeHidden();
  expect(visite.journal.erreurs).toEqual([]);
  expect(visite.envois, 'la bannière a écrit à la place du visiteur').toEqual([]);
});
