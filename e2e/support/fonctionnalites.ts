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

/**
 * Une ferme neuve, propre au parcours et à la largeur, toutes les cases cochées
 * par la troisième façon de commencer (« Tout », lot S6, D-336) : la première
 * arrivée est « Ma ferme » (section 3.4), puis « Aujourd'hui », la page
 * d'arrivée des ouvertures suivantes (F31), où le parcours commence (P31).
 */
export async function ouvrirUneFermeToutCochee(page: Page, context: BrowserContext, testInfo: TestInfo, nom: string): Promise<void> {
  await ouvrirUneFermeNeuve(context, testInfo, nom);
  await page.goto('/irrigation/bienvenue');
  await attendreLaPremiereOuverture(page);
  await page.getByRole('radio', { name: 'Tout : sol, cultures et alertes' }).check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'ma-ferme');
  await page.goto('/irrigation/aujourdhui');
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

/**
 * Une ferme neuve valide les réglages du planning (4.4, F424, F588) : sans
 * eux, aucun planning. Seulement quand le bandeau le demande : le Planning
 * est coché.
 */
async function validerLesReglagesDuPlanning(page: Page): Promise<void> {
  await page.goto('/irrigation/reglages');
  await attendreLaPagePrete(page, 'reglages');
  const lien = page.locator('.onboarding-unfinished').getByRole('link', { name: 'réglages du planning à valider' });
  if (await lien.count() === 0) return;
  await lien.click();
  await expect(page).toHaveURL(/#reglages-a-relire$/);
  await attendreLaPagePrete(page, 'reglages');
  await page.getByRole('button', { name: 'Valider « Planning »' }).click();
  await expect(page.locator('section.settings-review').getByRole('status')).toHaveText('Planning : validé.');
}

/** Une ferme neuve qui a fait ce que les calculs attendent d'elle : sa commune, ses jardins, l'étape « Cultures » et les réglages du planning (4.4, F582, F583, F587, F588). */
export async function preparerLaFermeNeuve(page: Page): Promise<void> {
  await choisirLeSiegeCommeCommune(page);
  await classerLesJardinsCommeProposes(page);
  await confirmerLEtapeDesCultures(page);
  await validerLesReglagesDuPlanning(page);
}

/** L'écran de la première ouverture, les trois façons de commencer (lot S6, D-336), prêt à répondre. */
export async function attendreLaPremiereOuverture(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/irrigation\/bienvenue$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Comment voulez-vous commencer ?' })).toBeVisible();
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
}

/** La liste des cases de la première ouverture : « Choisir moi-même les fonctionnalités », sur la même page (S6, section 3.2). */
export async function attendreLeChoixDesFonctionnalites(page: Page): Promise<void> {
  await attendreLaPremiereOuverture(page);
  await page.getByRole('button', { name: 'Choisir moi-même les fonctionnalités' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Choisir moi-même les fonctionnalités' })).toBeVisible();
}

/** La case d'une fonctionnalité, par le début de son nom : son libellé porte aussi sa description. */
export function caseDeLaFonctionnalite(page: Page, nom: string) {
  return page.getByRole('checkbox', { name: new RegExp(`^${nom}`) });
}

/** Les entrées du menu des pages, dans l'ordre des trois endroits ; au téléphone, par la barre du bas et ses chemins. */
export async function entreesDuMenu(page: Page): Promise<string[]> {
  return nomsDesPagesDuMenu(page);
}
