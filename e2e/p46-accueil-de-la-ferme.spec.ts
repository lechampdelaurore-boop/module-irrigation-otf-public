import { expect, test, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { carteDeCulture } from './support/cultures.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, ouvrirLePli, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P46 : l'accueil de la ferme, dans Réglages (4.4,
 * docs/tranche-4-contract.md, F417, F426, F427 ; PR 1, F581).
 *
 * La ferme habituelle des parcours utilisait le module avant l'accueil des
 * nouvelles fermes : ses cinq étapes sont confirmées, « réglage d'avant
 * l'accueil, gardé tel quel », comme la migration 0034 l'a fait pour les
 * espaces réels. Une ferme neuve a ses cinq étapes à faire, dites en rouge
 * et en mots ; elle choisit sa commune (F582), classe ses jardins (F583) et
 * saisit le sol de ses parcelles, la texture proposant TEW et REW (F584) ;
 * les cultures du CRIIAM lui disent venir d'une autre région (F586).
 */

const ETAPES = ['Où est la ferme', 'Parcelles et abris', 'Sol', 'Cultures', 'Réglages à relire'];

async function ouvrirLAccueil(page: Page) {
  const pli = page.locator('section.onboarding-settings details');
  await expect(pli).not.toHaveAttribute('open', '');
  return ouvrirLePli(pli);
}

test('une ferme d’avant la 4.4 lit que ses réglages sont gardés tels quels', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'reglages');
  const pli = await ouvrirLAccueil(page);
  await expect(pli.locator('summary')).toContainText('Accueil de la ferme');
  await expect(pli.locator('summary')).toContainText('Fait avant l’accueil des nouvelles fermes.');
  await expect(pli).toContainText('Votre ferme utilisait le module avant l’accueil des nouvelles fermes : ses réglages sont gardés tels quels.');
  const etapes = pli.locator('li.onboarding-step');
  await expect(etapes).toHaveCount(5);
  for (const [index, nom] of ETAPES.entries()) {
    await expect(etapes.nth(index)).toContainText(nom);
    await expect(etapes.nth(index)).toContainText('Confirmé');
    await expect(etapes.nth(index)).toContainText('Réglage d’avant l’accueil, gardé tel quel.');
  }
  // Rien à finir : aucun bandeau, sur Réglages comme ailleurs (F582).
  await expect(page.locator('.onboarding-unfinished')).toHaveCount(0);
  await verifierLEtape(page, journal, 'accueil d’avant la 4.4');
});

