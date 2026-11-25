import { expect, test, type Locator, type Page } from '@playwright/test';
import { carteDeCulture } from './support/cultures.ts';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { nomUnique } from './support/materiel.ts';
import {
  attendreLaPageIrrigation,
  ouvrirLaCorrespondanceDesEspeces,
  ouvrirParClic,
  surveillerLaConsole,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P56 : le conseil de servir d'abord les stades sensibles, en
 * pénurie (amélioration n° 4, docs/ameliorations-4-5-contract.md, section 3,
 * précisions F730 à F732 ; docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve de démonstration, toutes cases cochées, la carotte
 * rattachée à la carotte du CRIIAM : les carottes du verger (V01), semées
 * trois semaines plus tôt, sont à leur premier stade, « Semis → 30 j après »,
 * que la liste préremplie coche, par analogie. Le parcours décoche ce stade
 * sur « Besoin par culture » : le choix est celui de la ferme. Une réserve de
 * 300 L et un besoin manuel de 500 mm sur V01 font la pénurie : la
 * répartition de « Ressources et pompes » ne porte aucun conseil, le stade
 * n'étant plus sensible pour la ferme. Recoché, le stade revient à la liste
 * préremplie, et le conseil paraît : la carotte, V01, son stade « d'après le
 * calendrier », son déficit et sa priorité de la semaine. « Adopter » met V01
 * en priorité haute pour cette semaine et recalcule ; le conseil disparaît, la
 * carte de besoin de V01 dit « Priorité haute ». Au téléphone (390 px) et à
 * l'ordinateur, à 1 440 px de large.
 *
 * Ce qu'il ne prouve pas : la règle du conseil, hors pénurie, eau inconnue,
 * planche servie en entier, stade déclaré, deux cultures et ordre des groupes
 * compris (tests/stades-sensibles.test.ts), la liste préremplie ligne pour
 * ligne et l'isolation des choix (tests/db/stades-sensibles.test.ts), la
 * phrase du planning à parts égales, la ferme réelle.
 */

const DUREE_DU_PARCOURS = 240_000;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;
const PLANCHE = 'V01';
const STADE = 'Semis → 30 j après';
/** Plafond du besoin manuel, imposé par l'écran des besoins : avec 300 L, la pénurie est certaine. */
const BESOIN_MAXIMAL_MM = '500';
const RAISON = 'parcours stade sensible';
const STOCK_M3 = '0,3';
const CAPACITE_M3 = '10';

test('en pénurie, le conseil de servir d’abord une planche à un stade sensible, adopté pour la semaine', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'stades-sensibles');
  await preparerLaFermeNeuve(page);
  await rattacherLaCarotte(page);
  await verifierLEtape(page, journal, 'ferme neuve prête, carotte rattachée');

  // Le stade de la carotte, coché par la liste préremplie, par analogie ; décoché, il devient le choix de la ferme.
  let stades = await ouvrirLesStadesDeLaCarotte(page);
  const caseDuStade = stades.getByRole('checkbox', { name: new RegExp(`^${STADE}`) });
  await expect(caseDuStade).toBeChecked();
  await expect(stades.locator('label.sensitive-stage').filter({ hasText: STADE })).toContainText('d’après les références, par analogie');
  await expect(stades.locator('summary').first()).toContainText('1 stade sensible sur 2');
  if (telephone) await verifierCibleTactile(stades.locator('label.sensitive-stage').filter({ hasText: STADE }), `La case « ${STADE} »`);
  await caseDuStade.uncheck();
  await enregistrerLesStades(page, stades);
  stades = await ouvrirLesStadesDeLaCarotte(page);
  await expect(stades.getByRole('checkbox', { name: new RegExp(`^${STADE}`) })).not.toBeChecked();
  await expect(stades.locator('label.sensitive-stage').filter({ hasText: STADE })).toContainText('choisi par la ferme');
  await expect(stades.locator('summary').first()).toContainText('aucun stade sensible');
  await expect(stades.getByRole('button', { name: 'Reprendre la liste préremplie' })).toBeVisible();
  await verifierLEtape(page, journal, 'stade décoché par la ferme');

  // La pénurie : 300 L d'eau, 500 mm demandés sur V01. Aucun conseil : aucun stade n'est sensible pour la ferme.
  await attendreLaPageIrrigation(page, 'ressources');
  await creerLaReserve(page, nomUnique(testInfo, 'Réserve'));
  await attendreLaPageIrrigation(page, 'besoins');
  await poserUnBesoinManuel(page, PLANCHE, BESOIN_MAXIMAL_MM);
  let repartition = await lireLaRepartition(page);
  await verifierLaPenurie(repartition);
  await expect(repartition.getByTestId('stage-advice')).toHaveCount(0);
  await verifierLEtape(page, journal, 'pénurie sans conseil');

  // Le stade recoché revient à la liste préremplie : la ferme n'a plus de choix à elle.
  stades = await ouvrirLesStadesDeLaCarotte(page);
  await stades.getByRole('checkbox', { name: new RegExp(`^${STADE}`) }).check();
  await enregistrerLesStades(page, stades);
  stades = await ouvrirLesStadesDeLaCarotte(page);
  await expect(stades.getByRole('checkbox', { name: new RegExp(`^${STADE}`) })).toBeChecked();
  await expect(stades.locator('label.sensitive-stage').filter({ hasText: STADE })).toContainText('d’après les références, par analogie');
  await expect(stades.getByRole('button', { name: 'Reprendre la liste préremplie' })).toHaveCount(0);
  await verifierLEtape(page, journal, 'stade recoché, liste préremplie');

  // Le conseil : la carotte, V01, son stade d'après le calendrier, son déficit et sa priorité de la semaine.
  repartition = await lireLaRepartition(page);
  const conseil = repartition.getByTestId('stage-advice');
  await expect(conseil).toBeVisible({ timeout: 30_000 });
  await expect(conseil.getByRole('heading', { name: 'Conseil : servir d’abord les stades sensibles' })).toBeVisible();
  const groupe = conseil.locator('.stage-advice-group').filter({ has: page.getByRole('heading', { name: 'Carotte', exact: true }) });
  const ligne = groupe.locator('li.stage-advice-bed').filter({ has: page.locator('strong', { hasText: new RegExp(`^${PLANCHE}$`) }) });
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toContainText(`Carotte (Carottes du verger) : stade « ${STADE} » · stade d’après le calendrier`);
  // Sans objectif adopté, le déficit relatif n'est pas connu : « Non calculable » se lit avec sa raison (F316).
  await expect(ligne.locator('.stage-advice-figures')).toHaveText('Déficit relatif : Non calculable (aucun objectif adopté) · Priorité de la semaine : Normale');
  const adopter = ligne.getByRole('button', { name: `Adopter : ${PLANCHE} en priorité haute cette semaine` });
  if (telephone) await verifierCibleTactile(adopter, 'Le bouton « Adopter »');
  await verifierLEtape(page, journal, 'conseil affiché');

  // « Adopter » : la priorité haute pour cette semaine, les quantités recalculées, le conseil disparu.
  await adopter.click();
  await expect(repartition.locator('.feasibility-notice')).toHaveText(
    `Priorité haute enregistrée pour ${PLANCHE}, pour cette semaine seulement. Les quantités ont été recalculées.`,
    { timeout: 30_000 },
  );
  await expect(repartition.getByTestId('stage-advice')).toHaveCount(0);
  await verifierLEtape(page, journal, 'conseil adopté, disparu');

  await attendreLaPageIrrigation(page, 'besoins');
  const carte = await ouvrirLeJardinDe(page, PLANCHE);
  await expect(carte.locator('.need-priority-label')).toHaveText('Priorité haute', { timeout: 15_000 });
  await expect(carte).toContainText(`${BESOIN_MAXIMAL_MM} mm`);
  await verifierLEtape(page, journal, 'priorité haute, besoin manuel gardé');
});

