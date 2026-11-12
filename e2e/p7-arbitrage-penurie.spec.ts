import { expect, test, type Locator, type Page } from '@playwright/test';
import { attendreLaPageIrrigation, epinglerLaBulle, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P7 : l'écran d'arbitrage de la pénurie, aux deux largeurs
 * (`docs/recette-3.4.md`, groupes B3 et B6).
 *
 * C'est l'écran où un clic engage de l'eau, et il n'avait aucun filet. La
 * recette du 24 septembre 2026 l'a constaté : la ligne B6, la faisabilité à
 * 390 px, restait à faire à la main faute de parcours. Celui-ci prend la part
 * mesurable — la pénurie s'affiche, les cases existent, la décision
 * s'enregistre, rien ne déborde et les cibles sont assez grandes pour un pouce.
 * Ce que le porteur garde : le confort réel sur son propre téléphone.
 *
 * Depuis le 9 novembre 2026, l'écran se présente comme un plan d'assolement
 * (docs/shortage-contract.md, 2 bis, D-083) : les planches rangées par jardin
 * avec leurs cultures, toutes cochées au départ, le bilan recalculé à chaque
 * case, rien d'enregistré avant « Valider la répartition ».
 *
 * La pénurie est provoquée par des besoins manuels au plafond plutôt qu'en
 * vidant les réserves : les parcours partagent une base, et le besoin d'une
 * planche ne dépend que d'elle, alors que l'eau disponible dépend de tout ce que
 * les autres parcours ont fait avant.
 */

/** Plafond du besoin manuel, imposé par l'écran des besoins. */
const BESOIN_MAXIMAL_MM = '500';
const RAISON = 'parcours arbitrage';

test('la pénurie s’arbitre depuis l’écran, sans débordement ni cible trop petite', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  // La faisabilité et la répartition sont sur la page des ressources (3.8).
  await attendreLaPageIrrigation(page, 'ressources');

  // La bulle d'aide de la faisabilité : la ligne B6.2 de la recette.
  const aide = page.getByRole('button', { name: 'Explication : Faisabilité préliminaire' });
  const bulle = page.getByRole('tooltip');
  await epinglerLaBulle(page, aide, bulle);
  await page.getByRole('button', { name: 'Fermer : Faisabilité préliminaire' }).click();
  await expect(bulle).toHaveCount(0);
  await verifierLEtape(page, journal, 'bulle d’aide ouverte puis fermée');

  // Le besoin manuel est plafonné à 500 mm et la ferme de démonstration n'a que
  // trois planches : à elles seules, elles ne peuvent pas épuiser l'eau que les
  // parcours précédents ont créée. Le parcours coupe donc ses propres
  // ressources, comme un été sec, et les rétablit à la fin.
  const ressourcesCoupees = await couperLesRessources(page);
  await verifierLEtape(page, journal, 'ressources rendues indisponibles');

  // Les besoins manuels se posent sur la page des besoins, puis la
  // faisabilité se relit sur celle des ressources.
  await attendreLaPageIrrigation(page, 'besoins');
  const planches = ['N01', 'N02', 'N03'];
  for (const planche of planches) {
    await poserUnBesoinManuel(page, planche, BESOIN_MAXIMAL_MM);
  }
  await verifierLEtape(page, journal, 'besoins manuels posés');
  await attendreLaPageIrrigation(page, 'ressources');

  const faisabilite = page.locator('section').filter({ hasText: 'Faisabilité et répartition' }).last();
  await faisabilite.scrollIntoViewIfNeeded();
  // Les deux dates de l'en-tête sont à la française : la semaine s'affichait en
  // format brut à côté d'une date de calcul déjà mise en forme.
  await expect(faisabilite.locator('.feasibility-meta'))
    .toHaveText(/^Semaine du \d{2}\/\d{2}\/\d{4} au \d{2}\/\d{2}\/\d{4} · Calculé le /);
  // L'écran d'arbitrage façon plan d'assolement (docs/shortage-contract.md,
  // 2 bis, D-083). Le même titre que le choix soit à faire ou à valider de
  // nouveau : les deux largeurs partagent une base, et la seconde hérite de la
  // décision de la première, caduque depuis sa remise en état.
  const arbitrage = faisabilite.locator('section.arbitration-plan').filter({ hasText: 'priorité normale' });
  await expect(arbitrage.getByRole('heading', { name: 'L’eau ne suffit pas pour toutes les planches de priorité normale' }))
    .toBeVisible({ timeout: 30_000 });
  // `has` cherche à l'intérieur de chaque élément filtré : la case s'y désigne
  // depuis la page, et non depuis la section, dont le chemin ne s'y trouve pas.
  const laCase = (planche: string) => page.getByRole('checkbox', { name: new RegExp(`^Servir ${planche} : `) });
  const caseDe = (planche: string) => arbitrage.locator(laCase(planche));
  // Au départ, toutes les planches à choisir sont cochées : c'est la proposition.
  const cases = arbitrage.getByRole('checkbox', { name: /^Servir / });
  const total = await cases.count();
  expect(total, 'au moins les trois planches du parcours').toBeGreaterThanOrEqual(planches.length);
  for (const planche of planches) await expect(caseDe(planche)).toBeChecked();
  const servies = arbitrage.locator('.arbitration-tile').filter({ hasText: 'Planches servies' }).locator('strong');
  await expect(servies).toHaveText(`${total} sur ${total}`);
  // N01, en succession sur la ferme de démonstration : les carottes finies, la
  // mâche à venir. La ligne le dit, la frise le montre.
  const ligneN01 = arbitrage.locator('.arbitration-bed').filter({ has: laCase('N01') });
  await expect(ligneN01).toContainText('Planche nue depuis le');
  await expect(ligneN01).toContainText('Mâche à partir du');
  await expect(ligneN01.locator('.arbitration-crop.is-planned')).toHaveCount(1);
  await verifierLEtape(page, journal, 'arbitrage affiché, toutes les planches cochées');

  // « Ne rien servir » décoche les planches du jardin de N01, puis N01 est
  // recochée : le bilan se recalcule sans rien enregistrer.
  const jardin = arbitrage.locator('.arbitration-garden').filter({ has: laCase('N01') });
  const rienServir = jardin.getByRole('button', { name: /^Ne rien servir/ });
  await rienServir.click();
  for (const planche of planches) await expect(caseDe(planche)).not.toBeChecked();
  await caseDe('N01').check();
  await expect(servies).toHaveText(`${total - 2} sur ${total}`);
  await expect(caseDe('N02')).not.toBeChecked();
  await expect(arbitrage).toContainText('Rien n’est enregistré tant que vous n’avez pas validé.');
  const valider = arbitrage.getByRole('button', { name: 'Valider la répartition' });
  await expect(valider).toBeVisible();
  await verifierCibleTactile(valider, 'le bouton « Valider la répartition »');
  await verifierCibleTactile(rienServir, 'le bouton « Ne rien servir »');
  await verifierCibleTactile(arbitrage.locator('label').filter({ has: laCase('N01') }).first(), 'la case « Servir N01 »');
  await verifierLEtape(page, journal, 'choix fait, rien d’enregistré');

  await valider.click();
  await expect(arbitrage).toContainText('Répartition validée', { timeout: 30_000 });
  await expect(caseDe('N01')).toBeChecked();
  await expect(caseDe('N02')).not.toBeChecked();
  await expect(servies).toHaveText(`${total - 2} sur ${total}`);
  await verifierLEtape(page, journal, 'répartition validée');

  // Remise en état : les parcours partagent une base, des besoins de 500 mm
  // laissés derrière fausseraient tous les suivants.
  await attendreLaPageIrrigation(page, 'besoins');
  for (const planche of planches) {
    await retirerLeBesoinManuel(page, planche);
  }
  await attendreLaPageIrrigation(page, 'ressources');
  await retablirLesRessources(page, ressourcesCoupees);
  // La décision, elle, ne se supprime pas : le logiciel la déclare caduque en
  // recalculant la faisabilité sans pénurie. Le parcours le lui fait faire et
  // le vérifie ; sinon, un dimanche soir, l'eau mobilisable d'ici minuit ne
  // couvrant plus les besoins, elle resterait valide et exclurait les planches
  // des parcours suivants (docs/browser-journeys-contract.md, « ce que le
  // logiciel déduit d'un geste »).
  await faisabilite.getByRole('button', { name: 'Recalculer la faisabilité' }).click();
  await expect(faisabilite.locator('.feasibility-warning').filter({ hasText: 'L’ancien choix entre les demandes d’eau de priorité Normale n’est plus applicable' }))
    .toBeVisible({ timeout: 30_000 });
  await expect(faisabilite).not.toContainText('Répartition validée');
  await verifierLEtape(page, journal, 'état initial rétabli, arbitrage caduc');
});

