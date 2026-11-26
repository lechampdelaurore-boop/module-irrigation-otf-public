import { expect, test } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { annulerDepuisLeMenu, choisirMaterielEtReglage, horodatageLocal, ouvrirPlusDOptions, preparerMaterielArrosant, soumettreIrrigation } from './support/materiel.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';
import { poserUnObjectifDeFerme } from './support/planning.ts';

/**
 * Parcours P31a : l'audit ergonomique, lot 3, PR 1 — le planning (point 5) et
 * la page « Arrosages » (point 6) (docs/audit-ergonomie-lot3-contract.md,
 * sections 3 et 6 ; docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, propre au parcours et à la largeur, tout coché :
 *
 * - le planning : les cartes de tête « À valider », « Faites », « En
 *   retard » d'abord ; les planches sans matériel dites en action vers
 *   « Matériel » au-dessus du pli, jamais en manque d'eau, et le pli
 *   « Planches non servies (n) » rangé par motif, « Sans matériel (n) » en
 *   tête (cas 1 et 2) ;
 * - « Arrosages » : le seul matériel prêt choisi d'office et dit (cas 3,
 *   amendé par S5-b), aucun cadre rouge ; une irrigation planifiée il y a six heures et une
 *   demain se rangent, la première dans « À traiter », la seconde sous
 *   « Demain » (cas 5) ; « Annuler » est rangé dans le menu « … », sa
 *   confirmation inchangée (cas 6) ; « Fait comme prévu » ne paraît que sur
 *   la ligne passée, ici et sur « Aujourd'hui », demande une confirmation
 *   d'une ligne qui dit qu'elle ne se corrige plus, et « Ne rien enregistrer »
 *   n'écrit rien (cas 7).
 *
 * Ce qu'il ne prouve pas : les comptes chiffrés (les tests du domaine,
 * `tests/audit-ergonomie-lot3.test.ts`, les vérifient, retard compris), la
 * phrase d'un dépassement de pompe (une ferme neuve n'a pas de pompe ; la
 * phrase est testée dans le domaine), la ferme réelle, un vrai téléphone.
 */

test('planning : les gestes en tête, les planches sans matériel en action vers « Matériel », le reste rangé par motif', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'lot3-planning');
  await preparerLaFermeNeuve(page);

  // Un objectif de ferme, aucun matériel : toutes les planches attendent un matériel, aucune ne manque d'eau.
  await attendreLaPageIrrigation(page, 'besoins');
  await poserUnObjectifDeFerme(page, '20');
  await attendreLaPageIrrigation(page, 'planning');
  const planning = page.locator('section.planning-section');
  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  await expect(planning.locator('.planning-meta')).toContainText('calculé le', { timeout: 30_000 });

  // Cas 1 : les trois cartes qui demandent un geste d'abord, dans cet ordre.
  if (telephone) {
    const ligne = planning.locator('.planning-summary-line');
    await expect(ligne).toContainText(/^0 à valider · 0 faite · /);
    await ligne.click();
  }
  const cartes = planning.locator('.planning-summary-card');
  await expect(cartes.nth(0)).toContainText('À valider');
  await expect(cartes.nth(1)).toContainText('Faites');
  await expect(cartes.nth(2)).toContainText('En retard');
  await expect(cartes.nth(2)).toContainText('Rien en retard');
  await expect(planning.locator('.planning-summary-card[data-action="true"]')).toHaveCount(3);
  await verifierLEtape(page, journal, 'cartes de tête du planning');

  // Cas 2 : les planches sans matériel, en action au-dessus du pli, jamais en manque d'eau.
  const action = planning.locator('.planning-unplaced-action');
  await expect(action).toBeVisible();
  await expect(action).toContainText(/^\d+ planches? n’(ont|a) aucun matériel :/);
  const sansMateriel = Number((await action.innerText()).match(/^(\d+)/)?.[1]);
  expect(sansMateriel).toBeGreaterThan(0);
  await expect(cartes.filter({ hasText: 'Planches non servies' })).toContainText(`dont ${sansMateriel} sans matériel`);
  await expect(cartes.filter({ hasText: 'Manque d’eau' }).locator('strong')).toHaveText(/^0(,0+)? m³$/);
  const lien = action.getByRole('link', { name: /^(les|la) rattacher$/ });
  if (telephone) await verifierCibleTactile(lien, 'Le lien « les rattacher »');

  // Le pli se déplie : « Sans matériel (n) » en tête, avec ce qu'il veut dire.
  const pli = planning.locator('details.planning-unplaced');
  // Le titre ne compte en rouge que les planches en manque ; celles sans objectif sont dites à part (audit final, lot B, J7, F251).
  await expect(pli.locator('summary h3')).toHaveText(/^(Planches non servies \(\d+\)( · \d+ sans objectif)?( · \d+ en attente)?|Planches sans objectif \(\d+\)( · \d+ en attente)?|Planches en attente \(\d+\))$/);
  await pli.locator('summary').click();
  const premier = pli.locator('section.planning-unplaced-group').first();
  await expect(premier).toHaveAttribute('data-group', 'no-equipment');
  await expect(premier.locator('h4')).toHaveText(`Sans matériel (${sansMateriel})`);
  await expect(premier).toContainText('pas un manque d’eau');
  await expect(premier.locator('tbody tr')).toHaveCount(sansMateriel);
  // Au téléphone, une ligne compacte par planche : son nom, son jardin, son
  // manque « sur » son besoin, le motif dessous ; ni « Placé » ni la priorité
  // normale (audit final, lot B, J7, F253).
  const ligne = premier.locator('tbody tr').first();
  if (telephone) {
    await expect(ligne.locator('td[data-cell="placed"]')).toBeHidden();
    await expect(ligne.locator('td[data-cell="need"]')).toBeHidden();
    await expect(ligne.locator('.planning-unplaced-of')).toBeVisible();
    const [nom, motif] = await Promise.all([ligne.locator('th').boundingBox(), ligne.locator('td[data-cell="reason"]').boundingBox()]);
    expect(motif!.y, 'le motif sous la ligne compacte').toBeGreaterThan(nom!.y);
    expect(motif!.y - nom!.y, 'une ligne compacte, pas six').toBeLessThan(120);
  } else {
    await expect(ligne.locator('td[data-cell="placed"]')).toBeVisible();
    await expect(ligne.locator('.planning-unplaced-of')).toBeHidden();
  }
  await expect(pli).not.toContainText(/\bR13\b|arbitrage|Non placé/);
  await verifierLEtape(page, journal, 'planches non servies rangées par motif');

  await lien.click();
  await attendreLaPagePrete(page, 'materiel');
  await verifierLEtape(page, journal, 'le lien mène à « Matériel »');
});

