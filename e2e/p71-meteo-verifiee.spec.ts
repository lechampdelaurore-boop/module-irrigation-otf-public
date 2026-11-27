import { expect, test, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { attendreLaPagePrete, ouvrirLePli, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P71 : « La météo s'est-elle vérifiée ? » sur une ferme vierge
 * (docs/forecast-reliability-contract.md, section 8, test 11 ; D-338, PR 2 ;
 * docs/browser-journeys-contract.md).
 *
 * Une ferme neuve, toutes cases cochées : avec les blocs d'« Objectifs et
 * besoins » (« Le détail » de « Semaine », lot S4), le
 * pli est fermé et n'a rien lu ; ouvert sans commune, il dit qu'il n'y a rien
 * à comparer ; la commune choisie, il dit qu'il n'a pas encore assez de jours
 * (ou que rien n'est encore gardé) et ne montre aucun tableau ni aucun
 * chiffre d'écart. Au téléphone, rien ne déborde de côté.
 *
 * Le pli rempli, avec ses deux tableaux et l'étiquette « exemple », se joue
 * sur la démonstration (V12) ; les nombres se prouvent dans
 * tests/forecast-reliability.test.ts.
 */

const DUREE_DU_PARCOURS = 180_000;

async function ouvrirLaMeteoVerifiee(page: Page) {
  await page.goto('/irrigation/semaine');
  await attendreLaPagePrete(page, 'besoins');
  const pli = page.locator('#meteo-verifiee');
  await expect(pli).not.toHaveAttribute('open', '');
  await expect(pli.locator('summary h3')).toHaveText('La météo s’est-elle vérifiée ?');
  // Fermé, le pli n'a rien demandé : il attend son ouverture.
  await expect(pli.locator('.forecast-reliability-body')).toHaveCount(0);
  await ouvrirLePli(pli);
  await expect(pli.locator('.forecast-reliability-body')).toHaveCount(1);
  return pli;
}

test('« La météo s’est-elle vérifiée ? » sur une ferme vierge : sans commune, puis pas encore assez de jours', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'meteo-verifiee');

  const sansCommune = await ouvrirLaMeteoVerifiee(page);
  await expect(sansCommune.locator('.forecast-reliability-body')).toHaveAttribute('data-status', 'noLocation');
  await expect(sansCommune.locator('.forecast-reliability-headline')).toHaveText('La commune de la météo n’est pas encore choisie : sans elle, il n’y a rien à comparer.');
  await expect(sansCommune.locator('table')).toHaveCount(0);
  await verifierLEtape(page, journal, 'pli sans commune');

  await preparerLaFermeNeuve(page);
  const vierge = await ouvrirLaMeteoVerifiee(page);
  const corps = vierge.locator('.forecast-reliability-body');
  await expect(corps).toHaveAttribute('data-status', /^(noArchive|collecting)$/);
  await expect(vierge.locator('.forecast-reliability-headline')).toHaveText(/rien n’est encore gardé pour cette commune|^Pas encore assez de jours : \d+ sur 14 pour comparer\./);
  await expect(vierge.locator('table')).toHaveCount(0);
  await expect(vierge.locator('.forecast-reliability-example')).toHaveCount(0);
  await expect(corps).not.toContainText('mm par jour');
  await verifierLEtape(page, journal, 'pli de la ferme vierge');
});
