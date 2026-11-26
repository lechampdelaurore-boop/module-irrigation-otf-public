import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierLEtape, titreDeLaPage, type PageDuModule } from './support/parcours.ts';
import { preparerMaterielArrosant } from './support/materiel.ts';

/**
 * Parcours P40 : l'audit ergonomique du 19 novembre 2026, lot J,
 * « Pages courtes au téléphone » (docs/audit-ergonomie-2026-11-19-lot-j-contract.md ;
 * docs/browser-journeys-contract.md).
 *
 * - Un seul titre (n° 18, F456) : sur les six pages dont le premier bloc
 *   redisait le titre, un seul titre visible le dit ; celui du bloc reste
 *   pour les lecteurs d'écran, et les niveaux de titre se suivent sans saut.
 *
 * Ce qu'il ne prouve pas : un vrai lecteur d'écran, la ferme réelle.
 */

/**
 * Le titre de la page et le synonyme que son premier bloc portait. Le
 * planning et l'historique s'ouvrent sur « Semaine » depuis le lot S4 : son
 * titre seul se voit, celui de leur bloc reste aux lecteurs d'écran.
 */
const TITRES_EN_DOUBLE: Partial<Record<PageDuModule, string[]>> = {
  planning: ['Planning de la semaine'],
  sol: ['Réserve du sol'],
  cultures: ['Besoin par culture', 'Besoin en eau par culture'],
  'alertes-meteo': ['Alertes météo'],
  'alertes-cultures': ['Alertes cultures'],
  historique: ['Historique et cumuls', 'Cumuls et historique'],
};

for (const [cible, noms] of Object.entries(TITRES_EN_DOUBLE) as [PageDuModule, string[]][]) {
  test(`un seul titre visible sur « ${titreDeLaPage(cible)} » (${cible}), sans niveau sauté`, async ({ page }) => {
    const journal = surveillerLaConsole(page);
    await attendreLaPageIrrigation(page, cible);
    const lus = await page.locator('main').evaluate((main, attendus) => {
      const titres = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')] as HTMLElement[];
      const visible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 && element.closest('details:not([open]), [hidden], dialog:not([open])') === null;
      };
      const texte = (element: HTMLElement) => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      const enDouble = titres.filter((titre) => visible(titre) && attendus.includes(texte(titre))).map(texte);
      // Les niveaux se suivent : jamais plus d'un niveau de plus que le titre qui précède.
      const sauts: string[] = [];
      let precedent = 0;
      for (const titre of titres.filter((element) => element.closest('[hidden], dialog:not([open])') === null)) {
        const niveau = Number(titre.tagName.slice(1));
        if (precedent > 0 && niveau > precedent + 1) sauts.push(`h${precedent} puis h${niveau} « ${texte(titre)} »`);
        precedent = niveau;
      }
      return { enDouble, sauts };
    }, [titreDeLaPage(cible), ...noms]);
    expect(lus.enDouble, 'le titre n’est dit qu’une fois').toEqual([titreDeLaPage(cible)]);
    expect(lus.sauts, 'aucun niveau de titre sauté').toEqual([]);
    await verifierLEtape(page, journal, `un seul titre sur ${cible}`);
  });
}

/**
 * Les budgets de hauteur au téléphone (section 2 du contrat), mesurés à
 * 390 px, plis fermés, sur les données des parcours. Chaque PR du lot ajoute
 * sa page.
 */
