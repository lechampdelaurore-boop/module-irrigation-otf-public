import { expect, test } from '@playwright/test';
import { annulerDepuisLeMenu, choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierCibleTactile, verifierLEtape , ouvrirLePli } from './support/parcours.ts';
import { poserUnObjectifDeFerme, retirerLesObjectifs } from './support/planning.ts';

/**
 * Parcours P37 : l'audit ergonomique du 19 novembre 2026, lot G, « Le module
 * vous répond » (docs/audit-ergonomie-2026-11-19-lot-g-contract.md ;
 * docs/browser-journeys-contract.md).
 *
 * Sur la ferme de démonstration, sans rien laisser derrière lui :
 *
 * - « Planifier » : le message vient sous « Planifier l’irrigation », à
 *   l'écran sans que l'utilisateur défile (F404) ; le formulaire se vide et
 *   son bouton redevient indisponible (F406) ; le même matériel replanifié
 *   sur le même créneau ouvre la fenêtre du module : « Ne pas planifier »
 *   n'écrit rien, « Planifier quand même » écrit la seconde (F407, F408).
 *
 * - « Objectifs et besoins » : un objectif hors bornes se dit sous son
 *   « Enregistrer », la pluie mesurée sous le sien ; aucun « Les besoins ont
 *   été recalculés » ne paraît après un geste fait ailleurs (F404, F405).
 *
 * - la quantité : vide pour un matériel sans dose du jour, le bouton
 *   indisponible (F409) ; au-delà de l'objectif de la semaine d'une
 *   planche, la fenêtre du module demande, « Ne pas irriguer » n'écrit rien
 *   (F410). La dose du jour elle-même se prouve dans les tests du domaine
 *   (`tests/irrigation-form-hints.test.ts`) : un plan à l'écran est le
 *   travail de P10.
 *
 * - « Retirer (stocker) » en contour neutre, aucune boîte du navigateur ; les
 *   sept autres confirmations se confirment en rouge dans les parcours qui
 *   les jouent (`confirmerDansLaFenetre`, F413 et F414) ; « Vider les
 *   objectifs » dans le même mot partout (F415).
 *
 * - l'initiale ouvre le menu du compte, le nom et « Se déconnecter » ; un
 *   appui ne déconnecte plus ; Échap, un appui ailleurs ou sur l'initiale le
 *   ferment (F416).
 *
 * Ce qu'il ne prouve pas : un vrai téléphone, un lecteur d'écran.
 */

test('« Planifier » répond sous son bouton, se vide et demande avant un second créneau identique', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const reference = Date.now();
  await attendreLaPageIrrigation(page);
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo, { repere: 'p37' });
  // « Retirer (stocker) » se défait : il quitte le rouge, contour neutre (lot G, n° 8, F414).
  const retirer = page.locator('.equipment-section article').filter({ hasText: materiel }).getByRole('button', { name: `Retirer et stocker ${materiel}` });
  await expect(retirer).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(retirer).toHaveCSS('border-top-color', 'rgb(187, 187, 187)');
  // Aucune boîte du navigateur de tout le parcours : les confirmations passent par la fenêtre du module (F413).
  const boitesDuNavigateur: string[] = [];
  page.on('dialog', (boite) => { boitesDuNavigateur.push(boite.message()); void boite.dismiss(); });
  await attendreLaPageIrrigation(page, 'arrosages');

  await page.getByRole('tab', { name: /^Planifier/ }).click();
  const debut = horodatageLocal(2 * 24 * 60, reference);
  // Aucune dose du jour pour un matériel neuf : la quantité reste vide, le bouton indisponible (F409).
  await choisirMaterielEtReglage(page, materiel, reglage, '');
  await expect(page.getByLabel('Quantité souhaitée')).toHaveValue('');
  await page.getByLabel('Quantité souhaitée').fill('25');
  await page.getByLabel('Date et heure de début').fill(debut);
  const planifier = page.getByRole('button', { name: 'Planifier l’irrigation' });
  await planifier.click();

  const reponse = page.locator('.irrigation-preview .action-reply');
  await expect(reponse.locator('.irrigation-event-notice')).toHaveText(/planifiée/);
  await expect(reponse).toBeInViewport();
  await expect(page.locator('.irrigation-events-section > .action-reply')).toHaveCount(0);
  await expect(planifier).toBeDisabled();
  const fiches = page.locator('.upcoming-irrigations article').filter({ hasText: materiel });
  await expect(fiches).toHaveCount(1);
  await verifierLEtape(page, journal, 'le message sous le bouton, le formulaire vidé');

  const fenetre = page.locator('dialog.module-confirm-dialog[open]');
  await choisirMaterielEtReglage(page, materiel, reglage);
  await page.getByLabel('Date et heure de début').fill(debut);
  await planifier.click();
  await expect(fenetre).toContainText('Ce matériel a déjà une irrigation planifiée le');
  await fenetre.getByRole('button', { name: 'Ne pas planifier' }).click();
  await expect(fenetre).toHaveCount(0);
  await expect(fiches).toHaveCount(1);
  await verifierLEtape(page, journal, '« Ne pas planifier » n’écrit rien');

  await planifier.click();
  await expect(fenetre).toBeVisible();
  await fenetre.getByRole('button', { name: 'Planifier quand même' }).click();
  await expect(fiches).toHaveCount(2);
  await expect(reponse.locator('.irrigation-event-notice')).toHaveText(/planifiée/);
  await verifierLEtape(page, journal, '« Planifier quand même » écrit la seconde');

  // Remise en état : les deux irrigations annulées.
  await annulerDepuisLeMenu(page, fiches.first());
  await expect(fiches).toHaveCount(1);
  await annulerDepuisLeMenu(page, fiches.first());
  await expect(fiches).toHaveCount(0);
  expect(boitesDuNavigateur, 'aucune boîte du navigateur').toEqual([]);
});

