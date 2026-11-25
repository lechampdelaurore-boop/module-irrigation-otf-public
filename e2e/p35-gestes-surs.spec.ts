import { expect, test, type Page } from '@playwright/test';
import { type PageDuModule, attendreLaPageIrrigation, ouvrirLesReglagesDeLaPage, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape, ouvrirLaCorrespondanceDesEspeces , ouvrirLePli } from './support/parcours.ts';

/**
 * Parcours P35 : l'audit ergonomique final, lot C, gestes sûrs
 * (docs/audit-ergonomie-final-lot-c-contract.md ; docs/browser-journeys-contract.md).
 *
 * Sur la ferme de démonstration, sans rien laisser derrière lui :
 *
 * - « Pluie mesurée » : « Retirer la mesure », qui efface, est dessiné en
 *   contour rouge sur fond blanc, jamais du vert plein d'« Enregistrer », et
 *   s'en écarte de 24 px au moins (R6, cas 1, F236).
 *
 * - toutes les pages : chaque « i » fermé garde son dessin, quel que soit le
 *   bloc qui l'accueille : un rond de 24 px sur fond blanc à l'ordinateur ;
 *   au téléphone une boîte de 44 px transparente, le rond dessiné dessous ;
 *   jamais de marge intérieure ni de fond vert (J10, cas 6, F242) ; la
 *   fiche du besoin de la culture d'une planche, où il débordait sur « ET0 »,
 *   comprise : la carotte y est rattachée le temps de la lire, puis le
 *   rattachement est retiré, comme dans P15.
 *
 * Le planning (R6, cas 2 et 3) se vérifie dans P10, qui seul a des
 * propositions à l'écran.
 *
 * Ce qu'il ne prouve pas : un vrai téléphone, le mode sombre (absent), un
 * lecteur d'écran.
 */

const ECART_DES_GESTES_PX = 24;

test('« Retirer la mesure » se distingue d’« Enregistrer » et s’en écarte', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await attendreLaPageIrrigation(page, 'besoins');
  const pluie = await ouvrirLePli(page.locator('#manual-rain'));
  await pluie.scrollIntoViewIfNeeded();
  const enregistrer = pluie.getByRole('button', { name: 'Enregistrer', exact: true });
  const retirer = pluie.getByRole('button', { name: 'Retirer la mesure' });
  // Sans mesure, « Retirer la mesure » est indisponible (lot K, F471) : une mesure posée le temps du parcours, retirée à la fin.
  const millimetres = pluie.getByLabel('Millimètres');
  const avant = await millimetres.inputValue();
  if (avant === '') {
    await millimetres.fill('0');
    await enregistrer.click();
    await expect(pluie.locator('.action-reply .water-notice')).toHaveText('La pluie mesurée a été enregistrée.');
  }
  await expect(retirer).toBeEnabled();
  await expect(enregistrer).toHaveCSS('background-color', 'rgb(11, 105, 77)');
  await expect(retirer).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(retirer).toHaveCSS('color', 'rgb(143, 29, 42)');
  await expect(retirer).toHaveCSS('border-top-color', 'rgb(220, 53, 69)');
  if (telephone) await verifierCibleTactile(retirer, '« Retirer la mesure »');
  const [a, b] = await Promise.all([enregistrer.boundingBox(), retirer.boundingBox()]);
  const ecart = telephone ? b!.y - (a!.y + a!.height) : b!.x - (a!.x + a!.width);
  expect(Math.round(ecart), '« Retirer la mesure » écarté d’« Enregistrer »').toBeGreaterThanOrEqual(ECART_DES_GESTES_PX);
  if (avant === '') {
    await retirer.click();
    await expect(pluie.locator('.action-reply .water-notice')).toContainText('retirée');
    await expect(retirer).toBeDisabled();
  }
  await verifierLEtape(page, journal, '« Retirer la mesure » en contour rouge, écarté');
});

const PAGES: readonly PageDuModule[] = [
  'aujourdhui', 'arrosages', 'planning', 'besoins', 'sol', 'cultures', 'materiel',
  'ressources', 'alertes-meteo', 'alertes-cultures', 'historique', 'reglages',
];

