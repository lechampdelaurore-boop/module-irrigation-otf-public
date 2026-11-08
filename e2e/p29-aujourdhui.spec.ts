import { expect, test, type Locator, type Page } from '@playwright/test';
import { attendreLeChoixDesFonctionnalites, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  ouvrirLeMenuDesPages,
  ouvrirParClic,
  surveillerLaConsole,
  TITRES_DES_PAGES,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P29 : la page « Aujourd'hui » et la zone « Fiabilité du calcul »
 * (audit ergonomique du 7 novembre 2026, points 1 et 3, 3.8 quater lot 2,
 * docs/audit-ergonomie-lot2-contract.md, sections 5 à 8 ; tableau de bord,
 * docs/aujourdhui-tableau-de-bord-contract.md, section 3.2 ;
 * docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve de démonstration qui a tout coché : `/irrigation` et le
 * choix des cases mènent à « Aujourd'hui », première du menu ; ses six blocs
 * sont là, dans l'ordre du tableau de bord, chacun avec sa phrase calme quand
 * il n'a rien à dire ; la saison n'y est pas proposée ; la pastille du menu compte les
 * lignes de « Fiabilité du calcul ». Une alerte météo de l'exploitation,
 * fabriquée par le parcours et franchie par la prévision de démonstration
 * (minimale sous 12 °C), fait passer le bloc « Gel ou chaleur » en barre
 * rouge. Deux manques se corrigent par leur bouton : le plan jamais calculé
 * (« Recalculer le plan ») et le volume d'une cuve jamais saisi (« Saisir le
 * volume de… », qui ouvre sa carte sur « Ressources et pompes ») ; chaque
 * ligne disparaît ensuite et la pastille baisse d'autant. « Observer le sol
 * de… » ouvre, déplié, le jardin qu'il nomme. Tout se passe sur
 * une ferme propre au parcours et à la largeur : rien n'est laissé sur la
 * ferme de démonstration habituelle.
 *
 * Ce qu'il ne prouve pas : le gel des cultures (P21 le prouve, le domaine le
 * chiffre au cas 5), les irrigations en retard et du jour (cas 7 à 9 des
 * tests du domaine), la ferme réelle de 190 périmètres.
 */

const DUREE_DU_PARCOURS = 150_000;
const ECRAN_DU_TELEPHONE_PX = 844;
// T5 : l'ordre du tableau de bord ; le gel annoncé n'est plus remonté en tête, il est dans les pastilles.
const TITRES_DES_BLOCS = ['Votre journée', 'Gel ou chaleur', 'Eau de la semaine', 'Réserve du sol', 'Eau disponible', 'Fiabilité du calcul'];

function blocs(page: Page): Locator {
  return page.locator('.today-page section.today-block');
}

function bloc(page: Page, titre: string): Locator {
  return blocs(page).filter({ has: page.getByRole('heading', { level: 2, name: titre }) });
}

function lignesDeFiabilite(page: Page): Locator {
  return bloc(page, 'Fiabilité du calcul').locator('.reliability-lines > li');
}

/** Le nombre de la pastille de « Aujourd'hui », lu dans le nom du lien du menu ; `null` sans pastille. */
async function pastille(page: Page): Promise<number | null> {
  const menu = await ouvrirLeMenuDesPages(page);
  const nom = await menu.getByRole('link', { name: /^Aujourd’hui/ }).getAttribute('aria-label');
  if ((await menu.getAttribute('data-open')) === 'true') {
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }
  const nombre = nom?.match(/, (\d+) à regarder$/)?.[1];
  return nombre ? Number(nombre) : null;
}

/** Toutes les lignes de la zone, celles du pli comprises. */
async function nombreDeLignesDeFiabilite(page: Page): Promise<number> {
  const plus = bloc(page, 'Fiabilité du calcul').getByRole('button', { name: /^Voir (l’autre|les \d+ autres)$/ });
  if (await plus.count() > 0) await plus.click();
  return lignesDeFiabilite(page).count();
}

