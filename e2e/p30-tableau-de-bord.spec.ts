import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { attendreLeChoixDesFonctionnalites, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import { choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant, soumettreIrrigation } from './support/materiel.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  nomsDesPagesDuMenu,
  ouvrirLeMenuDesPages,
  surveillerLaConsole,
  TITRES_DES_PAGES,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P30 : « Aujourd'hui », tableau de bord du module
 * (docs/aujourdhui-tableau-de-bord-contract.md, sections 3.1 et 3.2 ;
 * docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve qui a tout coché, propre au parcours et à la largeur :
 * à l'ordinateur, « Aujourd'hui » est détaché en tête du menu, dans son
 * encart « Tableau de bord », et les autres pages se rangent sous « Arroser »,
 * « Équiper » et « Surveiller », Réglages à part, dans l'ordre de toujours ;
 * au téléphone, son entrée de la barre du bas est le bouton rond, et la
 * feuille « Plus » garde l'encart et les groupes. La page dit la date, les
 * chiffres de la semaine et ses pastilles ; une pastille mène à son bloc.
 * Rien ne déborde à 390 px.
 *
 * « Tout est fait » (section 3.4), sur une autre ferme neuve : une irrigation
 * planifiée il y a six heures, finie, fait paraître le bouton ; la
 * confirmation la liste cochée, se décoche, « Annuler » n'écrit rien,
 * « Enregistrer 1 irrigation » l'enregistre et le bouton disparaît. À
 * l'ordinateur, la légende de la frise nomme les couleurs de ses barres (T19).
 *
 * Ce qu'il ne prouve pas : les valeurs dessinées (les tests du domaine,
 * `tests/aujourdhui-tableau-de-bord.test.ts`, les chiffrent), la ferme
 * réelle, un vrai téléphone.
 */

const GROUPES = ['Arroser', 'Équiper', 'Surveiller'];

/**
 * T19 : la légende de la frise nomme chaque couleur de barre présente, et
 * seulement celles-là, dans la couleur même de la barre. La frise n'existe
 * que si une irrigation est du jour : à une heure de parcours où celle d'il y
 * a six heures tombe la veille, il n'y a rien à vérifier.
 */
async function verifierLaLegendeDeLaFrise(page: Page): Promise<void> {
  const frise = page.locator('.today-timeline-wrap');
  if ((await frise.count()) === 0) return;
  const tons = (selecteur: string) => frise.locator(selecteur).evaluateAll((elements) =>
    elements.map((element): [string, string] => [element.getAttribute('data-tone') ?? '', getComputedStyle(element).backgroundColor]));
  const barres = new Map(await tons('.today-timeline-bar'));
  const legende = new Map(await tons('.today-legend i'));
  legende.delete('past');
  expect([...legende.keys()].sort()).toEqual([...barres.keys()].sort());
  for (const [ton, fond] of barres) {
    if (ton !== 'proposed') expect(legende.get(ton), `la pastille « ${ton} » de la légende`).toBe(fond);
  }
}

/** La ferme neuve du parcours, toutes les cases cochées, arrivée sur « Aujourd'hui ». */
async function ouvrirLaFermeToutCoche(page: Page, context: BrowserContext, testInfo: TestInfo, nom: string): Promise<void> {
  await ouvrirUneFermeNeuve(context, testInfo, nom);
  await page.goto('/irrigation/bienvenue');
  await attendreLeChoixDesFonctionnalites(page);
  for (const caseACocher of await page.getByRole('checkbox').all()) {
    if (!(await caseACocher.isChecked())) await caseACocher.check();
  }
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'aujourdhui');
}

