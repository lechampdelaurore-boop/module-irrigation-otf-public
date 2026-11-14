import { expect, test } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P33 : la vue d'ensemble des réserves du sol, variante B
 * (docs/soil-reserve-contract.md, « La vue d'ensemble par jardin », S2,
 * D-109), sur une ferme neuve qui coche tout, propre au parcours et à la
 * largeur.
 *
 * Sans sol saisi, les barres des Prés sont « inconnue », un tiret à la place
 * du chiffre, jamais zéro. Le sol de « Sous le verger » saisi et la parcelle
 * observée « sec », 25 % du plein : la barre du Jardin du verger, dont les
 * carottes sont en place quel que soit le jour du parcours, se remplit à
 * 25 %, au chiffre du titre de son pli ; V01 y est un point, et le compte des
 * points orange est celui écrit sous le nom et dans le texte de la barre.
 * Toucher une barre ouvre le pli du jardin, même inconnu, et y mène. Au
 * téléphone, le nom au-dessus de la barre, le chiffre à droite, la barre à
 * 44 px ; aux deux largeurs, sans débordement ni erreur.
 *
 * Ce qu'il ne prouve pas : chaque règle d'affichage (abri, sous le seuil,
 * arrêt avant récolte, prévu absent, sans planche cultivée), prouvée par
 * tests/soil-reserve-garden-bars.test.ts ; un jardin « aucune planche
 * cultivée », qui dépend du jour dans la ferme de démonstration ; les
 * chiffres de la jauge, prouvés par les tests du domaine et du service ; la
 * ferme réelle.
 */

