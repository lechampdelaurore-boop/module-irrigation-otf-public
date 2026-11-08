import { expect, test, type Locator, type Page } from '@playwright/test';
import { verifierLaSurfaceMouillee } from './support/materiel.ts';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P8 : poser, déplacer puis retirer une aspersion sur le plan
 * (`docs/browser-journeys-contract.md`).
 *
 * Le placement décide quelles planches sont arrosées : c'est lui qui relie un
 * matériel au plan de la ferme, et donc à la chaîne hydraulique de la
 * faisabilité. C'était le dernier écran sans filet, relevé par la recette 3.4.
 *
 * Il éprouve aussi ce qu'aucun autre parcours ne touche : l'ancrage **entre
 * deux planches**, propre à l'aspersion, et la portée qui décide seule des
 * planches atteintes — les planches couvertes ne sont pas enregistrées, elles
 * se déduisent de l'ancrage et du profil à chaque calcul.
 */

/** Portée courte : elle atteint les voisines immédiates, à 0,6 m, et pas au-delà. */
const PROFIL = [
  { distance: '0', debit: '12' },
  { distance: '1', debit: '6' },
];

test('une aspersion se pose entre deux planches, se déplace, puis se retire', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page);

  const materiel = `Rampe ${testInfo.project.name}`;
  const reglage = `Portée ${testInfo.project.name}`;
  await creerUneAspersion(page, materiel);
  await ajouterLeReglage(page, materiel, reglage);
  await verifierLEtape(page, journal, 'aspersion créée avec sa portée');

  const carte = page.locator('.equipment-section article').filter({ hasText: materiel });
  const contribution = new RegExp(`${materiel} \\(${reglage}\\)`);

  await poserEntre(page, materiel, reglage, 'N01', 'N02');
  await expect(carte).toContainText('Posé entre N01 et N02 depuis le');
  await expect(planche(page, 'N01')).toHaveAttribute('title', contribution);
  await expect(planche(page, 'N02')).toHaveAttribute('title', contribution);
  // La portée s'arrête à 1 m : N03, dont le centre est à 1,8 m de l'ancrage,
  // reste sèche. C'est le profil qui décide, pas une liste de planches.
  await expect(planche(page, 'N03')).not.toHaveAttribute('title', contribution);
  // Le débit du matériel se calcule sur la surface mouillée par l'aspersion :
  // N01 et N02 font 30 m × 0,75 m avec un passe-pied de 0,45 m, soit 36 m²
  // chacune, à 8,4 mm/h au centre (docs/wetted-surface-contract.md, D-022).
  await expect(page.locator('.coverage-equipment-list button').filter({ hasText: materiel })).toContainText('604,8 L/h');
  await verifierLEtape(page, journal, 'aspersion posée entre N01 et N02');
  // La surface mouillée se lit dans les besoins, qui ont leur page (3.8).
  await attendreLaPageIrrigation(page, 'besoins');
  await verifierLaSurfaceMouillee(page, 'N01', '36 m²', 'aspersion, planche et passe-pied');
  await verifierLEtape(page, journal, 'surface mouillée de l’aspersion');
  await attendreLaPageIrrigation(page, 'materiel');

  await poserEntre(page, materiel, reglage, 'N02', 'N03');
  await expect(planche(page, 'N01')).not.toHaveAttribute('title', contribution);
  await expect(planche(page, 'N02')).toHaveAttribute('title', contribution);
  await expect(planche(page, 'N03')).toHaveAttribute('title', contribution);
  await verifierLEtape(page, journal, 'aspersion déplacée entre N02 et N03');

  // Archiver alors que le matériel est encore posé : le compteur « posé »
  // ne doit plus le compter, et l'écran doit annoncer un succès — il annonçait
  // « Ce matériel est introuvable » alors que l'archivage avait lieu
  // (`db/write-result.ts`).
  const posesAvant = await compterLesPoses(page);
  await archiver(page, materiel);
  await expect(page.locator('.equipment-section')).not.toContainText('Ce matériel est introuvable');
  await expect
    .poll(() => compterLesPoses(page), {
      message: 'un matériel archivé ne compte plus comme posé',
      timeout: 20_000,
    })
    .toBe(posesAvant - 1);
  await verifierLEtape(page, journal, 'matériel archivé');

  await restaurer(page, materiel);
  await expect(carte).toContainText('Posé entre N02 et N03');
  await verifierLEtape(page, journal, 'matériel restauré');

  // Retirer, c'est stocker (2.11) : la carte le dit, et propose « Reposer ».
  await retirerLaPosition(page, materiel);
  await expect(carte).toContainText('Stocké depuis le');
  await expect(carte.getByRole('button', { name: 'Reposer' })).toBeVisible();
  for (const nom of ['N01', 'N02', 'N03']) {
    await expect(planche(page, nom)).not.toHaveAttribute('title', contribution);
  }
  await verifierLEtape(page, journal, 'position retirée');
});

