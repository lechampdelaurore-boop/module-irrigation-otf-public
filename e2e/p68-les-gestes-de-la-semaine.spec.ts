import { expect, test, type Locator, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { horodatageLocal } from './support/materiel.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  surveillerLaConsole,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P68 : les gestes de la semaine (simplification, lot S4, PR 3,
 * docs/simplification-s4-contract.md, sections 4.5, 4.6, 8 et 11 ; D-335 ;
 * docs/browser-journeys-contract.md), aux deux largeurs.
 *
 * Sur une ferme neuve, propre au parcours et à la largeur, toutes les cases
 * cochées, sans eau visée ni pluie notée :
 * - « Comprendre ces chiffres » déplie sous le bilan les tuiles de la
 *   semaine d'« Aujourd'hui », et les replie ;
 * - « Poser un objectif » ouvre le pli des objectifs sans changer de page, le
 *   champ des millimètres au clavier ; 20 mm posés, « Changer l'eau visée »
 *   rouvre ce pli, « Le détail » refermé, le même champ au clavier ;
 * - « Noter la pluie » de « Calcul approximatif » ouvre la fenêtre de S2 ;
 *   celle du bilan note 8 mm pour aujourd'hui : la réponse s'écrit sous le
 *   bilan quand le serveur l'a dite, et le bilan bouge (la pluie mesurée) ;
 * - la flèche « Semaine précédente » change de semaine sans recharger la
 *   page, l'adresse la dit ; la ligne d'un jour sans pluie réelle ouvre la
 *   fenêtre sur ce jour ; le retour du navigateur ramène « Cette semaine » ;
 * - « Exporter » donne l'adresse du CSV de l'historique pour la semaine
 *   affichée, celle du bouton de « Les cumuls », et le fichier se télécharge ;
 * - `?pluie=1`, l'adresse que suit « Noter la pluie » d'une autre page (PR 4),
 *   ouvre la fenêtre à l'arrivée, une fois : l'adresse ne la garde pas.
 *
 * La ligne d'un jour : un jour passé dont la pluie réelle manque, dans les
 * sept jours de la fenêtre. Quand la météo estimée après coup les couvre
 * tous (le lundi, sur une ferme où la réanalyse est déjà lue), ce geste
 * n'est pas joué et le parcours le dit en annotation, comme P12 pour l'heure.
 *
 * La ferme neuve est propre au parcours : rien à remettre en état.
 */

const OBJECTIF_MM = '20';
const PLUIE_MM = '8';

/** Le chiffre « reçus » du bilan et son détail, tels qu'écrits. */
async function recus(page: Page): Promise<string> {
  const bloc = page.locator('.week-bilan-figures > div').first();
  return (await bloc.innerText()).replace(/\s+/g, ' ').trim();
}

/** Les millimètres de l'objectif ont le clavier (F933), le pli des objectifs et ceux qui le portent ouverts. */
async function attendreLesObjectifsAuClavier(page: Page): Promise<Locator> {
  const objectifs = page.locator('details#objectifs-de-la-semaine');
  await expect(objectifs).toHaveAttribute('open', '');
  await expect(page.locator('details#le-detail')).toHaveAttribute('open', '');
  await expect(objectifs.getByLabel('mm / semaine')).toBeFocused();
  return objectifs;
}

