import { expect, type Locator, type Page } from '@playwright/test';
import { confirmerDansLaFenetre, ouvrirLePli, ouvrirLesPlisAutour } from './parcours.ts';
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
 * Au téléphone, « Jour par jour » de la page « Semaine » montre chaque
 * créneau en une ligne, et range les jours écoulés sous « Jours écoulés (n) »
 * (simplification, lot S4, PR 2, section 5 ; F11) : la carte visée se montre
 * en dépliant ses jours, puis par « Autres choix » (ou « Détail ») de sa
 * ligne. Sans effet à l'ordinateur, ni quand la carte est déjà visible.
 */
export async function montrerLaCarte(planning: Locator, carte: Locator): Promise<void> {
  if (await carte.isVisible()) return;
  const identifiant = await carte.getAttribute('data-proposal-id');
  expect(identifiant).not.toBeNull();
  // Un filtre `has` se lit dans l'élément filtré : la carte y est cherchée par son seul sélecteur.
  const laCarte = planning.page().locator(`article.planning-proposal[data-proposal-id="${identifiant}"]`);
  const creneau = planning.locator('.week-slot').filter({ has: laCarte });
  const jour = planning.locator('li.planning-day').filter({ has: laCarte });
  if (!(await jour.isVisible())) await planning.getByRole('button', { name: /^Jours écoulés \(\d+\)$/ }).click();
  if (!(await carte.isVisible())) await creneau.locator('.week-slot-line').getByRole('button', { name: /^(Autres choix|Détail)$/ }).click();
  await expect(carte).toBeVisible();
}

/**
 * La liste « Non placé » est repliée par défaut derrière son titre (demande
 * du porteur du 8 novembre 2026) : la déplie si besoin et rend ses lignes.
 */
export async function lignesNonPlacees(planning: Locator): Promise<Locator> {
  const pli = planning.locator('details.planning-unplaced');
  // Dans « Le plan, chaîne par chaîne », au détail de la page « Semaine » (S4, PR 2).
  await ouvrirLesPlisAutour(pli);
  if (!(await pli.evaluate((element) => (element as HTMLDetailsElement).open))) await pli.locator('summary').click();
  await expect(pli).toHaveJSProperty('open', true);
  return pli.locator('tbody tr');
}

/** Le pli des objectifs, fermé d'office et ouvert ici (audit du 19 novembre 2026, lot J, n° 15, F460). */
async function panneauDesObjectifs(page: Page): Promise<Locator> {
  return ouvrirLePli(page.locator('#objectifs-de-la-semaine'));
}

/**
 * Va sur la semaine précédente par la flèche de la page « Semaine » et
 * attend ses dates : l'adresse dit la semaine (simplification, lot S4, PR 2,
 * S4-g). Rend les dates de la semaine quittée.
 */
async function allerALaSemainePrecedente(page: Page): Promise<string> {
  const navigation = page.getByRole('navigation', { name: 'Changer de semaine' });
  const dates = navigation.locator('.week-range');
  const courante = await dates.innerText();
  await navigation.getByRole('link', { name: 'Semaine précédente' }).click();
  await expect(dates).not.toHaveText(courante, { timeout: 15_000 });
  await expect(page).toHaveURL(/[?&]week=\d{4}-\d{2}-\d{2}/);
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  return courante;
}

async function revenirACetteSemaine(page: Page, courante: string): Promise<void> {
  const navigation = page.getByRole('navigation', { name: 'Changer de semaine' });
  await navigation.getByRole('link', { name: 'Cette semaine' }).click();
  await expect(navigation.locator('.week-range')).toHaveText(courante, { timeout: 15_000 });
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
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
  const panneau = await panneauDesObjectifs(page);
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
  const panneau = await panneauDesObjectifs(page);
  await panneau.getByRole('button', { name: 'Vider les objectifs' }).click();
  await expect(page.locator('dialog.module-confirm-dialog[open]')).toContainText('Vider les objectifs de cette semaine ?');
  await confirmerDansLaFenetre(page, 'Vider les objectifs');
  await expect(panneau.locator('.goal-chip-list')).toContainText('Aucun objectif pour cette semaine.', { timeout: 15_000 });
}

/** La plage horaire du goutte-à-goutte (R8), enregistrée et relue dans le résumé des réglages. */
export async function reglerLaPlageDuGoutteAGoutte(planning: Locator, plage: { debut: string; fin: string }): Promise<void> {
  const reglages = planning.locator('details.planning-settings');
  // Dans « Réglages de la semaine », le dernier pli de « Le détail » (S4, PR 2).
  await ouvrirLesPlisAutour(reglages);
  await reglages.scrollIntoViewIfNeeded();
  if (!(await reglages.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await reglages.locator('summary').click();
  }
  // Les libellés en mots simples ; les numéros dans la bulle du groupe, pour les experts (audit final, lot D, J6, F297).
  const libelles = await reglages.locator('.planning-settings-form label > span').allTextContents();
  expect(libelles.length, 'les libellés des réglages').toBeGreaterThan(10);
  expect(libelles.filter((libelle) => /^R\d+\b/.test(libelle)), 'aucun libellé ne commence par son numéro').toEqual([]);
  const goutte = reglages.locator('fieldset', { has: planning.page().locator('legend', { hasText: 'Goutte-à-goutte' }) });
  await goutte.getByRole('button', { name: 'Numéros des réglages' }).click();
  await expect(goutte.getByRole('note')).toContainText('Réglage R8, plage horaire');
  await goutte.getByRole('note').getByRole('button', { name: 'Fermer' }).click();
  await expect(goutte.getByRole('note')).toHaveCount(0);
  await reglages.getByLabel('R8 début de plage Goutte-à-goutte').fill(plage.debut);
  await reglages.getByLabel('R8 fin de plage Goutte-à-goutte').fill(plage.fin);
  await reglages.getByRole('button', { name: 'Enregistrer les réglages' }).click();
  await expect(reglages.locator('.planning-notice')).toContainText('Réglages enregistrés', { timeout: 15_000 });
  // La plage s'écrit « de 6 h à 22 h » dans le résumé (audit du 19 novembre 2026, lot K, n° 22, F474).
  await expect(reglages.locator('summary')).toContainText(`de ${heureEcrite(plage.debut)} à ${heureEcrite(plage.fin)}`);
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

/**
 * « Refuser » une proposition : la fenêtre du module demande d'abord, un refus
 * valant pour toute la semaine (audit du 19 novembre 2026, lot G, n° 7, F411).
 */
export async function refuserLaProposition(page: Page, carte: Locator): Promise<void> {
  await carte.getByRole('button', { name: 'Refuser' }).click();
  const fenetre = page.locator('dialog.module-confirm-dialog[open]');
  await expect(fenetre).toContainText('Refuser ce créneau pour toute la semaine ?');
  const refuser = fenetre.getByRole('button', { name: 'Refuser le créneau' });
  // Ce qui efface ou annule se confirme en rouge (F408).
  await expect(refuser).toHaveCSS('background-color', 'rgb(220, 53, 69)');
  await refuser.click();
  await expect(fenetre).toHaveCount(0);
}

/** « 06:00 » saisi s'écrit « 6 h » ; « 23:59 », « 23 h 59 » (F474). */
function heureEcrite(saisie: string): string {
  const [heures, minutes] = saisie.split(':').map(Number);
  return minutes === 0 ? `${heures} h` : `${heures} h ${String(minutes).padStart(2, '0')}`;
}