function planche(page: Page, nom: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Planche ${nom},`) });
}

async function creerUneAspersion(page: Page, nom: string): Promise<void> {
  const fiche = page.locator('dialog[open], [role=dialog]').filter({ hasText: 'Ajouter un matériel' });
  // Premier clic du parcours : la fenêtre n'existe que sous React, elle prouve
  // donc que la page répond (docs/browser-journeys-contract.md).
  await ouvrirParClic(page.getByRole('button', { name: 'Ajouter un matériel' }), fiche);
  await fiche.getByLabel('Nom du matériel').fill(nom);
  await fiche.locator('label').filter({ hasText: 'Aspersion' }).click();
  await expect(fiche.getByRole('radio', { name: /Aspersion/ })).toBeChecked();
  await fiche.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.locator('.equipment-section article').filter({ hasText: nom })).toContainText('Aspersion');
}

async function ajouterLeReglage(page: Page, materiel: string, reglage: string): Promise<void> {
  const carte = page.locator('.equipment-section article').filter({ hasText: materiel });
  await carte.getByLabel(`Actions pour ${materiel}`).click();
  await carte.getByRole('menuitem', { name: 'Configurer les réglages' }).click();
  const reglages = page.locator('dialog[open], [role=dialog]').filter({ hasText: materiel });
  await expect(reglages).toBeVisible();
  const nouveau = page.locator('dialog[open], [role=dialog]').filter({ hasText: 'Nouveau réglage' });
  await reglages.getByRole('button', { name: 'Ajouter un réglage' }).click();
  await expect(nouveau).toBeVisible();
  await nouveau.getByLabel('Nom du réglage').fill(reglage);

  const distances = nouveau.getByLabel('Côté gauche, distance en mètres');
  const debits = nouveau.getByLabel('Côté gauche, débit en millimètres par heure');
  for (const [index, point] of PROFIL.entries()) {
    if (await distances.nth(index).count() === 0) {
      await nouveau.getByRole('button', { name: '+ Ajouter une distance' }).click();
    }
    await distances.nth(index).fill(point.distance);
    await debits.nth(index).fill(point.debit);
  }
  await nouveau.getByRole('button', { name: 'Ajouter le réglage' }).click();
  await expect(reglages).toContainText(reglage);
  await reglages.getByRole('button', { name: 'Fermer' }).click();
  await expect(reglages).toBeHidden();
}

/** Ancre le matériel sur le trait entre deux planches, et enregistre. */
async function poserEntre(page: Page, materiel: string, reglage: string, avant: string, apres: string): Promise<void> {
  const carte = page.locator('.equipment-section article').filter({ hasText: materiel });
  await carte.getByRole('button', { name: /^(Placer|Déplacer)$/ }).click();
  await expect(page.getByText('Cliquez sur une planche ou sur le trait entre deux planches.')).toBeVisible();
  await page.getByLabel('Réglage utilisé').selectOption({ label: reglage });
  await page.getByRole('button', { name: `Placer entre ${avant} et ${apres}` }).click();
  // Exact : l'historique des poses écrit aussi « entre N01 et N02 ».
  await expect(page.getByText(`Entre ${avant} et ${apres}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer la position' }).click();
  await expect(page.getByText('Cliquez sur une planche ou sur le trait entre deux planches.')).toBeHidden({ timeout: 20_000 });
}

async function compterLesPoses(page: Page): Promise<number> {
  const resume = page.getByLabel('Résumé de l’inventaire');
  const texte = await resume.innerText();
  const trouve = texte.replace(/\s+/g, ' ').match(/(\d+) posé/);
  return trouve ? Number(trouve[1]) : -1;
}

async function archiver(page: Page, materiel: string): Promise<void> {
  const carte = page.locator('.equipment-section article').filter({ hasText: materiel });
  await carte.getByLabel(`Actions pour ${materiel}`).click();
  page.once('dialog', (fenetre) => void fenetre.accept());
  await carte.getByRole('menuitem', { name: 'Archiver' }).click();
  await expect(page.locator('.equipment-section')).toContainText('archivé', { timeout: 20_000 });
}

async function restaurer(page: Page, materiel: string): Promise<void> {
  const archives = page.locator('.archived-equipment');
  await archives.getByRole('button', { name: /Matériels archivés/ }).click();
  const carte = archives.locator('article').filter({ hasText: materiel });
  await carte.getByLabel(`Actions pour ${materiel}`).click();
  await carte.getByRole('menuitem', { name: 'Restaurer' }).click();
  await expect(page.locator('.equipment-section article').filter({ hasText: materiel }).first())
    .toContainText('Aspersion', { timeout: 20_000 });
}

async function retirerLaPosition(page: Page, materiel: string): Promise<void> {
  const carte = page.locator('.equipment-section article').filter({ hasText: materiel });
  await carte.getByRole('button', { name: 'Déplacer' }).click();
  await expect(page.getByText('Cliquez sur une planche ou sur le trait entre deux planches.')).toBeVisible();
  // Le bouton de la barre de placement ouvre la même confirmation que celui
  // de la carte, la date du retrait proposée à maintenant (2.11).
  await page.getByRole('button', { name: 'Retirer (stocker)', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: `Retirer et stocker ${materiel}` });
  await expect(confirmation.getByLabel('Date du retrait')).not.toHaveValue('');
  await confirmation.getByRole('button', { name: 'Retirer et stocker', exact: true }).click();
  await expect(confirmation).toBeHidden({ timeout: 20_000 });
  // Le panneau se referme au succès. Il restait ouvert sur « Aucune position
  // enregistrée » tant que le dépôt lisait `meta.changes` : la ligne partait
  // et l'écran annonçait l'échec (voir `db/write-result.ts`).
  await expect(page.getByText('Cliquez sur une planche ou sur le trait entre deux planches.')).toBeHidden({ timeout: 20_000 });
}
