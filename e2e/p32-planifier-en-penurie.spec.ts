import { expect, test, type Locator, type Page } from '@playwright/test';
import { millisecondsFromMinutes } from '../lib/domain/units.ts';
import { horodatageLocal, nomUnique, preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, confirmerDansLaFenetre, ouvrirLesReglagesDeLaPage, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';
import { metresCubesLus, VOLUME_ECRIT } from './support/volumes.ts';
import { annulerLesIrrigationsDuPlanning, carteNommee, lignesNonPlacees, montrerLaCarte, poserUnObjectifDeFerme, refuserLaProposition, reglerLaPlageDuGoutteAGoutte, retirerLesObjectifs } from './support/planning.ts';

/**
 * Parcours P32 : planifier en pénurie (docs/browser-journeys-contract.md,
 * docs/shortage-contract.md, « Les jeux de données », D-091).
 *
 * C'est l'écran où l'eau manque et où le plan doit le dire. Le parcours prend
 * la part mesurable : sa réserve, sa pompe et ses deux lignes, l'objectif de
 * P10 ; le plan calculé, la ligne de budget de la réserve avec ses fractions,
 * « Non placé » et son motif, la carte de chaque ligne à la part de sa
 * planche et sa justification ; une proposition validée qui compte au
 * recalcul (S20, D-086), une proposition refusée qui se replace hors du
 * créneau refusé (S21) ; puis la remise en état. Ce qu'il ne prouve pas : une
 * seconde chaîne chiffrée (S9, test du moteur), un créneau raccourci par ses
 * parts, qui demande une ligne débordant sur d'autres planches (S15, test du
 * moteur), les autres conduites (S10 à S12), l'arbitrage (P7), la lecture
 * agronomique d'une vraie pénurie sur la ferme, qui reste la recette finale.
 *
 * Le dispositif rend la dose indépendante du jour et de l'heure. 0,3 m³ pour
 * N02 et N03, 50,5 m² ensemble, au même besoin : la part de chaque planche est
 * de 5,9 mm, sous la dose maximale du goutte-à-goutte (10 mm) et au-dessus de
 * la minimale (3 mm), donc un seul arrosage par ligne, à sa part, quel que
 * soit le nombre de jours qui restent. N02 et N03, que nul autre parcours
 * n'équipe ni n'arrose : la part dépend du besoin de toutes les planches de la
 * chaîne. La plage du goutte-à-goutte finit à douze heures au moins du calcul,
 * pour que la plage du jour ne raccourcisse pas l'arrosage avant sa part ; à
 * 20 mm/h, il dure 18 minutes. Reste la fin de la semaine : le dimanche de
 * 23 h 42 à 23 h 59, la part ne tient plus avant minuit et le parcours n'a
 * rien à lire ; le dimanche, la dose replacée après le refus peut être
 * raccourcie par minuit et n'est pas comparée (docs/browser-journeys-contract.md,
 * « l'heure où il tourne »).
 */

const OBJECTIF_MM = '70';
/** La part de N02 et de N03 : 0,3 m³ sur 50,5 m², soit 5,9 mm, un seul arrosage entre 3 et 10 mm. */
const STOCK_M3 = '0,3';
const STOCK_AFFICHE = '300 L';
const PART_MM = '5,9 mm';
const CAPACITE_M3 = '10';
const DEBIT_DE_LA_POMPE_M3_H = '2';
/** Les deux lignes ensemble demandent 1,01 m³/h, sous le débit de la pompe : elles arrosent en même temps. */
const APPORT_MM_PAR_HEURE = 20;
const PLAGE_DE_DEPART = { debut: '06:00', fin: '22:00' };
/** Le plan se recalcule après la réponse du serveur ; la section le relit à intervalles croissants, jusqu'à 49 s. */
const RECALCUL = { timeout: millisecondsFromMinutes(1) };
const MOTIF_EAU = 'stock et ressources insuffisants d’ici dimanche';
/** L'écart d'arrondi entre l'eau mobilisable et le volume validé, chacun au litre. */
// Trois volumes écrits à 1 L près sous 1 m³, à 0,01 m³ près au-delà (lot E, J8, F258) : l'écart d'arrondi au pire.
const ARRONDI_M3 = 0.015;
/** Six pages, deux lignes, une réserve, une pompe, deux recalculs et la remise en état. */
const DUREE_DU_PARCOURS = millisecondsFromMinutes(4);

test('la pénurie se lit dans le plan, une proposition validée compte au recalcul, une refusée se replace, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const reference = Date.now();
  await attendreLaPageIrrigation(page);

  // Deux lignes, une par planche : la validation de l'une laisse à l'autre sa proposition.
  const n02 = await preparerMaterielArrosant(page, testInfo, { planche: 'N02', apportMmParHeure: APPORT_MM_PAR_HEURE, repere: 'N02' });
  const n03 = await preparerMaterielArrosant(page, testInfo, { planche: 'N03', apportMmParHeure: APPORT_MM_PAR_HEURE, repere: 'N03' });
  await verifierLEtape(page, journal, 'deux lignes posées sur N02 et N03');

  // La réserve, sa pompe, et la pompe habituelle des deux lignes, sur la page des ressources (3.8).
  await attendreLaPageIrrigation(page, 'ressources');
  const reserve = nomUnique(testInfo, 'Réserve');
  const pompe = nomUnique(testInfo, 'Pompe');
  await creerLaReserve(page, reserve);
  // Sans recharger la page : la fiche d'une pompe voit la réserve créée
  // (point ouvert 60, D-093).
  await creerLaPompe(page, pompe, reserve);
  for (const { materiel } of [n02, n03]) await choisirLaPompeHabituelle(page, materiel, pompe);
  await verifierLEtape(page, journal, 'réserve, pompe et pompes habituelles');

  // L'objectif vaut dès lundi : posé sur cette semaine et sur la précédente (e2e/support/planning.ts).
  await attendreLaPageIrrigation(page, 'besoins');
  await poserUnObjectifDeFerme(page, OBJECTIF_MM);
  await verifierLEtape(page, journal, 'objectif posé');

  await attendreLaPageIrrigation(page, 'planning');
  const planning = page.locator('section.planning-section');
  await planning.scrollIntoViewIfNeeded();
  await reglerLaPlageDuGoutteAGoutte(planning, plageLoinDuCalcul(reference));
  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  // Un filtre « has » se résout dans l'élément filtré : le sélecteur intérieur
  // part de la page, jamais de la section, sans quoi il ne trouve rien.
  const proposeesDe = (racine: Locator | Page, materiel: string) => racine.locator('article.planning-proposal[data-status="proposed"]').filter({ hasText: materiel });
  // Les lignes n'existent que depuis ce parcours : une carte à leur nom est celle de ce calcul.
  await expect(proposeesDe(planning, n02.materiel)).toHaveCount(1, { timeout: 30_000 });
  await expect(proposeesDe(planning, n03.materiel)).toHaveCount(1);
  const meta = planning.locator('.planning-meta');
  await expect(meta).toContainText('(à la demande)');
  await expect(meta).toContainText(`${reserve} : ${STOCK_AFFICHE} observés`);
  await verifierLEtape(page, journal, 'plan calculé');

  // Une phrase d'action en tête du résumé, aux deux largeurs (audit final,
  // lot B, R3, F243) ; les notes du calcul, quand il y en a, attendent dans
  // un repli fermé (F244).
  await expect(planning.locator('.planning-shortage-action')).toBeVisible();
  // La phrase seule, sans le lien « Répartir l'eau » qui la suit (R4, F247).
  await expect(planning.locator('.planning-shortage-action > span')).toHaveText(/^Il manque .+ d’eau d’ici dimanche.* : \d+ planches? ne recevr(a|ont) pas tout (son|leur) besoin\.( Le matériel verse aussi .+\.)?$/);
  for (const repli of await planning.locator('details.planning-calculation').all()) {
    await expect(repli).toHaveJSProperty('open', false);
    await expect(repli.locator('summary')).toHaveText('Le détail du calcul');
  }
  await expect(planning.locator('.planning-summary-note:visible')).toHaveCount(0);
  await verifierLEtape(page, journal, 'phrase d’action, détail du calcul replié');

  // « Aujourd'hui » redit la phrase du planning, avec le même lien vers la
  // répartition, et la pastille orange tant qu'elle attend (audit final,
  // lot A, R1, F276 et F277). Une répartition validée laissée par un autre
  // parcours la ferait « Revoir », sans pastille.
  const phraseDuPlanning = await planning.locator('.planning-shortage-action > span').innerText();
  const lienDuPlanning = await planning.locator('.planning-shortage-action > a').innerText();
  await attendreLaPageIrrigation(page, 'aujourdhui');
  const encadre = page.locator('.today-head .today-shortage');
  await expect(page.locator('.today-shortage > span')).toHaveText(phraseDuPlanning);
  const lienDuMatin = encadre.getByRole('link', { name: lienDuPlanning, exact: true });
  await expect(lienDuMatin).toHaveAttribute('href', /^\/irrigation\/ressources\?season=\d{4}#repartition$/);
  await verifierCibleTactile(lienDuMatin, `le lien « ${lienDuPlanning} » d’« Aujourd’hui »`);
  await expect(page.locator('.today-chip[data-tone="shortage"]')).toHaveCount(lienDuPlanning === 'Répartir l’eau' ? 1 : 0);
  await expect(page.locator('.today-chip').filter({ hasText: 'Rien à arroser' })).toHaveCount(0);
  await expect(page.locator('.today-head')).not.toContainText('Rien d’urgent');
  await verifierLEtape(page, journal, '« Aujourd’hui » dit le manque d’eau comme le planning');
  await attendreLaPageIrrigation(page, 'planning');
  await expect(planning.locator('.planning-shortage-action > span')).toHaveText(phraseDuPlanning);

  // La ligne de budget de la réserve : l'eau mobilisable, la demande, et pour
  // chaque niveau la part visée et la part placée, « — » sans demande.
  const budget = await ligneDeBudget(planning, reserve);
  await expect(budget).toHaveText(new RegExp(`^300 L mobilisables pour ${VOLUME_ECRIT} demandés · haute — · normale \\d+ % visés, \\d+ % placés · basse —$`));
  const parts = (await budget.innerText()).match(/normale (\d+) % visés, (\d+) % placés/);
  expect(parts, 'la part normale de la ligne de budget').not.toBeNull();
  const [visee, placee] = [Number(parts![1]), Number(parts![2])];
  expect(visee, 'une part visée en pénurie, sous 100 %').toBeGreaterThan(0);
  expect(visee).toBeLessThan(100);
  expect(placee, 'la part placée, celle que les créneaux paient').toBeLessThanOrEqual(visee);
  const mobilisableAvant = metresCubes(await budget.innerText(), 'mobilisables');
  // Rien de validé encore : le pli ne dit pas les parts comptées après l'eau validée (remarque 4, F255).
  await expect(planning.locator('.planning-budgets-validated')).toHaveCount(0);
  await verifierLEtape(page, journal, 'ligne de budget et fractions');

  // Ce qui n'a pas été placé, avec son motif : N02 n'a reçu que sa part.
  await expect((await lignesNonPlacees(planning)).filter({ hasText: 'N02' })).toContainText(MOTIF_EAU);
  await verifierLEtape(page, journal, 'liste non placé et son motif');

  // La carte de chaque ligne porte la part de sa planche, la même dose pour
  // les deux, au même besoin ; sa justification dit que cette dose est la
  // part, non « le besoin restant » (point ouvert 61, D-092), nomme la réserve
  // et la faisabilité vérifiée.
  const carteN02 = await carteNommee(planning, proposeesDe(planning, n02.materiel).first());
  await expect(doseDe(carteN02)).toHaveText(PART_MM);
  await expect(doseDe(proposeesDe(planning, n03.materiel).first())).toHaveText(PART_MM);
  await montrerLaCarte(planning, carteN02);
  await carteN02.locator('summary').click();
  const justification = carteN02.locator('.planning-justification');
  await expect(justification).toContainText('la part de la semaine réservée à ses planches');
  await expect(justification).not.toContainText('le besoin restant');
  await expect(justification).toContainText(reserve);
  await expect(justification).toContainText('vérifiée : pompe, origine et stock connus');
  await carteN02.locator('summary').click();
  await verifierLEtape(page, journal, 'justification de la carte en pénurie');

  // Valider en pénurie : l'irrigation validée puise dans la réserve, et le
  // recalcul qui suit la compte comme déjà placée dans la part de N02 — l'eau
  // mobilisable baisse de son volume, N02 ne reçoit rien de plus, N03 garde sa
  // dose (S20, point ouvert 57, D-086).
  const volumeValide = metresCubes(await mesureDe(carteN02, 'Volume').innerText(), '');
  const valider = carteN02.getByRole('button', { name: 'Valider', exact: true });
  await verifierCibleTactile(valider, 'le bouton « Valider »');
  await valider.click();
  await expect(carteN02.locator('.planning-status')).toHaveText('Validée', { timeout: 30_000 });
  await expect(meta).toContainText('(après une proposition validée)', RECALCUL);
  await expect(proposeesDe(planning, n02.materiel)).toHaveCount(0);
  await expect(proposeesDe(planning, n03.materiel)).toHaveCount(1);
  await expect(doseDe(proposeesDe(planning, n03.materiel).first())).toHaveText(PART_MM);
  const budgetApres = await ligneDeBudget(planning, reserve);
  await expect(budgetApres).toContainText('mobilisables');
  const mobilisableApres = metresCubes(await budgetApres.innerText(), 'mobilisables');
  expect(Math.abs(mobilisableApres - (mobilisableAvant - volumeValide)), `${mobilisableApres} m³ mobilisables après la validation de ${volumeValide} m³ sur ${mobilisableAvant} m³`)
    .toBeLessThanOrEqual(ARRONDI_M3);
  // La part de la normale peut baisser : le pli dit, en tête, qu'elle se compte
  // après les m³ déjà validés, au moins ceux de N02 (audit final, lot B, remarque 4, F255).
  const apresValidation = planning.locator('.planning-budgets-validated');
  await expect(apresValidation).toBeVisible();
  await expect(apresValidation).toHaveText(new RegExp(`^Les parts se comptent sur ce qui reste à placer, après les ${VOLUME_ECRIT} déjà validés cette semaine : une part qui baisse après une validation ne retire pas d’eau aux planches\\.$`));
  expect(metresCubes(await apresValidation.innerText(), 'déjà validés'), 'le volume validé de N02 au moins').toBeGreaterThanOrEqual(volumeValide - ARRONDI_M3);
  await verifierLEtape(page, journal, 'proposition validée, comptée au recalcul');

  // Refuser en pénurie : le créneau refusé est évité au recalcul et la part de
  // N03 se replace ailleurs, la même dose hors du dimanche ; quand la semaine
  // n'offre plus rien, « Non placé » le dit « créneau refusé » (S21, D-030).
  const refusee = await carteNommee(planning, proposeesDe(planning, n03.materiel).first());
  await montrerLaCarte(planning, refusee);
  const identifiantRefuse = await refusee.getAttribute('data-proposal-id');
  const creneauRefuse = await refusee.locator('.planning-proposal-time strong').innerText();
  const refuser = refusee.getByRole('button', { name: 'Refuser' });
  await verifierCibleTactile(refuser, 'le bouton « Refuser »');
  await refuserLaProposition(page, refusee);
  await expect(refusee.locator('.planning-status')).toHaveText('Refusée', { timeout: 30_000 });
  await expect(meta).toContainText('(après une proposition refusée)', RECALCUL);
  const jourDuRefus = planning.locator('li.planning-day').filter({ has: page.locator(`article.planning-proposal[data-proposal-id="${identifiantRefuse}"]`) });
  await expect(proposeesDe(jourDuRefus, n03.materiel).filter({ has: page.locator('.planning-proposal-time strong').getByText(creneauRefuse, { exact: true }) })).toHaveCount(0);
  const replacee = (await proposeesDe(planning, n03.materiel).count()) > 0;
  if (replacee && !estDimanche(reference)) await expect(doseDe(proposeesDe(planning, n03.materiel).first())).toHaveText(PART_MM);
  if (!replacee) await expect((await lignesNonPlacees(planning)).filter({ hasText: 'N03' })).toContainText('créneau refusé');
  await verifierLEtape(page, journal, replacee ? 'part replacée après le refus' : 'part non placée pour créneau refusé');

  // « Répartir l'eau » mène à l'écran de répartition, que « Ressources » met
  // en tête de page tant que la répartition attend (audit final, lot B, R4,
  // F247 et F248).
  // Une répartition validée laissée par un autre parcours la ferait « Revoir » :
  // la page garde alors l'ordre d'avant, la répartition n'attendant plus.
  const repartir = planning.locator('.planning-shortage-action').getByRole('link', { name: /^(Répartir l’eau|Revoir la répartition)$/ });
  await verifierCibleTactile(repartir, 'le lien « Répartir l’eau »');
  const enAttente = (await repartir.innerText()) === 'Répartir l’eau';
  await repartir.click();
  await expect(page).toHaveURL(/\/irrigation\/ressources\?season=\d+#repartition$/);
  const repartition = page.locator('section#repartition');
  await expect(repartition).toBeVisible();
  if (enAttente) {
    const [haut, ressources] = await Promise.all([repartition.boundingBox(), page.locator('section.water-resources-section').boundingBox()]);
    expect(haut!.y, 'la faisabilité avant les ressources en eau').toBeLessThan(ressources!.y);
  }
  await verifierLEtape(page, journal, 'répartir l’eau, la faisabilité en tête');

  // Remise en état : les parcours partagent une base. L'irrigation validée
  // annulée, les lignes et la pompe archivées, la réserve rendue inactive,
  // l'objectif retiré des deux semaines, la plage rendue.
  await attendreLaPageIrrigation(page, 'arrosages');
  await annulerLesIrrigationsDuPlanning(page);
  await attendreLaPageIrrigation(page, 'materiel');
  for (const { materiel } of [n02, n03]) await archiverLeMateriel(page, materiel);
  await attendreLaPageIrrigation(page, 'ressources');
  await archiverLaPompe(page, pompe);
  await rendreLaReserveInactive(page, reserve);
  await attendreLaPageIrrigation(page, 'besoins');
  await retirerLesObjectifs(page);
  await attendreLaPageIrrigation(page, 'planning');
  await reglerLaPlageDuGoutteAGoutte(planning, PLAGE_DE_DEPART);
  await verifierLEtape(page, journal, 'état initial rétabli');
});

/**
 * La plage du goutte-à-goutte, ouverte toute la journée, qui finit à douze
 * heures au moins de l'instant du parcours : de 00:00 à 23:59 le matin, de
 * 12:00 à 11:59 l'après-midi, à l'heure de la ferme. La plage du jour ne
 * raccourcit alors jamais l'arrosage avant sa part.
 */
function plageLoinDuCalcul(reference: number): { debut: string; fin: string } {
  const heure = Number(horodatageLocal(0, reference).slice(11, 13));
  const MIDI = 12;
  return heure < MIDI ? { debut: '00:00', fin: '23:59' } : { debut: '12:00', fin: '11:59' };
}

/** Le dimanche à la ferme : le dernier jour de la semaine, que minuit borne. */
function estDimanche(reference: number): boolean {
  const DIMANCHE = 0;
  return new Date(`${horodatageLocal(0, reference).slice(0, 10)}T12:00:00Z`).getUTCDay() === DIMANCHE;
}

/** « 166 L mobilisables pour … » : le volume, en m³, qui précède le mot donné (lot E, J8). */
function metresCubes(texte: string, suivant: string): number {
  return metresCubesLus(texte, suivant);
}

function mesureDe(carte: Locator, intitule: string): Locator {
  return carte.locator('.planning-measure').filter({ hasText: intitule }).locator('strong');
}

function doseDe(carte: Locator): Locator {
  return mesureDe(carte, 'Dose');
}

/** La ligne d'une chaîne dans le pli « Budget d'eau d'ici dimanche », déplié s'il ne l'est pas. */
async function ligneDeBudget(planning: Locator, origine: string): Promise<Locator> {
  const pli = planning.locator('details.planning-budgets');
  await pli.scrollIntoViewIfNeeded();
  if (!(await pli.evaluate((element) => (element as HTMLDetailsElement).open))) await pli.locator('summary').click();
  await expect(pli).toHaveJSProperty('open', true);
  return pli.locator('li').filter({ has: planning.page().getByText(origine, { exact: true }) }).locator('span');
}

function panneauDesReserves(page: Page): Locator {
  return page.locator('article.water-asset-panel').filter({ has: page.getByRole('heading', { name: 'Réserves', exact: true }) });
}

/** Une réserve sans apport, ni pluie ni évaporation : son eau mobilisable est son stock observé. */
async function creerLaReserve(page: Page, reserve: string): Promise<void> {
  const panneau = panneauDesReserves(page);
  const formulaire = page.locator('form.water-editor').filter({ has: page.getByRole('heading', { name: 'Nouvelle réserve' }) });
  // Premier clic de la page : la fenêtre n'existe que sous React (docs/browser-journeys-contract.md).
  await ouvrirParClic(panneau.getByRole('button', { name: '+ Ajouter' }), formulaire);
  await formulaire.getByLabel('Nom', { exact: true }).fill(reserve);
  await formulaire.getByLabel('Capacité maximale (m³)').fill(CAPACITE_M3);
  await expect(formulaire.getByLabel('Minimum de sécurité (m³)')).toHaveValue('0');
  await expect(formulaire.getByLabel('Reçoit la pluie')).not.toBeChecked();
  await formulaire.getByLabel('Volume non renseigné').uncheck();
  await formulaire.getByLabel('Volume observé (m³)').fill(STOCK_M3);
  await formulaire.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(formulaire).toBeHidden({ timeout: 15_000 });
  await expect(panneau.locator('.water-asset-card').filter({ hasText: reserve })).toContainText('Actuel300 L');
}

async function creerLaPompe(page: Page, pompe: string, reserve: string): Promise<void> {
  await ouvrirLesReglagesDeLaPage(page); // les pompes, en bas (audit final, lot D, J2, F305)
  const formulaire = page.locator('form.pump-editor').filter({ has: page.getByRole('heading', { name: 'Nouvelle pompe' }) });
  await page.getByRole('button', { name: '+ Ajouter une pompe' }).click();
  await expect(formulaire).toBeVisible();
  await formulaire.getByLabel('Nom', { exact: true }).fill(pompe);
  await formulaire.getByLabel('Débit maximal (m³/h)').fill(DEBIT_DE_LA_POMPE_M3_H);
  const origine = formulaire.locator('.pump-origin-row').filter({ hasText: `${reserve} · réserve` });
  await origine.getByRole('checkbox').check();
  await origine.getByRole('radio', { name: 'Par défaut' }).check();
  await formulaire.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(formulaire).toBeHidden({ timeout: 15_000 });
  const carte = page.locator('article.pump-card').filter({ hasText: pompe });
  await expect(carte).toContainText('Active');
  await expect(carte).toContainText(reserve);
}

/** La pompe habituelle d'un matériel : sa liste porte son nom, et l'écran la relit du serveur une fois enregistrée. */
async function choisirLaPompeHabituelle(page: Page, materiel: string, pompe: string): Promise<void> {
  await ouvrirLesReglagesDeLaPage(page); // les pompes, en bas (audit final, lot D, J2, F305)
  const liste = page.locator('article.pump-defaults label').filter({ hasText: materiel }).locator('select');
  await liste.selectOption({ label: pompe });
  await expect(liste.locator('option:checked')).toHaveText(pompe, { timeout: 15_000 });
  await expect(liste).toBeEnabled();
}

/** Archiver ne se demande qu'une fois, à la fenêtre de confirmation du module, que le parcours accepte comme un utilisateur (lot G, n° 8). */
async function archiverLeMateriel(page: Page, materiel: string): Promise<void> {
  const carte = page.locator('.equipment-section article').filter({ hasText: materiel });
  await carte.getByLabel(`Actions pour ${materiel}`).click();
  await carte.getByRole('menuitem', { name: 'Archiver' }).click();
  await confirmerDansLaFenetre(page, 'Archiver le matériel');
  await expect(carte).toHaveCount(0, { timeout: 20_000 });
}

async function archiverLaPompe(page: Page, pompe: string): Promise<void> {
  await ouvrirLesReglagesDeLaPage(page); // les pompes, en bas (audit final, lot D, J2, F305)
  const carte = page.locator('article.pump-card').filter({ hasText: pompe });
  await carte.getByRole('button', { name: 'Archiver' }).click();
  await expect(carte).toContainText('Archivée', { timeout: 15_000 });
}

/** Une réserve ne se supprime pas : rendue inactive, elle ne compte plus nulle part. */
async function rendreLaReserveInactive(page: Page, reserve: string): Promise<void> {
  const carte = panneauDesReserves(page).locator('.water-asset-card').filter({ hasText: reserve });
  const editeur = page.locator('form.water-editor').filter({ has: page.getByRole('heading', { name: 'Modifier la réserve' }) });
  await carte.getByRole('button', { name: 'Modifier' }).click();
  await expect(editeur).toBeVisible();
  await editeur.getByLabel('État').selectOption({ label: 'Inactive' });
  await editeur.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(editeur).toBeHidden({ timeout: 15_000 });
  // Relue du serveur : la fiche rouverte dit « Inactive ».
  await carte.getByRole('button', { name: 'Modifier' }).click();
  await expect(editeur.getByLabel('État')).toHaveValue('inactive');
  await editeur.getByRole('button', { name: 'Annuler' }).click();
  await expect(editeur).toBeHidden();
}
