import { expect, test, type Locator, type Page } from '@playwright/test';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '../lib/domain/water-management.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P13 : les alertes météo (docs/weather-alerts-contract.md,
 * « L'écran » et « Découpage et preuve de fin », PR 3).
 *
 * Le parcours ajoute un critère que la prévision de démonstration franchit
 * toujours — température minimale sous 12 °C, ses minimales allant de 2,6 à
 * 11,3 °C —, voit un seuil non numérique refusé avec son message, actualise
 * la météo et trouve dans l'historique une alerte par jour visé ; une seconde
 * actualisation n'en ajoute aucune (une seule alerte par critère et par jour
 * visé). Les parcours n'ont pas de service de notification : l'envoi est
 * enregistré « Échec du service de notification », ce que l'écran dit. Le
 * lien de l'historique ouvre la météo de la semaine du jour visé. Le critère
 * est ensuite désactivé puis supprimé ; ses alertes restent dans
 * l'historique.
 *
 * Ce qu'il ne prouve pas : la notification reçue sur un téléphone verrouillé
 * et le clic qui l'ouvre, qui restent la recette réelle sur la ferme.
 */

/** Deux actualisations, chacune après la pause de 30 s entre deux demandes. */
const DUREE_DU_PARCOURS = 180_000;
/** La pause entre deux actualisations manuelles est de 30 s ; le bouton se rouvre seul. */
const PAUSE_D_ACTUALISATION = { timeout: 45_000 };
const HORIZON_JOURS = 3;

/**
 * Les jours visés que l'actualisation peut alerter : ceux de l'horizon qui
 * tombent dans la semaine affichée, dont elle lit la prévision. Un samedi il
 * en reste deux, un dimanche un ; les autres sont dits « prévision
 * indisponible » jusqu'à la synchronisation de 06 h 15, qui lit 14 jours.
 */
function joursVisesDansLaSemaine(): number {
  const aujourdhui = dateKeyInTimeZone(new Date(), FARM_TIME_ZONE);
  const dimanche = addDaysToDateKey(weekStartDateKey(aujourdhui), 6);
  let jours = 0;
  for (let decalage = 0; decalage < HORIZON_JOURS; decalage += 1) {
    if (addDaysToDateKey(aujourdhui, decalage) <= dimanche) jours += 1;
  }
  return jours;
}

