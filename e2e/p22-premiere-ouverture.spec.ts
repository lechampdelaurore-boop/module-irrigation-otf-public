import { expect, test, type Page } from '@playwright/test';
import { attendreLaPremiereOuverture, caseDeLaFonctionnalite, entreesDuMenu, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P22 : la première ouverture et le choix des fonctionnalités
 * (docs/feature-selection-contract.md, R3, R5, R6, P6, P7, P10, P14 ; trois
 * façons de commencer, docs/simplification-s6-contract.md, section 3, D-336).
 *
 * Une ferme neuve voit les trois façons de commencer avant toute page, rien
 * choisi d'avance ; « Continuer » attend un choix ; la phrase qui suit dit le
 * nombre d'étapes du choix. « Choisir moi-même » montre la liste, cochée des
 * cases de la façon enfoncée ; cocher le planning coche ce dont il a besoin,
 * grisé avec la raison ; décocher ne décoche pas ce qu'on avait entraîné ;
 * « Continuer » attend une case. Le choix fait, la ferme arrive sur « Ma
 * ferme », une seule fois, puis sur « Aujourd'hui » ; son menu ne montre que
 * ses cases ; une page non cochée, et une ancienne adresse de notification
 * qui la désignait, conduisent à la page d'arrivée, qui le dit.
 */

/** La façon de commencer, par son nom : un bouton radio natif (S6, section 3.2). */
const facon = (page: Page, nom: string) => page.getByRole('radio', { name: nom });

test('une ferme neuve choisit comment commencer avant toute page, et ne voit ensuite que ses fonctionnalités', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'premiere-ouverture');

  // Une page demandée avant le choix conduit aux trois façons, rien choisi d'avance (S6-a).
  await page.goto('/irrigation/planning');
  await attendreLaPremiereOuverture(page);
  await expect(page.getByText('Bienvenue', { exact: true })).toBeVisible();
  const facons = page.getByRole('radiogroup', { name: 'Comment voulez-vous commencer ?' }).getByRole('radio');
  await expect(facons).toHaveCount(3);
  for (const choix of await facons.all()) await expect(choix).not.toBeChecked();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('.start-way-tag')).toHaveText(['Conseillé']);
  await expect(page.locator('label.start-way').filter({ hasText: 'Conseillé' })).toContainText('Le module me propose quoi arroser');
  const continuer = page.getByRole('button', { name: 'Continuer' });
  await expect(continuer).toBeDisabled();
  await expect(page.locator('.start-what-follows')).toHaveText('Ensuite, quelques étapes pour décrire votre ferme, en plusieurs fois si vous voulez.');
  // Une ligne de 72 px au moins par façon ; « Continuer » à 50 px (S6, section 3.1).
  for (const ligne of await page.locator('label.start-way').all()) expect((await ligne.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(72);
  expect((await continuer.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(50);
  // Le premier arrêt du clavier saute la barre et mène aux trois façons, comme sur les autres pages (audit final, lot E, A1, F257).
  await page.locator('body').press('Tab');
  const saut = page.getByRole('link', { name: 'Aller au contenu' });
  await expect(saut).toBeFocused();
  await expect(saut).toBeInViewport();
  await saut.press('Enter');
  await expect(page.locator('#contenu')).toBeFocused();
  await expect(page.locator('#contenu')).toContainText('Comment voulez-vous commencer ?');
  await verifierLEtape(page, journal, 'trois façons de la première ouverture');

  // Un appui choisit ; la ligne porte la coche ; la phrase dit les étapes du choix (S6-b) ; les flèches passent d'une façon à l'autre.
  await facon(page, 'Le module me propose quoi arroser').check();
  await expect(page.locator('label.start-way[data-checked="true"]')).toContainText('Le module me propose quoi arroser');
  await expect(page.locator('label.start-way[data-checked="true"] .start-way-check .icon')).toHaveCount(1);
  await expect(page.locator('.start-what-follows')).toHaveText(
    'Ensuite, quatre étapes pour décrire votre ferme : le matériel, où il est posé, d’où vient l’eau et combien vous visez. En plusieurs fois si vous voulez.');
  await expect(continuer).toBeEnabled();
  await facon(page, 'Le module me propose quoi arroser').press('ArrowDown');
  await expect(facon(page, 'Tout : sol, cultures et alertes')).toBeChecked();
  await expect(facon(page, 'Tout : sol, cultures et alertes')).toBeFocused();
  await expect(page.locator('.start-what-follows')).toContainText('Ensuite, cinq étapes pour décrire votre ferme');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(facon(page, 'Je note mes arrosages')).toBeChecked();
  await expect(page.locator('label.start-way[data-checked="true"]')).toHaveCount(1);
  await expect(page.locator('.start-what-follows')).toHaveText(
    'Ensuite, deux étapes pour décrire votre ferme : le matériel et où il est posé. En plusieurs fois si vous voulez.');
  await verifierLEtape(page, journal, 'une façon choisie, au clavier');

  // « Choisir moi-même » : la liste des onze cases, cochée des cases de la façon enfoncée ; la phrase n'est pas montrée.
  const moiMeme = page.getByRole('button', { name: 'Choisir moi-même les fonctionnalités' });
  await verifierCibleTactile(moiMeme, 'Le lien « Choisir moi-même les fonctionnalités »');
  await moiMeme.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Choisir moi-même les fonctionnalités' })).toBeVisible();
  const revenir = page.getByRole('button', { name: '‹ Revenir aux trois façons' });
  await expect(revenir).toBeFocused();
  await expect(page.getByRole('checkbox')).toHaveCount(11);
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(3);
  for (const nom of ['Arrosages', 'Historique et cumuls', 'Matériel et placement']) await expect(caseDeLaFonctionnalite(page, nom)).toBeChecked();
  await expect(page.getByText('3 fonctionnalités cochées.')).toBeVisible();
  await expect(page.locator('.start-what-follows')).toHaveCount(0);
  // « ‹ Revenir » referme la liste sans rien enregistrer ; la façon reste choisie, le clavier la retrouve.
  await revenir.click();
  await expect(facon(page, 'Je note mes arrosages')).toBeChecked();
  await expect(facon(page, 'Je note mes arrosages')).toBeFocused();
  await moiMeme.click();
  await expect(revenir).toBeFocused();
  // Tout se décoche, dans l'ordre des besoins (une case nécessaire reste grisée), jusqu'à la dernière : « Continuer » attend une case (P7).
  await expect(caseDeLaFonctionnalite(page, 'Arrosages')).toBeDisabled();
  await caseDeLaFonctionnalite(page, 'Historique et cumuls').uncheck();
  await caseDeLaFonctionnalite(page, 'Arrosages').uncheck();
  await caseDeLaFonctionnalite(page, 'Matériel et placement').uncheck();
  for (const caseACocher of await page.getByRole('checkbox').all()) await expect(caseACocher).not.toBeChecked();
  await expect(continuer).toBeDisabled();
  await expect(page.getByText('Cochez au moins une fonctionnalité pour continuer.')).toBeVisible();
  await expect(page.locator('li').filter({ has: caseDeLaFonctionnalite(page, 'Planning de la semaine') }))
    .toContainText('Cochera aussi Arrosages, Objectifs et besoins et Matériel et placement, dont elle a besoin.');
  await verifierLEtape(page, journal, 'liste de la première ouverture');

  // Cocher le planning coche ce dont il a besoin, grisé avec la raison (R3).
  await caseDeLaFonctionnalite(page, 'Planning de la semaine').check();
  for (const nom of ['Matériel et placement', 'Arrosages', 'Objectifs et besoins']) {
    await expect(caseDeLaFonctionnalite(page, nom)).toBeChecked();
    await expect(caseDeLaFonctionnalite(page, nom)).toBeDisabled();
  }
  await expect(page.locator('li').filter({ has: caseDeLaFonctionnalite(page, 'Objectifs et besoins') }))
    .toContainText('Nécessaire pour Planning de la semaine.');
  await expect(page.getByText('4 fonctionnalités cochées.')).toBeVisible();
  await verifierCibleTactile(continuer, 'Le bouton « Continuer »');
  await verifierLEtape(page, journal, 'planning coché avec ce dont il a besoin');

  // Décocher le planning ne décoche pas ce qu'il avait entraîné (P6).
  await caseDeLaFonctionnalite(page, 'Planning de la semaine').uncheck();
  await expect(caseDeLaFonctionnalite(page, 'Objectifs et besoins')).toBeChecked();
  await expect(caseDeLaFonctionnalite(page, 'Objectifs et besoins')).toBeEnabled();
  await expect(page.getByText('3 fonctionnalités cochées.')).toBeVisible();

  // Le choix final : le planning et les alertes météo, qui viennent seules.
  await caseDeLaFonctionnalite(page, 'Planning de la semaine').check();
  await caseDeLaFonctionnalite(page, 'Alertes météo').check();
  await expect(page.getByText('5 fonctionnalités cochées.')).toBeVisible();
  await continuer.click();

  // La première arrivée est « Ma ferme » : la mise en route a des étapes (S6, section 3.4), sans bandeau ; les pages
  // dans l'ordre des trois endroits (simplification, lot S3, PR 3, D-331) ; le planning et les besoins sur « Semaine » (lot S4).
  await attendreLaPagePrete(page, 'ma-ferme');
  expect(await entreesDuMenu(page)).toEqual([
    'Aujourd’hui', 'Arrosages', 'Semaine', 'Ma ferme', 'Matériel et placement', 'Alertes météo', 'Réglages',
  ]);
  await expect(page.getByRole('complementary', { name: 'Choix des fonctionnalités' })).toHaveCount(0);
  await verifierLEtape(page, journal, 'première page après le choix');

  // C'est la seule fois : les ouvertures suivantes arrivent sur « Aujourd'hui », première du menu (audit ergonomique, lot 2, F1).
  await page.goto('/irrigation');
  await attendreLaPagePrete(page, 'aujourdhui');

  // Une page non cochée conduit à la page d'arrivée, qui le dit une fois, en la
  // nommant, avec le lien qui mène où la cocher (audit final, lot E, J11, F265).
  await page.goto('/irrigation/historique');
  await attendreLaPagePrete(page, 'aujourdhui');
  const ligne = page.getByRole('status').filter({ hasText: 'La page « Historique et cumuls » n’est pas cochée pour votre ferme.' });
  await expect(ligne).toBeVisible();
  await expect(page).not.toHaveURL(/absente/);
  await verifierLEtape(page, journal, 'page non cochée');
  await ligne.getByRole('link', { name: 'La cocher dans Réglages' }).click();
  await attendreLaPagePrete(page, 'reglages');
  await expect(page).toHaveURL(/\/irrigation\/reglages(\?[^#]*)?#fonctionnalites$/);
  await expect(page.getByRole('heading', { name: 'Fonctionnalités de la ferme' })).toBeInViewport();
  await verifierLEtape(page, journal, 'le lien mène aux fonctionnalités de la ferme');

  // Une ancienne adresse de notification qui désignait l'historique ne nomme pas la page : la phrase d'avant, avec le même lien (P14, F265).
  await page.goto('/irrigation#series-water-title');
  await attendreLaPagePrete(page, 'aujourdhui');
  const ancienne = page.getByRole('status').filter({ hasText: 'Cette fonctionnalité n’est pas cochée pour votre ferme.' });
  await expect(ancienne).toBeVisible();
  await expect(ancienne.getByRole('link', { name: 'La cocher dans Réglages' })).toBeVisible();

  // Le choix fait, la liste de la première ouverture ne revient plus : on change dans Réglages.
  await page.goto('/irrigation/bienvenue');
  await attendreLaPagePrete(page, 'aujourdhui');
  await attendreLaPageIrrigation(page, 'reglages');
  // Réglages dit comment la ferme a commencé, en une ligne au-dessus des cases (S6, section 9).
  await expect(page.locator('.feature-started-with')).toHaveText('Vous avez choisi vous-même vos fonctionnalités.');
  await expect(caseDeLaFonctionnalite(page, 'Alertes météo')).toBeChecked();
  await expect(caseDeLaFonctionnalite(page, 'Historique et cumuls')).not.toBeChecked();
  await verifierLEtape(page, journal, 'le choix se relit dans Réglages');
});

test('une ferme d’avant la 3.8 garde tout coché et voit le bandeau, qui mène à Réglages (R6)', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'materiel');
  const bandeau = page.getByRole('complementary', { name: 'Choix des fonctionnalités' });
  await expect(bandeau).toContainText('Vous pouvez maintenant choisir les fonctionnalités affichées, dans Réglages.');
  // Les sept pages des cases hors la semaine, « Aujourd'hui », « Semaine » (lot S4), « Ma ferme » (S3, PR 1) et « Réglages ».
  expect(await entreesDuMenu(page)).toHaveLength(11);
  const lien = bandeau.getByRole('link', { name: 'Choisir dans Réglages' });
  await verifierCibleTactile(lien, 'Le lien « Choisir dans Réglages »');
  await verifierCibleTactile(bandeau.getByRole('button', { name: 'Fermer' }), 'Le bouton « Fermer » du bandeau');
  await verifierLEtape(page, journal, 'bandeau affiché');

  await lien.click();
  await attendreLaPagePrete(page, 'reglages');
  const cases = page.getByRole('group', { name: 'Fonctionnalités' }).getByRole('checkbox');
  await expect(cases).toHaveCount(11);
  // Les dix cases d'avant le choix sont cochées ; le calculateur (3.8 bis), venu après, ne l'est pas (R7).
  await expect(page.getByRole('group', { name: 'Fonctionnalités' }).getByRole('checkbox', { checked: true })).toHaveCount(10);
  await expect(caseDeLaFonctionnalite(page, 'Calculateur d’irrigation')).not.toBeChecked();
  await verifierLEtape(page, journal, 'tout coché dans Réglages, sauf le calculateur');
});
