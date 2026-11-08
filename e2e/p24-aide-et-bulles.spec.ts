import { expect, test, type Page } from '@playwright/test';
import { choisirMaterielEtReglage, preparerMaterielArrosant } from './support/materiel.ts';
import {
  attendreLaPageIrrigation,
  ouvrirParClic,
  surveillerLaConsole,
  TITRES_DES_PAGES,
  verifierCibleTactile,
  verifierLEtape,
  type PageDuModule,
} from './support/parcours.ts';

/**
 * Parcours P24 : l'aide de chaque page et la bulle « d'où vient ce chiffre »
 * (docs/feature-selection-contract.md, section 6, P33 à P35).
 *
 * Sur chacune des douze pages (« Aujourd'hui » comprise depuis le lot 2 de
 * l'audit ergonomique), le « ? » à côté du titre ouvre à quoi sert la page,
 * comment la lire et par où commencer, et la touche Échap le referme.
 * Puis, sur les pages où une ferme d'essai a son chiffre sans une semaine de
 * météo ni de relevés, la bulle dit le calcul avec les valeurs de la ferme :
 * l'apport horaire d'une planche (Matériel et placement) et la durée d'un
 * arrosage pour une dose (Arrosages). Les autres bulles ont chacune leur
 * test (tests/figure-origin.test.ts).
 */
test('le « ? » de chaque page l’explique ; une bulle dit d’où vient un chiffre', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);

  for (const cible of Object.keys(TITRES_DES_PAGES) as PageDuModule[]) {
    await attendreLaPageIrrigation(page, cible);
    await verifierLAideDeLaPage(page, TITRES_DES_PAGES[cible]);
    await verifierLEtape(page, journal, `aide de la page ${TITRES_DES_PAGES[cible]}`);
  }

  // Matériel et placement : l'apport horaire de la planche, matériel par matériel.
  await attendreLaPageIrrigation(page, 'materiel');
  const { materiel, reglage, planche } = await preparerMaterielArrosant(page, testInfo);
  await page.getByRole('button', { name: new RegExp(`^Planche ${planche},`) }).click();
  const fiche = page.locator('.selected-bed-details');
  await expect(fiche).toContainText(`Planche ${planche}`);
  const apport = fiche.locator('[data-irrigated="true"]');
  await verifierLaBulle(page, apport, `${materiel} (${reglage}) 10 mm/h`);
  await verifierLEtape(page, journal, 'bulle de l’apport horaire');

  // Arrosages : la durée d'un arrosage pour la dose demandée, 25 mm à 10 mm/h.
  await attendreLaPageIrrigation(page, 'arrosages');
  await page.getByRole('tab', { name: /^Irriguer maintenant/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage);
  const resultat = page.locator('.irrigation-preview');
  await expect(resultat.locator('.calculated-duration')).toContainText('2 h 30 min');
  await verifierLaBulle(page, resultat.locator('.calculated-duration'), `2 h 30 min : le temps pour que ${planche} reçoive 25 mm à 10 mm/h.`);
  await verifierLEtape(page, journal, 'bulle de la durée d’un arrosage');
});

async function verifierLAideDeLaPage(page: Page, titre: string): Promise<void> {
  const bouton = page.getByRole('button', { name: `Aide : ${titre}` });
  const aide = page.getByRole('region', { name: `Aide : ${titre}` });
  await expect(aide).toBeHidden();
  await verifierCibleTactile(bouton, `Le « ? » de la page ${titre}`);
  await ouvrirParClic(bouton, aide);
  await expect(bouton).toHaveAttribute('aria-expanded', 'true');
  for (const partie of ['À quoi sert cette page', 'Comment la lire', 'Par où commencer']) await expect(aide).toContainText(partie);
  await page.keyboard.press('Escape');
  await expect(aide).toBeHidden();
  await expect(bouton).toBeFocused();
}

/** Ouvre la bulle posée dans `porteur`, lit son texte, la referme par « Fermer ». */
async function verifierLaBulle(page: Page, porteur: ReturnType<Page['locator']>, attendu: string): Promise<void> {
  const bouton = porteur.getByRole('button', { name: 'D’où vient ce chiffre ?' });
  const bulle = porteur.getByRole('note');
  await ouvrirParClic(bouton, bulle);
  await expect(bulle).toContainText(attendu);
  await verifierLEtape(page, surveillerLaConsole(page), 'bulle ouverte');
  await bulle.getByRole('button', { name: 'Fermer' }).click();
  await expect(bulle).toBeHidden();
  await expect(bouton).toBeFocused();
}
