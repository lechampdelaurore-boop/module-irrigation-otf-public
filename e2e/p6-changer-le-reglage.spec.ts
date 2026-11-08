import { expect, test } from '@playwright/test';
import { preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P6 : changer le réglage appliqué sans déplacer le matériel
 * (docs/equipment-setting-change-contract.md).
 *
 * Sur la ferme, on ne déplace pas une rampe pour changer sa buse. Le parcours
 * éprouve que les deux gestes sont bien séparés : la liste « Réglage appliqué »
 * de la fiche change l'apport des planches sans jamais ouvrir le plan.
 */
test('la liste « Réglage appliqué » change l’apport sans passer par le placement', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page);

  const { materiel, planche } = await preparerMaterielArrosant(page, testInfo, {
    apportMmParHeure: 10,
  });
  const carte = page.locator('.equipment-section article').filter({ hasText: materiel });
  const surLaPlanche = page.getByRole('button', { name: new RegExp(`^Planche ${planche},`) });
  // La planche porte aussi l'apport des autres parcours : c'est la contribution
  // de ce matériel-ci, que la bulle détaille nommément, qui est éprouvée.
  const contribution = (mm: number) => new RegExp(`${materiel} \\([^)]*\\) : ${mm} mm/h`);
  await expect(surLaPlanche).toHaveAttribute('title', contribution(10));
  await verifierLEtape(page, journal, 'matériel posé à 10 mm/h');

  // Un seul réglage ne laisse aucun choix : la liste n'a pas lieu d'être.
  await expect(carte.getByLabel('Réglage appliqué')).toHaveCount(0);

  await carte.getByLabel(`Actions pour ${materiel}`).click();
  await carte.getByRole('menuitem', { name: 'Configurer les réglages' }).click();
  const reglages = page.locator('dialog[open], [role=dialog]').filter({ hasText: materiel });
  await expect(reglages).toBeVisible();
  const nouveau = page.locator('dialog[open], [role=dialog]').filter({ hasText: 'Nouveau réglage' });
  await reglages.getByRole('button', { name: 'Ajouter un réglage' }).click();
  await expect(nouveau).toBeVisible();
  await nouveau.getByLabel('Nom du réglage').fill('Plein débit');
  await nouveau.getByLabel(/Apport uniforme/).fill('25');
  await nouveau.getByRole('button', { name: 'Ajouter le réglage' }).click();
  await expect(reglages).toContainText('Plein débit');
  await reglages.getByRole('button', { name: 'Fermer' }).click();
  await expect(reglages).toBeHidden();
  await verifierLEtape(page, journal, 'second réglage ajouté');

  // Le geste tient en une liste déroulante, sur la fiche : à aucun moment le
  // plan ne s'ouvre.
  const choix = carte.getByLabel('Réglage appliqué');
  await expect(choix).toBeVisible();
  await choix.selectOption({ label: 'Plein débit' });
  await expect(surLaPlanche).toHaveAttribute('title', contribution(25), { timeout: 10_000 });
  await expect(page.getByText('Cliquez sur chaque planche alimentée par ce matériel.')).toHaveCount(0);
  await expect(carte).toContainText(`Posé sur ${planche} depuis le`);
  await verifierLEtape(page, journal, 'réglage appliqué changé sans déplacement');

  // La décision survit au rechargement : elle est en base, pas dans l'écran.
  await page.reload();
  await attendreLaPageIrrigation(page);
  const apres = page.locator('.equipment-section article').filter({ hasText: materiel });
  await expect(apres.getByLabel('Réglage appliqué').locator('option:checked'))
    .toHaveText('Plein débit');
  await expect(page.getByRole('button', { name: new RegExp(`^Planche ${planche},`) }))
    .toHaveAttribute('title', contribution(25));
});
