import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P17 : les durées propres à la ferme et la fiche de la série
 * (docs/crop-water-need-contract.md, « L'écran », 5 quater, PR 3e).
 *
 * Sur la page « Coefficients culturaux », le parcours règle le délai de
 * levée en plantation d'une culture du jeu commun — l'aubergine sur
 * ordinateur, le poivron sur téléphone —, lit « durées de la ferme » et la
 * valeur du jeu commun rappelée sous le champ, puis revient aux durées
 * communes. Il rattache ensuite la carotte à la carotte du CRIIAM, ouvre la
 * série « Carottes du verger » dans la vue par série, lit sur V01 le stade,
 * le Kc et l'ETM du jour de la carotte, déclare le stade suivant pour toute
 * la série, puis retire le rattachement.
 *
 * Les parcours partagent une base : les durées reviennent au jeu commun et
 * le rattachement est retiré. Un stade déclaré ne s'efface pas ; il ne
 * touche que la proposition de V01, que P15 lit avec les deux stades
 * possibles.
 *
 * Ce qu'il ne prouve pas : l'effet des durées sur le stade du jour, prouvé
 * par les tests du domaine et de la base (tests/crop-water-farm-durations.test.ts,
 * tests/db/crop-water-durations.test.ts, tests/db/crop-water-series-sheet.test.ts).
 */

const CULTURE = { ordinateur: 'Aubergine', telephone: 'Poivron' } as const;

test('les durées d’une culture se règlent puis reviennent au jeu commun, et la fiche de la série montre le besoin de chaque planche, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  const culture = CULTURE[testInfo.project.name as keyof typeof CULTURE];
  const journal = surveillerLaConsole(page);
  // Les durées sont sur la page « Besoin par culture », le rattachement dans
  // Réglages (précision P3), la fiche de la série dans la vue par série de
  // l'historique (3.8).
  await attendreLaPageIrrigation(page, 'cultures');
  const coefficients = page.locator('section.crop-coefficients');
  const statut = coefficients.getByRole('status');

  // Régler le délai de levée en plantation, puis revenir aux durées communes.
  const carte = coefficients.locator('details.reference-crop-card').filter({ has: page.locator('summary strong', { hasText: new RegExp(`^${culture}$`) }) });
  await expect(carte).toHaveCount(1);
  await carte.scrollIntoViewIfNeeded();
  const ouvrirDurees = carte.locator('details.farm-durations-wrap > summary');
  await ouvrirParClic(carte.locator('summary').first(), ouvrirDurees);
  const durees = carte.getByRole('group', { name: `Durées de la ferme · ${culture}` });
  await ouvrirParClic(ouvrirDurees, durees);
  const levee = durees.getByLabel('Levée en plantation, en jours');
  const commun = await levee.inputValue();
  const enregistrer = durees.getByRole('button', { name: 'Enregistrer les durées' });
  await expect(async () => {
    await levee.fill('');
    await levee.fill(String(Number(commun) + 5));
    await expect(enregistrer).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await verifierCibleTactile(enregistrer, 'Le bouton « Enregistrer les durées »');
  await enregistrer.click();
  await expect(statut).toHaveText(`Les durées de la ferme sont enregistrées pour ${culture}.`);
  await expect(carte.locator('summary').first()).toContainText('durées de la ferme');
  if (!(await durees.isVisible())) await ouvrirDurees.click();
  await expect(durees).toContainText(`jeu commun : ${commun}`);
  await verifierLEtape(page, journal, 'durées de la ferme enregistrées');

  const revenir = durees.getByRole('button', { name: 'Revenir aux durées communes' });
  await verifierCibleTactile(revenir, 'Le bouton « Revenir aux durées communes »');
  await revenir.click();
  await expect(statut).toHaveText('La culture reprend les durées du jeu commun.');
  // La source et le jeu commun sont dans « Pour les experts » (audit ergonomique, lot 3, point 8) ; le résumé ne dit plus « durées de la ferme ».
  await expect(carte.locator('summary').first()).not.toContainText('durées de la ferme');
  await expect(carte.locator('details.experts-fold')).toContainText('jeu commun');
  await verifierLEtape(page, journal, 'retour aux durées communes');

  // Rattacher la carotte à la carotte du CRIIAM, dans Réglages.
  await attendreLaPageIrrigation(page, 'reglages');
  const espece = coefficients.locator('details.species-link-card').filter({ has: page.locator('summary strong', { hasText: /^Carotte$/ }) });
  const rattachement = espece.getByRole('group', { name: 'Rattachement de l’espèce Carotte' });
  await espece.scrollIntoViewIfNeeded();
  await ouvrirParClic(espece.locator('summary').first(), rattachement);
  const enregistrerRattachement = rattachement.getByRole('button', { name: 'Enregistrer' });
  await expect(async () => {
    await rattachement.getByLabel('Culture de référence').selectOption({ value: '' });
    await rattachement.getByLabel('Culture de référence').selectOption({ label: 'Carotte' });
    await expect(enregistrerRattachement).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await enregistrerRattachement.click();
  await expect(statut).toHaveText('Le rattachement de l’espèce est enregistré.');
  await verifierLEtape(page, journal, 'carotte rattachée');

  // La fiche de la série « Carottes du verger », dans la vue par série.
  await attendreLaPageIrrigation(page, 'historique');
  const historique = page.locator('.irrigation-history-dashboard');
  await historique.scrollIntoViewIfNeeded();
  await historique.getByRole('tab', { name: /^Par série/ }).click();
  await expect(historique.getByRole('tab', { name: /^Par série/, selected: true })).toHaveCount(1);
  const serie = historique.locator('details.series-card').filter({ hasText: 'Carottes du verger' });
  await expect(serie).toHaveCount(1);
  await serie.locator('summary').first().click();
  const fiche = serie.getByRole('region', { name: 'Besoin de la culture · série Carottes du verger' });
  const planches = fiche.getByRole('list', { name: 'Planches de la série Carottes du verger' });
  const v01 = planches.getByRole('listitem').filter({ hasText: 'Planche V01' });
  const carottes = v01.getByRole('listitem').filter({ hasText: 'Carotte · Carottes du verger' });
  await expect(carottes).toContainText(/Stade : (Semis → 30 j après|30 j → Récolte), (calculé|déclaré)/, { timeout: 30_000 });
  await expect(carottes).toContainText(/Kc (0,50|1,00)/);
  await expect(carottes).toContainText('Carotte (CRIIAM Sud)');
  await expect(v01).toContainText('Semaine : objectif proposé');
  await verifierLEtape(page, journal, 'fiche de la série lue');

  // Déclarer le stade suivant pour toute la série.
  const declarer = fiche.locator('details.bed-crop-water-declare');
  await declarer.locator('summary').click();
  await declarer.getByLabel('Stade atteint').selectOption({ label: '30 j → Récolte' });
  const bouton = declarer.getByRole('button', { name: 'Déclarer le stade' });
  await verifierCibleTactile(bouton, 'Le bouton « Déclarer le stade »');
  await bouton.click();
  await expect(fiche.getByRole('status')).toHaveText('Le stade est déclaré pour toute la série.');
  await expect(carottes).toContainText('Stade : 30 j → Récolte, déclaré');
  await verifierLEtape(page, journal, 'stade déclaré pour la série');

  // Retirer le rattachement : la base revient à son état de départ pour l'autre largeur.
  await attendreLaPageIrrigation(page, 'reglages');
  await espece.scrollIntoViewIfNeeded();
  if (!(await rattachement.isVisible())) await espece.locator('summary').first().click();
  await rattachement.getByRole('button', { name: 'Retirer le rattachement' }).click();
  await expect(statut).toHaveText('Le rattachement de l’espèce est retiré : elle est de nouveau non rattachée.');
  await verifierLEtape(page, journal, 'rattachement retiré');
});
