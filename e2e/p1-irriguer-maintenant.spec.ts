import { expect, test } from '@playwright/test';
import { preparerMaterielArrosant, verifierLaSurfaceMouillee } from './support/materiel.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P1 : irriguer maintenant avec minuteur
 * (docs/browser-journeys-contract.md).
 *
 * Le cœur du module : un maraîcher ouvre une vanne, lance le minuteur, ferme
 * son téléphone, revient plus tard et arrête. Ce parcours vérifie que le
 * minuteur survit à un rechargement, ce qui est la promesse la plus forte de
 * l'écran, et que l'arrêt anticipé laisse une irrigation réellement enregistrée.
 */
test('un matériel neuf permet de démarrer un minuteur qui survit au rechargement, puis de terminer', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page);

  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo);
  // En goutte-à-goutte, la surface mouillée est la planche seule : N01 fait
  // 30 m × 0,75 m = 22,5 m², à 10 mm/h (docs/wetted-surface-contract.md, D-022).
  await expect(page.locator('.coverage-equipment-list button').filter({ hasText: materiel })).toContainText('225 L/h');
  await verifierLEtape(page, journal, 'matériel prêt à irriguer');
  // Les besoins des planches ont leur page (3.8).
  await attendreLaPageIrrigation(page, 'besoins');
  await verifierLaSurfaceMouillee(page, 'N01', '22,5 m²', 'goutte-à-goutte, planche seule');
  await verifierLEtape(page, journal, 'surface mouillée du matériel');

  // Le minuteur est sur la page des arrosages.
  await attendreLaPageIrrigation(page, 'arrosages');

  // Une irrigation d'une minute : assez courte pour un parcours, assez longue
  // pour être encore en cours au rechargement.
  await page.getByRole('tab', { name: /^Irriguer maintenant/ }).click();
  // Le nom accessible d'une liste déroulante inclut son choix courant, donc il
  // change ; on désigne chaque liste par le choix qu'elle propose.
  await page.locator('select').filter({ has: page.getByRole('option', { name: materiel }) }).selectOption({ label: materiel });
  await page.locator('select').filter({ has: page.getByRole('option', { name: reglage }) }).selectOption({ label: reglage });
  await page.getByRole('button', { name: 'Durée d’irrigation' }).click();
  await page.getByLabel('Heures').fill('0');
  await page.getByLabel('Minutes').fill('1');
  await expect(page.getByText('RÉSULTAT CALCULÉ')).toBeVisible();
  await expect(page.getByText('1 min', { exact: true }).first()).toBeVisible();
  await verifierLEtape(page, journal, 'durée calculée');

  await page.getByRole('button', { name: 'Démarrer l’irrigation' }).click();
  await expect(page.getByText('L’irrigation a démarré.')).toBeVisible();
  const enCours = page.getByLabel('Irrigations en cours');
  await expect(enCours).toContainText(materiel);
  await expect(enCours).toContainText(reglage);
  await verifierLEtape(page, journal, 'minuteur démarré');

  // La promesse de l'écran : « Le minuteur retrouvera son état après une
  // actualisation de la page. »
  await page.reload();
  await attendreLaPagePrete(page, 'arrosages');
  await expect(enCours).toContainText(materiel);
  await verifierLEtape(page, journal, 'minuteur retrouvé après rechargement');

  // Une irrigation doit durer réellement : l'application refuse une durée réelle
  // nulle, et un arrêt à l'instant du démarrage serait refusé. On attend que le
  // minuteur ait avancé, ce qui est une condition observable et non un délai fixe.
  const minuteurAuDepart = await enCours.innerText();
  await expect
    .poll(async () => (await enCours.innerText()) !== minuteurAuDepart, { timeout: 15_000 })
    .toBe(true);

  await page.getByRole('button', { name: 'Arrêter / Terminer' }).click();
  const confirmation = page.locator('dialog[open], [role=dialog]').filter({ hasText: 'Terminer l’irrigation' });
  await expect(confirmation).toContainText(materiel);
  await confirmation.getByRole('button', { name: 'Irrigation terminée' }).click();

  // Plus rien en cours : l'irrigation est passée dans les archives.
  await expect(enCours).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Arrêter / Terminer' })).toHaveCount(0);
  await verifierLEtape(page, journal, 'irrigation terminée');
});
