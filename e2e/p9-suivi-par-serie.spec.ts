import { expect, test } from '@playwright/test';
import { choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant, soumettreIrrigation } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P9 : suivre l'eau par série (docs/browser-journeys-contract.md,
 * docs/series-contract.md « Interface »).
 *
 * Le plan de culture de démonstration porte une succession sur N01 — les
 * carottes, puis la mâche encore à venir —, des tomates en cours sous le
 * tunnel, une série sans implantation et une série en bloc. La vue « Par
 * série » doit montrer les deux premières avec leurs cumuls, la mâche à part,
 * et taire les deux dernières. Une irrigation enregistrée sur N01 aujourd'hui
 * n'appartient qu'aux séries qui l'occupent aujourd'hui : la mâche, à venir,
 * ne la reçoit pas ; les carottes, terminées en juin, non plus.
 */
test('la vue par série montre chaque culture avec ses cumuls, met les séries à venir à part et tait les séries ignorées', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  await attendreLaPageIrrigation(page);

  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo);
  // L'irrigation se saisit sur la page des arrosages, les cumuls se lisent sur
  // celle de l'historique (3.8).
  await attendreLaPageIrrigation(page, 'arrosages');
  await page.getByRole('tab', { name: /^Déjà réalisée/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage);
  // Finie à la minute précédente, pour que l'export de la semaine en cours la
  // compte quelle que soit l'heure (docs/browser-journeys-contract.md,
  // « Reproductibilité », point ouvert 49).
  await page.getByLabel('Début réel').fill(horodatageLocal(-61, reference));
  await page.getByLabel('Fin réelle').fill(horodatageLocal(-1, reference));
  await soumettreIrrigation(page, 'Enregistrer l’irrigation réalisée', 'parcours séries');
  await attendreLaPageIrrigation(page, 'historique');

  const historique = page.locator('.irrigation-history-dashboard');
  await historique.scrollIntoViewIfNeeded();
  await historique.getByRole('tab', { name: /^Par série/ }).click();
  await expect(historique.getByRole('tab', { name: /^Par série/, selected: true })).toHaveCount(1);

  // Les séries suivies : en cours ou terminées, avec implantation et récolte.
  const carottes = historique.locator('details.series-card').filter({ hasText: 'Carottes de printemps' });
  const tomates = historique.locator('details.series-card').filter({ hasText: 'Tomates du tunnel' });
  await expect(carottes).toHaveCount(1);
  await expect(tomates).toHaveCount(1);
  await expect(carottes).toContainText('semis direct réalisé semaine 12 de 2026');
  await expect(carottes).toContainText('dernière récolte réalisée semaine 26 de 2026');
  await expect(carottes).toContainText('N01');
  await expect(tomates).toContainText('plantation réalisée semaine 16 de 2026');
  await expect(tomates).toContainText('T01');

  // Les séries ignorées n'apparaissent nulle part ; la mâche est à venir, sans cumul.
  await expect(historique).not.toContainText('Radis sans semis');
  await expect(historique).not.toContainText('Endives en bloc');
  const aVenir = historique.getByRole('list', { name: 'Séries à venir' });
  await expect(aVenir).toContainText('Mâche d’automne');
  await expect(aVenir).toContainText('plantation planifiée');
  await expect(historique.locator('details.series-card').filter({ hasText: 'Mâche d’automne' })).toHaveCount(0);
  await verifierLEtape(page, journal, 'vue par série affichée');

  // Le détail d'une série : ses planches, chacune avec ses millimètres.
  await carottes.locator('summary').click();
  await expect(carottes).toHaveAttribute('open', '');
  const planches = carottes.locator('table.series-beds tbody tr');
  await expect(planches).toHaveCount(1);
  await expect(planches.first()).toContainText('N01');
  await expect(planches.first()).toContainText('Jardin Nord');
  await verifierLEtape(page, journal, 'détail d’une série ouvert');

  // L'export garde sa colonne « Séries », vide aujourd'hui pour N01 : les carottes
  // sont récoltées depuis juin et la mâche n'est pas encore plantée.
  await historique.getByRole('tab', { name: /^Par périmètre/ }).click();
  const adresse = await historique.getByRole('link', { name: 'Exporter CSV' }).getAttribute('href');
  expect(adresse).not.toBeNull();
  const contenu = await (await page.request.get(adresse!)).text();
  const [enTete, ...lignes] = contenu.split('\r\n');
  const colonnes = enTete.replace('﻿', '').split(';');
  expect(colonnes[colonnes.indexOf('Planche(s)') + 1]).toBe('Séries');
  // Sa propre ligne, et non la première : l’export garde aussi les irrigations
  // annulées des autres parcours (D-006), et P10 en laisse sur le tunnel, où
  // les tomates occupent la planche.
  const ligneIrrigation = lignes.map((ligne) => ligne.split(';')).find((cellules) => cellules[colonnes.indexOf('Matériel')] === materiel);
  expect(ligneIrrigation, 'la ligne de l’irrigation du parcours dans l’export').toBeDefined();
  expect(ligneIrrigation![colonnes.indexOf('Séries')]).toBe('');
  await verifierLEtape(page, journal, 'colonne Séries de l’export');
});
