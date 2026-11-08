import { expect, test } from '@playwright/test';
import { dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '../lib/domain/water-management.ts';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P15 : le besoin de la culture dans la fiche de la planche
 * (docs/crop-water-need-contract.md, « L'écran », 5 quater, PR 3b).
 *
 * Le plan de démonstration porte des carottes semées trois semaines plus tôt
 * sur V01, sous le verger, une planche qu'aucun autre parcours ne touche. Le
 * parcours rattache la carotte à la carotte du CRIIAM, ouvre la fiche de V01,
 * lit le stade du jour, le Kc et l'ETM, l'objectif proposé de la semaine face
 * à l'objectif applicable, déclare le stade suivant pour la planche, lit
 * l'objectif proposé à côté de l'objectif dans « Besoins d'irrigation », puis
 * retire le rattachement.
 *
 * Il n'adopte pas la proposition : une adoption est une révision de
 * l'objectif, qui ne s'efface pas, et les parcours partagent une base. La
 * météo de démonstration n'a, pour la semaine en cours, ni réanalyse des
 * quatre derniers jours ni prévision des jours passés : la proposition n'est
 * complète que le lundi, où le parcours vérifie que le bouton s'offre ; les
 * autres jours, qu'elle se dit partielle et ne s'offre pas. L'adoption est
 * prouvée par les tests de la base (tests/db/crop-water-bed-sheet.test.ts).
 * Un stade déclaré ne s'efface pas non plus : il ne touche que la proposition
 * de V01, qu'aucun autre parcours ne lit.
 */

test('la fiche de la planche montre le stade, le Kc, l’ETM et l’objectif proposé, et un stade se déclare, sans débordement ni cible trop petite', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  // Le rattachement se fait dans Réglages (3.8, précision P3), la fiche de la
  // planche se lit sur la page du matériel, l'objectif proposé sur celle des
  // besoins (3.8).
  await attendreLaPageIrrigation(page, 'reglages');

  // Rattacher la carotte à la carotte du CRIIAM.
  const coefficients = page.locator('section.crop-coefficients');
  const carte = coefficients.locator('details.species-link-card').filter({ has: page.locator('summary strong', { hasText: /^Carotte$/ }) });
  const formulaire = carte.getByRole('group', { name: 'Rattachement de l’espèce Carotte' });
  await carte.scrollIntoViewIfNeeded();
  await ouvrirParClic(carte.locator('summary').first(), formulaire);
  const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer' });
  await expect(async () => {
    await formulaire.getByLabel('Culture de référence').selectOption({ value: '' });
    await formulaire.getByLabel('Culture de référence').selectOption({ label: 'Carotte' });
    await expect(enregistrer).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await enregistrer.click();
  await expect(coefficients.getByRole('status')).toHaveText('Le rattachement de l’espèce est enregistré.');
  await verifierLEtape(page, journal, 'carotte rattachée');

  // La fiche de V01 : parcelle « Sous le verger », sa première planche.
  await attendreLaPageIrrigation(page, 'materiel');
  await page.getByRole('region', { name: 'Choix du plan affiché' }).getByLabel('Parcelle').selectOption({ label: 'Sous le verger' });
  const fiche = page.getByRole('region', { name: 'Besoin de la culture · planche V01' });
  await fiche.scrollIntoViewIfNeeded();
  const cultures = fiche.getByRole('list', { name: 'Cultures du jour' });
  const carottes = cultures.getByRole('listitem').filter({ hasText: 'Carotte · Carottes du verger' });
  await expect(carottes).toContainText(/Stade : (Semis → 30 j après|30 j → Récolte), (calculé|déclaré)/, { timeout: 30_000 });
  await expect(carottes).toContainText(/Kc (0,50|1,00)/);
  await expect(carottes).toContainText(/ETM \d+(,\d+)? mm/);
  await expect(carottes).toContainText('Carotte (CRIIAM Sud)');
  await expect(fiche.getByText('Objectif applicable', { exact: true })).toBeVisible();
  await expect(fiche.getByText('Objectif proposé', { exact: true })).toBeVisible();
  const lundi = dateKeyInTimeZone(new Date(), FARM_TIME_ZONE) === weekStartDateKey(dateKeyInTimeZone(new Date(), FARM_TIME_ZONE));
  const adopter = fiche.getByRole('button', { name: 'Adopter la proposition' });
  if (lundi) {
    await expect(adopter).toBeEnabled();
    await verifierCibleTactile(adopter, 'Le bouton « Adopter la proposition »');
  } else {
    await expect(fiche).toContainText('Partielle : un jour ou une culture manque, elle ne s’adopte pas.');
    await expect(fiche).toContainText('ET0 manquante');
    await expect(adopter).toHaveCount(0);
  }
  await verifierLEtape(page, journal, 'fiche de la planche lue');

  // Déclarer le stade suivant, atteint aujourd'hui, pour cette planche.
  const declarer = fiche.locator('details.bed-crop-water-declare');
  await declarer.locator('summary').click();
  await declarer.getByLabel('Stade atteint').selectOption({ label: '30 j → Récolte' });
  const bouton = declarer.getByRole('button', { name: 'Déclarer le stade' });
  await verifierCibleTactile(bouton, 'Le bouton « Déclarer le stade »');
  await bouton.click();
  await expect(fiche.getByRole('status')).toHaveText('Le stade est déclaré pour cette planche.');
  await expect(carottes).toContainText('Stade : 30 j → Récolte, déclaré');
  await expect(carottes).toContainText('Kc 1,00');
  await verifierLEtape(page, journal, 'stade déclaré');

  // La semaine suivante se lit ; « Semaine précédente » revient.
  await fiche.getByRole('button', { name: 'Semaine suivante' }).click();
  await expect(fiche.getByRole('button', { name: 'Semaine précédente' })).toBeEnabled();
  await fiche.getByRole('button', { name: 'Semaine précédente' }).click();
  await expect(fiche.getByRole('button', { name: 'Semaine suivante' })).toBeEnabled();
  await verifierLEtape(page, journal, 'semaines parcourues');

  // L'objectif proposé à côté de l'objectif, dans « Besoins d'irrigation ».
  await attendreLaPageIrrigation(page, 'besoins');
  const besoins = page.locator('section.irrigation-needs-section');
  const jardin = besoins.locator('details').filter({ has: page.locator('summary strong', { hasText: 'Jardin du verger' }) }).first();
  await jardin.locator('summary').first().click();
  const planche = jardin.locator('article.irrigation-need-card').filter({ has: page.locator('header strong', { hasText: /^V01$/ }) });
  await planche.locator('details.need-calculation > summary').click();
  await expect(planche.locator('[data-kind="proposed"]')).toContainText('Objectif proposé');
  await verifierLEtape(page, journal, 'objectif proposé dans les besoins');

  // Retirer le rattachement : la base revient à son état de départ pour l'autre largeur.
  await attendreLaPageIrrigation(page, 'reglages');
  await coefficients.scrollIntoViewIfNeeded();
  if (!(await formulaire.isVisible())) await carte.locator('summary').first().click();
  await formulaire.getByRole('button', { name: 'Retirer le rattachement' }).click();
  await expect(coefficients.getByRole('status')).toHaveText('Le rattachement de l’espèce est retiré : elle est de nouveau non rattachée.');
  await verifierLEtape(page, journal, 'rattachement retiré');
});
