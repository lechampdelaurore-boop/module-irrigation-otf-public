import { expect, test, type Locator, type Page } from '@playwright/test';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '../lib/domain/water-management.ts';
import { ciblesTropPetites, textesPeuContrastes } from './support/accessibilite.ts';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant, saisirEnMillimetres, soumettreIrrigation } from './support/materiel.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  ouvrirLOnglet,
  ouvrirLePli,
  surveillerLaConsole,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';

/**
 * Parcours P57 : l'eau apportée qui s'écarte du prévu, sa cause et son
 * ajustement (amélioration n° 5, docs/ameliorations-4-5-contract.md,
 * section 4, précisions F733 à F735 et F740 à F743 ;
 * docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, toutes cases cochées, un goutte-à-goutte réglé à
 * 60 mm/h sur N01 : chacune des trois semaines passées, une irrigation de
 * 0,1 mm prévue à 10 h, soit 6 secondes. Le parcours la démarre depuis « À
 * traiter » et ne l'arrête qu'une fois le volume en cours à 4 L, au lieu des
 * 2,25 L prévus : l'irrigation a duré la moitié de plus au moins, comme
 * quand le débit réel est plus faible que celui réglé. Le volume en cours
 * est la condition attendue, jamais une durée. « Planning de la semaine »
 * montre alors le bloc « L'eau apportée s'écarte du prévu » : N01, plus
 * d'eau apportée que prévu, les trois semaines, la cause du débit, le débit
 * réglé et le débit proposé. « Adopter » l'enregistre dans le réglage : le
 * message le dit, le bloc disparaît et ne revient pas au rechargement, et
 * le plan de « Matériel et placement » donne à N01 le débit adopté. Le bloc
 * est dans « Le détail » de la page « Semaine », lu à l'ouverture de sa
 * section (simplification, lot S4, PR 2, 3.4, F918) : rien n'est lu avant ;
 * au rechargement, la section dit qu'aucune planche ne s'écarte. Au
 * téléphone (390 px) et à l'ordinateur, à 1 440 px de large.
 *
 * Ce qu'il ne prouve pas : le seuil de 20 %, les semaines sans prévu, la
 * minuterie oubliée une fois, les causes de l'objectif et de la pluie, la
 * planche sous abri, « Cause non déterminée » (tests/ecart-prevu-reel.test.ts),
 * la proposition défaite avant « Adopter », le plan recalculé, l'objectif
 * adopté (tests/db/ecart-prevu-reel.test.ts), la ferme réelle.
 */

const DUREE_DU_PARCOURS = 300_000;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;
const PLANCHE = 'N01';
const DEBIT_REGLE_MM_PAR_HEURE = 60;
/** 0,1 mm à 60 mm/h : 6 secondes, 2,25 L sur les 22,5 m² de N01. */
const QUANTITE_PREVUE_MM = '0.1';
/**
 * « 4 L » s'affiche à 10 secondes de minuteur (3,75 L) ; l'heure de fin
 * proposée, à la seconde, en garde au moins 9 : la moitié de plus que prévu.
 */
const VOLUME_EN_COURS_ATTENDU = /^(?:[4-9]|\d{2,}) L$/;
const SEMAINES_JUGEES = 3;
const JOURS_PAR_SEMAINE = 7;
/** Le parcours dure quelques minutes : au-delà de minuit, un dimanche, les semaines jugées changeraient. */
const MARGE_AVANT_LUNDI_MINUTES = 20;