/** Les ressources actives, rendues indisponibles ; leurs noms pour le retour. */
async function couperLesRessources(page: Page): Promise<string[]> {
  const panneau = page.locator('.water-asset-panel').filter({ hasText: 'Ressources' }).first();
  await panneau.scrollIntoViewIfNeeded();
  const cartes = panneau.locator('.water-asset-card');
  const noms: string[] = [];
  for (const carte of await cartes.all()) {
    if (!(await carte.innerText()).includes('Disponible')) continue;
    noms.push((await carte.locator('strong').first().innerText()).trim());
  }
  for (const nom of noms) await changerLEtatDeLaRessource(page, nom, 'Indisponible');
  return noms;
}

async function retablirLesRessources(page: Page, noms: string[]): Promise<void> {
  for (const nom of noms) await changerLEtatDeLaRessource(page, nom, 'Disponible');
}

async function changerLEtatDeLaRessource(page: Page, nom: string, etat: string): Promise<void> {
  const panneau = page.locator('.water-asset-panel').filter({ hasText: 'Ressources' }).first();
  const carte = panneau.locator('.water-asset-card').filter({ hasText: nom }).first();
  await carte.getByRole('button', { name: 'Modifier' }).click();
  const editeur = page.locator('.water-editor').filter({ hasText: 'Modifier la ressource' });
  await expect(editeur).toBeVisible({ timeout: 15_000 });
  await editeur.getByLabel('État').selectOption({ label: etat });
  await editeur.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(editeur).toBeHidden({ timeout: 15_000 });
  await expect(carte).toContainText(etat, { timeout: 15_000 });
}

