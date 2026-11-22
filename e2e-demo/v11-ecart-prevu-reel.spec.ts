import { expect, test } from '@playwright/test';
import { ciblesTropPetites, textesPeuContrastes } from '../e2e/support/accessibilite.ts';
import { verifierCibleTactile, verifierLEtape } from '../e2e/support/parcours.ts';
import { ecarterLInvitation, ouvrirLaDemo } from './support/visite.ts';

/**
 * Parcours V11 : le cas d'écart prévu/réel du jeu de données (amélioration
 * n° 5, docs/ameliorations-4-5-contract.md, section 4, F747, D-295 ; écart E2
 * de la recette du 22 novembre 2026). La « Ferme des Trois Noues », au début
 * de l'été, a arrosé son clos plus longtemps que prévu les trois semaines
 * d'avant : « Planning de la semaine » porte le bloc « L'eau apportée
 * s'écarte du prévu » pour S01 et S02, les deux planches du clos, chaque
 * semaine à +50 %, la cause du débit, réglé à 6 mm/h, proposé à 4 mm/h, et
 * « Adopter ». Aux deux largeurs. Le parcours regarde sans rien écrire :
 * « Adopter » et la remise à zéro, du bouton comme de la nuit, se prouvent
 * dans tests/db/ecart-prevu-reel-demo.test.ts, le geste à l'écran par P57.
 */

const PLANCHES = ['S01', 'S02'];
const MATERIEL = 'Goutte-à-goutte du clos';
const REGLAGE = 'Réglage habituel';
/** Les trois semaines comparées au mardi 16 juin 2026 : leur lundi, le prévu et l'apporté. */
const SEMAINES = [['25/05', '4 mm', '6 mm'], ['01/06', '8 mm', '12 mm'], ['08/06', '8 mm', '12 mm']];

test('V11 Le jeu de données : l’eau apportée au clos s’écarte du prévu, trois semaines de suite', async ({ page }, testInfo) => {
  const visite = await ouvrirLaDemo(page, 'maraichage', 'ete', '/irrigation/planning');
  await ecarterLInvitation(page);
  const bloc = page.getByTestId('applied-water-gap');
  await expect(bloc).toBeVisible();
  await expect(bloc.getByRole('heading', { name: 'L’eau apportée s’écarte du prévu' })).toBeVisible();
  const planches = bloc.locator('li.water-gap-bed');
  await expect(planches.locator('.water-gap-bed-name')).toHaveText(PLANCHES.map((nom) => `${nom} · Clos des saules`));

  for (const [index, nom] of PLANCHES.entries()) {
    const planche = planches.nth(index);
    await expect(planche.locator('.water-gap-direction')).toHaveText('Plus d’eau apportée que prévu, trois semaines de suite');
    const lignes = planche.locator('table.water-gap-weeks tbody tr');
    await expect(lignes).toHaveCount(SEMAINES.length);
    for (const [rang, [lundi, prevu, apporte]] of SEMAINES.entries()) {
      await expect(lignes.nth(rang).locator('th')).toHaveText(lundi);
      await expect(lignes.nth(rang).locator('td')).toHaveText([prevu, apporte, '+50 %']);
    }
    // Une seule cause, le débit : la démonstration n'a aucune pluie mesurée.
    const causes = planche.locator('.water-gap-cause');
    await expect(causes).toHaveCount(1);
    await expect(causes.locator('.water-gap-cause-title')).toHaveText('Débit réel du matériel plus faible que celui réglé');
    await expect(causes).toContainText(
      `3 irrigations de ${MATERIEL}, prévues puis faites en entier avec le réglage « ${REGLAGE} », ont duré plus longtemps que prévu : 50 % de plus en médiane.`,
    );
    await expect(causes.locator('.water-gap-figures')).toHaveText(['Réglé aujourd’hui : 6 mm/h', 'Proposé : 4 mm/h']);
    const adopter = causes.getByRole('button', { name: `Adopter le débit proposé pour le réglage « ${REGLAGE} » de ${MATERIEL}` });
    await expect(adopter).toBeEnabled();
    if (testInfo.project.name === 'telephone') await verifierCibleTactile(adopter, `Le bouton « Adopter » de ${nom}`);
  }
  expect(await ciblesTropPetites(page, 44, 'section.water-gap'), 'cibles du bloc').toEqual([]);
  expect(await textesPeuContrastes(page, 'section.water-gap'), 'contrastes du bloc').toEqual([]);
  await verifierLEtape(page, visite.journal, 'bloc de l’écart du clos, cause du débit, débit proposé');
  expect(visite.envois, 'la page a écrit à la place du visiteur').toEqual([]);
});
