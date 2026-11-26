import { expect, test, type Page } from '@playwright/test';
import { attendreLaPremiereOuverture, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import { preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';
import { poserUnObjectifDeFerme } from './support/planning.ts';

/**
 * Parcours P70 : la mise en route (simplification, lot S6, PR 2,
 * docs/simplification-s6-contract.md, sections 5, 8 et 14 ; D-336, suite ;
 * docs/browser-journeys-contract.md), aux deux largeurs.
 *
 * Une ferme neuve, passée par « Je note mes arrosages », trouve en tête de
 * « Ma ferme » la carte « Mise en route » : deux étapes, la première en
 * cours, son bouton « Continuer l'étape 1 ». « Aujourd'hui », sans arrosage,
 * dit la même étape à la place de « Rien à arroser ». « Plus tard » laisse
 * une ligne « Reprendre la mise en route », qui tient au rechargement et
 * rend la carte ; le matériel créé et posé, les deux étapes sont faites
 * après relecture, « Terminer la mise en route » l'efface pour de bon. Une
 * ferme passée par « Tout » a cinq étapes, la quatrième attend la deuxième,
 * et le bandeau « À finir » n'est pas répété sur « Ma ferme » ; une ferme
 * d'avant S6 n'a aucune carte. Au téléphone, la carte à cinq étapes dont
 * quatre faites est mesurée (380 px au plus à 390 px), sans débord à 320 px.
 */

const carte = (page: Page) => page.locator('section.start-route');
const etapes = (page: Page) => carte(page).locator('li.start-route-step');
const blocDuJour = (page: Page) => page.locator('#today-day .today-route');

async function ouvrirMaFerme(page: Page): Promise<void> {
  await attendreLaPageIrrigation(page, 'ma-ferme');
}

test('« Je note mes arrosages » : la carte, « Aujourd’hui », « Plus tard », « Reprendre », une étape faite, « Terminer »', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'p70-notes');
  await page.goto('/irrigation/bienvenue');
  await attendreLaPremiereOuverture(page);
  await page.getByRole('radio', { name: 'Je note mes arrosages' }).check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'ma-ferme');

  // La carte : deux étapes (le total de la façon, section 5.2), la première en cours.
  await expect(carte(page).getByRole('heading', { level: 2, name: 'Mise en route' })).toBeVisible();
  await expect(carte(page).locator('.start-route-count')).toHaveText('0 étape sur 2');
  await expect(carte(page).getByRole('img', { name: '0 étape sur 2' })).toBeVisible();
  await expect(etapes(page)).toHaveCount(2);
  await expect(etapes(page).first()).toHaveAttribute('data-status', 'current');
  await expect(etapes(page).first().getByRole('img', { name: 'en cours' })).toHaveCount(1);
  await expect(etapes(page).first()).toContainText('Mon matériel');
  await expect(etapes(page).first()).toContainText('Aucun matériel pour l’instant.');
  await expect(etapes(page).first()).toContainText('Après cette étape, vous pouvez noter un arrosage.');
  await expect(etapes(page).nth(1)).toHaveAttribute('data-status', 'todo');
  const continuer = carte(page).getByRole('link', { name: 'Continuer l’étape 1' });
  await expect(continuer).toHaveAttribute('href', /^\/irrigation\/materiel\?season=\d{4}&onglet=materiel#equipment-title$/);
  await verifierLEtape(page, journal, 'la carte, première façon');

  // « Aujourd'hui », sans arrosage : la même étape, à la place de « Rien à arroser » (section 8).
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await expect(blocDuJour(page)).toContainText('Votre ferme n’est pas encore décrite.');
  await expect(blocDuJour(page)).toContainText('Votre matériel : aucun matériel pour l’instant.');
  await expect(blocDuJour(page).getByRole('link', { name: 'Continuer l’étape 1' })).toHaveAttribute('href', /^\/irrigation\/materiel\?season=\d{4}&onglet=materiel#equipment-title$/);
  await expect(page.locator('#today-day').getByText('Rien à arroser aujourd’hui')).toHaveCount(0);
  await verifierLEtape(page, journal, '« Aujourd’hui », la ferme pas encore décrite');

  // « Plus tard » : une ligne, qui tient au rechargement (S6-l) ; « Aujourd'hui » retrouve sa ligne vide.
  await ouvrirMaFerme(page);
  // La page est prête (React aux commandes) : un seul appui, comme une personne.
  await carte(page).getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByText('La mise en route est remise à plus tard. Elle vous attend ici.')).toBeVisible();
  const reprendre = page.getByRole('button', { name: 'Reprendre la mise en route · 0 étape sur 2' });
  await expect(reprendre).toBeVisible();
  await expect(carte(page)).toHaveCount(0);
  await page.reload();
  await attendreLaPagePrete(page, 'ma-ferme');
  await expect(reprendre).toBeVisible();
  await verifierLEtape(page, journal, 'remise à plus tard');
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await expect(blocDuJour(page)).toHaveCount(0);
  await expect(page.locator('#today-day').getByText('Rien à arroser aujourd’hui')).toBeVisible();

  // « Reprendre » rend la carte.
  await ouvrirMaFerme(page);
  await reprendre.click();
  await expect(page.getByText('La mise en route est reprise.')).toBeVisible();
  await expect(carte(page).locator('.start-route-count')).toHaveText('0 étape sur 2');

  // « Continuer l'étape 1 » mène à l'inventaire ; le matériel créé, réglé et posé, les deux étapes sont faites à la relecture.
  await carte(page).getByRole('link', { name: 'Continuer l’étape 1' }).click();
  await attendreLaPagePrete(page, 'materiel');
  await expect(page).toHaveURL(/onglet=materiel#equipment-title$/);
  await preparerMaterielArrosant(page, testInfo);
  await ouvrirMaFerme(page);
  await expect(page.locator('section.start-route[data-kind="complete"]')).toContainText('Votre ferme est décrite.');

  // « Terminer » : la carte part pour de bon (S6-k).
  await page.getByRole('button', { name: 'Terminer la mise en route' }).click();
  await expect(page.getByText('La mise en route est terminée.')).toBeVisible();
  await expect(page.locator('section.start-route')).toHaveCount(0);
  await page.reload();
  await attendreLaPagePrete(page, 'ma-ferme');
  await expect(page.locator('.start-route-zone')).toHaveCount(0);
  await verifierLEtape(page, journal, 'mise en route terminée');
});

test('« Tout » : cinq étapes, la quatrième attend la deuxième, le bandeau « À finir » non répété sur « Ma ferme » ; une ferme d’avant S6 sans carte', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'p70-tout');
  await page.goto('/irrigation/bienvenue');
  await attendreLaPremiereOuverture(page);
  await page.getByRole('radio', { name: 'Tout : sol, cultures et alertes' }).check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'ma-ferme');

  await expect(carte(page).locator('.start-route-count')).toHaveText('0 étape sur 5');
  await expect(etapes(page).locator('strong')).toHaveText(['Mon matériel', 'Où il est posé', 'D’où vient l’eau', 'Combien je vise par semaine', 'Mon sol']);
  // L'étape 4 attend l'étape 2 : elle le dit, et ne mène nulle part avant (section 5.1).
  await expect(etapes(page).nth(3)).toContainText('Posez d’abord le matériel sur vos planches.');
  await expect(etapes(page).nth(3).getByRole('link')).toHaveCount(0);
  await expect(etapes(page).nth(4).getByRole('link')).toHaveAttribute('href', /^\/irrigation\/sol\?season=\d{4}#soil-parcel-/);
  // Le bandeau « À finir » n'est pas répété sur « Ma ferme » ; la fiche « Réglages » garde « À faire » (S6-d).
  await expect(page.locator('.onboarding-unfinished')).toHaveCount(0);
  await expect(page.locator('.farm-card-todo').first()).toContainText('À faire : ');
  await verifierLEtape(page, journal, 'la carte, cinq étapes');
  // Sur toute autre page, il reste.
  await attendreLaPageIrrigation(page, 'reglages');
  await expect(page.locator('.onboarding-unfinished')).toContainText('commune de la ferme');

  await attendreLaPageIrrigation(page, 'aujourdhui');
  await expect(blocDuJour(page)).toContainText('Votre ferme n’est pas encore prête à proposer des arrosages.');
  await expect(blocDuJour(page)).toContainText('Votre matériel : aucun matériel pour l’instant.');
  await verifierLEtape(page, journal, '« Aujourd’hui », la ferme pas encore prête');

  // La ferme de démonstration habituelle, d'avant S6 : aucune carte, ni ligne, ni bloc (S6-j).
  await context.clearCookies({ name: 'demo-farm' });
  await ouvrirMaFerme(page);
  await expect(page.locator('.start-route-zone')).toHaveCount(0);
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await expect(blocDuJour(page)).toHaveCount(0);
  await verifierLEtape(page, journal, 'ferme d’avant S6, sans carte');
});