const BUDGETS_AU_TELEPHONE: Partial<Record<PageDuModule, number>> = {
  // PR 2 (F457) : « Réglages du calcul » dans le pli « Réglages de cette page » ; 5 541 → 3 961 px.
  // Les données des parcours n'ont aucune culture de la saison : les 32 cultures de référence
  // s'y montrent ouvertes (F302), d'où 4 000 px ici pour 3 000 sur une ferme qui cultive.
  cultures: 4_000,
  // PR 3 (F458) : les jardins pareils en une barre. Les données des parcours n'ont que quatre
  // jardins, aucun pareil (le regroupement est chiffré par tests/soil-reserve-garden-bars.test.ts).
  // 2 560 px sur les données neuves ; 2 866 px quand P18 à P33 ont saisi et observé le sol de
  // leurs jardins avant lui, comme dans la suite complète : le budget couvre ce second cas.
  sol: 3_000,
  // PR 4 (F459) : « Correspondance des espèces » pliée ; 4 378 → 3 338 px avec les 4 espèces des
  // données des parcours (sur la ferme du porteur, 77 espèces, 8 700 px de moins attendus).
  // 4.5, PR 3, troisième partie (F665) : « Supprimer ma ferme et mes données », un pli fermé en bas
  // de la page ; 3 338 → 3 482 px (CI du 21 novembre 2026), d'où 3 500 au lieu de 3 400.
  // Amélioration n° 3 (F715) : le pli fermé « Messages de la ferme », une ligne de plus ; 3 500 → 3 650 px (3 600 s’écrirait comme un facteur d’unité).
  // Amélioration n° 7 (D-288, F724) : le pli fermé « Journal des modifications », une ligne de
  // plus, 84 px au téléphone (3 704 px en local avec lui et les PR d’en dessous) ; 3 650 → 3 750 px.
  // Toute section nouvelle de « Réglages » se plie.
  reglages: 3_750,
  // PR 5 (F460) : les objectifs, la météo et la pluie mesurée pliés, les tuiles en une ligne, chaque
  // jardin en une ligne compacte ; 4 704 → 2 750 px avec les quatre jardins des données des parcours.
  // Lot S4, PR 1 (contrat S4, sections 2 et 10) : « Semaine » porte le planning puis les besoins, sans rien
  // raccourcir (la PR 1 range) ; sa borne est la somme de celles d'avant, les huit écrans de 844 px du planning
  // (P28) et les 2 800 px des besoins. 3 935 px mesurés en local, la suite jouée jusqu'à P40 sans plan calculé ;
  // le premier niveau de la PR 2 a son propre budget, 1 700 px (section 11).
  semaine: 8 * 844 + 2_800,
  // PR 6 (F461) : trois onglets, le plan d'abord ; au téléphone, les jardins repliés. 1 782 px avec
  // les quatre jardins des données des parcours : le budget du contrat, pour une ferme de dix-huit jardins.
  materiel: 5_300,
};

for (const [cible, budget] of Object.entries(BUDGETS_AU_TELEPHONE) as [PageDuModule, number][]) {
  test(`« ${titreDeLaPage(cible)} » tient sous ${budget} px au téléphone`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'telephone', 'le budget vaut au téléphone');
    const journal = surveillerLaConsole(page);
    await attendreLaPageIrrigation(page, cible);
    const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(hauteur, `hauteur de « ${cible} » à 390 px`).toBeLessThanOrEqual(budget);
    // Rien ne déborde de côté.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await verifierLEtape(page, journal, `hauteur de ${cible}`);
  });
}

test('« Besoin par culture » : « Réglages du calcul » dans le pli des réglages, fermé, qu’un lien ouvre', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'cultures');
  const pli = page.locator('details#reglages-de-la-page');
  await expect(pli).not.toHaveAttribute('open', '');
  await expect(pli.locator('section.crop-water-settings')).toHaveCount(1);
  await page.goto('/irrigation/cultures#crop-water-settings-title');
  await expect(pli).toHaveAttribute('open', '');
  await expect(pli.getByRole('heading', { name: 'Réglages du calcul' })).toBeVisible();
  await verifierLEtape(page, journal, 'réglages du calcul repliés');
});

test('« Réglages » : « Correspondance des espèces » fermée, son compteur en titre, ouverte par son ancre', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'reglages');
  const pli = page.locator('details#correspondance-des-especes');
  await expect(pli).not.toHaveAttribute('open', '');
  await expect(pli.locator(':scope > summary strong')).toHaveText(/^\d+ espèces? à rattacher sur \d+$|^Les \d+ espèces de la saison sont rattachées$/);
  await expect(pli.getByRole('searchbox', { name: 'Chercher une espèce' })).toBeHidden();
  await page.goto('/irrigation/reglages#species-links-title');
  await expect(pli).toHaveAttribute('open', '');
  await expect(pli.getByRole('searchbox', { name: 'Chercher une espèce' })).toBeVisible();
  await verifierLEtape(page, journal, 'espèces repliées');
});

