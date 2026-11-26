import { expect, test, type Page } from '@playwright/test';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  ouvrirLaCorrespondanceDesEspeces,
  ouvrirLeDetailDuJour,
  ouvrirLePli,
  surveillerLaConsole,
  TITRES_DES_PAGES,
  titreDeLaPage,
  verifierCibleTactile,
  verifierLEtape,
  type PageDuMenu,
  type PageDuModule,
} from './support/parcours.ts';

/** Chaque page du menu, et la vue « Les cumuls » de « Semaine » par l'ancienne adresse de l'historique (lot S4). */
const PAGES_ET_VUES: readonly PageDuModule[] = [...Object.keys(TITRES_DES_PAGES) as PageDuMenu[], 'historique'];

/**
 * Parcours P61 : simplifier l'usage du module, lot S1, « le chapeau et les
 * mots » (roadmap section 6 terdecies, docs/simplification-s1-contract.md ;
 * D-328 ; docs/browser-journeys-contract.md).
 *
 * PR 1, le chapeau d'une ligne, sur la ferme de démonstration des parcours,
 * au téléphone (390 px) et à l'ordinateur (1 440 px) :
 * - aucune page ne montre la ligne de lecture d'Ouvre ta ferme quand il n'y a
 *   rien à dire (F822 ; les données de démonstration ne viennent d'aucune
 *   lecture, F829) ;
 * - « Actualiser » s'ouvre du menu du compte, avec la date de la dernière
 *   lecture réussie, relit la page et nettoie l'adresse (F823) ;
 * - « Arrosages » ne propose plus la saison ; « Historique et cumuls » ouvre
 *   une autre saison, que l'adresse garde vers « Arrosages » (F824, F825) ;
 * - une explication fixe est passée dans le « ? » (F826) ;
 * - au téléphone, le premier bloc utile de chaque page sous son budget.
 *
 * PR 2, les mots : les mots du tableau se lisent au premier niveau, et aucun
 * mot du calcul ne se lit d’emblée sur les douze pages (voir plus bas).
 *
 * Ce qu'il ne prouve pas : la ligne de lecture quand Ouvre ta ferme échoue ou
 * qu'elle date de plus de 24 heures, que les parcours ne savent pas provoquer
 * (les données de démonstration n'ont pas de lecture) : la règle est chiffrée
 * par tests/simplification-s1.test.ts. Un vrai téléphone, la ferme réelle :
 * recette du porteur.
 */

const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;

async function aLaLargeurDuContrat(page: Page, telephone: boolean): Promise<void> {
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
}

