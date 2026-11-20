import { expect, test, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, ouvrirLePli, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

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
  await verifierLEtape(page, journal, 'accueil d’avant la 4.4');
});

test('une ferme neuve a ses cinq étapes à faire', async ({ page, context }, testInfo) => {
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
  await verifierLEtape(page, journal, 'accueil d’une ferme neuve');
});
