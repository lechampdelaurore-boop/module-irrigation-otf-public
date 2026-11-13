import { expect, test } from '@playwright/test';
import { commencerLaVisite, ecarterLInvitation, etapeSuivante, ouvrirLaDemo, verifierLEtapeDeVisite } from './support/visite.ts';

/** Parcours V5 : la visite « Les alertes » (contrat, section 7, visite 5 ; D3), la nuit de gel du printemps. */
test('V5 Les alertes : le gel prévu, le seuil par culture, les alertes météo, la notification', async ({ page }) => {
  const visite = await ouvrirLaDemo(page, 'maraichage', 'gel-printemps');
  await ecarterLInvitation(page);
  await commencerLaVisite(page, 'Les alertes');
  await verifierLEtapeDeVisite(page, visite, { titre: 'Gel ou chaleur', rang: 'étape 1 sur 4', ancre: 'aujourdhui-gel', chemin: '/irrigation/aujourdhui' });
  await expect(page.locator('[data-tour-active="true"]')).toContainText('Gel annoncé');
  await etapeSuivante(page);
  await verifierLEtapeDeVisite(page, visite, { titre: 'Un seuil de gel par culture', rang: 'étape 2 sur 4', ancre: 'alertes-cultures', chemin: '/irrigation/alertes-cultures' });
  await expect(page.locator('[data-tour-active="true"]')).toContainText('Radis');
  await etapeSuivante(page);
  await verifierLEtapeDeVisite(page, visite, { titre: 'Les alertes météo', rang: 'étape 3 sur 4', ancre: 'alertes-meteo', chemin: '/irrigation/alertes-meteo' });
  await etapeSuivante(page);
  await verifierLEtapeDeVisite(page, visite, { titre: 'L’alerte qui vous parvient', rang: 'étape 4 sur 4', chemin: '/irrigation/alertes-meteo' });
  await etapeSuivante(page, 'Terminer');
  await expect(page.locator('.tour-bubble')).toHaveCount(0);
});