test('« Objectifs et besoins » : trois plis fermés d’une ligne, un jardin par ligne, « À planifier » d’abord', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await attendreLaPageIrrigation(page, 'besoins');
  for (const id of ['objectifs-de-la-semaine', 'meteo-de-reference', 'manual-rain']) {
    const pli = page.locator(`details#${id}`);
    await expect(pli).not.toHaveAttribute('open', '');
    await expect(pli.locator(':scope > summary small')).not.toHaveText('');
  }
  await expect(page.locator('#objectifs-de-la-semaine').getByLabel('mm / semaine')).toBeHidden();
  // Les tuiles : une ligne de résumé au téléphone, qui les déplie ; à l'ordinateur, les tuiles.
  const ligne = page.locator('.water-summary-line');
  const tuiles = page.locator('.water-summary-grid');
  if (telephone) {
    await expect(tuiles).toBeHidden();
    await expect(ligne).toContainText('irrigué');
    await ligne.click();
    await expect(tuiles).toBeVisible();
  } else {
    await expect(ligne).toBeHidden();
    await expect(tuiles).toBeVisible();
  }
  // Un jardin, une ligne de 64 px au plus au téléphone.
  const jardins = page.locator('.irrigation-needs-gardens > details');
  const hauteurs = await jardins.evaluateAll((plis) => plis.map((pli) => (pli.querySelector(':scope > summary') as HTMLElement).getBoundingClientRect().height));
  expect(hauteurs.length).toBeGreaterThan(0);
  if (telephone) expect(Math.max(...hauteurs), 'un jardin replié tient sur une ligne').toBeLessThanOrEqual(64);
  // Une planche ouverte : « À planifier » puis le besoin réel ; le reste dans « Pour les experts », fermé.
  const premier = jardins.first();
  await premier.locator(':scope > summary').click();
  const carte = premier.locator('article.irrigation-need-card').first();
  await expect(carte.locator(':scope > .need-primary > span > small')).toHaveText([/^À planifier/, /^Besoin réel/]);
  const experts = carte.locator('details.need-experts');
  await expect(experts).not.toHaveAttribute('open', '');
  await experts.locator(':scope > summary').click();
  await expect(experts.locator('.need-primary > span > small')).toHaveText([/^Besoin effectif/, /^Volume/, /^Déficit relatif/]);
  // Le lien vers la pluie mesurée (« Aujourd’hui », « Historique ») ouvre son pli.
  await page.goto('/irrigation/besoins#manual-rain');
  await expect(page.locator('details#manual-rain')).toHaveAttribute('open', '');
  await expect(page.locator('details#manual-rain').getByLabel('Millimètres')).toBeVisible();
  await verifierLEtape(page, journal, 'objectifs et besoins courts');
});

