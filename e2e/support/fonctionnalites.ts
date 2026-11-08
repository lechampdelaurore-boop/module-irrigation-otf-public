import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { attendreLaPagePrete, nomsDesPagesDuMenu } from './parcours.ts';

/**
 * Les parcours du choix des fonctionnalités (3.8, docs/feature-selection-contract.md)
 * jouent sur une ferme neuve, propre à chaque parcours et à chaque largeur :
 * le témoin `demo-farm` choisit une autre ferme de démonstration, hors
 * production seulement (app/access-auth.ts). La ferme de démonstration
 * habituelle, une ferme d'avant la 3.8, n'est pas touchée.
 */
export async function ouvrirUneFermeNeuve(context: BrowserContext, testInfo: TestInfo, nom: string): Promise<void> {
  const adresse = testInfo.project.use.baseURL;
  if (!adresse) throw new Error('Adresse de base absente de la configuration Playwright.');
  await context.addCookies([{ name: 'demo-farm', value: `${nom}-${testInfo.project.name}`, url: adresse }]);
}

/** Une ferme neuve, propre au parcours et à la largeur, toutes les cases cochées, arrivée sur « Aujourd'hui » (P31). */
export async function ouvrirUneFermeToutCochee(page: Page, context: BrowserContext, testInfo: TestInfo, nom: string): Promise<void> {
  await ouvrirUneFermeNeuve(context, testInfo, nom);
  await page.goto('/irrigation/bienvenue');
  await attendreLeChoixDesFonctionnalites(page);
  for (const caseACocher of await page.getByRole('checkbox').all()) {
    if (!(await caseACocher.isChecked())) await caseACocher.check();
  }
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'aujourdhui');
}

/** L'écran de la première ouverture, prêt à répondre. */
export async function attendreLeChoixDesFonctionnalites(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/irrigation\/bienvenue$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Choisissez vos fonctionnalités' })).toBeVisible();
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
}

/** La case d'une fonctionnalité, par le début de son nom : son libellé porte aussi sa description. */
export function caseDeLaFonctionnalite(page: Page, nom: string) {
  return page.getByRole('checkbox', { name: new RegExp(`^${nom}`) });
}

/** Les entrées du menu des pages, dans l'ordre ; au téléphone, par « Plus » ou la barre du bas. */
export async function entreesDuMenu(page: Page): Promise<string[]> {
  return nomsDesPagesDuMenu(page);
}
