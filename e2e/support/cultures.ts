import { expect, type Locator } from '@playwright/test';

/**
 * La carte d'une culture de référence sur « Besoin par culture », montrée :
 * une culture que la saison ne cultive pas est dans le pli « Les autres
 * cultures de référence », que l'on ouvre d'abord (audit ergonomique final,
 * lot D, J5, F302).
 */
export async function carteDeCulture(section: Locator, culture: string): Promise<Locator> {
  const nom = section.page().locator('summary strong', { hasText: new RegExp(`^${culture}$`) });
  const carte = section.locator('details.reference-crop-card').filter({ has: nom });
  await expect(carte).toHaveCount(1);
  const autres = section.locator('details.reference-crop-others');
  if (await autres.locator('details.reference-crop-card').filter({ has: nom }).count() > 0
    && !(await autres.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await autres.locator(':scope > summary').click();
  }
  await expect(carte).toBeVisible();
  return carte;
}