test('trois semaines d’irrigations plus longues que prévu : le bloc, la cause du débit, « Adopter », le réglage changé', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  const aujourdhui = dateKeyInTimeZone(new Date(reference), FARM_TIME_ZONE);
  const lundi = weekStartDateKey(aujourdhui);
  test.skip(
    weekStartDateKey(horodatageLocal(MARGE_AVANT_LUNDI_MINUTES, reference).slice(0, 10)) !== lundi,
    'trop près du lundi : les semaines jugées changeraient pendant le parcours',
  );
  test.skip(
    addDaysToDateKey(aujourdhui, -SEMAINES_JUGEES * JOURS_PAR_SEMAINE) < `${aujourdhui.slice(0, 4)}-01-01`,
    'début janvier : les trois semaines jugées tombent dans la saison d’avant',
  );
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'ecart-prevu');
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'materiel');
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo, { planche: PLANCHE, apportMmParHeure: DEBIT_REGLE_MM_PAR_HEURE });
  await verifierLEtape(page, journal, `goutte-à-goutte à ${DEBIT_REGLE_MM_PAR_HEURE} mm/h posé sur ${PLANCHE}`);

  // Une irrigation prévue chacune des trois semaines passées, le même jour de la semaine qu'aujourd'hui, à 10 h.
  await attendreLaPageIrrigation(page, 'arrosages');
  for (let semaine = SEMAINES_JUGEES; semaine >= 1; semaine -= 1) {
    await page.getByRole('tab', { name: /^Planifier/ }).click();
    await choisirMaterielEtReglage(page, materiel, reglage, QUANTITE_PREVUE_MM);
    // Une dose du jour proposée par le planning remplirait la quantité : le parcours tape la sienne.
    await saisirEnMillimetres(page, QUANTITE_PREVUE_MM);
    await page.getByLabel('Date et heure de début').fill(`${addDaysToDateKey(aujourdhui, -JOURS_PAR_SEMAINE * semaine)}T10:00`);
    await soumettreIrrigation(page, /^Planifier l’arrosage de /, `il y a ${semaine} semaine${semaine > 1 ? 's' : ''}`);
  }
  const aTraiter = page.locator('.upcoming-irrigations section.irrigation-to-handle');
  await expect(aTraiter.locator('article').filter({ hasText: materiel })).toHaveCount(SEMAINES_JUGEES);
  await verifierLEtape(page, journal, 'trois irrigations prévues, « À traiter »');

  // Chacune démarrée maintenant, arrêtée au volume en cours de 4 L : plus longue que prévu.
  for (let fois = 1; fois <= SEMAINES_JUGEES; fois += 1) {
    await irriguerPlusLongtempsQuePrevu(page, aTraiter, materiel);
  }
  await expect(aTraiter.locator('article').filter({ hasText: materiel })).toHaveCount(0);
  await verifierLEtape(page, journal, 'trois irrigations faites, plus longues que prévu');

  // Le bloc, après les suggestions du planning : N01, les trois semaines, la cause du débit.
  await attendreLaPageIrrigation(page, 'planning');
  // Dans « Écart du prévu des trois dernières semaines », au détail de la page « Semaine », lu à l'ouverture du pli (S4, PR 2, 3.4, F918).
  const section = page.locator('details#ecart-du-prevu');
  await expect(section.locator(':scope > summary small')).toHaveText('Les planches arrosées plus ou moins que prévu, trois semaines de suite');
  const bloc = page.getByTestId('applied-water-gap');
  await expect(bloc, 'rien n’est lu avant l’ouverture du pli').toHaveCount(0);
  await ouvrirLePli(section);
  await expect(bloc).toBeVisible({ timeout: 30_000 });
  await expect(section.locator(':scope > summary small')).toHaveText('1 planche s’écarte du prévu');
  await expect(bloc.getByRole('heading', { name: 'L’eau apportée s’écarte du prévu' })).toBeVisible();
  const planche = bloc.locator('li.water-gap-bed').filter({ has: page.locator('.water-gap-bed-name strong', { hasText: new RegExp(`^${PLANCHE}$`) }) });
  await expect(planche).toHaveCount(1);
  await expect(planche.locator('.water-gap-direction')).toHaveText('Plus d’eau apportée que prévu, trois semaines de suite');
  const semaines = planche.locator('table.water-gap-weeks tbody tr');
  await expect(semaines).toHaveCount(SEMAINES_JUGEES);
  for (let index = 0; index < SEMAINES_JUGEES; index += 1) {
    const ligne = semaines.nth(index);
    await expect(ligne.locator('th')).toHaveText(jourEtMois(addDaysToDateKey(lundi, -JOURS_PAR_SEMAINE * (SEMAINES_JUGEES - index))));
    await expect(ligne.locator('td').nth(0)).toHaveText('0,1 mm');
    await expect(ligne.locator('td').nth(2)).toHaveText(/^\+\d+ %$/);
  }
  const cause = planche.locator('.water-gap-cause').filter({ hasText: 'Débit réel du matériel plus faible que celui réglé' });
  await expect(cause).toContainText(
    `${SEMAINES_JUGEES} irrigations de ${materiel}, prévues puis faites en entier avec le réglage « ${reglage} », ont duré plus longtemps que prévu`,
  );
  await expect(cause.locator('.water-gap-figures').first()).toHaveText(`Réglé aujourd’hui : ${DEBIT_REGLE_MM_PAR_HEURE} mm/h`);
  const propose = await cause.locator('.water-gap-figures').filter({ hasText: /^Proposé : / }).innerText();
  const debitPropose = /^Proposé : (\d+(?:,\d)?) mm\/h$/.exec(propose)?.[1];
  expect(debitPropose, `débit proposé lisible : « ${propose} »`).toBeDefined();
  // La moitié de plus au moins : le débit proposé est au plus les deux tiers du débit réglé.
  expect(Number(debitPropose!.replace(',', '.'))).toBeLessThanOrEqual(DEBIT_REGLE_MM_PAR_HEURE * 2 / 3);
  const adopter = cause.getByRole('button', { name: `Adopter le débit proposé pour le réglage « ${reglage} » de ${materiel}` });
  await expect(adopter).toBeEnabled();
  if (telephone) await verifierCibleTactile(adopter, 'Le bouton « Adopter »');
  expect(await ciblesTropPetites(page, 44, 'section.water-gap'), 'cibles du bloc').toEqual([]);
  expect(await textesPeuContrastes(page, 'section.water-gap'), 'contrastes du bloc').toEqual([]);
  await verifierLEtape(page, journal, 'bloc de l’écart, cause du débit, débit proposé');

  // « Adopter » : le réglage prend le débit proposé, le bloc disparaît.
  await adopter.click();
  await expect(page.locator('p.planning-notice').filter({ hasText: `Le réglage « ${reglage} » de ${materiel} est enregistré : ${debitPropose} mm/h.` })).toBeVisible({ timeout: 30_000 });
  await expect(bloc).toHaveCount(0);
  await verifierLEtape(page, journal, 'débit adopté, bloc disparu');
  await page.reload();
  await attendreLaPagePrete(page, 'planning');
  await ouvrirLePli(page.locator('details#ecart-du-prevu'));
  await expect(page.locator('details#ecart-du-prevu .week-detail-empty')).toHaveText('Aucune planche ne s’écarte du prévu sur les trois dernières semaines.', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'L’eau apportée s’écarte du prévu' })).toHaveCount(0);
  await verifierLEtape(page, journal, 'bloc absent au rechargement');

  // Le plan de « Matériel et placement » donne à N01 le débit adopté, sous le même réglage.
  await attendreLaPageIrrigation(page, 'materiel');
  await ouvrirLOnglet(page, 'Plan');
  await expect(page.getByRole('button', { name: new RegExp(`^Planche ${PLANCHE},`) })).toHaveAttribute(
    'title',
    new RegExp(`${echapper(materiel)} \\(${echapper(reglage)}\\) : ${debitPropose} mm/h`),
  );
  await verifierLEtape(page, journal, 'réglage changé sur le plan');
});

