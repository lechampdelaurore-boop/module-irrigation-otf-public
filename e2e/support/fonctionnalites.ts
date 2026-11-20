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

/**
 * Une ferme neuve choisit la commune de sa ferme (4.4, F419, F582) : sans
 * elle, ni météo, ni gel, ni ET0. Ici, le siège de la structure, pris en
 * dernier recours dans Réglages, par le lien du bandeau « À finir ».
 */
async function choisirLeSiegeCommeCommune(page: Page): Promise<void> {
  await page.goto('/irrigation/reglages');
  await attendreLaPagePrete(page, 'reglages');
  await page.locator('.onboarding-unfinished').getByRole('link', { name: 'commune de la ferme' }).click();
  // Le lien porte la saison : la page se recharge, et répond après son titre.
  await expect(page).toHaveURL(/#water-weather-title$/);
  await attendreLaPagePrete(page, 'reglages');
  await page.getByRole('button', { name: 'Prendre le siège OTF, en dernier recours' }).click();
  await expect(page.getByText('La commune du siège OTF est utilisée, en dernier recours.')).toBeVisible();
}

/**
 * Une ferme neuve classe ses jardins comme proposé (4.4, F420, F583) : sans
 * classement, leur besoin en eau n'est pas calculé. Dans Réglages, par le
 * lien du bandeau « À finir », après avoir lu chaque proposition.
 */
async function classerLesJardinsCommeProposes(page: Page): Promise<void> {
  await page.goto('/irrigation/reglages');
  await attendreLaPagePrete(page, 'reglages');
  await page.locator('.onboarding-unfinished').getByRole('link', { name: /jardins? à classer$/ }).click();
  await expect(page).toHaveURL(/#parcelles-et-abris$/);
  await attendreLaPagePrete(page, 'reglages');
  await page.getByRole('button', { name: 'Confirmer les propositions restantes' }).click();
  await expect(page.getByText(/^\d+ jardins? classés? comme proposé\.$/)).toBeVisible();
}

/**
 * Une ferme neuve confirme l'étape « Cultures » (4.4, F587) sans rien
 * rattacher : ses espèces restent comme le parcours les attend, et le
 * bandeau « À finir » ne les rappelle plus. Seulement quand le bandeau les
 * nomme : une case qui lit la correspondance des espèces est cochée.
 */
async function confirmerLEtapeDesCultures(page: Page): Promise<void> {
  await page.goto('/irrigation/reglages');
  await attendreLaPagePrete(page, 'reglages');
  const lien = page.locator('.onboarding-unfinished').getByRole('link', { name: /espèces? à rattacher$/ });
  if (await lien.count() === 0) return;
  await lien.click();
  await expect(page).toHaveURL(/#rattachez-vos-especes$/);
  await attendreLaPagePrete(page, 'reglages');
  await page.getByRole('button', { name: 'Confirmer l’étape « Cultures »' }).click();
  await expect(page.getByText('L’étape « Cultures » est confirmée.')).toBeVisible();
}

/** Une ferme neuve qui a fait ce que les calculs attendent d'elle : sa commune, ses jardins et l'étape « Cultures » (4.4, F582, F583, F587). */
export async function preparerLaFermeNeuve(page: Page): Promise<void> {
  await choisirLeSiegeCommeCommune(page);
  await classerLesJardinsCommeProposes(page);
  await confirmerLEtapeDesCultures(page);
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
