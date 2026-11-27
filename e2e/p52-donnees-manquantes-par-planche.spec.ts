import { expect, test, type Locator, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  ouvrirLaCorrespondanceDesEspeces,
  ouvrirLeDetailDuJour,
  ouvrirParClic,
  surveillerLaConsole,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P52 : le panneau « données manquantes », planche par planche
 * (amélioration n° 6, docs/ameliorations-6-2-3-7-contract.md, section 3,
 * précisions F700, F701, F710 et F711 ; docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve de démonstration, toutes cases cochées, la carotte
 * rattachée à sa culture de référence, le sol des parcelles laissé vide et
 * aucune pluie mesurée : la zone « Fiabilité du calcul » de « Aujourd'hui »
 * porte, fermé, le dépliant « Par planche » qui dit le total ; ouvert, il
 * range les planches par culture, chacune avec ses lignes — réserve du sol
 * non saisie, stade deviné, pluviomètre absent — et leur geste. Le « ? » de la
 * zone écrit le seuil de 30 jours. « Déclarer le stade » ouvre « Matériel » sur
 * la planche, le formulaire du stade ouvert ; une fois le stade déclaré, la
 * ligne disparaît. « Saisir une pluie mesurée, même 0 mm » ouvre « Pluie
 * mesurée » ; une mesure de 0 mm fait disparaître les lignes du pluviomètre.
 * Le geste du sol ouvre « Réglages du sol » sur sa parcelle. Au téléphone
 * (390 px) et à l'ordinateur, à 1 440 px de large.
 *
 * Ce qu'il ne prouve pas : la règle de chaque donnée, case décochée, ferme
 * tout sous abri et seuil de 30 jours compris (les tests du domaine,
 * tests/donnees-manquantes-par-planche.test.ts), la ferme réelle, le lien
 * « Ce qui manque » de la fin de l'accueil (4.4), qui n'existe pas encore.
 */

const DUREE_DU_PARCOURS = 180_000;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;

function pliParPlanche(page: Page): Locator {
  return page.locator('details#donnees-manquantes');
}

/** Ouvre le dépliant et montre toutes ses planches. */
async function ouvrirToutLePli(page: Page): Promise<Locator> {
  const pli = pliParPlanche(page);
  if (!(await pli.evaluate((element) => (element as HTMLDetailsElement).open))) await pli.locator('summary').click();
  await expect(pli).toHaveJSProperty('open', true);
  const plus = pli.getByRole('button', { name: /^Voir (l’autre planche|les \d+ autres planches)$/ });
  if (await plus.count() > 0) await plus.click();
  return pli;
}

/** Rattache la carotte à la carotte du CRIIAM, comme P15 : sans culture de référence, aucun stade n'est deviné. */
async function rattacherLaCarotte(page: Page): Promise<void> {
  await attendreLaPageIrrigation(page, 'reglages');
  await ouvrirLaCorrespondanceDesEspeces(page);
  const coefficients = page.locator('section.crop-coefficients');
  const carte = coefficients.locator('details.species-link-card').filter({ has: page.locator('summary strong', { hasText: /^Carotte$/ }) });
  const formulaire = carte.getByRole('group', { name: 'Rattachement de l’espèce Carotte' });
  await carte.scrollIntoViewIfNeeded();
  await ouvrirParClic(carte.locator('summary').first(), formulaire);
  const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer' });
  await expect(async () => {
    await formulaire.getByLabel('À quelle culture ressemble cette espèce ?').selectOption({ value: '' });
    await formulaire.getByLabel('À quelle culture ressemble cette espèce ?').selectOption({ label: 'Carotte' });
    await expect(enregistrer).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await enregistrer.click();
  await expect(coefficients.getByRole('status')).toHaveText('Le rattachement de l’espèce est enregistré.');
}

test('« Par planche » : ce qui manque à chaque planche, et le geste qui mène au bon formulaire', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'donnees-manquantes');
  await preparerLaFermeNeuve(page);
  await rattacherLaCarotte(page);
  await verifierLEtape(page, journal, 'ferme neuve prête, carotte rattachée');

  // « Fiabilité du calcul » est dans « Le détail » depuis S2, PR 5 (D-330) : le pli s'ouvre d'abord.
  // Fermé, le dépliant dit le total ; le « ? » de la zone écrit le seuil du pluviomètre (F701).
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await ouvrirLeDetailDuJour(page);
  const fiabilite = page.locator('#today-reliability');
  const pli = pliParPlanche(page);
  await expect(pli).toHaveJSProperty('open', false);
  await expect(pli.locator('summary')).toContainText(/Par planche\s*\d+ planches? (a|ont) une donnée manquante/);
  const aide = page.getByRole('region', { name: 'Aide : Fiabilité du calcul' });
  await ouvrirParClic(fiabilite.getByRole('button', { name: 'Aide : Fiabilité du calcul' }), aide);
  await expect(aide).toContainText('depuis plus de 30 jours');
  await aide.getByRole('button', { name: 'Fermer' }).click();
  if (telephone) await verifierCibleTactile(pli.locator('summary'), 'Le titre du dépliant « Par planche »');

  // Ouvert : par culture, puis par planche ; les trois données de la ferme neuve sont là.
  await ouvrirToutLePli(page);
  await expect(pli.locator('.reliability-by-bed-group h3').first()).not.toBeEmpty();
  await expect(pli.locator('[data-missing="soil"]').first()).toContainText('Réserve du sol non saisie');
  await expect(pli.locator('[data-missing="rain-gauge"]').first()).toContainText('Pluviomètre absent');
  const ligneDuStade = pli.locator('[data-missing="stage"]').filter({ hasText: /^Stade deviné : Carotte / }).first();
  await expect(ligneDuStade).toContainText('Le besoin proposé suit le calendrier, pas votre constat.');
  const planche = await ligneDuStade.locator('xpath=ancestor::li[@data-bed][1]').getAttribute('data-bed');
  expect(planche, 'la planche de la ligne du stade').toBeTruthy();
  await verifierLEtape(page, journal, 'dépliant ouvert, trois données');

  // « Déclarer le stade » : « Matériel », sur la planche, le formulaire du stade ouvert.
  const declarerDepuisAujourdhui = ligneDuStade.getByRole('link', { name: 'Déclarer le stade' });
  if (telephone) await verifierCibleTactile(declarerDepuisAujourdhui, 'Le lien « Déclarer le stade »');
  await declarerDepuisAujourdhui.click();
  await attendreLaPagePrete(page, 'materiel');
  await expect(page).toHaveURL(new RegExp(`/irrigation/materiel\\?.*zone=.*#bed-stage-${planche}$`));
  const fiche = page.locator(`section.bed-crop-water[data-bed="${planche}"]`);
  const formulaire = fiche.locator('details.bed-crop-water-declare');
  await expect(formulaire).toHaveJSProperty('open', true, { timeout: 30_000 });
  await expect(page.locator('details#reglages-de-la-page')).toHaveJSProperty('open', true);
  await expect(formulaire.getByRole('button', { name: 'Déclarer le stade' })).toBeInViewport();
  await verifierLEtape(page, journal, 'formulaire du stade ouvert sur sa planche');

  // Le stade du jour déclaré pour cette planche, chaque culture devinée de la planche : la ligne disparaît.
  const cultures = formulaire.getByLabel('Culture', { exact: true });
  const nombreDeCultures = await cultures.count() > 0 ? await cultures.locator('option').count() : 1;
  for (let index = 0; index < nombreDeCultures; index += 1) {
    if (nombreDeCultures > 1) await cultures.selectOption({ index });
    await formulaire.getByLabel('Stade atteint').selectOption({ index: 1 });
    await formulaire.getByRole('button', { name: 'Déclarer le stade' }).click();
    await expect(fiche.getByRole('status')).toHaveText('Le stade est déclaré pour cette planche.');
    if (!(await formulaire.evaluate((element) => (element as HTMLDetailsElement).open))) await formulaire.locator('summary').click();
  }
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await ouvrirLeDetailDuJour(page);
  await ouvrirToutLePli(page);
  await expect(pli.locator(`li[data-bed="${planche}"] [data-missing="stage"]`)).toHaveCount(0);
  await verifierLEtape(page, journal, 'stade déclaré, ligne disparue');

  // Le geste du sol ouvre « Réglages du sol » sur sa parcelle (le sol reste vide : la ligne reste).
  const renseigner = pli.locator('[data-missing="soil"]').first().getByRole('link', { name: /^(Renseigner la réserve de la parcelle|Observer le sol) / });
  if (telephone) await verifierCibleTactile(renseigner, 'Le lien du sol');
  await renseigner.click();
  await attendreLaPagePrete(page, 'sol');
  await expect(page).toHaveURL(/\/irrigation\/sol\?season=\d{4}#soil-(parcel|garden)-/);
  await verifierLEtape(page, journal, 'geste du sol suivi');

  // « Saisir une pluie mesurée, même 0 mm » : « Pluie mesurée » ouverte ; 0 mm aujourd'hui fait taire le pluviomètre.
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await ouvrirLeDetailDuJour(page);
  await ouvrirToutLePli(page);
  const saisir = pli.locator('[data-missing="rain-gauge"]').first().getByRole('link', { name: 'Saisir une pluie mesurée, même 0 mm' });
  if (telephone) await verifierCibleTactile(saisir, 'Le lien « Saisir une pluie mesurée »');
  await saisir.click();
  await attendreLaPagePrete(page, 'besoins');
  // L'ancienne adresse mène à la page « Semaine », l'ancre gardée (lot S4, PR 1, F917).
  await expect(page).toHaveURL(/\/irrigation\/semaine\?.*#manual-rain$/);
  const pluie = page.locator('#manual-rain');
  await expect(pluie).toHaveJSProperty('open', true);
  await pluie.getByLabel('Millimètres').fill('0');
  await pluie.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(pluie.locator('.action-reply .water-notice')).toHaveText('La pluie mesurée a été enregistrée.');
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await ouvrirLeDetailDuJour(page);
  await ouvrirToutLePli(page);
  await expect(pli.locator('[data-missing="rain-gauge"]')).toHaveCount(0);
  await expect(pli.locator('[data-missing="soil"]').first()).toBeVisible();
  await verifierLEtape(page, journal, 'pluie mesurée, lignes du pluviomètre disparues');
});
