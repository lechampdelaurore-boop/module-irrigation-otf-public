import { expect, test, type Locator, type Page } from '@playwright/test';
import { attendreLeChoixDesFonctionnalites, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import { preparerMaterielArrosant } from './support/materiel.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  nomsDesPagesDuMenu,
  ouvrirLeMenuDesPages,
  sansLaPastille,
  surveillerLaConsole,
  TEXTES_DES_LIENS_DU_MENU,
  TITRES_DES_PAGES,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';
import { poserUnObjectifDeFerme, reglerLaPlageDuGoutteAGoutte } from './support/planning.ts';

/**
 * Parcours P28 : le téléphone (audit ergonomique du 7 novembre 2026, point 2,
 * 3.8 quater lot 2, docs/audit-ergonomie-lot2-contract.md, section 4 ;
 * docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve qui a tout coché : au téléphone, la barre du bas a
 * quatre entrées et « Plus », qui ouvre les douze pages ; la saison est dans
 * la ligne du titre ; le bandeau « Alertes système non disponibles », montré
 * une fois, se replie en un point sur la cloche et reste entier dans
 * Réglages ; le premier champ d'« Arrosages » tient dans le premier écran ;
 * le planning se replie (une ligne de résumé, le jour du jour ouvert, les
 * jours écoulés et à venir repliés) ; les cibles font 44 px ; la page
 * introuvable a la même barre. À l'ordinateur, rien de cela ne change la
 * page : le menu de gauche, la saison sous le titre, le bandeau, les tuiles
 * et tous les jours restent affichés. Les alertes système sont rendues
 * indisponibles par le parcours (le navigateur sans Push), pour que le
 * bandeau paraisse quel que soit le navigateur qui joue le parcours.
 */

const ECRAN_DU_TELEPHONE_PX = 844;
/** La longueur visée pour le planning au téléphone : huit écrans au plus (contre environ 37 sur la ferme réelle avant le lot). */
const ECRANS_DU_PLANNING_MAX = 8;

async function sansAlertesSysteme(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'PushManager');
  });
}

function barreDuBas(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Pages principales' });
}

function bandeauDesAlertes(page: Page): Locator {
  return page.locator('.irrigation-notification-readiness[data-status="limited"]');
}

