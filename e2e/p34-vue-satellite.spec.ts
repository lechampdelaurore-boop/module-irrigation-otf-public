import { expect, test, type Page, type Route } from '@playwright/test';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P34 : l'onglet « Vue satellite » d'une parcelle (S3,
 * docs/satellite-view-contract.md, F204 à F213, section 12), sur la ferme de
 * démonstration des parcours, dont les contours sont inventés sur un lieu
 * fictif (F224) : « Les Prés » dessinée en entier, « Sous le verger » en
 * partie, « Le Coteau » pas du tout.
 *
 * Aucun appel ne part vers l'IGN : le parcours répond lui-même aux demandes
 * de tuiles, d'abord par une image, puis par la réponse « No data found » de
 * la Géoplateforme, pour jouer le fond indisponible (F206 c). Le choix du
 * fond est mémorisé par l'appareil ; le parcours le remet au satellite à la
 * fin.
 *
 * Ce qu'il ne prouve pas : la qualité et le millésime des photos de l'IGN ;
 * le rendu réel des contours dans la carte (WebGL de logiciel, sans capture
 * comparée), ni le toucher d'un contour, ni les gestes à deux doigts ; le
 * plein écran et sa sortie par Échap ; un fond hors de France (tests du
 * domaine) ; la ferme réelle.
 */

const ADRESSE_DES_TUILES = /^https:\/\/data\.geopf\.fr\/wmts\?/;
/** Une tuile d'une seule couleur, comme une prairie vue d'avion : 1 × 1 pixel, agrandi par la carte. */
const TUILE_UNIE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMIq7ADAAI0AQ2F+GESAAAAAElFTkSuQmCC',
  'base64',
);
const AUCUNE_DONNEE =
  '<ExceptionReport xmlns="http://www.opengis.net/ows/1.1"><Exception exceptionCode="Not Found" >No data found</Exception></ExceptionReport>';

async function repondreAuxTuiles(page: Page, reponse: 'image' | 'aucune-donnee'): Promise<string[]> {
  const demandes: string[] = [];
  await page.unroute(ADRESSE_DES_TUILES);
  await page.route(ADRESSE_DES_TUILES, async (route: Route) => {
    demandes.push(route.request().url());
    if (reponse === 'image') {
      await route.fulfill({ status: 200, contentType: 'image/png', body: TUILE_UNIE });
    } else {
      // La Géoplateforme répond « No data found » hors de ses images : un corps qui n'est pas une image.
      await route.fulfill({ status: 200, contentType: 'application/xml', body: AUCUNE_DONNEE });
    }
  });
  return demandes;
}

async function choisirLaParcelle(page: Page, nom: string): Promise<void> {
  await page.getByRole('region', { name: 'Choix du plan affiché' }).getByLabel('Parcelle').selectOption({ label: nom });
}