test('« Aujourd’hui » ouvre le module : six blocs dans l’ordre, le gel en barre rouge et en pastille, deux manques corrigés par leur bouton, la pastille qui suit', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await ouvrirUneFermeNeuve(context, testInfo, 'aujourdhui');

  // Toutes les cases cochées : le choix mène à « Aujourd'hui » (F1).
  await page.goto('/irrigation/bienvenue');
  await attendreLeChoixDesFonctionnalites(page);
  for (const caseACocher of await page.getByRole('checkbox').all()) {
    if (!(await caseACocher.isChecked())) await caseACocher.check();
  }
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'aujourdhui');
  await expect(page).toHaveURL(/\/irrigation\/aujourdhui(\?|$)/);
  // `/irrigation` seule y mène aussi (F31).
  await page.goto('/irrigation');
  await attendreLaPagePrete(page, 'aujourdhui');
  await expect(page).toHaveURL(/\/irrigation\/aujourdhui(\?|$)/);
  await verifierLEtape(page, journal, 'arrivée sur « Aujourd’hui »');

  // Les six blocs, dans l'ordre ; les blocs sans rien à dire le disent en une phrase (F3).
  await expect(blocs(page).locator('h2')).toHaveText(TITRES_DES_BLOCS);
  await expect(bloc(page, 'Votre journée')).toContainText('Aucune irrigation en retard.');
  await expect(bloc(page, 'Votre journée')).toContainText('Rien à faire aujourd’hui.');
  // L'en-tête : la date en toutes lettres et la phrase du jour.
  await expect(page.locator('.today-head h2')).toHaveText(/^[A-Z][a-zé]+ \d{1,2} [a-zéû]+$/);
  await expect(page.locator('.today-sentence')).not.toBeEmpty();
  await expect(bloc(page, 'Eau disponible')).toContainText('Aucune réserve ni ressource limitée suivie.');
  // La saison n'y est pas proposée (F2) ; le plan jamais calculé se dit en une ligne qui mène au planning.
  await expect(page.locator('select[name="season"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Plan non calculé : ouvrir le planning' })).toBeVisible();
  await verifierLEtape(page, journal, 'six blocs');

  // La zone « Fiabilité du calcul » : le plan jamais calculé, avec son bouton ; le « ? » écrit les seuils.
  const fiabilite = bloc(page, 'Fiabilité du calcul');
  const lignePlan = lignesDeFiabilite(page).filter({ hasText: 'Le plan de la semaine n’a pas été calculé.' });
  await expect(lignePlan).toHaveCount(1);
  const recalculer = lignePlan.getByRole('button', { name: 'Recalculer le plan' });
  const aide = page.getByRole('region', { name: 'Aide : Fiabilité du calcul' });
  await ouvrirParClic(fiabilite.getByRole('button', { name: 'Aide : Fiabilité du calcul' }), aide);
  await expect(aide).toContainText('plus de 7 jours');
  await expect(aide).toContainText('plus de 48 heures');
  await aide.getByRole('button', { name: 'Fermer' }).click();
  if (telephone) await verifierCibleTactile(recalculer, 'Le bouton « Recalculer le plan »');
  const manquesAuDepart = await nombreDeLignesDeFiabilite(page);
  expect(manquesAuDepart).toBeGreaterThanOrEqual(1);
  // La pastille du menu compte les lignes de fiabilité et les retards (F12) : ici, aucun retard.
  await expect.poll(() => pastille(page)).toBe(manquesAuDepart);
  await verifierLEtape(page, journal, 'zone « Fiabilité du calcul »');

  // Un manque corrigé par son bouton : le plan calculé, la ligne disparaît, la pastille baisse.
  await recalculer.click();
  await expect(page.locator('.today-notice')).toHaveText('Plan calculé.', { timeout: 30_000 });
  await expect(lignesDeFiabilite(page).filter({ hasText: 'Le plan de la semaine n’a pas été calculé.' })).toHaveCount(0);
  await expect(page.locator('.today-plan')).toContainText(/^Plan calculé aujourd’hui à \d{1,2} h( \d{2})?$/);
  await expect.poll(() => pastille(page)).toBe(manquesAuDepart - 1 === 0 ? null : manquesAuDepart - 1);
  await verifierLEtape(page, journal, 'plan recalculé, ligne disparue');

  // « Observer le sol de … » ouvre le jardin désigné, déplié, sur « Réserve du sol ».
  const observer = lignesDeFiabilite(page).getByRole('link', { name: /^Observer le sol de / });
  await expect(observer).toHaveCount(1);
  await observer.click();
  await attendreLaPagePrete(page, 'sol');
  await expect(page).toHaveURL(/\/irrigation\/sol\?season=\d{4}#soil-garden-/);
  const jardin = page.locator(`details.soil-garden${new URL(page.url()).hash}`);
  await expect(jardin).toHaveJSProperty('open', true);
  await expect(jardin.locator('.soil-garden-body')).toBeVisible();
  await verifierLEtape(page, journal, 'jardin à observer ouvert par son lien');

  // Une cuve dont le volume n'a jamais été saisi : la ligne, puis son bouton qui ouvre sa carte.
  const cuve = `Cuve P29 ${testInfo.project.name}`;
  await attendreLaPageIrrigation(page, 'ressources');
  await ajouterUneCuveSansVolume(page, cuve);
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await expect(bloc(page, 'Eau disponible')).toContainText(`${cuve} : volume jamais saisi.`);
  const ligneCuve = lignesDeFiabilite(page).filter({ hasText: `Le volume de ${cuve} n’a jamais été saisi.` });
  await expect(ligneCuve).toHaveCount(1);
  const saisir = ligneCuve.getByRole('link', { name: `Saisir le volume de ${cuve}` });
  if (telephone) await verifierCibleTactile(saisir, 'Le lien « Saisir le volume »');
  await saisir.click();
  await attendreLaPagePrete(page, 'ressources');
  await expect(page).toHaveURL(/\/irrigation\/ressources\?season=\d{4}#reservoir-/);
  const carte = page.locator(`.water-asset-card${new URL(page.url()).hash}`);
  await expect(carte).toContainText(cuve);
  await expect(carte).toBeInViewport();
  await verifierLEtape(page, journal, 'carte de la cuve ouverte par son lien');

  await carte.getByRole('button', { name: 'Corriger le volume' }).click();
  const correction = page.locator('form.water-editor').filter({ has: page.getByRole('heading', { name: `Corriger le volume de ${cuve}` }) });
  await correction.getByLabel('Nouveau volume observé (m³)').fill('12');
  await correction.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carte).toContainText('12 m³');

  // De retour : la ligne a disparu, l'eau disponible dit le volume observé aujourd'hui.
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await expect(bloc(page, 'Eau disponible')).toContainText(`${cuve} : 12 m³ sur 20 m³, observé aujourd’hui.`);
  await expect(lignesDeFiabilite(page).filter({ hasText: cuve })).toHaveCount(0);
  await verifierLEtape(page, journal, 'volume saisi, ligne disparue');

  // Une alerte météo de l'exploitation que la prévision de démonstration franchit : le bloc passe en barre rouge.
  const libelle = `Gel P29 ${testInfo.project.name}`;
  await attendreLaPageIrrigation(page, 'alertes-meteo');
  await ajouterUneAlerteDeFroid(page, libelle);
  await attendreLaPageIrrigation(page, 'aujourdhui');
  const meteo = bloc(page, 'Gel ou chaleur');
  await expect(meteo).toHaveAttribute('data-tone', 'alert');
  await expect(meteo).toContainText(new RegExp(`${libelle} : température minimale prévue \\d+(,\\d)? °C le `));
  expect(await meteo.evaluate((element) => getComputedStyle(element).borderLeftColor)).toBe('rgb(220, 53, 69)');
  // L'alerte est dans les pastilles de l'en-tête, qui mènent au bloc.
  const pastilleMeteo = page.getByRole('navigation', { name: 'Résumé du jour' }).getByRole('link', { name: /^Alerte météo / });
  await expect(pastilleMeteo).toHaveAttribute('href', '#today-weather');
  const voirLesAlertes = meteo.getByRole('link', { name: 'Voir les alertes' });
  if (telephone) await verifierCibleTactile(voirLesAlertes, 'Le lien « Voir les alertes »');
  await verifierLEtape(page, journal, 'gel ou froid annoncé en barre rouge');

  // Au téléphone : la barre du bas commence par « Aujourd’hui » ; la phrase du jour et ses pastilles tiennent dans le premier écran (T10).
  if (telephone) {
    const barre = page.getByRole('navigation', { name: 'Pages principales' });
    await expect(barre.getByRole('link').first()).toHaveAttribute('aria-current', 'page');
    await expect(barre.getByRole('link').first()).toHaveAccessibleName(new RegExp(`^${TITRES_DES_PAGES.aujourdhui}`));
    await page.evaluate(() => window.scrollTo(0, 0));
    const bas = await page.locator('.today-sentence').evaluate((element) => element.getBoundingClientRect().bottom);
    expect(bas, `la phrase du jour finit à ${Math.round(bas)} px`).toBeLessThanOrEqual(ECRAN_DU_TELEPHONE_PX);
  }
  await voirLesAlertes.click();
  await attendreLaPagePrete(page, 'alertes-meteo');
  await verifierLEtape(page, journal, 'lien vers les alertes');
});