function carteDeBesoin(page: Page, planche: string): Locator {
  return page.locator('article.irrigation-need-card').filter({
    has: page.locator('header strong', { hasText: new RegExp(`^${planche}$`) }),
  });
}

/**
 * Les cartes de besoin vivent dans un pli par jardin, replié au chargement :
 * les commandes existent mais restent invisibles tant qu'il n'est pas ouvert.
 */
async function ouvrirLeJardinDe(page: Page, planche: string): Promise<Locator> {
  const carte = carteDeBesoin(page, planche);
  const jardin = page.locator('.irrigation-needs-gardens > details').filter({
    has: page.locator('article.irrigation-need-card header strong', {
      hasText: new RegExp(`^${planche}$`),
    }),
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
  // Un utilisateur clique l'étiquette, pas la case ; le champ n'apparaît qu'une
  // fois la bascule prise en compte par l'écran.
  const bascule = carte.locator('label.need-toggle');
  const champ = carte.getByLabel('Besoin manuel (mm)');
  await expect(async () => {
    if (!(await champ.isVisible())) await bascule.click();
    await expect(champ).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await champ.fill(millimetres);
  await carte.getByLabel('Raison facultative').fill(RAISON);
  await carte.getByRole('button', { name: 'Enregistrer' }).click();
  // Le besoin effectif revenu du serveur, et non l'état local du formulaire.
  await expect(carte).toContainText(`${millimetres} mm`, { timeout: 15_000 });
}

async function retirerLeBesoinManuel(page: Page, planche: string): Promise<void> {
  const carte = await ouvrirLeJardinDe(page, planche);
  const bascule = carte.locator('label.need-toggle');
  const case_ = carte.getByLabel('Remplacer le besoin calculé');
  await expect(async () => {
    if (await case_.isChecked()) await bascule.click();
    await expect(case_).not.toBeChecked({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await carte.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carte.getByLabel('Remplacer le besoin calculé')).not.toBeChecked({ timeout: 15_000 });
}