test('aucune page ne montre la ligne de lecture quand tout va bien ; « Actualiser » est dans le menu du compte', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await aLaLargeurDuContrat(page, telephone);

  for (const cible of PAGES_ET_VUES) {
    await attendreLaPageIrrigation(page, cible);
    // Le chapeau : le titre et son « ? », la saison là où elle sert, rien d'autre (règle 1).
    await expect(page.locator('section.intro .sync-card')).toHaveCount(0);
    await expect(page.locator('a.refresh-link')).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Aide : ${titreDeLaPage(cible)}` })).toBeVisible();
    await verifierLEtape(page, journal, `chapeau de ${cible}`);
  }

  // « Actualiser » depuis le menu du compte, sur une page qui porte la saison dans son adresse.
  await attendreLaPageIrrigation(page, 'besoins');
  const adresseAvant = new URL(page.url());
  await page.locator('header.topbar').getByRole('button', { name: /^Compte de / }).click();
  const menu = page.getByRole('menu', { name: 'Compte' });
  const actualiser = menu.getByRole('menuitem', { name: /Actualiser les données d’Ouvre ta ferme/ });
  await expect(actualiser).toBeVisible();
  await expect(actualiser).toContainText(/Dernière lecture réussie le \d{1,2} \S+ \d{4} à \d{1,2} h( \d{2})?/);
  await expect(actualiser).toHaveAttribute('href', /[?&]refresh=1(&|$)/);
  await verifierCibleTactile(actualiser, '« Actualiser » du menu du compte');
  await actualiser.click();
  await attendreLaPagePrete(page, 'besoins');
  // La relecture faite, l'adresse ne garde pas `refresh` : un rechargement ne relit pas Ouvre ta ferme une seconde fois.
  await expect.poll(() => new URL(page.url()).searchParams.has('refresh')).toBe(false);
  expect(new URL(page.url()).pathname).toBe(adresseAvant.pathname);
  await verifierLEtape(page, journal, '« Actualiser » du menu du compte');
});

test('« Arrosages » sans saison ; « Historique et cumuls » ouvre une autre saison, que l’adresse garde', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await aLaLargeurDuContrat(page, telephone);

  await attendreLaPageIrrigation(page, 'arrosages');
  await expect(page.locator('select[name="season"]')).toHaveCount(0);
  await verifierLEtape(page, journal, '« Arrosages » sans saison');

  await attendreLaPageIrrigation(page, 'historique');
  // Dans la ligne du titre au téléphone, sous le titre à l'ordinateur (F7).
  const saison = page.locator(telephone ? '.page-title-row select[name="season"]' : '.plan-controls select[name="season"]');
  await expect(saison).toBeVisible();
  const actuelle = await saison.inputValue();
  const valeurs = await saison.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  const autre = valeurs.find((valeur) => valeur !== actuelle);
  expect(autre, 'la ferme des parcours a plusieurs saisons').toBeTruthy();
  await saison.selectOption(autre!);
  // Depuis le lot S4, l'historique est la vue « Les cumuls » de « Semaine » : le choix de la saison la garde.
  await expect(page).toHaveURL(new RegExp(`/irrigation/semaine\\?season=${autre}&vue=cumuls$`));
  await attendreLaPagePrete(page, 'historique');
  // Les liens vers « Arrosages » gardent la saison choisie (F825).
  const versLesArrosages = page.locator('a[href^="/irrigation/arrosages?"]').first();
  await expect(versLesArrosages).toHaveAttribute('href', new RegExp(`season=${autre}`));
  await page.goto((await versLesArrosages.getAttribute('href'))!);
  await attendreLaPagePrete(page, 'arrosages');
  await expect(page).toHaveURL(new RegExp(`season=${autre}`));
  await expect(page.locator('select[name="season"]')).toHaveCount(0);
  await verifierLEtape(page, journal, 'autre saison depuis l’historique');
});

test('l’explication fixe de « Réserve du sol » est dans son « ? », plus en tête de page', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await aLaLargeurDuContrat(page, testInfo.project.name === 'telephone');
  await attendreLaPageIrrigation(page, 'sol');
  await expect(page.locator('section.soil-reserve')).not.toContainText('tient à la disposition des racines');
  const aide = page.getByRole('region', { name: `Aide : ${TITRES_DES_PAGES.sol}` });
  await expect(aide).toBeHidden();
  await page.getByRole('button', { name: `Aide : ${TITRES_DES_PAGES.sol}` }).click();
  await expect(aide).toBeVisible();
  // Ce que disait la tête de page : la RFU, et que la jauge n'est qu'une information (D-041).
  await expect(aide).toContainText('réserve utile (RFU)');
  await expect(aide).toContainText('C’est une information : elle ne change ni le besoin, ni le plan, ni les priorités.');
  await verifierLEtape(page, journal, '« ? » de la réserve du sol');
});

/**
 * Le premier bloc utile de chaque page (premier champ, première carte,
 * premier tableau), à 390 px, mesuré depuis le haut de la page (contrat,
 * section 3, « Budget »). Avant → après sur les données des parcours, le
 * bandeau du choix des fonctionnalités fermé, le 25 novembre 2026. Visé :
 * 400 px au plus, sauf « Aujourd'hui », dont la carte reste du ressort de S2 :
 * le gain y est la ligne de lecture retirée (44 px).
 *
 * Bornes redites par la simplification S3, PR 2 (contrat S3, sections 5.1
 * et 11 ; D-331), mesurées avant → après à 390 px : la bande « La semaine »
 * (44 px et sa marge) descend de 58 px les trois pages de la semaine ; le
 * retour « ‹ Ma ferme » passe la saison sous le titre quand le titre, le
 * « ? » et la saison ne tiennent plus sur une ligne (38 px, Besoin par
 * culture et Alertes cultures ; Matériel y était déjà).
 */
const PREMIERS_BLOCS: Record<PageDuMenu | 'historique', { bloc: string; budget: number }> = {
  // 152 → 108 px : la ligne de lecture retirée.
  aujourdhui: { bloc: '.today-head', budget: 120 },
  // 393 → 287 px : la ligne de lecture, la saison et la phrase d'explication. Le premier geste : le formulaire ;
  // les alertes du téléphone, dans tous leurs états, passent dessous (S5, PR 3, F908).
  arrosages: { bloc: '.irrigation-events-section .irrigation-creation-panel', budget: 400 },
  // Lot S4, PR 1 (contrat S4, section 10) : une borne pour « Semaine », à la place des trois du planning
  // (261 px avec la bande de S3), des besoins (449 px) et de l'historique (261 px). La vue « La semaine »
  // s'ouvre sur le plan, qui la commence comme il commençait le planning : 215 px, le sélecteur de vue
  // à la place de la bande.
  semaine: { bloc: '.planning-heading-actions', budget: 400 },
  // La vue « Les cumuls », par l'ancienne adresse de l'historique : 215 px (261 px avant).
  historique: { bloc: '.history-view-tabs', budget: 400 },
  // 417 → 270 px.
  sol: { bloc: '.soil-gauge', budget: 400 },
  // 316 → 169 px ; 207 px avec le retour, la saison passée sous le titre (S3, PR 2).
  cultures: { bloc: '.crop-coefficients-part', budget: 400 },
  // 212 → 168 px : le choix de la parcelle.
  materiel: { bloc: '.parcel-control select', budget: 400 },
  // 340 → 252 px.
  ressources: { bloc: '.water-assets-columns', budget: 400 },
  // 166 → 122 px : « Ajouter une alerte ».
  'alertes-meteo': { bloc: '.weather-alerts-panel .water-panel-title > button', budget: 400 },
  // 395 → 315 px : le premier pli, « Réglages » ; 353 px avec le retour, la saison passée sous le titre (S3, PR 2).
  'alertes-cultures': { bloc: 'details.crop-alert-fold', budget: 400 },
  // 297 → 199 px : les cases des fonctionnalités.
  reglages: { bloc: 'fieldset.feature-choice', budget: 400 },
  // Page nouvelle du lot S3 (PR 1, docs/simplification-s3-contract.md, section 5) : la première fiche.
  'ma-ferme': { bloc: '.farm-card', budget: 400 },
};

test('au téléphone, le premier bloc utile de chaque page sous son budget', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'telephone', 'le budget vaut à 390 px');
  test.setTimeout(150_000);
  const journal = surveillerLaConsole(page);
  // Le bandeau du choix des fonctionnalités ne se montre qu'une fois, jusqu'à ce qu'on le ferme (R6, R7) : fermé, comme sur une ferme qui s'en sert.
  await attendreLaPageIrrigation(page, 'aujourdhui');
  const bandeau = page.getByRole('complementary', { name: 'Choix des fonctionnalités' });
  if (await bandeau.count()) {
    await bandeau.getByRole('button', { name: 'Fermer' }).click();
    // La fermeture s'enregistre après coup : une page rechargée ne le montre plus.
    await expect(async () => {
      await page.reload();
      await attendreLaPagePrete(page, 'aujourdhui');
      await expect(bandeau).toHaveCount(0, { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
  }
  for (const [cible, { bloc, budget }] of Object.entries(PREMIERS_BLOCS) as [PageDuMenu | 'historique', { bloc: string; budget: number }][]) {
    await attendreLaPageIrrigation(page, cible);
    await expect(page.getByRole('complementary', { name: 'Choix des fonctionnalités' })).toHaveCount(0);
    const haut = await page.locator(bloc).first().evaluate((element) => Math.round(element.getBoundingClientRect().top + window.scrollY));
    expect(haut, `premier bloc utile de « ${titreDeLaPage(cible)} » (${cible}) à ${haut} px du haut, au-delà de ${budget} px`).toBeLessThanOrEqual(budget);
    await verifierLEtape(page, journal, `premier bloc de ${cible}`);
  }
});

/**
 * PR 2, les mots (contrat, section 4 et section 9.4) : les titres et les
 * étiquettes du premier niveau parlent comme le champ, et aucun mot du calcul
 * de la colonne de gauche ne se lit sur une page, replis fermés et « ? »
 * fermé. Le mot du calcul reste dans le détail : il s'ouvre, il ne se lit pas
 * d'emblée.
 */
const MOTS_DU_CALCUL = [
  'Objectifs hydriques',
  'Objectif hydrique',
  'objectif hebdomadaire',
  'Reste à apporter',
  'Besoins d’irrigation',
  'Faisabilité et répartition',
  'Volume mobilisable',
  'Disponibilité physique',
  'Réserve utile',
  'Culture de référence',
  'Cultures de référence',
  'Correspondance des espèces',
  'Coefficients culturaux',
  'Profils racinaires',
  'Apport horaire',
  'Créneaux protégés',
  'reliquat',
  'Par périmètre',
  'totaux partiels',
];

test('les mots du tableau au premier niveau ; aucun mot du calcul ne se lit d’emblée', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await aLaLargeurDuContrat(page, telephone);

  await attendreLaPageIrrigation(page, 'aujourdhui');
  // Les tuiles de la semaine sont dans « Le détail » depuis S2, PR 5 (D-330) : leurs mots s'y lisent, pli ouvert.
  await ouvrirLeDetailDuJour(page);
  await expect(page.getByText('Eau visée cette semaine', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Il manque encore', { exact: true }).first()).toBeVisible();

  // Depuis le lot S4 (PR 2), les blocs d'« Objectifs et besoins » sont des plis de « Le détail » de la page « Semaine ».
  await attendreLaPageIrrigation(page, 'besoins');
  await ouvrirLePli(page.locator('details#le-detail'));
  await expect(page.getByRole('heading', { name: 'Eau visée cette semaine', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ce qu’il reste à arroser' })).toBeVisible();
  // L'ET0 se dit « soif » (F833) : dans la ligne du pli « Jours de la semaine, un par un », et sur sa tuile.
  const jours = await ouvrirLePli(page.locator('details#weather'));
  await expect(jours.locator(':scope > summary small')).toContainText('soif de la semaine');
  await expect(jours.getByText('Soif de la semaine', { exact: true }).first()).toBeVisible();

  await attendreLaPageIrrigation(page, 'cultures');
  await expect(page.getByText('Réglages fins des cultures (pour les experts)').first()).toBeVisible();

  // La correspondance des espèces vit dans « Réglages » (3.8, précision P3).
  await attendreLaPageIrrigation(page, 'reglages');
  await ouvrirLaCorrespondanceDesEspeces(page);
  await expect(page.getByRole('heading', { level: 2, name: 'À quelle culture ressemble chaque espèce ?' })).toBeVisible();

  // « Heures où l'on n'arrose pas » : le parcours P26, qui pose d'abord un objectif et un plan.

  await attendreLaPageIrrigation(page, 'ressources');
  await expect(page.getByText('Eau utilisable', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Y a-t-il assez d’eau ?' })).toBeVisible();

  const lus: string[] = [];
  for (const cible of PAGES_ET_VUES) {
    await attendreLaPageIrrigation(page, cible);
    const texte = (await page.locator('main').innerText()).toLocaleLowerCase('fr-FR');
    for (const mot of MOTS_DU_CALCUL) {
      const debut = texte.indexOf(mot.toLocaleLowerCase('fr-FR'));
      if (debut >= 0) lus.push(`${titreDeLaPage(cible)} (${cible}) : « ${mot} » dans « ${texte.slice(Math.max(0, debut - 40), debut + mot.length + 40)} »`);
    }
    await verifierLEtape(page, journal, `mots de ${cible}`);
  }
  expect(lus, 'un mot du calcul se lit d’emblée').toEqual([]);
});

/**
 * PR 3, un seul objectif (contrat, section 5 et section 9.6) : « Aujourd'hui »
 * et « Objectifs et besoins » disent le même objectif de la ferme pour la
 * semaine en cours, avec la même phrase, sur la ferme des parcours.
 */
test('« Aujourd’hui » et « Objectifs et besoins » disent le même objectif de la ferme', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await aLaLargeurDuContrat(page, testInfo.project.name === 'telephone');

  await attendreLaPageIrrigation(page, 'aujourdhui');
  await ouvrirLeDetailDuJour(page);
  const tuile = page.locator('a.today-kpi').filter({ has: page.locator('.today-kpi-label', { hasText: 'Eau visée cette semaine' }) });
  const valeur = (await tuile.locator('.today-kpi-value').innerText()).trim();
  const portee = (await tuile.locator('.today-kpi-detail').innerText()).split(', du ')[0].trim();
  await verifierLEtape(page, journal, 'l’objectif d’« Aujourd’hui »');

  await attendreLaPageIrrigation(page, 'besoins');
  // La ligne du pli « Jours de la semaine, un par un » de la page « Semaine », les totaux d'avant (S4, PR 2).
  const ligne = page.locator('details#weather > summary small');
  const phrase = /^\d/.test(valeur) ? `${valeur} visés, ${portee}` : 'aucune eau visée';
  await expect(ligne).toHaveText(new RegExp(`^${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · `));
  await verifierLEtape(page, journal, 'le même objectif sur « Objectifs et besoins »');
});

/**
 * PR 3 bis, l'Historique comme « Aujourd'hui » (contrat, section 5 bis ;
 * D-329) : la semaine en cours de « Historique et cumuls », sur la ferme
 * entière, dit l'objectif d'« Aujourd'hui » : le même chiffre, et, quand une
 * partie seulement des planches en a un, combien. La règle et l'écart se
 * prouvent à deux fermes par tests/simplification-s1-historique.test.ts et
 * tests/db/simplification-s1-historique.test.ts.
 */
test('« Historique et cumuls » dit l’objectif d’« Aujourd’hui » pour la semaine en cours', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await aLaLargeurDuContrat(page, testInfo.project.name === 'telephone');

  await attendreLaPageIrrigation(page, 'aujourdhui');
  await ouvrirLeDetailDuJour(page);
  const tuile = page.locator('a.today-kpi').filter({ has: page.locator('.today-kpi-label', { hasText: 'Eau visée cette semaine' }) });
  const valeur = (await tuile.locator('.today-kpi-value').innerText()).trim();
  const portee = (await tuile.locator('.today-kpi-detail').innerText()).split(', du ')[0].trim();
  await verifierLEtape(page, journal, 'l’objectif d’« Aujourd’hui »');

  // La page s'ouvre sur la semaine en cours, la ferme entière.
  await attendreLaPageIrrigation(page, 'historique');
  const carte = page.locator('article.history-summary-card').filter({ has: page.locator('span', { hasText: /^Objectif$/ }) });
  await expect(carte).toHaveCount(1);
  if (/^\d/.test(valeur)) {
    await expect(carte.locator('strong')).toHaveText(valeur);
    // « ferme entière » ne s'écrit pas sous la carte ; « 7 planches sur 10 ont un objectif » s'y écrit, comme sur « Aujourd'hui ».
    if (portee === 'ferme entière') await expect(carte).not.toContainText(' ont un objectif');
    else await expect(carte.locator('small')).toContainText(portee);
  } else {
    await expect(carte.locator('strong')).toHaveText('Donnée indisponible');
    await expect(carte.locator('small')).toContainText('Aucun objectif sur la période');
  }
  // La phrase F444, la moyenne sur toute la surface, a disparu.
  await expect(page.locator('main')).not.toContainText('comptées à 0');
  await verifierLEtape(page, journal, 'le même objectif sur « Historique et cumuls »');
});
