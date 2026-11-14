import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P35 : l'audit ergonomique final, lot C, gestes sûrs
 * (docs/audit-ergonomie-final-lot-c-contract.md ; docs/browser-journeys-contract.md).
 *
 * Sur la ferme de démonstration, sans rien écrire :
 *
 * - « Pluie mesurée » : « Retirer la mesure », qui efface, est dessiné en
 *   contour rouge sur fond blanc, jamais du vert plein d'« Enregistrer », et
 *   s'en écarte de 24 px au moins (R6, cas 1, F236).
 *
 * Le planning (R6, cas 2 et 3) se vérifie dans P10, qui seul a des
 * propositions à l'écran.
 *
 * Ce qu'il ne prouve pas : un vrai téléphone, le mode sombre (absent), un
 * lecteur d'écran.
 */

const ECART_DES_GESTES_PX = 24;

test('« Retirer la mesure » se distingue d’« Enregistrer » et s’en écarte', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await attendreLaPageIrrigation(page, 'besoins');
  const pluie = page.locator('#manual-rain');
  await pluie.scrollIntoViewIfNeeded();
  const enregistrer = pluie.getByRole('button', { name: 'Enregistrer', exact: true });
  const retirer = pluie.getByRole('button', { name: 'Retirer la mesure' });
  await expect(enregistrer).toHaveCSS('background-color', 'rgb(11, 105, 77)');
  await expect(retirer).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(retirer).toHaveCSS('color', 'rgb(143, 29, 42)');
  await expect(retirer).toHaveCSS('border-top-color', 'rgb(220, 53, 69)');
  if (telephone) await verifierCibleTactile(retirer, '« Retirer la mesure »');
  const [a, b] = await Promise.all([enregistrer.boundingBox(), retirer.boundingBox()]);
  const ecart = telephone ? b!.y - (a!.y + a!.height) : b!.x - (a!.x + a!.width);
  expect(Math.round(ecart), '« Retirer la mesure » écarté d’« Enregistrer »').toBeGreaterThanOrEqual(ECART_DES_GESTES_PX);
  await verifierLEtape(page, journal, '« Retirer la mesure » en contour rouge, écarté');
});
