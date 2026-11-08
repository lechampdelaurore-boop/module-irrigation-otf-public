import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { dateKeyInTimeZone } from '../../lib/domain/irrigation-history/dates.ts';
import { millisecondsFromMinutes } from '../../lib/domain/units.ts';
import { ouvrirParClic } from './parcours.ts';

/**
 * Création d'un matériel prêt à irriguer : une fiche, un réglage, une position
 * sur le plan. Les trois sont nécessaires, l'écran le dit lui-même lorsqu'il
 * manque l'un d'eux (« Un matériel doit posséder au moins un réglage et une
 * position sur le plan »).
 *
 * Les deux largeurs partagent une même base pendant une exécution. Chaque
 * parcours nomme donc ce qu'il crée d'après son projet, pour ne jamais retomber
 * sur ce que l'autre a laissé (docs/browser-journeys-contract.md).
 */
function nomUnique(testInfo: TestInfo, prefixe: string): string {
  // Une exécution joue chaque parcours à deux largeurs sur une même base : le
  // nom porte donc le fichier du parcours et la largeur, faute de quoi deux
  // parcours retomberaient sur le matériel l'un de l'autre.
  const parcours = (testInfo.titlePath[0] ?? 'parcours').replace('.spec.ts', '');
  return `${prefixe} ${parcours} ${testInfo.project.name}`;
}

export type MaterielPrepare = {
  materiel: string;
  reglage: string;
  planche: string;
  apportMmParHeure: number;
};

export async function preparerMaterielArrosant(
  page: Page,
  testInfo: TestInfo,
  options: { planche?: string; apportMmParHeure?: number } = {},
): Promise<MaterielPrepare> {
  const materiel = nomUnique(testInfo, 'Ligne');
  const reglage = nomUnique(testInfo, 'Réglage');
  const planche = options.planche ?? 'N01';
  const apportMmParHeure = options.apportMmParHeure ?? 10;

  const fiche = page.locator('dialog[open], [role=dialog]').filter({ hasText: 'Ajouter un matériel' });
  await ouvrirParClic(page.getByRole('button', { name: 'Ajouter un matériel' }), fiche);
  await fiche.getByLabel('Nom du matériel').fill(materiel);
  // Le bouton radio réel est masqué derrière sa présentation : un utilisateur
  // clique l'étiquette, le parcours fait de même.
  await fiche.locator('label').filter({ hasText: 'Goutte-à-goutte' }).click();
  await expect(fiche.getByRole('radio', { name: /Goutte-à-goutte/ })).toBeChecked();
  await fiche.getByRole('button', { name: 'Ajouter', exact: true }).click();
  // La fiche de l'inventaire, et non les autres endroits où le nom réapparaît,
  // comme le formulaire d'irrigation.
  const carte = page.locator('.equipment-section article').filter({ hasText: materiel });
  await expect(carte).toContainText('Goutte-à-goutte');

  // Le premier clic du parcours a prouvé que la page répond : les suivants
  // n'ont plus besoin d'être réessayés, et un menu est une bascule qu'un
  // second clic refermerait.
  await carte.getByLabel(`Actions pour ${materiel}`).click();
  await carte.getByRole('menuitem', { name: 'Configurer les réglages' }).click();
  const reglages = page.locator('dialog[open], [role=dialog]').filter({ hasText: materiel });
  await expect(reglages).toBeVisible();
  const nouveau = page.locator('dialog[open], [role=dialog]').filter({ hasText: 'Nouveau réglage' });
  await reglages.getByRole('button', { name: 'Ajouter un réglage' }).click();
  await expect(nouveau).toBeVisible();
  await nouveau.getByLabel('Nom du réglage').fill(reglage);
  await nouveau.getByLabel(/Apport uniforme/).fill(String(apportMmParHeure));
  await nouveau.getByRole('button', { name: 'Ajouter le réglage' }).click();
  await expect(reglages).toContainText(reglage);
  await reglages.getByRole('button', { name: 'Fermer' }).click();
  await expect(reglages).toBeHidden();

  await carte.getByRole('button', { name: 'Placer' }).click();
  await expect(page.getByText('Cliquez sur chaque planche alimentée par ce matériel.')).toBeVisible();
  // Le nom accessible d'une planche porte aussi ses dimensions : « Planche N01,
  // 30 m de long… ». On vise donc son début.
  await page.getByRole('button', { name: new RegExp(`^Planche ${planche},`) }).click();
  // La pose est datée du début de la saison : une irrigation saisie après coup
  // doit trouver le matériel posé à son heure de début (2.11, règle 12), et
  // P3, P4 et P9 en saisissent une commencée jusqu'à 90 minutes plus tôt.
  await page.getByLabel('Date de pose').fill(debutDeSaison());
  await page.getByRole('button', { name: 'Enregistrer la position' }).click();
  await expect(carte).toContainText(`Posé sur ${planche} depuis le`);

  return { materiel, reglage, planche, apportMmParHeure };
}

