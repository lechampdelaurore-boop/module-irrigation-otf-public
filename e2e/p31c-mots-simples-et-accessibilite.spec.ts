import { expect, test, type Page } from '@playwright/test';
import { ciblesTropPetites, textesPeuContrastes, type CibleMesuree, type TexteMesure } from './support/accessibilite.ts';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { preparerMaterielArrosant } from './support/materiel.ts';
import { type PageDuModule, attendreLaPageIrrigation, confirmerDansLaFenetre, ouvrirLesReglagesDeLaPage, ouvrirParClic, surveillerLaConsole, verifierLEtape, ouvrirLOnglet } from './support/parcours.ts';

/**
 * Parcours P31c : l'audit ergonomique, lot 3, PR 2 — les mots simples
 * (point 8) et l'accessibilité (point 14) (docs/audit-ergonomie-lot3-contract.md,
 * section 5, cas 12 et 13 ; docs/browser-journeys-contract.md).
 *
 * Sur la ferme de démonstration, sans rien écrire :
 *
 * - « Besoin par culture » : le titre en clair, le détail technique replié
 *   dans « Pour les experts », un seul tableau des K_abri (cas 12) ;
 * - « Matériel » : le nom du réglage séparé des planches couvertes, une
 *   ligne de sens sous « Chevauchements » et « Cumul maximal » ;
 * - « Matériel » au téléphone, à 390 et 360 px : chaque case de planche
 *   fait 44 px de large au moins, sans chevaucher sa voisine ; un jardin de
 *   33 cases, posé pour l'essai à côté du vrai, passe à la ligne (lot D, M1,
 *   F313, F314) ;
 * - « Ressources », sur une ferme neuve sans objectif adopté : « Part
 *   servie », « Couverture confirmée » et chaque tuile « Non calculable » de
 *   la faisabilité disent pourquoi (lot D, N1, F315, F316) ;
 * - toutes les pages : « Aller au contenu » est le premier arrêt du clavier
 *   et mène au contenu ; au téléphone, aucune cible visible sous 44 px de
 *   haut, plis fermés puis tous ouverts ; aux deux largeurs, aucun texte
 *   sous 4,5:1 de contraste (3:1 pour un grand texte), fond calculé par
 *   superposition (cas 13, précisions F49, F69 à F71).
 *
 * Sur une ferme neuve, propre au parcours et à la largeur, une pompe et un
 * matériel archivés, que la ferme de démonstration n'a pas : sur « Ressources
 * et pompes » et « Matériel », archives repliées puis dépliées, les mêmes
 * mesures (point ouvert 62, D-094).
 *
 * Ce qu'il ne prouve pas : le mode sombre et un lecteur d'écran, non vérifiés
 * par ce lot (F50) ; une autre cible ou un autre texte qui n'existe que sur une
 * autre ferme ou dans une fenêtre ouverte par un geste ; un vrai téléphone.
 */

const PAGES: readonly PageDuModule[] = [
  'aujourdhui', 'arrosages', 'planning', 'besoins', 'sol', 'cultures', 'materiel',
  'ressources', 'alertes-meteo', 'alertes-cultures', 'historique', 'reglages',
];

/** Ouvre tous les plis de la page : leurs cibles et leurs textes se mesurent aussi. */
async function ouvrirTousLesPlis(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const pli of document.querySelectorAll('main details')) (pli as HTMLDetailsElement).open = true;
  });
}