test('la vue satellite montre la parcelle, ses jardins et leur liste, mémorise le fond, et dit ce qui manque', async ({ page }, testInfo) => {
  const telephone = testInfo.project.name === 'telephone';
  const journal = surveillerLaConsole(page);
  const demandes = await repondreAuxTuiles(page, 'image');
  await attendreLaPageIrrigation(page, 'materiel');
  const bloc = page.locator('section.farm-plan');
  const ongletPlan = bloc.getByRole('tab', { name: 'Plan' });
  const ongletSatellite = bloc.getByRole('tab', { name: 'Vue satellite' });
  const panneau = bloc.getByRole('tabpanel');
  const carte = panneau.locator('.satellite-map');
  const liste = panneau.getByRole('list', { name: 'Jardins de la parcelle' });
  const ligneNord = liste.getByRole('button', { name: /^Jardin Nord/ });
  const ligneTunnel = liste.getByRole('button', { name: /^Tunnel 1/ });
  const satellite = panneau.getByRole('button', { name: 'Satellite', exact: true });
  const dessin = panneau.getByRole('button', { name: 'Dessin', exact: true });

  // Le plan d'abord ; la vue satellite ne se charge qu'à son ouverture, et rien n'est demandé à l'IGN avant.
  await expect(ongletPlan).toHaveAttribute('aria-selected', 'true');
  expect(demandes).toEqual([]);
  await ouvrirParClic(ongletSatellite, satellite);
  await expect(ongletSatellite).toHaveAttribute('aria-selected', 'true');
  await expect(satellite).toHaveAttribute('aria-pressed', 'true');
  await expect(carte).toHaveAttribute('data-ready', 'true');
  await expect(carte).toHaveAttribute('data-basemap', 'ign-orthophotos');
  await expect(carte.getByRole('link', { name: '© IGN – Géoplateforme' })).toHaveAttribute(
    'href',
    'https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_BD-ORTHO',
  );
  await expect(carte.locator('.satellite-label', { hasText: 'Les Prés' })).toBeVisible();
  await expect(carte.locator('.satellite-label', { hasText: 'Jardin Nord' })).toBeVisible();
  await expect(carte.locator('.satellite-label', { hasText: 'Tunnel 1' })).toBeVisible();
  await expect(carte.locator('.maplibregl-ctrl-scale')).toHaveText(/^\d+\s?m$/);
  await expect(panneau.getByText('L’IGN voit quelle zone est regardée, pas qui la regarde.', { exact: false })).toBeVisible();
  await expect(ligneNord).toHaveText(/Jardin Nord\s*plein champ\s*756 m²\s*contour dessiné/);
  await expect(ligneTunnel).toHaveText(/Tunnel 1\s*abri\s*240 m²\s*contour dessiné/);
  expect(demandes.length).toBeGreaterThan(0);
  for (const adresse of demandes) {
    expect(adresse).toContain('LAYER=ORTHOIMAGERY.ORTHOPHOTOS');
    expect(adresse).toContain('TILEMATRIXSET=PM_0_19');
    expect(adresse).not.toMatch(/key|token/i);
  }
  if (telephone) {
    for (const [cible, intitule] of [
      [ongletSatellite, 'L’onglet « Vue satellite »'],
      [satellite, 'Le bouton « Satellite »'],
      [dessin, 'Le bouton « Dessin »'],
      [ligneNord, 'La ligne de Jardin Nord'],
      [carte.getByRole('button', { name: 'Rapprocher' }), 'Le bouton « Rapprocher »'],
    ] as const) {
      await verifierCibleTactile(cible, intitule);
    }
  }
  await verifierLEtape(page, journal, 'vue satellite des Prés');

  // Toucher une ligne met son jardin en évidence ; toucher un nom sur la carte, sa ligne.
  await ligneTunnel.click();
  await expect(ligneTunnel).toHaveAttribute('aria-pressed', 'true');
  await expect(carte.locator('.satellite-label', { hasText: 'Tunnel 1' })).toHaveAttribute('data-highlighted', 'true');
  await carte.locator('.satellite-label', { hasText: 'Jardin Nord' }).click();
  await expect(ligneNord).toHaveAttribute('aria-pressed', 'true');
  await expect(ligneTunnel).toHaveAttribute('aria-pressed', 'false');
  await verifierLEtape(page, journal, 'mise en évidence d’un jardin');

  // Le « Dessin » : aucune photo ni crédit, et le choix tient au rechargement.
  await dessin.click();
  await expect(dessin).toHaveAttribute('aria-pressed', 'true');
  await expect(carte).toHaveAttribute('data-basemap', 'drawing');
  await expect(carte).toHaveAttribute('data-ready', 'true');
  await expect(carte.getByRole('link', { name: '© IGN – Géoplateforme' })).toHaveCount(0);
  await expect(carte.locator('.satellite-label', { hasText: 'Jardin Nord' })).toBeVisible();
  await page.reload();
  await ouvrirParClic(ongletSatellite, dessin);
  await expect(dessin).toHaveAttribute('aria-pressed', 'true');
  await expect(carte).toHaveAttribute('data-basemap', 'drawing');
  await satellite.click();
  await expect(carte).toHaveAttribute('data-basemap', 'ign-orthophotos');
  await verifierLEtape(page, journal, 'bascule mémorisée');

  // En partie dessinée : la parcelle sur la carte, son jardin « contour non dessiné » dans la liste.
  await choisirLaParcelle(page, 'Sous le verger');
  await expect(carte).toHaveAttribute('data-ready', 'true');
  await expect(carte.locator('.satellite-label', { hasText: 'Sous le verger' })).toBeVisible();
  await expect(liste.getByRole('listitem')).toHaveText([/Jardin du verger\s*plein champ\s*336 m²\s*contour non dessiné/]);
  await expect(liste.getByRole('button')).toHaveCount(0);
  await verifierLEtape(page, journal, 'parcelle dessinée en partie');

  // Pas dessinée du tout : aucune carte, l'encart le dit, la liste reste.
  await choisirLaParcelle(page, 'Le Coteau');
  await expect(panneau.getByRole('note')).toHaveText(/Cette parcelle n’est pas dessinée dans Ouvre ta ferme/);
  await expect(panneau.locator('.satellite-map')).toHaveCount(0);
  await expect(satellite).toHaveCount(0);
  await expect(liste.getByRole('listitem')).toHaveText([/Jardin Sud\s*plein champ\s*792 m²\s*contour non dessiné/]);
  await verifierLEtape(page, journal, 'parcelle sans dessin');

  // Fond indisponible : la Géoplateforme n'a pas d'image ici ; la carte passe au « Dessin », les contours restent.
  await repondreAuxTuiles(page, 'aucune-donnee');
  await choisirLaParcelle(page, 'Les Prés');
  await expect(panneau.getByRole('status')).toHaveText('Fond satellite indisponible : la carte montre le dessin des contours.');
  await expect(carte).toHaveAttribute('data-basemap', 'drawing');
  await expect(carte.locator('.satellite-label', { hasText: 'Jardin Nord' })).toBeVisible();
  await expect(satellite).toHaveAttribute('aria-pressed', 'true');
  await verifierLEtape(page, journal, 'fond indisponible');

  // Le retour au plan : un seul onglet ouvert à la fois.
  await ongletPlan.click();
  await expect(panneau.locator('.satellite-view')).toHaveCount(0);
  await expect(panneau.locator('.plot-plan-card').first()).toBeVisible();
  await verifierLEtape(page, journal, 'retour au plan');
});