test('« Objectifs et besoins » répond sous chaque bouton, et un rechargement ne parle pas', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'besoins');

  const objectifs = await ouvrirLePli(page.locator('#objectifs-de-la-semaine'));
  await objectifs.scrollIntoViewIfNeeded();
  await objectifs.getByLabel('mm / semaine').fill('600');
  await objectifs.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const refus = objectifs.locator('.action-reply .water-error');
  await expect(refus).toHaveText('L’objectif doit être compris entre 0 et 500 mm par semaine.');
  await expect(refus).toBeInViewport();
  await expect(page.locator('.water-management-section > .action-reply')).toHaveCount(0);
  await objectifs.getByLabel('mm / semaine').fill('');
  await verifierLEtape(page, journal, 'l’objectif refusé sous son bouton');

  // La pluie du jour : réenregistrée telle quelle, ou posée puis retirée.
  const pluie = await ouvrirLePli(page.locator('#manual-rain'));
  await pluie.scrollIntoViewIfNeeded();
  const millimetres = pluie.getByLabel('Millimètres');
  const avant = await millimetres.inputValue();
  await millimetres.fill(avant === '' ? '0' : avant);
  await pluie.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const reponse = pluie.locator('.action-reply .water-notice');
  await expect(reponse).toHaveText('La pluie mesurée a été enregistrée.');
  await expect(reponse).toBeInViewport();
  await expect(page.locator('.irrigation-needs-section .water-notice')).toHaveCount(0);
  await expect(page.getByText('Les besoins ont été recalculés')).toHaveCount(0);
  await verifierLEtape(page, journal, 'la pluie sous son bouton, les besoins muets');

  if (avant === '') {
    await pluie.getByRole('button', { name: 'Retirer la mesure' }).click();
    await expect(reponse).toContainText('retirée');
    await expect(millimetres).toHaveValue('');
  }
});

test('au-delà de l’objectif de la semaine, « Irriguer maintenant » demande d’abord', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page);
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo, { repere: 'p37 objectif' });
  await attendreLaPageIrrigation(page, 'besoins');
  await poserUnObjectifDeFerme(page, '10');
  try {
    await attendreLaPageIrrigation(page, 'arrosages');
    await page.getByRole('tab', { name: /^Irriguer maintenant/ }).click();
    await choisirMaterielEtReglage(page, materiel, reglage);
    await page.getByRole('button', { name: 'Démarrer l’irrigation' }).click();
    const fenetre = page.locator('dialog.module-confirm-dialog[open]');
    await expect(fenetre).toContainText('25 mm dépassent l’objectif de la semaine de N01 (10 mm). Irriguer quand même ?');
    await fenetre.getByRole('button', { name: 'Ne pas irriguer' }).click();
    await expect(fenetre).toHaveCount(0);
    await expect(page.getByLabel('Irrigations en cours').filter({ hasText: materiel })).toHaveCount(0);
    await verifierLEtape(page, journal, '« Ne pas irriguer » n’écrit rien');
  } finally {
    await attendreLaPageIrrigation(page, 'besoins');
    await retirerLesObjectifs(page);
  }
});

test('l’initiale ouvre le menu du compte et ne déconnecte plus d’un appui', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await attendreLaPageIrrigation(page, 'arrosages');
  const adresse = page.url();
  const initiale = page.getByRole('button', { name: /^Compte de / });
  const menu = page.getByRole('menu', { name: 'Compte' });
  const deconnecter = menu.getByRole('menuitem', { name: 'Se déconnecter' });

  await initiale.click();
  await expect(menu).toBeVisible();
  await expect(initiale).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.locator('.account-menu-name')).not.toBeEmpty();
  await expect(deconnecter).toHaveAttribute('href', /.+/);
  await expect(menu).toBeInViewport();
  expect(page.url(), 'un appui sur l’initiale ne quitte pas la page').toBe(adresse);
  // La cible de 44 px de l'initiale, posée par son pseudo-élément, se vérifie avec celles de la barre (F22) ; ici le lien du menu.
  if (telephone) await verifierCibleTactile(deconnecter, '« Se déconnecter »');
  await verifierLEtape(page, journal, 'le menu du compte ouvert');

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(initiale).toBeFocused();
  await initiale.click();
  await expect(menu).toBeVisible();
  await page.locator('h1').first().click();
  await expect(menu).toHaveCount(0);
  await initiale.click();
  await initiale.click();
  await expect(menu).toHaveCount(0);
  await verifierLEtape(page, journal, 'le menu se ferme par Échap, un appui ailleurs ou l’initiale');
});
