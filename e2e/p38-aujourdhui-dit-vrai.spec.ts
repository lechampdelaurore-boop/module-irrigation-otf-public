import { expect, test, type Page } from '@playwright/test';
import { annulerDepuisLeMenu, choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierLEtape , ouvrirLePli } from './support/parcours.ts';

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
 * - les jardins qui comptent d'abord (n° 4, F430 et F431) : une irrigation
 *   planifiée plus tard dans la journée sur N01 met « Jardin Nord » en tête
 *   d'« Eau de la semaine » et de « Réserve du sol », avant « Jardin du
 *   verger » que l'ordre naturel mettait devant ; l'irrigation annulée.
 *
 * - en cours et reliquat (n° 2, F433 à F435) : une irrigation démarrée se
 *   lit en tête de « Votre journée », « En cours », la phrase du jour le
 *   dit, sans « Rien à arroser » ; « Terminer l’irrigation » ouvre sa carte sur
 *   « Arrosages » ; arrêtée en route, son reliquat se lit « Reliquat » avec
 *   « Reprendre le reliquat » ; le reliquat annulé, il n'y est plus.
 *
 * - l'ordre naturel (n° 14, F436 et F437) : la liste « Matériel »
 *   d'« Arrosages » est regroupée par jardin, les groupes et les matériels
 *   dans l'ordre naturel (« gag2 » avant « gag10 »).
 *
 * - les petits défauts de lecture (n° 13, F438 à F443) : la tuile « Reste à
 *   apporter » jamais orange ; l'heure d'une carte d'un seul tenant au
 *   téléphone ; la page relue d'elle-même au retour sur l'onglet.
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
  const pluie = await ouvrirLePli(page.locator('#manual-rain'));
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
    await ouvrirLePli(pluie);
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

test('les jardins qui ont une irrigation aujourd’hui passent en tête', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const reference = Date.now();
  const debut = horodatageLocal(30, reference);
  // Une irrigation plus tard dans la journée : à moins de 30 minutes de minuit, rien à prouver.
  test.skip(debut.slice(0, 10) !== horodatageLocal(0, reference).slice(0, 10), 'trop près de minuit');
  await attendreLaPageIrrigation(page);
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo, { repere: 'p38 jardins' });
  await attendreLaPageIrrigation(page, 'arrosages');
  await page.getByRole('tab', { name: /^Planifier/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage, '5');
  await page.getByLabel('Date et heure de début').fill(debut);
  await page.getByRole('button', { name: 'Planifier l’irrigation' }).click();
  const fenetre = page.locator('dialog.module-confirm-dialog[open]');
  const reponse = page.locator('.irrigation-preview .action-reply .irrigation-event-notice');
  await expect(reponse.or(fenetre)).toBeVisible();
  if (await fenetre.isVisible()) await fenetre.getByRole('button', { name: /quand même$/ }).click();
  await expect(reponse).toHaveText(/planifiée/);

  await attendreLaPageIrrigation(page, 'aujourdhui');
  const premier = (bloc: string) => page.locator(`${bloc} .today-bar-row:not([data-total]) .today-bar-name`).first();
  if (await page.locator('#today-week-water').count()) await expect(premier('#today-week-water')).toHaveText('Jardin Nord');
  if (await page.locator('#today-soil').count()) await expect(premier('#today-soil')).toHaveText('Jardin Nord');
  await verifierLEtape(page, journal, 'le jardin arrosé aujourd’hui en tête');

  // Les petits défauts de lecture (F440, F441) : une quantité n'est pas une alerte ; l'heure tient sur une ligne.
  const reste = page.locator('.today-kpi').filter({ hasText: 'Reste à apporter' });
  if (await reste.count()) await expect(reste).not.toHaveAttribute('data-tone', 'warn');
  const heure = page.locator('.today-irrigation-time strong').first();
  await expect(heure).toHaveCSS('white-space', 'nowrap');
  const { hauteur, ligne } = await heure.evaluate((element) => ({ hauteur: element.getBoundingClientRect().height, ligne: parseFloat(getComputedStyle(element).lineHeight) }));
  expect(hauteur).toBeLessThan(ligne * 1.5);

  await attendreLaPageIrrigation(page, 'arrosages');
  const fiches = page.locator('.upcoming-irrigations article').filter({ hasText: materiel });
  await annulerDepuisLeMenu(page, fiches.first());
  await expect(fiches).toHaveCount(0);
});