test('sans WebGL, la vue satellite dessine les contours en SVG, avec la même liste', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await page.addInitScript(() => {
    // Un navigateur sans WebGL, comme un poste ancien : le contexte demandé n'existe pas.
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
      return (getContext as (...args: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  const demandes = await repondreAuxTuiles(page, 'image');
  await attendreLaPageIrrigation(page, 'materiel');
  const bloc = page.locator('section.farm-plan');
  const panneau = bloc.getByRole('tabpanel');
  const dessin = panneau.getByRole('img', { name: /^Dessin de Les Prés/ });
  await ouvrirParClic(bloc.getByRole('tab', { name: 'Vue satellite' }), dessin);
  await expect(panneau.getByRole('status')).toHaveText(/Ce navigateur ne peut pas afficher la carte/);
  await expect(panneau.getByRole('button', { name: 'Satellite', exact: true })).toHaveCount(0);
  await expect(dessin.locator('path.satellite-svg-garden')).toHaveCount(2);
  await expect(dessin.locator('path.satellite-svg-zone')).toHaveCount(1);
  await expect(panneau.locator('.satellite-svg .satellite-label', { hasText: 'Tunnel 1' })).toBeVisible();
  const ligneTunnel = panneau.getByRole('list', { name: 'Jardins de la parcelle' }).getByRole('button', { name: /^Tunnel 1/ });
  await ligneTunnel.click();
  await expect(dessin.locator('path.satellite-svg-garden[data-mode="greenhouse"]')).toHaveAttribute('data-highlighted', 'true');
  expect(demandes).toEqual([]);
  await verifierLEtape(page, journal, 'dessin SVG sans WebGL');
});
