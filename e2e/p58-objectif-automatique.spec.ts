import { expect, test, type Locator, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import {
  attendreLaPagePrete,
  confirmerDansLaFenetre,
  epinglerLaBulle,
  ouvrirLeDetailDuJour,
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
 * Repris pour l'objectif automatique qui se voit et se modifie (6 quaterdecies,
 * A1, docs/objectif-automatique-saison-contract.md, section 3 ; D-337) :
 * allumé, la phrase de résultat sous l'interrupteur, une ligne
 * « automatique » par jardin dans la liste, le champ « mm / semaine » qui
 * montre la valeur en vigueur, « Corriger » qui choisit le jardin ; l'objectif
 * de ferme saisi lu « saisi » avec « Revenir à l'automatique » ; allumer avec
 * un objectif saisi ouvre la fenêtre (« Annuler », « Allumer, garder mes
 * objectifs », « Allumer et vider les objectifs », en rouge).
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

  // A1 : la phrase de résultat, une ligne « automatique » par jardin, le champ qui montre la valeur en vigueur.
  await expect(volet.locator('.automatic-objective-result')).toHaveText(/^Cette semaine : /, { timeout: 15_000 });
  const ligneAutomatique = volet.locator('.goal-chip-list .goal-chip-automatic').first();
  await expect(ligneAutomatique).toContainText('automatique', { timeout: 15_000 });
  await expect(volet.locator('.goal-chip-list')).not.toContainText('Aucun objectif pour cette semaine.');
  await expect(volet.getByLabel('mm / semaine')).toHaveValue(/^\d+(,\d)?$/);
  await expect(volet.locator('.goal-amount-origin')).toHaveText(/^Valeur en vigueur : automatique/);
  // « Corriger » choisit le jardin d'une ligne chiffrée : le champ montre sa valeur, automatique.
  const ligneChiffree = volet.locator('.goal-chip-list .goal-chip-automatic').filter({ hasText: /\d mm/ }).first();
  await ligneChiffree.getByRole('button', { name: 'Corriger' }).click();
  await expect(volet.getByLabel('mm / semaine')).toBeFocused();
  await expect(volet.getByLabel('mm / semaine')).toHaveValue(/^\d+(,\d)?$/);
  await expect(volet.locator('.goal-amount-origin')).toHaveText(/^Valeur en vigueur : automatique/);
  // Laissé tel quel, « Enregistrer » n'écrit rien et le dit.
  await volet.getByRole('button', { name: 'Enregistrer' }).first().click();
  await expect(volet).toContainText('Valeur inchangée : rien n’est enregistré.');
  if (telephone) await verifierCibleTactile(ligneAutomatique.getByRole('button', { name: 'Corriger' }), 'Le bouton « Corriger »');
  await verifierLEtape(page, journal, 'l’objectif automatique se lit dans le volet');

  // « Aujourd'hui » : l'origine sur la tuile, la ligne « Objectif automatique » de « Fiabilité du calcul ».
  await page.goto('/irrigation');
  await attendreLaPagePrete(page, 'aujourdhui');
  // Les tuiles et la fiabilité sont dans « Le détail » depuis S2, PR 5 (D-330).
  await ouvrirLeDetailDuJour(page);
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

  // A1 : l'objectif de ferme saisi est dit « saisi » ; « Revenir à l'automatique » le retire, lui seul.
  const ligneSaisie = volet2.locator('.goal-chip-list > span').filter({ hasText: 'Toute la ferme' });
  await expect(ligneSaisie).toContainText('saisi');
  if (telephone) await verifierCibleTactile(ligneSaisie.getByRole('button', { name: 'Revenir à l’automatique' }), 'Le bouton « Revenir à l’automatique »');
  await ligneSaisie.getByRole('button', { name: 'Revenir à l’automatique' }).click();
  await expect(volet2).toContainText('Cet endroit revient à l’objectif automatique.', { timeout: 15_000 });
  await expect(ligneSaisie).toHaveCount(0);
  await expect(gardees).toHaveCount(0);
  await expect((await objectifDeLaPremierePlanche(page)).locator('dt small')).toHaveText(/^Automatique/, { timeout: 15_000 });
  await verifierLEtape(page, journal, 'revenu à l’automatique');

  // A1 : allumer avec un objectif saisi ouvre d'abord la fenêtre. Éteint, un objectif de ferme saisi, puis allumer.
  await leReglage(page).uncheck();
  await expect(leReglage(page)).not.toBeChecked();
  await volet2.getByLabel('mm / semaine').fill('20');
  await volet2.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(volet2.locator('.goal-chip-list')).toContainText('20 mm', { timeout: 15_000 });
  const fenetre = page.locator('dialog.automatic-objective-enable[open]');
  await leReglage(page).click();
  await expect(fenetre).toContainText(/^Allumer l’objectif automatique \?\d+ planches? (a|ont) un objectif saisi, qui passe avant l’objectif automatique\./);
  // « Annuler » : rien ne change.
  await fenetre.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(fenetre).toHaveCount(0);
  await expect(leReglage(page)).not.toBeChecked();
  // « Allumer, garder mes objectifs » : allumé, l'objectif saisi passe avant.
  await leReglage(page).click();
  await expect(fenetre.getByRole('button', { name: 'Allumer, garder mes objectifs' })).toBeFocused();
  await verifierLEtape(page, journal, 'la fenêtre d’allumage');
  await fenetre.getByRole('button', { name: 'Allumer, garder mes objectifs' }).click();
  await expect(fenetre).toHaveCount(0);
  await expect(leReglage(page)).toBeChecked({ timeout: 15_000 });
  await expect(gardees).toContainText(/^\d+ planches? garden?t? un objectif saisi cette semaine/, { timeout: 15_000 });
  await expect(volet2.locator('.automatic-objective-result')).toHaveText(/ ; \d+ planches? garden?t? un objectif saisi\.$/, { timeout: 15_000 });
  await verifierLEtape(page, journal, 'allumé en gardant l’objectif saisi');

  // « Vider les objectifs », proposé par le réglage, confirmé en rouge : l'objectif automatique reprend.
  await gardees.getByRole('button', { name: 'Vider les objectifs' }).click();
  await expect(page.locator('dialog.module-confirm-dialog[open]')).toContainText('Vider les objectifs de cette semaine ?');
  await confirmerDansLaFenetre(page, 'Vider les objectifs');
  // Allumé, la liste garde les lignes « automatique » ; plus aucun objectif saisi (A1).
  await expect(volet2.locator('.goal-chip-list > span:not(.goal-chip-automatic)')).toHaveCount(0, { timeout: 15_000 });
  await expect(gardees).toHaveCount(0);
  if (telephone) await verifierCibleTactile(volet2.getByRole('button', { name: 'Vider les objectifs' }), 'Le bouton « Vider les objectifs »');
  await verifierLEtape(page, journal, 'les objectifs vidés');

  // A1 : « Allumer et vider les objectifs », en rouge dans la fenêtre : allumé, plus d'objectif saisi.
  await leReglage(page).uncheck();
  await expect(leReglage(page)).not.toBeChecked();
  await volet2.getByLabel('mm / semaine').fill('20');
  await volet2.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(volet2.locator('.goal-chip-list')).toContainText('20 mm', { timeout: 15_000 });
  await leReglage(page).click();
  await expect(fenetre).toHaveCount(1);
  await confirmerDansLaFenetre(page, 'Allumer et vider les objectifs');
  await expect(leReglage(page)).toBeChecked({ timeout: 15_000 });
  await expect(volet2.locator('.automatic-objective-setting')).toContainText(/Objectif automatique allumé : .* objectifs? retirés? de cette semaine\./, { timeout: 15_000 });
  await expect(volet2.locator('.goal-chip-list > span:not(.goal-chip-automatic)')).toHaveCount(0);
  await expect(gardees).toHaveCount(0);
  await verifierLEtape(page, journal, 'allumé en vidant les objectifs');

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
