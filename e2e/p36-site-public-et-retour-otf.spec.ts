import { expect, test, type Page } from '@playwright/test';
import { PAGE_PATHS, SITE_URL } from '../cloudflare/irrigation-site/src/addresses.ts';
import { handleSiteRequest } from '../cloudflare/irrigation-site/src/index.ts';

/**
 * P36 · Le site public et l'adresse de retour d'Ouvre ta ferme (sous-tranche
 * 4.8, D-153), aux deux largeurs des projets. Le site public est un Worker à
 * part : ses réponses sont produites ici par son propre code, l'adresse
 * réelle interceptée, sans aucun appel réseau.
 */

async function serveSite(page: Page) {
  await page.route(`${SITE_URL}/**`, async (route) => {
    const request = route.request();
    const response = handleSiteRequest(new Request(request.url(), { method: request.method() }), {});
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
    });
  });
}

test('P36a · les trois pages publiques se lisent sans défiler de côté, avec des liens de 44 px', async ({ page }) => {
  await serveSite(page);
  for (const path of Object.values(PAGE_PATHS)) {
    await page.goto(`${SITE_URL}${path}`);
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} ne déborde pas`).toBeLessThanOrEqual(0);
    const nav = page.getByRole('navigation', { name: 'Pages du site' }).getByRole('link');
    await expect(nav).toHaveCount(3);
    for (const link of await nav.all()) {
      const box = await link.boundingBox();
      expect(box?.height ?? 0, `${path} : lien du menu`).toBeGreaterThanOrEqual(44);
    }
  }
  const menu = page.getByRole('navigation', { name: 'Pages du site' });
  await menu.getByRole('link', { name: 'Confidentialité', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Confidentialité', exact: true })).toHaveAttribute('aria-current', 'page');
});

test("P36b · l'adresse de retour d'Ouvre ta ferme dit que la connexion n'est pas ouverte, sans répéter le code", async ({ page }) => {
  const response = await page.goto('/api/otf/oauth/retour?code=CODE-A-NE-PAS-AFFICHER&state=etat-test');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control']).toBe('no-store');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("La connexion à Ouvre ta ferme n'est pas encore ouverte");
  await expect(page.locator('body')).not.toContainText('CODE-A-NE-PAS-AFFICHER');
  await page.getByRole('link', { name: 'Revenir au module' }).click();
  await expect(page).toHaveURL(/\/irrigation/);
});
