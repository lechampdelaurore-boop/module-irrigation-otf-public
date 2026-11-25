import { expect, test, type Page } from '@playwright/test';
import { FARM_CARD_LINES } from '../lib/domain/features/farm-cards.ts';
import { pageDocumentTitle } from '../lib/domain/features/pages.ts';
import { FARM_CARD_PAGES } from '../lib/domain/features/places.ts';
import { attendreLeChoixDesFonctionnalites, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  ouvrirLeMenuDesPages,
  surveillerLaConsole,
  TITRES_DES_PAGES,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P63 : les trois endroits (simplification, lot S3,
 * docs/simplification-s3-contract.md ; D-331 ; docs/browser-journeys-contract.md).
 *
 * PR 1, le rangement et « Ma ferme », aux deux largeurs, sur la ferme de
 * démonstration des parcours, qui a coché toutes les cases d'avant la 3.8 :
 * - « Ma ferme » s'ouvre à son adresse, avec son titre, son « ? » et la
 *   saison ; elle est dans le menu, au-dessus de Réglages (dans la feuille
 *   « Plus » au téléphone), et le menu la marque quand elle est ouverte ;
 * - ses sept fiches, dans l'ordre de la maquette : le nom de la page, sa
 *   ligne fixe, 68 px au moins ; à 390 px, la ligne tient sur deux lignes au
 *   plus ; aucun texte sous 12 px, les graisses de la charte ;
 * - chaque fiche ouvre sa page sans recharger le module, la saison gardée,
 *   le clavier porté sur le contenu ; une autre saison choisie sur « Ma ferme »
 *   suit dans chaque fiche ;
 * - sur une ferme neuve dont la commune n'est pas confirmée, la fiche
 *   « Réglages » dit « À faire : commune de la ferme », en orange, comme le
 *   bandeau « À finir » ; une page non cochée n'a pas de fiche.
 *
 * Rien n'est enregistré sur la ferme des parcours.
 */

const MARQUE = 'p63-sans-rechargement';
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;
const FICHE_MINIMALE_PX = 68;

async function poserLaMarque(page: Page): Promise<void> {
  await page.evaluate((marque) => {
    (window as unknown as Record<string, string>)[marque] = 'posée';
  }, MARQUE);
}

async function laMarque(page: Page): Promise<string | null> {
  return page.evaluate((marque) => (window as unknown as Record<string, string | undefined>)[marque] ?? null, MARQUE);
}

function lesFiches(page: Page) {
  return page.getByRole('navigation', { name: 'Les fiches de Ma ferme' });
}

test('« Ma ferme » : son adresse, ses fiches dans l’ordre, 68 px, une ligne fixe ; le menu la range au-dessus de Réglages', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });

  await attendreLaPageIrrigation(page, 'ma-ferme');
  await expect(page).toHaveTitle(pageDocumentTitle(TITRES_DES_PAGES['ma-ferme']));
  await expect(page.getByRole('button', { name: `Aide : ${TITRES_DES_PAGES['ma-ferme']}` })).toBeVisible();
  // La saison, montrée et transmise à chaque fiche (section 5).
  await expect(page.locator(telephone ? '.page-title-row select[name="season"]' : '.plan-controls select[name="season"]')).toBeVisible();

  // Les sept fiches, dans l'ordre de la maquette, chacune vers sa page.
  const fiches = lesFiches(page).getByRole('link');
  await expect(fiches).toHaveCount(FARM_CARD_PAGES.length);
  for (const [rang, cible] of FARM_CARD_PAGES.entries()) {
    const fiche = fiches.nth(rang);
    await expect(fiche.locator('strong')).toHaveText(TITRES_DES_PAGES[cible]);
    await expect(fiche.locator('.farm-card-line')).toHaveText(FARM_CARD_LINES[cible]);
    await expect(fiche.locator('.farm-card-todo')).toHaveCount(0);
    expect(new URL((await fiche.getAttribute('href'))!, 'http://x').pathname).toBe(`/irrigation/${cible}`);
    const boite = await fiche.boundingBox();
    expect(Math.round(boite!.height), `la fiche « ${TITRES_DES_PAGES[cible]} » mesure ${Math.round(boite!.height)} px`).toBeGreaterThanOrEqual(FICHE_MINIMALE_PX);
  }
  // À 390 px, la ligne fixe tient sur deux lignes au plus (S3-f, mesure rapportée au contrat).
  const lignes = await lesFiches(page).locator('.farm-card-line').evaluateAll((elements) => elements.map((element) => {
    const hauteurDeLigne = Number.parseFloat(getComputedStyle(element).lineHeight);
    return { texte: element.textContent ?? '', lignes: Math.round(element.getBoundingClientRect().height / hauteurDeLigne) };
  }));
  testInfo.annotations.push({ type: 'lignes des fiches', description: lignes.map(({ texte, lignes: nombre }) => `${nombre} × « ${texte} »`).join(' ; ') });
  for (const { texte, lignes: nombre } of lignes) expect(nombre, `« ${texte} » sur ${nombre} lignes`).toBeLessThanOrEqual(telephone ? 2 : 1);
  // La charte : rien sous 12 px, quatre graisses.
  const mesure = await page.evaluate(() => {
    const petits: string[] = [];
    const graisses = new Set<string>();
    for (const element of document.querySelectorAll<HTMLElement>('main .farm-cards *')) {
      const texte = [...element.childNodes].filter((noeud) => noeud.nodeType === Node.TEXT_NODE).map((noeud) => noeud.textContent ?? '').join('').trim();
      if (!texte) continue;
      const style = getComputedStyle(element);
      if (Number.parseFloat(style.fontSize) < 12) petits.push(`${texte.slice(0, 30)} (${style.fontSize})`);
      graisses.add(style.fontWeight);
    }
    return { petits, graisses: [...graisses] };
  });
  expect(mesure.petits).toEqual([]);
  for (const graisse of mesure.graisses) expect(['300', '400', '500', '700']).toContain(graisse);
  await verifierLEtape(page, journal, 'les fiches de « Ma ferme »');

  // Le menu d'avant, avec « Ma ferme » en plus, au-dessus de Réglages, marquée quand elle est ouverte.
  const menu = await ouvrirLeMenuDesPages(page);
  const liens = await menu.getByRole('link').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label') ?? (element as HTMLElement).innerText.trim()));
  expect(liens.slice(-2)).toEqual([TITRES_DES_PAGES['ma-ferme'], TITRES_DES_PAGES.reglages]);
  await expect(menu.getByRole('link', { name: TITRES_DES_PAGES['ma-ferme'], exact: true })).toHaveAttribute('aria-current', 'page');
  if (telephone) {
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }
  await verifierLEtape(page, journal, '« Ma ferme » dans le menu');
});

