import { expect, test } from '@playwright/test';
import { ciblesTropPetites, textesPeuContrastes } from '../e2e/support/accessibilite.ts';
import { ouvrirLePli, verifierLEtape } from '../e2e/support/parcours.ts';
import { ecarterLInvitation, ouvrirLaDemo } from './support/visite.ts';

/**
 * Parcours V12 : « La météo s'est-elle vérifiée ? » sur la démonstration
 * (docs/forecast-reliability-contract.md, section 8, test 11 ; D-338, PR 2).
 * La « Ferme des Trois Noues », au début de l'été : sur « Semaine », dans
 * « Le détail » (lot S4), le pli est fermé ; ouvert, il porte l'étiquette « exemple », la
 * phrase de tête, deux tableaux (la pluie, la soif du jour), chacun avec ses
 * trois lignes d'horizon, le total et le cumul de la semaine (trois semaines
 * sur quatre au mardi 16 juin), la pluie notée au pluviomètre qui n'a pas
 * encore ses jours, et les deux réserves. Au téléphone, à 320 px, rien ne
 * déborde de côté. Le parcours regarde sans rien écrire.
 */

const LIGNES = ['Demain et après-demain', 'Dans 3 ou 4 jours', 'Dans 5 à 7 jours', 'Tous les horizons', 'Cumul de la semaine'];
const LARGEUR_TELEPHONE_ETROIT_PX = 320;
const HAUTEUR_TELEPHONE_PX = 740;

test('V12 La météo s’est-elle vérifiée ? : un pli fermé, puis l’exemple, deux tableaux et les réserves', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'telephone') await page.setViewportSize({ width: LARGEUR_TELEPHONE_ETROIT_PX, height: HAUTEUR_TELEPHONE_PX });
  const visite = await ouvrirLaDemo(page, 'maraichage', 'ete', '/irrigation/semaine');
  await ecarterLInvitation(page);
  const pli = page.locator('#meteo-verifiee');
  await expect(pli).not.toHaveAttribute('open', '');
  await expect(pli.locator('.forecast-reliability-body')).toHaveCount(0);
  await ouvrirLePli(pli);

  const corps = pli.locator('.forecast-reliability-body');
  await expect(corps).toHaveAttribute('data-status', 'ready');
  await expect(pli.locator('.forecast-reliability-example')).toHaveText('Exemple : chiffres semés pour la démonstration, pas une vraie météo.');
  await expect(pli.locator('.forecast-reliability-headline')).toHaveText('Sur les 90 derniers jours, voici de combien la météo annoncée s’est écartée de ce qui s’est passé.');
  await expect(corps).toContainText(/À un ou deux jours, la pluie annoncée s’écarte en moyenne de [\d,]+ mm par jour de celle estimée ; elle (était trop pluvieuse|n’était pas assez pluvieuse|tombait juste)/);

  const tableaux = pli.locator('table.forecast-reliability-table');
  await expect(tableaux).toHaveCount(2);
  await expect(tableaux.locator('caption strong')).toHaveText(['La pluie', 'La soif du jour (ET0)']);
  for (const tableau of await tableaux.all()) {
    await expect(tableau.locator('tbody th')).toHaveText(LIGNES);
    const chiffres = tableau.locator('tbody td > strong');
    for (let rang = 0; rang < 4; rang += 1) await expect(chiffres.nth(rang)).toHaveText(/^[\d,]+ mm par jour$/);
    await expect(chiffres.nth(4)).toHaveText('Pas encore assez de semaines : 3 sur 4');
  }
  await expect(pli.locator('.forecast-reliability-note').first()).toHaveText('Pluie notée au pluviomètre : pas encore assez de jours notés, 0 sur 14.');
  await expect(corps).toContainText('La pluie estimée n’est pas mesurée chez vous');
  await expect(corps).toContainText('La soif annoncée et la soif estimée ne se calculent pas de la même façon. Même la veille');

  expect(await ciblesTropPetites(page, 44, '#meteo-verifiee'), 'cibles du pli').toEqual([]);
  expect(await textesPeuContrastes(page, '#meteo-verifiee'), 'contrastes du pli').toEqual([]);
  await verifierLEtape(page, visite.journal, 'pli de la météo vérifiée, démonstration');
  expect(visite.envois, 'la page a écrit à la place du visiteur').toEqual([]);
});
