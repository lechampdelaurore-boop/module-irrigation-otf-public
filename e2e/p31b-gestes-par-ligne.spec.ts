import { expect, test, type Locator } from '@playwright/test';
import { ouvrirUneFermeToutCochee } from './support/fonctionnalites.ts';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P31b : l'audit ergonomique, lot 3, PR 2 — les gestes par ligne
 * (docs/audit-ergonomie-lot3-contract.md, sections 4 et 6, cas 8 à 11 ;
 * docs/browser-journeys-contract.md).
 *
 * Sur une ferme neuve, propre au parcours et à la largeur, tout coché :
 *
 * - Réglages, « Correspondance des espèces » : le compteur dit « n espèces
 *   à rattacher sur n », la recherche par nom réduit la liste ; « Rattacher
 *   comme Tomate… » demande une confirmation, « Ne rien changer » n'écrit
 *   rien, « Rattacher » rattache la tomate à la tomate du CRIIAM et le
 *   compteur baisse d'une espèce ; le rattachement est retiré à la fin
 *   (cas 8 et 9) ;
 * - « Réserve du sol » : sans sol saisi, chaque jardin est « inconnue » et
 *   porte « Observer », qui ouvre la jauge sur son curseur (cas 10) ;
 * - « Alertes météo » : sans alerte, trois modèles et l'état des
 *   notifications de cet appareil ; un modèle remplit le formulaire, qui
 *   reste modifiable ; « Annuler » n'enregistre rien ; enregistré, il fait
 *   disparaître les modèles ; la note du gel à 2 m est repliée (cas 11).
 *
 * Ce qu'il ne prouve pas : le pli des jardins pareils (la démonstration n'a
 * qu'un jardin de plein champ par parcelle ; le domaine le teste,
 * `tests/audit-ergonomie-lot3-gestes.test.ts`, avec onze jardins), les
 * notifications reçues sur un vrai téléphone, la ferme réelle.
 */

/** « 3 espèces à rattacher sur 4 » : le premier nombre. */
async function especesARattacher(compteur: Locator): Promise<number> {
  const texte = await compteur.innerText();
  const trouve = texte.match(/^(\d+) espèces? à rattacher sur \d+/);
  if (!trouve) throw new Error(`Compteur illisible : ${texte}`);
  return Number(trouve[1]);
}