test('la vue d’ensemble montre une barre par jardin, inconnue sans sol, remplie au % du pli une fois observée, et ouvre le pli au toucher', async ({ page, context }, testInfo) => {
  const telephone = testInfo.project.name === 'telephone';
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'p33');
  await attendreLaPageIrrigation(page, 'sol');
  const section = page.locator('section.soil-reserve');
  const pres = section.getByRole('region', { name: 'Réserve · Les Prés' });
  const vuePres = pres.getByRole('group', { name: 'Vue d’ensemble · Les Prés' });
  const barreNord = vuePres.getByRole('button', { name: /^Jardin Nord : / });
  const barreTunnel = vuePres.getByRole('button', { name: /^Tunnel 1, abri : / });

  // Sans sol saisi : inconnue, un tiret, jamais zéro (D-003) ; la légende et les repères.
  await expect(vuePres.locator('.soil-bars-legend')).toHaveText(/jardin maintenant.*planche sous son seuil.*prévu dimanche/);
  await expect(barreNord).toHaveAccessibleName('Jardin Nord : réserve inconnue');
  await expect(barreTunnel).toHaveAccessibleName('Tunnel 1, abri : réserve inconnue');
  await expect(barreTunnel.locator('.soil-bar-name small')).toHaveText('abri');
  await expect(barreNord.locator('.soil-bar-name small')).toHaveText('plein champ');
  await expect(barreNord.locator('.soil-bar-track')).toHaveText('inconnue');
  await expect(barreNord.locator('.soil-bar-percent')).toHaveText('–');
  await expect(vuePres.locator('.soil-bar-fill')).toHaveCount(0);
  await expect(vuePres.locator('.soil-bars-axis')).toHaveText(/0 %.*25.*50.*75.*100 %/);
  await verifierLEtape(page, journal, 'barres inconnues sans sol');

  // Toucher la barre d'un jardin inconnu ouvre son pli, où « Observer l’abri » attend.
  if (telephone) await verifierCibleTactile(barreTunnel, 'La barre de Tunnel 1');
  const tunnel = pres.locator('details.soil-garden').filter({ has: page.locator('summary strong', { hasText: /^Tunnel 1 · abri$/ }) });
  await expect(tunnel).not.toHaveAttribute('open', '');
  await barreTunnel.click();
  await expect(tunnel).toHaveAttribute('open', '');
  await expect(tunnel.getByRole('group', { name: 'Observer l’abri' })).toBeVisible();
  await expect(tunnel.locator(':scope > summary')).toBeInViewport();
  await verifierLEtape(page, journal, 'toucher une barre ouvre le pli');

  // La carotte rattachée à sa culture de référence, sans quoi sa planche reste inconnue (pas d'ETM).
  await attendreLaPageIrrigation(page, 'reglages');
  const especes = page.locator('section.crop-coefficients');
  await especes.scrollIntoViewIfNeeded();
  const carotte = especes.locator('.species-link-row').filter({ has: page.locator('summary strong', { hasText: /^Carotte$/ }) });
  const confirmation = page.getByRole('dialog', { name: 'Rattacher Carotte ?' });
  await ouvrirParClic(carotte.getByRole('button', { name: /^Rattacher Carotte comme / }), confirmation);
  await confirmation.getByRole('button', { name: 'Rattacher', exact: true }).click();
  await expect(especes.getByRole('status')).toHaveText('Le rattachement de l’espèce est enregistré.');
  await verifierLEtape(page, journal, 'carotte rattachée');

  // Le sol de « Sous le verger », puis la parcelle observée « sec », 25 % du plein.
  await attendreLaPageIrrigation(page, 'sol');
  const statut = section.getByRole('status');
  const sol = section.getByRole('region', { name: 'Sol · Sous le verger' });
  await ouvrirParClic(section.locator('details.soil-settings > summary'), sol);
  const formulaire = sol.getByRole('group', { name: 'Enregistrer le sol de la parcelle' });
  await sol.locator('details.soil-record-fold > summary').first().click();
  const enregistrerLeSol = formulaire.getByRole('button', { name: 'Enregistrer le sol de la parcelle' });
  await expect(async () => {
    await formulaire.getByLabel('RFU du laboratoire (mm/m)').fill('');
    await formulaire.getByLabel('RFU du laboratoire (mm/m)').fill('62');
    await expect(enregistrerLeSol).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await formulaire.getByLabel('Part de cailloux (%)').fill('18');
  await enregistrerLeSol.click();
  await expect(statut).toHaveText('Le sol de la parcelle est enregistré.');
  const verger = section.getByRole('region', { name: 'Réserve · Sous le verger' });
  const curseur = verger.getByRole('group', { name: 'Observer la parcelle' });
  await curseur.getByRole('slider').fill('25');
  await curseur.getByRole('button', { name: 'Enregistrer l’observation' }).click();
  await expect(statut).toHaveText('L’observation de la parcelle, 25 % du plein, est enregistrée pour ses jardins de plein champ.');
  await verifierLEtape(page, journal, 'sol saisi et parcelle observée');

  // La barre au chiffre du titre de son pli, V01 en point, le compte des points orange écrit.
  const vueVerger = verger.getByRole('group', { name: 'Vue d’ensemble · Sous le verger' });
  const barreVerger = vueVerger.getByRole('button', { name: /^Jardin du verger : / });
  const jardinVerger = verger.locator('details.soil-garden').filter({ has: page.locator('summary strong', { hasText: /^Jardin du verger$/ }) });
  await expect(jardinVerger.locator(':scope > summary small')).toContainText('25 % du plein maintenant');
  await expect(barreVerger).toHaveAccessibleName(/^Jardin du verger : 25 % du plein maintenant/);
  await expect(barreVerger.locator('.soil-bar-percent')).toHaveText('25 %');
  await expect(barreVerger.locator('.soil-bar-fill')).toHaveAttribute('style', /width: ?25%/);
  await expect(barreVerger.locator('.soil-bar-bed')).toHaveCount(1);
  const orange = await barreVerger.locator('.soil-bar-bed[data-low="true"]').count();
  if (orange > 0) {
    await expect(barreVerger.locator('.soil-bar-name small')).toHaveText(`plein champ · ${orange} sous le seuil`);
    await expect(barreVerger).toHaveAccessibleName(new RegExp(`, ${orange} planches? sous le seuil$`));
  } else {
    await expect(barreVerger.locator('.soil-bar-name small')).toHaveText('plein champ');
    await expect(barreVerger).not.toHaveAccessibleName(/sous le seuil/);
  }
  // Les Prés n'ont pas de sol : leurs barres restent inconnues.
  await expect(barreNord).toHaveAccessibleName('Jardin Nord : réserve inconnue');
  await verifierLEtape(page, journal, 'barre remplie au % du pli');

  await barreVerger.click();
  await expect(jardinVerger).toHaveAttribute('open', '');
  await expect(jardinVerger.locator(':scope > summary')).toBeInViewport();

  // Au téléphone, le nom passe au-dessus de la barre, le chiffre reste à droite.
  if (telephone) {
    await verifierCibleTactile(barreVerger, 'La barre du Jardin du verger');
    const nom = await barreVerger.locator('.soil-bar-name').boundingBox();
    const piste = await barreVerger.locator('.soil-bar-track').boundingBox();
    const chiffre = await barreVerger.locator('.soil-bar-percent').boundingBox();
    expect(nom && piste && chiffre, 'le nom, la barre et le chiffre sont dessinés').toBeTruthy();
    if (nom && piste && chiffre) {
      expect(nom.y + nom.height).toBeLessThanOrEqual(piste.y + 1);
      expect(chiffre.x).toBeGreaterThanOrEqual(piste.x + piste.width - 1);
    }
  }
  await verifierLEtape(page, journal, 'le pli du verger ouvert, mise en page à la largeur');
});
