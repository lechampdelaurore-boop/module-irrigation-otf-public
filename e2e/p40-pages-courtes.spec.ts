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
