import { expect, test } from '@playwright/test';
import { choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant, soumettreIrrigation } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P3 : saisir une irrigation déjà réalisée
 * (docs/browser-journeys-contract.md).
 *
 * Le maraîcher arrose souvent sans avoir lancé le minuteur, puis consigne après
 * coup. Ce parcours vérifie que la saisie passe, et qu'une fin antérieure au
 * début est refusée : une irrigation qui finirait avant d'avoir commencé
 * fausserait tous les cumuls.
 */
test('une irrigation passée se saisit, et une fin antérieure au début est refusée', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  await attendreLaPageIrrigation(page);

  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo);
  // Les irrigations se saisissent sur la page des arrosages (3.8).
  await attendreLaPageIrrigation(page, 'arrosages');

  await page.getByRole('tab', { name: /^Déjà réalisée/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage);

  const enregistrer = page.getByRole('button', { name: 'Enregistrer l’irrigation réalisée' });
  const volumeEstime = page.locator('.irrigation-preview dl > div').filter({ hasText: 'Volume estimé' }).locator('dd');

  // D'abord le cas refusé : une fin placée avant le début. L'écran ne laisse
  // même pas soumettre, ce qui vaut mieux qu'un message après coup.
  await page.getByLabel('Début réel').fill(horodatageLocal(-60, reference));
  await page.getByLabel('Fin réelle').fill(horodatageLocal(-120, reference));
  await expect(enregistrer).toBeDisabled();
  // Sans durée lisible, le volume est inconnu, jamais « 0 L » (D-003, point
  // ouvert 45).
  await expect(volumeEstime).toHaveText('Inconnu — vérifiez le début et la fin');
  await verifierLEtape(page, journal, 'fin antérieure au début refusée');

  // Un début vidé, comme pendant la frappe au clavier d'une date, ne ferme
  // pas la page : l'aperçu retombe sur maintenant (point ouvert 44).
  await page.getByLabel('Début réel').fill('');
  await expect(enregistrer).toBeDisabled();
  await expect(volumeEstime).toHaveText('Inconnu — vérifiez le début et la fin');
  await expect(page.getByRole('heading', { level: 1, name: 'Arrosages' })).toBeVisible();
  await page.getByLabel('Début réel').fill(horodatageLocal(-60, reference));
  await verifierLEtape(page, journal, 'début vidé sans fermer la page');

  // Puis la saisie correcte : une demi-heure d'irrigation, terminée il y a une demi-heure.
  await page.getByLabel('Fin réelle').fill(horodatageLocal(-30, reference));
  await soumettreIrrigation(page, 'Enregistrer l’irrigation réalisée', 'parcours saisie');

  // Une irrigation passée est archivée d'emblée, elle ne passe jamais « en cours ».
  await expect(page.getByLabel('Irrigations en cours').filter({ hasText: materiel })).toHaveCount(0);
  await verifierLEtape(page, journal, 'irrigation passée enregistrée');
});
