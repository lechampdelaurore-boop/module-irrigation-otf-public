import { expect, test, type Page } from '@playwright/test';
import { attendreLeChoixDesFonctionnalites, caseDeLaFonctionnalite, entreesDuMenu, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P23 : décocher puis recocher une fonctionnalité qui a des données,
 * avec une dépendance (docs/feature-selection-contract.md, R1, R2, R3, R8,
 * P3, P6).
 *
 * La ferme coche la réserve du sol, qui entraîne le besoin par culture ;
 * celui-ci reste grisé tant que la réserve est cochée. Elle rattache une
 * espèce (une donnée du besoin par culture, réglée dans Réglages depuis la
 * 3.8), décoche la réserve, puis le besoin par culture : l'avertissement dit
 * ce qui reste ; la page, l'entrée du menu et la correspondance des espèces
 * disparaissent. Recochée, la case rend la page et le rattachement intact.
 */
test('décocher une fonctionnalité avertit, retire sa page et ses blocs sans rien effacer ; la recocher rend ses données', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'decocher');

  await page.goto('/irrigation/bienvenue');
  await attendreLeChoixDesFonctionnalites(page);
  await caseDeLaFonctionnalite(page, 'Réserve du sol').check();
  await expect(caseDeLaFonctionnalite(page, 'Besoin par culture')).toBeChecked();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'aujourdhui');
  expect(await entreesDuMenu(page)).toContain('Besoin par culture');

  // Une donnée du besoin par culture : la carotte rattachée, dans Réglages (P3).
  await attendreLaPageIrrigation(page, 'reglages');
  await rattacherLaCarotte(page);
  await verifierLEtape(page, journal, 'espèce rattachée');

  // Le besoin par culture est nécessaire à la réserve du sol : grisé, avec la raison (R3).
  const culture = caseDeLaFonctionnalite(page, 'Besoin par culture');
  await expect(culture).toBeDisabled();
  await expect(page.locator('li').filter({ has: culture })).toContainText('Nécessaire pour Réserve du sol.');

  // Décocher la réserve du sol, sans donnée : pas de fenêtre ; le besoin par culture reste coché (P6).
  // Dans Réglages, la case suit le choix enregistré : elle change avec la page rechargée (R9).
  await caseDeLaFonctionnalite(page, 'Réserve du sol').click();
  await expect(caseDeLaFonctionnalite(page, 'Réserve du sol')).not.toBeChecked();
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  await expect(culture).toBeChecked();
  await expect(culture).toBeEnabled();
  expect(await entreesDuMenu(page)).not.toContain('Réserve du sol');
  await verifierLEtape(page, journal, 'réserve du sol décochée');

  // Décocher le besoin par culture, qui a une donnée : l'avertissement (R2), puis « Annuler ».
  const fenetre = page.getByRole('dialog', { name: 'Décocher « Besoin par culture » ?' });
  await culture.click();
  await expect(fenetre).toContainText('1 réglage de culture reste enregistré. L’ETM n’est plus enregistrée chaque matin et la fiche de la planche ne propose plus d’objectif.');
  await verifierCibleTactile(fenetre.getByRole('button', { name: 'Décocher' }), 'Le bouton « Décocher »');
  await verifierLEtape(page, journal, 'avertissement avant de décocher');
  await fenetre.getByRole('button', { name: 'Annuler' }).click();
  await expect(fenetre).toBeHidden();
  await expect(culture).toBeChecked();

  // Confirmer : la page, l'entrée du menu et la correspondance des espèces disparaissent.
  await culture.click();
  await fenetre.getByRole('button', { name: 'Décocher' }).click();
  await expect(caseDeLaFonctionnalite(page, 'Besoin par culture')).not.toBeChecked();
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  expect(await entreesDuMenu(page)).not.toContain('Besoin par culture');
  await expect(page.getByRole('heading', { name: 'Correspondance des espèces' })).toHaveCount(0);
  await page.goto('/irrigation/cultures');
  await attendreLaPagePrete(page, 'aujourdhui');
  await expect(page.getByRole('status').filter({ hasText: 'Cette fonctionnalité n’est pas cochée pour votre ferme.' })).toBeVisible();
  await verifierLEtape(page, journal, 'besoin par culture décoché');

  // Recocher : rien d'autre à cocher, pas de fenêtre ; la page et le rattachement reviennent (R1).
  await attendreLaPageIrrigation(page, 'reglages');
  await caseDeLaFonctionnalite(page, 'Besoin par culture').click();
  await expect(caseDeLaFonctionnalite(page, 'Besoin par culture')).toBeChecked();
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  expect(await entreesDuMenu(page)).toContain('Besoin par culture');
  const carotte = page.locator('section.crop-coefficients details.species-link-card').filter({ has: page.locator('summary strong', { hasText: /^Carotte$/ }) });
  await expect(carotte).toHaveAttribute('data-linked', 'true');
  await expect(carotte.locator('summary').first()).not.toContainText('Non rattachée');
  await attendreLaPageIrrigation(page, 'cultures');
  await verifierLEtape(page, journal, 'besoin par culture recoché, données revenues');
});

async function rattacherLaCarotte(page: Page): Promise<void> {
  const especes = page.locator('section.crop-coefficients');
  await expect(especes.getByRole('heading', { level: 2, name: 'Correspondance des espèces' })).toBeVisible();
  const carte = especes.locator('details.species-link-card').filter({ has: page.locator('summary strong', { hasText: /^Carotte$/ }) });
  const formulaire = carte.getByRole('group', { name: 'Rattachement de l’espèce Carotte' });
  await carte.scrollIntoViewIfNeeded();
  await ouvrirParClic(carte.locator('summary').first(), formulaire);
  const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer' });
  await expect(async () => {
    await formulaire.getByLabel('Culture de référence').selectOption({ value: '' });
    await formulaire.getByLabel('Culture de référence').selectOption({ label: 'Carotte' });
    await expect(enregistrer).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await enregistrer.click();
  await expect(especes.getByRole('status')).toHaveText('Le rattachement de l’espèce est enregistré.');
}
