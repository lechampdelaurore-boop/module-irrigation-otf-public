import { expect, test, type Page } from '@playwright/test';
import { FARM_CARD_LINES } from '../lib/domain/features/farm-cards.ts';
import { pageDocumentTitle } from '../lib/domain/features/pages.ts';
import { FARM_CARD_PAGES, PLACE_IDS, placeOfPage } from '../lib/domain/features/places.ts';
import { attendreLeChoixDesFonctionnalites, ouvrirUneFermeNeuve, ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { horodatageLocal } from './support/materiel.ts';
import {
  allerALaPage,
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  ouvrirLeMenuDesPages,
  ouvrirParClic,
  surveillerLaConsole,
  pageAffichee,
  TITRES_DES_PAGES,
  titreDeLaPage,
  verifierCibleTactile,
  verifierLEtape,
  type PageDuMenu,
  type PageDuModule,
} from './support/parcours.ts';

/**
 * Parcours P63 : les trois endroits (simplification, lot S3,
 * docs/simplification-s3-contract.md ; D-331 ; docs/browser-journeys-contract.md).
 *
 * PR 1, le rangement et « Ma ferme », aux deux largeurs, sur la ferme de
 * démonstration des parcours, qui a coché toutes les cases d'avant la 3.8 :
 * - « Ma ferme » s'ouvre à son adresse, avec son titre, son « ? » et la
 *   saison ; elle est dans le menu, au-dessus de Réglages (dans la feuille
 *   « Plus » au téléphone avant la PR 2), et le menu la marque quand elle
 *   est ouverte ;
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
 * PR 2, la barre du bas, le « + » et le chemin de retour (sections 3.3, 3.4,
 * 4, 4.1 et 5.1) :
 * - au téléphone, sur chacune des treize pages ouverte par son adresse : la
 *   barre porte « Aujourd'hui », « Semaine », le « + » et « Ma ferme »,
 *   l'endroit de la page marqué (`page` sur la page où il mène, `true`
 *   ailleurs dans l'endroit) ; depuis le lot S4, le sélecteur des deux vues
 *   de « Semaine », à toute largeur, à la place de la bande « La semaine »,
 *   la vue ouverte marquée, la saison gardée, 44 px ; le retour « ‹ Ma
 *   ferme » sur les pages de « Ma ferme », 44 px ; à 320 px, rien ne déborde
 *   et aucun nom n'est coupé ; la page introuvable garde sa barre. À
 *   l'ordinateur, rien de cela : le menu de gauche marque la page ;
 * - une tournée de toutes les pages, chacune à deux touches au plus de la
 *   précédente (une à l'ordinateur), sans recharger le module, le clavier sur
 *   le contenu, les touches notées ;
 * - sur une ferme neuve propre au parcours et à la largeur : le « + » ouvre la
 *   feuille modale « Que voulez-vous faire ? », ses trois gestes de 72 px ;
 *   Échap et le voile la referment, le clavier revient au « + » ; « Noter la
 *   pluie » y monte la fenêtre de S2, 8 mm s'enregistrent, la réponse sous le
 *   geste, la page relue à la fermeture et la mesure dite à la réouverture ;
 *   « Arroser maintenant » et « Noter un arrosage déjà fait » ouvrent
 *   « Arrosages » sur leur formulaire, la demande retirée de l'adresse.
 *
 * PR 3, le menu de l'ordinateur (section 6), à 1 440 px :
 * - sur chacune des treize pages, les trois endroits dépliés, la page
 *   marquée `page` une seule fois, le titre de son endroit `page` quand il
 *   est la page, `true` sinon ; le titre « Semaine » mène à sa page,
 *   ses deux vues dessous (lot S4, S4-m) ; « Ma ferme » est le titre de son endroit, ses fiches dessous dans
 *   le même ordre, Réglages comprise ; la page introuvable garde son menu,
 *   sans marque, le « + » compris ;
 * - le « + Arroser ou noter » en tête du menu ouvre la même feuille, en boîte
 *   de dialogue au milieu de la page, sans poignée : le même parcours qu'au
 *   téléphone, sur une autre ferme neuve.
 *
 * Rien n'est enregistré sur la ferme des parcours : la pluie s'écrit sur la
 * ferme neuve.
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

/**
 * La forme de la ligne d'état de chaque fiche (lot S6, PR 3, section 7.2) ; « Alertes cultures » garde sa ligne
 * fixe (repli gardé). Une fiche porte l'une ou l'autre, et le dit par `data-line`.
 */
const LIGNES_D_ETAT: Readonly<Record<(typeof FARM_CARD_PAGES)[number], RegExp | null>> = {
  materiel: /^(\d+ goutte-à-goutte|\d+ aspersions?)( et \d+ aspersions?)?, (tous posés|posé|pas posé|aucun posé|\d+ pas posés?)$/u,
  ressources: /^(.+ : débit de .+ m³\/h|.+ : (volume jamais saisi|.+ m³ sur .+ m³, .+)|\d+ ressources?( et \d+ réserves?, .+ cette semaine)?|\d+ réserves?, .+ cette semaine)$/u,
  cultures: /^(\d+ cultures? cette saison|Aucune culture ne sert à vos séries cette saison)$/u,
  sol: /^(Sol connu pour \d+ parcelles? sur \d+|À renseigner pour \d+ parcelles?)$/u,
  'alertes-meteo': /^(Aucune alerte réglée|\d+ alertes? réglées?(, \d+ inactives?)?)$/u,
  'alertes-cultures': null,
  reglages: /^(Météo de .+ · \d+ fonctionnalités? cochées?|Commune à confirmer · \d+ fonctionnalités? cochées?|\d+ fonctionnalités? cochées?)$/u,
};

/** Le titre « Vos cultures cette saison (N) » de « Besoin par culture », dit dans les mots de la fiche. */
function ligneDesCultures(titre: string): string | null {
  const nombre = /^Vos cultures cette saison \((\d+)\)$/u.exec(titre)?.[1];
  if (nombre === undefined) return null;
  if (nombre === '0') return 'Aucune culture ne sert à vos séries cette saison';
  return `${nombre} culture${Number(nombre) > 1 ? 's' : ''} cette saison`;
}

test('« Ma ferme » : son adresse, ses fiches dans l’ordre, 68 px, une ligne fixe ou d’état ; le menu en fait le titre de son endroit', async ({ page }, testInfo) => {
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
    // La ligne d'état quand la donnée est connue, sinon la ligne fixe de S3 (lot S6, PR 3, section 7.1).
    const ligne = fiche.locator('.farm-card-line');
    if (await ligne.getAttribute('data-line') === 'state') {
      expect(LIGNES_D_ETAT[cible], `« ${TITRES_DES_PAGES[cible]} » n’a pas de ligne d’état`).not.toBeNull();
      await expect(ligne).toHaveText(LIGNES_D_ETAT[cible]!);
    } else {
      await expect(ligne).toHaveAttribute('data-line', 'fixed');
      await expect(ligne).toHaveText(FARM_CARD_LINES[cible]);
    }
    await expect(fiche.locator('.farm-card-todo')).toHaveCount(0);
    expect(new URL((await fiche.getAttribute('href'))!, 'http://x').pathname).toBe(`/irrigation/${cible}`);
    const boite = await fiche.boundingBox();
    expect(Math.round(boite!.height), `la fiche « ${TITRES_DES_PAGES[cible]} » mesure ${Math.round(boite!.height)} px`).toBeGreaterThanOrEqual(FICHE_MINIMALE_PX);
  }
  // La ferme des parcours : la commune de la météo confirmée, ses cultures comptées comme la page « Besoin par culture ».
  const fiche = (cible: (typeof FARM_CARD_PAGES)[number]) => fiches.filter({ has: page.locator('strong', { hasText: TITRES_DES_PAGES[cible] }) }).locator('.farm-card-line');
  await expect(fiche('reglages')).toHaveText(/^Météo de Rennes · \d+ fonctionnalités cochées$/u);
  await expect(fiche('alertes-cultures')).toHaveAttribute('data-line', 'fixed');
  const cultures = await fiche('cultures').textContent();
  // À 390 px, la ligne tient sur deux lignes au plus (S3-f, mesure rapportée au contrat), la ligne d'état aussi (section 7.1).
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

  // Chaque nombre est celui de la page de la fiche (section 7.1) : le titre des cultures de « Besoin par culture ».
  await attendreLaPageIrrigation(page, 'cultures');
  const titre = (await page.locator('h4.reference-crop-group-title').first().textContent())?.trim() ?? '';
  expect(ligneDesCultures(titre), `le titre « ${titre} »`).toBe(cultures);
  await verifierLEtape(page, journal, 'la ligne des cultures, le titre de la page');
  await attendreLaPageIrrigation(page, 'ma-ferme');

  // À l'ordinateur, « Ma ferme » est le titre de son endroit, ses fiches dessous dans le même ordre, Réglages comprise (PR 3) ;
  // au téléphone, son endroit de la barre du bas (PR 2). Marquée, la page ouverte.
  const menu = await ouvrirLeMenuDesPages(page);
  if (!telephone) {
    await expect(menu.locator('li[data-place="ma-ferme"]').getByRole('link')).toHaveText([TITRES_DES_PAGES['ma-ferme'], ...FARM_CARD_PAGES.map((cible) => TITRES_DES_PAGES[cible])]);
  }
  await expect(menu.getByRole('link', { name: TITRES_DES_PAGES['ma-ferme'], exact: true })).toHaveAttribute('aria-current', 'page');
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
  // Le matériel à décrire : la première arrivée est « Ma ferme », la mise en route ayant une étape (lot S6, section 3.4).
  await attendreLaPagePrete(page, 'ma-ferme');
  // Les alertes météo font naître « Aujourd'hui » : c'est la page d'arrivée des ouvertures suivantes (F1).
  await page.goto('/irrigation');
  await attendreLaPagePrete(page, 'aujourdhui');

  await attendreLaPageIrrigation(page, 'ma-ferme');
  const fiches = lesFiches(page).getByRole('link');
  await expect(fiches.locator('strong')).toHaveText([TITRES_DES_PAGES.materiel, TITRES_DES_PAGES['alertes-meteo'], TITRES_DES_PAGES.reglages]);
  // La carte « Mise en route » en tête (le matériel à décrire) : le bandeau « À finir » n'y est pas répété (lot S6, S6-d) ;
  // la fiche « Réglages » dit la commune à confirmer.
  await expect(page.locator('section.start-route')).toBeVisible();
  await expect(page.locator('.onboarding-unfinished')).toHaveCount(0);
  const reglages = fiches.filter({ has: page.locator('strong', { hasText: TITRES_DES_PAGES.reglages }) });
  await expect(reglages.locator('.farm-card-todo')).toHaveText('À faire : commune de la ferme');
  await expect(reglages).toHaveAttribute('data-todo', 'true');
  // Orange de la charte (`--warn-ink`), lisible : contraste mesuré sur le blanc de la carte.
  await expect(reglages.locator('.farm-card-todo')).toHaveCSS('color', 'rgb(109, 54, 2)');
  await expect(fiches.filter({ has: page.locator('strong', { hasText: TITRES_DES_PAGES.materiel }) }).locator('.farm-card-todo')).toHaveCount(0);
  await verifierLEtape(page, journal, '« À faire » sur la fiche « Réglages »');
});