test('une alerte météo se règle, refuse un seuil non numérique, s’enregistre une fois par jour visé et ouvre la semaine, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  // Les alertes météo ont leur page ; la météo s'actualise sur celle des
  // besoins, qui porte aussi la semaine qu'ouvre une alerte (3.8).
  await attendreLaPageIrrigation(page, 'alertes-meteo');
  const libelle = `Gel P13 ${testInfo.project.name}`;

  const encart = page.locator('#weather-alerts');
  await encart.scrollIntoViewIfNeeded();
  await expect(encart.getByRole('heading', { name: 'Alertes météo' })).toBeVisible();
  await expect(encart.locator('.weather-alert-device')).toContainText('appareils de l’exploitation où les alertes sont activées');
  const ajouter = encart.getByRole('button', { name: 'Ajouter une alerte' });
  if (testInfo.project.name === 'telephone') await verifierCibleTactile(ajouter, 'le bouton « Ajouter une alerte »');
  await expect(async () => {
    await ajouter.click();
    await expect(encart.getByRole('form', { name: 'Nouvelle alerte météo' })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  const formulaire = encart.getByRole('form', { name: 'Nouvelle alerte météo' });
  await verifierLEtape(page, journal, 'formulaire d’alerte ouvert');

  // Un seuil non numérique est refusé avec le message du domaine ; rien n'est enregistré.
  await formulaire.getByLabel('Surveiller').selectOption('minimum-temperature');
  await formulaire.getByLabel('Sens').selectOption('below');
  await formulaire.getByLabel('Seuil, en °C').fill('douze');
  await formulaire.getByLabel('Horizon').selectOption(String(HORIZON_JOURS));
  await formulaire.getByLabel('Libellé facultatif').fill(libelle);
  await formulaire.getByRole('button', { name: 'Enregistrer l’alerte' }).click();
  await expect(formulaire.getByRole('alert')).toHaveText('Le seuil doit être un nombre, en °C.');
  await expect(critere(encart, libelle)).toHaveCount(0);
  await verifierLEtape(page, journal, 'seuil non numérique refusé');

  await formulaire.getByLabel('Seuil, en °C').fill('12');
  await formulaire.getByRole('button', { name: 'Enregistrer l’alerte' }).click();
  await expect(encart.locator('.water-notice')).toHaveText('L’alerte météo a été ajoutée. Elle sera évaluée à chaque nouvelle prévision.');
  const ligne = critere(encart, libelle);
  await expect(ligne).toContainText('Température minimale prévue en dessous de 12 °C (12 °C non compris), sur 3 jours, aujourd’hui compris');
  await expect(ligne).toContainText('Active');
  await expect(ligne).toContainText('Aucune alerte envoyée pour l’instant.');
  await verifierLEtape(page, journal, 'alerte ajoutée');

  // L'évaluation suit chaque écriture de prévisions : une alerte par jour visé.
  await attendreLaPageIrrigation(page, 'besoins');
  await actualiserLaMeteo(page);
  await attendreLaPageIrrigation(page, 'alertes-meteo');
  const joursVises = joursVisesDansLaSemaine();
  const alertes = historique(encart, libelle);
  await expect(alertes).toHaveCount(joursVises);
  for (const alerte of await alertes.all()) {
    await expect(alerte).toContainText('Valeur prévue');
    await expect(alerte).toContainText('Échec du service de notification');
  }
  await expect(ligne).toContainText('Dernière alerte : Valeur prévue');
  await verifierLEtape(page, journal, 'alertes enregistrées après l’actualisation');

  // Une seconde actualisation ne renvoie rien pour les mêmes jours.
  await attendreLaPageIrrigation(page, 'besoins');
  await actualiserLaMeteo(page);
  await attendreLaPageIrrigation(page, 'alertes-meteo');
  await expect(alertes).toHaveCount(joursVises);
  await verifierLEtape(page, journal, 'aucune seconde alerte pour les mêmes jours');

  // Désactivée, l'alerte reste dans la liste mais n'est plus évaluée.
  await ligne.getByRole('button', { name: 'Désactiver' }).click();
  await expect(encart.locator('.water-notice')).toHaveText('L’alerte météo est désactivée : elle n’est plus évaluée.');
  await expect(ligne).toContainText('Inactive : elle n’est pas évaluée');
  await verifierLEtape(page, journal, 'alerte désactivée');

  // Le lien de l'historique ouvre la page des alertes météo sur la semaine du jour visé, comme le clic sur la notification (P32).
  const lien = alertes.first().getByRole('link', { name: 'Voir la semaine' });
  const adresse = await lien.getAttribute('href');
  expect(adresse).toMatch(/^\/irrigation\/alertes-meteo\?season=\d{4}&week=\d{4}-\d{2}-\d{2}$/);
  const [, saison, semaine] = adresse!.match(/season=(\d{4})&week=(\d{4}-\d{2}-\d{2})/)!;
  await lien.click();
  await expect(page).toHaveURL(new RegExp(`/irrigation/alertes-meteo\\?season=${saison}&week=${semaine}$`));
  await attendreLaPagePrete(page, 'alertes-meteo');
  await verifierLEtape(page, journal, 'semaine du jour visé ouverte');

  // Une notification reçue avant la 3.8 garde son adresse : elle conduit à la page qui porte le tableau des jours, avec la même semaine (P14, P21).
  await page.goto(`/irrigation?season=${saison}&week=${semaine}#weather`);
  await expect(page).toHaveURL(new RegExp(`/irrigation/besoins\\?season=${saison}&week=${semaine}#weather$`));
  await expect(page.locator('#weather')).toBeInViewport({ timeout: 15_000 });
  await expect(page.locator('#weather thead')).toContainText('Températures prévues');
  await verifierLEtape(page, journal, 'ancienne adresse de la semaine conduite');

  // Supprimée, l'alerte quitte la liste ; ses alertes restent dans l'historique.
  await attendreLaPageIrrigation(page, 'alertes-meteo');
  const encartRouvert = page.locator('#weather-alerts');
  await encartRouvert.scrollIntoViewIfNeeded();
  const ligneRouverte = critere(encartRouvert, libelle);
  await expect(ligneRouverte).toContainText('Inactive : elle n’est pas évaluée');
  const confirmer = ligneRouverte.getByRole('button', { name: 'Confirmer la suppression' });
  await ouvrirParClic(ligneRouverte.getByRole('button', { name: 'Supprimer' }), confirmer);
  await confirmer.click();
  await expect(encartRouvert.locator('.water-notice')).toHaveText('L’alerte météo a été supprimée. Ses alertes passées restent dans l’historique.');
  await expect(critere(encartRouvert, libelle)).toHaveCount(0);
  await expect(historique(encartRouvert, libelle)).toHaveCount(joursVises);
  await verifierLEtape(page, journal, 'alerte supprimée, historique conservé');
});

function critere(encart: Locator, libelle: string): Locator {
  return encart.locator('li.weather-alert-criterion').filter({ hasText: libelle });
}

function historique(encart: Locator, libelle: string): Locator {
  return encart.locator('ol.weather-alert-history > li').filter({ hasText: libelle });
}

/** « Actualiser la météo » se rouvre seul après la pause entre deux demandes ; le message dit la fin. */
async function actualiserLaMeteo(page: Page): Promise<void> {
  const meteo = page.locator('.water-management-section .water-panel').filter({ hasText: 'Météo de référence' });
  await meteo.scrollIntoViewIfNeeded();
  const bouton = meteo.getByRole('button', { name: 'Actualiser la météo' });
  await expect(bouton).toBeEnabled(PAUSE_D_ACTUALISATION);
  await bouton.click();
  // Pendant l'actualisation le bouton dit « Actualisation… » ; il revient fermé pour la pause qui suit : la réponse est là.
  await expect(bouton).toBeDisabled({ timeout: 30_000 });
  await expect(page.locator('.water-management-section > .water-notice')).toHaveText(/La météo a été actualisée\.|Actualisation météo incomplète/);
}