/**
 * La plus ancienne irrigation « À traiter » démarrée maintenant, arrêtée une
 * fois le volume en cours à 4 L : le minuteur avance de lui-même, le volume
 * affiché est la condition que le parcours attend.
 */
async function irriguerPlusLongtempsQuePrevu(page: Page, aTraiter: Locator, materiel: string): Promise<void> {
  const ligne = aTraiter.locator('article').filter({ hasText: materiel }).first();
  await ligne.getByRole('button', { name: 'Démarrer maintenant' }).click();
  const carte = page.getByLabel('Irrigations en cours').locator('article').filter({ hasText: materiel });
  await expect(carte).toHaveCount(1);
  const volume = carte.locator('.active-timer-details > div').filter({ has: page.locator('dt', { hasText: 'Volume en cours' }) }).locator('dd');
  await expect(volume).toHaveText(VOLUME_EN_COURS_ATTENDU, { timeout: 30_000 });
  await carte.getByRole('button', { name: 'Terminer l’irrigation' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Terminer l’irrigation' });
  await expect(fenetre).toContainText(materiel);
  // L'heure réelle proposée, celle de l'ouverture à la seconde, est laissée telle quelle.
  await fenetre.getByRole('button', { name: 'Terminer l’irrigation' }).click();
  await expect(fenetre).toBeHidden();
  await expect(carte).toHaveCount(0);
}

/** « 02/11 » : le lundi d'une semaine, comme l'écrit le tableau du bloc. */
function jourEtMois(jour: string): string {
  return `${jour.slice(8, 10)}/${jour.slice(5, 7)}`;
}

function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
