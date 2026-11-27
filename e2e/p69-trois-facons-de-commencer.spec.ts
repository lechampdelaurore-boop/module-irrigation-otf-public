import { expect, test, type Page } from '@playwright/test';
import { attendreLaPremiereOuverture, caseDeLaFonctionnalite, entreesDuMenu, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P69 : les trois façons de commencer (simplification, lot S6, PR 1,
 * docs/simplification-s6-contract.md, sections 3, 4, 9, 12 et 14 ; D-336 ;
 * docs/browser-journeys-contract.md), aux deux largeurs.
 *
 * Trois fermes neuves, une par façon, chacune propre au parcours et à la
 * largeur : la façon choisie coche ses cases, calculées par le serveur ; la
 * première arrivée est « Ma ferme », la mise en route ayant des étapes ; les
 * ouvertures suivantes arrivent sur « Aujourd'hui » (F31) ; Réglages dit
 * comment la ferme a commencé, au-dessus des onze cases. « Choisir moi-même »
 * avec les seules alertes météo n'a aucune étape : la ferme arrive là où elle
 * arrivait. Une ferme d'avant S6 n'a pas la ligne de Réglages. Au téléphone,
 * l'écran tient à 320 px sans débord, ses cibles mesurées ; sa hauteur et son
 * nombre de mots sont relevés en annotation (section 14).
 */

type Facon = {
  nom: string;
  suite: string;
  cochees: number;
  menu: string[] | number;
};

const FACONS: readonly Facon[] = [
  {
    nom: 'Je note mes arrosages',
    suite: 'Ensuite, deux étapes pour décrire votre ferme : le matériel et où il est posé. En plusieurs fois si vous voulez.',
    // Arrosages et Historique, avec le Matériel dont ils ont besoin (R3).
    cochees: 3,
    menu: ['Aujourd’hui', 'Arrosages', 'Semaine', 'Ma ferme', 'Matériel et placement', 'Réglages'],
  },
  {
    nom: 'Le module me propose quoi arroser',
    suite: 'Ensuite, quatre étapes pour décrire votre ferme : le matériel, où il est posé, d’où vient l’eau et combien vous visez. En plusieurs fois si vous voulez.',
    // Planning, Ressources et Historique, avec Arrosages, Objectifs et Matériel.
    cochees: 6,
    menu: ['Aujourd’hui', 'Arrosages', 'Semaine', 'Ma ferme', 'Matériel et placement', 'Ressources et pompes', 'Réglages'],
  },
  {
    nom: 'Tout : sol, cultures et alertes',
    suite: 'Ensuite, cinq étapes pour décrire votre ferme : le matériel, où il est posé, d’où vient l’eau, combien vous visez et votre sol. En plusieurs fois si vous voulez.',
    cochees: 11,
    // Les sept pages des cases hors la semaine, « Aujourd'hui », « Semaine », « Ma ferme » et « Réglages » (P22).
    menu: 11,
  },
];

/** Les cases cochées de Réglages, section « Fonctionnalités ». */
const casesCochees = (page: Page) => page.getByRole('group', { name: 'Fonctionnalités' }).getByRole('checkbox', { checked: true });

test('les trois façons une à une : chacune coche ses cases, arrive une fois sur « Ma ferme », et Réglages dit comment la ferme a commencé', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  for (const [rang, facon] of FACONS.entries()) {
    await ouvrirUneFermeNeuve(context, testInfo, `p69-facon-${rang + 1}`);
    await page.goto('/irrigation/bienvenue');
    await attendreLaPremiereOuverture(page);
    await page.getByRole('radio', { name: facon.nom }).check();
    await expect(page.locator('.start-what-follows')).toHaveText(facon.suite);
    await page.getByRole('button', { name: 'Continuer' }).click();

    // La première arrivée : « Ma ferme » (section 3.4), sans bandeau du choix.
    await attendreLaPagePrete(page, 'ma-ferme');
    await expect(page).toHaveURL(/\/irrigation\/ma-ferme(\?|$)/);
    await expect(page.getByRole('complementary', { name: 'Choix des fonctionnalités' })).toHaveCount(0);
    const menu = await entreesDuMenu(page);
    if (typeof facon.menu === 'number') expect(menu).toHaveLength(facon.menu);
    else expect(menu).toEqual(facon.menu);
    await verifierLEtape(page, journal, `première arrivée, « ${facon.nom} »`);

    // Les ouvertures suivantes : la page d'arrivée de F31 ; l'écran de bienvenue n'y revient pas.
    await page.goto('/irrigation');
    await attendreLaPagePrete(page, 'aujourdhui');
    await page.goto('/irrigation/bienvenue');
    await attendreLaPagePrete(page, 'aujourdhui');

    // Réglages : la ligne au-dessus des cases (section 9), et les cases de la façon.
    await attendreLaPageIrrigation(page, 'reglages');
    await expect(page.locator('.feature-started-with')).toHaveText(`Vous avez commencé par : « ${facon.nom} ».`);
    await expect(casesCochees(page)).toHaveCount(facon.cochees);
    await verifierLEtape(page, journal, `Réglages, « ${facon.nom} »`);
  }
});

