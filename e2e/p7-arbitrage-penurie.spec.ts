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
  const groupe = faisabilite.locator('details').filter({ hasText: 'Priorité Normale' });
  // « Choix à faire entre les demandes d’eau » la première fois, « Choix à valider de nouveau »
  // quand une décision antérieure est devenue caduque : les deux largeurs
  // partagent une base, et la seconde hérite de la décision de la première,
  // caduque depuis sa remise en état.
  await expect(groupe).toContainText(/Choix (à faire entre les demandes d’eau|à valider de nouveau)/, { timeout: 30_000 });
  await expect(groupe).toContainText('disponibles au maximum pour');
  // Le pli peut déjà être ouvert : cliquer sans regarder le refermerait.
  const premiereCase = groupe.getByLabel(`Servir ${'N01'}`);
  await expect(async () => {
    if (!(await premiereCase.isVisible())) await groupe.locator('summary').first().click();
    await expect(premiereCase).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await verifierLEtape(page, journal, 'arbitrage affiché');

  // Aucune quantité à saisir : l'écran ne demande qu'un choix de planches.
  for (const planche of planches) {
    await expect(groupe.getByLabel(`Servir ${planche}`)).toBeVisible();
  }
  const valider = groupe.getByRole('button', { name: 'Valider la sélection' });
  await expect(valider).toBeVisible();
  await verifierCibleTactile(valider, 'le bouton « Valider la sélection »');
  await verifierCibleTactile(
    groupe.locator('label').filter({ hasText: `Servir ${planches[0]}` }).first(),
    `l’étiquette « Servir ${planches[0]} »`,
  );

  await groupe.getByLabel(`Servir ${planches[0]}`).check();
  await valider.click();
  await expect(groupe).toContainText('Choix enregistré', { timeout: 30_000 });
  await expect(groupe).toContainText('Dernière décision');
  await verifierLEtape(page, journal, 'arbitrage enregistré');

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
  await expect(groupe).not.toContainText('Choix enregistré');
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
