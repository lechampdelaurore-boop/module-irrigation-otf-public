import { expect, test, type Locator } from '@playwright/test';
import { NOT_FOUND_LABEL, pageDocumentTitle } from '../lib/domain/features/pages.ts';
import {
  attendreLaPageIrrigation,
  attendreLaPagePrete,
  nomsDesPagesDuMenu,
  surveillerLaConsole,
  TITRES_DES_PAGES,
  verifierCibleTactile,
  verifierLEtape,
  type PageDuModule,
} from './support/parcours.ts';

/**
 * Parcours P27 : se repérer dans le module (audit ergonomique du 7 novembre
 * 2026, lot 1, 3.8 quater, D-069 ; docs/browser-journeys-contract.md).
 *
 * Sur la ferme de démonstration, qui a tout coché : chaque page donne son nom
 * à l'onglet et ne propose la saison que là où elle sert (points 7 et 9) ; une
 * adresse inconnue mène à une page introuvable en français, avec le menu et
 * le lien qui ramène à la page d'arrivée, « Aujourd'hui » depuis le lot 2
 * (point 7) ; la commune ne se change que dans Réglages (point 9) ; le
 * périmètre d'un objectif se cherche et se range par jardin (point 4) ;
 * l'historique s'ouvre sur les irrigations réalisées, et l'export dit ce
 * qu'il exporte (point 11). Rien n'est enregistré : le parcours ne laisse
 * aucune trace dans la base partagée.
 */