test('besoin par culture en mots simples : titre en clair, plis « Pour les experts », un seul tableau des K_abri', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'cultures');
  const section = page.locator('section.crop-coefficients');
  await expect(section.getByRole('heading', { level: 2, name: 'Besoin en eau par culture' })).toBeAttached();
  await expect(section.locator('.crop-coefficients-heading p')).toContainText('Une culture ne boit pas autant à la levée qu’en pleine saison.');
  const experts = section.locator('.crop-coefficients-part > details.experts-fold').first();
  await expect(experts.locator('summary')).toHaveText('Pour les experts');
  await expect(experts.locator('.experts-fold-body')).toBeHidden();
  await experts.locator('summary').click();
  await expect(experts.locator('.experts-fold-body')).toContainText('Les valeurs du CRIIAM Sud s’imposent pour ses légumes');
  // Le résumé d'une culture ne dit plus sa source ni sa courbe : elles sont dans son pli d'experts.
  const carte = section.locator('details.reference-crop-card').first();
  await expect(carte.locator(':scope > summary')).not.toContainText(/CRIIAM Sud|FAO-56|escalier|trapèze/);
  await expect(carte.locator('details.experts-fold')).toContainText(/CRIIAM Sud|FAO-56/);
  // Un seul tableau des K_abri, un seul formulaire ; la formule et le lissage dans le pli d'experts.
  // « Réglages du calcul » est dans le pli « Réglages de cette page » (lot J, n° 15, F457).
  await ouvrirLesReglagesDeLaPage(page);
  const reglages = section.locator('section.crop-water-settings');
  await expect(reglages.getByRole('table', { name: 'K_abri des abris' })).toBeVisible();
  await expect(reglages.getByRole('group', { name: 'Régler un K_abri' })).toHaveCount(1);
  await expect(reglages.getByRole('group', { name: /^Régler le K_abri · / })).toHaveCount(0);
  const options = reglages.getByRole('group', { name: 'Options du calcul' });
  await expect(options.locator('details.experts-fold')).toContainText('ETM = ET0 × K_abri × Kc × K_paillage × K_ombrage');
  await expect(options.locator('details.experts-fold')).toContainText('Lissage des passages de stade');
  // Audit final, lot D, J5 : les cultures de la saison d'abord, les autres dans un pli fermé (F302) ;
  // la formule de l'ombrage quitte l'option visible (F303).
  const vosCultures = section.getByRole('heading', { level: 4, name: /^Vos cultures cette saison \(\d+\)$/ });
  await expect(vosCultures).toBeVisible();
  const autres = section.locator('details.reference-crop-others');
  await expect(autres.locator(':scope > summary')).toHaveText(/^Les autres cultures de référence \(\d+\)$/);
  const cultivees = Number((await vosCultures.innerText()).match(/\((\d+)\)/)![1]);
  expect(await autres.evaluate((element) => (element as HTMLDetailsElement).open), 'le pli des autres cultures fermé, sauf sans culture de la saison').toBe(cultivees === 0);
  await expect(options.locator('label.crop-water-option').filter({ hasText: 'Ombrage' })).not.toContainText('√');
  await expect(options.locator('details.experts-fold')).toContainText('K_ombrage = √(1 − taux du filet)');
  await verifierLEtape(page, journal, 'besoin par culture en clair');
});

test('matériel : le réglage séparé des planches couvertes, une ligne de sens sous les chiffres', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // Une ferme neuve, propre au parcours : un matériel posé fait paraître l'aperçu de l'apport.
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'lot3-mots');
  await attendreLaPageIrrigation(page, 'materiel');
  const { reglage } = await preparerMaterielArrosant(page, testInfo);
  const apercu = page.locator('section.coverage-overview');
  await expect(apercu.locator('.coverage-metric-meaning').first()).toHaveText('Planches arrosées par deux matériels : sans souci si c’est voulu.');
  await expect(apercu.locator('.coverage-metric-meaning').nth(1)).toContainText('à comparer à ce que votre sol absorbe');
  const materiel = apercu.locator('.coverage-equipment-list button').first();
  // Le nom du réglage commence déjà par « Réglage » : il se lit une fois (audit final, lot E, J9, F263).
  await expect(materiel.locator('.coverage-setting-name')).toHaveText(reglage);
  await expect(materiel.locator('small')).toContainText(/couvre \d+ planches?/);
  await verifierLEtape(page, journal, 'matériel en clair');
});

/** Les cases de planche de « Matériel » : leur boîte, et celles qui en chevauchent une autre. */
async function casesDePlanche(page: Page) {
  return page.locator('.bed-strip .plan-bed').evaluateAll((cases) => {
    const boites = cases.map((element) => element.getBoundingClientRect()).filter((boite) => boite.width > 0);
    const chevauchements = boites.filter((boite, index) => boites.some((autre, position) => position !== index
      && boite.left < autre.right && autre.left < boite.right && boite.top < autre.bottom && autre.top < boite.bottom)).length;
    return { nombre: boites.length, plusEtroite: Math.min(...boites.map((boite) => Math.round(boite.width * 10) / 10)), chevauchements };
  });
}

