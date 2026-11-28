import { expect, test } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import {
  attendreLaPagePrete,
  ouvrirLeDetailDuJour,
  ouvrirLePli,
  surveillerLaConsole,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P74 : ignorer l'irrigation hors saison, les écrans (6 quaterdecies,
 * B3, docs/objectif-automatique-saison-contract.md, sections 4.3 à 4.5 et 6 ;
 * D-337, D-353 ; docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, toutes cases cochées, sa commune choisie et ses
 * jardins classés, un objectif de ferme saisi : le bloc « Hors saison » du
 * pli « Objectifs de la semaine » ne montre aucun endroit. « Mettre hors
 * saison » ouvre le choix des portées, « Tout le plein champ » en tête ; le
 * geste dit ce qu'il fait, la puce « Tout le plein champ · depuis le … »
 * paraît avec « Reprendre ». Le tableau des besoins garde les jardins de
 * plein champ, dits « hors saison », leurs planches grisées avec la phrase
 * « La pluie reste suivie. » ; l'abri garde son besoin. « Aujourd'hui » dit
 * les planches hors saison sur la tuile de l'objectif, et le lien mène au
 * bloc, ouvert. Un second geste sans effet le dit ; « Reprendre » rend la
 * ferme d'avant. Au téléphone (390 px), rien ne déborde et les boutons se
 * touchent au pouce ; à l'ordinateur, à 1 440 px.
 *
 * Ce qu'il ne prouve pas : la fenêtre « Les annuler » / « Les garder », que
 * cette ferme neuve, sans arrosage planifié, n'ouvre pas ; ses mots et sa
 * liste sont prouvés par tests/hors-saison-ecrans.test.ts, la liste par
 * tests/db/hors-saison-stockage.test.ts (B2).
 */

const DUREE_DU_PARCOURS = 240_000;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;

test('« Hors saison » : mettre tout le plein champ hors saison, le lire partout, reprendre', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'hors-saison');
  await preparerLaFermeNeuve(page);

  // Un objectif de ferme saisi, pour que chaque planche ait un besoin ; le bloc, vide.
  await page.goto('/irrigation/besoins');
  await attendreLaPagePrete(page, 'besoins');
  const volet = await ouvrirLePli(page.locator('#objectifs-de-la-semaine'));
  await volet.getByLabel('mm / semaine').fill('20');
  await volet.getByRole('button', { name: 'Enregistrer' }).first().click();
  await expect(volet.locator('.goal-chip-list')).toContainText('20 mm', { timeout: 15_000 });
  const bloc = volet.locator('#hors-saison');
  await expect(bloc.getByRole('heading', { name: 'Hors saison' })).toBeVisible();
  await expect(bloc).toContainText('Aucun endroit hors saison : toute la ferme suit son objectif.');
  if (telephone) await verifierCibleTactile(bloc.getByRole('button', { name: 'Mettre hors saison' }), 'Le bouton « Mettre hors saison »');
  // L'aide du bloc : ce qui continue.
  await bloc.getByRole('button', { name: 'Aide : Hors saison' }).click();
  await expect(bloc.getByRole('region', { name: 'Aide : Hors saison' })).toContainText('La pluie tombée dehors reste enregistrée et suivie');
  await bloc.getByRole('region', { name: 'Aide : Hors saison' }).getByRole('button', { name: 'Fermer' }).click();
  await verifierLEtape(page, journal, 'le bloc vide');

  // « Mettre hors saison » : le choix des portées, « Tout le plein champ » en tête.
  await bloc.getByRole('button', { name: 'Mettre hors saison' }).click();
  const choix = page.locator('dialog.off-season-choice[open]');
  await expect(choix.getByRole('heading', { name: 'Mettre hors saison' })).toBeVisible();
  const perimetre = choix.getByRole('combobox', { name: 'Périmètre' });
  await expect(perimetre).toHaveValue('mode:garden');
  await expect(perimetre.locator('option').first()).toHaveText('Tout le plein champ');
  await expect(perimetre.locator('option', { hasText: 'Toute la ferme' })).toHaveCount(0);
  await expect(choix).toContainText('La pluie, la météo et les alertes restent suivies.');
  await verifierLEtape(page, journal, 'le choix des portées');
  await choix.getByRole('button', { name: 'Mettre hors saison' }).click();
  await expect(choix).toHaveCount(0);
  await expect(bloc).toContainText(/Tout le plein champ est hors saison à partir d’aujourd’hui \(\d+ planches?\)/, { timeout: 15_000 });
  const puce = bloc.locator('.off-season-chip').filter({ hasText: 'Tout le plein champ' });
  await expect(puce).toContainText(/Tout le plein champ · depuis le \d+ /);
  if (telephone) await verifierCibleTactile(puce.getByRole('button', { name: 'Reprendre' }), 'Le bouton « Reprendre »');
  await verifierLEtape(page, journal, 'tout le plein champ hors saison');

  // Le tableau des besoins se relit : un jardin de plein champ est dit « hors saison », sa planche grisée ; la pluie reste suivie.
  const jardinHorsSaison = page.locator('.irrigation-needs-gardens > details').filter({ hasText: 'hors saison' }).first();
  await expect(jardinHorsSaison).toHaveCount(1, { timeout: 15_000 });
  await ouvrirLePli(jardinHorsSaison);
  const planche = jardinHorsSaison.locator('.irrigation-need-card[data-off-season="true"]').first();
  await expect(planche.locator('.need-off-season')).toHaveText('Hors saison : son irrigation est ignorée, ni besoin ni arrosage proposé. La pluie reste suivie.');
  await expect(planche.locator('.need-primary').first()).toContainText('Hors saison');
  await expect(planche).not.toContainText('sans objectif');
  // Un abri garde son besoin.
  await expect(page.locator('.irrigation-need-card:not([data-off-season])').first()).toBeAttached();
  await verifierLEtape(page, journal, 'le tableau des besoins dit « hors saison »');

  // Un second geste sur la même portée n'écrit rien et le dit.
  await bloc.getByRole('button', { name: 'Mettre hors saison' }).click();
  await choix.getByRole('button', { name: 'Mettre hors saison' }).click();
  await expect(bloc).toContainText('Tout le plein champ était déjà hors saison : rien n’a changé.', { timeout: 15_000 });
  await expect(bloc.locator('.off-season-chip')).toHaveCount(1);

  // « Aujourd'hui » : la tuile de l'objectif compte les planches hors saison et mène au bloc, ouvert.
  await page.goto('/irrigation');
  await attendreLaPagePrete(page, 'aujourdhui');
  await ouvrirLeDetailDuJour(page);
  const tuile = page.getByRole('region', { name: 'Cette semaine' }).locator('a.today-kpi').filter({ hasText: 'Eau visée cette semaine' });
  await expect(tuile).toContainText(/\d+ hors saison/);
  await expect(tuile).toContainText(/\d+ planches? hors saison/);
  await verifierLEtape(page, journal, '« Aujourd’hui » dit les planches hors saison');
  await tuile.click();
  await expect(page).toHaveURL(/#hors-saison$/);
  await attendreLaPagePrete(page, 'besoins');
  const blocOuvert = page.locator('#hors-saison');
  await expect(blocOuvert).toBeVisible({ timeout: 15_000 });
  await expect(blocOuvert.locator('.off-season-chip')).toContainText('Tout le plein champ');

  // « Reprendre » : la ferme d'avant ; le tableau des besoins n'a plus rien de hors saison.
  await blocOuvert.locator('.off-season-chip').getByRole('button', { name: 'Reprendre' }).click();
  await expect(blocOuvert).toContainText('Tout le plein champ reprend : son irrigation est de nouveau calculée à partir d’aujourd’hui.', { timeout: 15_000 });
  await expect(blocOuvert.locator('.off-season-chip')).toHaveCount(0);
  await expect(blocOuvert).toContainText('Aucun endroit hors saison');
  await expect(page.locator('.irrigation-need-card[data-off-season="true"]')).toHaveCount(0, { timeout: 15_000 });
  await verifierLEtape(page, journal, 'repris');
});