test('arrosages : le seul matériel choisi d’office, « À traiter » en tête, lignes par jour, « Annuler » dans « … », « Fait comme prévu » confirmé', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'lot3-arrosages');
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'materiel');
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo);

  // Cas 3, amendé par S5-b (D-332, D-333) : le seul matériel prêt est choisi d'office, et la ligne le dit ;
  // aucun cadre rouge avant une durée (rien n'est calculé ni dépassé).
  await attendreLaPageIrrigation(page, 'arrosages');
  await page.getByRole('tab', { name: /^Planifier/ }).click();
  const formulaire = page.locator('.watering-now[data-kind="planned"]');
  await expect(formulaire.getByRole('radio', { name: materiel, exact: true })).toBeChecked();
  await expect(formulaire).toContainText('Le seul matériel prêt à arroser est choisi.');
  await expect(formulaire.locator('.watering-duration strong')).toHaveText('—');
  await expect(page.locator('.is-exceeded')).toHaveCount(0);
  await verifierLEtape(page, journal, 'formulaire, le seul matériel choisi d’office');

  // Une irrigation planifiée il y a six heures, finie ; une autre demain, même heure.
  await choisirMaterielEtReglage(page, materiel, reglage);
  // La faisabilité « inconnue » se lit dans « Plus d'options » (S5, section 3.4).
  await ouvrirPlusDOptions(page);
  await expect(page.locator('.hydraulic-indicator')).toContainText('Aucune pompe n’est choisie');
  await page.getByLabel('Date et heure de début').fill(horodatageLocal(-6 * 60, reference));
  await soumettreIrrigation(page, /^Planifier l’arrosage de /, 'passée sans démarrage');
  await page.getByRole('tab', { name: /^Planifier/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage);
  await page.getByLabel('Date et heure de début').fill(horodatageLocal(24 * 60, reference));
  await soumettreIrrigation(page, /^Planifier l’arrosage de /, 'demain');

  // Cas 5 : « À traiter » en tête, puis la ligne de demain sous son jour.
  const liste = page.locator('.upcoming-irrigations');
  const aTraiter = liste.locator('section.irrigation-to-handle');
  await expect(aTraiter.locator('h4')).toHaveText('À traiter (1)');
  const passee = aTraiter.locator('article').filter({ hasText: materiel });
  await expect(passee.locator('.event-status')).toHaveText('Non faite');
  await expect(aTraiter.getByRole('button', { name: 'Recalculer le plan' })).toHaveCount(1);
  const demain = liste.locator('section.irrigation-day').filter({ has: page.locator('h4', { hasText: /^Demain$/ }) });
  const prevue = demain.locator('article').filter({ hasText: materiel });
  await expect(prevue).toHaveCount(1);
  await expect(prevue.locator('.event-status')).toHaveText('Planifiée');
  await expect(prevue.locator('.irrigation-row-time')).toHaveText(/^\d{1,2} h( \d{2})?$/);
  await expect(prevue.locator('.irrigation-row-volume')).toContainText(/m³|L/);
  // La carte entière s'ouvre d'un geste.
  await prevue.getByText('Voir la fiche').click();
  await expect(prevue.locator('.irrigation-row-details dl')).toBeVisible();
  await expect(prevue).toContainText('Début prévu');
  await verifierLEtape(page, journal, 'liste rangée par jour, « À traiter » en tête');

  // Cas 6 : « Démarrer maintenant » et « Modifier » visibles ; « Annuler » rangé dans « … ».
  await expect(prevue.getByRole('button', { name: 'Démarrer maintenant' })).toBeVisible();
  await expect(prevue.getByRole('button', { name: 'Modifier' })).toBeVisible();
  const annuler = prevue.getByRole('menuitem', { name: 'Annuler', exact: true });
  await expect(annuler).toBeHidden();
  const plus = prevue.locator('.row-menu > summary');
  await expect(plus).toHaveAccessibleName(new RegExp(`^Plus d’actions : ${materiel}`));
  if (telephone) await verifierCibleTactile(plus, 'Le menu « … »');
  await plus.click();
  await expect(annuler).toBeVisible();
  if (telephone) await verifierCibleTactile(annuler, '« Annuler » dans le menu');
  await page.keyboard.press('Escape');
  await expect(annuler).toBeHidden();
  await verifierLEtape(page, journal, 'menu « … » ouvert puis refermé');

  // Cas 7 : « Fait comme prévu » sur la ligne passée seulement ; sur « Aujourd'hui », le même enregistrement dit « C’est fait »
  // depuis la simplification S2, PR 3 (D-330).
  await expect(prevue.getByRole('button', { name: /^Fait comme prévu/ })).toHaveCount(0);
  const faitCommePrevu = passee.getByRole('button', { name: new RegExp(`^Fait comme prévu : ${materiel}`) });
  await expect(faitCommePrevu).toBeVisible();
  if (telephone) await verifierCibleTactile(faitCommePrevu, 'Le bouton « Fait comme prévu »');
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await expect(page.locator('#today-day').getByRole('button', { name: new RegExp(`^C’est fait : ${materiel}`) })).toHaveCount(1);
  await attendreLaPageIrrigation(page, 'arrosages');

  // Rien n'est écrit au premier clic ; « Ne rien enregistrer » ferme sans rien écrire.
  await faitCommePrevu.click();
  const confirmation = page.getByRole('dialog', { name: 'Fait comme prévu ?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(`Enregistrer comme faite ${materiel} · ${reglage}`);
  await expect(confirmation).toContainText('Elle ne se corrigera plus dans le module.');
  await verifierLEtape(page, journal, 'confirmation d’une ligne');
  await confirmation.getByRole('button', { name: 'Ne rien enregistrer' }).click();
  await expect(confirmation).toBeHidden();
  await expect(passee).toHaveCount(1);

  await faitCommePrevu.click();
  await confirmation.getByRole('button', { name: 'Enregistrer comme faite' }).click();
  await expect(page.getByText('Irrigation enregistrée comme faite, telle que prévue. Elle se lit dans l’historique.')).toBeVisible();
  await expect(confirmation).toBeHidden();
  await expect(aTraiter).toHaveCount(0);
  await verifierLEtape(page, journal, 'irrigation enregistrée comme faite');

  // Cas 6, la fin : « Annuler » depuis le menu, avec la fenêtre de confirmation du module (lot G, n° 8).
  await annulerDepuisLeMenu(page, prevue);
  await expect(prevue).toHaveCount(0);
  await verifierLEtape(page, journal, 'irrigation de demain annulée depuis le menu');
});
