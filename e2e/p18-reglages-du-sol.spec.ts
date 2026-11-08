import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P18 : les réglages de la réserve du sol, dans la section
 * « Planning de la semaine » (docs/soil-reserve-contract.md, « L'écran »,
 * 5 ter, PR 3a).
 *
 * Le parcours saisit le sol d'une parcelle — 62 mm/m au laboratoire, 18 % de
 * cailloux — et lit la RFU du sol calculée, 51 mm/m, avant et après
 * l'enregistrement ; saisit la valeur propre d'un jardin ou d'un abri de cette
 * parcelle ; voit l'avertissement de vraisemblance d'une RFU de laboratoire
 * trop forte sans l'enregistrer ; règle le seuil d'arrosage de l'exploitation
 * à 50 % du plein (D-059), puis le rend à la culture.
 *
 * Chaque largeur prend sa parcelle, pour que la seconde ne relise pas les
 * saisies de la première. Une saisie de sol est une révision datée qui ne
 * s'efface pas ; aucun autre écran ne la lit encore, et le seuil revient
 * « selon la culture » à la fin. Les vérifications portent sur ce que le geste
 * vient d'enregistrer, jamais sur l'état de départ.
 *
 * Ce qu'il ne prouve pas : la jauge elle-même, prouvée par les tests du
 * domaine (tests/soil-reserve-crop.test.ts, tests/soil-reserve-bare.test.ts)
 * et montrée par la PR suivante.
 */

const CAS = {
  ordinateur: { parcelle: 'Les Prés', lieu: 'Tunnel 1 · abri', message: 'La valeur propre de l’abri est enregistrée.' },
  telephone: { parcelle: 'Le Coteau', lieu: 'Jardin Sud', message: 'La valeur propre du jardin est enregistrée.' },
} as const;

test('le sol d’une parcelle et d’un jardin se saisit, la RFU du sol se calcule, et le seuil d’arrosage se règle, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  const cas = CAS[testInfo.project.name as keyof typeof CAS];
  const journal = surveillerLaConsole(page);
  // La réserve du sol a sa page (3.8).
  await attendreLaPageIrrigation(page, 'sol');
  const section = page.locator('section.soil-reserve');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole('heading', { name: 'Réserve du sol' })).toBeVisible();
  const statut = section.getByRole('status');

  // Le sol de la parcelle : la RFU du sol se calcule pendant la saisie.
  const parcelle = section.getByRole('region', { name: `Sol · ${cas.parcelle}` });
  await ouvrirParClic(section.locator('details.soil-settings > summary'), parcelle);
  const formulaire = parcelle.getByRole('group', { name: 'Enregistrer le sol de la parcelle' });
  await ouvrirParClic(parcelle.locator('details.soil-record-fold > summary').first(), formulaire);
  // Le premier geste peut partir avant que React ne reprenne la page : la
  // saisie se refait jusqu'à ce que la RFU du sol réponde (attente de condition).
  await expect(async () => {
    for (const [champ, valeur] of [['RFU du laboratoire (mm/m)', '62'], ['Part de cailloux (%)', '18']] as const) {
      await formulaire.getByLabel(champ).fill('');
      await formulaire.getByLabel(champ).fill(valeur);
    }
    await expect(formulaire.locator('.soil-computed')).toHaveText('RFU du sol : 51 mm/m', { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await formulaire.getByLabel('Profondeur prélevée (cm)').fill('30');
  await formulaire.getByLabel('Source (laboratoire, référence, date, remarque)').fill('Analyse de démonstration');
  const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer le sol de la parcelle' });
  await verifierCibleTactile(enregistrer, 'Le bouton « Enregistrer le sol de la parcelle »');
  await enregistrer.click();
  await expect(statut).toHaveText('Le sol de la parcelle est enregistré.');
  const actuel = parcelle.locator('.soil-current').first();
  await expect(actuel).toContainText('RFU du sol : 51 mm/m');
  await expect(actuel).toContainText('laboratoire 62 mm/m · cailloux 18 %');
  await expect(actuel).toContainText('(0-30 cm)');
  await verifierLEtape(page, journal, 'sol de la parcelle enregistré');

  // Une RFU de laboratoire trop forte est signalée avant l'enregistrement ;
  // le pli s'est refermé sur la saisie enregistrée et repart d'elle.
  await parcelle.locator('details.soil-record-fold > summary').first().click();
  await expect(formulaire.getByLabel('RFU du laboratoire (mm/m)')).toHaveValue('62');
  await formulaire.getByLabel('RFU du laboratoire (mm/m)').fill('250');
  await expect(formulaire.getByRole('alert')).toBeVisible();
  await formulaire.getByLabel('RFU du laboratoire (mm/m)').fill('62');
  await expect(formulaire.getByRole('alert')).toHaveCount(0);
  await verifierLEtape(page, journal, 'avertissement de vraisemblance');

  // La valeur propre d'un jardin ou d'un abri, qui part de celle de la parcelle.
  const lieu = parcelle.getByRole('list', { name: `Jardins et abris · ${cas.parcelle}` }).getByRole('listitem').filter({ hasText: cas.lieu });
  await expect(lieu).toContainText('Valeur de la parcelle.');
  const propre = lieu.getByRole('group', { name: 'Saisir une valeur propre' });
  await ouvrirParClic(lieu.locator('details.soil-record-fold > summary'), propre);
  await expect(propre.getByLabel('RFU du laboratoire (mm/m)')).toHaveValue('62');
  await propre.getByLabel('Part de cailloux (%)').fill('');
  await propre.getByLabel('RFU du laboratoire (mm/m)').fill('80');
  await expect(propre.locator('.soil-computed')).toHaveText('RFU du sol : 80 mm/m');
  const enregistrerPropre = propre.getByRole('button', { name: 'Saisir une valeur propre' });
  await verifierCibleTactile(enregistrerPropre, 'Le bouton « Saisir une valeur propre »');
  await enregistrerPropre.click();
  await expect(statut).toHaveText(cas.message);
  await expect(lieu.locator('.soil-current')).toContainText('RFU du sol : 80 mm/m');
  await expect(lieu.locator('.soil-current')).toContainText('Part de cailloux non renseignée : comptée pour 0.');
  await verifierLEtape(page, journal, 'valeur propre enregistrée');

  // Le seuil d'arrosage de l'exploitation (D-059), réglé puis rendu à la culture.
  const ferme = section.getByRole('region', { name: 'Réglages de l’exploitation' });
  await ferme.scrollIntoViewIfNeeded();
  const enregistrerReglages = ferme.getByRole('button', { name: 'Enregistrer les réglages' });
  await ferme.getByLabel(/Réglé par l’exploitation/).check();
  await ferme.getByLabel('Conseiller d’arroser sous').selectOption({ label: '50 % du plein' });
  await verifierCibleTactile(enregistrerReglages, 'Le bouton « Enregistrer les réglages »');
  await enregistrerReglages.click();
  await expect(statut).toHaveText('Les réglages de l’exploitation sont enregistrés.');
  await expect(section.locator('details.soil-settings > summary')).toContainText('seuil réglé à 50 % du plein');
  await expect(ferme).toContainText('seuil 50 %');
  await verifierLEtape(page, journal, 'seuil réglé par l’exploitation');

  await ferme.getByLabel(/Selon la culture/).check();
  await enregistrerReglages.click();
  await expect(statut).toHaveText('Les réglages de l’exploitation sont enregistrés.');
  await expect(section.locator('details.soil-settings > summary')).toContainText('seuil selon la culture');
  await verifierLEtape(page, journal, 'seuil rendu à la culture');
});
