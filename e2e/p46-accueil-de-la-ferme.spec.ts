import { expect, test, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, ouvrirLePli, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P46 : l'accueil de la ferme, dans Réglages (4.4,
 * docs/tranche-4-contract.md, F417, F426, F427 ; PR 1, F581).
 *
 * La ferme habituelle des parcours utilisait le module avant l'accueil des
 * nouvelles fermes : ses cinq étapes sont confirmées, « réglage d'avant
 * l'accueil, gardé tel quel », comme la migration 0034 l'a fait pour les
 * espaces réels. Une ferme neuve a ses cinq étapes à faire, dites en rouge
 * et en mots.
 */

const ETAPES = ['Où est la ferme', 'Parcelles et abris', 'Sol', 'Cultures', 'Réglages à relire'];

async function ouvrirLAccueil(page: Page) {
  const pli = page.locator('section.onboarding-settings details');
  await expect(pli).not.toHaveAttribute('open', '');
  return ouvrirLePli(pli);
}

test('une ferme d’avant la 4.4 lit que ses réglages sont gardés tels quels', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'reglages');
  const pli = await ouvrirLAccueil(page);
  await expect(pli.locator('summary')).toContainText('Accueil de la ferme');
  await expect(pli.locator('summary')).toContainText('Fait avant l’accueil des nouvelles fermes.');
  await expect(pli).toContainText('Votre ferme utilisait le module avant l’accueil des nouvelles fermes : ses réglages sont gardés tels quels.');
  const etapes = pli.locator('li.onboarding-step');
  await expect(etapes).toHaveCount(5);
  for (const [index, nom] of ETAPES.entries()) {
    await expect(etapes.nth(index)).toContainText(nom);
    await expect(etapes.nth(index)).toContainText('Confirmé');
    await expect(etapes.nth(index)).toContainText('Réglage d’avant l’accueil, gardé tel quel.');
  }
  // Rien à finir : aucun bandeau, sur Réglages comme ailleurs (F582).
  await expect(page.locator('.onboarding-unfinished')).toHaveCount(0);
  await verifierLEtape(page, journal, 'accueil d’avant la 4.4');
});

test('une ferme neuve a ses cinq étapes à faire, et choisir sa commune confirme la première', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'accueil');
  await attendreLaPageIrrigation(page, 'reglages');
  const pli = await ouvrirLAccueil(page);
  await expect(pli.locator('summary')).toContainText('5 étapes sur 5 à finir.');
  await expect(pli).toContainText('rien n’est confirmé à votre place.');
  const etapes = pli.locator('li.onboarding-step-missing');
  await expect(etapes).toHaveCount(5);
  for (const [index, nom] of ETAPES.entries()) {
    await expect(etapes.nth(index)).toContainText(nom);
    await expect(etapes.nth(index)).toContainText('À faire.');
  }
  // L'étape de la commune mène au lieu de la météo ; le siège n'y est pas pris en silence (F419, F582).
  await expect(page.locator('.onboarding-unfinished')).toHaveText('À finir : commune de la ferme.');
  await expect(page.locator('#water-weather-title').locator('xpath=ancestor::section[1]')).toContainText('Choisissez la commune de votre ferme : tant qu’elle n’est pas choisie, ni météo, ni gel, ni ET0.');
  await etapes.first().getByRole('link', { name: 'Choisir la commune' }).click();
  await expect(page).toHaveURL(/#water-weather-title$/);
  await verifierLEtape(page, journal, 'accueil d’une ferme neuve');

  await page.getByRole('button', { name: 'Prendre le siège OTF, en dernier recours' }).click();
  await expect(page.getByText('La commune du siège OTF est utilisée, en dernier recours.')).toBeVisible();
  await page.reload();
  await attendreLaPagePrete(page, 'reglages');
  await expect(page.locator('.onboarding-unfinished')).toHaveCount(0);
  const apres = await ouvrirLAccueil(page);
  await expect(apres.locator('summary')).toContainText('4 étapes sur 5 à finir.');
  await expect(apres.locator('li.onboarding-step').first()).toContainText(/Confirmé le .+ : .+, siège de la structure dans Ouvre ta ferme, pris en dernier recours\./);
  await verifierLEtape(page, journal, 'commune prise en dernier recours');
});