/**
 * Une tournée de toutes les pages, aux sauts les plus longs du rangement : d'un endroit à une page qui n'est pas son entrée.
 * Depuis le lot S4, « Semaine » est une page ; l'historique, sa vue « Les cumuls » (par son ancienne adresse).
 */
const TOURNEE: readonly PageDuModule[] = ['historique', 'materiel', 'semaine', 'arrosages', 'alertes-cultures', 'sol', 'aujourdhui', 'ressources', 'ma-ferme', 'cultures', 'alertes-meteo', 'reglages'];

/** Chaque page du menu par son adresse, et la vue « Les cumuls » par l'ancienne adresse de l'historique. */
const PAGES_ET_VUES: readonly PageDuModule[] = [...Object.keys(TITRES_DES_PAGES) as PageDuMenu[], 'historique'];

/** Le nom de la vue de « Semaine » qu'ouvre une page : « Les cumuls » pour l'historique, « La semaine » sinon. */
function vueDeLaSemaine(cible: PageDuModule): 'La semaine' | 'Les cumuls' {
  return cible === 'historique' ? 'Les cumuls' : 'La semaine';
}

/** Le lien d'une page dans le menu de l'ordinateur : « Aujourd'hui » peut porter le nombre de sa pastille ; « Semaine », sa vue (S4-m). */
function lienDuMenu(page: Page, cible: PageDuModule) {
  const menu = page.getByRole('navigation', { name: 'Pages du module' });
  if (pageAffichee(cible) === 'semaine') return menu.getByRole('link', { name: vueDeLaSemaine(cible), exact: true });
  return menu.getByRole('link', { name: new RegExp(`^${TITRES_DES_PAGES[pageAffichee(cible)]}(,|$)`) });
}

