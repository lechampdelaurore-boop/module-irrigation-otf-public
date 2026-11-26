import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { dateKeyInTimeZone } from '../../lib/domain/irrigation-history/dates.ts';
import { formatIrrigationDateTimeInput } from '../../lib/domain/irrigation-format.ts';
import { millisecondsFromMinutes } from '../../lib/domain/units.ts';
import { FARM_TIME_ZONE } from '../../lib/domain/water-management.ts';
import { confirmerDansLaFenetre, ouvrirLesPlisAutour, ouvrirParClic, ouvrirLOnglet } from './parcours.ts';

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
export function nomUnique(testInfo: TestInfo, prefixe: string): string {
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
  /** `repere` distingue les matériels d'un parcours qui en pose plusieurs : « Ligne N02 p32-… ordinateur ». */
  options: { planche?: string; apportMmParHeure?: number; repere?: string } = {},
): Promise<MaterielPrepare> {
  const repere = options.repere ? ` ${options.repere}` : '';
  const materiel = nomUnique(testInfo, `Ligne${repere}`);
  const reglage = nomUnique(testInfo, `Réglage${repere}`);
  const planche = options.planche ?? 'N01';
  const apportMmParHeure = options.apportMmParHeure ?? 10;

  const fiche = page.locator('dialog[open], [role=dialog]').filter({ hasText: 'Ajouter un matériel' });
  // L'inventaire a son onglet (lot J, n° 15, F461).
  await ouvrirLOnglet(page, 'Matériel');
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
export async function choisirMaterielEtReglage(page: Page, materiel: string, reglage: string, quantite = '25'): Promise<void> {
  if (await page.locator('.watering-now').isVisible()) {
    await choisirOuArroser(page, materiel);
    // Le réglage ne se montre qu'à un matériel qui en a plusieurs (simplification S5, section 3.1).
    const reglages = page.locator('.watering-setting select');
    if ((await reglages.count()) > 0) await reglages.selectOption({ label: reglage });
    // Sans dose du jour, aucune durée n'est choisie : le parcours tape la quantité, en mm, dans « Plus d'options ».
    // « Déjà fait » n'en a pas : sa durée se lit des dates (S5, section 4).
    const dejaFait = (await page.locator('.watering-now[data-kind="completed"]').count()) > 0;
    if (!dejaFait && quantite !== '' && (await page.getByRole('button', { name: /^Conseillé/, pressed: true }).count()) === 0) await saisirEnMillimetres(page, quantite);
    return;
  }
  await page.locator('select').filter({ has: page.getByRole('option', { name: materiel }) }).selectOption({ label: materiel });
  await page.locator('select').filter({ has: page.getByRole('option', { name: reglage }) }).selectOption({ label: reglage });
  // Sans dose du jour proposée par le planning, la quantité reste vide (audit du 19 novembre 2026, lot G, n° 9, F409) :
  // le parcours la tape, comme un utilisateur.
  const champ = page.getByLabel('Quantité souhaitée');
  if (await champ.isVisible() && (await champ.inputValue()) === '') await champ.fill(quantite);
}

/** Un nom tel quel dans une expression régulière. */
function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * « 1. Où ? » d'« Arroser maintenant » (simplification S5, section 3.1) : une
 * case ronde par matériel, nommée par lui ; au-delà de six matériels prêts, la
 * liste déroulante groupée, dont chaque choix dit aussi son type et ses
 * planches (S5-c). Les parcours partagent une base : le nombre de matériels,
 * donc la forme de la liste, dépend de ceux qui ont joué avant.
 */
export async function choisirOuArroser(page: Page, materiel: string): Promise<void> {
  const formulaire = page.locator('.watering-now');
  const caseRonde = formulaire.getByRole('radio', { name: materiel, exact: true });
  if ((await caseRonde.count()) > 0) {
    await caseRonde.check();
    return;
  }
  const choix = formulaire.locator('select option').filter({ hasText: new RegExp(`^${echapper(materiel)} · `) });
  const valeur = await choix.getAttribute('value');
  if (!valeur) throw new Error(`« ${materiel} » n’est pas proposé dans « Où ? ».`);
  await formulaire.locator('.watering-where-select select').selectOption(valeur);
}

/** Ouvre « Plus d'options » du formulaire d'« Arrosages », s'il est fermé. */
export async function ouvrirPlusDOptions(page: Page): Promise<Locator> {
  const pli = page.getByRole('button', { name: /^Plus d’options/ });
  if ((await pli.getAttribute('aria-expanded')) !== 'true') await pli.click();
  await expect(pli).toHaveAttribute('aria-expanded', 'true');
  return page.locator('.watering-more-options');
}

/** « Saisir en mm », dans « Plus d'options » : la quantité se tape au premier niveau, la durée en devient le résultat. */
export async function saisirEnMillimetres(page: Page, quantite: string): Promise<void> {
  const options = await ouvrirPlusDOptions(page);
  await options.getByRole('checkbox', { name: 'Saisir en mm' }).check();
  await page.getByLabel('Quantité souhaitée').fill(quantite);
}

/**
 * « Annuler » une irrigation de la liste : rangé dans le menu « … » de sa
 * ligne, loin de « Démarrer maintenant » (audit ergonomique, lot 3,
 * point 6.4, F45). La fenêtre de confirmation du module, rouge, remplace la
 * boîte du navigateur (lot G, n° 8, F413) : le parcours confirme comme un
 * utilisateur.
 */
export async function annulerDepuisLeMenu(page: Page, ligne: Locator, action: 'Annuler' | 'Annuler ce qui reste' = 'Annuler'): Promise<void> {
  await ligne.locator('.row-menu > summary').click();
  await ligne.getByRole('menuitem', { name: action, exact: true }).click();
  await confirmerDansLaFenetre(page, action === 'Annuler' ? 'Annuler l’irrigation' : 'Annuler ce qui reste');
}

/**
 * Horodatage au format attendu par un champ « date et heure », à l'heure de la
 * ferme : la page lit ce champ à l'heure de la ferme, et la machine qui joue
 * les parcours peut être ailleurs, en UTC en intégration continue. Écrit à
 * l'heure de la machine, il reculait d'une heure en hiver et de deux en été
 * (docs/browser-journeys-contract.md, « Reproductibilité », point ouvert 49).
 *
 * `reference` est le « maintenant » du parcours, relevé une seule fois à son
 * début : deux lectures de l'horloge peuvent tomber de part et d'autre d'une
 * minute, et les durées que le parcours vérifie à la minute près changeraient
 * avec elles (docs/browser-journeys-contract.md).
 */
export function horodatageLocal(decalageMinutes: number, reference: number): string {
  return formatIrrigationDateTimeInput(new Date(reference + millisecondsFromMinutes(decalageMinutes)), FARM_TIME_ZONE);
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
  // La note est rangée dans « Plus d'options » (simplification S5, sections 3.4 et 4).
  if (await page.locator('.watering-now').isVisible()) await ouvrirPlusDOptions(page);
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
  // Dans « Ce qu'il reste à arroser », au détail de la page « Semaine » (S4, PR 2).
  await ouvrirLesPlisAutour(jardin);
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
