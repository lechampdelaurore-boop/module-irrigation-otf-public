import { expect, test, type Page } from '@playwright/test';
import { annulerDepuisLeMenu, choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P11 : retirer un goutte-à-goutte, le stocker puis le reposer, à des
 * dates choisies (docs/browser-journeys-contract.md, sous-tranche 2.11,
 * docs/equipment-placement-periods-contract.md).
 *
 * Sur la ferme, une ligne se retire quand une culture finit et se repose à la
 * suivante, souvent consignée après coup. Le parcours éprouve que la carte dit
 * l'état en clair, qu'un retrait daté dans le futur est refusé avec son motif,
 * qu'une irrigation planifiée sur le matériel stocké reste affichée mais ne
 * démarre pas, que la saisie après coup ne propose le matériel qu'aux heures où
 * il était posé, et que la pose fermée reste lisible dans l'historique.
 */
test('un goutte-à-goutte se retire à une date choisie, reste stocké, puis se repose', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  await attendreLaPageIrrigation(page);

  const { materiel, reglage, planche } = await preparerMaterielArrosant(page, testInfo);
  const carte = page.locator('.equipment-section article').filter({ hasText: materiel });
  await expect(carte).toContainText(`Posé sur ${planche} depuis le 1 janvier à 0 h 00`);

  // Une irrigation planifiée demain, sur le matériel encore posé, depuis la
  // page des arrosages (3.8).
  await attendreLaPageIrrigation(page, 'arrosages');
  await page.getByRole('tab', { name: /^Planifier/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage);
  await page.getByLabel('Date et heure de début').fill(horodatageLocal(24 * 60, reference));
  await page.getByRole('button', { name: 'Planifier l’irrigation' }).click();
  const prevue = page.locator('.upcoming-irrigations article').filter({ hasText: materiel });
  await expect(prevue).toHaveCount(1);
  await expect(prevue.getByRole('button', { name: 'Démarrer maintenant' })).toBeEnabled();
  await verifierLEtape(page, journal, 'matériel posé, irrigation planifiée demain');

  // Le retrait se confirme, avec sa date, sur la fiche du matériel. Une date
  // dans le futur est refusée, et la fenêtre dit pourquoi sans se refermer.
  await attendreLaPageIrrigation(page, 'materiel');
  const stockesAvant = await compter(page, 'stocké');
  await carte.getByRole('button', { name: `Retirer et stocker ${materiel}` }).click();
  const confirmation = page.getByRole('dialog', { name: `Retirer et stocker ${materiel}` });
  const dateDuRetrait = confirmation.getByLabel('Date du retrait');
  await dateDuRetrait.fill(horodatageLocal(120, reference));
  await confirmation.getByRole('button', { name: 'Retirer et stocker', exact: true }).click();
  await expect(confirmation.getByRole('alert')).toContainText('ne peut pas être dans le futur');
  await verifierLEtape(page, journal, 'retrait dans le futur refusé');

  const retrait = horodatageLocal(-60, reference);
  await dateDuRetrait.fill(retrait);
  await confirmation.getByRole('button', { name: 'Retirer et stocker', exact: true }).click();
  await expect(confirmation).toBeHidden({ timeout: 20_000 });
  await expect(carte).toContainText(`Stocké depuis le ${enClair(retrait)}`);
  await expect(carte.getByRole('button', { name: 'Reposer' })).toBeVisible();
  await expect
    .poll(() => compter(page, 'stocké'), { message: 'le compteur compte le matériel stocké', timeout: 20_000 })
    .toBe(stockesAvant + 1);
  await verifierLEtape(page, journal, 'matériel retiré et stocké');

  // L'irrigation planifiée reste, signalée, et ne démarre pas (règle 13).
  await attendreLaPageIrrigation(page, 'arrosages');
  await expect(prevue).toContainText(`Matériel stocké depuis le ${enClair(retrait)}`);
  await expect(prevue.getByRole('button', { name: 'Démarrer maintenant' })).toBeDisabled();
  // Le formulaire ne le propose plus, et ne l'affiche pas : un matériel se
  // repose depuis la page du matériel (règle 11, précision P37).
  await page.getByRole('tab', { name: /^Irriguer maintenant/ }).click();
  await expect(optionDuMateriel(page, materiel)).toHaveCount(0);
  await expect(page.getByLabel('Matériel stocké')).toHaveCount(0);
  await verifierLEtape(page, journal, 'irrigation planifiée signalée, matériel non sélectionnable');

  // Reposé au même endroit une demi-heure après le retrait : « Reposer », sur
  // sa fiche, ouvre l'éditeur sur la planche de la dernière pose ; la date se
  // reporte dans le passé.
  await attendreLaPageIrrigation(page, 'materiel');
  await carte.getByRole('button', { name: 'Reposer' }).click();
  await expect(page.getByText('Cliquez sur chaque planche alimentée par ce matériel.')).toBeVisible();
  await expect(page.getByText('1 planche sélectionnée')).toBeVisible();
  const repose = horodatageLocal(-30, reference);
  await page.getByLabel('Date de repose').fill(repose);
  await page.getByRole('button', { name: 'Enregistrer la position' }).click();
  await expect(page.getByText('Cliquez sur chaque planche alimentée par ce matériel.')).toBeHidden({ timeout: 20_000 });
  await expect(carte).toContainText(`Posé sur ${planche} depuis le ${enClair(repose)}`);
  await verifierLEtape(page, journal, 'matériel reposé au même endroit');

  // La pose fermée reste lisible (règle 8).
  const historique = carte.locator('details').filter({ hasText: 'Historique des poses (1)' });
  await historique.locator('summary').click();
  await expect(historique.locator('li')).toHaveText(
    `Du 1 janvier à 0 h 00 au ${enClair(retrait)} · ${planche} · ${reglage}`,
  );
  await verifierLEtape(page, journal, 'historique des poses');

  // Reposé, le matériel peut de nouveau démarrer l'irrigation planifiée.
  await attendreLaPageIrrigation(page, 'arrosages');
  await expect(prevue).not.toContainText('Matériel stocké');
  await expect(prevue.getByRole('button', { name: 'Démarrer maintenant' })).toBeEnabled();
  await verifierLEtape(page, journal, 'irrigation planifiée de nouveau possible');

  // Saisie après coup (règle 12) : le matériel n'est proposé qu'à une heure de
  // début où il était posé.
  await page.getByRole('tab', { name: /^Déjà réalisée/ }).click();
  await page.getByLabel('Début réel').fill(horodatageLocal(-45, reference));
  await expect(optionDuMateriel(page, materiel)).toHaveCount(0);
  await page.getByLabel('Début réel').fill(horodatageLocal(-90, reference));
  await expect(optionDuMateriel(page, materiel)).toHaveCount(1);
  await verifierLEtape(page, journal, 'saisie après coup selon la pose de l’heure de début');

  // Remise en état : l'irrigation planifiée est annulée.
  await annulerDepuisLeMenu(page, prevue);
  await expect(prevue).toHaveCount(0);
  await verifierLEtape(page, journal, 'irrigation planifiée annulée');
});

/** Le compteur de l'inventaire, « posé » ou « stocké ». */
async function compter(page: Page, etat: 'posé' | 'stocké'): Promise<number> {
  const texte = await page.getByLabel('Résumé de l’inventaire').innerText();
  // Pas de `\b` après « é » : en JavaScript, une lettre accentuée n'est pas
  // un caractère de mot, et « 1 stocké » en fin de texte ne correspondrait pas.
  const trouve = texte.replace(/\s+/g, ' ').match(new RegExp(`(\\d+) ${etat}`));
  return trouve ? Number(trouve[1]) : 0;
}

/** L'option du matériel dans la liste du formulaire d'irrigation. */
function optionDuMateriel(page: Page, materiel: string) {
  return page.locator('.irrigation-form-fields select option').filter({ hasText: materiel });
}

/**
 * Un horodatage saisi, tel que l'écran l'écrit : « 29 octobre à 21 h 30 ».
 * Lu sur la saisie elle-même, et non recalculé depuis un instant, pour ne pas
 * dépendre du fuseau du processus qui joue le parcours.
 */
function enClair(horodatage: string): string {
  const [date, heure] = horodatage.split('T');
  const [annee, mois, jour] = date.split('-').map(Number);
  const nomDuMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(annee, mois - 1, jour)));
  const [heures, minutes] = heure.split(':');
  return `${jour} ${nomDuMois} à ${Number(heures)} h ${minutes}`;
}
