import { expect, test, type Page } from '@playwright/test';
import { pageDocumentTitle } from '../lib/domain/features/pages.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  ouvrirLeMenuDesPages,
  surveillerLaConsole,
  TITRES_DES_PAGES,
  verifierLEtape,
  type PageDuModule,
} from './support/parcours.ts';

/**
 * Parcours P59 : changer de page sans recharger le module (D-322,
 * docs/browser-journeys-contract.md ; constat du 24 novembre 2026, le module
 * « rame » au téléphone comme à l'ordinateur).
 *
 * Sur la ferme de démonstration, qui a tout coché : un clic du menu, de la
 * barre du bas ou de la feuille « Plus » au téléphone, change la page sans
 * recharger l'application (une marque posée dans la fenêtre survit au
 * changement) ; la page suivie a son titre, son onglet et sa marque dans le
 * menu ; la feuille « Plus » est refermée ; le clavier repart du contenu de la
 * nouvelle page ; le retour du navigateur ramène la page d'avant. Rien n'est
 * enregistré : le parcours ne laisse aucune trace dans la base partagée.
 */

const MARQUE = 'p59-sans-rechargement';

async function poserLaMarque(page: Page): Promise<void> {
  await page.evaluate((marque) => {
    (window as unknown as Record<string, string>)[marque] = 'posée';
  }, MARQUE);
}

async function laMarque(page: Page): Promise<string | null> {
  return page.evaluate((marque) => (window as unknown as Record<string, string | undefined>)[marque] ?? null, MARQUE);
}

async function suivreLeMenu(page: Page, cible: PageDuModule): Promise<void> {
  const menu = await ouvrirLeMenuDesPages(page);
  await menu.getByRole('link', { name: TITRES_DES_PAGES[cible], exact: true }).click();
  await attendreLaPagePrete(page, cible);
}

test('un clic du menu change la page sans recharger le module, et le clavier repart de son contenu', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';

  await attendreLaPageIrrigation(page, 'arrosages');
  await poserLaMarque(page);

  // Une page de la feuille « Plus » au téléphone, du menu de gauche à l'ordinateur.
  await suivreLeMenu(page, 'materiel');
  expect(await laMarque(page), 'le module n’a pas été rechargé').toBe('posée');
  await expect(page).toHaveTitle(pageDocumentTitle(TITRES_DES_PAGES.materiel));
  await expect(page).toHaveURL(/\/irrigation\/materiel(\?|$)/);
  await expect(page.locator('#contenu')).toBeFocused();
  // La feuille « Plus » refermée, comme après un chargement ; « Plus » marque la page ouverte.
  const feuille = page.getByRole('navigation', { name: 'Pages du module' });
  if (telephone) {
    await expect(feuille).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Pages principales' }).getByRole('button', { name: /^Plus de pages/ })).toHaveAttribute('data-marked', 'true');
  } else {
    await expect(feuille.getByRole('link', { name: TITRES_DES_PAGES.materiel, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await verifierLEtape(page, journal, 'Matériel par le menu');

  // Une entrée de la barre du bas au téléphone (le menu de gauche à l'ordinateur).
  if (telephone) {
    await page.getByRole('navigation', { name: 'Pages principales' }).getByRole('link', { name: TITRES_DES_PAGES.planning, exact: true }).click();
    await attendreLaPagePrete(page, 'planning');
  } else {
    await suivreLeMenu(page, 'planning');
  }
  expect(await laMarque(page), 'le module n’a pas été rechargé').toBe('posée');
  await expect(page).toHaveTitle(pageDocumentTitle(TITRES_DES_PAGES.planning));
  await expect(page.locator('#contenu')).toBeFocused();
  await verifierLEtape(page, journal, 'Planning par le menu');

  // Le retour du navigateur ramène la page d'avant, sans recharger non plus.
  await page.goBack();
  await attendreLaPagePrete(page, 'materiel');
  expect(await laMarque(page), 'le module n’a pas été rechargé').toBe('posée');
  await verifierLEtape(page, journal, 'retour à Matériel');
});
