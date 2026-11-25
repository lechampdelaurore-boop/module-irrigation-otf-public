import { expect, test, type Page } from '@playwright/test';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  ouvrirLaCorrespondanceDesEspeces,
  surveillerLaConsole,
  TITRES_DES_PAGES,
  verifierCibleTactile,
  verifierLEtape,
  type PageDuModule,
} from './support/parcours.ts';

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

  for (const cible of Object.keys(TITRES_DES_PAGES) as PageDuModule[]) {
    await attendreLaPageIrrigation(page, cible);
    // Le chapeau : le titre et son « ? », la saison là où elle sert, rien d'autre (règle 1).
    await expect(page.locator('section.intro .sync-card')).toHaveCount(0);
    await expect(page.locator('a.refresh-link')).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Aide : ${TITRES_DES_PAGES[cible]}` })).toBeVisible();
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
  await expect(page).toHaveURL(new RegExp(`/irrigation/historique\\?season=${autre}$`));
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
 */
const PREMIERS_BLOCS: Record<PageDuModule, { bloc: string; budget: number }> = {
  // 152 → 108 px : la ligne de lecture retirée.
  aujourdhui: { bloc: '.today-head', budget: 120 },
  // 393 → 287 px : la ligne de lecture, la saison et la phrase d'explication. Le premier geste :
  // « Recevoir les alertes sur cet appareil » quand le navigateur n'a pas encore répondu, sinon le formulaire.
  arrosages: { bloc: '.irrigation-events-section :is(.irrigation-notification-readiness, .irrigation-creation-panel)', budget: 400 },
  // 309 → 203 px.
  planning: { bloc: '.planning-heading-actions', budget: 400 },
  // 470 → 391 px : la ligne de résumé de la semaine, sous la navigation des semaines.
  besoins: { bloc: '.water-summary-line', budget: 400 },
  // 283 → 203 px.
  historique: { bloc: '.history-view-tabs', budget: 400 },
  // 417 → 270 px.
  sol: { bloc: '.soil-gauge', budget: 400 },
  // 316 → 169 px.
  cultures: { bloc: '.crop-coefficients-part', budget: 400 },
  // 212 → 168 px : le choix de la parcelle.
  materiel: { bloc: '.parcel-control select', budget: 400 },
  // 340 → 252 px.
  ressources: { bloc: '.water-assets-columns', budget: 400 },
  // 166 → 122 px : « Ajouter une alerte ».
  'alertes-meteo': { bloc: '.weather-alerts-panel .water-panel-title > button', budget: 400 },
  // 395 → 315 px : le premier pli, « Réglages ».
  'alertes-cultures': { bloc: 'details.crop-alert-fold', budget: 400 },
  // 297 → 199 px : les cases des fonctionnalités.
  reglages: { bloc: 'fieldset.feature-choice', budget: 400 },
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
  for (const [cible, { bloc, budget }] of Object.entries(PREMIERS_BLOCS) as [PageDuModule, { bloc: string; budget: number }][]) {
    await attendreLaPageIrrigation(page, cible);
    await expect(page.getByRole('complementary', { name: 'Choix des fonctionnalités' })).toHaveCount(0);
    const haut = await page.locator(bloc).first().evaluate((element) => Math.round(element.getBoundingClientRect().top + window.scrollY));
    expect(haut, `premier bloc utile de « ${TITRES_DES_PAGES[cible]} » à ${haut} px du haut, au-delà de ${budget} px`).toBeLessThanOrEqual(budget);
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
  await expect(page.getByText('Eau visée cette semaine', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Il manque encore', { exact: true }).first()).toBeVisible();

  await attendreLaPageIrrigation(page, 'besoins');
  await expect(page.getByRole('heading', { name: 'Eau visée cette semaine, météo et ressource en eau' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ce qu’il reste à arroser' })).toBeVisible();
  // L'ET0 se dit « soif » (F833) : dans la ligne de résumé au téléphone, sur la tuile à l'ordinateur.
  if (telephone) await expect(page.locator('.water-summary-line')).toContainText('soif de la semaine');
  else await expect(page.getByText('Soif de la semaine', { exact: true }).first()).toBeVisible();

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
  for (const cible of Object.keys(TITRES_DES_PAGES) as PageDuModule[]) {
    await attendreLaPageIrrigation(page, cible);
    const texte = (await page.locator('main').innerText()).toLocaleLowerCase('fr-FR');
    for (const mot of MOTS_DU_CALCUL) {
      const debut = texte.indexOf(mot.toLocaleLowerCase('fr-FR'));
      if (debut >= 0) lus.push(`${TITRES_DES_PAGES[cible]} : « ${mot} » dans « ${texte.slice(Math.max(0, debut - 40), debut + mot.length + 40)} »`);
    }
    await verifierLEtape(page, journal, `mots de ${cible}`);
  }
  expect(lus, 'un mot du calcul se lit d’emblée').toEqual([]);
});
