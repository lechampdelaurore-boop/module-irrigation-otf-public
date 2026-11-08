import { expect, test } from '@playwright/test';
import { annulerDepuisLeMenu, choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P2 : planifier puis annuler (docs/browser-journeys-contract.md).
 *
 * Une irrigation planifiée engage de l'eau avant d'avoir coulé : elle pèse sur
 * la limite journalière et sur la faisabilité. Son annulation doit donc effacer
 * cet engagement, sans rien laisser dans les irrigations réalisées.
 */
test('une irrigation planifiée apparaît dans les irrigations à venir, puis son annulation ne laisse aucune trace', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  await attendreLaPageIrrigation(page);

  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo);
  // Les irrigations se planifient sur la page des arrosages (3.8).
  await attendreLaPageIrrigation(page, 'arrosages');

  await page.getByRole('tab', { name: /^Planifier/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage);
  const planifier = page.getByRole('button', { name: 'Planifier l’irrigation' });

  // Sans date de début, rien ne se planifie : le bouton reste grisé, comme
  // dans « Déjà réalisée » (point ouvert 46).
  await page.getByLabel('Date et heure de début').fill('');
  await expect(planifier).toBeDisabled();
  await verifierLEtape(page, journal, 'planification sans date refusée');

  // Demain, même heure : une date future, sans dépendre du jour où le parcours tourne.
  await page.getByLabel('Date et heure de début').fill(horodatageLocal(24 * 60, reference));
  await expect(planifier).toBeEnabled();
  await verifierLEtape(page, journal, 'formulaire de planification');

  await planifier.click();
  const aVenir = page.locator('.upcoming-irrigations');
  const fiche = aVenir.locator('article').filter({ hasText: materiel });
  await expect(fiche).toHaveCount(1);
  await verifierLEtape(page, journal, 'irrigation planifiée');

  // L'annulation, rangée dans le menu « … » de la ligne (lot 3, F45), demande
  // confirmation : un parcours répond comme un utilisateur.
  await annulerDepuisLeMenu(page, fiche);

  // Ce parcours ne juge que ce qu'il a créé : d'autres parcours peuvent avoir
  // laissé leurs propres irrigations à venir ou à terminer sur la même base.
  await expect(fiche).toHaveCount(0);
  // Rien n'a coulé non plus : une planification annulée ne laisse aucune irrigation en cours.
  await expect(page.getByLabel('Irrigations en cours').filter({ hasText: materiel })).toHaveCount(0);
  await verifierLEtape(page, journal, 'planification annulée');
});
