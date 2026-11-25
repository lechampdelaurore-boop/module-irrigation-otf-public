import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { attendreLeChoixDesFonctionnalites, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import { choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant, soumettreIrrigation } from './support/materiel.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  nomsDesPagesDuMenu,
  ouvrirLeMenuDesPages,
  surveillerLaConsole,
  TITRES_DES_PAGES,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P30 : « Aujourd'hui », tableau de bord du module
 * (docs/aujourdhui-tableau-de-bord-contract.md, sections 3.1 et 3.2 ;
 * docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve qui a tout coché, propre au parcours et à la largeur :
 * à l'ordinateur, « Aujourd'hui » est détaché en tête du menu, dans son
 * encart « Tableau de bord », et les autres pages se rangent sous « Arroser »,
 * « Équiper » et « Surveiller », Réglages à part, dans l'ordre de toujours ;
 * au téléphone, son entrée de la barre du bas est le bouton rond, et la
 * feuille « Plus » garde l'encart et les groupes. La page dit la date, les
 * chiffres de la semaine et ses pastilles ; une pastille mène à son bloc.
 * Les quatre tuiles de la semaine sont des liens, leur mot d'action écrit
 * (docs/aujourdhui-liens-contract.md, L1) : « Objectif de la semaine » ouvre
 * le volet des objectifs, le champ dans l'écran ; « Eau reçue » celui de la
 * pluie mesurée. Rien ne déborde à 390 px.
 *
 * « Tout est fait » (section 3.4), sur une autre ferme neuve : une irrigation
 * planifiée il y a six heures, finie, fait paraître le bouton ; la
 * confirmation la liste cochée, se décoche, « Annuler » n'écrit rien,
 * « Enregistrer 1 irrigation » l'enregistre et le bouton disparaît. À
 * l'ordinateur, la légende de la frise nomme les couleurs de ses barres (T19).
 *
 * Ce qu'il ne prouve pas : les valeurs dessinées (les tests du domaine,
 * `tests/aujourdhui-tableau-de-bord.test.ts`, les chiffrent), la ferme
 * réelle, un vrai téléphone.
 */

const GROUPES = ['Arroser', 'Équiper', 'Surveiller'];

/**
 * T19 : la légende de la frise nomme chaque couleur de barre présente, et
 * seulement celles-là, dans la couleur même de la barre. La frise n'existe
 * que si une irrigation est du jour : à une heure de parcours où celle d'il y
 * a six heures tombe la veille, il n'y a rien à vérifier.
 */
async function verifierLaLegendeDeLaFrise(page: Page): Promise<void> {
  const frise = page.locator('.today-timeline-wrap');
  if ((await frise.count()) === 0) return;
  const tons = (selecteur: string) => frise.locator(selecteur).evaluateAll((elements) =>
    elements.map((element): [string, string] => [element.getAttribute('data-tone') ?? '', getComputedStyle(element).backgroundColor]));
  const barres = new Map(await tons('.today-timeline-bar'));
  const legende = new Map(await tons('.today-legend i'));
  legende.delete('past');
  expect([...legende.keys()].sort()).toEqual([...barres.keys()].sort());
  for (const [ton, fond] of barres) {
    if (ton !== 'proposed') expect(legende.get(ton), `la pastille « ${ton} » de la légende`).toBe(fond);
  }
}

/** La ferme neuve du parcours, toutes les cases cochées, arrivée sur « Aujourd'hui ». */
/** Les noms des jauges qui ne tiennent pas dans leur place (6 nonies, L5, D-314). */
async function nomsCoupes(page: Page): Promise<string[]> {
  return page.locator('.today-bar-name').evaluateAll((noms) => noms
    .filter((nom) => nom.scrollWidth > nom.clientWidth + 1)
    .map((nom) => nom.textContent ?? ''));
}

/** L'heure d'une carte qui déborde sur son texte, en pixels ; 0 quand elles ne se touchent pas (L5, D-314). */
async function recouvrementDeLHeure(page: Page): Promise<number> {
  return page.locator('#today-day .today-irrigation').evaluateAll((cartes) => Math.max(0, ...cartes.map((carte) => {
    const heure = carte.querySelector('.today-irrigation-time strong')?.getBoundingClientRect();
    const texte = carte.querySelector('.today-irrigation-body')?.getBoundingClientRect();
    return heure && texte ? heure.right - texte.left : 0;
  })));
}

/** Rejoue une mesure à 360 px de large, puis rend la largeur du téléphone. */
async function a360px<T>(page: Page, mesure: () => Promise<T>): Promise<T> {
  const avant = page.viewportSize();
  await page.setViewportSize({ width: 360, height: avant?.height ?? 780 });
  try {
    return await mesure();
  } finally {
    if (avant) await page.setViewportSize(avant);
  }
}

async function ouvrirLaFermeToutCoche(page: Page, context: BrowserContext, testInfo: TestInfo, nom: string): Promise<void> {
  await ouvrirUneFermeNeuve(context, testInfo, nom);
  await page.goto('/irrigation/bienvenue');
  await attendreLeChoixDesFonctionnalites(page);
  for (const caseACocher of await page.getByRole('checkbox').all()) {
    if (!(await caseACocher.isChecked())) await caseACocher.check();
  }
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'aujourdhui');
}

