import { expect, test } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, ouvrirLeDetailDuJour, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P73 : « Soif du jour, heure par heure » dans « Le détail »
 * d'« Aujourd'hui » (ET0 horaire, PR HR3 ; docs/et0-horaire-contract.md,
 * § 4.4, § 4.5 et § 7 ; D-350 ; docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, toutes cases cochées, sa commune choisie (le siège,
 * Rennes pour la météo des parcours) : « Le détail » ouvert, le bloc vient
 * en tête du pli, sa ligne de résumé dit « la soif heure par heure » ; la
 * phrase du reste à venir dit la forme théorique du soleil (la météo des
 * parcours ne donne pas les heures, et la lecture du matin n'a pas tourné),
 * une barre par heure du jour, l'heure en cours marquée et nommée sous la
 * courbe, la plage de forte évaporation ; le « ? » dit d'où vient la forme
 * et que la courbe ne change ni le besoin ni l'objectif, et se referme à
 * Échap. Au téléphone (320 px) et à l'ordinateur (1 440 px), sans
 * débordement.
 *
 * Ce qu'il ne prouve pas : la forme du fournisseur ou calculée à l'heure,
 * écrite par la lecture du matin, ni la forme d'une autre source refusée,
 * tenues par tests/db/day-shapes.test.ts et tests/hourly-et0-ecran.test.ts ;
 * l'état « Pas de courbe : l'ET0 du jour manque » et la forme dite
 * « ancienne », tenus par tests/hourly-et0-ecran.test.ts.
 */

const LARGEUR_TELEPHONE_PX = 320;
const HAUTEUR_TELEPHONE_PX = 844;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;
const HEURES_D_UN_JOUR = [23, 24, 25];

test('« Soif du jour, heure par heure » : la phrase, la courbe, la forte évaporation et le « ? », dans « Le détail »', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await page.setViewportSize(telephone
    ? { width: LARGEUR_TELEPHONE_PX, height: HAUTEUR_TELEPHONE_PX }
    : { width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'soif-du-jour');
  await preparerLaFermeNeuve(page);

  await attendreLaPageIrrigation(page, 'aujourdhui');
  const pli = page.locator('details#today-detail');
  await expect(pli.locator(':scope > summary .today-detail-count')).toContainText('la soif heure par heure');
  const bloc = pli.locator('#today-day-curve');
  await expect(bloc).toBeHidden();
  await ouvrirLeDetailDuJour(page);
  await expect(bloc).toBeVisible();
  await expect(pli.locator('.today-detail-body > :first-child')).toHaveAttribute('id', 'today-day-curve');
  await expect(bloc.getByRole('heading', { level: 2 })).toHaveText('Soif du jour, heure par heure');
  await verifierLEtape(page, journal, 'le bloc en tête du détail');

  // La météo des parcours ne donne pas les heures : la forme théorique du soleil, dite dans la phrase.
  await expect(bloc).toHaveAttribute('data-state', 'shown');
  await expect(bloc).toHaveAttribute('data-nature', 'theoretical');
  await expect(bloc.locator('.today-day-curve-sentence')).toHaveText(
    /^(D’ici ce soir, il reste environ [\d,]+ mm à consommer sur [\d,]+ mm|La soif du jour est passée : [\d,]+ mm aujourd’hui), d’après la forme théorique du soleil\.$/,
  );
  const barres = bloc.locator('.today-day-curve-bar');
  expect(HEURES_D_UN_JOUR).toContain(await barres.count());
  await expect(bloc.locator('.today-day-curve-bar[data-current]')).toHaveCount(1);
  const heure = await bloc.locator('.today-day-curve-bar[data-current]').getAttribute('title');
  expect(heure).toMatch(/^\d+ h : [\d,]+\s% de la journée, environ [\d,]+ mm$/);
  await expect(bloc.locator('.today-day-curve-legend [data-key="current"]')).toHaveText(`Maintenant, ${heure!.split(' : ')[0]}`);
  await expect(bloc.getByRole('img')).toHaveAttribute('aria-label', /^Courbe de la journée, forme théorique du soleil ; /);
  await expect(bloc.locator('.today-day-curve-strongest')).toHaveText(/^Évaporation la plus forte entre \d+ h et \d+ h$/);
  expect(await bloc.locator('.today-day-curve-bar[data-strong]').count()).toBeGreaterThan(0);
  await verifierLEtape(page, journal, 'la phrase et la courbe');

  // Le « ? » : d'où vient la forme, et ce que la courbe n'est pas ; il se referme à Échap, le focus rendu.
  const aide = bloc.getByRole('button', { name: 'Aide : Soif du jour, heure par heure' });
  await aide.click();
  const panneau = bloc.getByRole('region', { name: 'Aide : Soif du jour, heure par heure' });
  await expect(panneau).toBeVisible();
  await expect(panneau).toContainText('D’où vient la courbe : forme théorique du soleil');
  await expect(panneau).toContainText('Elle ne change pas le besoin de vos planches ni l’objectif ; elle montre à quelle heure la journée consomme.');
  await expect(panneau).toContainText('jamais une interdiction');
  await verifierLEtape(page, journal, 'le « ? » ouvert');
  await page.keyboard.press('Escape');
  await expect(panneau).toBeHidden();
  await expect(aide).toBeFocused();
  await verifierLEtape(page, journal, 'le « ? » refermé');
});