test('la barre du bas : trois endroits et le « + » ; chaque page par son adresse marque son endroit, le sélecteur de vue et le retour où il faut', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  const barre = page.getByRole('navigation', { name: 'Pages principales' });
  const menuDeLOrdinateur = page.getByRole('navigation', { name: 'Pages du module' });
  // La bande de S3 n'est plus ; le sélecteur des deux vues de « Semaine » prend sa ligne, aux deux largeurs (lot S4, section 3.2).
  await attendreLaPageIrrigation(page, 'semaine');
  await expect(page.getByRole('navigation', { name: 'La semaine', exact: true })).toHaveCount(0);
  const selecteur = page.getByRole('navigation', { name: 'Vues de la semaine' });
  const retour = page.getByRole('link', { name: 'Retour à Ma ferme' });

  for (const cible of PAGES_ET_VUES) {
    await attendreLaPageIrrigation(page, cible);
    const affichee = pageAffichee(cible);
    const endroit = placeOfPage(affichee);
    const saison = new URL(page.url()).searchParams.get('season');
    // Le sélecteur de vue sur « Semaine » seulement, à toute largeur : la vue ouverte marquée, la saison gardée, 44 px.
    if (affichee === 'semaine') {
      await expect(selecteur.getByRole('link')).toHaveText(['La semaine', 'Les cumuls']);
      await expect(selecteur.getByRole('link', { name: vueDeLaSemaine(cible), exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(selecteur.locator('[aria-current]')).toHaveCount(1);
      for (const lien of await selecteur.getByRole('link').all()) {
        await verifierCibleTactile(lien, `La vue « ${await lien.innerText()} » du sélecteur`);
        if (saison) expect(new URL((await lien.getAttribute('href'))!, 'http://x').searchParams.get('season')).toBe(saison);
      }
    } else {
      await expect(selecteur).toHaveCount(0);
    }
    if (!telephone) {
      // À l'ordinateur (PR 3, section 6) : ni barre, ni retour ; le menu de gauche montre les trois endroits
      // dépliés, la page marquée `page` une fois, le titre de son endroit `true` quand la liste la porte.
      await expect(barre).toBeHidden();
      await expect(retour).toBeHidden();
      await expect(lienDuMenu(page, cible)).toHaveAttribute('aria-current', 'page');
      await expect(menuDeLOrdinateur.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(menuDeLOrdinateur.locator('li[data-place]')).toHaveCount(PLACE_IDS.length);
      for (const autre of PLACE_IDS) {
        const titre = menuDeLOrdinateur.locator(`li[data-place="${autre}"] > a`);
        const marque = await titre.getAttribute('aria-current');
        if (autre !== endroit) expect(marque, `le titre « ${autre} » sur « ${cible} »`).toBeNull();
        // « Semaine » : ses vues la redisent, la vue ouverte porte `page` et le titre `true` (S4-m).
        else expect(marque, `le titre « ${autre} » sur « ${cible} »`).toBe(autre === cible && autre !== 'semaine' ? 'page' : 'true');
      }
      // La semaine : le titre mène à sa page (lot S4), ses vues dessous, la saison gardée.
      const titreDeLaSemaine = menuDeLOrdinateur.locator('li[data-place="semaine"] > a');
      expect(new URL((await titreDeLaSemaine.getAttribute('href'))!, 'http://x').pathname).toBe('/irrigation/semaine');
      await expect(menuDeLOrdinateur.locator('li[data-place="semaine"] li a')).toHaveText(['La semaine', 'Les cumuls']);
      await verifierLEtape(page, journal, `« ${cible} » à l’ordinateur`);
      continue;
    }
    await expect(barre.locator('li')).toHaveCount(4);
    await expect(barre.getByRole('link')).toHaveText([/^Aujourd’hui\d*$/, 'Semaine', 'Ma ferme']);
    await expect(barre.locator('li').nth(2).getByRole('button', { name: 'Arroser ou noter' })).toBeVisible();
    // L'endroit de la page : `page` sur la page où il mène, `true` ailleurs dans l'endroit ; les autres sans marque.
    for (const autre of PLACE_IDS) {
      const lien = barre.locator(`li[data-place="${autre}"]`).getByRole('link');
      if (autre !== endroit) {
        expect(await lien.getAttribute('aria-current'), `« ${autre} » sur « ${cible} »`).toBeNull();
        continue;
      }
      const entree = new URL((await lien.getAttribute('href'))!, 'http://x').pathname === `/irrigation/${affichee}`;
      await expect(lien).toHaveAttribute('aria-current', entree ? 'page' : 'true');
    }
    // Le retour sur les pages de « Ma ferme », hors elle-même.
    if (endroit === 'ma-ferme' && cible !== 'ma-ferme') {
      await verifierCibleTactile(retour, 'Le retour « ‹ Ma ferme »');
      if (saison) expect(new URL((await retour.getAttribute('href'))!, 'http://x').searchParams.get('season')).toBe(saison);
    } else {
      await expect(retour).toHaveCount(0);
    }
    for (const entree of await barre.locator(':is(a, button)').all()) await verifierCibleTactile(entree, `Une entrée de la barre sur « ${cible} »`);
    await verifierLEtape(page, journal, `« ${cible} » au téléphone`);
  }

  if (telephone) {
    // À 320 px : rien ne déborde, aucun nom de la barre ou du sélecteur de vue n'est coupé.
    await page.setViewportSize({ width: 320, height: 640 });
    for (const cible of ['besoins', 'reglages'] as const) {
      await attendreLaPageIrrigation(page, cible);
      const coupes = await page.locator('.week-views a, .phone-bar a > span').evaluateAll((noms) => noms
        .filter((nom) => nom.scrollWidth > nom.clientWidth + 1)
        .map((nom) => nom.textContent));
      expect(coupes, `noms coupés à 320 px sur ${cible}`).toEqual([]);
      await verifierLEtape(page, journal, `« ${titreDeLaPage(cible)} » à 320 px`);
    }
  }

  // La page introuvable garde sa barre, ou son menu, sans marque, le « + » compris.
  const reponse = await page.goto('/irrigation/nimporte-quoi');
  expect(reponse?.status()).toBe(404);
  journal.erreurs = journal.erreurs.filter((erreur) => !erreur.includes('status of 404'));
  const navigation = telephone ? barre : menuDeLOrdinateur;
  if (telephone) await expect(barre.getByRole('link')).toHaveText([/^Aujourd’hui\d*$/, 'Semaine', 'Ma ferme']);
  else await expect(menuDeLOrdinateur.locator('li[data-place]')).toHaveCount(PLACE_IDS.length);
  await expect(navigation.locator('[aria-current]')).toHaveCount(0);
  await expect(navigation.getByRole('button', { name: 'Arroser ou noter' })).toBeVisible();
  await verifierLEtape(page, journal, 'page introuvable');
});

test('chaque page à deux touches au plus de la précédente, sans recharger le module', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await attendreLaPageIrrigation(page, 'reglages');
  await poserLaMarque(page);
  const releve: string[] = [];
  for (const cible of TOURNEE) {
    const touches = await allerALaPage(page, cible);
    releve.push(`${cible} ${touches}`);
    expect(touches, `« ${cible} » à ${touches} touches`).toBeLessThanOrEqual(telephone ? 2 : 1);
    expect(await laMarque(page), `« ${cible} » sans recharger le module`).toBe('posée');
    await expect(page.locator('#contenu')).toBeFocused();
    await verifierLEtape(page, journal, `« ${cible} » par son chemin`);
  }
  testInfo.annotations.push({ type: 'touches de la tournée', description: releve.join(' ; ') });
});

test('le « + » : la feuille, Échap et le voile ; « Noter la pluie » sans quitter la page ; les deux formulaires d’« Arrosages »', async ({ page, context }, testInfo) => {
  test.setTimeout(240_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  const reference = Date.now();
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'p63-plus');
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'planning');

  // Au téléphone, le rond de la barre du bas (PR 2) ; à l'ordinateur, « + Arroser ou noter » en tête du menu (PR 3, S3-l).
  const plus = page.getByRole('navigation', { name: telephone ? 'Pages principales' : 'Pages du module' }).getByRole('button', { name: 'Arroser ou noter' });
  const feuille = page.getByRole('dialog', { name: 'Que voulez-vous faire ?' });
  const gestes = feuille.locator('.plus-gesture');
  await expect(plus).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(plus).toHaveAttribute('aria-expanded', 'false');
  await verifierCibleTactile(plus, 'Le « + »');

  // Ouverte : modale, le clavier dedans, les trois gestes de 72 px dans l'ordre de la maquette.
  await ouvrirParClic(plus, feuille);
  await expect(plus).toHaveAttribute('aria-expanded', 'true');
  expect(await feuille.evaluate((element) => element.matches(':modal')), 'la feuille est modale').toBe(true);
  // Au téléphone, elle monte du bas ; à l'ordinateur, une boîte de dialogue au milieu de la page, sans poignée.
  const boiteDeLaFeuille = (await feuille.boundingBox())!;
  const hauteurDeLaFenetre = page.viewportSize()!.height;
  if (telephone) {
    expect(Math.round(boiteDeLaFeuille.y + boiteDeLaFeuille.height)).toBe(hauteurDeLaFenetre);
  } else {
    const dessus = boiteDeLaFeuille.y;
    const dessous = hauteurDeLaFenetre - boiteDeLaFeuille.y - boiteDeLaFeuille.height;
    expect(Math.abs(dessus - dessous), `la boîte au milieu (${Math.round(dessus)} / ${Math.round(dessous)} px)`).toBeLessThanOrEqual(2);
    await expect(feuille.locator('.plus-sheet-handle')).toBeHidden();
  }
  expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null), 'le clavier est dans la feuille').toBe(true);
  await expect(gestes.locator('strong')).toHaveText(['Arroser maintenant', 'Noter la pluie', 'Noter un arrosage déjà fait']);
  await expect(gestes.locator('.plus-gesture-text > span')).toHaveText(['Je choisis où et combien de temps', 'Ce que dit votre pluviomètre', 'J’ai arrosé sans le module']);
  for (const geste of await gestes.all()) {
    const boite = await geste.boundingBox();
    expect(Math.round(boite!.height), `« ${await geste.locator('strong').innerText()} »`).toBeGreaterThanOrEqual(72);
  }
  await verifierLEtape(page, journal, 'la feuille ouverte');

  // Échap la referme, le clavier revient au « + » ; un geste sur le voile aussi.
  await page.keyboard.press('Escape');
  await expect(feuille).toHaveCount(0);
  await expect(plus).toBeFocused();
  await expect(plus).toHaveAttribute('aria-expanded', 'false');
  await plus.click();
  await expect(feuille).toBeVisible();
  await page.mouse.click(195, 20);
  await expect(feuille).toHaveCount(0);
  await verifierLEtape(page, journal, 'Échap et le voile');

  // « Noter la pluie » monte la fenêtre de S2 sous son geste ; 8 mm s'enregistrent, la réponse sous le geste.
  await poserLaMarque(page);
  await plus.click();
  const pluie = feuille.getByRole('button', { name: /^Noter la pluie/ });
  await pluie.click();
  await expect(pluie).toHaveAttribute('aria-expanded', 'true');
  const combien = feuille.getByLabel('Combien ?');
  await expect(combien).toBeVisible();
  const premierJanvier = horodatageLocal(0, reference).slice(5, 10) === '01-01';
  await expect(feuille.getByLabel('Quel jour ?')).toHaveValue(horodatageLocal(premierJanvier ? 0 : -24 * 60, reference).slice(0, 10));
  await expect(feuille.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
  await combien.fill('8');
  await feuille.getByRole('button', { name: 'Enregistrer 8 mm' }).click();
  await expect(feuille.locator('.plus-rain-saved')).toHaveText(/^Pluie enregistrée : 8 mm le \S+ \d{1,2} \S+\. Le plan se recalcule\.$/);
  expect(await laMarque(page), 'la pluie s’écrit sans quitter la page').toBe('posée');
  await verifierLEtape(page, journal, '8 mm notés dans la feuille');

  // Fermée, la page se relit pour montrer la pluie ; rouverte, la mesure se dit.
  await Promise.all([page.waitForEvent('load'), feuille.getByRole('button', { name: 'Fermer' }).click()]);
  await attendreLaPagePrete(page, 'planning');
  expect(await laMarque(page), 'la page relue').toBeNull();
  await ouvrirParClic(plus, feuille);
  await feuille.getByRole('button', { name: /^Noter la pluie/ }).click();
  await expect(feuille).toContainText(`8 mm déjà notés ${premierJanvier ? 'pour aujourd’hui' : 'pour hier'}.`);
  await page.keyboard.press('Escape');
  await expect(feuille).toHaveCount(0);
  await verifierLEtape(page, journal, 'la pluie relue');

  // « Arroser maintenant » : « Arrosages » sur l'onglet du même nom (S5), la demande retirée de l'adresse.
  await plus.click();
  await feuille.getByRole('link', { name: /^Arroser maintenant/ }).click();
  await attendreLaPagePrete(page, 'arrosages');
  await expect(page).toHaveURL(/\/irrigation\/arrosages\?season=\d{4}$/);
  await expect(page.getByRole('tab', { name: /^Arroser maintenant/ })).toHaveAttribute('aria-selected', 'true');
  await verifierLEtape(page, journal, '« Arroser maintenant »');

  // « Noter un arrosage déjà fait » : « Déjà fait », depuis « Arrosages » même.
  await ouvrirParClic(plus, feuille);
  await Promise.all([page.waitForEvent('load'), feuille.getByRole('link', { name: /^Noter un arrosage déjà fait/ }).click()]);
  await attendreLaPagePrete(page, 'arrosages');
  await expect(page).toHaveURL(/\/irrigation\/arrosages\?season=\d{4}$/);
  await expect(page.getByRole('tab', { name: /^Déjà fait/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.irrigation-creation-panel')).toBeInViewport();
  // Arrivé par un geste du « + » : le retour « ‹ Aujourd'hui » en tête du formulaire (S5, section 7, D-334).
  const retour = page.locator('.irrigation-creation-panel').getByRole('link', { name: '‹ Aujourd’hui' });
  await expect(retour).toBeVisible();
  await expect(retour).toHaveAttribute('href', /^\/irrigation(\/aujourdhui)?\?season=\d{4}$/);
  await verifierLEtape(page, journal, '« Noter un arrosage déjà fait »');
});
