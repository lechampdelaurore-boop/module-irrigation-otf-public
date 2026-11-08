import { expect, test, type Page } from '@playwright/test';
import { ciblesTropPetites, textesPeuContrastes, type CibleMesuree, type TexteMesure } from './support/accessibilite.ts';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape, type PageDuModule } from './support/parcours.ts';

/**
 * Parcours P31c : l'audit ergonomique, lot 3, PR 2 — les mots simples
 * (point 8) et l'accessibilité (point 14) (docs/audit-ergonomie-lot3-contract.md,
 * section 5, cas 12 et 13 ; docs/browser-journeys-contract.md).
 *
 * Sur la ferme de démonstration, sans rien écrire :
 *
 * - « Besoin par culture » : le titre en clair, le détail technique replié
 *   dans « Pour les experts », un seul tableau des K_abri (cas 12) ;
 * - « Matériel » : le nom du réglage séparé des planches couvertes, une
 *   ligne de sens sous « Chevauchements » et « Cumul maximal » ;
 * - toutes les pages : « Aller au contenu » est le premier arrêt du clavier
 *   et mène au contenu ; au téléphone, aucune cible visible sous 44 px de
 *   haut, plis fermés puis tous ouverts ; aux deux largeurs, aucun texte
 *   sous 4,5:1 de contraste (3:1 pour un grand texte), fond calculé par
 *   superposition (cas 13, précisions F49, F69 à F71).
 *
 * Ce qu'il ne prouve pas : le mode sombre et un lecteur d'écran, non vérifiés
 * par ce lot (F50) ; une cible ou un texte qui n'existe que sur une autre
 * ferme ou dans une fenêtre ouverte par un geste ; un vrai téléphone.
 */

const PAGES: readonly PageDuModule[] = [
  'aujourdhui', 'arrosages', 'planning', 'besoins', 'sol', 'cultures', 'materiel',
  'ressources', 'alertes-meteo', 'alertes-cultures', 'historique', 'reglages',
];

/** Ouvre tous les plis de la page : leurs cibles et leurs textes se mesurent aussi. */
async function ouvrirTousLesPlis(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const pli of document.querySelectorAll('main details')) (pli as HTMLDetailsElement).open = true;
  });
}

test('besoin par culture en mots simples : titre en clair, plis « Pour les experts », un seul tableau des K_abri', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'cultures');
  const section = page.locator('section.crop-coefficients');
  await expect(section.getByRole('heading', { level: 2, name: 'Besoin en eau par culture' })).toBeVisible();
  await expect(section.locator('.crop-coefficients-heading p')).toContainText('Une culture ne boit pas autant à la levée qu’en pleine saison.');
  const experts = section.locator('.crop-coefficients-part > details.experts-fold').first();
  await expect(experts.locator('summary')).toHaveText('Pour les experts');
  await expect(experts.locator('.experts-fold-body')).toBeHidden();
  await experts.locator('summary').click();
  await expect(experts.locator('.experts-fold-body')).toContainText('Les valeurs du CRIIAM Sud s’imposent pour ses légumes');
  // Le résumé d'une culture ne dit plus sa source ni sa courbe : elles sont dans son pli d'experts.
  const carte = section.locator('details.reference-crop-card').first();
  await expect(carte.locator(':scope > summary')).not.toContainText(/CRIIAM Sud|FAO-56|escalier|trapèze/);
  await expect(carte.locator('details.experts-fold')).toContainText(/CRIIAM Sud|FAO-56/);
  // Un seul tableau des K_abri, un seul formulaire ; la formule et le lissage dans le pli d'experts.
  const reglages = section.locator('section.crop-water-settings');
  await expect(reglages.getByRole('table', { name: 'K_abri des abris' })).toBeVisible();
  await expect(reglages.getByRole('group', { name: 'Régler un K_abri' })).toHaveCount(1);
  await expect(reglages.getByRole('group', { name: /^Régler le K_abri · / })).toHaveCount(0);
  const options = reglages.getByRole('group', { name: 'Options du calcul' });
  await expect(options.locator('details.experts-fold')).toContainText('ETM = ET0 × K_abri × Kc × K_paillage × K_ombrage');
  await expect(options.locator('details.experts-fold')).toContainText('Lissage des passages de stade');
  await verifierLEtape(page, journal, 'besoin par culture en clair');
});

test('matériel : le réglage séparé des planches couvertes, une ligne de sens sous les chiffres', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // Une ferme neuve, propre au parcours : un matériel posé fait paraître l'aperçu de l'apport.
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'lot3-mots');
  await attendreLaPageIrrigation(page, 'materiel');
  const { reglage } = await preparerMaterielArrosant(page, testInfo);
  const apercu = page.locator('section.coverage-overview');
  await expect(apercu.locator('.coverage-metric-meaning').first()).toHaveText('Planches arrosées par deux matériels : sans souci si c’est voulu.');
  await expect(apercu.locator('.coverage-metric-meaning').nth(1)).toContainText('à comparer à ce que votre sol absorbe');
  const materiel = apercu.locator('.coverage-equipment-list button').first();
  await expect(materiel.locator('.coverage-setting-name')).toHaveText(`Réglage ${reglage}`);
  await expect(materiel.locator('small')).toContainText(/couvre \d+ planches?/);
  await verifierLEtape(page, journal, 'matériel en clair');
});

test('« Aller au contenu », cibles de 44 px au téléphone et contraste de 4,5:1 sur toutes les pages', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  const cibles: (CibleMesuree & { page: string })[] = [];
  const textes: (TexteMesure & { page: string })[] = [];
  for (const cible of PAGES) {
    await attendreLaPageIrrigation(page, cible);
    if (cible === 'aujourdhui' || cible === 'historique') {
      // Le premier arrêt du clavier saute la barre et le menu.
      await page.locator('body').press('Tab');
      const saut = page.getByRole('link', { name: 'Aller au contenu' });
      await expect(saut).toBeFocused();
      await expect(saut).toBeInViewport();
      await saut.press('Enter');
      await expect(page).toHaveURL(/#contenu$/);
      await expect(page.locator('#contenu')).toBeFocused();
    }
    for (const etat of ['plis fermés', 'plis ouverts'] as const) {
      if (etat === 'plis ouverts') await ouvrirTousLesPlis(page);
      if (telephone) cibles.push(...(await ciblesTropPetites(page)).map((mesure) => ({ ...mesure, page: `${cible}, ${etat}` })));
      textes.push(...(await textesPeuContrastes(page)).map((mesure) => ({ ...mesure, page: `${cible}, ${etat}` })));
    }
    await verifierLEtape(page, journal, `mesures de la page ${cible}`);
  }
  expect(cibles, 'Cibles de moins de 44 px au téléphone').toEqual([]);
  expect(textes, 'Textes sous le contraste minimal').toEqual([]);
});
