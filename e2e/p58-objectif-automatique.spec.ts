import { expect, test, type Locator, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import {
  attendreLaPagePrete,
  confirmerDansLaFenetre,
  epinglerLaBulle,
  ouvrirLePli,
  surveillerLaConsole,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P58 : l'objectif automatique sur l'ET0, les écrans (6 decies, O4,
 * docs/objectif-automatique-contract.md, section 5 ; D-319 ;
 * docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, toutes cases cochées, sa commune choisie et ses
 * jardins classés : dans « Objectifs et besoins », le volet « Objectifs
 * hebdomadaires » porte le réglage « Objectif automatique », éteint, et la
 * phrase de ce qu'il fait. Allumé, le résumé du volet le dit, et l'objectif
 * d'une planche du tableau des besoins dit son origine (« Automatique… ») et
 * sa bulle (« Objectif automatique sur … ») ; « Aujourd'hui » dit l'origine
 * sur la tuile « Objectif de la semaine » et suit la ligne « Objectif
 * automatique » de « Fiabilité du calcul ». Un objectif de ferme saisi passe
 * avant : la planche redit « Renseigné », et le volet compte les planches qui
 * gardent un objectif saisi et propose « Vider les objectifs », le geste
 * existant, confirmé en rouge. Éteint le même jour, le geste du second fait
 * foi toute la journée (F773) : l'écran est celui d'avant. Au téléphone
 * (390 px), rien ne déborde de côté et l'interrupteur se touche au pouce ; à
 * l'ordinateur, à 1 440 px.
 *
 * Ce qu'il ne prouve pas : les valeurs de l'objectif automatique, que les
 * tests du domaine et de la persistance chiffrent (tests/objectif-automatique*.test.ts,
 * tests/db/objectif-automatique*.test.ts) ; la météo de démonstration n'a
 * pas de valeur agronomique.
 */

const DUREE_DU_PARCOURS = 240_000;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;

function leReglage(page: Page): Locator {
  return page.locator('#objectifs-de-la-semaine').getByRole('switch', { name: /Objectif automatique/ });
}

/** L'objectif de la première planche du tableau des besoins, son pli et « Voir le calcul » ouverts. */
async function objectifDeLaPremierePlanche(page: Page): Promise<Locator> {
  const jardin = page.locator('.irrigation-needs-gardens > details').first();
  await ouvrirLePli(jardin);
  const calcul = jardin.locator('.irrigation-need-card').first().locator('details.need-calculation');
  await ouvrirLePli(calcul);
  return calcul.locator('[data-kind="objective"]');
}

test('« Objectif automatique » : allumer, lire l’origine, saisir un objectif qui passe avant, éteindre', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'objectif-automatique');
  await preparerLaFermeNeuve(page);

  // Le réglage, éteint au départ, dans le volet des objectifs, avec la phrase de ce qu'il fait.
  await page.goto('/irrigation/besoins');
  await attendreLaPagePrete(page, 'besoins');
  const volet = await ouvrirLePli(page.locator('#objectifs-de-la-semaine'));
  const reglage = leReglage(page);
  await expect(reglage).not.toBeChecked();
  await expect(volet.locator('.automatic-objective-setting')).toContainText('Sans objectif saisi, l’objectif d’une planche suit chaque matin le besoin de sa culture, ou l’ET0 quand ce besoin n’est pas connu.');
  await expect(await objectifDeLaPremierePlanche(page)).toContainText('Renseigné · demande de la semaine');
  if (telephone) await verifierCibleTactile(volet.locator('.automatic-objective-toggle'), 'L’interrupteur « Objectif automatique »');
  await verifierLEtape(page, journal, 'le réglage éteint');

  // Allumé : le message sous le réglage, le résumé du volet, l'origine de l'objectif et sa bulle.
  await reglage.check();
  await expect(volet.locator('.automatic-objective-setting')).toContainText('Objectif automatique allumé : à partir d’aujourd’hui');
  await expect(reglage).toBeChecked();
  await expect(volet.locator(':scope > summary small')).toHaveText(/^Objectif automatique allumé/);
  const objectif = await objectifDeLaPremierePlanche(page);
  await expect(objectif.locator('dt small')).toHaveText(/^Automatique/, { timeout: 15_000 });
  const bulle = objectif.locator('.figure-origin-bubble');
  await epinglerLaBulle(page, objectif.getByRole('button', { name: 'D’où vient cet objectif ?' }), bulle);
  await expect(bulle).toContainText(/Objectif automatique sur \d+ jours? :/);
  await expect(bulle).toContainText('Mis à jour chaque matin avec la météo.');
  await bulle.getByRole('button', { name: 'Fermer' }).click();
  await verifierLEtape(page, journal, 'le réglage allumé, l’origine dite');

  // « Aujourd'hui » : l'origine sur la tuile, la ligne « Objectif automatique » de « Fiabilité du calcul ».
  await page.goto('/irrigation');
  await attendreLaPagePrete(page, 'aujourdhui');
  const tuile = page.getByRole('region', { name: 'Cette semaine' }).locator('a.today-kpi').filter({ hasText: 'Eau visée cette semaine' });
  await expect(tuile).toContainText('objectif automatique');
  await expect(page.locator('#today-reliability .reliability-check').filter({ hasText: 'Objectif automatique' })).toHaveCount(1);
  await verifierLEtape(page, journal, '« Aujourd’hui » dit l’objectif automatique');

  // Un objectif de ferme saisi passe avant : la planche redit « Renseigné », le volet compte les planches qui le gardent.
  await page.goto('/irrigation/besoins');
  await attendreLaPagePrete(page, 'besoins');
  const volet2 = await ouvrirLePli(page.locator('#objectifs-de-la-semaine'));
  await volet2.getByLabel('mm / semaine').fill('20');
  await volet2.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(volet2.locator('.goal-chip-list')).toContainText('20 mm', { timeout: 15_000 });
  const gardees = volet2.locator('.automatic-objective-kept');
  await expect(gardees).toContainText(/^\d+ planches? garden?t? un objectif saisi cette semaine : il passe avant l’objectif automatique\./);
  await expect(await objectifDeLaPremierePlanche(page)).toContainText('Renseigné · demande de la semaine', { timeout: 15_000 });
  await verifierLEtape(page, journal, 'un objectif saisi passe avant');

  // « Vider les objectifs », proposé par le réglage, confirmé en rouge : l'objectif automatique reprend.
  await gardees.getByRole('button', { name: 'Vider les objectifs' }).click();
  await expect(page.locator('dialog.module-confirm-dialog[open]')).toContainText('Vider les objectifs de cette semaine ?');
  await confirmerDansLaFenetre(page, 'Vider les objectifs');
  await expect(volet2.locator('.goal-chip-list')).toContainText('Aucun objectif pour cette semaine.', { timeout: 15_000 });
  await expect(gardees).toHaveCount(0);
  if (telephone) await verifierCibleTactile(volet2.getByRole('button', { name: 'Vider les objectifs' }), 'Le bouton « Vider les objectifs »');
  await verifierLEtape(page, journal, 'les objectifs vidés');

  // Éteint le même jour : le second geste fait foi toute la journée, l'écran est celui d'avant.
  await leReglage(page).uncheck();
  await expect(volet2.locator('.automatic-objective-setting')).toContainText('Objectif automatique éteint : à partir d’aujourd’hui, seuls les objectifs saisis comptent.');
  await expect(leReglage(page)).not.toBeChecked();
  await expect(volet2.locator(':scope > summary small')).toHaveText('Aucun objectif pour cette semaine.');
  await expect(await objectifDeLaPremierePlanche(page)).toContainText('Renseigné · demande de la semaine', { timeout: 15_000 });
  await verifierLEtape(page, journal, 'le réglage éteint de nouveau');

  // Rechargée, la page relit le réglage éteint.
  await page.reload();
  await attendreLaPagePrete(page, 'besoins');
  await ouvrirLePli(page.locator('#objectifs-de-la-semaine'));
  await expect(leReglage(page)).not.toBeChecked();
  await verifierLEtape(page, journal, 'rechargée, le réglage éteint');
});
