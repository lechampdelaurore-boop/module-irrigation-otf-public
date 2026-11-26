import { expect, type ConsoleMessage, type Locator, type Page } from '@playwright/test';

/**
 * Outils communs aux parcours navigateur (docs/browser-journeys-contract.md).
 *
 * Deux contrôles s'ajoutent à chaque parcours, à chaque largeur : aucun
 * débordement horizontal, aucune erreur de console. Ils sont écrits une fois
 * ici et appliqués par `verifierLEtape`, pour qu'un parcours ne puisse pas les
 * oublier.
 */
export type JournalDeConsole = { erreurs: string[] };

export function surveillerLaConsole(page: Page): JournalDeConsole {
  const journal: JournalDeConsole = { erreurs: [] };
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') journal.erreurs.push(message.text());
  });
  page.on('pageerror', (error) => journal.erreurs.push(`exception : ${error.message}`));
  page.on('requestfailed', (request) => {
    // Une navigation interrompue par la suivante n'est pas un défaut de la page.
    const raison = request.failure()?.errorText ?? 'inconnue';
    if (raison !== 'net::ERR_ABORTED') journal.erreurs.push(`ressource en échec : ${request.url()} (${raison})`);
  });
  return journal;
}

/**
 * Les pages du module, une par fonctionnalité, plus « Aujourd'hui », « Ma
 * ferme » et Réglages (3.8, docs/feature-selection-contract.md, section 5 ;
 * audit ergonomique, lot 2, F1 ; simplification, lot S3, PR 1), dans l'ordre
 * du menu, celui des trois endroits depuis la PR 3 du lot S3 (Aujourd'hui,
 * Semaine, Ma ferme) : un parcours va à la page qui porte le bloc qu'il
 * éprouve. Depuis le lot S4, « Semaine » réunit le planning, les besoins et
 * l'historique (docs/simplification-s4-contract.md, section 3).
 */
export const TITRES_DES_PAGES = {
  aujourdhui: 'Aujourd’hui',
  arrosages: 'Arrosages',
  semaine: 'Semaine',
  'ma-ferme': 'Ma ferme',
  materiel: 'Matériel et placement',
  ressources: 'Ressources et pompes',
  cultures: 'Besoin par culture',
  sol: 'Réserve du sol',
  'alertes-meteo': 'Alertes météo',
  'alertes-cultures': 'Alertes cultures',
  reglages: 'Réglages',
} as const;

/** Une page du menu, celle dont le titre s'affiche. */
export type PageDuMenu = keyof typeof TITRES_DES_PAGES;

/**
 * Les trois anciennes pages de la semaine (lot S4, section 3.3) : leurs
 * adresses mènent à « Semaine », l'historique sur la vue « Les cumuls ». Un
 * parcours qui les ouvre éprouve aussi la redirection.
 */
const VUE_DES_ANCIENNES_PAGES = { planning: 'La semaine', besoins: 'La semaine', historique: 'Les cumuls' } as const;

/** Une page qu'un parcours ouvre : une page du menu, ou l'une des trois anciennes adresses de la semaine. */
export type PageDuModule = PageDuMenu | keyof typeof VUE_DES_ANCIENNES_PAGES;

/** La page qui s'affiche pour une page ouverte : « Semaine » pour les trois anciennes. */
export function pageAffichee(cible: PageDuModule): PageDuMenu {
  return cible in VUE_DES_ANCIENNES_PAGES ? 'semaine' : (cible as PageDuMenu);
}

/** Le titre qui s'affiche pour une page ouverte. */
export function titreDeLaPage(cible: PageDuModule): string {
  return TITRES_DES_PAGES[pageAffichee(cible)];
}

/**
 * Ouvre une page du module, attend son titre, rendu par le serveur, puis que
 * la page réponde : le gabarit le marque une fois React aux commandes. Chaque
 * fonctionnalité ayant sa page, un parcours en change souvent ; sans cette
 * attente, le premier clic sur chaque page devrait être réessayé.
 */
