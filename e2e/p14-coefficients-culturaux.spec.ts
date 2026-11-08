import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P14 : la page « Coefficients culturaux » (docs/crop-water-need-contract.md,
 * « L'écran », 5 quater, PR 3a). Depuis la 3.8, la correspondance des espèces
 * est dans Réglages et la table d'une culture sur la page « Besoin par
 * culture » ; le parcours lit la table après avoir tout retiré.
 *
 * Le plan de démonstration porte des carottes, de la mâche, des tomates et
 * des radis sur des planches, et des endives en bloc. Aucune espèce n'est
 * rattachée au départ : toutes sont dans la liste « sans référence Kc », sauf
 * les endives, sans planche. Le parcours rattache une espèce à une culture
 * de référence — la tomate à la tomate du CRIIAM sur ordinateur, la mâche à
 * la salade d'été par analogie sur téléphone —, la voit sortir de la liste,
 * pose une exception sur sa série, lit la table de la culture, puis retire
 * tout : la base revient à son état de départ pour l'autre largeur.
 *
 * Chaque espèce porte son dessin (3.8, précision P41) : en démonstration,
 * une feuille servie par le module, sans appel à Ouvre ta ferme.
 *
 * Ce qu'il ne prouve pas : la correspondance des espèces de la ferme réelle,
 * qui se saisit à la recette, sur le « vas-y » du porteur, ni la lecture des
 * dessins chez Ouvre ta ferme, que seul le site en ligne fait.
 */

const CAS = {
  ordinateur: { espece: 'Tomate', serie: 'Tomates du tunnel', culture: 'Tomate', analogie: false, attendu: 'Tomate' },
  telephone: { espece: 'Mâche', serie: 'Mâche d’automne', culture: "Salade d'été", analogie: true, attendu: "Salade d'été, par analogie" },
} as const;

test('une espèce se rattache à une culture de référence, sort de la liste « sans référence », reçoit une exception de série et se retire, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  const cas = CAS[testInfo.project.name as keyof typeof CAS];
  const journal = surveillerLaConsole(page);
  // La correspondance des espèces est dans Réglages, les cultures de
  // référence sur la page « Besoin par culture » (3.8, précision P3).
  await attendreLaPageIrrigation(page, 'reglages');

  const section = page.locator('section.crop-coefficients');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole('heading', { level: 2, name: 'Correspondance des espèces' })).toBeVisible();
  const sansReference = section.getByRole('list', { name: 'Espèces sans référence Kc' });
  await expect(sansReference).toContainText(cas.espece);
  await expect(sansReference).not.toContainText('Endive');
  await verifierLEtape(page, journal, 'correspondance des espèces affichée');

  // Chaque espèce porte le dessin de son espèce, servi par le module : celui
  // d'Ouvre ta ferme pour une ferme réelle, une feuille en démonstration
  // (3.8, précision P41).
  const dessin = section.locator('details.species-link-card summary .plant-vignette use').first();
  await expect(dessin).toHaveAttribute('href', /^\/irrigation\/especes\.svg\?ids=[a-z,-]+#[a-z-]+$/);
  const fichier = await page.request.get(((await dessin.getAttribute('href')) ?? '').split('#')[0]);
  expect(fichier.status()).toBe(200);
  expect(fichier.headers()['content-type']).toContain('image/svg+xml');
  expect(await fichier.text()).toContain('<symbol id=');

  // Rattacher l'espèce.
  const carte = section.locator('details.species-link-card').filter({ has: page.locator('summary strong', { hasText: new RegExp(`^${cas.espece}$`) }) });
  await expect(carte).toHaveCount(1);
  const formulaire = carte.getByRole('group', { name: `Rattachement de l’espèce ${cas.espece}` });
  await ouvrirParClic(carte.locator('summary').first(), formulaire);
  const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer' });
  // La carte s'ouvre sans React ; un choix fait avant que la page ne réponde
  // serait perdu. Choisir jusqu'à ce que le bouton s'active est une attente de
  // condition (docs/browser-journeys-contract.md).
  await expect(async () => {
    await formulaire.getByLabel('Culture de référence').selectOption({ value: '' });
    await formulaire.getByLabel('Culture de référence').selectOption({ label: cas.culture });
    await expect(enregistrer).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  if (cas.analogie) await formulaire.getByLabel(/Par analogie/).check();
  await verifierCibleTactile(enregistrer, 'Le bouton « Enregistrer » du rattachement');
  await enregistrer.click();
  await expect(section.getByRole('status')).toHaveText('Le rattachement de l’espèce est enregistré.');
  await expect(carte.locator('summary').first()).toContainText(cas.attendu);
  await expect(sansReference).not.toContainText(cas.espece);
  await verifierLEtape(page, journal, 'espèce rattachée');

  // Une exception sur sa série : sans référence.
  await carte.locator('details.species-exceptions > summary').click();
  const exception = carte.getByRole('group', { name: `Exception de la série ${cas.serie}` });
  await exception.getByLabel('Culture de référence').selectOption({ label: 'Sans référence Kc' });
  await exception.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(section.getByRole('status')).toHaveText('L’exception de la série est enregistrée.');
  await expect(carte.locator('summary').first()).toContainText('1 exception');
  await expect(sansReference).toContainText(cas.espece);
  await verifierLEtape(page, journal, 'exception de série enregistrée');

  // Tout retirer : l'espèce redevient non rattachée.
  await exception.getByRole('button', { name: 'Retirer l’exception' }).click();
  await expect(section.getByRole('status')).toHaveText('L’exception est retirée : la série suit le rattachement de son espèce.');
  await formulaire.getByRole('button', { name: 'Retirer le rattachement' }).click();
  await expect(section.getByRole('status')).toHaveText('Le rattachement de l’espèce est retiré : elle est de nouveau non rattachée.');
  await expect(carte.locator('summary').first()).toContainText('Non rattachée');
  await expect(sansReference).toContainText(cas.espece);
  await verifierLEtape(page, journal, 'rattachement retiré');

  // La table de la culture de référence se lit, sur la page « Besoin par culture ».
  await attendreLaPageIrrigation(page, 'cultures');
  const coefficients = page.locator('section.crop-coefficients');
  // Le titre en clair depuis l'audit ergonomique (lot 3, point 8).
  await expect(coefficients.getByRole('heading', { name: 'Besoin en eau par culture' })).toBeVisible();
  const table = coefficients.locator('details.reference-crop-card').filter({ has: page.locator('summary strong', { hasText: new RegExp(`^${cas.culture}$`) }) });
  await table.locator('summary').first().click();
  await expect(table).toContainText('CRIIAM Sud');
  await expect(table.getByRole('table')).toBeVisible();
  await verifierLEtape(page, journal, 'table de la culture lue');
});
