import { expect, test, type Locator, type Page } from '@playwright/test';
import { preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';
import { annulerLesIrrigationsDuPlanning, carteNommee, lignesNonPlacees, montrerLaCarte, poserUnObjectifDeFerme, reglerLaPlageDuGoutteAGoutte, retirerLesObjectifs } from './support/planning.ts';

/**
 * Parcours P10 : planifier la semaine (docs/browser-journeys-contract.md,
 * docs/planning-contract.md « Interface (3.6) »).
 *
 * C'est l'écran où un clic engage de l'eau pour les jours à venir. Le parcours
 * prend la part mesurable : un objectif posé, la plage horaire réglée, le plan
 * calculé, une proposition lue avec sa justification, ajustée puis validée
 * jusque dans les irrigations à venir, un jour validé d'un bouton, une
 * proposition refusée puis relue datée de son calcul après un recalcul, la
 * liste « Non placé » avec son motif, et la remise en état. Sur ordinateur,
 * la semaine est aussi lue en tableau à 1 440 px de large (précision P46). Ce qu'il ne
 * prouve pas : la lecture agronomique d'un vrai plan sur la
 * ferme, qui reste la recette réelle du moteur.
 *
 * Le matériel est posé sous abri : la pluie prévue de la météo de
 * démonstration n'y compte pas, et le besoin ne dépend que de l'objectif.
 * Chaque largeur prend son propre tunnel, pour que la seconde ne retombe pas
 * sur les propositions de la première. La plage du goutte-à-goutte est ouverte
 * toute la journée pendant le parcours, pour qu'un créneau tienne aujourd'hui
 * quelle que soit l'heure ; elle est rendue à la fin. À moins d'une heure de sa
 * fin, le créneau du jour est raccourci à la plage : le parcours lit la première
 * carte à la dose entière, ou la carte raccourcie quand le calendrier n'en offre
 * pas d'autre. Le nombre de propositions dépend des jours qui restent dans la
 * semaine — une seule un dimanche — et les gestes qui demandent une deuxième ou
 * une troisième proposition ne sont joués que si le calendrier les offre. Les
 * irrigations validées sont annulées à la fin ; elles restent dans
 * l’historique, annulées (D-006) : un parcours suivant ne les prend pas pour
 * les siennes.
 */

/** Objectif de ferme assez grand pour qu'une dose entière tienne même le dernier jour de la semaine. */
const OBJECTIF_MM = '70';
const PLAGE_OUVERTE = { debut: '00:00', fin: '23:59' };
const PLAGE_DE_DEPART = { debut: '06:00', fin: '22:00' };

test('le planning propose, explique, se valide, s’ajuste et se refuse depuis l’écran, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page);

  const planche = testInfo.project.name === 'telephone' ? 'T02' : 'T01';
  const { materiel } = await preparerMaterielArrosant(page, testInfo, { planche });
  await verifierLEtape(page, journal, 'matériel posé sous abri');

  // L'objectif vaut dès lundi : posé sur cette semaine et sur la précédente (e2e/support/planning.ts).
  // Il se pose sur la page des besoins ; le planning a la sienne (3.8).
  await attendreLaPageIrrigation(page, 'besoins');
  await poserUnObjectifDeFerme(page, OBJECTIF_MM);
  await verifierLEtape(page, journal, 'objectif posé');
  await attendreLaPageIrrigation(page, 'planning');

  const planning = page.locator('section.planning-section');
  await planning.scrollIntoViewIfNeeded();
  await reglerLaPlageDuGoutteAGoutte(planning, PLAGE_OUVERTE);
  await verifierLEtape(page, journal, 'réglages enregistrés');

  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  const meta = planning.locator('.planning-meta');
  await expect(meta).toContainText('calculé le', { timeout: 30_000 });
  // Les dates à la française, le déclencheur nommé.
  await expect(meta).toHaveText(/^Semaine du \d{2}\/\d{2} au \d{2}\/\d{2} · calculé le \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} \(à la demande\)/);
  const cartes = planning.locator('article.planning-proposal').filter({ hasText: materiel });
  await expect(cartes.first()).toBeVisible();
  // À moins d'une heure de la fin de la plage — de 23 h 00 à 23 h 41 —, le
  // créneau du jour est raccourci à ce qui tient dans la plage : la carte lue
  // est la première à la dose entière. Un dimanche à cette heure n'en offre
  // aucune ; la carte raccourcie est lue à sa place, son motif vérifié, sa
  // dose non (docs/browser-journeys-contract.md, « l'heure où il tourne »).
  const entieres = cartes.filter({ has: page.locator('.planning-measure').filter({ hasText: 'Dose' }).getByText('10 mm', { exact: true }) });
  const doseEntiere = (await entieres.count()) > 0;
  const premiere = doseEntiere ? entieres.first() : cartes.first();
  await expect(premiere.locator('.planning-status')).toHaveText('Proposée');
  if (doseEntiere) await expect(premiere).toContainText('10 mm', { useInnerText: true });
  // Aucune pompe habituelle : la proposition le dit, elle ne l'invente pas.
  await expect(premiere).toContainText('non vérifiée');
  await expect(premiere).toContainText(planche);
  await verifierLEtape(page, journal, 'plan calculé');

  if (testInfo.project.name === 'ordinateur') {
    // Sur un grand écran, la semaine en tableau (précision P46) : une ligne par
    // matériel, le créneau compact, son détail et ses gestes par-dessus le tableau.
    await page.setViewportSize({ width: 1440, height: 900 });
    const semaine = planning.getByRole('list', { name: 'Jours de la semaine' });
    await expect(semaine).toHaveCSS('display', 'grid');
    await expect(semaine.locator('li.planning-row-label').filter({ hasText: materiel })).toBeVisible();
    await expect(premiere.getByRole('button', { name: 'Valider', exact: true })).toBeHidden();
    await premiere.locator('summary').click();
    await expect(premiere.getByRole('button', { name: 'Valider', exact: true })).toBeVisible();
    await expect(premiere.locator('.planning-justification')).toBeVisible();
    await verifierLEtape(page, journal, 'semaine en tableau sur grand écran');
    await premiere.locator('summary').click();
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  // La justification d'un clic : la dose, le moment, la faisabilité, les planches.
  await premiere.locator('summary').click();
  const justification = premiere.locator('.planning-justification');
  await expect(justification).toContainText(doseEntiere ? 'la dose maximale par arrosage' : 'ce qui tient dans la plage horaire');
  await expect(justification).toContainText('faisabilité hydraulique non vérifiée');
  const lignePlanche = premiere.locator('table.planning-beds tbody tr').filter({ hasText: planche });
  if (doseEntiere) await expect(lignePlanche).toContainText('10 mm');
  else await expect(lignePlanche).toBeVisible();
  await verifierLEtape(page, journal, 'justification lue');

  // Ce qui n'a pas été placé, avec son motif : le jardin Sud n'a aucun matériel.
  // La liste est repliée derrière son titre, qui dit le nombre de planches (8 novembre 2026).
  const nonPlace = planning.locator('details.planning-unplaced');
  await expect(nonPlace).toHaveJSProperty('open', false);
  const titreNonPlace = nonPlace.locator('summary');
  await expect(titreNonPlace).toHaveText(/^Planches non servies \(\d+\)$/);
  await expect(nonPlace.locator('tbody tr').first()).toBeHidden();
  await verifierCibleTactile(titreNonPlace, 'le titre « Planches non servies »');
  await expect((await lignesNonPlacees(planning)).filter({ hasText: 'S01' })).toContainText('aucun matériel ne l’arrose');
  await verifierLEtape(page, journal, 'liste non placé');

  // Ajuster puis valider : 6 mm à 10 mm/h font 36 minutes, la fin suit.
  await verifierCibleTactile(premiere.getByRole('button', { name: 'Valider', exact: true }), 'le bouton « Valider »');
  await premiere.getByRole('button', { name: 'Ajuster' }).click();
  const ajustement = premiere.getByRole('form', { name: /^Ajuster la proposition/ });
  await ajustement.getByLabel('Dose de référence (mm)').fill('6');
  await expect(ajustement.locator('.planning-adjust-preview')).toContainText('Durée 36 min');
  await ajustement.getByRole('button', { name: 'Valider avec ces valeurs' }).click();
  await expect(premiere.locator('.planning-status')).toHaveText('Validée', { timeout: 30_000 });
  await expect(premiere.locator('.planning-proposal-feedback')).toContainText('Irrigation planifiée');
  let validees = 1;
  await verifierLEtape(page, journal, 'proposition ajustée et validée');

  // Le calendrier décide du reste : une deuxième proposition se valide avec
  // son jour, une troisième se refuse.
  // Un filtre « has » se résout dans l'élément filtré : le sélecteur intérieur
  // part de la page, jamais de la section, sans quoi il ne trouve rien.
  const proposeesDe = (racine: Locator | Page) => racine.locator('article.planning-proposal[data-status="proposed"]').filter({ hasText: materiel });
  const proposees = () => proposeesDe(planning);
  if (await proposees().count() > 0) {
    // La carte est désignée par son nom avant le geste : son statut change, et
    // un sélecteur par statut glisserait vers la proposition suivante.
    const deuxieme = await carteNommee(planning, proposees().first());
    const jour = planning.locator('li.planning-day').filter({ has: proposeesDe(page) }).first();
    await jour.getByRole('button', { name: /^Valider les \d+ propositions? du jour$/ }).click();
    await expect(deuxieme.locator('.planning-status')).toHaveText('Validée', { timeout: 30_000 });
    validees += 1;
    await verifierLEtape(page, journal, 'jour validé');
  }
  if (await proposees().count() > 0) {
    const troisieme = await carteNommee(planning, proposees().first());
    await montrerLaCarte(planning, troisieme);
    await troisieme.getByRole('button', { name: 'Refuser' }).click();
    await expect(troisieme.locator('.planning-status')).toHaveText('Refusée', { timeout: 30_000 });
    await expect(troisieme.locator('.planning-proposal-feedback')).toContainText('refusée');
    await verifierLEtape(page, journal, 'proposition refusée');

    // Relue avec le calcul suivant, la carte refusée se date de son calcul :
    // une proposition du nouveau calcul peut porter le même numéro.
    await planning.getByRole('button', { name: 'Recalculer le plan' }).click();
    const refusee = planning.locator('article.planning-proposal[data-status="refused"]').filter({ hasText: materiel }).first();
    await expect(refusee).toContainText(/calcul du \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/, { timeout: 30_000 });
    await expect(refusee).toHaveAttribute('aria-label', /^Proposition p-\d+ du calcul du \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}, /);
    await verifierLEtape(page, journal, 'carte refusée datée après recalcul');
  }

  // Une proposition validée est une irrigation planifiée ordinaire, visible
  // là où elles le sont toutes : sur la page des arrosages.
  await attendreLaPageIrrigation(page, 'arrosages');
  const aVenir = page.locator('.upcoming-irrigations article').filter({ hasText: materiel });
  await expect(aVenir).toHaveCount(validees);
  await expect(aVenir.filter({ hasText: 'Planning du' })).toHaveCount(validees);
  await expect(aVenir.filter({ hasText: '36 min' }).first()).toBeVisible();
  await verifierLEtape(page, journal, 'propositions validées parmi les irrigations à venir');

  // Remise en état : les irrigations planifiées annulées comme dans P2, la
  // plage rendue, l'objectif retiré des deux semaines. Les parcours partagent
  // une base.
  await annulerLesIrrigationsDuPlanning(page);
  await attendreLaPageIrrigation(page, 'planning');
  await reglerLaPlageDuGoutteAGoutte(planning, PLAGE_DE_DEPART);
  await attendreLaPageIrrigation(page, 'besoins');
  await retirerLesObjectifs(page);
  await verifierLEtape(page, journal, 'état initial rétabli');
});