test('une ferme neuve a ses cinq étapes à faire ; choisir sa commune, classer ses jardins, puis saisir le sol de ses parcelles confirme les trois premières', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'accueil');
  await attendreLaPageIrrigation(page, 'reglages');
  const pli = await ouvrirLAccueil(page);
  await expect(pli.locator('summary')).toContainText('5 étapes sur 5 à finir.');
  await expect(pli).toContainText('rien n’est confirmé à votre place.');
  const etapes = pli.locator('li.onboarding-step-missing');
  await expect(etapes).toHaveCount(5);
  for (const [index, nom] of ETAPES.entries()) {
    await expect(etapes.nth(index)).toContainText(nom);
    await expect(etapes.nth(index)).toContainText('À faire.');
  }
  // L'étape de la commune mène au lieu de la météo ; le siège n'y est pas pris en silence (F419, F582).
  await expect(page.locator('.onboarding-unfinished')).toHaveText('À finir : commune de la ferme, 4 jardins à classer, sol de 3 parcelles.');
  await expect(page.locator('#water-weather-title').locator('xpath=ancestor::section[1]')).toContainText('Choisissez la commune de votre ferme : tant qu’elle n’est pas choisie, ni météo, ni gel, ni ET0.');
  await etapes.first().getByRole('link', { name: 'Choisir la commune' }).click();
  await expect(page).toHaveURL(/#water-weather-title$/);
  await verifierLEtape(page, journal, 'accueil d’une ferme neuve');

  await page.getByRole('button', { name: 'Prendre le siège OTF, en dernier recours' }).click();
  await expect(page.getByText('La commune du siège OTF est utilisée, en dernier recours.')).toBeVisible();
  await page.reload();
  await attendreLaPagePrete(page, 'reglages');
  await expect(page.locator('.onboarding-unfinished')).toHaveText('À finir : 4 jardins à classer, sol de 3 parcelles.');
  const apres = await ouvrirLAccueil(page);
  await expect(apres.locator('summary')).toContainText('4 étapes sur 5 à finir.');
  await expect(apres.locator('li.onboarding-step').first()).toContainText(/Confirmé le .+ : .+, siège de la structure dans Ouvre ta ferme, pris en dernier recours\./);
  await verifierLEtape(page, journal, 'commune prise en dernier recours');

  // Parcelles et abris (F583) : chaque jardin à classer, sa proposition ; un jardin corrigé, les autres confirmés d'un geste.
  const jardins = page.locator('section.plot-shelters li.plot-shelter');
  await expect(jardins).toHaveCount(4);
  await expect(page.locator('section.plot-shelters')).toContainText('4 jardins à classer : leur besoin en eau n’est pas calculé.');
  const tunnel = jardins.filter({ hasText: 'Tunnel 1' });
  await expect(tunnel).toContainText('Proposé : abri. À classer.');
  const nord = jardins.filter({ hasText: 'Jardin Nord' });
  await expect(nord).toContainText('Proposé : plein champ. À classer.');
  // La case suit la réponse du serveur : un clic, puis la réponse.
  await nord.getByRole('radio', { name: 'Abri' }).click();
  await expect(nord).toContainText('Jardin Nord : abri, enregistré.');
  await expect(nord).toContainText('Classé : abri, proposition corrigée.');
  await page.getByRole('button', { name: 'Confirmer les propositions restantes' }).click();
  await expect(page.getByText('3 jardins classés comme proposé.')).toBeVisible();
  await expect(tunnel).toContainText('Classé : abri, proposition confirmée.');
  await page.reload();
  await attendreLaPagePrete(page, 'reglages');
  await expect(page.locator('.onboarding-unfinished')).toHaveText('À finir : sol de 3 parcelles.');
  const classes = await ouvrirLAccueil(page);
  await expect(classes.locator('summary')).toContainText('3 étapes sur 5 à finir.');
  await expect(classes.locator('li.onboarding-step').nth(1)).toContainText(/Confirmé le .+ : 2 abris, 2 jardins de plein champ\./);
  await verifierLEtape(page, journal, 'jardins classés');

  // Le sol (F421, F584) : l'étape mène à la page « Réserve du sol », sur la première parcelle sans sol ; ni TEW ni REW
  // préremplis, la texture les propose (FAO-56, tableau 19), et le sol de chaque parcelle confirme l'étape.
  await classes.locator('li.onboarding-step').nth(2).getByRole('link', { name: 'Saisir le sol' }).click();
  await attendreLaPagePrete(page, 'sol');
  await expect(page).toHaveURL(/\/irrigation\/sol\?season=\d{4}#soil-parcel-zone-pres$/);
  await expect(page.locator('details.soil-settings')).toHaveJSProperty('open', true);
  for (const [index, parcelle] of ['Les Prés', 'Le Coteau', 'Sous le verger'].entries()) {
    const sol = page.getByRole('region', { name: `Sol · ${parcelle}` });
    const formulaire = sol.getByRole('group', { name: 'Enregistrer le sol de la parcelle' });
    const pli = sol.locator('details.soil-record-fold').first();
    if (!(await pli.evaluate((element) => (element as HTMLDetailsElement).open))) await pli.locator('summary').click();
    const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer le sol de la parcelle' });
    if (index === 0) {
      await expect(formulaire.getByLabel('Eau évaporable TEW (mm)')).toHaveValue('');
      await expect(formulaire.getByLabel('Eau facilement évaporable REW (mm)')).toHaveValue('');
      await expect(formulaire).toContainText('Part de référence 2/3 (CRIIAM) et couche de surface Ze 10 cm (FAO-56) : proposées, à ajuster.');
    }
    await expect(async () => {
      await formulaire.getByLabel('RFU du laboratoire (mm/m)').fill('');
      await formulaire.getByLabel('RFU du laboratoire (mm/m)').fill('62');
      await formulaire.getByLabel('Texture du sol').selectOption('sandy-loam');
      await expect(formulaire.getByLabel('Eau évaporable TEW (mm)')).toHaveValue('17,5', { timeout: 1_000 });
      await expect(enregistrer).toBeEnabled({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await expect(formulaire.getByLabel('Eau facilement évaporable REW (mm)')).toHaveValue('8');
    await expect(formulaire).toContainText('FAO-56, tableau 19, pour Ze = 10 cm : TEW de 15 à 20 mm, REW de 6 à 10 mm ; le milieu est proposé, à ajuster.');
    await enregistrer.click();
    await expect(page.locator('section.soil-reserve').getByRole('status')).toHaveText('Le sol de la parcelle est enregistré.');
    await expect(sol.locator('.soil-current')).toContainText('texture limon sableux (sandy loam) (FAO-56, tableau 19)');
  }
  await verifierLEtape(page, journal, 'sol des trois parcelles saisi');
  await attendreLaPageIrrigation(page, 'reglages');
  await expect(page.locator('.onboarding-unfinished')).toHaveCount(0);
  const fin = await ouvrirLAccueil(page);
  await expect(fin.locator('summary')).toContainText('2 étapes sur 5 à finir.');
  await expect(fin.locator('li.onboarding-step').nth(2)).toContainText(/Confirmé le .+ : sol de 3 parcelles saisi\./);
  await verifierLEtape(page, journal, 'étape du sol confirmée');

  // Les cultures (F422, F586) : les dates du CRIIAM viennent du Sud / Occitanie, une ferme d'une autre région en est
  // avertie sur la carte, fermée comme ouverte ; les cultures de la FAO-56 sont générales, sans avertissement.
  await attendreLaPageIrrigation(page, 'cultures');
  const cultures = page.locator('section.crop-coefficients');
  const asperge = await carteDeCulture(cultures, 'Asperge');
  await expect(asperge.locator('summary').first()).toContainText('dates d’une autre région');
  await asperge.locator('summary').first().click();
  await expect(asperge.locator('.reference-crop-region-warning')).toHaveText(/^Ces dates viennent d’une autre région que la vôtre \(.+\) : vérifiez-les\.$/);
  const brocoli = await carteDeCulture(cultures, 'Brocoli');
  await expect(brocoli.locator('.reference-crop-region-warning')).toHaveCount(0);
  await expect(brocoli.locator('summary').first()).not.toContainText('dates d’une autre région');
  await verifierLEtape(page, journal, 'cultures d’une autre région signalées');
});
