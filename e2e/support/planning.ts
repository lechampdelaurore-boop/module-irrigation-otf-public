import { expect, type Locator, type Page } from '@playwright/test';
import { annulerDepuisLeMenu } from './materiel.ts';

/**
 * Les gestes du planning que P10 et P12 partagent (docs/planning-contract.md
 * « Interface (3.6) », docs/replanning-contract.md « L'écran ») : l'objectif
 * de ferme posé puis retiré sur deux semaines, la plage horaire du
 * goutte-à-goutte, les irrigations du planning annulées, et la carte d'une
 * proposition désignée par son identifiant de registre.
 */

/**
 * La même carte, désignée par l'identifiant de registre de sa proposition,
 * stable quel que soit son statut et à travers les recalculs : une
 * proposition reproduite à l'identique garde son identité, mais son numéro
 * suit le dernier calcul (3.7, règle 10).
 */
export async function carteNommee(planning: Locator, carte: Locator): Promise<Locator> {
  const identifiant = await carte.getAttribute('data-proposal-id');
  expect(identifiant).not.toBeNull();
  return planning.locator(`article.planning-proposal[data-proposal-id="${identifiant}"]`);
}

/**
 * Au téléphone, un jour à venir n'affiche que son en-tête, et les jours
 * écoulés sont rangés sous « Jours écoulés (n) » (audit ergonomique, point 2,
 * précision F11) : la carte visée se montre en dépliant son jour. Sans effet
 * à l'ordinateur, ni quand la carte est déjà visible.
 */
export async function montrerLaCarte(planning: Locator, carte: Locator): Promise<void> {
  if (await carte.isVisible()) return;
  const identifiant = await carte.getAttribute('data-proposal-id');
  expect(identifiant).not.toBeNull();
  const jour = planning.locator('li.planning-day').filter({ has: planning.page().locator(`article.planning-proposal[data-proposal-id="${identifiant}"]`) });
  if (!(await jour.isVisible())) await planning.getByRole('button', { name: /^Jours écoulés \(\d+\)$/ }).click();
  await jour.getByRole('button', { name: /^Voir les créneaux/ }).click();
  await expect(carte).toBeVisible();
}

/**
 * La liste « Non placé » est repliée par défaut derrière son titre (demande
 * du porteur du 8 novembre 2026) : la déplie si besoin et rend ses lignes.
 */
export async function lignesNonPlacees(planning: Locator): Promise<Locator> {
  const pli = planning.locator('details.planning-unplaced');
  if (!(await pli.evaluate((element) => (element as HTMLDetailsElement).open))) await pli.locator('summary').click();
  await expect(pli).toHaveJSProperty('open', true);
  return pli.locator('tbody tr');
}

function panneauDesObjectifs(page: Page): Locator {
  return page.locator('.water-management-section .water-panel').filter({ hasText: 'Objectifs hebdomadaires' });
}

/** Va sur la semaine précédente de l'eau et attend que l'en-tête change. */
async function allerALaSemainePrecedente(page: Page): Promise<string> {
  const navigation = page.locator('.water-management-section .water-week-navigation');
  await navigation.scrollIntoViewIfNeeded();
  const semaine = navigation.locator('strong');
  const courante = await semaine.innerText();
  await navigation.getByRole('button', { name: '←' }).click();
  await expect(semaine).not.toHaveText(courante, { timeout: 15_000 });
  return courante;
}

async function revenirACetteSemaine(page: Page, courante: string): Promise<void> {
  const navigation = page.locator('.water-management-section .water-week-navigation');
  await navigation.getByRole('button', { name: 'Cette semaine' }).click();
  await expect(navigation.locator('strong')).toHaveText(courante, { timeout: 15_000 });
}

/**
 * L'objectif de ferme, posé sur cette semaine puis sur la précédente. Un
 * objectif posé cette semaine ne vaudrait qu'à partir d'aujourd'hui, donc pas
 * pour la semaine entière : posé aussi sur la semaine précédente, il
 * s'applique dès lundi, comme un objectif réel qui dure. Il est posé sur les
 * deux parce qu'il est retiré des deux : le retrait de cette semaine, laissé
 * par la largeur jouée avant, l'emporterait sur un objectif posé sur la
 * précédente seule. Chaque enregistrement se lit à la pastille qui apparaît :
 * la semaine n'en avait aucune, que ce soit à la première largeur ou à la
 * seconde, après le retrait fait par la première.
 */
export async function poserUnObjectifDeFerme(page: Page, millimetres: string): Promise<void> {
  await enregistrerUnObjectifDeFerme(page, millimetres);
  const courante = await allerALaSemainePrecedente(page);
  await enregistrerUnObjectifDeFerme(page, millimetres);
  await revenirACetteSemaine(page, courante);
}

async function enregistrerUnObjectifDeFerme(page: Page, millimetres: string): Promise<void> {
  const panneau = panneauDesObjectifs(page);
  const pastilles = panneau.locator('.goal-chip-list');
  await expect(pastilles, 'la semaine doit être sans objectif avant la pose : un parcours a laissé le sien')
    .toContainText('Aucun objectif pour cette semaine.');
  await panneau.getByLabel('mm / semaine').fill(millimetres);
  await panneau.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(pastilles).toContainText(`${millimetres} mm`, { timeout: 15_000 });
}

/** Les objectifs retirés de cette semaine puis de la précédente, les deux posées par le parcours. */
export async function retirerLesObjectifs(page: Page): Promise<void> {
  await viderLesObjectifsDeLaSemaine(page);
  const courante = await allerALaSemainePrecedente(page);
  await viderLesObjectifsDeLaSemaine(page);
  await revenirACetteSemaine(page, courante);
}

async function viderLesObjectifsDeLaSemaine(page: Page): Promise<void> {
  const panneau = panneauDesObjectifs(page);
  await panneau.getByRole('button', { name: 'Tout vider' }).click();
  const confirmation = page.locator('dialog.water-clear-dialog');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Retirer les objectifs' }).click();
  await expect(panneau.locator('.goal-chip-list')).toContainText('Aucun objectif pour cette semaine.', { timeout: 15_000 });
}

/** La plage horaire du goutte-à-goutte (R8), enregistrée et relue dans le résumé des réglages. */
export async function reglerLaPlageDuGoutteAGoutte(planning: Locator, plage: { debut: string; fin: string }): Promise<void> {
  const reglages = planning.locator('details.planning-settings');
  await reglages.scrollIntoViewIfNeeded();
  if (!(await reglages.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await reglages.locator('summary').click();
  }
  await reglages.getByLabel('R8 début de plage Goutte-à-goutte').fill(plage.debut);
  await reglages.getByLabel('R8 fin de plage Goutte-à-goutte').fill(plage.fin);
  await reglages.getByRole('button', { name: 'Enregistrer les réglages' }).click();
  await expect(reglages.locator('.planning-notice')).toContainText('Réglages enregistrés', { timeout: 15_000 });
  await expect(reglages.locator('summary')).toContainText(`${plage.debut} – ${plage.fin}`);
}

/** Les irrigations planifiées que le planning a créées, annulées une à une depuis leur menu « … », avec leur confirmation. */
export async function annulerLesIrrigationsDuPlanning(page: Page): Promise<void> {
  const fiches = page.locator('.upcoming-irrigations article').filter({ hasText: 'Planning du' });
  while (await fiches.count() > 0) {
    const restantes = await fiches.count();
    await annulerDepuisLeMenu(page, fiches.first());
    await expect(fiches).toHaveCount(restantes - 1, { timeout: 15_000 });
  }
}
