import { expect, test } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P53 : le réglage du message du matin (amélioration n° 3,
 * docs/ameliorations-6-2-3-7-contract.md, section 4.1, F702, F712 ;
 * docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, toutes cases cochées : dans « Réglages »,
 * « Notifications du téléphone » porte la case « Message du matin »,
 * cochée par défaut. La décocher l'enregistre aussitôt et le dit ; la page
 * rechargée la relit décochée ; la recocher l'enregistre de nouveau. Au
 * téléphone (390 px) et à l'ordinateur, à 1 440 px de large.
 *
 * Ce qu'il ne prouve pas : l'envoi du message, que le Worker de
 * notification simulé prouve dans les tests du service
 * (tests/db/message-du-matin.test.ts) ; son texte, dans les tests du
 * domaine (tests/message-du-matin.test.ts) ; l'essai sur un appareil réel,
 * recette du porteur.
 */

const DUREE_DU_PARCOURS = 120_000;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;

test('« Message du matin » : coché par défaut, se coupe, se relit et se rallume', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'message-du-matin');

  await attendreLaPageIrrigation(page, 'reglages');
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Notifications du téléphone' }) });
  const reglage = section.locator('#message-du-matin');
  const caseDuMatin = reglage.getByRole('checkbox', { name: 'Message du matin' });
  await reglage.scrollIntoViewIfNeeded();
  await expect(caseDuMatin).toBeChecked();
  await expect(reglage).toContainText('Rien n’est envoyé quand il n’y a rien à dire.');
  if (telephone) await verifierCibleTactile(reglage.locator('label'), 'La case « Message du matin »');
  await verifierLEtape(page, journal, 'case cochée par défaut');

  await caseDuMatin.uncheck();
  await expect(reglage.getByRole('status')).toHaveText('Le message du matin est coupé.');
  await expect(caseDuMatin).not.toBeChecked();
  await attendreLaPageIrrigation(page, 'reglages');
  await expect(page.locator('#message-du-matin').getByRole('checkbox', { name: 'Message du matin' })).not.toBeChecked();
  await verifierLEtape(page, journal, 'coupé, relu après rechargement');

  await page.locator('#message-du-matin').getByRole('checkbox', { name: 'Message du matin' }).check();
  await expect(page.locator('#message-du-matin').getByRole('status')).toHaveText('Le message du matin est activé.');
  await attendreLaPageIrrigation(page, 'reglages');
  await expect(page.locator('#message-du-matin').getByRole('checkbox', { name: 'Message du matin' })).toBeChecked();
  await verifierLEtape(page, journal, 'rallumé, relu');
});
