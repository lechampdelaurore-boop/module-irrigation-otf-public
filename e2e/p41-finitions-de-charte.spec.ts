import { expect, test } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P41 : l'audit ergonomique du 19 novembre 2026, lot K,
 * « Finitions de charte » (docs/audit-ergonomie-2026-11-19-lot-k-contract.md ;
 * docs/browser-journeys-contract.md).
 *
 * - Planning (n° 17, F465 et F467) : la ligne d'état en deux lignes, la
 *   semaine et l'heure du calcul d'abord, ses sources dessous, plus
 *   discrètes ; « Réglages du planning » porte le signe des autres plis.
 *
 * Ce qu'il ne prouve pas : la tuile neutre des planches en attente et le
 * « Valider » unique d'un jour à une proposition (les tests du domaine,
 * `tests/audit-ergonomie-2026-11-19-lot-k.test.ts`, les vérifient), la ferme
 * réelle, un vrai téléphone.
 */

test('planning : la ligne d’état en deux lignes, le pli des réglages signé comme les autres', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'lotk-planning');
  await attendreLaPageIrrigation(page, 'planning');
  const planning = page.locator('section.planning-section');
  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  const principale = planning.locator('.planning-meta-main');
  const sources = planning.locator('.planning-meta-sources');
  await expect(principale).toContainText('calculé le', { timeout: 30_000 });
  await expect(principale).toHaveText(/^Semaine du \d{2}\/\d{2} au \d{2}\/\d{2} · calculé le \d{2}\/\d{2}\/\d{4} à \d{1,2} h( \d{2})? \(à la demande\)$/);
  await expect(sources).toHaveText(/^Prévision météo sur \d+ jours?/);
  const [haut, bas] = await Promise.all([principale.boundingBox(), sources.boundingBox()]);
  expect(haut && bas && bas.y >= haut.y + haut.height - 1, 'les sources sous la semaine').toBe(true);
  await expect(sources).toHaveCSS('font-size', '12px');
  const signe = await planning.locator('details.planning-settings > summary').evaluate((summary) => getComputedStyle(summary, '::after').content);
  expect(signe, 'le chevron des plis').toBe('""');
  await verifierLEtape(page, journal, 'ligne d’état et pli des réglages');
});

test('un seul dessin de pli, un bouton plein par geste, plus de geste muet', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'lotk-gestes');
  // Chaque pli de ces pages porte le chevron à droite, aucun le triangle du navigateur (n° 21, F469).
  for (const cible of ['besoins', 'sol', 'cultures', 'ressources', 'reglages'] as const) {
    await attendreLaPageIrrigation(page, cible);
    const plis = await page.locator('main details:not(.row-menu, .equipment-menu, .plan-equipment-menu) > summary:not(:has(> .detail-hint))').evaluateAll((resumes) => resumes
      .filter((resume) => (resume as HTMLElement).offsetParent !== null)
      .map((resume) => ({ signe: getComputedStyle(resume, '::after').content, marque: getComputedStyle(resume).listStyleType, texte: (resume.textContent ?? '').trim().slice(0, 30) })));
    expect(plis.length, `des plis sur ${cible}`).toBeGreaterThan(0);
    for (const pli of plis) {
      expect(pli.signe, `le chevron du pli « ${pli.texte} » (${cible})`).toBe('""');
      expect(pli.marque, `sans triangle : « ${pli.texte} » (${cible})`).toBe('none');
    }
  }
  // « Cette semaine » : un raccourci en secondaire, sans effet quand on y est déjà (F470).
  await attendreLaPageIrrigation(page, 'besoins');
  const cetteSemaine = page.locator('.water-week-navigation').getByRole('button', { name: 'Cette semaine' });
  await expect(cetteSemaine).toBeDisabled();
  await expect(cetteSemaine).not.toHaveCSS('background-color', 'rgb(11, 105, 77)');
  // « Retirer la mesure » ne fait pas semblant sur un jour sans mesure (F471).
  const pluie = page.locator('#manual-rain');
  await pluie.locator('summary').click();
  await expect(pluie.getByRole('button', { name: 'Retirer la mesure' })).toBeDisabled();
  // « 24 h / 48 h / 7 jours » : un seul choix plein, celui qui est fait (F470).
  await attendreLaPageIrrigation(page, 'ressources');
  const horizons = page.locator('.projection-shortcuts button[aria-pressed]');
  await expect(horizons).toHaveCount(3);
  const pleins = await horizons.evaluateAll((boutons) => boutons.map((bouton) => [bouton.getAttribute('aria-pressed'), getComputedStyle(bouton).backgroundColor]));
  for (const [choisi, fond] of pleins) expect(fond === 'rgb(11, 105, 77)', `plein seulement s’il est choisi (${choisi})`).toBe(choisi === 'true');
  await verifierLEtape(page, journal, 'plis, boutons et gestes');
});

test('rien sous 12 px, quatre graisses, sur les douze pages', async ({ page }) => {
  // n° 19, F477 : l'échelle de la charte. Sur la ferme des parcours, aux deux largeurs.
  const journal = surveillerLaConsole(page);
  const pages = ['aujourdhui', 'arrosages', 'planning', 'besoins', 'sol', 'cultures', 'materiel', 'ressources', 'alertes-meteo', 'alertes-cultures', 'historique', 'reglages'] as const;
  for (const cible of pages) {
    await attendreLaPageIrrigation(page, cible);
    const mesure = await page.evaluate(() => {
      const petits: string[] = [];
      const graisses = new Set<string>();
      for (const element of document.querySelectorAll<HTMLElement>('main *')) {
        const texte = [...element.childNodes].filter((noeud) => noeud.nodeType === Node.TEXT_NODE).map((noeud) => noeud.textContent ?? '').join('').trim();
        if (!texte) continue;
        const boite = element.getBoundingClientRect();
        if (boite.width === 0 || boite.height === 0) continue;
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden') continue;
        if (Number.parseFloat(style.fontSize) < 12) petits.push(`${texte.slice(0, 30)} (${style.fontSize})`);
        graisses.add(style.fontWeight);
      }
      return { petits, graisses: [...graisses].sort() };
    });
    expect(mesure.petits, `texte sous 12 px sur ${cible}`).toEqual([]);
    for (const graisse of mesure.graisses) expect(['300', '400', '500', '700'], `graisse ${graisse} sur ${cible}`).toContain(graisse);
  }
  await verifierLEtape(page, journal, 'tailles et graisses');
});
