import { defineConfig, devices } from '@playwright/test';

/**
 * Parcours navigateur automatisés (docs/browser-journeys-contract.md).
 *
 * Le serveur est démarré par Playwright lui-même, après remise à zéro de la
 * base locale, avec les trois réglages qui ferment les sources de hasard :
 * données Ouvre ta ferme de démonstration, utilisateur de démonstration, météo
 * déterministe. Aucun appel ne part vers un service extérieur.
 */
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;
// La page d'irrigation, et non la racine : la racine redirige, et une
// redirection vers la connexion Access signalerait un mode mal configuré.
const READY_URL = `${BASE_URL}/irrigation`;

export default defineConfig({
  testDir: './e2e',
  // Un parcours attend une condition, jamais une durée : ces délais ne sont que
  // des garde-fous contre un blocage, pas un rythme d'exécution.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Les parcours écrivent dans une base unique : ils se suivent, sans recouvrement.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    // Conservés en cas d'échec seulement : un échec doit se comprendre sans être reproduit.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'telephone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: false } },
  ],
  webServer: {
    command: 'node scripts/reset-local-database.mjs && node node_modules/vinext/dist/cli.js dev --host 127.0.0.1 --port ' + PORT,
    url: READY_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    // Les réglages de démonstration ne se posent pas ici : le runtime
    // Cloudflare ne lit pas l'environnement du processus Node qui le lance,
    // mais le fichier `.dev.vars`, que le script de remise à zéro prépare et
    // vérifie avant de démarrer quoi que ce soit.
  },
});