test('« Matériel » à 390 et 360 px : chaque case de planche fait 44 px de large, sans chevaucher sa voisine, même à 33 planches', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'telephone', 'la règle vaut au téléphone (lot D, M1, F313)');
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'materiel');
  for (const largeur of [390, 360]) {
    await page.setViewportSize({ width: largeur, height: 844 });
    const cases = await casesDePlanche(page);
    expect(cases.nombre, 'des cases de planche sur la démonstration').toBeGreaterThan(0);
    expect(cases.plusEtroite, `la case la plus étroite à ${largeur} px`).toBeGreaterThanOrEqual(44);
    expect(cases.chevauchements, `aucune case n'en chevauche une autre à ${largeur} px`).toBe(0);
    // La ferme réelle a jusqu'à 33 planches par jardin (175 en tout) : un jardin de 33 cases, posé à côté du vrai, passe à la ligne (F314).
    await page.locator('.plot-plan-card').first().evaluate((carte) => {
      const bande = carte.querySelector('.bed-strip');
      if (!bande) return;
      const essai = document.createElement('div');
      essai.className = 'bed-strip';
      essai.dataset.essai = 'm1';
      for (let numero = 1; numero <= 33; numero += 1) {
        const cellule = document.createElement('div');
        cellule.className = 'bed-anchor-cell';
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'plan-bed';
        bouton.innerHTML = `<span>B1-${numero}</span>`;
        cellule.appendChild(bouton);
        essai.appendChild(cellule);
      }
      bande.parentNode?.insertBefore(essai, bande.nextSibling);
    });
    const essai = await page.locator('.bed-strip[data-essai="m1"] .plan-bed').evaluateAll((cases) => cases.map((element) => element.getBoundingClientRect()));
    expect(Math.min(...essai.map((boite) => boite.width)), `33 cases à ${largeur} px`).toBeGreaterThanOrEqual(44);
    expect(new Set(essai.map((boite) => Math.round(boite.top))).size, 'les 33 cases passent à la ligne').toBeGreaterThan(1);
    await page.locator('.bed-strip[data-essai="m1"]').evaluate((element) => element.remove());
  }
  await verifierLEtape(page, journal, 'cases de planche de 44 px');
});

test('« Ressources » : chaque « Non calculable » de la faisabilité dit pourquoi, « Part servie » et « Couverture confirmée » comprises', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // Une ferme neuve, propre au parcours : aucun objectif n'y est adopté, le besoin de la semaine n'est pas chiffré (lot D, N1, cas 10).
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'lot-d-n1');
  await attendreLaPageIrrigation(page, 'ressources');
  const section = page.locator('section.feasibility-section');
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator('.feasibility-meta')).toBeVisible({ timeout: 30_000 });
  const partServie = section.locator('.feasibility-summary.is-head > div').filter({ hasText: 'Part servie' });
  await expect(partServie.locator('strong')).toHaveText('Non calculable');
  await expect(partServie.locator('small')).toHaveText(/^besoin non chiffré pour \d+ planches? sans objectif adopté/);
  // Le détail du calcul : « Couverture confirmée » et chaque tuile sans chiffre portent leur raison (F315, F316).
  await ouvrirParClic(section.locator('details.feasibility-calculation > summary'), section.locator('details.feasibility-calculation .feasibility-summary'));
  await expect(section.locator('details.feasibility-calculation')).toContainText('Couverture confirmée : Non calculable (besoin non chiffré pour');
  const nues = await section.locator('.feasibility-summary > div').evaluateAll((tuiles) => tuiles
    .filter((tuile) => tuile.querySelector('strong')?.textContent === 'Non calculable')
    .filter((tuile) => !/non chiffré|non renseigné|inconnue|aucune ressource|une donnée manque/.test(tuile.querySelector('small')?.textContent ?? ''))
    .map((tuile) => tuile.querySelector('span')?.textContent ?? ''));
  expect(nues, 'les tuiles « Non calculable » sans raison').toEqual([]);
  await verifierLEtape(page, journal, 'les « Non calculable » disent pourquoi');
});

test('« Aller au contenu », cibles de 44 px au téléphone et contraste de 4,5:1 sur toutes les pages', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  const cibles: (CibleMesuree & { page: string })[] = [];
  const textes: (TexteMesure & { page: string })[] = [];
  for (const cible of PAGES) {
    await attendreLaPageIrrigation(page, cible);
    if (cible === 'aujourdhui' || cible === 'historique') {
      // Le premier arrêt du clavier saute la barre et le menu.
      await page.locator('body').press('Tab');
      const saut = page.getByRole('link', { name: 'Aller au contenu' });
      await expect(saut).toBeFocused();
      await expect(saut).toBeInViewport();
      await saut.press('Enter');
      await expect(page).toHaveURL(/#contenu$/);
      await expect(page.locator('#contenu')).toBeFocused();
    }
    for (const etat of ['plis fermés', 'plis ouverts'] as const) {
      if (etat === 'plis ouverts') await ouvrirTousLesPlis(page);
      if (telephone) cibles.push(...(await ciblesTropPetites(page)).map((mesure) => ({ ...mesure, page: `${cible}, ${etat}` })));
      textes.push(...(await textesPeuContrastes(page)).map((mesure) => ({ ...mesure, page: `${cible}, ${etat}` })));
    }
    await verifierLEtape(page, journal, `mesures de la page ${cible}`);
  }
  expect(cibles, 'Cibles de moins de 44 px au téléphone').toEqual([]);
  expect(textes, 'Textes sous le contraste minimal').toEqual([]);
});