test('chaque fiche ouvre sa page sans recharger le module, la saison gardée ; une autre saison suit dans les fiches', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });

  for (const cible of FARM_CARD_PAGES) {
    await attendreLaPageIrrigation(page, 'ma-ferme');
    await poserLaMarque(page);
    const saison = new URL(page.url()).searchParams.get('season');
    await lesFiches(page).getByRole('link', { name: new RegExp(`^${TITRES_DES_PAGES[cible]}`) }).click();
    await attendreLaPagePrete(page, cible);
    expect(await laMarque(page), `« ${TITRES_DES_PAGES[cible]} » sans recharger le module`).toBe('posée');
    await expect(page).toHaveURL(new RegExp(`/irrigation/${cible}(\\?|$)`));
    if (saison) expect(new URL(page.url()).searchParams.get('season')).toBe(saison);
    await expect(page.locator('#contenu')).toBeFocused();
    await verifierLEtape(page, journal, `fiche « ${TITRES_DES_PAGES[cible]} »`);
  }

  // Une autre saison, choisie sur « Ma ferme », suit dans chaque fiche (P12).
  await attendreLaPageIrrigation(page, 'ma-ferme');
  const choix = page.locator(telephone ? '.page-title-row select[name="season"]' : '.plan-controls select[name="season"]');
  const actuelle = await choix.inputValue();
  const valeurs = await choix.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  const autre = valeurs.find((valeur) => valeur !== actuelle);
  expect(autre, 'la ferme des parcours a plusieurs saisons').toBeTruthy();
  await choix.selectOption(autre!);
  await expect(page).toHaveURL(new RegExp(`/irrigation/ma-ferme\\?season=${autre}$`));
  await attendreLaPagePrete(page, 'ma-ferme');
  for (const href of await lesFiches(page).getByRole('link').evaluateAll((liens) => liens.map((lien) => lien.getAttribute('href')))) {
    expect(new URL(href!, 'http://x').searchParams.get('season'), href!).toBe(autre);
  }
  await verifierLEtape(page, journal, 'une autre saison dans les fiches');
});

test('une ferme neuve : « À faire » sur la fiche de l’étape à finir ; une page non cochée n’a pas de fiche', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'p63-a-faire');

  // Matériel et alertes météo seulement : la commune de la ferme est à confirmer (la météo, F419).
  await page.goto('/irrigation/bienvenue');
  await attendreLeChoixDesFonctionnalites(page);
  for (const nom of ['Matériel et placement', 'Alertes météo']) await page.getByRole('checkbox', { name: new RegExp(`^${nom}`) }).check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  // Les alertes météo font naître « Aujourd'hui » : c'est la page d'arrivée (F1).
  await attendreLaPagePrete(page, 'aujourdhui');

  await attendreLaPageIrrigation(page, 'ma-ferme');
  const fiches = lesFiches(page).getByRole('link');
  await expect(fiches.locator('strong')).toHaveText([TITRES_DES_PAGES.materiel, TITRES_DES_PAGES['alertes-meteo'], TITRES_DES_PAGES.reglages]);
  // Le bandeau « À finir » nomme la commune ; la fiche « Réglages » le dit aussi.
  await expect(page.locator('.onboarding-unfinished')).toContainText('commune de la ferme');
  const reglages = fiches.filter({ has: page.locator('strong', { hasText: TITRES_DES_PAGES.reglages }) });
  await expect(reglages.locator('.farm-card-todo')).toHaveText('À faire : commune de la ferme');
  await expect(reglages).toHaveAttribute('data-todo', 'true');
  // Orange de la charte (`--warn-ink`), lisible : contraste mesuré sur le blanc de la carte.
  await expect(reglages.locator('.farm-card-todo')).toHaveCSS('color', 'rgb(109, 54, 2)');
  await expect(fiches.filter({ has: page.locator('strong', { hasText: TITRES_DES_PAGES.materiel }) }).locator('.farm-card-todo')).toHaveCount(0);
  await verifierLEtape(page, journal, '« À faire » sur la fiche « Réglages »');
});
