import { expect, test, type Locator, type Page } from '@playwright/test';
import { millisecondsFromMinutes } from '../lib/domain/units.ts';
import { dateKeyInTimeZone, weekStartDateKey } from '../lib/domain/water-management.ts';
import { annulerDepuisLeMenu, choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';
import { annulerLesIrrigationsDuPlanning, lignesNonPlacees, poserUnObjectifDeFerme, reglerLaPlageDuGoutteAGoutte, retirerLesObjectifs } from './support/planning.ts';

/**
 * Parcours P26 : les créneaux protégés nommés (docs/browser-journeys-contract.md,
 * docs/protected-slots-contract.md, sections 7 à 9, cas 14).
 *
 * Il reprend le dispositif de P10 et P12 : matériel sous abri, objectif posé
 * sur deux semaines, plage du goutte-à-goutte ouverte toute la journée, le
 * tunnel de chaque largeur ; sa ligne débite plus fort que celle que P12 y
 * laisse, et c'est elle qui sert la planche (R12). Le créneau protégé couvre
 * tous les jours de 00 h 00 à 23 h 59, la plage entière : quelle que soit
 * l'heure où le parcours tourne, rien ne tient ailleurs et la planche se lit
 * « Non placé », motif « créneau protégé : Lavage ».
 *
 * L'arrosage sur lequel le créneau est posé après coup est planifié à la main
 * deux heures après le début du parcours, et non validé depuis le plan : la
 * première proposition commence à la minute qui suit le calcul, et passée
 * cette minute, un arrosage non démarré n'est plus « à venir » mais « en
 * retard » — il ne reçoit plus de suggestion (3.7, règle 12) ; un dimanche, la
 * semaine n'en offre pas d'autre.
 *
 * Le parcours crée le créneau, constate qu'il ne vaut qu'au prochain calcul
 * (règle 8), recalcule, lit le motif, le supprime ; planifie l'arrosage,
 * pose de nouveau le créneau puis le renomme ; constate l'avertissement de
 * « Planifier » sans blocage (règle 12, cas 14) ; recalcule, lit la
 * suggestion « Annuler » et sa raison, l'applique ; lit le journal ; puis rend
 * l'état : créneau supprimé, irrigations annulées, plage rendue, objectif
 * retiré. Ce que le calendrier seul décide n'est vérifié que s'il est offert,
 * et le parcours le dit : un dimanche de 23 h 42 à 23 h 59, la semaine n'offre
 * plus aucune proposition, et le motif ne se lit pas ; un dimanche après
 * 22 h, l'arrosage tombe la semaine suivante, hors du plan, et la suggestion
 * ne se lit pas. Ce qu'il ne prouve pas : la lecture d'un vrai créneau sur la
 * ferme, qui reste la recette réelle.
 */

const OBJECTIF_MM = '70';
/** Plus fort que la ligne de P12 sur la même planche (12 mm/h) : le moteur sert une planche par son matériel au débit le plus fort (R12). */
const APPORT_MM_PAR_HEURE = 14;
const PLAGE_OUVERTE = { debut: '00:00', fin: '23:59' };
const PLAGE_DE_DEPART = { debut: '06:00', fin: '22:00' };
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const TOUTE_LA_JOURNEE = { debut: '00:00', fin: '23:59' };
/** L'arrosage planifié à la main, deux heures après le début du parcours : encore à venir quand le plan se recalcule. */
const DECALAGE_DE_L_ARROSAGE_MIN = 120;
/** Le plan se recalcule après la réponse du serveur ; la section le relit à intervalles croissants, jusqu'à 49 s. */
const RECALCUL = { timeout: millisecondsFromMinutes(1) };

test('un créneau protégé se crée, vaut au prochain calcul, écarte le plan, avertit « Planifier » sans bloquer et fait suggérer « Annuler » sur un arrosage déjà planifié, puis se supprime, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  const debutDeLArrosage = reference + millisecondsFromMinutes(DECALAGE_DE_L_ARROSAGE_MIN);
  const arrosageDansLaSemaine = weekStartDateKey(dateKeyInTimeZone(new Date(debutDeLArrosage))) === weekStartDateKey(dateKeyInTimeZone(new Date(reference)));
  await attendreLaPageIrrigation(page);

  const planche = testInfo.project.name === 'telephone' ? 'T02' : 'T01';
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo, { planche, apportMmParHeure: APPORT_MM_PAR_HEURE });
  await verifierLEtape(page, journal, 'matériel posé sous abri');

  await attendreLaPageIrrigation(page, 'besoins');
  await poserUnObjectifDeFerme(page, OBJECTIF_MM);
  await attendreLaPageIrrigation(page, 'planning');
  const planning = page.locator('section.planning-section');
  await planning.scrollIntoViewIfNeeded();
  await reglerLaPlageDuGoutteAGoutte(planning, PLAGE_OUVERTE);
  const creneaux = sectionDesCreneaux(planning);
  await expect(creneaux.getByRole('heading', { name: 'Créneaux protégés' })).toBeVisible();
  await expect(creneaux.locator('.planning-empty'), 'aucun créneau ne doit rester d’un parcours précédent').toContainText('Aucun créneau protégé');
  await verifierLEtape(page, journal, 'objectif posé, plage ouverte, aucun créneau');

  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  await expect(planning.locator('.planning-meta')).toContainText('(à la demande)', { timeout: 30_000 });
  const proposees = () => planning.locator('article.planning-proposal[data-status="proposed"]').filter({ hasText: materiel });
  const offertes = (await proposees().count()) > 0;
  await verifierLEtape(page, journal, offertes ? 'plan calculé' : 'plan calculé sans proposition, la semaine finissant');

  // Le créneau se crée dans le pli des réglages ; il ne fait pas recalculer (règle 8).
  await ajouterUnCreneau(planning, 'Lavage');
  await expect(listeDesCreneaux(planning)).toContainText('Lavage · tous les jours · de 00:00 à 23:59');
  await expect(creneaux.locator('.planning-notice')).toContainText('Créneau protégé « Lavage » enregistré : il vaut au prochain calcul.');
  if (offertes) await expect(proposees().first(), 'le plan affiché reste celui d’avant le créneau').toBeVisible();
  await verifierLEtape(page, journal, 'créneau « Lavage » enregistré');

  if (offertes) {
    // Recalculé, le plan n'a plus rien pour la planche : tout est protégé, et le motif le nomme (règle 5, cas 3).
    await planning.getByRole('button', { name: 'Recalculer le plan' }).click();
    await expect(proposees()).toHaveCount(0, { timeout: 30_000 });
    await expect((await lignesNonPlacees(planning)).filter({ hasText: planche })).toContainText('créneau protégé : Lavage');
    await verifierLEtape(page, journal, 'besoin non placé, motif « créneau protégé : Lavage »');
  }

  await supprimerLeCreneau(page, planning, 'Lavage');
  await expect(creneaux.locator('.planning-empty')).toContainText('Aucun créneau protégé');
  await verifierLEtape(page, journal, 'créneau « Lavage » supprimé');

  // Un arrosage planifié à la main, hors de tout créneau : aucun avertissement.
  await attendreLaPageIrrigation(page, 'arrosages');
  await ouvrirPlanifier(page, materiel, reglage, horodatageLocal(DECALAGE_DE_L_ARROSAGE_MIN, reference));
  await expect(page.locator('.irrigation-preview-warning')).toHaveCount(0);
  await page.getByRole('button', { name: 'Planifier l’irrigation' }).click();
  const aVenir = page.locator('.upcoming-irrigations article').filter({ hasText: materiel });
  await expect(aVenir).toHaveCount(1, { timeout: 15_000 });
  await verifierLEtape(page, journal, 'arrosage planifié à la main');

  // Le créneau posé après coup, puis renommé.
  await attendreLaPageIrrigation(page, 'planning');
  await ajouterUnCreneau(planning, 'Lavage');
  const modifier = creneaux.getByRole('button', { name: 'Modifier le créneau protégé Lavage' });
  await verifierCibleTactile(modifier, 'le bouton « Modifier »');
  await modifier.click();
  const formulaire = creneaux.getByRole('form', { name: 'Modifier un créneau protégé' });
  await expect(formulaire.getByLabel('Nom du créneau')).toHaveValue('Lavage');
  await formulaire.getByLabel('Nom du créneau').fill('Lavage des légumes');
  await formulaire.getByRole('button', { name: 'Enregistrer le créneau' }).click();
  await expect(listeDesCreneaux(planning)).toContainText('Lavage des légumes · tous les jours · de 00:00 à 23:59', { timeout: 15_000 });
  await verifierLEtape(page, journal, 'créneau posé après coup et renommé');

  // « Planifier » à la main dans le créneau : averti, jamais bloqué (règle 12, cas 14). Celui-ci n'est pas enregistré.
  await attendreLaPageIrrigation(page, 'arrosages');
  await ouvrirPlanifier(page, materiel, reglage, horodatageLocal(DECALAGE_DE_L_ARROSAGE_MIN + 60, reference));
  await expect(page.locator('.irrigation-preview-warning')).toContainText('Cet arrosage tombe dans le créneau protégé « Lavage des légumes » : le planning n’y propose jamais d’arrosage. Vous pouvez l’enregistrer quand même.');
  await expect(page.getByRole('button', { name: 'Planifier l’irrigation' })).toBeEnabled();
  await verifierLEtape(page, journal, 'avertissement du geste manuel');

  await attendreLaPageIrrigation(page, 'planning');
  if (arrosageDansLaSemaine) {
    // Au calcul suivant, l'arrosage planifié qui tombe dans le créneau reçoit « Annuler » : il y commence (règles 9 et 10, cas 10).
    await planning.getByRole('button', { name: 'Recalculer le plan' }).click();
    const suggestion = planning.locator('li.planning-suggestion').filter({ hasText: materiel });
    await expect(suggestion).toHaveCount(1, { timeout: 30_000 });
    await expect(suggestion).toHaveAttribute('data-suggestion', 'cancel');
    await expect(suggestion.locator('.planning-suggestion-head strong')).toHaveText('Annuler');
    await expect(suggestion.locator('.planning-suggestion-causes')).toContainText('cet arrosage tombe dans le créneau protégé « Lavage des légumes »');
    await expect(suggestion.getByRole('button', { name: 'Garder' })).toBeVisible();
    await verifierLEtape(page, journal, 'suggestion « Annuler » sur l’arrosage planifié');

    // « Appliquer » passe par l'annulation ordinaire : l'irrigation est annulée et le plan se recalcule.
    const appliquer = suggestion.getByRole('button', { name: 'Appliquer' });
    await verifierCibleTactile(appliquer, 'le bouton « Appliquer »');
    await appliquer.click();
    await expect(planning.locator('.planning-notice').filter({ hasText: 'Suggestion appliquée : l’irrigation planifiée est annulée.' })).toBeVisible({ timeout: 30_000 });
    await expect(planning.locator('.planning-meta')).toContainText('(après une irrigation annulée)', RECALCUL);
    await expect(planning.locator('li.planning-suggestion').filter({ hasText: materiel })).toHaveCount(0);
    await verifierLEtape(page, journal, 'suggestion appliquée');
  } else {
    await verifierLEtape(page, journal, 'suggestion non jouée : l’arrosage planifié tombe la semaine suivante, hors du plan');
  }

  // Le journal garde chaque version, la plus récente d'abord, sans nommer personne.
  await ouvrirLesReglages(planning);
  await creneaux.getByRole('button', { name: 'Voir l’historique des créneaux' }).click();
  const historique = creneaux.getByRole('list', { name: 'Historique des créneaux protégés' });
  await expect(historique.locator('li').first()).toContainText('Modifié : Lavage des légumes · tous les jours · de 00:00 à 23:59');
  expect(await historique.locator('li').count()).toBeGreaterThanOrEqual(4);
  await verifierLEtape(page, journal, 'journal des créneaux');

  // Remise en état : le créneau supprimé, les irrigations de la ligne et du
  // planning annulées s'il en reste, la plage rendue, l'objectif retiré des
  // deux semaines. Les parcours partagent une base.
  await supprimerLeCreneau(page, planning, 'Lavage des légumes');
  await expect(creneaux.locator('.planning-empty')).toContainText('Aucun créneau protégé');
  await attendreLaPageIrrigation(page, 'arrosages');
  await annulerLesIrrigationsDe(page, materiel);
  await annulerLesIrrigationsDuPlanning(page);
  await attendreLaPageIrrigation(page, 'planning');
  await reglerLaPlageDuGoutteAGoutte(planning, PLAGE_DE_DEPART);
  await expect(sectionDesCreneaux(planning).locator('.planning-empty')).toContainText('Aucun créneau protégé');
  await attendreLaPageIrrigation(page, 'besoins');
  await retirerLesObjectifs(page);
  await verifierLEtape(page, journal, 'état initial rétabli');
});

