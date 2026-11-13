import { test } from '@playwright/test';
import { commencerLaVisite, ecarterLInvitation, jouerLaVisite, ouvrirLaDemo } from './support/visite.ts';

/** Parcours V3 : la visite « Le planning » (contrat, section 7, visite 3 ; D3), en début d'été. */
test('V3 Le planning : la semaine, les propositions, les planches non servies, les créneaux protégés', async ({ page }) => {
  const visite = await ouvrirLaDemo(page, 'maraichage', 'ete');
  await ecarterLInvitation(page);
  await commencerLaVisite(page, 'Le planning');
  await jouerLaVisite(page, visite, [
    { titre: 'La semaine en un coup d’œil', rang: 'étape 1 sur 4', ancre: 'planning-semaine', chemin: '/irrigation/planning' },
    { titre: 'Des propositions, pas des ordres', rang: 'étape 2 sur 4', ancre: 'planning-propositions', chemin: '/irrigation/planning' },
    { titre: 'Les planches non servies', rang: 'étape 3 sur 4', ancre: 'planning-non-servies', chemin: '/irrigation/planning' },
    { titre: 'Les créneaux protégés', rang: 'étape 4 sur 4', ancre: 'planning-creneaux', chemin: '/irrigation/planning' },
  ]);
});
