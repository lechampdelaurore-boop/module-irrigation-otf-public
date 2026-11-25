import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, nomsDesPagesDuMenu, ouvrirLeMenuDesPages, surveillerLaConsole, TITRES_DES_PAGES, verifierLEtape, ouvrirLePli } from './support/parcours.ts';

/**
 * Socle des parcours : la page se charge dans le mode déterministe attendu.
 * Si ce test échoue, aucun des quatre parcours n'a de sens, et c'est ici qu'il
 * faut chercher (docs/browser-journeys-contract.md).
 */
test('la page d’irrigation se charge avec les données de démonstration', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page);

  // Données Ouvre ta ferme de démonstration : l'écran l'annonce lui-même, dans
  // le menu du compte, la ligne de lecture ne se montrant que pour un problème
  // (simplification S1, F829).
  await page.locator('header.topbar').getByRole('button', { name: /^Compte de / }).click();
  await expect(page.getByRole('menu', { name: 'Compte' }).getByText('Données de démonstration')).toBeVisible();
  await page.keyboard.press('Escape');
  // Utilisateur de démonstration : la page est servie sans redirection vers la
  // connexion Cloudflare Access. Le nom du compte, lui, est masqué à 390 px et
  // ne peut donc pas servir de preuve aux deux largeurs.
  expect(page.url()).toContain('/irrigation');
  expect(page.url()).not.toContain('/cdn-cgi/access');
  // Le plan de la ferme de démonstration est bien là, à toute largeur.
  await expect(page.getByRole('region', { name: 'Plan de la parcelle' }).getByText('Les Prés').first()).toBeVisible();
  // Les icônes et le manifeste que la page déclare : le navigateur sans tête ne
  // les demande pas, une ressource manquante y passerait inaperçue ; le parcours
  // les demande lui-même (le 7 novembre 2026, `/irrigation/icon` répondait 404).
  // L'icône de l'onglet est déclarée : sans elle, un navigateur ordinaire
  // demande `/favicon.ico`, absent du site, et reçoit 404 (D-298).
  await expect(page.locator('link[rel="icon"][href="/favicon.svg"][type="image/svg+xml"]')).toHaveCount(1);
  const ressourcesDeclarees = await page
    .locator('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
    .evaluateAll((liens) => liens.map((lien) => (lien as HTMLLinkElement).href));
  for (const adresse of ressourcesDeclarees) {
    const reponse = await page.request.get(adresse);
    expect(reponse.status(), `La ressource déclarée ${adresse} ne répond pas`).toBe(200);
  }
  // Le manifeste est déclaré une seule fois, demandé avec la session : sans
  // `crossorigin="use-credentials"`, Cloudflare Access renvoie sa demande vers
  // la connexion et le téléphone ne peut pas installer le module (D-302). Les
  // images qu'il nomme répondent toutes.
  const manifeste = page.locator('link[rel="manifest"]');
  await expect(manifeste).toHaveCount(1);
  await expect(manifeste).toHaveAttribute('crossorigin', 'use-credentials');
  const adresseDuManifeste = await manifeste.evaluate((lien) => (lien as HTMLLinkElement).href);
  const contenuDuManifeste = (await (await page.request.get(adresseDuManifeste)).json()) as { icons: { src: string; type: string }[] };
  for (const icone of contenuDuManifeste.icons) {
    const reponse = await page.request.get(new URL(icone.src, adresseDuManifeste).href);
    expect(reponse.status(), `L’icône ${icone.src} du manifeste ne répond pas`).toBe(200);
    expect(reponse.headers()['content-type']).toContain(icone.type);
  }

  await verifierLEtape(page, journal, 'chargement de la page');
});

test('la météo affichée vient du fournisseur de démonstration, sans appel réseau', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'besoins');

  // L'attribution est la ligne qui dit d'où viennent les valeurs affichées, dans le pli de la météo (lot J, F460).
  await ouvrirLePli(page.locator('#meteo-de-reference'));
  await expect(page.getByText('Données météo de démonstration', { exact: false })).toBeVisible();
  // Et elle ne crédite aucun fournisseur réel pour des valeurs qui n'en viennent pas.
  await expect(page.getByText('Open-Meteo', { exact: false })).toHaveCount(0);

  await verifierLEtape(page, journal, 'panneau météo');
});

test('une page par fonctionnalité : le menu y conduit, et l’ancienne adresse mène à la page qui porte le bloc', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  // `/irrigation` seule conduit à la page d'arrivée, « Aujourd'hui » (3.8, P10 ; audit ergonomique, lot 2, F1).
  await page.goto('/irrigation');
  await expect(page.getByRole('heading', { level: 1, name: TITRES_DES_PAGES.aujourdhui })).toBeVisible();
  await expect(page).toHaveURL(/\/irrigation\/aujourdhui(\?|$)/);

  // Le menu porte « Aujourd'hui », les dix pages et Réglages, dans l'ordre de la liste ; la page ouverte y est marquée.
  // Au téléphone, « Plus » l'ouvre au-dessus de la barre du bas (audit ergonomique, point 2).
  expect(await nomsDesPagesDuMenu(page)).toEqual(Object.values(TITRES_DES_PAGES));
  const menu = await ouvrirLeMenuDesPages(page);
  await expect(menu.getByRole('link', { name: TITRES_DES_PAGES.aujourdhui })).toHaveAttribute('aria-current', 'page');
  await verifierLEtape(page, journal, 'menu des pages');

  await menu.getByRole('link', { name: TITRES_DES_PAGES.materiel }).click();
  await expect(page.getByRole('heading', { level: 1, name: TITRES_DES_PAGES.materiel })).toBeVisible();
  await expect(page).toHaveURL(/\/irrigation\/materiel\?season=\d{4}/);
  // Le plan de la parcelle d'abord, l'aperçu « Apport calculé par heure » ensuite (retour du porteur du 8 novembre 2026).
  const planDeLaParcelle = page.getByRole('region', { name: 'Plan de la parcelle' });
  const apercuInstantane = page.getByRole('region', { name: 'Apport calculé par heure' });
  await expect(apercuInstantane).toBeVisible();
  const [boitePlan, boiteApercu] = await Promise.all([planDeLaParcelle.boundingBox(), apercuInstantane.boundingBox()]);
  expect(boitePlan && boiteApercu && boitePlan.y < boiteApercu.y).toBe(true);
  await verifierLEtape(page, journal, 'page du matériel par le menu');

  // Une notification reçue avant la 3.8 ouvrait `/irrigation?…#planning` : elle mène au planning (P14).
  await page.goto('/irrigation?season=2026#planning');
  await expect(page.getByRole('heading', { level: 1, name: TITRES_DES_PAGES.planning })).toBeVisible();
  await expect(page).toHaveURL(/\/irrigation\/planning\?season=2026#planning$/);
  await verifierLEtape(page, journal, 'ancienne adresse du planning');
});
