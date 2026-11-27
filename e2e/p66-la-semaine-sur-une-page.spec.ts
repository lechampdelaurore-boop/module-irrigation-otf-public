import { expect, test, type Page } from '@playwright/test';
import { WEEK_ANCHORS } from '../lib/domain/features/week-page.ts';
import { attendreLeChoixDesFonctionnalites, caseDeLaFonctionnalite, ouvrirUneFermeNeuve } from './support/fonctionnalites.ts';
import { allerALaPage, attendreLaPageIrrigation, attendreLaPagePrete, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P66 : la semaine sur une page (simplification, lot S4, PR 1,
 * docs/simplification-s4-contract.md, sections 3, 7.4, 9 et 11 ; D-335 ;
 * docs/browser-journeys-contract.md), aux deux largeurs.
 *
 * Sur la ferme des parcours, qui a tout coché :
 * - chacune des trois anciennes adresses, `/irrigation/planning`,
 *   `/irrigation/besoins` et `/irrigation/historique`, est redirigée par le
 *   serveur vers `/irrigation/semaine`, sa saison et sa semaine gardées, et
 *   le navigateur garde son ancre : le pli qu'elle vise s'ouvre ;
 *   l'historique ouvre la vue « Les cumuls » ;
 * - chaque ancre du relevé de la section 7.4 (`WEEK_ANCHORS`) existe sur la
 *   page, dans la vue qui la porte, et chaque pli qui la contient est ouvert ;
 * - le sélecteur des deux vues sous le titre, 44 px, la vue ouverte marquée.
 *
 * Sur une ferme neuve propre au parcours et à la largeur, qui n'a coché que
 * l'historique (et ce dont il a besoin) : « Semaine » s'ouvre sur « Les
 * cumuls », sans sélecteur ; l'adresse des besoins mène à la page d'arrivée
 * et à sa ligne « page non cochée » (P14).
 *
 * Rien n'est enregistré sur la ferme des parcours. Les mesures (hauteur de la
 * page à 390 px, temps du serveur) sont relevées en annotation et dans la
 * section 13 du contrat ; P40 et P61 en tiennent les bornes.
 */

/** La saison que la page montre : celle de son choix de saison. */
async function laSaison(page: Page): Promise<string> {
  return page.locator('select[name="season"]').first().inputValue();
}

/** L'ancre est sur la page, et tout pli qui la contient, elle comprise, est ouvert. */
async function ancreOuverte(page: Page, id: string): Promise<{ existe: boolean; plisFermes: string[] }> {
  return page.evaluate((cible) => {
    const element = document.getElementById(cible);
    if (!element) return { existe: false, plisFermes: [] };
    const plis: string[] = [];
    for (let noeud: Element | null = element; noeud; noeud = noeud.parentElement) {
      if (noeud instanceof HTMLDetailsElement && !noeud.open) plis.push(noeud.id || noeud.className);
    }
    return { existe: true, plisFermes: plis };
  }, id);
}

