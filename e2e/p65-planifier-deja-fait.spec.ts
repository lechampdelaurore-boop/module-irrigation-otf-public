import { expect, test, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { horodatageLocal, ouvrirPlusDOptions, preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P65 : « Planifier » et « Déjà fait » sur le squelette
 * d'« Arroser maintenant » (simplification, lot S5, PR 2,
 * docs/simplification-s5-contract.md, sections 4, 6 et 10 ; D-333 ;
 * docs/browser-journeys-contract.md). Sur une ferme neuve propre au parcours
 * et à la largeur, toutes les cases cochées, jamais la ferme réelle.
 *
 * - Les trois onglets : « Arroser maintenant », « Planifier », « Déjà fait » ;
 *   au téléphone, sur une ligne, 44 px, sans phrase de description (S5-e).
 * - « Planifier » : « 1. Où ? », « 2. Quand ? », « 3. Combien de temps ? » ;
 *   le seul matériel choisi d'office ; sans durée, « Choisissez une durée. » ;
 *   « + » (30 min), le bouton dit « Planifier · demain à … », et l'arrosage se
 *   range sous « Demain ».
 * - « Déjà fait » : « 1. De quand à quand ? » avant « 2. Où ? » (règle 12),
 *   pas de « Combien de temps ? » ; une fin avant le début, « Choisissez une
 *   fin après le début. » ; des dates dans l'ordre, « soit 30 min » et la
 *   phrase de ce qui s'enregistrera ; « Plus d'options » sans saisie en mm ;
 *   « Enregistrer cet arrosage ».
 *
 * Mesures relevées en annotation : la hauteur des onglets et le haut de
 * « 1. Où ? » d'« Arroser maintenant ». Le budget de la section 7 est vérifié
 * par la PR 3, qui pose l'ordre de la page. Le matériel désélectionné quand il
 * n'était pas posé à l'heure de début est joué par P11 (sa pose retirée puis
 * reposée) et tenu par tests/simplification-s5-planifier-deja-fait.test.ts.
 */

test.setTimeout(240_000);

test('« Planifier » et « Déjà fait » : le même squelette, leurs dates au premier niveau, des boutons qui disent ce qu’ils font', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  const reference = Date.now();
  await ouvrirUneFermeToutCochee(page, context, testInfo, 's5-planifier');
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'materiel');
  const a = await preparerMaterielArrosant(page, testInfo, { repere: 'A' });
  await attendreLaPageIrrigation(page, 'arrosages');

  // Les trois onglets, leurs noms ; au téléphone, une ligne de 44 px.
  const onglets = page.getByRole('tablist', { name: 'Action d’irrigation' });
  const noms = ['Arroser maintenant', 'Planifier', 'Déjà fait'];
  for (const nom of noms) await expect(onglets.getByRole('tab', { name: new RegExp(`^${nom}`) })).toBeVisible();
  const hauteurOnglets = Math.round((await onglets.boundingBox())?.height ?? 0);
  testInfo.annotations.push({ type: 'mesure', description: `onglets : ${hauteurOnglets} px de haut (${testInfo.project.name})` });
  testInfo.annotations.push({ type: 'mesure', description: `« 1. Où ? » d’« Arroser maintenant » à ${await hautDe(page, '1. Où ?')} px du haut de la page (${testInfo.project.name})` });
  if (telephone) {
    const hauts = await Promise.all(noms.map(async (nom) => Math.round((await onglets.getByRole('tab', { name: new RegExp(`^${nom}`) }).boundingBox())?.y ?? -1)));
    expect(new Set(hauts).size, 'les trois onglets sur une ligne').toBe(1);
    expect(hauteurOnglets).toBeLessThan(60);
    await expect(onglets.getByText('Calculer puis démarrer le minuteur')).toBeHidden();
    for (const nom of noms) await verifierCibleTactile(onglets.getByRole('tab', { name: new RegExp(`^${nom}`) }), `L’onglet « ${nom} »`);
  }
  await verifierLEtape(page, journal, 'les trois onglets');

  // « Planifier » : où, quand, combien de temps.
  await onglets.getByRole('tab', { name: /^Planifier/ }).click();
  const planifier = page.locator('.watering-now[data-kind="planned"]');
  await expect(planifier.getByRole('heading', { level: 3 })).toHaveText(['1. Où ?', '2. Quand ?', '3. Combien de temps ?']);
  await expect(planifier.getByRole('radio', { name: a.materiel, exact: true })).toBeChecked();
  await expect(planifier.locator('.watering-missing')).toHaveText('Choisissez une durée.');
  await planifier.getByLabel('Date et heure de début').fill(horodatageLocal(24 * 60, reference));
  await planifier.getByRole('button', { name: 'Cinq minutes de plus' }).click();
  await expect(planifier.locator('.watering-duration strong')).toHaveText('30 min');
  await expect(planifier.locator('.watering-result').first()).toHaveText(/^Soit 5 mm sur la planche, et 113 L\.$/);
  const boutonPlanifier = planifier.locator('.start-irrigation-button');
  await expect(boutonPlanifier).toHaveText(/^Planifier · demain à \d{1,2} h( \d{2})?$/);
  await expect(boutonPlanifier).toHaveAccessibleName(new RegExp(`^Planifier l’arrosage de ${a.materiel}, demain à `));
  if (telephone) await verifierCibleTactile(boutonPlanifier, 'Le bouton « Planifier · … »');
  await boutonPlanifier.click();
  await expect(page.locator('.watering-start .action-reply .irrigation-event-notice')).toHaveText(/planifiée/);
  await expect(page.locator('.upcoming-irrigations article').filter({ hasText: a.materiel })).toHaveCount(1);
  await verifierLEtape(page, journal, '« Planifier · demain à … »');

  // « Déjà fait » : les dates d'abord, puis où ; la durée se lit des dates.
  await onglets.getByRole('tab', { name: /^Déjà fait/ }).click();
  const dejaFait = page.locator('.watering-now[data-kind="completed"]');
  await expect(dejaFait.getByRole('heading', { level: 3 })).toHaveText(['1. De quand à quand ?', '2. Où ?']);
  await expect(dejaFait.getByRole('button', { name: 'Cinq minutes de plus' })).toHaveCount(0);
  await dejaFait.getByLabel('Début réel').fill(horodatageLocal(-60, reference));
  await dejaFait.getByLabel('Fin réelle').fill(horodatageLocal(-90, reference));
  await expect(dejaFait.locator('.watering-missing')).toHaveText('Choisissez une fin après le début.');
  await expect(dejaFait.locator('.watering-duration-result')).toHaveText('soit —');
  await dejaFait.getByLabel('Fin réelle').fill(horodatageLocal(-30, reference));
  await expect(dejaFait.locator('.watering-duration-result')).toHaveText(/^soit 30 min/);
  await expect(dejaFait.getByRole('radio', { name: a.materiel, exact: true })).toBeChecked();
  await expect(dejaFait.locator('.watering-result').first()).toHaveText(/^Soit 5 mm sur la planche, et 113 L\.$/);
  const options = await ouvrirPlusDOptions(page);
  await expect(page.getByRole('button', { name: /^Plus d’options/ })).toHaveText('Plus d’options (pompe, note)');
  await expect(options.getByRole('checkbox', { name: 'Saisir en mm' })).toHaveCount(0);
  await expect(options.getByText('Durée exacte')).toHaveCount(0);
  const enregistrer = dejaFait.locator('.start-irrigation-button');
  await expect(enregistrer).toHaveText('Enregistrer cet arrosage');
  await expect(enregistrer).toHaveAccessibleName(`Enregistrer l’arrosage de ${a.materiel}`);
  await enregistrer.click();
  await expect(page.locator('.watering-start .action-reply .irrigation-event-notice')).toBeVisible();
  await expect(page.getByLabel('Irrigations en cours').filter({ hasText: a.materiel })).toHaveCount(0);
  await verifierLEtape(page, journal, '« Enregistrer cet arrosage »');
});

/** Le haut d'un titre de bloc, en pixels depuis le haut de la page. */
async function hautDe(page: Page, titre: string): Promise<number> {
  const element = page.getByRole('heading', { name: titre }).first();
  await expect(element).toBeVisible();
  return Math.round(await element.evaluate((node) => node.getBoundingClientRect().top + window.scrollY));
}