/**
 * Le 1er janvier à 0 h 00 de la saison en cours, à l'heure de la ferme, au
 * format d'un champ « date et heure ». Une pose ne se date jamais hors de sa
 * saison (règle 15) : le 1er janvier avant 1 h 30, une irrigation saisie la
 * veille tomberait avant la pose, ce que les parcours ne couvrent pas.
 */
function debutDeSaison(): string {
  return `${dateKeyInTimeZone(new Date()).slice(0, 4)}-01-01T00:00`;
}

/**
 * Le nom accessible d'une liste déroulante inclut son choix courant, donc il
 * change au fil du parcours. Chaque liste est donc désignée par le choix
 * qu'elle propose, seul repère stable.
 */
export async function choisirMaterielEtReglage(page: Page, materiel: string, reglage: string): Promise<void> {
  await page.locator('select').filter({ has: page.getByRole('option', { name: materiel }) }).selectOption({ label: materiel });
  await page.locator('select').filter({ has: page.getByRole('option', { name: reglage }) }).selectOption({ label: reglage });
}

/**
 * « Annuler » une irrigation de la liste : rangé dans le menu « … » de sa
 * ligne, loin de « Démarrer maintenant » (audit ergonomique, lot 3,
 * point 6.4, F45). La confirmation du navigateur ne change pas : le parcours
 * l'accepte comme un utilisateur.
 */
export async function annulerDepuisLeMenu(page: Page, ligne: Locator, action: 'Annuler' | 'Annuler le reliquat' = 'Annuler'): Promise<void> {
  await ligne.locator('.row-menu > summary').click();
  page.once('dialog', (fenetre) => fenetre.accept());
  await ligne.getByRole('menuitem', { name: action, exact: true }).click();
}

/**
 * Horodatage au format attendu par un champ « date et heure », en heure locale.
 *
 * `reference` est le « maintenant » du parcours, relevé une seule fois à son
 * début : deux lectures de l'horloge peuvent tomber de part et d'autre d'une
 * minute, et les durées que le parcours vérifie à la minute près changeraient
 * avec elles (docs/browser-journeys-contract.md).
 */
export function horodatageLocal(decalageMinutes: number, reference: number): string {
  const instant = new Date(reference + millisecondsFromMinutes(decalageMinutes));
  const deuxChiffres = (valeur: number) => String(valeur).padStart(2, '0');
  return `${instant.getFullYear()}-${deuxChiffres(instant.getMonth() + 1)}-${deuxChiffres(instant.getDate())}T${deuxChiffres(instant.getHours())}:${deuxChiffres(instant.getMinutes())}`;
}

/**
 * Soumet une irrigation et attend la preuve que l'action serveur a abouti.
 *
 * Les compteurs de la page ne conviennent pas : ils additionnent ce que les
 * autres parcours ont laissé sur la même base, et un parcours ne doit juger que
 * ce qu'il a créé. Le champ de note, lui, n'est vidé qu'au succès de cette
 * soumission-ci (docs/browser-journeys-contract.md).
 */
export async function soumettreIrrigation(page: Page, intitule: string | RegExp, note: string): Promise<void> {
  const champNote = page.getByLabel('Note (facultatif)');
  await champNote.fill(note);
  const bouton = page.getByRole('button', { name: intitule });
  await expect(bouton).toBeEnabled();
  await bouton.click();
  await expect(champNote).toHaveValue('');
}

/**
 * Lit, dans la carte de besoin d'une planche, la surface mouillée retenue pour
 * convertir le besoin en volume (docs/wetted-surface-contract.md, D-022). Les
 * cartes vivent dans un pli par jardin, replié au chargement, et le tableau se
 * recalcule après un placement : on attend la valeur, pas un délai.
 */
export async function verifierLaSurfaceMouillee(page: Page, planche: string, surface: string, nature: string): Promise<void> {
  // Un filtre « has » se résout dans l'élément filtré : le pli du jardin contient
  // la carte entière, la carte ne contient que son en-tête.
  const nomDansLeJardin = page.locator('article.irrigation-need-card header strong', { hasText: new RegExp(`^${planche}$`) });
  const nomDansLaCarte = page.locator('header strong', { hasText: new RegExp(`^${planche}$`) });
  const jardin = page.locator('.irrigation-needs-gardens > details').filter({ has: nomDansLeJardin });
  await jardin.scrollIntoViewIfNeeded();
  if (!(await jardin.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await jardin.locator('summary').first().click();
  }
  const calcul = page.locator('article.irrigation-need-card').filter({ has: nomDansLaCarte }).locator('details.need-calculation');
  if (!(await calcul.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await calcul.locator('summary').click();
  }
  const ligne = calcul.locator('dl > div').filter({ has: page.locator('dt', { hasText: 'Surface mouillée' }) });
  await expect(ligne).toContainText(surface, { timeout: 20_000 });
  await expect(ligne).toContainText(nature);
}