test('les gestes de la semaine : comprendre, l’eau visée, la pluie, les flèches, exporter', async ({ page, context }, testInfo) => {
  test.setTimeout(180_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  const aujourdhui = horodatageLocal(0, Date.now()).slice(0, 10);
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'p68-gestes');
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'semaine');
  // La page ne se recharge plus pendant le parcours : la marque posée ici le prouve.
  await page.evaluate(() => { (window as unknown as { p68: string }).p68 = 'même page'; });
  const memePage = () => page.evaluate(() => (window as unknown as { p68?: string }).p68 ?? 'rechargée');
  const premier = page.locator('.week-first-level');
  const bilan = premier.locator('.week-bilan');

  // « Comprendre ces chiffres » : les tuiles de la semaine, dépliées puis repliées.
  const comprendre = bilan.getByRole('button', { name: 'Comprendre ces chiffres' });
  if (telephone) await verifierCibleTactile(comprendre, '« Comprendre ces chiffres »');
  await expect(comprendre).toHaveAttribute('aria-expanded', 'false');
  const tuiles = bilan.locator('.week-understand');
  await expect(tuiles).toBeHidden();
  await comprendre.click();
  await expect(comprendre).toHaveAttribute('aria-expanded', 'true');
  await expect(tuiles.locator('.water-summary-card > span')).toHaveText(['Eau visée cette semaine', 'Irrigation réalisée', 'Pluie réelle / estimée', 'Pluie encore prévue', 'Soif de la semaine']);
  await comprendre.click();
  await expect(tuiles).toBeHidden();
  await verifierLEtape(page, journal, '« Comprendre ces chiffres »');

  // « Poser un objectif », puis « Changer l'eau visée » : le pli des objectifs, sans changer de page.
  await expect(bilan.getByRole('link', { name: 'Changer l’eau visée' })).toHaveCount(0);
  await bilan.getByRole('link', { name: 'Poser un objectif' }).click();
  const objectifs = await attendreLesObjectifsAuClavier(page);
  await objectifs.getByLabel('mm / semaine').fill(OBJECTIF_MM);
  await objectifs.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(objectifs.locator('.goal-chip-list')).toContainText(`${OBJECTIF_MM} mm`, { timeout: 15_000 });
  // Posé aujourd'hui, il vaut à partir d'aujourd'hui : le bilan dit des millimètres visés, au prorata des jours qui restent.
  await expect(bilan.locator('.week-bilan-figures dt')).toContainText(['visés'], { timeout: 15_000 });
  await page.locator('details#le-detail > summary').click();
  await expect(page.locator('details#le-detail')).not.toHaveAttribute('open', '');
  const changer = bilan.getByRole('link', { name: 'Changer l’eau visée' });
  if (telephone) await verifierCibleTactile(changer, '« Changer l’eau visée »');
  await changer.click();
  await attendreLesObjectifsAuClavier(page);
  expect(await memePage(), 'l’eau visée se change sans quitter la page').toBe('même page');
  await page.locator('details#le-detail > summary').click();
  await verifierLEtape(page, journal, '« Changer l’eau visée »');

  // « Noter la pluie » de « Calcul approximatif » : la même fenêtre, fermée sans rien écrire.
  const fenetre = page.getByRole('dialog', { name: 'Noter la pluie' });
  const jour = fenetre.getByLabel('Quel jour ?');
  const approximatif = premier.locator('.week-attention-line').filter({ hasText: 'Calcul approximatif' });
  await expect(approximatif).toBeVisible({ timeout: 15_000 });
  await approximatif.getByRole('button', { name: 'Noter la pluie' }).click();
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByRole('link', { name: 'dans « Pluie mesurée », plus bas' })).toHaveAttribute('href', '#manual-rain');
  await fenetre.getByRole('button', { name: 'Fermer' }).click();
  await expect(fenetre).toBeHidden();
  await verifierLEtape(page, journal, '« Noter la pluie » de « Calcul approximatif »');

  // « Noter la pluie » du bilan : 8 mm pour aujourd'hui ; la réponse sous le bilan, le bilan bouge.
  const avant = await recus(page);
  expect(avant, 'aucune pluie mesurée sur la ferme neuve').not.toMatch(/de pluie mesurée|mesurés/);
  const noter = bilan.locator('.week-bilan-actions').getByRole('button', { name: 'Noter la pluie' });
  if (telephone) await verifierCibleTactile(noter, '« Noter la pluie » du bilan');
  await noter.click();
  await expect(fenetre).toBeVisible();
  await jour.selectOption(aujourdhui);
  await fenetre.getByLabel('Combien ?').fill(PLUIE_MM);
  await fenetre.getByRole('button', { name: `Enregistrer ${PLUIE_MM} mm` }).click();
  await expect(fenetre).toBeHidden();
  await expect(bilan.locator('.week-rain-reply')).toHaveText(new RegExp(`^Pluie enregistrée : ${PLUIE_MM} mm le \\S+ \\d{1,2} \\S+\\. Le plan se recalcule\\.$`));
  await expect.poll(() => recus(page), { timeout: 15_000, message: 'le bilan dit la pluie mesurée' }).toMatch(/de pluie mesurée|mesurés/);
  expect(await memePage(), 'la pluie se note sans quitter la page').toBe('même page');
  await verifierLEtape(page, journal, '8 mm notés, le bilan bouge');

  // La semaine précédente, par la flèche, sans recharger la page ; l'adresse la dit.
  const navigation = premier.getByRole('navigation', { name: 'Changer de semaine' });
  await navigation.getByRole('link', { name: 'Semaine précédente' }).click();
  await expect(navigation.locator('.week-title')).toHaveText(/^Semaine du /, { timeout: 15_000 });
  await expect(page).toHaveURL(/[?&]week=\d{4}-\d{2}-\d{2}/);
  expect(await memePage(), 'la flèche ne recharge pas la page').toBe('même page');
  await expect(navigation.getByRole('link', { name: 'Cette semaine' })).toBeVisible();
  await expect(bilan.locator('.week-rain-reply'), 'une autre semaine, une fenêtre neuve').toHaveCount(0);
  await verifierLEtape(page, journal, 'la semaine précédente par la flèche');

  // La ligne d'un jour sans pluie réelle : la fenêtre s'ouvre sur ce jour.
  const surUneLigne = premier.locator('.week-day-rain button:visible');
  if (await surUneLigne.count() > 0) {
    const bouton = surUneLigne.last();
    if (telephone) await verifierCibleTactile(bouton, '« Noter la pluie » d’un jour');
    const date = await bouton.getAttribute('data-date');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await bouton.click();
    await expect(fenetre).toBeVisible();
    await expect(jour).toHaveValue(date!);
    await page.keyboard.press('Escape');
    await expect(fenetre).toBeHidden();
    await verifierLEtape(page, journal, '« Noter la pluie » d’un jour');
  } else {
    testInfo.annotations.push({ type: 'non joué', description: 'aucun jour de la semaine précédente sans pluie réelle dans la fenêtre : la ligne d’un jour n’offre pas « Noter la pluie »' });
  }

  // Le retour du navigateur ramène « Cette semaine », toujours sans recharger la page.
  await page.goBack();
  await expect(navigation.locator('.week-title')).toHaveText('Cette semaine', { timeout: 15_000 });
  expect(await memePage(), 'le retour ne recharge pas la page').toBe('même page');
  await verifierLEtape(page, journal, 'le retour du navigateur');

  // « Exporter » : la semaine affichée, au format de l'historique ; la même adresse que « Les cumuls ».
  const exporter = page.locator('a.week-export-link');
  if (telephone) await verifierCibleTactile(exporter, '« Exporter »');
  await expect(exporter).toHaveText(/^Exporter CSV · réalisées, du \d{2}\/\d{2}\/\d{4} au \d{2}\/\d{2}\/\d{4}$/);
  const adresse = await exporter.getAttribute('href');
  expect(adresse).toMatch(/^\/irrigation\/historique\.csv\?season=\d{4}&mode=week&level=farm&anchor=(\d{4}-\d{2}-\d{2})&start=\1&end=\d{4}-\d{2}-\d{2}&status=done$/);
  const fichier = await page.request.get(adresse!);
  expect(fichier.status()).toBe(200);
  expect(fichier.headers()['content-type']).toContain('text/csv');
  expect(fichier.headers()['content-disposition']).toMatch(/^attachment; filename=".+\.csv"$/);
  await page.getByRole('navigation', { name: 'Vues de la semaine' }).getByRole('link', { name: 'Les cumuls' }).click();
  await expect(page).toHaveURL(/[?&]vue=cumuls/);
  await expect(page.locator('a.history-export-button')).toHaveAttribute('href', adresse!, { timeout: 15_000 });
  await verifierLEtape(page, journal, '« Exporter » et « Les cumuls »');

  // « Noter la pluie » d'une autre page (la fiabilité, lot S4, PR 4) : `?pluie=1` ouvre la fenêtre à l'arrivée,
  // une fois ; l'adresse ne la garde pas, un rechargement ne la rejoue pas.
  await page.goto(`/irrigation/semaine?season=${aujourdhui.slice(0, 4)}&pluie=1`);
  await attendreLaPagePrete(page, 'semaine');
  await expect(fenetre).toBeVisible();
  await expect(page).not.toHaveURL(/pluie=/);
  await fenetre.getByRole('button', { name: 'Fermer' }).click();
  await expect(fenetre).toBeHidden();
  await page.reload();
  await attendreLaPagePrete(page, 'semaine');
  await expect(page.locator('.week-bilan')).toBeVisible();
  await expect(fenetre).toHaveCount(0);
  await verifierLEtape(page, journal, '« Noter la pluie » demandé par l’adresse');
});
