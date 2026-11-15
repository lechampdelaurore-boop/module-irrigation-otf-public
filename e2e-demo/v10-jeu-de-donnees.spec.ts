import { expect, test } from '@playwright/test';
import { ecarterLInvitation, ouvrirLaDemo } from './support/visite.ts';

/**
 * Parcours V10 : le jeu de données complété (docs/audit-ergonomie-final-lot-f-contract.md,
 * section 5, cas 7). La ferme « matériel et alertes » a posé d'avance le
 * modèle « Gel : moins de 3 °C » : au printemps, la nuit de gel déclenche son
 * alerte sur « Aujourd'hui », qui ne dit plus qu'aucune alerte de gel n'est
 * posée, et « Alertes météo » montre l'alerte posée, modifiable.
 */
test('V10 Le jeu de données : la nuit de gel déclenche l’alerte posée d’avance', async ({ page }) => {
  const visite = await ouvrirLaDemo(page, 'vannes-alertes', 'gel-printemps', '/irrigation/aujourdhui');
  await ecarterLInvitation(page);
  const main = page.locator('main');
  await expect(main).toContainText('Gel : température minimale prévue');
  await expect(main).not.toContainText('aucune alerte de gel posée');
  await expect(main).not.toContainText('Gel sans alerte posée');

  await page.goto('/irrigation/alertes-meteo');
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  await expect(main).toContainText('Gel');
  // Les modèles ne paraissent que tant que la ferme n'a aucune alerte : celle-ci en a une.
  await expect(main.getByRole('button', { name: 'Gel : moins de 3 °C' })).toHaveCount(0);
  expect(visite.journal.erreurs).toEqual([]);
  expect(visite.envois, 'la page a écrit à la place du visiteur').toEqual([]);
});