/** Rattache la carotte à la carotte du CRIIAM, comme P52 : sans culture de référence, aucun stade. */
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

/** Le pli « Stades sensibles au manque d'eau » de la carotte, sur « Besoin par culture », ouvert. */
async function ouvrirLesStadesDeLaCarotte(page: Page): Promise<Locator> {
  await attendreLaPageIrrigation(page, 'cultures');
  const coefficients = page.locator('section.crop-coefficients');
  const carte = await carteDeCulture(coefficients, 'Carotte');
  const stades = carte.locator('details.sensitive-stages');
  const groupe = stades.getByRole('group', { name: 'Stades sensibles au manque d’eau · Carotte' });
  await carte.scrollIntoViewIfNeeded();
  // La carte et son pli s'ouvrent sans React ; une case cochée avant que la page ne réponde serait perdue.
  await expect(async () => {
    if (!(await carte.evaluate((element) => (element as HTMLDetailsElement).open))) await carte.locator('summary').first().click();
    if (!(await stades.evaluate((element) => (element as HTMLDetailsElement).open))) await stades.locator('summary').first().click();
    await expect(groupe).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  return stades;
}

async function enregistrerLesStades(page: Page, stades: Locator): Promise<void> {
  const enregistrer = stades.getByRole('button', { name: 'Enregistrer les stades sensibles' });
  await expect(enregistrer).toBeEnabled();
  await enregistrer.click();
  await expect(page.locator('section.crop-coefficients').getByRole('status')).toHaveText('Stades sensibles enregistrés pour Carotte.', { timeout: 15_000 });
}

/** La répartition de « Ressources et pompes », lue : elle ne se calcule qu'une fois approchée. */
async function lireLaRepartition(page: Page): Promise<Locator> {
  await attendreLaPageIrrigation(page, 'ressources');
  const repartition = page.locator('section#repartition');
  await repartition.scrollIntoViewIfNeeded();
  await expect(repartition.locator('.feasibility-meta')).toBeVisible({ timeout: 30_000 });
  return repartition;
}

/** La pénurie, lue : l'eau disponible connue, 300 L, toute servie, et aucune planche servie en entier. */
async function verifierLaPenurie(repartition: Locator): Promise<void> {
  const tuile = (nom: string) => repartition.locator('.feasibility-summary.is-head > div').filter({ hasText: nom }).locator('strong');
  await expect(tuile('Eau disponible')).toHaveText('300 L', { timeout: 30_000 });
  await expect(tuile('Planches servies en entier')).toHaveText(/^0 sur \d+$/);
  await expect(repartition.locator('details.feasibility-priority > summary').filter({ hasText: 'Priorité Normale' })).toContainText('Satisfait 300 L');
}

function panneauDesReserves(page: Page): Locator {
  return page.locator('article.water-asset-panel').filter({ has: page.getByRole('heading', { name: 'Réserves', exact: true }) });
}

/** Une réserve sans apport, ni pluie ni évaporation : son eau mobilisable est son stock observé, comme P32. */
async function creerLaReserve(page: Page, reserve: string): Promise<void> {
  const panneau = panneauDesReserves(page);
  const formulaire = page.locator('form.water-editor').filter({ has: page.getByRole('heading', { name: 'Nouvelle réserve' }) });
  await ouvrirParClic(panneau.getByRole('button', { name: '+ Ajouter' }), formulaire);
  await formulaire.getByLabel('Nom', { exact: true }).fill(reserve);
  await formulaire.getByLabel('Capacité maximale (m³)').fill(CAPACITE_M3);
  await expect(formulaire.getByLabel('Reçoit la pluie')).not.toBeChecked();
  await formulaire.getByLabel('Volume non renseigné').uncheck();
  await formulaire.getByLabel('Volume observé (m³)').fill(STOCK_M3);
  await formulaire.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(formulaire).toBeHidden({ timeout: 15_000 });
  await expect(panneau.locator('.water-asset-card').filter({ hasText: reserve })).toContainText('Actuel300 L');
}

function carteDeBesoin(page: Page, planche: string): Locator {
  return page.locator('article.irrigation-need-card').filter({
    has: page.locator('header strong', { hasText: new RegExp(`^${planche}$`) }),
  });
}

/** Les cartes de besoin vivent dans un pli par jardin, replié au chargement, comme P7. */
async function ouvrirLeJardinDe(page: Page, planche: string): Promise<Locator> {
  const carte = carteDeBesoin(page, planche);
  const jardin = page.locator('.irrigation-needs-gardens > details').filter({
    has: page.locator('article.irrigation-need-card header strong', { hasText: new RegExp(`^${planche}$`) }),
  });
  await jardin.scrollIntoViewIfNeeded();
  const bascule = carte.locator('label.need-toggle');
  await expect(async () => {
    if (!(await bascule.isVisible())) await jardin.locator('summary').first().click();
    await expect(bascule).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  return carte;
}

async function poserUnBesoinManuel(page: Page, planche: string, millimetres: string): Promise<void> {
  const carte = await ouvrirLeJardinDe(page, planche);
  const bascule = carte.locator('label.need-toggle');
  const champ = carte.getByLabel('Besoin manuel (mm)');
  await expect(async () => {
    if (!(await champ.isVisible())) await bascule.click();
    await expect(champ).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await champ.fill(millimetres);
  await carte.getByLabel('Raison facultative').fill(RAISON);
  await carte.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carte).toContainText(`${millimetres} mm`, { timeout: 15_000 });
}
