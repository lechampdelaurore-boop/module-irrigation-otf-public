import { test } from '@playwright/test';
import { commencerLaVisite, ecarterLInvitation, jouerLaVisite, ouvrirLaDemo, verifierLAccessibiliteDe } from './support/visite.ts';

/** Parcours V7 : la visite « Et pour ma ferme ? » (contrat, section 7, visite 7 ; D3) : du texte seul, au milieu de l'écran. */
test('V7 Et pour ma ferme ? : trois bulles de texte, sans saisie', async ({ page }) => {
  const visite = await ouvrirLaDemo(page, 'petite-ferme', 'automne');
  await ecarterLInvitation(page);
  await commencerLaVisite(page, 'Et pour ma ferme ?');
  await verifierLAccessibiliteDe(page, '.tour-bubble');
  await jouerLaVisite(page, visite, [
    { titre: 'Relier sa propre ferme', rang: 'étape 1 sur 3', chemin: '/irrigation/aujourdhui' },
    { titre: 'Ce qu’il faudrait', rang: 'étape 2 sur 3', chemin: '/irrigation/aujourdhui' },
    { titre: 'Pour la suite', rang: 'étape 3 sur 3', chemin: '/irrigation/aujourdhui' },
  ]);
});
