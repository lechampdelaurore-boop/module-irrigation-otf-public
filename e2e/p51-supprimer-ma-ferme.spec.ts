import { expect, test, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPagePrete, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

const NOM_DE_LA_FERME = 'Ferme de démonstration';
const TITRE_FIGE = /^Votre ferme sera effacée du module le \d{2}\/\d{2}\/\d{4} vers 6 h 15$/;

/** L'écran de l'espace figé, à la place de la page demandée, prêt à répondre. */
async function attendreLEcranFige(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: TITRE_FIGE })).toBeVisible();
  await expect(page.locator('section.frozen-farm[data-interactive="true"]')).toHaveCount(1);
}

/**
 * Parcours P51 : supprimer sa ferme et ses données, puis se raviser (4.5,
 * PR 3, troisième partie ; docs/tranche-4-contract.md, F563, et 10 bis.22,
 * F665 à F669 ; docs/browser-journeys-contract.md).
 *
 * Une ferme neuve, propre au parcours et à la largeur, ouvre « Supprimer ma
 * ferme et mes données », replié en bas de Réglages : ce qui disparaît, ce
 * qui reste, le délai, l'autorisation à retirer dans Ouvre ta ferme. Le
 * bouton reste inactif tant que le nom de la ferme n'est pas tapé. La
 * demande faite, chaque page du module montre l'écran de l'espace figé : le
 * jour de l'effacement, aucune lecture d'Ouvre ta ferme, aucune saisie. La
 * page d'état de l'exploitant (la ferme des parcours est celle du
 * déploiement) liste la demande et refuse un numéro de ferme faux. Puis la
 * personne annule : la ferme se rouvre. Aux deux largeurs : rien ne déborde,
 * la console reste propre ; la demande annulée ne compte pas sur la page
 * d'état (P50 la trouve vide).
 *
 * Ce qu'il ne prouve pas : l'effacement lui-même, sept jours plus tard ou
 * sans attendre (prouvé par `tests/db/farm-erasure.test.ts` et
 * `tests/db/farm-erasure-request.test.ts`, sur deux espaces).
 */
test('une ferme demande sa suppression après avoir tapé son nom, se voit figée sur chaque page, puis annule et se rouvre', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'effacement');
  await page.goto('/irrigation/reglages');
  await attendreLaPagePrete(page, 'reglages');

  const section = page.locator('section.farm-erasure-settings');
  const pli = section.locator('details');
  await expect(pli).not.toHaveAttribute('open', '');
  await pli.locator(':scope > summary').click();
  await expect(pli).toHaveAttribute('open', '');
  await expect(section.getByRole('heading', { level: 2, name: 'Supprimer ma ferme et mes données' })).toBeVisible();
  await expect(section).toContainText('L’effacement a lieu 7 jours après la demande ; jusque-là, vous pouvez annuler.');
  await expect(section).toContainText('historique de l’hébergeur jusqu’à 30 jours');
  await expect(section).toContainText('doit être retirée par un administrateur de la ferme, dans Ouvre ta ferme');

  const formulaire = section.getByRole('form', { name: 'Demander la suppression de la ferme' });
  const nom = formulaire.getByLabel(`Pour confirmer, tapez le nom de la ferme : « ${NOM_DE_LA_FERME} »`);
  const supprimer = formulaire.getByRole('button', { name: 'Supprimer ma ferme et mes données' });
  await expect(supprimer).toBeDisabled();
  await nom.fill('Ferme');
  await expect(supprimer).toBeDisabled();
  await nom.fill(`  ${NOM_DE_LA_FERME.toUpperCase()} `);
  await expect(supprimer).toBeEnabled();
  await verifierCibleTactile(supprimer, 'Le bouton « Supprimer ma ferme et mes données »');
  await verifierLEtape(page, journal, 'section de la suppression, nom tapé');
  await supprimer.click();

  // La page se relit sur l'écran de l'espace figé.
  await attendreLEcranFige(page);
  const ecran = page.locator('section.frozen-farm');
  await expect(ecran).toContainText(/Vous avez demandé le \d{2}\/\d{2}\/\d{4} la suppression de votre ferme et de vos données dans le module\./);
  await expect(ecran).toContainText('aucun calcul, aucune notification, aucune lecture d’Ouvre ta ferme, aucune saisie');
  await expect(ecran).toContainText('se retire par un administrateur de la ferme, dans Ouvre ta ferme');
  await verifierLEtape(page, journal, 'écran de l’espace figé');

  // Toute page du module mène au même écran, sans rien lire d'autre.
  for (const adresse of ['/irrigation/aujourdhui', '/irrigation/materiel', '/irrigation']) {
    await page.goto(adresse);
    await attendreLEcranFige(page);
  }

  // La page d'état de l'exploitant liste la demande, et refuse un numéro de ferme faux.
  await page.goto('/irrigation/exploitation');
  await expect(page.getByRole('heading', { level: 1, name: 'État du module' })).toBeVisible();
  const demandes = page.getByRole('list', { name: 'Demandes d’effacement ouvertes' }).getByRole('listitem');
  await expect(demandes).toHaveCount(1);
  await expect(demandes).toContainText(/: demandée le \d{2}\/\d{2}\/\d{4}, effacement prévu le \d{2}\/\d{2}\/\d{4}$/);
  await expect(demandes).not.toContainText(NOM_DE_LA_FERME);
  const effacer = page.getByRole('form', { name: 'Effacer sans attendre' });
  await expect(effacer).toHaveAttribute('data-interactive', 'true');
  await effacer.getByLabel('Numéro de la ferme, pour confirmer').fill('0');
  const effacerMaintenant = effacer.getByRole('button', { name: 'Effacer maintenant' });
  await verifierCibleTactile(effacerMaintenant, 'Le bouton « Effacer maintenant »');
  await effacerMaintenant.click();
  await expect(effacer.getByRole('status')).toHaveText(/^Retapez le numéro de la ferme de la demande \(« .+ »\) pour confirmer\.$/);
  await verifierLEtape(page, journal, 'demande vue par l’exploitant');

  // La personne se ravise : la ferme se rouvre.
  await page.goto('/irrigation/reglages');
  await attendreLEcranFige(page);
  const annuler = page.getByRole('button', { name: 'Annuler la demande' });
  await verifierCibleTactile(annuler, 'Le bouton « Annuler la demande »');
  await annuler.click();
  await expect(page.getByRole('heading', { level: 1, name: 'La demande est annulée' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('La demande est annulée : la ferme reprend dès maintenant, et les calculs du matin demain.');
  await verifierLEtape(page, journal, 'demande annulée');
  await page.getByRole('link', { name: 'Rouvrir la ferme' }).click();
  await attendreLaPagePrete(page, 'reglages');
  await expect(page.locator('section.farm-erasure-settings details')).not.toHaveAttribute('open', '');
  await verifierLEtape(page, journal, 'ferme rouverte');
});