test('« Aujourd’hui » détaché dans le menu, les pages en trois groupes, les pastilles qui mènent aux blocs', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await ouvrirLaFermeToutCoche(page, context, testInfo, 'tableau-de-bord');
  await verifierLEtape(page, journal, 'arrivée sur le tableau de bord');

  // Les pages du menu, dans l'ordre de toujours : les groupes n'en changent pas l'ordre (T1).
  expect(await nomsDesPagesDuMenu(page)).toEqual(Object.values(TITRES_DES_PAGES));

  const menu = await ouvrirLeMenuDesPages(page);
  if (telephone) {
    // Au téléphone : le bouton rond de la barre, la page ouverte, puis la feuille « Plus ».
    const barre = page.getByRole('navigation', { name: 'Pages principales' });
    const rond = barre.getByRole('link').first();
    await expect(rond).toHaveAccessibleName(new RegExp(`^${TITRES_DES_PAGES.aujourdhui}`));
    await expect(rond.locator('.menu-home-badge')).toBeVisible();
    await verifierCibleTactile(rond, 'Le bouton rond « Aujourd’hui »');
    // Il dépasse de la barre : son rond monte au-dessus d'elle.
    const hautDuRond = await rond.locator('.menu-home-badge').evaluate((element) => element.getBoundingClientRect().top);
    const hautDeLaBarre = await barre.evaluate((element) => element.getBoundingClientRect().top);
    expect(hautDuRond).toBeLessThan(hautDeLaBarre);
  }
  // L'encart détaché, en tête : son nom, « Tableau de bord » ; puis les trois groupes titrés, Réglages à part.
  const encart = menu.locator('a.menu-home');
  await expect(encart).toHaveCount(1);
  await expect(encart).toContainText('Tableau de bord');
  await expect(encart).toHaveAttribute('aria-current', 'page');
  await expect(menu.locator('.menu-group-title')).toHaveText(GROUPES);
  await expect(menu.locator('.menu-settings-item').getByRole('link')).toHaveAccessibleName(TITRES_DES_PAGES.reglages);
  if (!telephone) {
    // L'encart est au-dessus du premier groupe, et ne prend pas le vert plein d'une page ouverte.
    const basDeLEncart = await encart.evaluate((element) => element.getBoundingClientRect().bottom);
    const hautDuGroupe = await menu.locator('.menu-group-title').first().evaluate((element) => element.getBoundingClientRect().top);
    expect(basDeLEncart).toBeLessThan(hautDuGroupe);
    expect(await encart.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
  } else {
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }
  await verifierLEtape(page, journal, 'menu détaché et groupes');

  // L'en-tête : la date, les chiffres de la semaine, les pastilles.
  await expect(page.locator('.today-head h2')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Cette semaine' }).locator('.today-kpi')).toHaveCount(4);
  const pastilles = page.getByRole('navigation', { name: 'Résumé du jour' }).getByRole('link');
  await expect(pastilles.first()).toBeVisible();
  const donnees = pastilles.filter({ hasText: /données? à rafraîchir$/ });
  await expect(donnees).toHaveCount(1);
  if (telephone) await verifierCibleTactile(donnees, 'La pastille des données à rafraîchir');
  await donnees.click();
  await expect(page).toHaveURL(/#today-reliability$/);
  await expect(page.locator('#today-reliability')).toBeInViewport();
  await verifierLEtape(page, journal, 'une pastille mène à son bloc');
});

test('« Tout est fait » : la confirmation liste l’irrigation passée, « Annuler » n’écrit rien, « Enregistrer » l’enregistre', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  await ouvrirLaFermeToutCoche(page, context, testInfo, 'tout-est-fait');
  const toutEstFait = page.getByRole('button', { name: /^Tout est fait/ });
  // Rien à couvrir sur une ferme neuve : pas de bouton.
  await expect(toutEstFait).toHaveCount(0);

  // Une irrigation planifiée il y a six heures : 25 mm à 10 mm/h, finie depuis plus de trois heures.
  await attendreLaPageIrrigation(page, 'materiel');
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo);
  await attendreLaPageIrrigation(page, 'arrosages');
  await page.getByRole('tab', { name: /^Planifier/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage);
  await page.getByLabel('Date et heure de début').fill(horodatageLocal(-6 * 60, reference));
  await soumettreIrrigation(page, 'Planifier l’irrigation', 'arrosée sans le chrono');

  await attendreLaPageIrrigation(page, 'aujourdhui');
  await expect(toutEstFait).toHaveAccessibleName('Tout est fait (1)');
  if (telephone) await verifierCibleTactile(toutEstFait, 'Le bouton « Tout est fait »');
  await verifierLEtape(page, journal, 'bouton « Tout est fait »');
  if (!telephone) await verifierLaLegendeDeLaFrise(page);

  // Rien n'est écrit au premier clic : la confirmation liste, cochée ; décocher retire du compte.
  await toutEstFait.click();
  const confirmation = page.getByRole('dialog', { name: 'Enregistrer comme faites' });
  await expect(confirmation).toBeVisible();
  const ligne = confirmation.getByRole('checkbox', { name: new RegExp(materiel) });
  await expect(ligne).toBeChecked();
  if (telephone) await verifierCibleTactile(ligne.locator('xpath=..'), 'La ligne à décocher');
  await expect(confirmation).toContainText('telle que prévue');
  await expect(confirmation).toContainText('ne se modifie plus');
  await ligne.uncheck();
  await expect(confirmation.getByRole('button', { name: 'Enregistrer 0 irrigation' })).toBeDisabled();
  await verifierLEtape(page, journal, 'confirmation, la ligne décochée');

  // « Annuler » ferme sans rien écrire : le bouton est toujours là, la ligne cochée à nouveau.
  await confirmation.getByRole('button', { name: 'Annuler' }).click();
  await expect(confirmation).toBeHidden();
  await expect(toutEstFait).toHaveAccessibleName('Tout est fait (1)');
  await toutEstFait.click();
  await expect(ligne).toBeChecked();

  await confirmation.getByRole('button', { name: 'Enregistrer 1 irrigation' }).click();
  await expect(page.locator('.today-notice')).toHaveText('1 irrigation enregistrée comme faite.');
  await expect(confirmation).toBeHidden();
  await expect(toutEstFait).toHaveCount(0);
  await expect(page.locator('#today-day [data-group="late"]')).toHaveCount(0);
  await verifierLEtape(page, journal, 'irrigation enregistrée comme faite');
});