test('« Matériel » : trois onglets gardés dans l’adresse, les jardins repliés au téléphone, le fil d’Ariane à l’écran', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await attendreLaPageIrrigation(page, 'materiel');
  const onglets = page.getByRole('tablist', { name: 'Parties de la page' }).getByRole('tab');
  await expect(onglets).toHaveText(['Plan', 'Matériel', 'Groupes']);
  await expect(onglets.first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('section.farm-plan')).toBeVisible();
  await expect(page.locator('section.coverage-overview')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter un matériel' })).toBeHidden();
  // Le fil d'Ariane passe à la ligne : il ne sort pas de l'écran.
  const fil = await page.locator('nav.breadcrumb').evaluate((nav) => ({ scroll: nav.scrollWidth, client: nav.clientWidth }));
  expect(fil.scroll, 'le fil d’Ariane tient dans sa largeur').toBeLessThanOrEqual(fil.client + 1);
  // Au téléphone, un jardin replié tient sur une ligne ; celui de la planche choisie est ouvert.
  if (telephone) {
    const jardins = page.locator('.plot-plan-card');
    const ouverts = await jardins.evaluateAll((cartes) => cartes.map((carte) => carte.getAttribute('data-open')));
    expect(ouverts.filter((valeur) => valeur === 'true').length, 'un seul jardin ouvert').toBe(1);
    const replie = jardins.nth(ouverts.indexOf('false'));
    const hauteur = await replie.evaluate((carte) => carte.getBoundingClientRect().height);
    expect(hauteur, 'un jardin replié sur une ligne').toBeLessThanOrEqual(64);
    await replie.locator('.plot-card-toggle').click();
    await expect(replie.locator('.plot-card-body')).toBeVisible();
  }
  // L'onglet « Matériel » : l'inventaire, et l'adresse le garde.
  await onglets.nth(1).click();
  await expect(page.getByRole('button', { name: 'Ajouter un matériel' })).toBeVisible();
  await expect(page.locator('section.farm-plan')).toBeHidden();
  await expect(page).toHaveURL(/[?&]onglet=materiel\b/);
  await page.reload();
  await attendreLaPagePrete(page, 'materiel');
  await expect(page.getByRole('tablist', { name: 'Parties de la page' }).getByRole('tab', { name: 'Matériel' })).toHaveAttribute('aria-selected', 'true');
  // « Groupes » : les groupes de jardins alignés.
  await page.getByRole('tablist', { name: 'Parties de la page' }).getByRole('tab', { name: 'Groupes' }).click();
  await expect(page).toHaveURL(/[?&]onglet=groupes\b/);
  await expect(page.locator('#materiel-panel-groupes')).toBeVisible();
  await expect(page.locator('#materiel-panel-materiel')).toBeHidden();
  await verifierLEtape(page, journal, 'matériel en onglets');
});

test('« Arrosages » attend le premier choix ; « Historique » plie ses filtres et exporte après les chiffres', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // PR 7 (F462) : sans matériel ni quantité, pas de chiffres, une phrase qui dit quoi choisir ; le bouton reste.
  await attendreLaPageIrrigation(page, 'arrosages');
  if (await page.locator('.irrigation-empty-action').isVisible()) {
    // Seul ou en tête de suite, aucun matériel n'est encore prêt : le parcours en pose un, comme P1.
    await attendreLaPageIrrigation(page, 'materiel');
    await preparerMaterielArrosant(page, testInfo, { repere: 'p40' });
    await attendreLaPageIrrigation(page, 'arrosages');
  }
  // « Arroser maintenant » (simplification S5) : aucune durée choisie sans dose du jour, le bouton dit ce qui manque.
  await page.getByRole('tab', { name: /^Arroser maintenant/ }).click();
  const formulaire = page.locator('.watering-now');
  await expect(formulaire.locator('.watering-duration strong')).toHaveText('—');
  await expect(formulaire.locator('.watering-result')).toHaveCount(0);
  await expect(formulaire.locator('.watering-missing')).toHaveText(/^Choisissez (où arroser|une durée)\.$/);
  await expect(formulaire.locator('.start-irrigation-button')).toBeDisabled();

  // L'historique : le pli « Filtrer » fermé dit le périmètre ; l'export, secondaire, suit les chiffres.
  await attendreLaPageIrrigation(page, 'historique');
  const pli = page.locator('details.history-filter-fold');
  await expect(pli).not.toHaveAttribute('open', '');
  await expect(pli.locator('summary')).toHaveText(/Filtrer\s*toute la ferme/);
  await expect(pli.getByText('Parcelle', { exact: true })).toBeHidden();
  const chiffres = await page.locator('.history-summary-grid').boundingBox();
  const exporter = page.locator('a.history-export-button');
  const bouton = await exporter.boundingBox();
  // Secondaire : le fond clair des autres boutons de la page, plus le vert plein.
  await expect(exporter).not.toHaveCSS('color', 'rgb(255, 255, 255)');
  expect(bouton && chiffres && bouton.y >= chiffres.y + chiffres.height, 'l’export après les chiffres').toBe(true);
  await pli.locator('summary').click();
  await expect(pli.getByText('Parcelle', { exact: true })).toBeVisible();
  await verifierLEtape(page, journal, 'premier geste plus haut');
});