test('une pompe et un matériel archivés : cibles de 44 px au téléphone et contraste de 4,5:1', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  const cibles: (CibleMesuree & { page: string })[] = [];
  const textes: (TexteMesure & { page: string })[] = [];
  const mesurer = async (etat: string) => {
    if (telephone) cibles.push(...(await ciblesTropPetites(page)).map((mesure) => ({ ...mesure, page: etat })));
    textes.push(...(await textesPeuContrastes(page)).map((mesure) => ({ ...mesure, page: etat })));
  };
  // Une ferme neuve, propre au parcours et à la largeur : la ferme de
  // démonstration n'a ni pompe ni matériel archivé (point ouvert 62, D-094).
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'lot3-archives');
  await attendreLaPageIrrigation(page, 'materiel');
  await creerPuisArchiverUnMateriel(page, 'Ligne archivée');
  await attendreLaPageIrrigation(page, 'ressources');
  await creerPuisArchiverUnePompe(page, 'Pompe archivée');
  await mesurer('ressources, plis fermés');
  await ouvrirTousLesPlis(page);
  await mesurer('ressources, plis ouverts');
  await verifierLEtape(page, journal, 'mesures de la page ressources, une pompe archivée');
  await attendreLaPageIrrigation(page, 'materiel');
  await mesurer('materiel, plan');
  await ouvrirLOnglet(page, 'Matériel');
  await mesurer('materiel, archives repliées');
  const archives = page.getByRole('button', { name: 'Matériels archivés (1)' });
  await archives.click();
  await expect(archives).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.equipment-list[data-archived="true"]')).toContainText('Ligne archivée');
  await mesurer('materiel, archives dépliées');
  await verifierLEtape(page, journal, 'mesures de la page materiel, un matériel archivé');
  expect(cibles, 'Cibles de moins de 44 px au téléphone').toEqual([]);
  expect(textes, 'Textes sous le contraste minimal').toEqual([]);
});

/** Un goutte-à-goutte créé puis archivé : archiver ne se demande qu'une fois, à la fenêtre de confirmation du module (lot G, n° 8). */
async function creerPuisArchiverUnMateriel(page: Page, materiel: string): Promise<void> {
  const fiche = page.locator('dialog[open], [role=dialog]').filter({ hasText: 'Ajouter un matériel' });
  // L'inventaire a son onglet (lot J, n° 15, F461).
  await ouvrirLOnglet(page, 'Matériel');
  await ouvrirParClic(page.getByRole('button', { name: 'Ajouter un matériel' }), fiche);
  await fiche.getByLabel('Nom du matériel').fill(materiel);
  await fiche.locator('label').filter({ hasText: 'Goutte-à-goutte' }).click();
  await fiche.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const carte = page.locator('.equipment-section article').filter({ hasText: materiel });
  await expect(carte).toContainText('Goutte-à-goutte');
  await carte.getByLabel(`Actions pour ${materiel}`).click();
  await carte.getByRole('menuitem', { name: 'Archiver' }).click();
  await confirmerDansLaFenetre(page, 'Archiver le matériel');
  await expect(carte).toHaveCount(0, { timeout: 20_000 });
}

/** Une pompe de 2 m³/h, sans origine, créée puis archivée : sa carte dit « Archivée ». */
async function creerPuisArchiverUnePompe(page: Page, pompe: string): Promise<void> {
  // Les pompes sont dans le pli « Réglages de cette page » (audit final, lot D, J2, F305).
  await ouvrirLesReglagesDeLaPage(page);
  const formulaire = page.locator('form.pump-editor').filter({ has: page.getByRole('heading', { name: 'Nouvelle pompe' }) });
  await ouvrirParClic(page.getByRole('button', { name: '+ Ajouter une pompe' }), formulaire);
  await formulaire.getByLabel('Nom', { exact: true }).fill(pompe);
  await formulaire.getByLabel('Débit maximal (m³/h)').fill('2');
  await formulaire.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(formulaire).toBeHidden({ timeout: 15_000 });
  const carte = page.locator('article.pump-card').filter({ hasText: pompe });
  await carte.getByRole('button', { name: 'Archiver' }).click();
  await expect(carte).toContainText('Archivée', { timeout: 15_000 });
}
