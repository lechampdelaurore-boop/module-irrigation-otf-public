import { expect, test } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P55 : le journal des modifications se lit dans « Réglages »
 * (amélioration n° 7, docs/ameliorations-6-2-3-7-contract.md, §5.5 et §5.6 ;
 * D-288 ; docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, toutes cases cochées : en bas de « Réglages », le pli
 * « Journal des modifications », fermé, dont la ligne dit combien et la
 * dernière ; un réglage change (le message du matin, coupé) ; la page
 * rouverte, le pli ouvert dit en tête que le journal commence à sa mise en
 * service, et sa première carte dit « Vous », « Message du matin »,
 * « Modification » et « Message du matin : oui → non ». Le filtre par famille
 * garde la carte dans « Réglages » et dit la famille vide de « Matériel et
 * ressources ». L'ancre `#journal-des-modifications` ouvre le pli. Au
 * téléphone (390 px), une carte par ligne, rien ne déborde de côté, les
 * boutons à toucher ; à l'ordinateur, à 1 440 px.
 *
 * Ce qu'il ne prouve pas : « Voir plus » au-delà de 50 lignes, que les tests
 * de la lecture prouvent (tests/db/change-journal-view.test.ts) ; le texte
 * de chaque champ, dans les tests du domaine (tests/change-journal-card.test.ts).
 */

const DUREE_DU_PARCOURS = 120_000;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;
const LARGEUR_TELEPHONE_PX = 390;

test('« Journal des modifications » : un réglage change, sa carte dit Vous, l’avant et l’après', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'journal-des-modifications');

  // Un réglage change : le message du matin, coupé, dans le pli « Messages de la ferme ».
  await attendreLaPageIrrigation(page, 'reglages');
  await page.locator('#messages-de-la-ferme summary').click();
  const caseDuMatin = page.locator('#message-du-matin').getByRole('checkbox', { name: 'Message du matin' });
  await expect(caseDuMatin).toBeChecked();
  await caseDuMatin.uncheck();
  await expect(page.locator('#message-du-matin').getByRole('status')).toHaveText('Le message du matin est coupé.');

  await attendreLaPageIrrigation(page, 'reglages');
  const pli = page.locator('#journal-des-modifications');
  await expect(pli).not.toHaveAttribute('open', '');
  await expect(pli.locator('summary')).toContainText('Journal des modifications');
  await expect(pli.locator('summary small')).toHaveText(/^\d+ modifications?, la dernière le \d{2}\/\d{2}\/\d{4} à \d{1,2} h( \d{2})?\.$/);
  if (telephone) await verifierCibleTactile(pli.locator('summary'), 'Le pli « Journal des modifications »');
  await verifierLEtape(page, journal, 'pli fermé, sa ligne');

  await pli.locator('summary').click();
  await expect(pli).toContainText('Il commence à sa mise en service, le');
  const premiere = pli.locator('.change-journal-card').first();
  await premiere.scrollIntoViewIfNeeded();
  await expect(premiere.locator('.change-journal-meta')).toContainText('· Vous');
  await expect(premiere.getByRole('heading', { level: 3 })).toContainText('Message du matin');
  await expect(premiere.getByRole('heading', { level: 3 })).toContainText('Modification');
  await expect(premiere.locator('dl')).toHaveText('Message du matin : oui → non');
  if (telephone) {
    // Une carte par ligne, jamais un tableau ; rien ne déborde de côté.
    await expect(pli.locator('table')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(LARGEUR_TELEPHONE_PX);
    await verifierCibleTactile(pli.getByRole('button', { name: 'Tout' }), 'Le filtre « Tout »');
  }
  await verifierLEtape(page, journal, 'pli ouvert, la carte du réglage');

  // Le filtre par famille.
  await pli.getByRole('button', { name: 'Matériel et ressources' }).click();
  await expect(pli.getByRole('button', { name: 'Matériel et ressources' })).toHaveAttribute('aria-pressed', 'true');
  await expect(pli.locator('.change-journal-empty')).toHaveText('Aucune modification enregistrée dans « Matériel et ressources ».');
  await pli.getByRole('button', { name: 'Réglages', exact: true }).click();
  await expect(pli.getByRole('button', { name: 'Réglages', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(pli.locator('.change-journal-card').first().getByRole('heading', { level: 3 })).toContainText('Message du matin');
  await expect(pli.locator('.change-journal-card[data-family="materiel"]')).toHaveCount(0);
  await verifierLEtape(page, journal, 'le filtre par famille');

  // Le réglage rallumé ; l'ancre du journal ouvre son pli, la ligne nouvelle en tête.
  await page.locator('#messages-de-la-ferme summary').click();
  await page.locator('#message-du-matin').getByRole('checkbox', { name: 'Message du matin' }).check();
  await expect(page.locator('#message-du-matin').getByRole('status')).toHaveText('Le message du matin est activé.');
  // Une ancre seule ne recharge pas la page : rechargée, elle relit le journal.
  await page.goto('/irrigation/reglages#journal-des-modifications');
  await page.reload();
  await attendreLaPagePrete(page, 'reglages');
  await expect(page.locator('#journal-des-modifications')).toHaveAttribute('open', '');
  await expect(page.locator('#journal-des-modifications .change-journal-card').first().locator('dl')).toHaveText('Message du matin : non → oui');
  await verifierLEtape(page, journal, 'l’ancre ouvre le pli, le réglage rallumé');
});