test('les gestes par ligne : espèces à rattacher en tête, « Observer » sur une jauge inconnue, modèles d’alerte météo', async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'lot3-gestes');

  // Cas 8 : les espèces à rattacher, comptées, en tête ; la recherche par nom.
  await attendreLaPageIrrigation(page, 'reglages');
  const section = page.locator('section.crop-coefficients');
  await section.scrollIntoViewIfNeeded();
  const compteur = section.locator('.species-link-counter');
  await expect(compteur).toContainText(/^\d+ espèces? à rattacher sur \d+/);
  await expect(compteur).toContainText('Sans référence : le besoin n’est pas calculé, seul votre objectif compte.');
  const avant = await especesARattacher(compteur.locator('strong'));
  expect(avant).toBeGreaterThan(1);
  await expect(section.locator('.species-link-row').first()).toHaveAttribute('data-to-link', 'true');
  const recherche = section.getByRole('searchbox', { name: 'Chercher une espèce' });
  await expect(async () => {
    await recherche.fill('');
    await recherche.fill('mach');
    await expect(section.locator('.species-link-row')).toHaveCount(1, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(section.locator('.species-link-row summary strong')).toHaveText('Mâche');
  await expect(section.locator('.species-search [aria-live]')).toHaveText('1 espèce trouvée.');
  await recherche.fill('');
  await verifierLEtape(page, journal, 'espèces à rattacher en tête, recherche par nom');

  // Cas 9 : une proposition d'après le nom, jamais écrite sans confirmation.
  const tomate = section.locator('.species-link-row').filter({ has: page.locator('summary strong', { hasText: /^Tomate$/ }) });
  const proposer = tomate.getByRole('button', { name: 'Rattacher Tomate comme Tomate…' });
  await expect(tomate.locator('.species-link-suggestion')).toContainText('D’après son nom : Tomate (CRIIAM Sud)');
  if (telephone) await verifierCibleTactile(proposer, 'Le bouton « Rattacher comme Tomate… »');
  const confirmation = page.getByRole('dialog', { name: 'Rattacher Tomate ?' });
  await ouvrirParClic(proposer, confirmation);
  await expect(confirmation).toContainText('La proposition vient du nom seul');
  await confirmation.getByRole('button', { name: 'Ne rien changer' }).click();
  await expect(confirmation).toBeHidden();
  await expect(tomate.locator('summary').first()).toContainText('Non rattachée');
  await expect(compteur.locator('strong')).toContainText(`${avant} espèce`);
  await ouvrirParClic(proposer, confirmation);
  await confirmation.getByRole('button', { name: 'Rattacher', exact: true }).click();
  await expect(section.getByRole('status')).toHaveText('Le rattachement de l’espèce est enregistré.');
  await expect(tomate.locator('summary').first()).toContainText('Tomate');
  await expect(tomate.locator('summary').first()).not.toContainText('par analogie');
  await expect(tomate.locator('.species-link-suggestion')).toHaveCount(0);
  await expect(compteur.locator('strong')).toContainText(new RegExp(`^${avant - 1} espèces? à rattacher`));
  await verifierLEtape(page, journal, 'rattachement proposé, confirmé');

  // Le rattachement est retiré : la ferme du parcours revient à son départ.
  const formulaire = tomate.getByRole('group', { name: 'Rattachement de l’espèce Tomate' });
  await ouvrirParClic(tomate.locator('summary').first(), formulaire);
  await formulaire.getByRole('button', { name: 'Retirer le rattachement' }).click();
  await expect(section.getByRole('status')).toHaveText('Le rattachement de l’espèce est retiré : elle est de nouveau non rattachée.');
  await expect(compteur.locator('strong')).toContainText(`${avant} espèce`);

  // Cas 10 : sans sol saisi, chaque jardin est inconnu et porte « Observer », qui ouvre son curseur.
  await attendreLaPageIrrigation(page, 'sol');
  const reserve = page.locator('section.soil-reserve');
  const ligne = reserve.locator('.soil-garden-line').filter({ has: page.locator('details.soil-garden > summary strong', { hasText: /^Tunnel 1 · abri$/ }) });
  await expect(ligne.locator('details.soil-garden > summary small')).toHaveText('inconnue');
  const observer = ligne.getByRole('button', { name: 'Observer l’abri Tunnel 1' });
  if (telephone) await verifierCibleTactile(observer, 'Le bouton « Observer »');
  await expect(reserve.locator('.soil-garden-line[data-observe="true"]')).not.toHaveCount(0);
  await expect(async () => {
    await observer.click();
    await expect(ligne.getByRole('group', { name: 'Observer l’abri' }).getByRole('slider')).toBeFocused({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(ligne.locator('details.soil-garden')).toHaveAttribute('open', '');
  await verifierLEtape(page, journal, '« Observer » ouvre le curseur du jardin inconnu');

  // Cas 11 : trois modèles, l'état de cet appareil, la note du gel repliée.
  await attendreLaPageIrrigation(page, 'alertes-meteo');
  const encart = page.locator('#weather-alerts');
  await encart.scrollIntoViewIfNeeded();
  await expect(encart.locator('.weather-alert-device')).toContainText('appareils de l’exploitation où les alertes sont activées');
  await expect(encart.locator('.weather-alert-device strong')).toHaveText(/appareil|navigateur/);
  const note = encart.locator('details.weather-alerts-margin');
  await expect(note.locator('p')).toBeHidden();
  await note.locator('summary').click();
  await expect(note.locator('p')).toContainText('Au ras du sol, il fait souvent 2 à 3 °C de moins');
  const modeles = encart.getByRole('group', { name: /^Partir d’un modèle/ });
  await expect(modeles.getByRole('button')).toHaveText(['Gel : moins de 3 °C', 'Forte chaleur : plus de 33 °C', 'Pluie : plus de 15 mm']);
  const gel = modeles.getByRole('button', { name: 'Gel : moins de 3 °C' });
  if (telephone) await verifierCibleTactile(gel, 'Le modèle « Gel »');
  const nouvelle = encart.getByRole('form', { name: 'Nouvelle alerte météo' });
  await expect(async () => {
    await gel.click();
    await expect(nouvelle).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(nouvelle.getByLabel('Surveiller')).toHaveValue('minimum-temperature');
  await expect(nouvelle.getByLabel('Sens')).toHaveValue('below');
  await expect(nouvelle.getByLabel('Seuil, en °C')).toHaveValue('3');
  await expect(nouvelle.getByLabel('Horizon')).toHaveValue('3');
  await expect(nouvelle.getByLabel('Libellé facultatif')).toHaveValue('Gel');
  await nouvelle.getByLabel('Seuil, en °C').fill('2');
  await nouvelle.getByRole('button', { name: 'Annuler' }).click();
  await expect(nouvelle).toBeHidden();
  await expect(encart.locator('.weather-alert-criterion')).toHaveCount(0);
  await expect(modeles).toBeVisible();
  await verifierLEtape(page, journal, 'modèle modifiable, rien d’enregistré sans « Enregistrer »');

  await modeles.getByRole('button', { name: 'Pluie : plus de 15 mm' }).click();
  await expect(nouvelle.getByLabel('Seuil, en mm')).toHaveValue('15');
  await nouvelle.getByRole('button', { name: 'Enregistrer l’alerte' }).click();
  await expect(encart.locator('.water-notice')).toHaveText('L’alerte météo a été ajoutée. Elle sera évaluée à chaque nouvelle prévision.');
  const pluie = encart.locator('.weather-alert-criterion').filter({ hasText: 'Pluie' });
  await expect(pluie).toContainText('Pluie prévue au-dessus de 15 mm (15 mm non compris), sur 3 jours, aujourd’hui compris');
  await expect(modeles).toHaveCount(0);
  await verifierLEtape(page, journal, 'une alerte enregistrée, plus de modèles');

  // L'alerte est supprimée : les modèles reviennent.
  const confirmer = pluie.getByRole('button', { name: 'Confirmer la suppression' });
  await ouvrirParClic(pluie.getByRole('button', { name: 'Supprimer' }), confirmer);
  await confirmer.click();
  await expect(encart.locator('.water-notice')).toHaveText('L’alerte météo a été supprimée. Ses alertes passées restent dans l’historique.');
  await expect(modeles).toBeVisible();
});