test('une irrigation en cours puis son reliquat se lisent en tête de « Votre journée »', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page);
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo, { repere: 'p38 en cours' });
  await attendreLaPageIrrigation(page, 'arrosages');
  await page.getByRole('tab', { name: /^Irriguer maintenant/ }).click();
  await page.locator('select').filter({ has: page.getByRole('option', { name: materiel }) }).selectOption({ label: materiel });
  await page.locator('select').filter({ has: page.getByRole('option', { name: reglage }) }).selectOption({ label: reglage });
  await page.getByRole('button', { name: 'Durée d’irrigation' }).click();
  await page.getByLabel('Heures').fill('0');
  await page.getByLabel('Minutes').fill('30');
  await page.getByRole('button', { name: 'Démarrer l’irrigation' }).click();
  const fenetre = page.locator('dialog.module-confirm-dialog[open]');
  const demarree = page.getByText('L’irrigation a démarré.');
  await expect(demarree.or(fenetre)).toBeVisible();
  if (await fenetre.isVisible()) await fenetre.getByRole('button', { name: /quand même$/ }).click();
  await expect(demarree).toBeVisible();

  await attendreLaPageIrrigation(page, 'aujourdhui');
  const journee = page.locator('#today-day');
  const enTete = journee.locator('.today-group[data-group="now"]');
  const carte = enTete.locator('.today-irrigation').filter({ hasText: materiel });
  await expect(carte.locator('.today-status')).toHaveText('En cours');
  await expect(carte).toContainText('fin prévue à');
  await expect(page.locator('.today-chip').filter({ hasText: 'Rien à arroser' })).toHaveCount(0);
  await expect(journee.getByText('Rien à arroser aujourd’hui')).toHaveCount(0);
  await expect(page.locator('.today-sentence')).toContainText(/irrigations? (est|sont) en cours\./);
  await verifierLEtape(page, journal, 'l’irrigation en cours en tête de la journée');

  // « Terminer l’irrigation » ouvre la carte sur « Arrosages », où l'arrêt se confirme.
  await carte.getByRole('link', { name: `Arrêter ou terminer : ${materiel}`, exact: false }).click();
  await terminerSurArrosages(page, materiel);

  await attendreLaPageIrrigation(page, 'aujourdhui');
  const reliquat = enTete.locator('.today-irrigation').filter({ hasText: materiel });
  await expect(reliquat.locator('.today-status')).toHaveText('Reliquat');
  await expect(reliquat.getByRole('button', { name: 'Reprendre le reliquat' })).toBeVisible();
  await expect(page.locator('.today-sentence')).toContainText(/reliquats? (est|sont) à reprendre\./);
  await verifierLEtape(page, journal, 'le reliquat à reprendre');

  // « Reprendre le reliquat » répond sous la carte, qui passe « En cours », et la réponse l'y suit, dans l'écran ;
  // un refus s'y écrit aussi ; jamais en tête de page (6 nonies, L4, D-313).
  await reliquat.getByRole('button', { name: 'Reprendre le reliquat' }).click();
  const reponse = enTete.locator('.today-irrigation').filter({ hasText: materiel }).locator('.action-reply');
  await expect(reponse).toBeVisible();
  await expect(page.locator('.action-reply')).toHaveCount(1);
  await expect(page.locator('.today-head .today-notice, .today-head .today-error')).toHaveCount(0);
  await expect(page.locator('.today-page')).toHaveAttribute('aria-busy', 'false');
  await expect(reponse).toBeInViewport();
  if (await reponse.locator('.today-notice').count() > 0) {
    await expect(reponse).toContainText('L’irrigation a démarré.');
    await expect(reponse.getByRole('link', { name: 'Suivre sur « Arrosages »' })).toHaveAttribute('href', /^\/irrigation\/arrosages\?season=\d{4}$/);
    await expect(enTete.locator('.today-irrigation').filter({ hasText: materiel }).locator('.today-status')).toHaveText('En cours');
    await verifierLEtape(page, journal, 'reliquat repris, la réponse sous sa carte en cours');
    await attendreLaPageIrrigation(page, 'arrosages');
    await terminerSurArrosages(page, materiel);
  } else {
    await expect(reponse.locator('.today-error')).not.toBeEmpty();
    await verifierLEtape(page, journal, 'reprise refusée, le refus sous sa carte');
  }

  // Remise en état : le reliquat annulé, il quitte « Aujourd'hui ».
  await attendreLaPageIrrigation(page, 'arrosages');
  const fiche = page.locator('.upcoming-irrigations article').filter({ hasText: materiel });
  await annulerDepuisLeMenu(page, fiche.first(), 'Annuler le reliquat');
  await expect(fiche).toHaveCount(0);
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await expect(enTete.locator('.today-irrigation').filter({ hasText: materiel })).toHaveCount(0);
});

