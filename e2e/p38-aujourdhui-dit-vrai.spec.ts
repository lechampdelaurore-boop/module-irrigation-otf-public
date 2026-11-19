import { expect, test, type Page } from '@playwright/test';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P38 : l'audit ergonomique du 19 novembre 2026, lot H,
 * « Aujourd'hui dit vrai » (docs/audit-ergonomie-2026-11-19-lot-h-contract.md ;
 * docs/browser-journeys-contract.md).
 *
 * Sur la ferme de démonstration, sans rien laisser derrière lui :
 *
 * - la pluie dit d'où elle vient (n° 3, F429) : la tuile « Eau reçue » et la
 *   légende d'« Eau de la semaine » nomment les mêmes origines, et
 *   « mesurée » n'est écrit que pour une pluie du pluviomètre ; une pluie
 *   du jour mesurée sur « Objectifs et besoins » se lit « mesurés » sur
 *   « Aujourd'hui », puis est retirée.
 *
 * Ce qu'il ne prouve pas : les parts de chaque origine (les tests du
 * domaine, `tests/audit-ergonomie-2026-11-19-lot-h.test.ts`, les chiffrent),
 * la ferme réelle, un vrai téléphone.
 */

const ORIGINES = [
  { legende: 'mesurée', tuile: /mesuré/ },
  { legende: 'estimée', tuile: /estimé(e|s) après coup/ },
  { legende: 'prévue', tuile: /prévue?s?/ },
] as const;

async function lireLaPluie(page: Page): Promise<{ tuile: string; legende: string }> {
  const tuile = page.locator('.today-kpi').filter({ hasText: 'Eau reçue' }).locator('.today-kpi-detail');
  const legende = page.locator('#today-week-water .today-legend span').filter({ has: page.locator('i[data-tone="rain"]') });
  await expect(legende).toHaveCount(1);
  return { tuile: (await tuile.textContent()) ?? '', legende: (await legende.textContent()) ?? '' };
}

/** La tuile et la légende nomment les mêmes origines ; jamais « mesurée » sans le pluviomètre. */
function verifierLesOrigines({ tuile, legende }: { tuile: string; legende: string }): void {
  expect(legende).toMatch(/^Pluie( |$)/);
  if (/\binconnue\b/.test(tuile) || /sous abri/.test(tuile)) return;
  for (const origine of ORIGINES) {
    expect(origine.tuile.test(tuile), `« ${tuile} » et la légende « ${legende} » pour « ${origine.legende} »`).toBe(legende.includes(origine.legende));
  }
}

test('la pluie dit d’où elle vient, sur la tuile et sur la légende', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'aujourdhui');
  verifierLesOrigines(await lireLaPluie(page));
  await verifierLEtape(page, journal, 'la pluie et son origine');

  // Une pluie du jour mesurée au pluviomètre, si la démonstration n'en a pas déjà une.
  await attendreLaPageIrrigation(page, 'besoins');
  const pluie = page.locator('#manual-rain');
  await pluie.scrollIntoViewIfNeeded();
  const millimetres = pluie.getByLabel('Millimètres');
  const avant = await millimetres.inputValue();
  // Une mesure nulle (P12 laisse « 0 » pour aujourd'hui) ne nomme aucune origine : 4 mm posés, la valeur trouvée rendue ensuite.
  const aPoser = avant === '' || Number(avant.replace(',', '.')) === 0;
  if (aPoser) {
    await millimetres.fill('4');
    await pluie.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(pluie.locator('.action-reply .water-notice')).toHaveText('La pluie mesurée a été enregistrée.');
  }
  await attendreLaPageIrrigation(page, 'aujourdhui');
  const mesuree = await lireLaPluie(page);
  verifierLesOrigines(mesuree);
  expect(mesuree.legende).toContain('mesurée');
  await verifierLEtape(page, journal, 'la pluie mesurée dite mesurée');

  if (aPoser) {
    await attendreLaPageIrrigation(page, 'besoins');
    await pluie.scrollIntoViewIfNeeded();
    if (avant === '') {
      await pluie.getByRole('button', { name: 'Retirer la mesure' }).click();
      await expect(pluie.locator('.action-reply .water-notice')).toContainText('retirée');
    } else {
      await millimetres.fill(avant);
      await pluie.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      await expect(pluie.locator('.action-reply .water-notice')).toHaveText('La pluie mesurée a été enregistrée.');
    }
    await expect(millimetres).toHaveValue(avant);
  }
});