export async function attendreLaPageIrrigation(page: Page, cible: PageDuModule = 'materiel'): Promise<void> {
  await page.goto(`/irrigation/${cible}`);
  await attendreLaPagePrete(page, cible);
}

/** Après un rechargement ou un lien suivi : le titre de la page, puis la page prête. */
export async function attendreLaPagePrete(page: Page, cible: PageDuModule): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: titreDeLaPage(cible) })).toBeVisible();
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  // L'historique s'ouvre sur « Les cumuls » ; le planning et les besoins sur « La semaine » (lot S4, section 3.3).
  if (cible === 'historique') await expect(page).toHaveURL(/[?&]vue=cumuls(&|#|$)/);
  if (cible === 'planning' || cible === 'besoins') await expect(page).not.toHaveURL(/[?&]vue=cumuls(&|#|$)/);
}

/**
 * Le titre de la page vient du serveur : il est là bien avant que React ne
 * reprenne la main. Un clic envoyé dans cet intervalle ne déclenche rien et le
 * parcours attend ensuite une fenêtre qui ne s'ouvrira jamais. Cliquer jusqu'à
 * ce que la fenêtre paraisse est une attente de condition, pas un délai fixe :
 * dès que la page répond, la boucle s'arrête (docs/browser-journeys-contract.md).
 *
 * À réserver au premier clic d'un parcours, ou au premier clic qui suit un
 * rechargement de la page, qui remet le parcours dans la même situation.
 * Au-delà, la page répond déjà, et réessayer refermerait ce qu'un premier
 * clic vient d'ouvrir quand le bouton est une bascule.
 */
export async function ouvrirParClic(bouton: Locator, attendu: Locator): Promise<void> {
  await expect(async () => {
    await bouton.click();
    await expect(attendu).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

/**
 * Où se lisent les pages. À l'ordinateur, le menu de gauche, tel quel. Au
 * téléphone et à la tablette, jusqu'à 980 px (simplification, lot S3, PR 2,
 * D-331), la barre du bas n'a plus que les trois endroits et le « + » : c'est
 * elle qu'on lit ; les pages se trouvent par leur endroit (`allerALaPage`,
 * `nomsDesPagesDuMenu`).
 */
export async function ouvrirLeMenuDesPages(page: Page): Promise<Locator> {
  const barre = page.getByRole('navigation', { name: 'Pages principales' });
  if (await barre.isVisible()) return barre;
  return page.getByRole('navigation', { name: 'Pages du module' });
}

/**
 * L'endroit de chaque page, tel que le contrat le range (simplification,
 * lot S3, section 3.1) : le parcours le redit, comme le maraîcher le lit
 * dans la barre. Pas d'import du domaine ici : ce fichier est lu aussi par
 * des tests sans chargeur (`tests/parcours-heure.test.ts`), et P63 vérifie
 * sur chaque page que la barre marque bien cet endroit.
 */
const ENDROIT_DES_PAGES: Record<PageDuModule, 'aujourdhui' | 'semaine' | 'ma-ferme'> = {
  aujourdhui: 'aujourdhui',
  arrosages: 'aujourdhui',
  semaine: 'semaine',
  planning: 'semaine',
  besoins: 'semaine',
  historique: 'semaine',
  sol: 'ma-ferme',
  cultures: 'ma-ferme',
  materiel: 'ma-ferme',
  ressources: 'ma-ferme',
  'alertes-meteo': 'ma-ferme',
  'alertes-cultures': 'ma-ferme',
  'ma-ferme': 'ma-ferme',
  reglages: 'ma-ferme',
};

/** La page d'une adresse du module : `/irrigation/materiel?season=2026` → `materiel`. */
function pageDeLAdresse(adresse: string): PageDuMenu {
  const id = new URL(adresse, 'http://module').pathname.replace(/^\/irrigation\//, '');
  if (!(id in TITRES_DES_PAGES)) throw new Error(`« ${adresse} » n’est pas une page du module`);
  return id as PageDuMenu;
}

/** La vue ouverte de « Semaine », d'après l'adresse de la page. */
function vueOuverte(page: Page): 'La semaine' | 'Les cumuls' {
  return new URL(page.url()).searchParams.get('vue') === 'cumuls' ? 'Les cumuls' : 'La semaine';
}

/** La vue d'une ancienne page de la semaine, dans le sélecteur de « Semaine » ou dans le menu de l'ordinateur. */
function lienDeLaVue(conteneur: Locator, cible: keyof typeof VUE_DES_ANCIENNES_PAGES): Locator {
  return conteneur.getByRole('link', { name: VUE_DES_ANCIENNES_PAGES[cible], exact: true });
}

/** Une fiche de « Ma ferme » ou « Tous les arrosages », sur la page ouverte. */
function lienDeLEndroit(page: Page, cible: PageDuMenu): Locator {
  if (cible === 'arrosages') return page.locator('.today-all-irrigations').getByRole('link', { name: 'Tous les arrosages' });
  return page.getByRole('navigation', { name: 'Les fiches de Ma ferme' }).getByRole('link', { name: new RegExp(`^${TITRES_DES_PAGES[cible]} `) });
}

/**
 * Suit le chemin d'une page comme le maraîcher. À l'ordinateur, son lien du
 * menu de gauche ; pour une ancienne page de la semaine, la vue de
 * « Semaine » qui la porte quand le menu la nomme (S4-m), sinon le titre
 * « Semaine ». Au téléphone (S3, section 3), son endroit dans la barre du bas
 * puis, quand la page n'est pas celle où l'endroit mène, sa fiche de « Ma
 * ferme », « Tous les arrosages » ou la vue de « Semaine » de son sélecteur :
 * deux touches au plus, une seule depuis une page du même endroit qui porte
 * déjà le lien. Rend le nombre de touches.
 */
export async function allerALaPage(page: Page, cible: PageDuModule): Promise<number> {
  const barre = page.getByRole('navigation', { name: 'Pages principales' });
  const affichee = pageAffichee(cible);
  if (!(await barre.isVisible())) {
    const menu = page.getByRole('navigation', { name: 'Pages du module' });
    const vue = cible in VUE_DES_ANCIENNES_PAGES ? lienDeLaVue(menu, cible as keyof typeof VUE_DES_ANCIENNES_PAGES) : null;
    // « Aujourd'hui » peut porter le nombre de sa pastille dans son nom.
    await (vue && await vue.count() > 0 ? vue : menu.getByRole('link', { name: new RegExp(`^${TITRES_DES_PAGES[affichee]}(,|$)`) })).click();
    await attendreLaPagePrete(page, cible);
    return 1;
  }
  if (cible !== affichee) return allerALaVue(page, barre, cible as keyof typeof VUE_DES_ANCIENNES_PAGES);
  const lienDirect = affichee === 'semaine' ? null : lienDeLEndroit(page, affichee);
  if (lienDirect && cible !== 'aujourdhui' && cible !== 'ma-ferme' && await lienDirect.isVisible()) {
    await lienDirect.click();
    await attendreLaPagePrete(page, cible);
    return 1;
  }
  let touches = 0;
  const endroit = barre.locator(`li[data-place="${ENDROIT_DES_PAGES[cible]}"]`).getByRole('link');
  const entree = pageDeLAdresse((await endroit.getAttribute('href')) ?? '');
  if ((await endroit.getAttribute('aria-current')) !== 'page') {
    await endroit.click();
    await attendreLaPagePrete(page, entree);
    touches += 1;
  }
  if (entree === cible) return touches;
  await lienDeLEndroit(page, affichee).click();
  await attendreLaPagePrete(page, cible);
  return touches + 1;
}

/** Au téléphone, une ancienne page de la semaine : « Semaine » dans la barre, puis sa vue dans le sélecteur quand elle n'est pas ouverte. */
async function allerALaVue(page: Page, barre: Locator, cible: keyof typeof VUE_DES_ANCIENNES_PAGES): Promise<number> {
  let touches = 0;
  const endroit = barre.locator('li[data-place="semaine"]').getByRole('link');
  if ((await endroit.getAttribute('aria-current')) !== 'page') {
    await endroit.click();
    await attendreLaPagePrete(page, 'semaine');
    touches += 1;
  }
  if (vueOuverte(page) === VUE_DES_ANCIENNES_PAGES[cible]) return touches;
  await lienDeLaVue(page.getByRole('navigation', { name: 'Vues de la semaine' }), cible).click();
  await attendreLaPagePrete(page, cible);
  return touches + 1;
}

/**
 * Les pages qu'on trouve au téléphone par les trois endroits : chaque entrée
 * de la barre du bas, puis, sur la page où elle mène, « Tous les arrosages »,
 * les vues de « Semaine » ou les fiches de « Ma ferme ». Le relevé se fait
 * dans un autre onglet de la même session, à la même largeur : le parcours
 * retrouve sa page telle qu'il l'a laissée.
 */
async function pagesParLesEndroits(page: Page): Promise<Set<PageDuMenu>> {
  const adresses = await page.getByRole('navigation', { name: 'Pages principales' }).locator('li[data-place] a')
    .evaluateAll((liens) => liens.map((lien) => lien.getAttribute('href') ?? ''));
  const trouvees = new Set<PageDuMenu>();
  const onglet = await page.context().newPage();
  try {
    for (const adresse of adresses) {
      const entree = pageDeLAdresse(adresse);
      trouvees.add(entree);
      await onglet.goto(adresse);
      await attendreLaPagePrete(onglet, entree);
      const chemins = entree === 'aujourdhui'
        ? onglet.locator('.today-all-irrigations a')
        : entree === 'ma-ferme'
          ? onglet.getByRole('navigation', { name: 'Les fiches de Ma ferme' }).getByRole('link')
          : onglet.getByRole('navigation', { name: 'Vues de la semaine' }).getByRole('link');
      for (const cible of await chemins.evaluateAll((liens) => liens.map((lien) => lien.getAttribute('href') ?? ''))) trouvees.add(pageDeLAdresse(cible));
    }
  } finally {
    await onglet.close();
  }
  return trouvees;
}

/** La pastille de « Aujourd'hui » s'ajoute à son nom accessible (F12, F287) : « Aujourd’hui, 3 choses à regarder ». */
const PASTILLE_DANS_LE_NOM = /, \d+ choses? à regarder$/;

/** Le nom accessible d'un lien du menu, sans la pastille de « Aujourd'hui ». */
export function sansLaPastille(nom: string | null): string | null {
  return nom === null ? null : nom.replace(PASTILLE_DANS_LE_NOM, '');
}

/**
 * Le texte affiché de chaque lien du menu de l'ordinateur, dans l'ordre, pour
 * une ferme qui a tout coché : « Aujourd'hui » peut porter le nombre de sa
 * pastille ; le titre « Semaine », un lien vers sa page, précède ses deux
 * vues (S4-m) ; « Ma ferme » est le titre de son endroit.
 */
export const TEXTES_DES_LIENS_DU_MENU: (string | RegExp)[] = Object.values(TITRES_DES_PAGES)
  // L'encart de « Aujourd'hui » dit aussi « Tableau de bord », et sa pastille quand elle a un nombre.
  .flatMap((titre): (string | RegExp)[] => (titre === TITRES_DES_PAGES.aujourdhui
    ? [/^Aujourd’hui\s*Tableau de bord\s*\d*$/]
    : titre === TITRES_DES_PAGES.semaine ? [titre, 'La semaine', 'Les cumuls'] : [titre]));

/**
 * Les noms des pages du menu, dans l'ordre. À l'ordinateur, la page où mène
 * chaque lien, une fois : le titre « Semaine » mène à sa page, que ses vues
 * redisent (S4-m) ; les textes eux-mêmes, P28 les lit
 * (`TEXTES_DES_LIENS_DU_MENU`). Au téléphone, les pages trouvées par les
 * trois endroits, dans l'ordre du menu de l'ordinateur (S3, PR 2).
 */
export async function nomsDesPagesDuMenu(page: Page): Promise<string[]> {
  const menu = await ouvrirLeMenuDesPages(page);
  if ((await menu.getAttribute('aria-label')) === 'Pages principales') {
    const trouvees = await pagesParLesEndroits(page);
    return (Object.keys(TITRES_DES_PAGES) as PageDuMenu[]).filter((id) => trouvees.has(id)).map((id) => TITRES_DES_PAGES[id]);
  }
  const adresses = await menu.getByRole('link').evaluateAll((liens) => liens.map((lien) => lien.getAttribute('href') ?? ''));
  return [...new Set(adresses.map(pageDeLAdresse))].map((id) => TITRES_DES_PAGES[id]);
}

/**
 * Une bulle d'aide de la faisabilité s'ouvre au survol et ne s'épingle qu'au
 * clic. Quand la page bouge encore sous le pointeur — un tableau du dessus
 * qui finit de se charger —, le bouton enfoncé n'est plus sous le pointeur
 * au relâché : il n'y a pas de clic, la bulle n'est ouverte que par le survol
 * et se referme au premier défilement, avant « Fermer ». Le parcours écarte
 * donc le pointeur et ne continue qu'avec une bulle restée ouverte, donc
 * épinglée ; sinon il reclique. Comme `ouvrirParClic`, c'est une attente de
 * condition, réservée au premier clic d'un parcours.
 */
export async function epinglerLaBulle(page: Page, bouton: Locator, bulle: Locator): Promise<void> {
  await expect(async () => {
    await bouton.click();
    await page.mouse.move(0, 0);
    await expect(bulle).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

async function verifierAucunDebordementHorizontal(page: Page, etape: string): Promise<void> {
  const mesures = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    fenetre: window.innerWidth,
  }));
  expect(
    mesures.document,
    `Débordement horizontal à l'étape « ${etape} » : document ${mesures.document} px pour une fenêtre de ${mesures.fenetre} px`,
  ).toBeLessThanOrEqual(mesures.fenetre);
}

function verifierAucuneErreurDeConsole(journal: JournalDeConsole, etape: string): void {
  expect(journal.erreurs, `Erreurs de console à l'étape « ${etape} »`).toEqual([]);
}

/** Cible tactile visée par le projet, celle des règles d'accessibilité, déjà appliquée aux boutons. */
const CIBLE_TACTILE_MINIMALE_PX = 44;

/** Une cible tactile trop petite se rate au pouce : le parcours mesure la boîte réelle. */
export async function verifierCibleTactile(cible: Locator, intitule: string): Promise<void> {
  const boite = await cible.boundingBox();
  expect(boite, `${intitule} n’a pas de boîte mesurable`).not.toBeNull();
  expect(
    Math.round(boite!.height),
    `${intitule} mesure ${Math.round(boite!.height)} px de haut, moins que les ${CIBLE_TACTILE_MINIMALE_PX} px visés`,
  ).toBeGreaterThanOrEqual(CIBLE_TACTILE_MINIMALE_PX);
}

/** Les deux contrôles transverses, à appeler après chaque étape visible d'un parcours. */
export async function verifierLEtape(page: Page, journal: JournalDeConsole, etape: string): Promise<void> {
  await verifierAucunDebordementHorizontal(page, etape);
  verifierAucuneErreurDeConsole(journal, etape);
}

/**
 * Le pli « Réglages de cette page », ouvert s'il ne l'est pas déjà : la limite journalière,
 * le seuil de planification, les liaisons et les pompes, le besoin de la culture d'une planche
 * y sont rangés, fermés, en bas de leur page (audit ergonomique final, lot D, J2, F305).
 */
export async function ouvrirLesReglagesDeLaPage(page: Page): Promise<Locator> {
  const pli = page.locator('details#reglages-de-la-page');
  await expect(pli).toHaveCount(1);
  // Sur la page « Semaine », « Réglages de la semaine » est le dernier pli de « Le détail » (S4, PR 2).
  await ouvrirLesPlisAutour(pli);
  if (!(await pli.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await pli.locator(':scope > summary').click();
  }
  await expect(pli).toHaveAttribute('open', '');
  return pli;
}

/**
 * Le pli « Correspondance des espèces » de Réglages, ouvert s'il ne l'est pas
 * déjà : fermé d'office, son compteur en titre (audit du 19 novembre 2026,
 * lot J, n° 15, F459).
 */
export async function ouvrirLaCorrespondanceDesEspeces(page: Page): Promise<Locator> {
  return ouvrirLePli(page.locator('details#correspondance-des-especes'));
}

/**
 * Un onglet de « Matériel » : Plan, Matériel ou Groupes (audit du 19 novembre
 * 2026, lot J, n° 15, F461). Le plan est montré d'office ; l'inventaire et
 * les groupes ne se touchent qu'une fois leur onglet choisi.
 */
export async function ouvrirLOnglet(page: Page, nom: 'Plan' | 'Matériel' | 'Groupes'): Promise<void> {
  const onglet = page.getByRole('tablist', { name: 'Parties de la page' }).getByRole('tab', { name: nom, exact: true });
  await onglet.click();
  await expect(onglet).toHaveAttribute('aria-selected', 'true');
}

/**
 * Un pli de la page ouvert s'il ne l'est pas déjà : ceux d'« Objectifs et
 * besoins » (les objectifs, la météo, la pluie mesurée) sont fermés d'office,
 * une ligne de résumé chacun (audit du 19 novembre 2026, lot J, n° 15, F460).
 */
export async function ouvrirLePli(pli: Locator): Promise<Locator> {
  await expect(pli).toHaveCount(1);
  await ouvrirLesPlisAutour(pli);
  if (!(await pli.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await pli.locator(':scope > summary').click();
  }
  await expect(pli).toHaveAttribute('open', '');
  return pli;
}


/**
 * Les plis fermés qui contiennent l'élément, ouverts du plus extérieur au
 * plus intérieur, comme une personne le fait : sur la page « Semaine », les
 * blocs d'avant sont dans « Le détail », chacun dans le pli de sa section
 * (simplification, lot S4, PR 2, section 7). Rien quand aucun n'est fermé.
 */
export async function ouvrirLesPlisAutour(element: Locator): Promise<void> {
  const fermes = element.first().locator('xpath=ancestor::details[not(@open)]');
  for (let restants = await fermes.count(); restants > 0; restants = await fermes.count()) {
    // L'ordre du document : le premier est le plus extérieur.
    await fermes.first().locator(':scope > summary').click();
    await expect(fermes).toHaveCount(restants - 1);
  }
}

/**
 * Confirme dans la fenêtre du module, qui remplace la boîte du navigateur
 * (audit du 19 novembre 2026, lot G, n° 8, F413) : ce qui efface ou annule se
 * confirme en rouge (F414).
 */
export async function confirmerDansLaFenetre(page: Page, bouton: string): Promise<void> {
  const fenetre = page.locator('dialog.module-confirm-dialog[open]');
  const confirmer = fenetre.getByRole('button', { name: bouton, exact: true });
  await expect(confirmer).toHaveCSS('background-color', 'rgb(220, 53, 69)');
  await confirmer.click();
  await expect(fenetre).toHaveCount(0);
}

/**
 * Ouvre le pli « Le détail » d'« Aujourd'hui » (simplification S2, PR 5) :
 * les tuiles, les jauges, l'eau disponible, la fiabilité entière et les trois
 * jours de « Gel ou chaleur » y sont rangés. Rend le pli ; ne fait rien s'il
 * est déjà ouvert.
 */
export async function ouvrirLeDetailDuJour(page: Page): Promise<Locator> {
  const pli = page.locator('details#today-detail');
  if (!(await pli.evaluate((element) => (element as HTMLDetailsElement).open))) await pli.locator(':scope > summary').click();
  await expect(pli).toHaveJSProperty('open', true);
  return pli;
}