/** Termine sur « Arrosages » l'irrigation en cours du matériel ; ce qui reste passe en reliquat. */
async function terminerSurArrosages(page: Page, materiel: string): Promise<void> {
  await attendreLaPagePrete(page, 'arrosages');
  const enCours = page.getByLabel('Irrigations en cours');
  await expect(enCours).toContainText(materiel);
  const minuteur = await enCours.innerText();
  await expect.poll(async () => (await enCours.innerText()) !== minuteur, { timeout: 15_000 }).toBe(true);
  await enCours.locator('article').filter({ hasText: materiel }).getByRole('button', { name: 'Terminer l’irrigation' }).click();
  await page.locator('[role=dialog]').filter({ hasText: 'Terminer l’irrigation' }).getByRole('button', { name: 'Terminer l’irrigation' }).click();
  await expect(enCours.locator('article').filter({ hasText: materiel })).toHaveCount(0);
}

test('la liste « Matériel » se regroupe par jardin, dans l’ordre naturel', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'arrosages');
  await page.getByRole('tab', { name: /^Planifier/ }).click();
  const liste = page.locator('select').filter({ has: page.getByRole('option', { name: 'Choisissez un matériel' }) });
  const groupes = await liste.locator('optgroup').evaluateAll((elements) => elements.map((element) => ({
    label: element.getAttribute('label') ?? '',
    options: [...element.querySelectorAll('option')].map((option) => option.textContent ?? ''),
  })));
  expect(groupes.length).toBeGreaterThan(0);
  const naturel = new Intl.Collator('fr-FR', { numeric: true, sensitivity: 'base' });
  const range = (noms: string[]) => [...noms].sort((a, b) => naturel.compare(a, b));
  const libelles = groupes.map((groupe) => groupe.label).filter((label) => label !== 'Sans jardin');
  expect(libelles).toEqual(range(libelles));
  for (const groupe of groupes) expect(groupe.options, `le jardin « ${groupe.label} »`).toEqual(range(groupe.options));
  await verifierLEtape(page, journal, 'la liste « Matériel » par jardin');
});

test('la page se relit d’elle-même au retour sur l’onglet', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await page.clock.install();
  await attendreLaPageIrrigation(page, 'aujourdhui');
  // Plus d'une minute plus tard, l'onglet revient au premier plan : la page relit sa vue (F438).
  await page.clock.fastForward('02:00');
  const relue = page.waitForRequest((requete) => requete.method() === 'POST' && requete.url().includes('/irrigation/aujourdhui'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await relue;
  await verifierLEtape(page, journal, 'la page relue au retour sur l’onglet');
});