test('le « i » garde son dessin dans tout bloc, sur toutes les pages', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  const attendu = telephone
    ? { largeur: 44, hauteur: 44, fond: 'rgba(0, 0, 0, 0)' }
    : { largeur: 24, hauteur: 24, fond: 'rgb(255, 255, 255)' };
  let vus = 0;
  // La fiche du besoin de la culture d'une planche (« Matériel », parcelle « Sous le verger ») est le bloc où le « i »
  // débordait sur « ET0 » (rapport, J10) : elle est ouverte en dernier, après la tournée des pages.
  for (const cible of [...PAGES, 'fiche-de-planche' as const]) {
    if (cible === 'fiche-de-planche') {
      await rattacherLaCarotte(page, true);
      await verifierLEtape(page, journal, 'carotte rattachée, pour que la fiche ait son « i »');
      await attendreLaPageIrrigation(page, 'materiel');
      await page.getByRole('region', { name: 'Choix du plan affiché' }).getByLabel('Parcelle').selectOption({ label: 'Sous le verger' });
      await ouvrirLesReglagesDeLaPage(page); // la fiche est dans le pli du bas (audit final, lot D, J2, F305)
      const fiche = page.getByRole('region', { name: 'Besoin de la culture · planche V01' });
      await expect(fiche.locator('.figure-origin-toggle').first()).toBeVisible({ timeout: 30_000 });
      await fiche.scrollIntoViewIfNeeded();
    } else {
      await attendreLaPageIrrigation(page, cible);
    }
    const ecarts = await page.locator('main .figure-origin-toggle').evaluateAll((boutons, attendu) => boutons
      .filter((bouton) => bouton.getBoundingClientRect().width > 0)
      .map((bouton) => {
        const style = getComputedStyle(bouton);
        const boite = bouton.getBoundingClientRect();
        const bloc = bouton.closest('section, article')?.className.split(' ')[0] ?? '?';
        return { bloc, largeur: Math.round(boite.width), hauteur: Math.round(boite.height), fond: style.backgroundColor, marge: style.paddingTop };
      })
      .filter((mesure) => mesure.largeur !== attendu.largeur || mesure.hauteur !== attendu.hauteur || mesure.fond !== attendu.fond || mesure.marge !== '0px'), attendu);
    vus += await page.locator('main .figure-origin-toggle').count();
    expect(ecarts, `les « i » de la page ${cible} qui ont perdu leur dessin`).toEqual([]);
  }
  expect(vus, 'des « i » mesurés').toBeGreaterThan(0);
  await verifierLEtape(page, journal, 'le « i » garde son dessin partout');

  // Remise en état, comme P15 : la base revient à son état de départ pour l'autre largeur.
  await rattacherLaCarotte(page, false);
  await verifierLEtape(page, journal, 'rattachement retiré');
});

/** Rattache la carotte à la carotte du jeu commun (la fiche de V01 a alors son ETM et son « i »), ou retire ce rattachement. */
async function rattacherLaCarotte(page: Page, rattacher: boolean): Promise<void> {
  await attendreLaPageIrrigation(page, 'reglages');
  await ouvrirLaCorrespondanceDesEspeces(page);
  const coefficients = page.locator('section.crop-coefficients');
  const carte = coefficients.locator('details.species-link-card').filter({ has: page.locator('summary strong', { hasText: /^Carotte$/ }) });
  const formulaire = carte.getByRole('group', { name: 'Rattachement de l’espèce Carotte' });
  await carte.scrollIntoViewIfNeeded();
  await ouvrirParClic(carte.locator('summary').first(), formulaire);
  if (!rattacher) {
    await formulaire.getByRole('button', { name: 'Retirer le rattachement' }).click();
    await expect(coefficients.getByRole('status')).toHaveText('Le rattachement de l’espèce est retiré : elle est de nouveau non rattachée.');
    return;
  }
  const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer' });
  await expect(async () => {
    await formulaire.getByLabel('À quelle culture ressemble cette espèce ?').selectOption({ value: '' });
    await formulaire.getByLabel('À quelle culture ressemble cette espèce ?').selectOption({ label: 'Carotte' });
    await expect(enregistrer).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await enregistrer.click();
  await expect(coefficients.getByRole('status')).toHaveText('Le rattachement de l’espèce est enregistré.');
}