test('au téléphone, la carte à quatre étapes faites sur cinq tient dans 380 px ; à 320 px, sans débord, ses cibles mesurées', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'telephone', 'mesures du téléphone seulement');
  test.setTimeout(240_000);
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'p70-mesures');
  await page.goto('/irrigation/bienvenue');
  await attendreLaPremiereOuverture(page);
  await page.getByRole('radio', { name: 'Tout : sol, cultures et alertes' }).check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'ma-ferme');
  const hauteur = async () => Math.round((await carte(page).boundingBox())?.height ?? 0);
  testInfo.annotations.push({ type: 'mesure', description: `carte à 390 px, aucune étape faite : ${await hauteur()} px` });

  // Les étapes 1 à 4 faites par leurs pages : le matériel posé, une ressource, l'eau visée de toute la ferme.
  await attendreLaPageIrrigation(page, 'materiel');
  await preparerMaterielArrosant(page, testInfo);
  await attendreLaPageIrrigation(page, 'ressources');
  const ressources = page.locator('.water-asset-panel').filter({ hasText: 'Ressources' }).first();
  const creation = page.locator('.water-editor').filter({ hasText: 'Nouvelle ressource' });
  await ouvrirParClic(ressources.getByRole('button', { name: '+ Ajouter' }), creation);
  await creation.getByLabel('Nom', { exact: true }).fill('Puits');
  await creation.getByLabel('Débit nominal (m³/h)').fill('2');
  await creation.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(ressources.locator('.water-asset-card').filter({ hasText: 'Puits' })).toHaveCount(1);
  await ouvrirMaFerme(page);
  await expect(carte(page).locator('.start-route-count')).toHaveText('3 étapes sur 5');
  // L'étape en cours mène à l'eau visée : « Continuer l'étape 4 ».
  await carte(page).getByRole('link', { name: 'Continuer l’étape 4' }).click();
  await attendreLaPagePrete(page, 'semaine');
  await poserUnObjectifDeFerme(page, '20');

  await ouvrirMaFerme(page);
  await expect(carte(page).locator('.start-route-count')).toHaveText('4 étapes sur 5');
  // Les faites repliées en une ligne ; l'étape en cours reste à l'écran (section 5.2).
  await expect(carte(page).locator('details.start-route-fold summary')).toHaveText('4 étapes faites');
  await expect(etapes(page).filter({ visible: true })).toHaveCount(1);
  await expect(carte(page).locator('li.start-route-step[data-status="current"]')).toContainText('Mon sol');
  const quatreFaites = await hauteur();
  testInfo.annotations.push({ type: 'mesure', description: `carte à 390 px, cinq étapes dont quatre faites : ${quatreFaites} px` });
  expect(quatreFaites).toBeLessThanOrEqual(380);
  await verifierLEtape(page, journal, 'quatre étapes faites');

  await page.setViewportSize({ width: 320, height: 640 });
  const continuer = carte(page).getByRole('link', { name: 'Continuer l’étape 5' });
  expect(Math.round((await continuer.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(48);
  const largeur = Math.round((await carte(page).locator('.start-route-steps').last().boundingBox())?.width ?? 0);
  expect(Math.abs(Math.round((await continuer.boundingBox())?.width ?? 0) - largeur)).toBeLessThanOrEqual(1);
  await verifierCibleTactile(carte(page).locator('a.start-route-step-link').first(), 'L’étape en cours');
  await verifierCibleTactile(carte(page).locator('details.start-route-fold summary'), 'Le pli des étapes faites');
  await verifierCibleTactile(carte(page).getByRole('button', { name: 'Plus tard' }), 'Le lien « Plus tard »');
  await verifierLEtape(page, journal, 'la carte à 320 px');
});