/** La section « Créneaux protégés » du pli des réglages. */
function sectionDesCreneaux(planning: Locator): Locator {
  return planning.locator('details.planning-settings section.protected-slots');
}

function listeDesCreneaux(planning: Locator): Locator {
  return sectionDesCreneaux(planning).getByRole('list', { name: 'Créneaux protégés enregistrés' });
}

/** Le pli « Réglages du planning » ouvert, s'il ne l'est pas déjà. */
async function ouvrirLesReglages(planning: Locator): Promise<void> {
  const reglages = planning.locator('details.planning-settings');
  await reglages.scrollIntoViewIfNeeded();
  if (!(await reglages.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await reglages.locator('summary').click();
  }
}

/** Un créneau protégé de tous les jours, de 00:00 à 23:59, enregistré. */
async function ajouterUnCreneau(planning: Locator, nom: string): Promise<void> {
  await ouvrirLesReglages(planning);
  const creneaux = sectionDesCreneaux(planning);
  const ajouter = creneaux.getByRole('button', { name: 'Ajouter un créneau' });
  await verifierCibleTactile(ajouter, 'le bouton « Ajouter un créneau »');
  await ajouter.click();
  const formulaire = creneaux.getByRole('form', { name: 'Ajouter un créneau protégé' });
  await formulaire.getByLabel('Nom du créneau').fill(nom);
  for (const jour of JOURS) await formulaire.getByLabel(jour, { exact: true }).check();
  await formulaire.getByLabel('Début du créneau protégé').fill(TOUTE_LA_JOURNEE.debut);
  await formulaire.getByLabel('Fin du créneau protégé').fill(TOUTE_LA_JOURNEE.fin);
  const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer le créneau' });
  await verifierCibleTactile(enregistrer, 'le bouton « Enregistrer le créneau »');
  await enregistrer.click();
  await expect(creneaux.locator('.planning-notice')).toContainText(`Créneau protégé « ${nom} » enregistré`, { timeout: 15_000 });
}

/** Le créneau supprimé, avec sa confirmation. */
async function supprimerLeCreneau(page: Page, planning: Locator, nom: string): Promise<void> {
  await ouvrirLesReglages(planning);
  const creneaux = sectionDesCreneaux(planning);
  page.once('dialog', (fenetre) => fenetre.accept());
  await creneaux.getByRole('button', { name: `Supprimer le créneau protégé ${nom}` }).click();
  await expect(creneaux.locator('.planning-notice')).toContainText(`Créneau protégé « ${nom} » supprimé`, { timeout: 15_000 });
}

/** Le formulaire « Planifier » rempli pour la ligne du parcours, à l'heure dite, rien d'enregistré. */
async function ouvrirPlanifier(page: Page, materiel: string, reglage: string, debut: string): Promise<void> {
  await page.getByRole('tab', { name: /^Planifier/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage);
  await page.getByLabel('Date et heure de début').fill(debut);
  await expect(page.getByRole('button', { name: 'Planifier l’irrigation' })).toBeEnabled();
}

/** Les irrigations à venir de la ligne du parcours, annulées une à une avec leur confirmation. */
async function annulerLesIrrigationsDe(page: Page, materiel: string): Promise<void> {
  const fiches = page.locator('.upcoming-irrigations article').filter({ hasText: materiel });
  while (await fiches.count() > 0) {
    const restantes = await fiches.count();
    await annulerDepuisLeMenu(page, fiches.first());
    await expect(fiches).toHaveCount(restantes - 1, { timeout: 15_000 });
  }
}
