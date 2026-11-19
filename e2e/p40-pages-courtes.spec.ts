import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape, TITRES_DES_PAGES, type PageDuModule } from './support/parcours.ts';

/**
 * Parcours P40 : l'audit ergonomique du 19 novembre 2026, lot J,
 * « Pages courtes au téléphone » (docs/audit-ergonomie-2026-11-19-lot-j-contract.md ;
 * docs/browser-journeys-contract.md).
 *
 * - Un seul titre (n° 18, F456) : sur les six pages dont le premier bloc
 *   redisait le titre, un seul titre visible le dit ; celui du bloc reste
 *   pour les lecteurs d'écran, et les niveaux de titre se suivent sans saut.
 *
 * Ce qu'il ne prouve pas : un vrai lecteur d'écran, la ferme réelle.
 */

/** Le titre de la page et le synonyme que son premier bloc portait. */
const TITRES_EN_DOUBLE: Partial<Record<PageDuModule, string[]>> = {
  planning: ['Planning de la semaine'],
  sol: ['Réserve du sol'],
  cultures: ['Besoin par culture', 'Besoin en eau par culture'],
  'alertes-meteo': ['Alertes météo'],
  'alertes-cultures': ['Alertes cultures'],
  historique: ['Historique et cumuls', 'Cumuls et historique'],
};

for (const [cible, noms] of Object.entries(TITRES_EN_DOUBLE) as [PageDuModule, string[]][]) {
  test(`un seul titre visible sur « ${TITRES_DES_PAGES[cible]} », sans niveau sauté`, async ({ page }) => {
    const journal = surveillerLaConsole(page);
    await attendreLaPageIrrigation(page, cible);
    const lus = await page.locator('main').evaluate((main, attendus) => {
      const titres = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')] as HTMLElement[];
      const visible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 && element.closest('details:not([open]), [hidden], dialog:not([open])') === null;
      };
      const texte = (element: HTMLElement) => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      const enDouble = titres.filter((titre) => visible(titre) && attendus.includes(texte(titre))).map(texte);
      // Les niveaux se suivent : jamais plus d'un niveau de plus que le titre qui précède.
      const sauts: string[] = [];
      let precedent = 0;
      for (const titre of titres.filter((element) => element.closest('[hidden], dialog:not([open])') === null)) {
        const niveau = Number(titre.tagName.slice(1));
        if (precedent > 0 && niveau > precedent + 1) sauts.push(`h${precedent} puis h${niveau} « ${texte(titre)} »`);
        precedent = niveau;
      }
      return { enDouble, sauts };
    }, noms);
    expect(lus.enDouble, 'le titre n’est dit qu’une fois').toEqual([TITRES_DES_PAGES[cible]]);
    expect(lus.sauts, 'aucun niveau de titre sauté').toEqual([]);
    await verifierLEtape(page, journal, `un seul titre sur ${cible}`);
  });
}

/**
 * Les budgets de hauteur au téléphone (section 2 du contrat), mesurés à
 * 390 px, plis fermés, sur les données des parcours. Chaque PR du lot ajoute
 * sa page.
 */
const BUDGETS_AU_TELEPHONE: Partial<Record<PageDuModule, number>> = {
  // PR 2 (F457) : « Réglages du calcul » dans le pli « Réglages de cette page » ; 5 541 → 3 961 px.
  // Les données des parcours n'ont aucune culture de la saison : les 32 cultures de référence
  // s'y montrent ouvertes (F302), d'où 4 000 px ici pour 3 000 sur une ferme qui cultive.
  cultures: 4_000,
  // PR 3 (F458) : les jardins pareils en une barre. Les données des parcours n'ont que quatre
  // jardins, aucun pareil (le regroupement est chiffré par tests/soil-reserve-garden-bars.test.ts).
  // 2 560 px sur les données neuves ; 2 866 px quand P18 à P33 ont saisi et observé le sol de
  // leurs jardins avant lui, comme dans la suite complète : le budget couvre ce second cas.
  sol: 3_000,
};

for (const [cible, budget] of Object.entries(BUDGETS_AU_TELEPHONE) as [PageDuModule, number][]) {
  test(`« ${TITRES_DES_PAGES[cible]} » tient sous ${budget} px au téléphone`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'telephone', 'le budget vaut au téléphone');
    const journal = surveillerLaConsole(page);
    await attendreLaPageIrrigation(page, cible);
    const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(hauteur, `hauteur de « ${cible} » à 390 px`).toBeLessThanOrEqual(budget);
    // Rien ne déborde de côté.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await verifierLEtape(page, journal, `hauteur de ${cible}`);
  });
}

test('« Besoin par culture » : « Réglages du calcul » dans le pli des réglages, fermé, qu’un lien ouvre', async ({ page }) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page, 'cultures');
  const pli = page.locator('details#reglages-de-la-page');
  await expect(pli).not.toHaveAttribute('open', '');
  await expect(pli.locator('section.crop-water-settings')).toHaveCount(1);
  await page.goto('/irrigation/cultures#crop-water-settings-title');
  await expect(pli).toHaveAttribute('open', '');
  await expect(pli.getByRole('heading', { name: 'Réglages du calcul' })).toBeVisible();
  await verifierLEtape(page, journal, 'réglages du calcul repliés');
});
