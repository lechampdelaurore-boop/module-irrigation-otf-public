import { expect, test } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P60 : l'écran des heures de silence (6 undecies, PR H3,
 * docs/heures-de-silence-contract.md, section 4 et section 13, F817 à F821 ;
 * D-326 ; docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, toutes cases cochées : dans « Réglages », le pli
 * « Messages de la ferme » dit « Heures de silence coupées. » ; l'ancre
 * `#heures-de-silence` l'ouvre sur la case, décochée, sans heures. Allumer
 * propose 22 h à 6 h, le gel qui passe, et le dit ; la ligne du pli suit.
 * Le rappel du soir mis à 21 h 30 fait paraître, sans recharger,
 * l'avertissement « ne partira pas » (son passage de 22 h 05 tombe dans la
 * plage, F806) ; un début à 22 h 15 le fait disparaître ; la fin à 7 h et la
 * case du gel décochée se relisent à la réouverture. Éteindre le dit, cache
 * les heures, et se relit. Au téléphone (390 px) et à l'ordinateur, à
 * 1 440 px de large.
 *
 * Ce qu'il ne prouve pas : la retenue des notifications et la reprogrammation
 * des retards à l'enregistrement, que le Worker de notification simulé
 * prouve dans les tests du service (tests/db/heures-de-silence-*.test.ts) ;
 * la ligne « aucun appareil », chiffrée par les tests de la persistance (une
 * ferme neuve n'a envoyé aucune alerte) ; l'essai sur un appareil réel,
 * recette du porteur.
 */

const DUREE_DU_PARCOURS = 150_000;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;

test('« Heures de silence » : allumer, régler, lire l’avertissement du rappel du soir, éteindre', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'heures-de-silence');

  const reglage = () => page.locator('#heures-de-silence');
  const caseSilence = () => reglage().getByRole('checkbox', { name: 'Heures de silence' });
  const debut = () => reglage().getByRole('combobox', { name: 'Début', exact: true });
  const fin = () => reglage().getByRole('combobox', { name: 'Fin', exact: true });
  const caseGel = () => reglage().getByRole('checkbox', { name: 'Laisser passer les alertes de gel' });
  const avertissements = () => reglage().locator('.quiet-hours-warnings');
  const ligneDuPli = () => page.locator('#messages-de-la-ferme > summary');
  const heureDuSoir = () => page.locator('#rappel-du-soir').getByLabel('Heure du rappel');
  const ouvrirLeReglage = async () => {
    await page.goto('/irrigation/reglages#heures-de-silence');
    await attendreLaPagePrete(page, 'reglages');
    await expect(caseSilence()).toBeVisible();
  };

  await attendreLaPageIrrigation(page, 'reglages');
  await expect(page.locator('#messages-de-la-ferme')).not.toHaveAttribute('open', '');
  await expect(ligneDuPli()).toContainText('Heures de silence coupées.');
  await ouvrirLeReglage();
  await reglage().scrollIntoViewIfNeeded();
  await expect(caseSilence()).not.toBeChecked();
  await expect(debut()).toHaveCount(0);
  await expect(reglage()).toContainText('sauf la fin d’un arrosage');
  if (telephone) await verifierCibleTactile(reglage().locator('label.water-toggle').first(), 'La case « Heures de silence »');
  await verifierLEtape(page, journal, 'coupées par défaut');

  await caseSilence().check();
  await expect(reglage().getByRole('status')).toHaveText('Les heures de silence sont réglées de 22 h à 6 h.');
  await expect(debut()).toHaveValue('22:00');
  await expect(fin()).toHaveValue('06:00');
  await expect(debut().locator('option')).toHaveCount(16);
  await expect(fin().locator('option')).toHaveCount(21);
  await expect(caseGel()).toBeChecked();
  await expect(reglage()).toContainText('la fin d’un arrosage et les alertes de gel partent toujours');
  await expect(avertissements()).toContainText('Elles valent pour tous les téléphones de la ferme');
  await expect(avertissements()).not.toContainText('Le rappel du soir');
  await expect(avertissements()).not.toContainText('aucun appareil');
  await expect(ligneDuPli()).toContainText('Silence de 22 h à 6 h.');
  if (telephone) {
    await verifierCibleTactile(debut(), 'Le choix du début');
    await verifierCibleTactile(fin(), 'Le choix de la fin');
    await verifierCibleTactile(reglage().locator('label.water-toggle').nth(1), 'La case du gel');
  }
  await verifierLEtape(page, journal, 'allumées, 22 h à 6 h');

  // F806 : réglé à 21 h 30, le rappel part au passage de 22 h 05, dans la plage.
  await heureDuSoir().selectOption('21:30');
  await expect(page.locator('#rappel-du-soir').getByRole('status')).toHaveText('Le rappel du soir est activé, à 21 h 30.');
  await expect(avertissements()).toContainText('Le rappel du soir (21 h 30) ne partira pas : son envoi, à 22 h 05, tombe dans les heures de silence.');
  await verifierLEtape(page, journal, 'avertissement du rappel');

  await debut().selectOption('22:15');
  await expect(reglage().getByRole('status')).toHaveText('Les heures de silence sont réglées de 22 h 15 à 6 h.');
  await expect(avertissements()).not.toContainText('Le rappel du soir');
  await fin().selectOption('07:00');
  await expect(reglage().getByRole('status')).toHaveText('Les heures de silence sont réglées de 22 h 15 à 7 h.');
  await caseGel().uncheck();
  await expect(reglage().getByRole('status')).toHaveText('Les heures de silence sont réglées de 22 h 15 à 7 h.');
  await expect(reglage()).toContainText('seule la fin d’un arrosage part');
  await expect(ligneDuPli()).toContainText('Silence de 22 h 15 à 7 h.');
  await ouvrirLeReglage();
  await expect(caseSilence()).toBeChecked();
  await expect(debut()).toHaveValue('22:15');
  await expect(fin()).toHaveValue('07:00');
  await expect(caseGel()).not.toBeChecked();
  await verifierLEtape(page, journal, 'réglées, relues');

  await caseSilence().uncheck();
  await expect(reglage().getByRole('status')).toHaveText('Les heures de silence sont coupées.');
  await expect(debut()).toHaveCount(0);
  await expect(avertissements()).toHaveCount(0);
  await expect(ligneDuPli()).toContainText('Heures de silence coupées.');
  await ouvrirLeReglage();
  await expect(caseSilence()).not.toBeChecked();
  await verifierLEtape(page, journal, 'éteintes, relues');
});