test('« Choisir moi-même » les seules alertes météo : aucune étape, la page d’arrivée habituelle ; une ferme d’avant S6 n’a pas de ligne', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'p69-moi-meme');
  await page.goto('/irrigation/bienvenue');
  await attendreLaPremiereOuverture(page);
  await page.getByRole('button', { name: 'Choisir moi-même les fonctionnalités' }).click();
  await caseDeLaFonctionnalite(page, 'Alertes météo').check();
  await expect(page.getByText('1 fonctionnalité cochée.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();
  // Des alertes seules : la mise en route n'a pas d'étape, l'arrivée est celle de F31 (section 12).
  await attendreLaPagePrete(page, 'aujourdhui');
  await attendreLaPageIrrigation(page, 'reglages');
  await expect(page.locator('.feature-started-with')).toHaveText('Vous avez choisi vous-même vos fonctionnalités.');
  await expect(casesCochees(page)).toHaveCount(1);
  await verifierLEtape(page, journal, '« Choisir moi-même », alertes seules');

  // La ferme de démonstration habituelle, d'avant la 3.8 : pas de ligne, les cases telles quelles (section 9).
  await context.clearCookies({ name: 'demo-farm' });
  await attendreLaPageIrrigation(page, 'reglages');
  await expect(page.getByRole('heading', { name: 'Fonctionnalités de la ferme' })).toBeVisible();
  await expect(page.locator('.feature-started-with')).toHaveCount(0);
  await verifierLEtape(page, journal, 'ferme d’avant S6, sans ligne');
});

test('au téléphone, l’écran tient à 320 px, ses cibles mesurées ; sa hauteur et ses mots relevés', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'telephone', 'mesures du téléphone seulement');
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'p69-mesures');
  await page.goto('/irrigation/bienvenue');
  await attendreLaPremiereOuverture(page);

  // Les relevés de la section 14, à 390 px : la hauteur de la page et les mots de l'écran, avant tout choix.
  const releve = async () => page.evaluate(() => ({
    hauteur: document.documentElement.scrollHeight,
    mots: (document.querySelector('#contenu') as HTMLElement).innerText.split(/\s+/).filter((mot) => /[\p{L}\p{N}]/u.test(mot)).length,
  }));
  const facons = await releve();
  testInfo.annotations.push({ type: 'mesure', description: `trois façons à 390 px : ${facons.hauteur} px de haut, ${facons.mots} mots` });
  await page.getByRole('button', { name: 'Choisir moi-même les fonctionnalités' }).click();
  const liste = await releve();
  testInfo.annotations.push({ type: 'mesure', description: `« Choisir moi-même » à 390 px : ${liste.hauteur} px de haut, ${liste.mots} mots` });
  await page.getByRole('button', { name: '‹ Revenir aux trois façons' }).click();

  await page.setViewportSize({ width: 320, height: 640 });
  for (const ligne of await page.locator('label.start-way').all()) expect((await ligne.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(72);
  await page.getByRole('radio', { name: 'Le module me propose quoi arroser' }).check();
  const continuer = page.getByRole('button', { name: 'Continuer' });
  expect((await continuer.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(50);
  // Pleine largeur : celle des trois façons, au pixel près.
  const largeurDesFacons = (await page.locator('.start-ways').boundingBox())?.width ?? 0;
  expect(Math.abs(((await continuer.boundingBox())?.width ?? 0) - largeurDesFacons)).toBeLessThanOrEqual(1);
  await verifierCibleTactile(page.getByRole('button', { name: 'Choisir moi-même les fonctionnalités' }), 'Le lien « Choisir moi-même les fonctionnalités »');
  await verifierLEtape(page, journal, 'trois façons à 320 px');
  await page.getByRole('button', { name: 'Choisir moi-même les fonctionnalités' }).click();
  await verifierCibleTactile(page.getByRole('button', { name: '‹ Revenir aux trois façons' }), 'Le lien « ‹ Revenir aux trois façons »');
  await verifierLEtape(page, journal, '« Choisir moi-même » à 320 px');
});
