import { expect, test } from '@playwright/test';
import { attendreLeChoixDesFonctionnalites, caseDeLaFonctionnalite, entreesDuMenu, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P22 : la première ouverture et le choix des fonctionnalités
 * (docs/feature-selection-contract.md, R3, R5, R6, P6, P7, P10, P14).
 *
 * Une ferme neuve voit la liste avant toute page, rien coché d'avance ; cocher
 * le planning coche ce dont il a besoin, grisé avec la raison ; décocher ne
 * décoche pas ce qu'on avait entraîné ; « Continuer » attend une case. Le
 * choix fait, la ferme arrive sur sa première page et son menu ne montre que
 * ses cases ; une page non cochée, et une ancienne adresse de notification qui
 * la désignait, conduisent à la première page, qui le dit.
 */
test('une ferme neuve choisit ses fonctionnalités avant toute page, et ne voit ensuite que celles-ci', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'premiere-ouverture');

  // Une page demandée avant le choix conduit à la liste.
  await page.goto('/irrigation/planning');
  await attendreLeChoixDesFonctionnalites(page);
  await expect(page.getByRole('checkbox')).toHaveCount(11);
  for (const caseACocher of await page.getByRole('checkbox').all()) await expect(caseACocher).not.toBeChecked();
  const continuer = page.getByRole('button', { name: 'Continuer' });
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

  // La page d'arrivée est « Aujourd'hui », première du menu (audit ergonomique, lot 2, F1), sans bandeau.
  await attendreLaPagePrete(page, 'aujourdhui');
  expect(await entreesDuMenu(page)).toEqual([
    'Aujourd’hui', 'Arrosages', 'Planning de la semaine', 'Objectifs et besoins', 'Matériel et placement', 'Alertes météo', 'Réglages',
  ]);
  await expect(page.getByRole('complementary', { name: 'Choix des fonctionnalités' })).toHaveCount(0);
  await verifierLEtape(page, journal, 'première page après le choix');

  // Une page non cochée conduit à la page d'arrivée, qui le dit une fois.
  await page.goto('/irrigation/historique');
  await attendreLaPagePrete(page, 'aujourdhui');
  await expect(page.getByRole('status').filter({ hasText: 'Cette fonctionnalité n’est pas cochée pour votre ferme.' })).toBeVisible();
  await expect(page).not.toHaveURL(/absente/);
  await verifierLEtape(page, journal, 'page non cochée');

  // Une ancienne adresse de notification qui désignait l'historique fait de même (P14).
  await page.goto('/irrigation#series-water-title');
  await attendreLaPagePrete(page, 'aujourdhui');
  await expect(page.getByRole('status').filter({ hasText: 'Cette fonctionnalité n’est pas cochée pour votre ferme.' })).toBeVisible();

  // Le choix fait, la liste de la première ouverture ne revient plus : on change dans Réglages.
  await page.goto('/irrigation/bienvenue');
  await attendreLaPagePrete(page, 'aujourdhui');
  await attendreLaPageIrrigation(page, 'reglages');
  await expect(caseDeLaFonctionnalite(page, 'Alertes météo')).toBeChecked();
  await expect(caseDeLaFonctionnalite(page, 'Historique et cumuls')).not.toBeChecked();
  await verifierLEtape(page, journal, 'le choix se relit dans Réglages');
});

test('une ferme d’avant la 3.8 garde tout coché et voit le bandeau, qui mène à Réglages (R6)', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'materiel');
  const bandeau = page.getByRole('complementary', { name: 'Choix des fonctionnalités' });
  await expect(bandeau).toContainText('Vous pouvez maintenant choisir les fonctionnalités affichées, dans Réglages.');
  expect(await entreesDuMenu(page)).toHaveLength(12);
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