test('les trois anciennes adresses mènent à « Semaine » par le serveur, saison, semaine et ancre gardées', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'semaine');
  const saison = await laSaison(page);
  const semaine = `${saison}-06-03`;

  // La redirection vient du serveur (section 3.3, S4-o), sans attendre les scripts de la page.
  for (const [ancienne, attendue] of [
    [`/irrigation/planning?season=${saison}&week=${semaine}`, `/irrigation/semaine?season=${saison}&week=${semaine}`],
    [`/irrigation/besoins?season=${saison}`, `/irrigation/semaine?season=${saison}`],
    [`/irrigation/historique?season=${saison}&week=${semaine}`, `/irrigation/semaine?season=${saison}&week=${semaine}&vue=cumuls`],
  ] as const) {
    const reponse = await page.request.get(ancienne, { maxRedirects: 0 });
    expect(reponse.status(), ancienne).toBe(307);
    expect(reponse.headers().location, ancienne).toBe(attendue);
  }

  // Les besoins, sur une autre semaine, vers la pluie mesurée : le pli s'ouvre.
  await page.goto(`/irrigation/besoins?season=${saison}&week=${semaine}#manual-rain`);
  await attendreLaPagePrete(page, 'besoins');
  await expect(page).toHaveURL(new RegExp(`/irrigation/semaine\\?season=${saison}&week=${semaine}#manual-rain$`));
  await expect(page.locator('details#manual-rain')).toHaveAttribute('open', '');
  await verifierLEtape(page, journal, 'ancienne adresse des besoins');

  // Le planning, vers son bloc.
  await page.goto(`/irrigation/planning?season=${saison}#planning-title`);
  await attendreLaPagePrete(page, 'planning');
  await expect(page).toHaveURL(new RegExp(`/irrigation/semaine\\?season=${saison}#planning-title$`));
  await expect(page.locator('section#planning #planning-title')).toBeAttached();
  await verifierLEtape(page, journal, 'ancienne adresse du planning');

  // L'historique, vers le suivi par série : la vue « Les cumuls », sa lecture « Par série » ouverte.
  await page.goto(`/irrigation/historique?season=${saison}#series-water-title`);
  await attendreLaPagePrete(page, 'historique');
  await expect(page).toHaveURL(new RegExp(`/irrigation/semaine\\?season=${saison}&vue=cumuls#series-water-title$`));
  await expect(page.getByRole('tab', { name: /^Par série/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#series-water-title')).toBeAttached();
  await verifierLEtape(page, journal, 'ancienne adresse de l’historique');
});

test('chaque ancre du relevé existe sur « Semaine », dans sa vue, et ouvre ce qui la porte ; le sélecteur de vue', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'semaine');
  const saison = await laSaison(page);

  // Le sélecteur des deux vues, sous le titre : 44 px, la vue ouverte marquée, la saison gardée (section 3.2).
  const selecteur = page.getByRole('navigation', { name: 'Vues de la semaine' });
  await expect(selecteur.getByRole('link')).toHaveText(['La semaine', 'Les cumuls']);
  await expect(selecteur.getByRole('link', { name: 'La semaine', exact: true })).toHaveAttribute('aria-current', 'page');
  for (const lien of await selecteur.getByRole('link').all()) {
    await verifierCibleTactile(lien, `La vue « ${await lien.innerText()} »`);
    expect(new URL((await lien.getAttribute('href'))!, 'http://x').searchParams.get('season')).toBe(saison);
  }
  const [titre, vues] = await Promise.all([page.getByRole('heading', { level: 1 }).boundingBox(), selecteur.boundingBox()]);
  expect(titre && vues && vues.y >= titre.y + titre.height, 'le sélecteur sous le titre').toBe(true);

  // La hauteur de chaque vue à la largeur du parcours, relevée pour la section 13 du contrat.
  const hauteurs: string[] = [];
  hauteurs.push(`La semaine ${await page.evaluate(() => document.documentElement.scrollHeight)} px`);

  const absentes: string[] = [];
  for (const entree of WEEK_ANCHORS) {
    const vue = entree.feature === 'historique' ? '&vue=cumuls' : '';
    await page.goto(`/irrigation/semaine?season=${saison}${vue}`);
    await attendreLaPagePrete(page, entree.feature === 'historique' ? 'historique' : 'semaine');
    if (vue) hauteurs.push(`Les cumuls ${await page.evaluate(() => document.documentElement.scrollHeight)} px`);
    let id: string = entree.anchor;
    if ('prefix' in entree) {
      // Le premier jardin du tableau des besoins, la première proposition du plan. La page est prête :
      // ce qui n'y est pas n'y viendra pas, d'où `count()`, qui n'attend pas, avant de lire l'identifiant.
      const candidates = page.locator(`[id^="${entree.anchor}"]`);
      const premier = (await candidates.count()) > 0 ? await candidates.first().getAttribute('id') : null;
      if (!premier) {
        absentes.push(`${entree.anchor}… : aucune sur la ferme des parcours`);
        continue;
      }
      id = premier;
    }
    await page.goto(`/irrigation/semaine?season=${saison}${vue}#${id}`);
    await expect.poll(async () => (await ancreOuverte(page, id)).existe, `#${id} sur la page`).toBe(true);
    await expect.poll(async () => (await ancreOuverte(page, id)).plisFermes, `#${id} : les plis qui la portent ouverts`).toEqual([]);
    await verifierLEtape(page, journal, `ancre ${id}`);
  }
  testInfo.annotations.push({ type: 'hauteur des vues', description: hauteurs.join(' ; ') });
  if (absentes.length > 0) testInfo.annotations.push({ type: 'ancres sans donnée', description: absentes.join(' ; ') });
  // Le jardin est toujours là : la ferme des parcours a ses quatre jardins.
  expect(absentes.filter((ligne) => ligne.startsWith('besoin-jardin-'))).toEqual([]);
});

test('une ferme qui n’a coché que l’historique : « Semaine » s’ouvre sur « Les cumuls », sans sélecteur', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeNeuve(context, testInfo, 'p66-historique');
  await page.goto('/irrigation/bienvenue');
  await attendreLeChoixDesFonctionnalites(page);
  await caseDeLaFonctionnalite(page, 'Historique et cumuls').check();
  // L'historique coche ce dont il a besoin : Arrosages, et avec lui Matériel et placement.
  await expect(caseDeLaFonctionnalite(page, 'Arrosages')).toBeChecked();
  await page.getByRole('button', { name: 'Continuer' }).click();
  // Le matériel à décrire : la première arrivée est « Ma ferme », la mise en route ayant une étape (lot S6, section 3.4).
  await attendreLaPagePrete(page, 'ma-ferme');

  // Par la barre ou le menu : la page « Semaine », sur « Les cumuls » d'office, sans paramètre ni sélecteur.
  await allerALaPage(page, 'semaine');
  await expect(page).not.toHaveURL(/[?&]vue=/);
  await expect(page.locator('.history-view-tabs')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Vues de la semaine' })).toHaveCount(0);
  await expect(page.locator('section#planning, details#manual-rain')).toHaveCount(0);
  const menu = page.getByRole('navigation', { name: 'Pages du module' });
  if (await menu.isVisible()) await expect(menu.locator('li[data-place="semaine"] li a')).toHaveCount(0);
  await verifierLEtape(page, journal, '« Semaine » sur « Les cumuls »');

  // L'adresse de l'historique y mène ; celle des besoins, non cochés, à la page d'arrivée et sa ligne (P14).
  await page.goto('/irrigation/historique');
  await attendreLaPagePrete(page, 'historique');
  await page.goto('/irrigation/besoins');
  await attendreLaPagePrete(page, 'aujourdhui');
  await expect(page.getByRole('status').filter({ hasText: 'La page « Objectifs et besoins » n’est pas cochée pour votre ferme.' })).toBeVisible();
  await verifierLEtape(page, journal, 'les besoins non cochés');
});
