import { expect, test, type Page } from '@playwright/test';
import { pageDocumentTitle } from '../lib/domain/features/pages.ts';
import {
  allerALaPage,
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  surveillerLaConsole,
  TITRES_DES_PAGES,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P59 : changer de page sans recharger le module (D-322,
 * docs/browser-journeys-contract.md ; constat du 24 novembre 2026, le module
 * « rame » au téléphone comme à l'ordinateur).
 *
 * Sur la ferme de démonstration, qui a tout coché : un clic du menu, ou au
 * téléphone de la barre du bas, d'une fiche de « Ma ferme », du retour « ‹ »
 * (simplification, lot S3, PR 2) et du sélecteur des vues de « Semaine »
 * (lot S4, section 3.2), change la page
 * sans recharger l'application (une marque posée dans la fenêtre survit au
 * changement) ; la page suivie a son titre, son onglet et sa marque dans le
 * menu ou la barre ; le clavier repart du contenu de la nouvelle page ; le
 * retour du navigateur ramène la page d'avant. Rien n'est enregistré : le
 * parcours ne laisse aucune trace dans la base partagée.
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


test('un clic du menu change la page sans recharger le module, et le clavier repart de son contenu', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';

  await attendreLaPageIrrigation(page, 'arrosages');
  await poserLaMarque(page);

  // Le menu de gauche à l'ordinateur ; au téléphone, « Ma ferme » dans la barre du bas, puis la fiche du matériel.
  await allerALaPage(page, 'materiel');
  expect(await laMarque(page), 'le module n’a pas été rechargé').toBe('posée');
  await expect(page).toHaveTitle(pageDocumentTitle(TITRES_DES_PAGES.materiel));
  await expect(page).toHaveURL(/\/irrigation\/materiel(\?|$)/);
  await expect(page.locator('#contenu')).toBeFocused();
  // L'entrée de la page marquée : son lien à l'ordinateur, son endroit au téléphone.
  if (telephone) {
    await expect(page.getByRole('navigation', { name: 'Pages principales' }).getByRole('link', { name: TITRES_DES_PAGES['ma-ferme'], exact: true })).toHaveAttribute('aria-current', 'true');
  } else {
    await expect(page.getByRole('navigation', { name: 'Pages du module' }).getByRole('link', { name: TITRES_DES_PAGES.materiel, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await verifierLEtape(page, journal, 'Matériel par le menu');

  // Le retour « ‹ » au téléphone, sans recharger non plus.
  if (telephone) {
    await page.getByRole('link', { name: 'Retour à Ma ferme' }).click();
    await attendreLaPagePrete(page, 'ma-ferme');
    expect(await laMarque(page), 'le module n’a pas été rechargé').toBe('posée');
    await expect(page.locator('#contenu')).toBeFocused();
    await verifierLEtape(page, journal, 'retour à « Ma ferme »');
  }

  // « Semaine » dans la barre du bas au téléphone, le menu de gauche à l'ordinateur (lot S4).
  await allerALaPage(page, 'semaine');
  expect(await laMarque(page), 'le module n’a pas été rechargé').toBe('posée');
  await expect(page).toHaveTitle(pageDocumentTitle(TITRES_DES_PAGES.semaine));
  await expect(page.locator('#contenu')).toBeFocused();
  await verifierLEtape(page, journal, 'Semaine par le menu');
  // Puis « Les cumuls », par le sélecteur de vue au téléphone, par le menu à l'ordinateur : la vue change sans recharger (section 3.2).
  await allerALaPage(page, 'historique');
  expect(await laMarque(page), 'le module n’a pas été rechargé').toBe('posée');
  await expect(page.getByRole('navigation', { name: 'Vues de la semaine' }).getByRole('link', { name: 'Les cumuls', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#contenu')).toBeFocused();
  await verifierLEtape(page, journal, 'Les cumuls par le sélecteur de vue');

  // Le retour du navigateur ramène la page d'avant, sans recharger non plus.
  await page.goBack();
  await attendreLaPagePrete(page, 'besoins');
  await expect(page.getByRole('navigation', { name: 'Vues de la semaine' }).getByRole('link', { name: 'La semaine', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(await laMarque(page), 'le module n’a pas été rechargé').toBe('posée');
  await verifierLEtape(page, journal, 'retour à la page d’avant');
});

/**
 * N2 (D-323) : `/irrigation` sans ancre, l'adresse de départ de l'application
 * installée, mène à la page d'arrivée sans attendre les scripts du module.
 * Ils sont tous refusés ici : seul le script lu avec la page peut conduire à
 * « Aujourd'hui », dont le titre vient du serveur.
 */
test('l’adresse de départ du module mène à « Aujourd’hui » sans attendre les scripts', async ({ page }) => {
  await page.route('**/*', (route) => (route.request().resourceType() === 'script' ? route.abort() : route.continue()));
  await page.goto('/irrigation');
  await expect(page).toHaveURL(/\/irrigation\/aujourdhui(\?|$)/);
  await expect(page.getByRole('heading', { level: 1, name: TITRES_DES_PAGES.aujourdhui })).toBeVisible();
});
