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
  TITRES_DES_PAGES,
  verifierCibleTactile,
  verifierLEtape,
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
 * PR 2, la barre du bas, le « + » et le chemin de retour (sections 3.3, 3.4,
 * 4, 4.1 et 5.1) :
 * - au téléphone, sur chacune des treize pages ouverte par son adresse : la
 *   barre porte « Aujourd'hui », « Semaine », le « + » et « Ma ferme »,
 *   l'endroit de la page marqué (`page` sur la page où il mène, `true`
 *   ailleurs dans l'endroit) ; la bande « La semaine » sur ses trois pages,
 *   la page ouverte marquée, la saison gardée, 44 px ; le retour « ‹ Ma
 *   ferme » sur les pages de « Ma ferme », 44 px ; à 320 px, rien ne déborde
 *   et aucun nom n'est coupé ; la page introuvable garde sa barre. À
 *   l'ordinateur, rien de cela : le menu de gauche marque la page ;
 * - une tournée de toutes les pages, chacune à deux touches au plus de la
 *   précédente (une à l'ordinateur), sans recharger le module, le clavier sur
 *   le contenu, les touches notées ;
 * - au téléphone, sur une ferme neuve propre au parcours : le « + » ouvre la
 *   feuille modale « Que voulez-vous faire ? », ses trois gestes de 72 px ;
 *   Échap et le voile la referment, le clavier revient au « + » ; « Noter la
 *   pluie » y monte la fenêtre de S2, 8 mm s'enregistrent, la réponse sous le
 *   geste, la page relue à la fermeture et la mesure dite à la réouverture ;
 *   « Arroser maintenant » et « Noter un arrosage déjà fait » ouvrent
 *   « Arrosages » sur leur formulaire, la demande retirée de l'adresse.
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

  // À l'ordinateur, le menu d'avant, avec « Ma ferme » en plus, au-dessus de Réglages, marquée quand elle est ouverte ;
  // au téléphone, son endroit de la barre du bas, la page ouverte (PR 2).
  const menu = await ouvrirLeMenuDesPages(page);
  if (!telephone) {
    const liens = await menu.getByRole('link').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label') ?? (element as HTMLElement).innerText.trim()));
    expect(liens.slice(-2)).toEqual([TITRES_DES_PAGES['ma-ferme'], TITRES_DES_PAGES.reglages]);
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

/** Une tournée de toutes les pages, aux sauts les plus longs du rangement : d'un endroit à une page qui n'est pas son entrée. */
const TOURNEE: readonly PageDuModule[] = ['historique', 'materiel', 'besoins', 'arrosages', 'alertes-cultures', 'planning', 'sol', 'aujourdhui', 'ressources', 'ma-ferme', 'cultures', 'alertes-meteo', 'reglages'];

/** Le lien d'une page dans le menu de l'ordinateur : « Aujourd'hui » peut porter le nombre de sa pastille. */
function lienDuMenu(page: Page, cible: PageDuModule) {
  return page.getByRole('navigation', { name: 'Pages du module' }).getByRole('link', { name: new RegExp(`^${TITRES_DES_PAGES[cible]}(,|$)`) });
}

test('la barre du bas : trois endroits et le « + » ; chaque page par son adresse marque son endroit, la bande et le retour où il faut', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  const barre = page.getByRole('navigation', { name: 'Pages principales' });
  const bande = page.getByRole('navigation', { name: 'La semaine' });
  const retour = page.getByRole('link', { name: 'Retour à Ma ferme' });

  for (const cible of Object.keys(TITRES_DES_PAGES) as PageDuModule[]) {
    await attendreLaPageIrrigation(page, cible);
    if (!telephone) {
      // L'ordinateur garde son menu jusqu'à la PR 3 : ni barre, ni bande, ni retour.
      await expect(barre).toBeHidden();
      await expect(bande).toBeHidden();
      await expect(retour).toBeHidden();
      await expect(lienDuMenu(page, cible)).toHaveAttribute('aria-current', 'page');
      await verifierLEtape(page, journal, `« ${TITRES_DES_PAGES[cible]} » à l’ordinateur`);
      continue;
    }
    const saison = new URL(page.url()).searchParams.get('season');
    await expect(barre.locator('li')).toHaveCount(4);
    await expect(barre.getByRole('link')).toHaveText([/^Aujourd’hui\d*$/, 'Semaine', 'Ma ferme']);
    await expect(barre.locator('li').nth(2).getByRole('button', { name: 'Arroser ou noter' })).toBeVisible();
    // L'endroit de la page : `page` sur la page où il mène, `true` ailleurs dans l'endroit ; les autres sans marque.
    const endroit = placeOfPage(cible);
    for (const autre of PLACE_IDS) {
      const lien = barre.locator(`li[data-place="${autre}"]`).getByRole('link');
      if (autre !== endroit) {
        expect(await lien.getAttribute('aria-current'), `« ${autre} » sur « ${TITRES_DES_PAGES[cible]} »`).toBeNull();
        continue;
      }
      const entree = new URL((await lien.getAttribute('href'))!, 'http://x').pathname === `/irrigation/${cible}`;
      await expect(lien).toHaveAttribute('aria-current', entree ? 'page' : 'true');
    }
    // La bande sur les trois pages de « Semaine », la saison gardée ; le retour sur les pages de « Ma ferme », hors elle-même.
    if (endroit === 'semaine') {
      await expect(bande.getByRole('link')).toHaveText(['Planning', 'Besoins', 'Historique']);
      await expect(bande.getByRole('link', { name: TITRES_DES_PAGES[cible], exact: true })).toHaveAttribute('aria-current', 'page');
      for (const lien of await bande.getByRole('link').all()) {
        await verifierCibleTactile(lien, `L’onglet « ${await lien.innerText()} » de la bande`);
        if (saison) expect(new URL((await lien.getAttribute('href'))!, 'http://x').searchParams.get('season')).toBe(saison);
      }
    } else {
      await expect(bande).toHaveCount(0);
    }
    if (endroit === 'ma-ferme' && cible !== 'ma-ferme') {
      await verifierCibleTactile(retour, 'Le retour « ‹ Ma ferme »');
      if (saison) expect(new URL((await retour.getAttribute('href'))!, 'http://x').searchParams.get('season')).toBe(saison);
    } else {
      await expect(retour).toHaveCount(0);
    }
    for (const entree of await barre.locator(':is(a, button)').all()) await verifierCibleTactile(entree, `Une entrée de la barre sur « ${TITRES_DES_PAGES[cible]} »`);
    await verifierLEtape(page, journal, `« ${TITRES_DES_PAGES[cible]} » au téléphone`);
  }

  if (telephone) {
    // À 320 px : rien ne déborde, aucun nom de la barre ou de la bande n'est coupé.
    await page.setViewportSize({ width: 320, height: 640 });
    for (const cible of ['besoins', 'reglages'] as const) {
      await attendreLaPageIrrigation(page, cible);
      const coupes = await page.locator('.week-band a, .phone-bar a > span').evaluateAll((noms) => noms
        .filter((nom) => nom.scrollWidth > nom.clientWidth + 1)
        .map((nom) => nom.textContent));
      expect(coupes, `noms coupés à 320 px sur ${cible}`).toEqual([]);
      await verifierLEtape(page, journal, `« ${TITRES_DES_PAGES[cible]} » à 320 px`);
    }
  }

  // La page introuvable garde sa barre, sans marque, le « + » compris.
  const reponse = await page.goto('/irrigation/nimporte-quoi');
  expect(reponse?.status()).toBe(404);
  journal.erreurs = journal.erreurs.filter((erreur) => !erreur.includes('status of 404'));
  if (telephone) {
    await expect(barre.getByRole('link')).toHaveText([/^Aujourd’hui\d*$/, 'Semaine', 'Ma ferme']);
    await expect(barre.locator('[aria-current]')).toHaveCount(0);
    await expect(barre.getByRole('button', { name: 'Arroser ou noter' })).toBeVisible();
  }
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
    expect(touches, `« ${TITRES_DES_PAGES[cible]} » à ${touches} touches`).toBeLessThanOrEqual(telephone ? 2 : 1);
    expect(await laMarque(page), `« ${TITRES_DES_PAGES[cible]} » sans recharger le module`).toBe('posée');
    await expect(page.locator('#contenu')).toBeFocused();
    await verifierLEtape(page, journal, `« ${TITRES_DES_PAGES[cible]} » par son chemin`);
  }
  testInfo.annotations.push({ type: 'touches de la tournée', description: releve.join(' ; ') });
});

