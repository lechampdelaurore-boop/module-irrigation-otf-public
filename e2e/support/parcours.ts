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
 * Les pages du module, une par fonctionnalité, plus « Aujourd'hui » et
 * Réglages (3.8, docs/feature-selection-contract.md, section 5 ; audit
 * ergonomique, lot 2, F1) : un parcours va à la page qui porte le bloc qu'il
 * éprouve.
 */
export const TITRES_DES_PAGES = {
  aujourdhui: 'Aujourd’hui',
  arrosages: 'Arrosages',
  planning: 'Planning de la semaine',
  besoins: 'Objectifs et besoins',
  sol: 'Réserve du sol',
  cultures: 'Besoin par culture',
  materiel: 'Matériel et placement',
  ressources: 'Ressources et pompes',
  'alertes-meteo': 'Alertes météo',
  'alertes-cultures': 'Alertes cultures',
  historique: 'Historique et cumuls',
  reglages: 'Réglages',
} as const;

export type PageDuModule = keyof typeof TITRES_DES_PAGES;

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
  await expect(page.getByRole('heading', { level: 1, name: TITRES_DES_PAGES[cible] })).toBeVisible();
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
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
 * Le menu entier des pages. Au téléphone (audit ergonomique, point 2, 3.8
 * quater lot 2), la barre du bas n'a que quatre entrées : « Plus » ouvre le
 * menu entier en feuille. Un menu de cinq pages ou moins tient tout entier
 * dans la barre, sans « Plus » : c'est elle qu'on lit. À l'ordinateur, le
 * menu de gauche, tel quel.
 */
export async function ouvrirLeMenuDesPages(page: Page): Promise<Locator> {
  const barre = page.getByRole('navigation', { name: 'Pages principales' });
  if (!(await barre.isVisible())) return page.getByRole('navigation', { name: 'Pages du module' });
  const plus = barre.getByRole('button', { name: /^Plus de pages/ });
  if ((await plus.count()) === 0) return barre;
  const menu = page.getByRole('navigation', { name: 'Pages du module' });
  if (!(await menu.isVisible())) await ouvrirParClic(plus, menu);
  return menu;
}

/** La pastille de « Aujourd'hui » s'ajoute à son nom accessible (F12) : « Aujourd’hui, 3 à regarder ». */
const PASTILLE_DANS_LE_NOM = /, \d+ à regarder$/;

/** Le nom accessible d'un lien du menu, sans la pastille de « Aujourd'hui ». */
export function sansLaPastille(nom: string | null): string | null {
  return nom === null ? null : nom.replace(PASTILLE_DANS_LE_NOM, '');
}

/** Le texte affiché de chaque lien du menu, dans l'ordre : « Aujourd'hui » peut porter le nombre de sa pastille. */
export const TEXTES_DES_LIENS_DU_MENU: (string | RegExp)[] = Object.values(TITRES_DES_PAGES)
  // L'encart de « Aujourd'hui » dit aussi « Tableau de bord », et sa pastille quand elle a un nombre.
  .map((titre) => (titre === TITRES_DES_PAGES.aujourdhui ? /^Aujourd’hui\s*Tableau de bord\s*\d*$/ : titre));

/** Les noms des pages du menu, dans l'ordre : le nom accessible, qui reste entier dans la barre du bas, sans la pastille. */
export async function nomsDesPagesDuMenu(page: Page): Promise<string[]> {
  const menu = await ouvrirLeMenuDesPages(page);
  const noms = (await menu.getByRole('link').evaluateAll((liens) => liens.map((lien) => lien.getAttribute('aria-label') ?? (lien as HTMLElement).innerText.trim())))
    .map((nom) => nom.replace(PASTILLE_DANS_LE_NOM, ''));
  // La feuille ouverte se referme : le parcours retrouve la page telle qu'il l'a laissée.
  if ((await menu.getAttribute('data-open')) === 'true') {
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }
  return noms;
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
