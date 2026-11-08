import { expect, test, type Locator, type Page } from '@playwright/test';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P21 : les alertes cultures (docs/weather-crop-alerts-contract.md,
 * « L'écran » et « Découpage et preuve de fin », 5 quinquies, PR 3).
 *
 * La ferme de démonstration a des carottes en place sous le verger. Le
 * parcours les rattache à la carotte du jeu commun avec un seuil de dégâts
 * propre à la ferme : un seuil non numérique est refusé avec son message,
 * puis 8 °C est enregistré — 8 °C de dégâts et 3 °C de marge, l'alerte à
 * 11 °C. Il pousse le curseur de microclimat à +2 °C : l'alerte passe à
 * 13 °C, au-dessus de toutes les minimales de la prévision de démonstration
 * (de 2,6 à 11,3 °C). Il actualise la météo : l'évaluation suit l'écriture
 * des prévisions, l'historique montre l'alerte de gel des carottes, et les
 * prochaines échéances la disent déjà annoncée. Les parcours n'ont pas de
 * service de notification : l'envoi est enregistré « Échec du service de
 * notification ». L'historique est replié : la flèche le déplie
 * (précision P45). Il donne enfin aux carottes un délai de séchage de
 * 10 jours, qui fait paraître leur date d'arrêt d'arrosage à venir, remet
 * le curseur à 0, puis règle la marge des cultures sensibles à 4 °C
 * (l'alerte passe à 12 °C) et la remet à 3 °C (précision P44).
 *
 * Les deux largeurs passent sur la même ferme : un rattachement est une
 * révision nouvelle, qui remet à zéro les jours déjà alertés ; les
 * vérifications portent sur ce que le geste vient d'enregistrer.
 *
 * Ce qu'il ne prouve pas : la notification reçue sur un téléphone verrouillé,
 * les aspersions (aucune n'est proposée sous abri dans la ferme de
 * démonstration) ; elles restent prouvées par les tests du domaine et la
 * recette réelle sur la ferme.
 */

/** Une actualisation, après la pause de 30 s entre deux demandes. */
const DUREE_DU_PARCOURS = 150_000;
const PAUSE_D_ACTUALISATION = { timeout: 45_000 };

test('les carottes se rattachent au jeu commun, le curseur de microclimat décale leur seuil, le gel prévu est alerté une fois et le délai de séchage se règle, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  // Les alertes cultures ont leur page (3.8).
  await attendreLaPageIrrigation(page, 'alertes-cultures');
  const encart = page.locator('#crop-alerts');
  await encart.scrollIntoViewIfNeeded();
  await expect(encart.getByRole('heading', { name: 'Alertes cultures', exact: true })).toBeVisible();
  await expect(encart).toContainText('la prévision est celle de l’air à 2 m, à l’extérieur');
  const statut = encart.locator('.water-notice');

  // Les deux plis des seuils ouverts : les carottes sont dans l'un ou dans l'autre selon le passage précédent.
  const sansSeuil = pli(encart, 'Cultures sans seuil de gel');
  const avecSeuil = pli(encart, 'Seuils de gel des cultures');
  await ouvrirParClic(sansSeuil.locator('summary'), sansSeuil.locator('summary + *'));
  await avecSeuil.locator('summary').click();
  await expect(avecSeuil.locator('summary + *')).toBeVisible();
  if (testInfo.project.name === 'telephone') await verifierCibleTactile(avecSeuil.locator('summary'), 'le pli « Seuils de gel des cultures »');
  const carottes = sansSeuil.or(avecSeuil).locator('li.crop-alert-row').filter({ hasText: /^Carotte/ });
  await expect(carottes).toHaveCount(1);
  // Les plis s'ouvrent sans React ; ce bouton est le premier geste qui l'attend.
  const formulaire = carottes.getByRole('form', { name: 'Seuil de gel · Carotte' });
  await ouvrirParClic(carottes.getByRole('button', { name: /^(Rattacher|Corriger)$/ }), formulaire);
  await verifierLEtape(page, journal, 'formulaire du seuil des carottes ouvert');

  // Un seuil non numérique est refusé avec le message du domaine.
  await formulaire.getByLabel('Culture du jeu commun').selectOption('carotte');
  await formulaire.getByLabel('Seuil de dégâts de la ferme, en °C').fill('huit');
  await formulaire.getByRole('button', { name: 'Enregistrer le seuil' }).click();
  await expect(encart.locator('.water-error')).toHaveText('Le seuil de dégâts va de -30 à +10 °C, par pas de 0,5 °C.');
  await verifierLEtape(page, journal, 'seuil non numérique refusé');

  await formulaire.getByLabel('Seuil de dégâts de la ferme, en °C').fill('8');
  const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer le seuil' });
  if (testInfo.project.name === 'telephone') await verifierCibleTactile(enregistrer, 'le bouton « Enregistrer le seuil »');
  await enregistrer.click();
  await expect(statut).toHaveText('Le seuil de gel de la culture a été enregistré. Ses jours déjà alertés repartent de zéro.');
  const ligne = avecSeuil.locator('li.crop-alert-row').filter({ hasText: /^Carotte/ });
  await expect(ligne).toContainText('Dégâts à 8 °C, marge 3 °C');
  await expect(ligne).toContainText('Seuil de la ferme · Carotte (jeu commun : -6 °C), confiance');
  await verifierLEtape(page, journal, 'seuil des carottes enregistré');

  // Le curseur de microclimat décale le seuil d'alerte, pas les dégâts ni la marge.
  await reglerLeMicroclimat(encart, '2', '+2 °C');
  await expect(ligne.locator('strong')).toHaveText('Carotte · alerte à 13 °C');
  await expect(ligne).toContainText('Dégâts à 8 °C, marge 3 °C, microclimat +2 °C');
  await verifierLEtape(page, journal, 'microclimat à +2 °C');

  // L'évaluation suit l'écriture des prévisions : une alerte de gel par jour visé, enregistrée une fois.
  // La météo s'actualise sur la page des besoins ; l'historique se relit sur celle des alertes cultures.
  await attendreLaPageIrrigation(page, 'besoins');
  await actualiserLaMeteo(page);
  await attendreLaPageIrrigation(page, 'alertes-cultures');
  // L'historique est replié (précision P45) : la flèche le déplie.
  const envoyees = pli(encart, 'Alertes cultures envoyées');
  await expect(envoyees.locator('ol.weather-alert-history')).toBeHidden();
  await envoyees.locator('summary').click();
  const gel = envoyees.locator('ol.weather-alert-history > li').filter({ hasText: 'Gel · Carotte' });
  await expect(gel.first()).toContainText('alerte à 13 °C (dégâts 8 °C, marge 3 °C, microclimat +2 °C)');
  await expect(gel.first()).toContainText('Échec du service de notification');
  await expect(gel.first()).toContainText('Carotte (1 culture présente)');
  const prevu = encart.getByRole('list', { name: 'Gel prévu' });
  await expect(prevu).toContainText('Carotte (alerte à 13 °C, déjà annoncée)');
  await verifierLEtape(page, journal, 'gel des carottes alerté et déjà annoncé');

  // Le délai de séchage : la date d'arrêt d'arrosage des carottes paraît dans les échéances.
  const sechage = pli(encart, 'Arrêt d’arrosage avant récolte');
  await sechage.locator('summary').click();
  const ligneSechage = sechage.locator('li.crop-alert-row').filter({ hasText: /^Carotte/ });
  if (await ligneSechage.count() === 0) {
    const ajout = sechage.getByRole('form', { name: 'Ajouter un délai de séchage' });
    await ajout.getByLabel('Culture').selectOption({ label: 'Carotte' });
    await ajout.getByLabel('Délai, en jours').fill('10');
    await ajout.getByRole('button', { name: 'Ajouter le délai' }).click();
  } else {
    await ligneSechage.getByRole('button', { name: 'Corriger' }).click();
    const correction = ligneSechage.getByRole('form', { name: 'Délai de séchage · Carotte' });
    await correction.getByLabel('Délai, en jours (vide : aucun)').fill('10');
    await correction.getByRole('button', { name: 'Enregistrer le délai' }).click();
  }
  await expect(statut).toHaveText('Le délai de séchage de la culture a été enregistré.');
  await expect(ligneSechage.locator('strong')).toHaveText('Carotte · 10 jours avant la récolte');
  await expect(encart.getByRole('list', { name: 'Arrêts d’arrosage à venir' })).toContainText(/Carotte · planche V01\s*Arrêt le .+, 10 jours avant la récolte attendue/);
  await verifierLEtape(page, journal, 'délai de séchage des carottes enregistré');

  // Le curseur revient à 0 pour les parcours suivants.
  await reglerLeMicroclimat(encart, '0', '0 °C');
  await expect(ligne.locator('strong')).toHaveText('Carotte · alerte à 11 °C');
  await verifierLEtape(page, journal, 'microclimat remis à 0');

  // La marge d'une culture sensible se règle (précision P44) : à 4 °C, l'alerte des carottes passe à 12 °C ; remise à 3 °C.
  await reglerLaMarge(encart, '4', '4 °C');
  await expect(ligne.locator('strong')).toHaveText('Carotte · alerte à 12 °C');
  await expect(ligne).toContainText('Dégâts à 8 °C, marge 4 °C');
  await reglerLaMarge(encart, '3', '3 °C');
  await expect(ligne.locator('strong')).toHaveText('Carotte · alerte à 11 °C');
  await verifierLEtape(page, journal, 'marge des cultures sensibles réglée puis remise à 3 °C');
});

function pli(encart: Locator, titre: string): Locator {
  return encart.locator('details.crop-alert-fold').filter({ has: encart.page().locator('summary strong', { hasText: titre }) });
}

async function reglerLeMicroclimat(encart: Locator, valeur: string, affiche: string): Promise<void> {
  const reglages = pli(encart, 'Réglages');
  const formulaire = reglages.getByRole('form', { name: 'Réglages des alertes cultures' });
  if (!(await formulaire.isVisible())) await reglages.locator('summary').click();
  const curseur = formulaire.getByRole('slider');
  await curseur.fill(valeur);
  await expect(formulaire).toContainText(`Microclimat : décalage des seuils de gel, ${affiche}`);
  await formulaire.getByRole('button', { name: 'Enregistrer les réglages' }).click();
  await expect(encart.locator('.water-notice')).toHaveText('Les réglages des alertes cultures ont été enregistrés. Ils valent dès la prochaine prévision lue.');
  await expect(reglages.locator('summary small')).toContainText(`microclimat ${affiche}`);
}

async function reglerLaMarge(encart: Locator, valeur: string, affiche: string): Promise<void> {
  const reglages = pli(encart, 'Réglages');
  const formulaire = reglages.getByRole('form', { name: 'Réglages des alertes cultures' });
  if (!(await formulaire.isVisible())) await reglages.locator('summary').click();
  await formulaire.getByLabel('Culture sensible (dégâts à −2 °C ou au-dessus), en °C').fill(valeur);
  await formulaire.getByRole('button', { name: 'Enregistrer les réglages' }).click();
  await expect(encart.locator('.water-notice')).toHaveText('Les réglages des alertes cultures ont été enregistrés. Ils valent dès la prochaine prévision lue.');
  await expect(reglages.locator('summary small')).toContainText(`marges ${affiche} et 2 °C`);
}

/** « Actualiser la météo » se rouvre seul après la pause entre deux demandes ; le message dit la fin. */
async function actualiserLaMeteo(page: Page): Promise<void> {
  const meteo = page.locator('.water-management-section .water-panel').filter({ hasText: 'Météo de référence' });
  await meteo.scrollIntoViewIfNeeded();
  const bouton = meteo.getByRole('button', { name: 'Actualiser la météo' });
  await expect(bouton).toBeEnabled(PAUSE_D_ACTUALISATION);
  await bouton.click();
  await expect(bouton).toBeDisabled({ timeout: 30_000 });
  await expect(page.locator('.water-management-section > .water-notice')).toHaveText(/La météo a été actualisée\.|Actualisation météo incomplète/);
}
