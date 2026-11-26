import { test } from '@playwright/test';
import { commencerLaVisite, ecarterLInvitation, jouerLaVisite, ouvrirLaDemo } from './support/visite.ts';

/**
 * Parcours V3 : la visite « Le planning » (contrat, section 7, visite 3 ; D3), en début d'été. Depuis S4
 * (PR 4), elle se joue sur « Semaine » et ouvre les plis de « Le détail » qui portent ses blocs.
 */
test('V3 Le planning : la semaine, les propositions, les planches non servies, les heures où l’on n’arrose pas', async ({ page }) => {
  const visite = await ouvrirLaDemo(page, 'maraichage', 'ete');
  await ecarterLInvitation(page);
  await commencerLaVisite(page, 'Le planning');
  await jouerLaVisite(page, visite, [
    { titre: 'La semaine en un coup d’œil', rang: 'étape 1 sur 4', ancre: 'planning-semaine', chemin: '/irrigation/semaine' },
    { titre: 'Des propositions, pas des ordres', rang: 'étape 2 sur 4', ancre: 'planning-propositions', chemin: '/irrigation/semaine' },
    { titre: 'Les planches non servies', rang: 'étape 3 sur 4', ancre: 'planning-non-servies', chemin: '/irrigation/semaine' },
    { titre: 'Les heures où l’on n’arrose pas', rang: 'étape 4 sur 4', ancre: 'planning-creneaux', chemin: '/irrigation/semaine' },
  ]);
});
