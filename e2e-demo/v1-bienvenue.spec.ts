import { expect, test } from '@playwright/test';
import { commencerLaVisite, etapeSuivante, jouerLaVisite, ouvrirLaDemo, verifierLAccessibiliteDe, verifierLEtapeDeVisite, type EtapeAttendue } from './support/visite.ts';

/**
 * Parcours V1 : la visite « Bienvenue » (docs/demo-guided-contract.md,
 * section 7, visite 1 ; D3). L'invitation de la première ouverture la lance ;
 * la visite avance, recule, reprend après un rechargement là où elle en
 * était, se quitte par Échap en rendant le focus, et se marque « déjà vue »
 * une fois finie. La bulle et la liste tiennent les cibles de 44 px et les
 * contrastes de 4,5:1 (section 9).
 */
const PAGE = '/irrigation/aujourdhui';
const ETAPES: EtapeAttendue[] = [
  { titre: 'Bienvenue dans la démonstration', rang: 'étape 1 sur 7', chemin: PAGE },
  { titre: 'Rien n’est réel ici', rang: 'étape 2 sur 7', ancre: 'banniere', chemin: PAGE },
  { titre: 'Une ferme, un moment de la saison', rang: 'étape 3 sur 7', ancre: 'banniere-choix', chemin: PAGE },
  { titre: 'Une page par fonctionnalité', rang: 'étape 4 sur 7', ancre: 'menu', chemin: PAGE },
  { titre: 'L’aide de chaque page', rang: 'étape 5 sur 7', ancre: 'aide-page', chemin: PAGE },
  { titre: 'Les visites, quand vous voulez', rang: 'étape 6 sur 7', ancre: 'visites', chemin: PAGE },
  { titre: 'Essayez sans crainte', rang: 'étape 7 sur 7', ancre: 'remise-a-zero', chemin: PAGE },
];

test('V1 Bienvenue : l’invitation, avancer, reculer, reprendre, quitter par Échap, finir', async ({ page }) => {
  const visite = await ouvrirLaDemo(page, 'maraichage', 'ete');
  const bulle = page.locator('.tour-bubble');

  // L'invitation ne prend pas le focus : le visiteur lit sa page.
  await expect(bulle.getByRole('heading', { name: 'Découvrir la démonstration' })).toBeVisible();
  await expect(bulle.getByRole('heading', { name: 'Découvrir la démonstration' })).not.toBeFocused();
  await verifierLAccessibiliteDe(page, '.tour-bubble');
  await bulle.getByRole('button', { name: 'Commencer la visite' }).click();

  await verifierLEtapeDeVisite(page, visite, ETAPES[0]);
  await expect(bulle.getByRole('button', { name: 'Précédent' })).toHaveCount(0);
  await verifierLAccessibiliteDe(page, '.tour-bubble');
  await etapeSuivante(page);
  await verifierLEtapeDeVisite(page, visite, ETAPES[1]);
  await bulle.getByRole('button', { name: 'Précédent' }).click();
  await verifierLEtapeDeVisite(page, visite, ETAPES[0]);
  await etapeSuivante(page);
  await etapeSuivante(page);
  await verifierLEtapeDeVisite(page, visite, ETAPES[2]);
  await verifierLAccessibiliteDe(page, '.tour-bubble');

  // Reprenable : l'étape est rangée dans le navigateur.
  await page.reload();
  await verifierLEtapeDeVisite(page, visite, ETAPES[2]);

  // Échap quitte la visite et rend le focus au bouton de la bannière.
  await page.keyboard.press('Escape');
  await expect(bulle).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Visites guidées' })).toBeFocused();
  await page.reload();
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  await expect(bulle).toHaveCount(0);

  // La liste : accessible, puis la visite entière.
  await page.getByRole('button', { name: 'Visites guidées' }).click();
  const liste = page.getByRole('dialog', { name: 'Visites guidées' });
  await expect(liste.getByRole('button')).toHaveCount(8);
  await verifierLAccessibiliteDe(page, '.tour-list');
  await page.keyboard.press('Escape');
  await expect(liste).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Visites guidées' })).toBeFocused();

  await commencerLaVisite(page, 'Bienvenue');
  await jouerLaVisite(page, visite, ETAPES);
  await page.getByRole('button', { name: 'Visites guidées' }).click();
  await expect(liste.getByRole('button', { name: /Bienvenue/ })).toContainText('déjà vue');
});