async function ajouterUneCuveSansVolume(page: Page, nom: string): Promise<void> {
  const panneau = page.locator('article.water-asset-panel').filter({ has: page.getByRole('heading', { name: 'Réserves', exact: true }) });
  const formulaire = page.locator('form.water-editor').filter({ has: page.getByRole('heading', { name: 'Nouvelle réserve' }) });
  await ouvrirParClic(panneau.getByRole('button', { name: '+ Ajouter' }), formulaire);
  await formulaire.getByLabel('Nom').fill(nom);
  await formulaire.getByLabel('Capacité maximale (m³)').fill('20');
  await expect(formulaire.getByLabel('Volume non renseigné')).toBeChecked();
  await formulaire.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(panneau.locator('.water-asset-card').filter({ hasText: nom })).toBeVisible();
}

async function ajouterUneAlerteDeFroid(page: Page, libelle: string): Promise<void> {
  const encart = page.locator('#weather-alerts');
  await encart.scrollIntoViewIfNeeded();
  const formulaire = encart.getByRole('form', { name: 'Nouvelle alerte météo' });
  await ouvrirParClic(encart.getByRole('button', { name: 'Ajouter une alerte' }), formulaire);
  await formulaire.getByLabel('Surveiller').selectOption('minimum-temperature');
  await formulaire.getByLabel('Sens').selectOption('below');
  await formulaire.getByLabel('Seuil, en °C').fill('12');
  await formulaire.getByLabel('Horizon').selectOption('3');
  await formulaire.getByLabel('Libellé facultatif').fill(libelle);
  await formulaire.getByRole('button', { name: 'Enregistrer l’alerte' }).click();
  await expect(encart.locator('.water-notice')).toHaveText('L’alerte météo a été ajoutée. Elle sera évaluée à chaque nouvelle prévision.');
}
