import { expect, test } from '@playwright/test';
import { commencerLaVisite, ecarterLInvitation, etapeSuivante, jouerLaVisite, ouvrirLaDemo, verifierLEtapeDeVisite, type EtapeAttendue } from './support/visite.ts';

/**
 * Parcours V4 : la visite « Quand l'eau manque » (contrat, section 7,
 * visite 4 ; D3), au pic de l'été : trois pages. Le visiteur part ailleurs
 * en cours de route : la visite l'attend, sans prendre le focus ni le
 * ramener d'elle-même, et reprend sur son clic.
 */
const ETAPES: EtapeAttendue[] = [
  { titre: 'L’eau disponible', rang: 'étape 1 sur 5', ancre: 'aujourdhui-eau', chemin: '/irrigation/aujourdhui' },
  { titre: 'Les réserves et leur minimum', rang: 'étape 2 sur 5', ancre: 'ressources-reserves', chemin: '/irrigation/ressources' },
  { titre: 'Le manque chiffré', rang: 'étape 3 sur 5', ancre: 'planning-semaine', chemin: '/irrigation/planning' },
  { titre: 'Qui passe après les autres', rang: 'étape 4 sur 5', ancre: 'planning-non-servies', chemin: '/irrigation/planning' },
  { titre: 'La faisabilité de la semaine', rang: 'étape 5 sur 5', ancre: 'faisabilite', chemin: '/irrigation/ressources' },
];

test('V4 Quand l’eau manque : trois pages, une pause ailleurs, la reprise sur un clic', async ({ page }) => {
  const visite = await ouvrirLaDemo(page, 'maraichage', 'penurie');
  await ecarterLInvitation(page);
  await commencerLaVisite(page, 'Quand l’eau manque');
  await verifierLEtapeDeVisite(page, visite, ETAPES[0]);
  await expect(page.locator('[data-tour-active="true"]')).toContainText('Bassin des noues');
  await etapeSuivante(page);
  await verifierLEtapeDeVisite(page, visite, ETAPES[1]);

  // Le visiteur va voir l'historique : la visite se met en pause.
  await page.goto('/irrigation/historique');
  const bulle = page.locator('.tour-bubble');
  await expect(bulle.getByRole('heading', { name: 'Quand l’eau manque' })).toBeVisible();
  await expect(bulle).toContainText('La visite continue sur la page « Ressources et pompes ».');
  await expect(bulle.getByRole('heading')).not.toBeFocused();
  await expect(page).toHaveURL(/\/irrigation\/historique/);
  await bulle.getByRole('button', { name: 'Reprendre la visite' }).click();

  await jouerLaVisite(page, visite, ETAPES.slice(1));
});
