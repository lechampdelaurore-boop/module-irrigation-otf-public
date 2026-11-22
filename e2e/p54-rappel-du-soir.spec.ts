import { expect, test } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P54 : le réglage du rappel du soir (amélioration n° 2,
 * docs/ameliorations-6-2-3-7-contract.md, section 4.1 et 4.3, F702, F714 ;
 * docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, toutes cases cochées : dans « Réglages »,
 * « Notifications du téléphone » porte la case « Rappel du soir », cochée
 * par défaut, et son heure, 19 h. Changer l'heure l'enregistre et le dit ;
 * la page rouverte la relit ; décocher le coupe et grise l'heure ; recocher
 * le rallume. Au téléphone (390 px) et à l'ordinateur, à 1 440 px de large.
 *
 * Ce qu'il ne prouve pas : le passage horaire et l'envoi du rappel, que le
 * Worker de notification simulé prouve dans les tests du service
 * (tests/db/rappel-du-soir.test.ts) ; le texte et l'heure due, dans les
 * tests du domaine (tests/rappel-du-soir.test.ts) ; l'essai sur un appareil
 * réel, recette du porteur.
 */

const DUREE_DU_PARCOURS = 120_000;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;

test('« Rappel du soir » : coché à 19 h par défaut, l’heure se change et se relit, la case se coupe et se rallume', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'rappel-du-soir');

  const reglage = () => page.locator('#rappel-du-soir');
  const caseDuSoir = () => reglage().getByRole('checkbox', { name: 'Rappel du soir' });
  const heure = () => reglage().getByLabel('Heure du rappel');

  const ligneDuPli = () => page.locator('#messages-de-la-ferme > summary');
  // L'ancre du réglage ouvre le pli « Messages de la ferme » (F715).
  const ouvrirLeReglage = async () => {
    await page.goto('/irrigation/reglages#rappel-du-soir');
    await attendreLaPagePrete(page, 'reglages');
    await expect(caseDuSoir()).toBeVisible();
  };

  await attendreLaPageIrrigation(page, 'reglages');
  await expect(page.locator('#messages-de-la-ferme')).not.toHaveAttribute('open', '');
  await expect(ligneDuPli()).toContainText('Rappel du soir à 19 h.');
  await ouvrirLeReglage();
  await reglage().scrollIntoViewIfNeeded();
  await expect(caseDuSoir()).toBeChecked();
  await expect(heure()).toHaveValue('19:00');
  await expect(heure().locator('option')).toHaveCount(21);
  await expect(reglage()).toContainText('Il ne confirme rien lui-même');
  if (telephone) {
    await verifierCibleTactile(reglage().locator('label.water-toggle'), 'La case « Rappel du soir »');
    await verifierCibleTactile(heure(), 'Le choix de l’heure du rappel');
  }
  await verifierLEtape(page, journal, 'coché à 19 h par défaut');

  await heure().selectOption('20:30');
  await expect(reglage().getByRole('status')).toHaveText('Le rappel du soir est activé, à 20 h 30.');
  await expect(ligneDuPli()).toContainText('Rappel du soir à 20 h 30.');
  await ouvrirLeReglage();
  await expect(heure()).toHaveValue('20:30');
  await verifierLEtape(page, journal, 'heure changée, relue');

  await caseDuSoir().uncheck();
  await expect(reglage().getByRole('status')).toHaveText('Le rappel du soir est coupé.');
  await expect(heure()).toBeDisabled();
  await expect(ligneDuPli()).toContainText('Rappel du soir coupé.');
  await ouvrirLeReglage();
  await expect(caseDuSoir()).not.toBeChecked();
  await expect(heure()).toHaveValue('20:30');
  await verifierLEtape(page, journal, 'coupé, relu');

  await caseDuSoir().check();
  await expect(reglage().getByRole('status')).toHaveText('Le rappel du soir est activé, à 20 h 30.');
  await ouvrirLeReglage();
  await expect(caseDuSoir()).toBeChecked();
  await verifierLEtape(page, journal, 'rallumé, relu');
});
