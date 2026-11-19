import { expect, test } from '@playwright/test';
import { annulerDepuisLeMenu, choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

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
 * Ce qu'il ne prouve pas : un vrai téléphone, un lecteur d'écran.
 */

test('« Planifier » répond sous son bouton, se vide et demande avant un second créneau identique', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const reference = Date.now();
  await attendreLaPageIrrigation(page);
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo, { repere: 'p37' });
  await attendreLaPageIrrigation(page, 'arrosages');

  await page.getByRole('tab', { name: /^Planifier/ }).click();
  const debut = horodatageLocal(2 * 24 * 60, reference);
  await choisirMaterielEtReglage(page, materiel, reglage);
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
});

test('« Objectifs et besoins » répond sous chaque bouton, et un rechargement ne parle pas', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'besoins');

  const objectifs = page.locator('.water-panel').filter({ hasText: 'Objectifs hebdomadaires' });
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
  const pluie = page.locator('#manual-rain');
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