test('au téléphone, la barre du bas, la saison, le bandeau et le planning laissent monter l’écran utile ; l’ordinateur ne change pas', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await sansAlertesSysteme(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'telephone');

  // Toutes les cases cochées.
  await page.goto('/irrigation/bienvenue');
  await attendreLeChoixDesFonctionnalites(page);
  for (const caseACocher of await page.getByRole('checkbox').all()) {
    if (!(await caseACocher.isChecked())) await caseACocher.check();
  }
  await page.getByRole('button', { name: 'Continuer' }).click();
  await attendreLaPagePrete(page, 'aujourdhui');
  await verifierLEtape(page, journal, 'toutes les cases cochées');
  // Le bandeau des alertes système vit sur la page des arrosages (F21).
  await attendreLaPageIrrigation(page, 'arrosages');

  // Le bandeau des alertes système, montré une fois en entier.
  await expect(bandeauDesAlertes(page)).toBeVisible();
  await expect(bandeauDesAlertes(page)).toContainText('Alertes système non disponibles');
  const cloche = page.locator('header.topbar a.topbar-bell');
  await expect(cloche).toHaveAttribute('data-alerts-limited', 'true');

  // La barre du bas (F6) : quatre entrées et « Plus » au téléphone, le menu de gauche à l'ordinateur.
  const barre = barreDuBas(page);
  if (telephone) {
    await expect(barre).toBeVisible();
    const entrees = barre.getByRole('link');
    await expect(entrees).toHaveCount(4);
    expect((await entrees.evaluateAll((liens) => liens.map((lien) => lien.getAttribute('aria-label')))).map(sansLaPastille)).toEqual([
      TITRES_DES_PAGES.aujourdhui, TITRES_DES_PAGES.arrosages, TITRES_DES_PAGES.planning, TITRES_DES_PAGES.ressources,
    ]);
    await expect(entrees).toHaveText([/^Aujourd’hui\d*$/, 'Arrosages', 'Planning', 'Ressources']);
    await expect(barre.getByRole('link', { name: TITRES_DES_PAGES.arrosages })).toHaveAttribute('aria-current', 'page');
    const plus = barre.getByRole('button', { name: 'Plus de pages' });
    await expect(plus).toHaveAttribute('data-marked', 'false');
    for (const cible of [...await entrees.all(), plus]) await verifierCibleTactile(cible, `L’entrée « ${await cible.innerText()} » de la barre du bas`);
    await expect(page.getByRole('navigation', { name: 'Pages du module' })).toBeHidden();
  } else {
    await expect(barre).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Pages du module' }).getByRole('link')).toHaveText(TEXTES_DES_LIENS_DU_MENU);
  }
  expect(await nomsDesPagesDuMenu(page)).toEqual(Object.values(TITRES_DES_PAGES));
  await verifierLEtape(page, journal, 'barre du bas');

  // La saison (F7) : dans la ligne du titre au téléphone, sous le titre à l'ordinateur.
  const saisonDuTitre = page.locator('.page-title-row select[name="season"]');
  const saisonSousLeTitre = page.locator('.plan-controls select[name="season"]');
  if (telephone) {
    await expect(saisonDuTitre).toBeVisible();
    await expect(saisonDuTitre).toHaveAccessibleName('Saison');
    await verifierCibleTactile(saisonDuTitre, 'La saison de la ligne du titre');
    await expect(saisonSousLeTitre).toBeHidden();
    await expect(page.getByRole('region', { name: 'Choix de la saison' })).toBeHidden();
    await verifierCibleTactile(page.getByRole('button', { name: `Aide : ${TITRES_DES_PAGES.arrosages}` }), 'Le « ? » de la page');
    await verifierCibleTactile(page.locator('a.refresh-link'), 'Le lien « Actualiser »');
  } else {
    await expect(saisonDuTitre).toBeHidden();
    await expect(saisonSousLeTitre).toBeVisible();
  }
  await verifierLEtape(page, journal, 'saison');

  // Le matériel posé, puis le bandeau replié (F10) et le premier champ d'« Arrosages » dans le premier écran.
  await attendreLaPageIrrigation(page, 'materiel');
  const planche = telephone ? 'T02' : 'T01';
  await preparerMaterielArrosant(page, testInfo, { planche });
  await attendreLaPageIrrigation(page, 'arrosages');
  if (telephone) {
    await expect(bandeauDesAlertes(page)).toBeHidden();
    await expect(cloche).toHaveAccessibleName('Notifications du téléphone : alertes système non disponibles sur cet appareil');
    const premierChamp = page.locator('.irrigation-events-section').locator('select:visible, input:visible').first();
    const boite = await premierChamp.boundingBox();
    const barreHaut = (await barre.boundingBox())?.y ?? ECRAN_DU_TELEPHONE_PX;
    expect(boite, 'le premier champ d’« Arrosages » doit exister').not.toBeNull();
    expect(boite!.y + boite!.height, `le premier champ d’« Arrosages » finit à ${Math.round(boite!.y + boite!.height)} px, sous la barre du bas (${Math.round(barreHaut)} px)`).toBeLessThanOrEqual(barreHaut);
  } else {
    // À l'ordinateur, le bandeau reste affiché : la mise en page ne change pas.
    await expect(bandeauDesAlertes(page)).toBeVisible();
  }
  await verifierLEtape(page, journal, 'bandeau replié et premier champ');

  // Réglages garde le rappel complet.
  await attendreLaPageIrrigation(page, 'reglages');
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Notifications du téléphone' }) }).locator('.irrigation-notification-readiness[data-status="limited"]')).toBeVisible();
  await verifierLEtape(page, journal, 'rappel dans Réglages');

  // « Plus » porte la pastille verte quand la page ouverte n'est pas dans la barre.
  if (telephone) {
    const plus = barre.getByRole('button', { name: /^Plus de pages/ });
    await expect(plus).toHaveAttribute('data-marked', 'true');
    await expect(plus).toHaveAccessibleName('Plus de pages, dont la page ouverte : Réglages');
    const menu = await ouvrirLeMenuDesPages(page);
    await expect(menu.getByRole('link')).toHaveCount(12);
    for (const lien of await menu.getByRole('link').all()) await verifierCibleTactile(lien, `Le lien « ${await lien.innerText()} » de « Plus »`);
    await expect(menu.getByRole('link', { name: TITRES_DES_PAGES.reglages })).toHaveAttribute('aria-current', 'page');
    await verifierLEtape(page, journal, 'feuille « Plus » ouverte');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(plus).toBeFocused();
  }

  // Le planning replié (F11).
  await attendreLaPageIrrigation(page, 'besoins');
  await poserUnObjectifDeFerme(page, '70');
  await attendreLaPageIrrigation(page, 'planning');
  const planning = page.locator('section.planning-section');
  await reglerLaPlageDuGoutteAGoutte(planning, { debut: '00:00', fin: '23:59' });
  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  await expect(planning.locator('.planning-meta')).toContainText('calculé le', { timeout: 30_000 });
  // La page rouverte, telle qu'on la trouve le matin : les réglages repliés.
  await attendreLaPageIrrigation(page, 'planning');
  await expect(planning.locator('article.planning-proposal').first()).toBeVisible();
  const resume = planning.locator('button.planning-summary-line');
  const tuiles = planning.locator('.planning-summary');
  const ecoules = planning.getByRole('button', { name: /^Jours écoulés \(\d+\)$/ });
  if (telephone) {
    const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(hauteur, `le planning mesure ${hauteur} px, plus de ${ECRANS_DU_PLANNING_MAX} écrans`).toBeLessThanOrEqual(ECRANS_DU_PLANNING_MAX * ECRAN_DU_TELEPHONE_PX);
    await expect(resume).toBeVisible();
    // Les gestes d'abord, comme les cartes de tête (audit ergonomique, lot 3, point 5).
    await expect(resume).toContainText(/^\d+ à valider · \d+ faites? · /);
    await expect(tuiles).toBeHidden();
    await verifierCibleTactile(resume, 'La ligne de résumé du planning');
    await resume.click();
    await expect(tuiles).toBeVisible();
    // Les tuiles de totaux sur deux colonnes (charte, point 5).
    expect((await tuiles.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' ')).toHaveLength(2);
    await resume.click();
    await expect(tuiles).toBeHidden();

    // Le jour du jour ouvert ; les jours écoulés sous leur pli ; un jour à venir replié se déplie.
    const ouverts = planning.locator('li.planning-day[data-fold="open"]');
    await expect(ouverts.first()).toBeVisible();
    await expect(ouverts.first()).toHaveAttribute('data-expanded', 'true');
    const replies = planning.locator('li.planning-day[data-fold="past"]');
    if (await replies.count() > 0) {
      await expect(replies.first()).toBeHidden();
      await verifierCibleTactile(ecoules, 'Le pli « Jours écoulés »');
      await ecoules.click();
      await expect(replies.first()).toBeVisible();
      await ecoules.click();
      await expect(replies.first()).toBeHidden();
    } else {
      await expect(ecoules).toHaveCount(0);
    }
    const aVenir = planning.locator('li.planning-day[data-fold="folded"]').filter({ has: page.locator('article.planning-proposal') }).first();
    if (await aVenir.count() > 0) {
      await expect(aVenir.locator('article.planning-proposal').first()).toBeHidden();
      const voir = aVenir.getByRole('button', { name: /^Voir les créneaux \(\d+\)$/ });
      await verifierCibleTactile(voir, 'Le bouton « Voir les créneaux »');
      await voir.click();
      await expect(aVenir.locator('article.planning-proposal').first()).toBeVisible();
      await aVenir.getByRole('button', { name: 'Replier le jour' }).click();
      await expect(aVenir.locator('article.planning-proposal').first()).toBeHidden();
    }
  } else {
    // À l'ordinateur, rien ne se replie.
    await expect(resume).toBeHidden();
    await expect(tuiles).toBeVisible();
    await expect(ecoules).toBeHidden();
    for (const bouton of await planning.getByRole('button', { name: /^(Voir les créneaux|Replier le jour)/ }).all()) await expect(bouton).toBeHidden();
    await expect(planning.locator('article.planning-proposal').last()).toBeVisible();
  }
  await verifierLEtape(page, journal, 'planning replié au téléphone');

  // Une pastille d'aide « i » fait 44 px au téléphone.
  if (telephone) {
    await attendreLaPageIrrigation(page, 'historique');
    const pastille = page.locator('button.figure-origin-toggle:visible').first();
    await verifierCibleTactile(pastille, 'La pastille « D’où vient ce chiffre ? »');
    await verifierLEtape(page, journal, 'pastille d’aide');
  }

  // La page introuvable a la même barre et le même menu.
  const reponse = await page.goto('/irrigation/nimporte-quoi');
  expect(reponse?.status()).toBe(404);
  journal.erreurs = journal.erreurs.filter((erreur) => !erreur.includes('status of 404'));
  if (telephone) {
    await expect(barreDuBas(page).getByRole('link')).toHaveText([/^Aujourd’hui\d*$/, 'Arrosages', 'Planning', 'Ressources']);
    await expect(barreDuBas(page).getByRole('button', { name: 'Plus de pages' })).toHaveAttribute('data-marked', 'false');
  }
  expect(await nomsDesPagesDuMenu(page)).toEqual(Object.values(TITRES_DES_PAGES));
  await verifierLEtape(page, journal, 'page introuvable');
});

test('un stockage du navigateur illisible laisse le bandeau des alertes système affiché, sans erreur', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await sansAlertesSysteme(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Stockage refusé', 'SecurityError');
      },
    });
  });
  for (const passage of ['premier', 'second']) {
    await attendreLaPageIrrigation(page, 'arrosages');
    await expect(bandeauDesAlertes(page)).toBeVisible();
    await expect(page.locator('header.topbar a.topbar-bell')).toHaveAttribute('data-alerts-limited', 'false');
    await verifierLEtape(page, journal, `bandeau, ${passage} passage, stockage illisible`);
  }
});