test('le « + » : la feuille, Échap et le voile ; « Noter la pluie » sans quitter la page ; les deux formulaires d’« Arrosages »', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'telephone', 'le « + » de l’ordinateur vient avec la PR 3 : jusque-là, seule la barre du bas le porte');
  test.setTimeout(240_000);
  const journal = surveillerLaConsole(page);
  const reference = Date.now();
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'p63-plus');
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'planning');

  const plus = page.getByRole('navigation', { name: 'Pages principales' }).getByRole('button', { name: 'Arroser ou noter' });
  const feuille = page.getByRole('dialog', { name: 'Que voulez-vous faire ?' });
  const gestes = feuille.locator('.plus-gesture');
  await expect(plus).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(plus).toHaveAttribute('aria-expanded', 'false');
  await verifierCibleTactile(plus, 'Le « + »');

  // Ouverte : modale, le clavier dedans, les trois gestes de 72 px dans l'ordre de la maquette.
  await ouvrirParClic(plus, feuille);
  await expect(plus).toHaveAttribute('aria-expanded', 'true');
  expect(await feuille.evaluate((element) => element.matches(':modal')), 'la feuille est modale').toBe(true);
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

  // « Arroser maintenant » : « Arrosages » sur « Irriguer maintenant », la demande retirée de l'adresse.
  await plus.click();
  await feuille.getByRole('link', { name: /^Arroser maintenant/ }).click();
  await attendreLaPagePrete(page, 'arrosages');
  await expect(page).toHaveURL(/\/irrigation\/arrosages\?season=\d{4}$/);
  await expect(page.getByRole('tab', { name: /^Irriguer maintenant/ })).toHaveAttribute('aria-selected', 'true');
  await verifierLEtape(page, journal, '« Arroser maintenant »');

  // « Noter un arrosage déjà fait » : « Déjà réalisée », depuis « Arrosages » même.
  await ouvrirParClic(plus, feuille);
  await Promise.all([page.waitForEvent('load'), feuille.getByRole('link', { name: /^Noter un arrosage déjà fait/ }).click()]);
  await attendreLaPagePrete(page, 'arrosages');
  await expect(page).toHaveURL(/\/irrigation\/arrosages\?season=\d{4}$/);
  await expect(page.getByRole('tab', { name: /^Déjà réalisée/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.irrigation-creation-panel')).toBeInViewport();
  await verifierLEtape(page, journal, '« Noter un arrosage déjà fait »');
});