test('chaque page a son titre, une adresse inconnue ramène au module, listes, saison et historique servent ce qu’on cherche', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';

  // Points 7 et 9 : le titre de l'onglet, et la saison là où elle change la page.
  for (const cible of Object.keys(TITRES_DES_PAGES) as PageDuModule[]) {
    await attendreLaPageIrrigation(page, cible);
    await expect(page).toHaveTitle(pageDocumentTitle(TITRES_DES_PAGES[cible]));
    // Sous le titre à l'ordinateur, dans la ligne du titre au téléphone (lot 2, F7).
    const saison = page.locator(telephone ? '.page-title-row select[name="season"]' : '.plan-controls select[name="season"]');
    // Les alertes météo valent pour l'exploitation ; « Aujourd'hui » montre le jour du jour (lot 2, F2) ;
    // Réglages garde la saison pour la correspondance des espèces.
    const sansSaison = cible === 'alertes-meteo' || cible === 'aujourdhui';
    await expect(saison).toHaveCount(sansSaison ? 0 : 1);
    if (!sansSaison) await expect(saison).toBeVisible();
    await verifierLEtape(page, journal, `titre et saison de la page ${TITRES_DES_PAGES[cible]}`);
  }

  // Point 7 : une adresse tapée de travers (celle de l'audit).
  const reponse = await page.goto('/irrigation/objectifs');
  expect(reponse?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: NOT_FOUND_LABEL })).toBeVisible();
  await expect(page).toHaveTitle(pageDocumentTitle(NOT_FOUND_LABEL));
  await expect(page.getByText('404 This page could not be found')).toHaveCount(0);
  // Le même menu que les autres pages ; au téléphone, « Plus » l'ouvre au-dessus de la barre du bas (lot 2).
  expect(await nomsDesPagesDuMenu(page)).toEqual(Object.values(TITRES_DES_PAGES));
  const retour = page.getByRole('link', { name: 'Revenir à « Aujourd’hui »' });
  await verifierCibleTactile(retour, 'Le lien de la page introuvable');
  // Le navigateur journalise la réponse 404 du document lui-même : c'est la réponse voulue, pas un défaut de la page.
  journal.erreurs = journal.erreurs.filter((erreur) => !erreur.includes('status of 404'));
  await verifierLEtape(page, journal, 'page introuvable');
  await retour.click();
  await attendreLaPagePrete(page, 'aujourdhui');
  await verifierLEtape(page, journal, 'retour à « Aujourd’hui »');

  // Point 9 : la météo de référence sur la page des besoins, la commune dans Réglages.
  await attendreLaPageIrrigation(page, 'besoins');
  const meteo = page.locator('.water-panel').filter({ hasText: 'Météo de référence' });
  await expect(meteo.getByRole('button', { name: 'Actualiser la météo' })).toBeVisible();
  await expect(meteo.getByLabel('Commune')).toHaveCount(0);

  // Point 4 : le périmètre d'un objectif, cherché puis rangé par jardin.
  const objectifs = page.locator('.water-panel').filter({ hasText: 'Objectifs hebdomadaires' });
  const recherche = objectifs.getByLabel('Chercher un périmètre');
  // Le nom accessible d'une liste enveloppée dans son libellé porte aussi l'option choisie : on la vise par sa place.
  const perimetre = objectifs.locator('.goal-scope-picker select');
  await expect(groupes(perimetre)).resolves.toEqual([
    'Ferme et parcelles',
    'Jardin Sud · Le Coteau',
    'Jardin Nord · Les Prés',
    'Tunnel 1 · Les Prés',
    'Jardin du verger · Sous le verger',
  ]);
  await recherche.fill('n0');
  await expect(perimetre.locator('option')).toHaveText(['Toute la ferme', 'Planche · N01', 'Planche · N02', 'Planche · N03']);
  await expect(objectifs.getByRole('status')).toHaveText('3 périmètres trouvés.');
  await perimetre.selectOption({ label: 'Planche · N02' });
  await recherche.fill('tunnel');
  // Le choix en cours reste dans la liste, même quand la recherche ne le trouve plus.
  await expect(perimetre.locator('option')).toHaveText(['Planche · N02', 'Jardin / abri · Tunnel 1', 'Planche · T01', 'Planche · T02']);
  await expect(perimetre.locator('option:checked')).toHaveText('Planche · N02');
  await recherche.fill('');
  if (telephone) {
    await verifierCibleTactile(recherche, 'La recherche du périmètre');
    await verifierCibleTactile(perimetre, 'La liste du périmètre');
  }
  await verifierLEtape(page, journal, 'périmètre d’un objectif');

  const versReglages = meteo.getByRole('link', { name: 'Changer la commune dans Réglages' });
  if (telephone) await verifierCibleTactile(versReglages, 'Le lien vers la commune');
  await versReglages.click();
  await attendreLaPagePrete(page, 'reglages');
  await expect(page.locator('.water-panel').filter({ hasText: 'Météo de référence' }).getByLabel('Commune')).toBeVisible();
  await verifierLEtape(page, journal, 'commune dans Réglages');

  // Point 11 : l'historique s'ouvre sur les irrigations réalisées.
  await attendreLaPageIrrigation(page, 'historique');
  const historique = page.locator('.irrigation-history-dashboard');
  const filtres = historique.getByRole('tablist', { name: 'Irrigations listées' });
  const export_ = historique.locator('a.history-export-button');
  await expect(filtres.getByRole('tab', { name: /^Réalisées/ })).toHaveAttribute('aria-selected', 'true');
  await expect(historique.locator('.history-list-heading p')).toHaveText(/irrigations? réalisées? dans la sélection\./);
  await expect(export_).toHaveText(/^Exporter CSV · réalisées, du \d{2}\/\d{2}\/\d{4} au \d{2}\/\d{2}\/\d{4}$/);
  await expect(export_).toHaveAttribute('href', /status=done/);
  await filtres.getByRole('tab', { name: /^Planifiées/ }).click();
  await expect(filtres.getByRole('tab', { name: /^Planifiées/ })).toHaveAttribute('aria-selected', 'true');
  await expect(export_).toHaveAttribute('href', /status=planned/);
  await expect(export_).toHaveText(/^Exporter CSV · planifiées, /);
  await filtres.getByRole('tab', { name: /^Réalisées/ }).click();
  await expect(export_).toHaveAttribute('href', /status=done/);
  if (telephone) {
    for (const nom of [/^Réalisées/, /^Planifiées/, /^Toutes/]) {
      await verifierCibleTactile(filtres.getByRole('tab', { name: nom }), `L’onglet ${nom.source}`);
    }
  }
  await verifierLEtape(page, journal, 'historique ouvert sur les irrigations réalisées');
});

/** Les intitulés des groupes d'une liste, dans l'ordre. */
async function groupes(liste: Locator): Promise<string[]> {
  return liste.locator('optgroup').evaluateAll((elements) => elements.map((element) => (element as HTMLOptGroupElement).label));
}
