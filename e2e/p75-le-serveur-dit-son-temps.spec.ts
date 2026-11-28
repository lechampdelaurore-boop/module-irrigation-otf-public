import { expect, test, type Page, type Response } from '@playwright/test';
import { allerALaPage, attendreLaPagePrete, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P75 : le serveur dit son temps (accélérer le site, A1, D-358 ;
 * docs/acceleration-du-site-contract.md, section 3 ; docs/browser-journeys-contract.md).
 *
 * « Aujourd'hui », ouverte, puis « Semaine », atteinte par le menu sans
 * recharger le module : la page et le changement de page portent l'en-tête
 * `Server-Timing` (le temps du serveur, les appels à la base, à Ouvre ta
 * ferme, à la météo et aux autres services, l'état de l'instance), que le
 * navigateur lit lui-même ; aucune adresse n'y figure. Une seule largeur : un
 * en-tête du serveur ne dépend pas de l'écran. Rien n'est enregistré.
 */

const ENTREES = ['app', 'd1', 'otf', 'meteo', 'autres', 'instance'];
const EN_TETE = /^app;dur=\d+, d1;dur=\d+;desc="\d+ appels?", otf;dur=\d+;desc="\d+ appels?", meteo;dur=\d+;desc="\d+ appels?", autres;dur=\d+;desc="\d+ appels?", instance;desc="(neuve|chaude)"$/;

function appelsALaBase(header: string): number {
  return Number(/d1;dur=\d+;desc="(\d+) appels?"/.exec(header)?.[1] ?? Number.NaN);
}

/** Le changement de page demandé au serveur : la page de « Semaine », par le routeur. */
function changementDePage(page: Page): Promise<Response> {
  return page.waitForResponse((response) => new URL(response.url()).pathname.startsWith('/irrigation/semaine') && response.request().resourceType() === 'fetch');
}

test('la page et le changement de page disent le temps du serveur, sans aucune adresse', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'telephone', 'un en-tête du serveur ne dépend pas de la largeur de l’écran');
  const journal = surveillerLaConsole(page);

  const ouverture = await page.goto('/irrigation/aujourdhui');
  await attendreLaPagePrete(page, 'aujourdhui');
  const enTete = ouverture?.headers()['server-timing'] ?? '';
  expect(enTete).toMatch(EN_TETE);
  expect(appelsALaBase(enTete), 'la page lit la base').toBeGreaterThan(0);
  // Le navigateur lit l'en-tête lui-même, comme dans ses outils de développement.
  const lues = await page.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).serverTiming.map((entry) => entry.name));
  expect(lues).toEqual(ENTREES);
  await verifierLEtape(page, journal, 'Aujourd’hui ouverte');

  const attendu = changementDePage(page);
  await allerALaPage(page, 'semaine');
  const changement = await attendu;
  const enTeteDuChangement = changement.headers()['server-timing'] ?? '';
  expect(enTeteDuChangement).toMatch(EN_TETE);
  expect(enTeteDuChangement, 'aucune adresse ni aucun chemin dans l’en-tête').not.toMatch(/irrigation|http|\//);
  expect(appelsALaBase(enTeteDuChangement)).toBeGreaterThan(0);
  await verifierLEtape(page, journal, 'Semaine par le menu');
});
