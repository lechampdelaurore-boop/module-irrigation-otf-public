import { expect, test, type Locator, type Page } from '@playwright/test';
import { attendreLeChoixDesFonctionnalites, ouvrirUneFermeNeuve, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { preparerMaterielArrosant } from './support/materiel.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  nomsDesPagesDuMenu,
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
 * les trois endroits et le « + » (simplification, lot S3, PR 2, D-331) ;
 * l'endroit de la page ouverte est marqué, et une page de « Ma ferme » a son
 * retour « ‹ » ; la saison est dans
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

  // Le bandeau des alertes système, montré une fois en entier, sous le formulaire (audit final, lot E, J12, F266).
  await expect(bandeauDesAlertes(page)).toBeVisible();
  await expect(bandeauDesAlertes(page)).toContainText('Alertes système non disponibles');
  const formulaire = await page.locator('.irrigation-creation-panel').boundingBox();
  const bandeau = await bandeauDesAlertes(page).boundingBox();
  expect(formulaire && bandeau, 'le formulaire et le bandeau doivent exister').toBeTruthy();
  expect(bandeau!.y, 'le bandeau des alertes vient sous le formulaire').toBeGreaterThanOrEqual(formulaire!.y + formulaire!.height);
  const cloche = page.locator('header.topbar a.topbar-bell');
  await expect(cloche).toHaveAttribute('data-alerts-limited', 'true');
  // La commune et les jardins de la ferme neuve (4.4) : le bandeau « À finir » part, les hauteurs sont celles d'une ferme réglée.
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'arrosages');

  // La barre du bas (F6, réécrite par la simplification S3, PR 2, D-331) : les trois endroits et le « + » au
  // téléphone, « Aujourd'hui » marqué sur « Arrosages », qui est de son endroit ; le menu de gauche à l'ordinateur.
  const barre = barreDuBas(page);
  if (telephone) {
    await expect(barre).toBeVisible();
    const entrees = barre.getByRole('link');
    await expect(entrees).toHaveCount(3);
    expect((await entrees.evaluateAll((liens) => liens.map((lien) => lien.getAttribute('aria-label') ?? (lien as HTMLElement).innerText.trim()))).map(sansLaPastille)).toEqual([
      TITRES_DES_PAGES.aujourdhui, 'Semaine', TITRES_DES_PAGES['ma-ferme'],
    ]);
    await expect(entrees).toHaveText([/^Aujourd’hui\d*$/, 'Semaine', 'Ma ferme']);
    await expect(barre.getByRole('link', { name: /^Aujourd’hui/ })).toHaveAttribute('aria-current', 'true');
    const plus = barre.getByRole('button', { name: 'Arroser ou noter' });
    await expect(barre.locator('li')).toHaveCount(4);
    await expect(barre.locator('li').nth(2)).toHaveAttribute('data-plus', 'true');
    for (const cible of [...await entrees.all(), plus]) await verifierCibleTactile(cible, `L’entrée « ${(await cible.innerText()) || 'Arroser ou noter'} » de la barre du bas`);
    await expect(barre.getByRole('button', { name: /^Plus de pages/ })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Pages du module' })).toBeHidden();
  } else {
    await expect(barre).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Pages du module' }).getByRole('link')).toHaveText(TEXTES_DES_LIENS_DU_MENU);
  }
  expect(await nomsDesPagesDuMenu(page)).toEqual(Object.values(TITRES_DES_PAGES));
  await verifierLEtape(page, journal, 'barre du bas');

  // « Arrosages » ne propose plus la saison (simplification S1, F824) ; la ligne de lecture
  // ne se montre que pour dire un problème, « Actualiser » est dans le menu du compte (F822, F823).
  await expect(page.locator('select[name="season"]')).toHaveCount(0);
  await expect(page.locator('a.refresh-link')).toHaveCount(0);
  if (telephone) await verifierCibleTactile(page.getByRole('button', { name: `Aide : ${TITRES_DES_PAGES.arrosages}` }), 'Le « ? » de la page');
  // La saison (F7) : dans la ligne du titre au téléphone, sous le titre à l'ordinateur, sur une page qui s'en sert.
  await attendreLaPageIrrigation(page, 'planning');
  const saisonDuTitre = page.locator('.page-title-row select[name="season"]');
  const saisonSousLeTitre = page.locator('.plan-controls select[name="season"]');
  if (telephone) {
    await expect(saisonDuTitre).toBeVisible();
    await expect(saisonDuTitre).toHaveAccessibleName('Saison');
    await verifierCibleTactile(saisonDuTitre, 'La saison de la ligne du titre');
    await expect(saisonSousLeTitre).toBeHidden();
    await expect(page.getByRole('region', { name: 'Choix de la saison' })).toBeHidden();
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
  // Replié une fois vu, à toutes les largeurs (F267).
  await expect(bandeauDesAlertes(page)).toBeHidden();
  if (telephone) {
    await expect(cloche).toHaveAccessibleName('Notifications du téléphone : alertes système non disponibles sur cet appareil');
    const premierChamp = page.locator('.irrigation-events-section').locator('select:visible, input:visible').first();
    const boite = await premierChamp.boundingBox();
    const barreHaut = (await barre.boundingBox())?.y ?? ECRAN_DU_TELEPHONE_PX;
    expect(boite, 'le premier champ d’« Arrosages » doit exister').not.toBeNull();
    expect(boite!.y + boite!.height, `le premier champ d’« Arrosages » finit à ${Math.round(boite!.y + boite!.height)} px, sous la barre du bas (${Math.round(barreHaut)} px)`).toBeLessThanOrEqual(barreHaut);
  }
  await verifierLEtape(page, journal, 'bandeau replié et premier champ');

  // Réglages garde le rappel complet.
  await attendreLaPageIrrigation(page, 'reglages');
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Notifications du téléphone' }) }).locator('.irrigation-notification-readiness[data-status="limited"]')).toBeVisible();
  await verifierLEtape(page, journal, 'rappel dans Réglages');

  // Réglages est de « Ma ferme » : l'endroit prend la marque, sans point vert muet (lot A, J13, F287, réécrite par S3, PR 2) ;
  // le retour « ‹ » de 44 px ramène aux fiches, où l'endroit est la page ouverte.
  if (telephone) {
    const maFerme = barre.getByRole('link', { name: TITRES_DES_PAGES['ma-ferme'], exact: true });
    await expect(maFerme).toHaveAttribute('aria-current', 'true');
    expect(await maFerme.evaluate((element) => getComputedStyle(element, '::after').content)).toBe('none');
    const marque = await maFerme.locator('.icon').evaluate((element) => getComputedStyle(element).backgroundColor);
    const libre = await barre.getByRole('link').first().locator('.icon').evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(marque, 'la marque de « Ma ferme »').not.toBe(libre);
    const retour = page.getByRole('link', { name: 'Retour à Ma ferme' });
    await verifierCibleTactile(retour, 'Le retour « ‹ Ma ferme »');
    await retour.click();
    await attendreLaPagePrete(page, 'ma-ferme');
    await expect(maFerme).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: 'Retour à Ma ferme' })).toHaveCount(0);
    await verifierLEtape(page, journal, 'retour à « Ma ferme »');
  }

  // Le planning replié (F11).
  await attendreLaPageIrrigation(page, 'besoins');
  await poserUnObjectifDeFerme(page, '70');
  await attendreLaPageIrrigation(page, 'planning');
  const planning = page.locator('section.planning-section');
  await reglerLaPlageDuGoutteAGoutte(planning, { debut: '00:00', fin: '23:59' });
  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  await expect(planning.locator('.planning-meta')).toContainText('calculé le', { timeout: 30_000 });
  // La page rouverte, telle qu'on la trouve le matin : « Jour par jour » de la page « Semaine »
  // (simplification, lot S4, PR 2, section 5), les réglages dans « Le détail ».
  await attendreLaPageIrrigation(page, 'planning');
  await expect(planning.locator('article.planning-proposal').first()).toBeAttached();
  const ecoules = planning.getByRole('button', { name: /^Jours écoulés \(\d+\)$/ });
  const lignes = planning.locator('.week-slot-line');
  if (telephone) {
    // Depuis le lot S4, les besoins suivent le planning sur la même page : le planning se mesure jusqu'à son bas.
    const hauteur = await planning.evaluate((element) => Math.round(element.getBoundingClientRect().bottom + window.scrollY));
    expect(hauteur, `le planning mesure ${hauteur} px, plus de ${ECRANS_DU_PLANNING_MAX} écrans`).toBeLessThanOrEqual(ECRANS_DU_PLANNING_MAX * ECRAN_DU_TELEPHONE_PX);
    // Chaque créneau en une ligne : l'heure, le matériel, la durée, la dose ; la carte entière dessous, fermée.
    const ligne = planning.locator('.week-slot-line:visible').first();
    await expect(ligne).toBeVisible();
    await expect(ligne.locator('p > span').first()).toHaveText(/^\d{1,2} h( \d{2})? · .+ · .+ · [\d,]+ mm$/);
    const carte = ligne.locator('xpath=..').locator('article.planning-proposal');
    await expect(carte).toBeHidden();
    const autres = ligne.getByRole('button', { name: /^(Autres choix|Détail)$/ });
    await verifierCibleTactile(autres, 'Le bouton « Autres choix » du créneau');
    await autres.click();
    await expect(carte).toBeVisible();
    await autres.click();
    await expect(carte).toBeHidden();

    // Le jour du jour ouvert ; les jours écoulés sous leur pli.
    const ouverts = planning.locator('li.planning-day[data-fold="open"]');
    await expect(ouverts.first()).toBeVisible();
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
  } else {
    // À l'ordinateur, rien ne se replie : les cartes entières, sans ligne compacte.
    await expect(lignes.first()).toBeHidden();
    await expect(ecoules).toBeHidden();
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
    await expect(barreDuBas(page).getByRole('link')).toHaveText([/^Aujourd’hui\d*$/, 'Semaine', 'Ma ferme']);
    await expect(barreDuBas(page).locator('[aria-current]')).toHaveCount(0);
    await expect(barreDuBas(page).getByRole('button', { name: 'Arroser ou noter' })).toBeVisible();
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
