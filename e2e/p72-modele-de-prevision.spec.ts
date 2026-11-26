import { expect, test, type Locator, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { attendreLaPagePrete, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P72 : choisir le modèle de prévision de la ferme (météo
 * multi-modèles, PR 3 ; docs/weather-models-contract.md, § 3 règles 1, 3, 6,
 * 8, 10 et 12, § 8 point 6, § 11 point 5 ; D-347 ;
 * docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, toutes cases cochées, sa commune choisie (le siège,
 * Rennes pour la météo des parcours) : dans « Réglages », la carte « Lieu de
 * la météo » porte le pli « Modèle de prévision », ouvert par son ancre, sur
 * « Automatique », le bouton
 * inactif tant que rien ne change, et la phrase « Les alertes météo et les
 * prévisions de la ferme utiliseront ce modèle. ». Météo-France choisi, les
 * faits du modèle (fournisseur, portée, complément par « Automatique
 * d'Open-Meteo ») ; enregistré, la réponse dit le dernier jour du modèle ;
 * la page rechargée le relit et dit jusqu'à quel jour les prévisions gardées
 * viennent du modèle.
 * Retour à « Automatique », l'état du départ. Au téléphone (390 px) et à
 * l'ordinateur (1 440 px).
 *
 * La lecture des parcours est la réponse fixe par modèle (F1022), sans
 * réseau. Une lecture de la ferme faite moins de 30 s avant refuse le geste
 * (« réessayez dans un instant »), le délai du contrat météo : le parcours
 * attend ce délai avant chaque enregistrement.
 *
 * Ce qu'il ne prouve pas : la lecture d'Open-Meteo depuis le Worker (essai
 * B, en ligne) ; le crédit des prévisions d'un modèle (la météo des
 * parcours se dit « de démonstration »), tenu par
 * tests/weather-models-reglage.test.ts ; l'absence du réglage en démonstration, tenue par
 * tests/db/forecast-model-reglage.test.ts ; le retour du module à
 * « Automatique » (règle 9), tenu par tests/weather-models-ecran.test.ts et
 * tests/db/forecast-model-reglage.test.ts ; les règles de l'enregistrement,
 * tenues par tests/weather-models-reglage.test.ts et
 * tests/db/forecast-model-reglage.test.ts.
 */

const DUREE_DU_PARCOURS = 300_000;
const LARGEUR_ORDINATEUR_PX = 1440;
const HAUTEUR_ORDINATEUR_PX = 900;
const DELAI_ENTRE_DEUX_LECTURES_MS = 31_000;
const METEO_FRANCE = 'Météo-France (AROME puis ARPEGE)';

/**
 * Enregistre le choix, une fois passé le délai entre deux lectures de la
 * ferme (la page ouverte peut avoir lu la météo) : la réponse est celle du
 * geste, jamais « réessayez dans un instant ».
 */
async function enregistrer(page: Page, reglage: Locator, attendu: RegExp): Promise<void> {
  await page.waitForTimeout(DELAI_ENTRE_DEUX_LECTURES_MS);
  await reglage.getByRole('button', { name: 'Enregistrer le modèle' }).click();
  await expect(page.locator('.action-reply[data-origin="modele"]')).toHaveText(attendu);
}

test('« Modèle de prévision » : Automatique par défaut, Météo-France vérifié et gardé, retour à Automatique', async ({ page, context }, testInfo) => {
  test.setTimeout(DUREE_DU_PARCOURS);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  if (!telephone) await page.setViewportSize({ width: LARGEUR_ORDINATEUR_PX, height: HAUTEUR_ORDINATEUR_PX });
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'modele-de-prevision');
  await preparerLaFermeNeuve(page);

  await page.goto('/irrigation/reglages#modele-de-prevision');
  await attendreLaPagePrete(page, 'reglages');
  // Un pli fermé de « Réglages » (P40), que son ancre ouvre ; sa ligne dit le modèle gardé.
  await expect(page.locator('#modele-de-prevision > summary')).toContainText('Automatique');
  const reglage = page.getByRole('group', { name: 'Modèle de prévision' });
  await reglage.scrollIntoViewIfNeeded();
  await expect(reglage).toContainText('Les alertes météo et les prévisions de la ferme utiliseront ce modèle.');
  const liste = reglage.getByRole('combobox', { name: 'Modèle' });
  await expect(liste.locator('option:checked')).toHaveText('Automatique');
  // La liste vient du code, filtrée par le lieu : Rennes est couverte par Météo-France.
  await expect(liste.locator('option', { hasText: METEO_FRANCE })).toHaveCount(1);
  await expect(reglage.getByRole('button', { name: 'Enregistrer le modèle' })).toBeDisabled();
  await expect(reglage).toContainText('Le module lit la prévision comme il l’a toujours fait.');
  if (telephone) {
    await verifierCibleTactile(liste, 'La liste des modèles');
    await verifierCibleTactile(reglage.getByRole('button', { name: 'Enregistrer le modèle' }), 'Le bouton « Enregistrer le modèle »');
  }
  await verifierLEtape(page, journal, 'Automatique par défaut');

  await liste.selectOption({ label: METEO_FRANCE });
  await expect(reglage).toContainText(/Météo-France · AROME.*prévoit environ 4 jours, au-delà les jours viennent d’« Automatique d’Open-Meteo »\./);
  await enregistrer(page, reglage, /^La ferme lit désormais « Météo-France \(AROME puis ARPEGE\) » : ses prévisions à venir sont relues, les jours passés gardent les leurs\. Après le .+, les jours viennent d’« Automatique d’Open-Meteo »\.$/);
  await verifierLEtape(page, journal, 'Météo-France enregistré');

  await page.goto('/irrigation/reglages#modele-de-prevision');
  await attendreLaPagePrete(page, 'reglages');
  const relu = page.getByRole('group', { name: 'Modèle de prévision' }).getByRole('combobox', { name: 'Modèle' });
  await expect(relu.locator('option:checked')).toHaveText(METEO_FRANCE);
  await expect(page.locator('#modele-de-prevision > summary')).toContainText(METEO_FRANCE);
  // Règle 6 : la carte dit le dernier jour du modèle parmi les prévisions gardées.
  await expect(page.getByRole('group', { name: 'Modèle de prévision' })).toContainText(/Prévisions gardées : ce modèle jusqu’au .+, puis « Automatique d’Open-Meteo »\./);
  await verifierLEtape(page, journal, 'Météo-France relu');

  // Retour à l'état du départ.
  const reglageRelu = page.getByRole('group', { name: 'Modèle de prévision' });
  await relu.selectOption({ label: 'Automatique' });
  await enregistrer(page, reglageRelu, /^La ferme lit de nouveau « Automatique » : ses prévisions à venir (sont relues|seront relues)/);
  await expect(reglageRelu.getByRole('combobox', { name: 'Modèle' }).locator('option:checked')).toHaveText('Automatique');
  await verifierLEtape(page, journal, 'retour à Automatique');
});
