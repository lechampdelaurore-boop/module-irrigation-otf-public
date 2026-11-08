import { expect, test, type Locator, type Page } from '@playwright/test';
import { attendreLeChoixDesFonctionnalites, caseDeLaFonctionnalite, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import { attendreLaPagePrete, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P25 : le calculateur d'irrigation (3.8 bis,
 * docs/irrigation-calculator-contract.md, sections 4, 5, 6, 9 et 11).
 *
 * Sur une ferme neuve, propre au parcours et à la largeur, qui coche le
 * calculateur (il entraîne le matériel) : un goutte-à-goutte reçoit un
 * réglage calculé depuis l'exemple AmnonDrip, deux lignes sur une planche de
 * 0,75 m, 14,22 mm/h « calculé » ; « Voir le calcul » montre la formule ; rien
 * n'est enregistré avant « Ajouter le réglage ». La valeur retouchée à la main
 * redevient « saisi », la case « mesuré » la rend « mesuré ». Une aspersion
 * reçoit le profil en cône de l'exemple 427 : 6,1 mm/h sous la rampe,
 * « estimé ». La ferme de démonstration n'est pas touchée.
 */

async function ouvrirLesReglages(page: Page, nom: string, nature: 'Goutte-à-goutte' | 'Aspersion'): Promise<Locator> {
  const fiche = page.locator('dialog[open], [role=dialog]').filter({ hasText: 'Ajouter un matériel' });
  await ouvrirParClic(page.getByRole('button', { name: 'Ajouter un matériel' }), fiche);
  await fiche.getByLabel('Nom du matériel').fill(nom);
  await fiche.locator('label').filter({ hasText: nature }).click();
  await fiche.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const carte = page.locator('.equipment-section article').filter({ hasText: nom });
  await expect(carte).toContainText(nature);
  await carte.getByLabel(`Actions pour ${nom}`).click();
  await carte.getByRole('menuitem', { name: 'Configurer les réglages' }).click();
  // Le titre suit la vue (liste, réglage, calcul) : le nom du matériel ne
  // reste affiché que sur la liste, d'où le repère par la classe du dialogue.
  const reglages = page.locator('.settings-dialog');
  await expect(reglages.getByRole('heading', { name: nom })).toBeVisible();
  return reglages;
}

test('le calculateur remplit un réglage depuis le matériel, montre son calcul et l’étiquette', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'calculateur');

  // La case du calculateur coche le matériel dont il a besoin.
  await page.goto('/irrigation');
  await attendreLeChoixDesFonctionnalites(page);
  await expect(page.locator('li').filter({ has: caseDeLaFonctionnalite(page, 'Calculateur d’irrigation') }))
    .toContainText('Cochera aussi Matériel et placement, dont elle a besoin.');
  await caseDeLaFonctionnalite(page, 'Calculateur d’irrigation').check();
  await expect(caseDeLaFonctionnalite(page, 'Matériel et placement')).toBeChecked();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'materiel');
  await verifierLEtape(page, journal, 'calculateur coché');

  // Goutte-à-goutte : un nouveau réglage, calculé depuis l'exemple.
  const reglages = await ouvrirLesReglages(page, 'Goutte P25', 'Goutte-à-goutte');
  await reglages.getByRole('button', { name: 'Ajouter un réglage' }).click();
  const calculer = reglages.getByRole('button', { name: 'Calculer depuis le matériel' });
  await verifierCibleTactile(calculer, 'Le bouton « Calculer depuis le matériel »');
  await expect(reglages.locator('.setting-provenance-block')).toContainText('saisi');
  await calculer.click();
  await expect(reglages.getByRole('heading', { name: 'Calculer depuis le matériel' })).toBeVisible();
  await reglages.getByLabel('Partir d’un exemple').selectOption({ label: 'NaanDanJain AmnonDrip PC AS Ø16, 1,6 l/h tous les 30 cm' });
  await expect(reglages.locator('.calculator-example-source')).toContainText('Fiche technique longue NaanDanJain AmnonDrip');
  await expect(reglages.getByLabel('Débit de la fiche')).toHaveValue('1,6');
  const resultat = reglages.locator('.calculator-result');
  await expect(resultat).toContainText('Il manque : nombre de lignes, largeur de la planche.');
  // Sans résultat, pas d'étiquette ; l'unité d'un champ reste collée à son bord droit.
  await expect(resultat.locator('.setting-provenance')).toHaveCount(0);
  const caseDuDebit = reglages.getByLabel('Débit de la fiche').locator('..');
  const [boite, unite] = await Promise.all([caseDuDebit.boundingBox(), caseDuDebit.locator('strong').boundingBox()]);
  expect(boite && unite && boite.x + boite.width - (unite.x + unite.width)).toBeLessThan(2);
  const utiliser = reglages.getByRole('button', { name: 'Utiliser ce résultat' });
  await expect(utiliser).toBeDisabled();
  await reglages.getByLabel('Nombre de lignes').fill('2');
  await reglages.getByLabel('Largeur de la planche').fill('0,75');
  await expect(resultat).toContainText('14,22 mm/h reçus par la planche');
  await expect(resultat.locator('.setting-provenance')).toHaveText('calculé');
  await expect(resultat).toContainText('Eau pompée par mètre de planche');
  await reglages.getByText('Voir le calcul').click();
  await expect(resultat).toContainText('mm/h théorique = 2 × (1,6 ÷ 0,3) ÷ 0,75');
  await verifierCibleTactile(utiliser, 'Le bouton « Utiliser ce résultat »');
  await verifierLEtape(page, journal, 'calcul du goutte-à-goutte');

  // « Utiliser ce résultat » remplit le formulaire ; rien n'est encore enregistré.
  await utiliser.click();
  await expect(reglages.getByLabel('Nom du réglage')).toHaveValue('2 lignes · 14,22 mm/h');
  await expect(reglages.getByLabel(/Apport uniforme/)).toHaveValue('14.22');
  await expect(reglages.locator('.setting-provenance-block')).toContainText('calculé');
  await reglages.getByRole('button', { name: 'Ajouter le réglage' }).click();
  const carte = reglages.locator('.setting-card').filter({ hasText: '2 lignes · 14,22 mm/h' });
  await expect(carte).toContainText('14,22 mm/h par planche');
  await expect(carte.locator('.setting-provenance')).toHaveText('calculé');
  await verifierLEtape(page, journal, 'réglage calculé enregistré');

  // Retoucher la valeur à la main : « saisi » ; la case du pluviomètre : « mesuré ».
  await carte.getByRole('button', { name: 'Modifier' }).click();
  await reglages.getByLabel(/Apport uniforme/).fill('8');
  await expect(reglages.locator('.setting-provenance-block')).toContainText('saisi');
  await reglages.getByLabel('Ces valeurs viennent de mes mesures au pluviomètre').check();
  await expect(reglages.locator('.setting-provenance-block')).toContainText('mesuré');
  await reglages.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(carte.locator('.setting-provenance')).toHaveText('mesuré');
  await expect(carte).toContainText('8 mm/h par planche');
  await reglages.getByRole('button', { name: 'Fermer' }).click();
  await expect(reglages).toBeHidden();
  await verifierLEtape(page, journal, 'réglage retouché puis mesuré');

  // Aspersion : le profil en cône de l'exemple 427, estimé.
  const aspersion = await ouvrirLesReglages(page, 'Rampe P25', 'Aspersion');
  await aspersion.getByRole('button', { name: 'Ajouter un réglage' }).click();
  await aspersion.getByRole('button', { name: 'Calculer depuis le matériel' }).click();
  await aspersion.locator('label').filter({ hasText: 'Profil en cône' }).click();
  await aspersion.getByLabel('Partir d’un exemple').selectOption({ label: 'NaanDanJain 427 B-AG, buse orange 2,8 mm' });
  await aspersion.getByLabel('Espacement', { exact: true }).fill('6,4');
  const cone = aspersion.locator('.calculator-result');
  await expect(cone).toContainText('6,1 mm/h sous la rampe');
  await expect(cone.locator('.setting-provenance')).toHaveText('estimé');
  await expect(cone.getByRole('img', { name: /Profil en cône/ })).toBeVisible();
  await expect(cone).toContainText('Le cône ne modélise ni vent, ni dérive, ni évaporation.');
  await aspersion.getByRole('button', { name: 'Utiliser ce résultat' }).click();
  await expect(aspersion.getByRole('checkbox', { name: /Même courbe à gauche et à droite/ })).toBeChecked();
  await aspersion.getByRole('button', { name: 'Ajouter le réglage' }).click();
  const carteCone = aspersion.locator('.setting-card').filter({ hasText: 'Cône' });
  await expect(carteCone).toContainText('Portée : 11,00 m à gauche · 11,00 m à droite');
  await expect(carteCone.locator('.setting-provenance')).toHaveText('estimé');
  await verifierLEtape(page, journal, 'profil en cône estimé enregistré');
});
