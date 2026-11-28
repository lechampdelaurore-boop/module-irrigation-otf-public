import { expect, test } from '@playwright/test';

/**
 * Parcours V13 : la démonstration dit le temps de son serveur (accélérer le
 * site, A1, D-358 ; docs/acceleration-du-site-contract.md, section 3). Son
 * point d'entrée (`demo-worker.ts`) passe par le même chronomètre que la
 * production : « Aujourd'hui » de la « Ferme des Trois Noues », au début de
 * l'été, porte l'en-tête `Server-Timing`, et la page lit la base. Une seule
 * largeur ; rien n'est enregistré par le parcours.
 */

const ADRESSE_DE_LA_DEMO = 'http://127.0.0.1:3200';
const EN_TETE = /^app;dur=\d+, d1;dur=\d+;desc="(\d+) appels?", otf;dur=\d+;desc="\d+ appels?", meteo;dur=\d+;desc="\d+ appels?", autres;dur=\d+;desc="\d+ appels?", instance;desc="(neuve|chaude)"$/;

test('V13 La démonstration dit le temps de son serveur', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'telephone', 'un en-tête du serveur ne dépend pas de la largeur de l’écran');
  await page.context().addCookies([
    { name: 'demo-profil', value: 'maraichage', url: ADRESSE_DE_LA_DEMO },
    { name: 'demo-moment', value: 'ete', url: ADRESSE_DE_LA_DEMO },
  ]);
  const reponse = await page.goto('/irrigation/aujourdhui');
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  const enTete = reponse?.headers()['server-timing'] ?? '';
  expect(enTete).toMatch(EN_TETE);
  expect(Number(EN_TETE.exec(enTete)?.[1]), 'la page lit la base de la démonstration').toBeGreaterThan(0);
});
