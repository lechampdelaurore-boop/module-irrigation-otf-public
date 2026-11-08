import { expect, test, type Locator } from '@playwright/test';
import { horodatageLocal } from './support/materiel.ts';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P5 : relever le compteur du forage et mettre à jour son débit
 * (docs/resource-flow-contract.md).
 *
 * C'est l'exemple du cahier des charges, joué dans un vrai navigateur : deux
 * relevés à vingt-quatre heures d'intervalle, seize heures d'arrêt, neuf mètres
 * cubes produits. Le débit en fonctionnement doit valoir 1,125 m³/h, et le
 * bouton doit porter cette valeur jusqu'à la fiche de la ressource.
 *
 * Il éprouve ensuite les deux gestes que la recette 3.1 bis a réclamés le
 * 25 septembre 2026 : un relevé **refusé**, qui doit le dire sous le bouton
 * sans effacer la saisie, et un relevé **corrigé**, qui doit changer la mesure
 * sans toucher à la décision de débit déjà prise.
 */
test('deux relevés donnent 1,125 m³/h, le débit se met à jour, et un relevé se corrige', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  // Les ressources et leurs relevés ont leur page (3.8).
  await attendreLaPageIrrigation(page, 'ressources');

  const forage = `Forage ${testInfo.project.name}`;
  const ressources = page.locator('.water-asset-panel').filter({ hasText: 'Ressources' }).first();

  const creation = page.locator('.water-editor').filter({ hasText: 'Nouvelle ressource' });
  // Premier clic du parcours : la page peut ne pas encore répondre, on réessaie
  // (docs/browser-journeys-contract.md).
  await ouvrirParClic(ressources.getByRole('button', { name: '+ Ajouter' }), creation);
  await creation.getByLabel('Nom', { exact: true }).fill(forage);
  await creation.getByLabel('Débit nominal (m³/h)').fill('2');
  await creation.getByRole('button', { name: 'Enregistrer' }).click();

  const fiche = ressources.locator('.water-asset-card').filter({ hasText: forage });
  await expect(fiche).toHaveCount(1);
  await verifierLEtape(page, journal, 'ressource créée');

  await fiche.getByRole('button', { name: 'Relevés de débit' }).click();
  const panneau = page.getByRole('region', { name: new RegExp(`Relevés de débit — ${forage}`) });
  await expect(panneau).toBeVisible();

  // Premier relevé : vingt-cinq heures en arrière, pour que le second tombe à
  // vingt-quatre heures pile et que le calcul soit exact à la minute.
  await saisirReleve(panneau, horodatageLocal(-25 * 60, reference), '1240', '0', '0');
  await expect(panneau.getByText('Aucun relevé pour cette ressource.')).toHaveCount(0);

  // Second relevé : neuf mètres cubes plus tard, seize heures d'arrêt.
  await saisirReleve(panneau, horodatageLocal(-60, reference), '1249', '16', '0');

  const derniere = panneau.locator('.resource-flow-latest');
  await expect(derniere).toContainText('9 m³');
  await expect(derniere).toContainText('8 h');
  await expect(derniere).toContainText('1,125 m³/h', { timeout: 10_000 });
  // Le débit moyen sur la période, lui, inclut les seize heures d'arrêt.
  await expect(derniere).toContainText('0,375 m³/h');
  await verifierLEtape(page, journal, 'mesure affichée');

  // La référence passe de 2 à 1,125 m³/h, soit un écart assez large pour être
  // mis en évidence.
  await expect(derniere).toContainText('soit -44 %');
  await derniere.getByRole('button', { name: 'Mettre à jour le débit de la ressource' }).click();

  await expect(panneau.getByText('Cette mesure est déjà le débit de référence de la ressource.')).toBeVisible();
  await expect(fiche).toContainText('1,125 m³/h');
  await verifierLEtape(page, journal, 'débit de la ressource mis à jour');

  // Le volume produit est cumulé par mois : neuf mètres cubes, une mesure.
  const consommations = panneau.getByRole('region', { name: 'Volumes produits' });
  await expect(consommations).toContainText('9 m³');
  await expect(consommations).toContainText('Total affiché');
  await verifierLEtape(page, journal, 'volumes produits cumulés');

  // Un refus doit se voir là où le geste a eu lieu. Le message vit en haut de
  // la section « Ressources en eau », à six cents pixels du bouton : le porteur
  // ne le voyait pas, et l'index se vidait quand même, si bien que l'écran
  // paraissait n'avoir rien fait (recette 3.1 bis, 25 septembre 2026).
  await panneau.getByLabel('Date et heure du relevé').fill(horodatageLocal(-30, reference));
  await panneau.getByLabel('Index du compteur (m³)').fill('1');
  await panneau.getByRole('button', { name: 'Enregistrer le relevé' }).click();
  await expect(panneau.getByRole('alert')).toContainText(/inférieur au précédent/, { timeout: 15_000 });
  await expect(panneau.getByLabel('Index du compteur (m³)')).toHaveValue('1');
  await expect(panneau.locator('.resource-flow-history tbody tr')).toHaveCount(2);
  await verifierLEtape(page, journal, 'relevé refusé, saisie conservée');

  // Corriger un relevé : c'est une lecture, et une lecture fautive se corrige
  // (docs/resource-flow-contract.md). L'écran n'offrait que « Supprimer », ce
  // qui obligeait à ressaisir — et coupait le lien entre la décision de débit
  // et les relevés qui l'avaient produite.
  const ligneDuSecond = panneau.locator('.resource-flow-history tbody tr').first();
  await ligneDuSecond.getByRole('button', { name: 'Corriger' }).click();
  await expect(panneau.getByText(/^Correction du relevé du /)).toBeVisible();
  // L'index revient non arrondi : le tableau n'en montre qu'une décimale.
  await expect(panneau.getByLabel('Index du compteur (m³)')).toHaveValue('1249');
  await expect(panneau.getByLabel('Heures')).toHaveValue('16');

  // Une demi-heure plus tard : le temps de marche passe de 8 h à 8 h 30, et le
  // débit suit, sans qu'un cinquième relevé apparaisse.
  await panneau.getByLabel('Date et heure du relevé').fill(horodatageLocal(-30, reference));
  await panneau.getByRole('button', { name: 'Enregistrer la correction' }).click();
  await expect(panneau.getByRole('status').first()).toContainText('Le relevé a été corrigé.', { timeout: 15_000 });
  await expect(panneau.locator('.resource-flow-history tbody tr')).toHaveCount(2);
  await expect(derniere).toContainText('1,059 m³/h', { timeout: 15_000 });

  // La décision prise plus haut, elle, n'a pas bougé : la ressource porte
  // toujours 1,125 m³/h, et l'écran propose d'appliquer la nouvelle mesure.
  await expect(fiche).toContainText('1,125 m³/h');
  await expect(derniere).toContainText('La référence passerait de 1,125 m³/h à 1,059 m³/h');
  await verifierLEtape(page, journal, 'relevé corrigé, décision inchangée');

  await panneau.getByRole('button', { name: 'Fermer' }).click();
  await expect(panneau).toBeHidden();
});

async function saisirReleve(
  panneau: Locator,
  quand: string,
  index: string,
  heures: string,
  minutes: string,
): Promise<void> {
  await panneau.getByLabel('Date et heure du relevé').fill(quand);
  await panneau.getByLabel('Index du compteur (m³)').fill(index);
  await panneau.getByLabel('Heures').fill(heures);
  await panneau.getByLabel('Minutes').fill(minutes);
  const bouton = panneau.getByRole('button', { name: 'Enregistrer le relevé' });
  await expect(bouton).toBeEnabled();
  await bouton.click();
  // Le champ d'index se vide au succès, et seulement au succès : c'est le
  // signal propre à cette soumission-ci, comme pour les irrigations
  // (docs/browser-journeys-contract.md). Il se vidait autrefois dans tous les
  // cas, ce qui en faisait un signal vide de sens.
  await expect(panneau.getByLabel('Index du compteur (m³)')).toHaveValue('');
}