test('« Aujourd’hui » détaché dans le menu, les pages en trois groupes, les pastilles qui mènent aux blocs', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await ouvrirLaFermeToutCoche(page, context, testInfo, 'tableau-de-bord');
  await verifierLEtape(page, journal, 'arrivée sur le tableau de bord');

  // Au téléphone, « Votre journée » juste après l'en-tête, avant les tuiles, à l'écran comme dans l'ordre de lecture ;
  // à l'ordinateur, les tuiles d'abord, comme avant (6 nonies, L6, D-315).
  await expect(page.locator('#today-day')).toBeVisible();
  const ordre = await page.evaluate(() => {
    const entete = document.querySelector('.today-head');
    const journee = document.querySelector('#today-day');
    const tuiles = document.querySelector('.today-kpis');
    if (!entete || !journee || !tuiles) return null;
    return {
      journeeAvantLesTuiles: Boolean(journee.compareDocumentPosition(tuiles) & Node.DOCUMENT_POSITION_FOLLOWING),
      basDeLEnTete: entete.getBoundingClientRect().bottom,
      hautDeLaJournee: journee.getBoundingClientRect().top,
      hautDesTuiles: tuiles.getBoundingClientRect().top,
    };
  });
  expect(ordre, 'l’en-tête, la journée et les tuiles').not.toBeNull();
  if (ordre) {
    expect(ordre.journeeAvantLesTuiles, 'ordre de lecture').toBe(telephone);
    expect(ordre.hautDeLaJournee < ordre.hautDesTuiles, 'ordre affiché').toBe(telephone);
    expect(Math.min(ordre.hautDeLaJournee, ordre.hautDesTuiles)).toBeGreaterThanOrEqual(ordre.basDeLEnTete);
  }
  await verifierLEtape(page, journal, 'la journée avant les tuiles au téléphone');

  // Les pages du menu, dans l'ordre de toujours : les groupes n'en changent pas l'ordre (T1).
  expect(await nomsDesPagesDuMenu(page)).toEqual(Object.values(TITRES_DES_PAGES));

  const menu = await ouvrirLeMenuDesPages(page);
  if (telephone) {
    // Au téléphone : le bouton rond de la barre, la page ouverte, puis la feuille « Plus ».
    const barre = page.getByRole('navigation', { name: 'Pages principales' });
    const rond = barre.getByRole('link').first();
    await expect(rond).toHaveAccessibleName(new RegExp(`^${TITRES_DES_PAGES.aujourdhui}`));
    await expect(rond.locator('.menu-home-badge')).toBeVisible();
    await verifierCibleTactile(rond, 'Le bouton rond « Aujourd’hui »');
    // Il dépasse de la barre : son rond monte au-dessus d'elle.
    const hautDuRond = await rond.locator('.menu-home-badge').evaluate((element) => element.getBoundingClientRect().top);
    const hautDeLaBarre = await barre.evaluate((element) => element.getBoundingClientRect().top);
    expect(hautDuRond).toBeLessThan(hautDeLaBarre);
  }
  // L'encart détaché, en tête : son nom, « Tableau de bord » ; puis les trois groupes titrés, Réglages à part.
  const encart = menu.locator('a.menu-home');
  await expect(encart).toHaveCount(1);
  await expect(encart).toContainText('Tableau de bord');
  await expect(encart).toHaveAttribute('aria-current', 'page');
  await expect(menu.locator('.menu-group-title')).toHaveText(GROUPES);
  await expect(menu.locator('.menu-settings-item').getByRole('link')).toHaveAccessibleName(TITRES_DES_PAGES.reglages);
  if (!telephone) {
    // L'encart est au-dessus du premier groupe, et ne prend pas le vert plein d'une page ouverte.
    const basDeLEncart = await encart.evaluate((element) => element.getBoundingClientRect().bottom);
    const hautDuGroupe = await menu.locator('.menu-group-title').first().evaluate((element) => element.getBoundingClientRect().top);
    expect(basDeLEncart).toBeLessThan(hautDuGroupe);
    expect(await encart.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
  } else {
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }
  await verifierLEtape(page, journal, 'menu détaché et groupes');

  // L'en-tête : la date, les chiffres de la semaine, les pastilles.
  await expect(page.locator('.today-head .today-date')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Cette semaine' }).locator('.today-kpi')).toHaveCount(4);
  const pastilles = page.getByRole('navigation', { name: 'Résumé du jour' }).getByRole('link');
  await expect(pastilles.first()).toBeVisible();
  const donnees = pastilles.filter({ hasText: /données? à rafraîchir$/ });
  await expect(donnees).toHaveCount(1);
  if (telephone) await verifierCibleTactile(donnees, 'La pastille des données à rafraîchir');
  await donnees.click();
  await expect(page).toHaveURL(/#today-reliability$/);
  await expect(page.locator('#today-reliability')).toBeInViewport();
  await verifierLEtape(page, journal, 'une pastille mène à son bloc');

  // Les tuiles mènent à leur menu (6 nonies, L1, D-310) : chaque tuile est un lien entier, le mot d'action écrit dessus.
  const tuiles = page.getByRole('region', { name: 'Cette semaine' }).locator('a.today-kpi');
  await expect(tuiles).toHaveCount(4);
  await expect(tuiles.locator('.today-kpi-action')).toHaveText([
    /^(Modifier les objectifs|Poser un objectif)$/,
    /^(Noter une pluie mesurée|Voir jour par jour)$/,
    /^(Voir par planche|Voir ce qui manque)$/,
    'Voir jour par jour',
  ]);
  for (const tuile of await tuiles.all()) {
    await expect(tuile).toHaveAttribute('href', /^\/irrigation\/besoins\?season=\d{4}#/);
    if (telephone) await verifierCibleTactile(tuile, `La tuile « ${await tuile.locator('.today-kpi-label').innerText()} »`);
  }
  // Le nom lu : le titre, le chiffre, puis le mot d'action.
  await expect(tuiles.first()).toHaveAccessibleName(/^Eau visée cette semaine .+ (Modifier les objectifs|Poser un objectif)$/);

  // « Objectif de la semaine » ouvre le volet des objectifs, le champ dans l'écran.
  await tuiles.filter({ hasText: 'Eau visée cette semaine' }).click();
  await expect(page).toHaveURL(/\/irrigation\/besoins\?season=\d{4}#objectifs-de-la-semaine$/);
  await attendreLaPagePrete(page, 'besoins');
  await expect(page.locator('#objectifs-de-la-semaine')).toHaveAttribute('open', '');
  await expect(page.locator('#objectifs-de-la-semaine').getByLabel('mm / semaine')).toBeInViewport();
  await verifierLEtape(page, journal, 'la tuile de l’objectif mène aux objectifs');

  // « Eau reçue » ouvre la pluie mesurée (ou les jours, pour une ferme toute sous abri).
  await page.goBack();
  await attendreLaPagePrete(page, 'aujourdhui');
  const eauRecue = page.getByRole('region', { name: 'Cette semaine' }).locator('a.today-kpi').filter({ hasText: 'Eau reçue' });
  const versLaPluie = (await eauRecue.getAttribute('href'))?.endsWith('#manual-rain') ?? false;
  await eauRecue.click();
  await attendreLaPagePrete(page, 'besoins');
  if (versLaPluie) {
    await expect(page.locator('#manual-rain')).toHaveAttribute('open', '');
    await expect(page.locator('#manual-rain').getByLabel('Millimètres')).toBeInViewport();
  } else {
    await expect(page.locator('#weather')).toBeInViewport();
  }
  await verifierLEtape(page, journal, 'la tuile de l’eau reçue mène à la pluie mesurée');

  // Les jauges mènent à leur page (6 nonies, L2, D-311) : chaque ligne est un lien qui porte sa phrase.
  await page.goBack();
  await attendreLaPagePrete(page, 'aujourdhui');
  // La mise en page, par mesures (L5, D-314) : au téléphone, chaque nom de jardin se lit en entier, à 390 et à
  // 360 px ; à l'ordinateur, un bloc étiré garde son contenu en haut, aucune rangée de titre de plus de 60 px à 1440 px.
  if (telephone) {
    expect(await nomsCoupes(page), 'noms coupés à 390 px').toEqual([]);
    expect(await a360px(page, () => nomsCoupes(page)), 'noms coupés à 360 px').toEqual([]);
  } else {
    const avant = page.viewportSize();
    await page.setViewportSize({ width: 1440, height: avant?.height ?? 900 });
    const titres = await page.locator('.today-block-heading').evaluateAll((rangées) => rangées.map((rangée) => Math.round(rangée.getBoundingClientRect().height)));
    if (avant) await page.setViewportSize(avant);
    expect(titres.length).toBeGreaterThan(0);
    expect(Math.max(...titres), `rangées de titre : ${titres.join(', ')} px`).toBeLessThanOrEqual(60);
  }
  await verifierLEtape(page, journal, 'mise en page mesurée');
  const eauDeLaSemaine = page.locator('#today-week-water');
  const lignesEau = eauDeLaSemaine.locator('a.today-bar-row');
  await expect(lignesEau.first()).toHaveAccessibleName(/^Ferme : /);
  await expect(lignesEau.first()).toHaveAttribute('href', /^\/irrigation\/besoins\?season=\d{4}#irrigation-needs-title$/);
  // Le lien du bloc : en tête à l'ordinateur, en bas au téléphone, jamais les deux.
  await expect(eauDeLaSemaine.getByRole('link', { name: 'Objectifs et besoins', exact: true })).toHaveCount(1);
  await expect(eauDeLaSemaine.locator(telephone ? '.today-block-foot' : '.today-block-more')).toBeVisible();
  if (telephone) {
    for (const ligne of await lignesEau.all()) await verifierCibleTactile(ligne, `La ligne « ${await ligne.locator('.today-bar-name').innerText()} »`);
  }
  if ((await lignesEau.count()) > 1) {
    // Un jardin ouvre son pli dans le tableau des besoins.
    const jardin = lignesEau.nth(1);
    const nom = await jardin.locator('.today-bar-name').innerText();
    await jardin.click();
    await attendreLaPagePrete(page, 'besoins');
    await expect(page).toHaveURL(/#besoin-jardin-/);
    const pli = page.locator(`details${new URL(page.url()).hash}`);
    await expect(pli).toHaveJSProperty('open', true);
    await expect(pli).toContainText(nom);
    await expect(pli.locator(':scope > summary')).toBeInViewport();
    await verifierLEtape(page, journal, 'le jardin de l’eau de la semaine ouvre son pli des besoins');
    await page.goBack();
    await attendreLaPagePrete(page, 'aujourdhui');
  }

  const sol = page.locator('#today-soil');
  const lignesSol = sol.locator('a.today-bar-row');
  if ((await lignesSol.count()) > 0) {
    await expect(sol.getByRole('link', { name: 'Voir le sol', exact: true })).toHaveCount(1);
    const nom = await lignesSol.first().locator('.today-bar-name').innerText();
    await expect(lignesSol.first()).toHaveAccessibleName(new RegExp(`^${nom} : `));
    await lignesSol.first().click();
    await attendreLaPagePrete(page, 'sol');
    await expect(page).toHaveURL(/#soil-garden-/);
    const pli = page.locator(`details${new URL(page.url()).hash}`);
    await expect(pli).toHaveJSProperty('open', true);
    await expect(pli).toBeInViewport();
    await verifierLEtape(page, journal, 'le jardin de la réserve du sol ouvre son pli');
  }
});

test('« Tout est fait » : la confirmation liste l’irrigation passée, « Annuler » n’écrit rien, « Enregistrer » l’enregistre', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  await ouvrirLaFermeToutCoche(page, context, testInfo, 'tout-est-fait');
  const toutEstFait = page.getByRole('button', { name: /^Tout est fait/ });
  // Rien à couvrir sur une ferme neuve : pas de bouton.
  await expect(toutEstFait).toHaveCount(0);

  // Une irrigation planifiée il y a six heures : 25 mm à 10 mm/h, finie depuis plus de trois heures.
  await attendreLaPageIrrigation(page, 'materiel');
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo);
  await attendreLaPageIrrigation(page, 'arrosages');
  await page.getByRole('tab', { name: /^Planifier/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage);
  await page.getByLabel('Date et heure de début').fill(horodatageLocal(-6 * 60, reference));
  await soumettreIrrigation(page, 'Planifier l’irrigation', 'arrosée sans le chrono');

  await attendreLaPageIrrigation(page, 'aujourdhui');
  await expect(toutEstFait).toHaveAccessibleName('Tout est fait (1)');
  if (telephone) await verifierCibleTactile(toutEstFait, 'Le bouton « Tout est fait »');
  await verifierLEtape(page, journal, 'bouton « Tout est fait »');
  // L'heure de la carte ne touche jamais son texte, à 390 et à 360 px comme à l'ordinateur (L5, D-314).
  await expect(page.locator('#today-day .today-irrigation')).not.toHaveCount(0);
  expect(await recouvrementDeLHeure(page), 'l’heure recouvre le texte').toBe(0);
  if (telephone) expect(await a360px(page, () => recouvrementDeLHeure(page)), 'à 360 px').toBe(0);
  if (!telephone) await verifierLaLegendeDeLaFrise(page);

  // Rien n'est écrit au premier clic : la confirmation liste, cochée ; décocher retire du compte.
  await toutEstFait.click();
  const confirmation = page.getByRole('dialog', { name: 'Enregistrer comme faites' });
  await expect(confirmation).toBeVisible();
  const ligne = confirmation.getByRole('checkbox', { name: new RegExp(materiel) });
  await expect(ligne).toBeChecked();
  if (telephone) await verifierCibleTactile(ligne.locator('xpath=..'), 'La ligne à décocher');
  await expect(confirmation).toContainText('telle que prévue');
  await expect(confirmation).toContainText('ne se modifie plus');
  await ligne.uncheck();
  await expect(confirmation.getByRole('button', { name: 'Enregistrer 0 irrigation' })).toBeDisabled();
  await verifierLEtape(page, journal, 'confirmation, la ligne décochée');

  // « Annuler » ferme sans rien écrire : le bouton est toujours là, la ligne cochée à nouveau.
  await confirmation.getByRole('button', { name: 'Annuler' }).click();
  await expect(confirmation).toBeHidden();
  await expect(toutEstFait).toHaveAccessibleName('Tout est fait (1)');
  await toutEstFait.click();
  await expect(ligne).toBeChecked();

  await confirmation.getByRole('button', { name: 'Enregistrer 1 irrigation' }).click();
  await expect(page.locator('.today-notice')).toHaveText('1 irrigation enregistrée comme faite.');
  // Sous « Tout est fait », en tête de « Votre journée », dans l'écran (6 nonies, L4, D-313).
  await expect(page.locator('#today-day > .action-reply .today-notice')).toBeInViewport();
  await expect(confirmation).toBeHidden();
  await expect(toutEstFait).toHaveCount(0);
  await expect(page.locator('#today-day [data-group="late"]')).toHaveCount(0);
  await verifierLEtape(page, journal, 'irrigation enregistrée comme faite');
});
