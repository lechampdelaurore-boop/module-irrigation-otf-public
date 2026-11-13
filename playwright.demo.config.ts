import { defineConfig, devices } from '@playwright/test';

/**
 * Parcours navigateur de la démonstration (docs/demo-guided-contract.md,
 * D3) : les visites guidées jouées pour de vrai, une par visite, aux deux
 * largeurs. Le serveur est la même application démarrée comme le Worker de
 * démonstration (scripts/demo-e2e-server.mjs), sur une configuration locale
 * écrite à part : `wrangler.jsonc` n'est jamais touché. Sa base locale est
 * celle des parcours ordinaires, remise à zéro avant : les deux suites se
 * suivent (`pnpm e2e` puis `pnpm e2e:demo`), jamais en même temps.
 */
const PORT = 3200;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e-demo',
  outputDir: 'test-results-demo',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-demo' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
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
    command: `node scripts/demo-e2e-server.mjs ${PORT}`,
    url: `${BASE_URL}/irrigation`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
