import { expect, test, type Locator, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { nomUnique, ouvrirPlusDOptions, preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, attendreLaPagePrete, ouvrirLesReglagesDeLaPage, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P64 : arroser en trois champs (simplification, lot S5, PR 1,
 * docs/simplification-s5-contract.md, sections 3, 7 et 11 ;
 * docs/browser-journeys-contract.md). Sur une ferme neuve propre au parcours
 * et à la largeur, toutes les cases cochées, jamais la ferme réelle : rien à
 * rendre en partant.
 *
 * - Un seul matériel prêt : « Arroser maintenant » le choisit d'office et le
 *   dit ; sans dose du jour, aucune durée n'est choisie (« — »), « − » est
 *   inactif, le bouton dit ce qui manque (« Choisissez une durée. ») ;
 *   « Plus d'options » est fermé.
 * - Deux matériels : rien de choisi (« Choisissez où arroser. ») ; chaque
 *   ligne de « Où ? » dit son type et ses planches. La hauteur du premier
 *   bloc est mesurée, sans et avec un arrosage en cours (PR 3, section 7) :
 *   sous 400 px au téléphone sans arrosage en cours ; sous 700 px avec,
 *   tenu depuis D-342 (F996, F997) : la carte de l'arrosage en cours,
 *   rangée plus serré au téléphone, le met vers 650 px avec le nom long d'un
 *   parcours (800 px avant, F910).
 * - Trois touches, sans clavier : la case ronde, « + » (30 min), « Démarrer ·
 *   fin vers … » ; la phrase du résultat dit 5 mm et 113 L ; la réponse sous
 *   le bouton, l'arrosage en cours en tête de page, le formulaire vidé.
 * - Le réglage de la durée : « + » et « − » de cinq en cinq, les pastilles
 *   « 30 min » et « 1 h » ; « Saisir en mm » fait de la durée le résultat
 *   (« soit 30 min » pour 5 mm à 10 mm/h).
 * - Une pompe trop petite, habituelle du matériel : la phrase la dit
 *   (« Avec la pompe … ») et le dépassement se lit au premier niveau, hors de
 *   « Plus d'options », qui reste fermé.
 *
 * « Saisir en mm » sur un asperseur (la planche de référence) n'est pas joué :
 * aucun parcours ne sait encore poser un asperseur ; la règle est tenue par
 * tests/simplification-s5-arroser.test.ts.
 */

/** Plus long qu'un parcours ordinaire : une ferme neuve, deux matériels, une pompe. */
test.setTimeout(240_000);

const DEBIT_DE_LA_POMPE_M3_H = '0,05';

test('arroser maintenant en trois touches : où, combien de temps, démarrer ; les précautions au premier niveau', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await ouvrirUneFermeToutCochee(page, context, testInfo, 's5-arroser');
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'materiel');
  const a = await preparerMaterielArrosant(page, testInfo, { repere: 'A' });

  // Un seul matériel prêt : choisi d'office, et dit (S5-b).
  await attendreLaPageIrrigation(page, 'arrosages');
  const formulaire = page.locator('.watering-now');
  await expect(page.getByRole('tab', { name: /^Arroser maintenant/ })).toHaveAttribute('aria-selected', 'true');
  await expect(formulaire.getByRole('radio', { name: a.materiel, exact: true })).toBeChecked();
  await expect(formulaire).toContainText('Le seul matériel prêt à arroser est choisi.');
  await expect(formulaire.locator('.watering-duration strong')).toHaveText('—');
  await expect(formulaire.getByRole('button', { name: /^Conseillé/ })).toHaveCount(0);
  await expect(formulaire.getByRole('button', { name: 'Cinq minutes de moins' })).toBeDisabled();
  await expect(formulaire.locator('.watering-missing')).toHaveText('Choisissez une durée.');
  await expect(formulaire.locator('.start-irrigation-button')).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Plus d’options/ })).toHaveAttribute('aria-expanded', 'false');
  await expect(formulaire.getByLabel('Note (facultatif)')).toBeHidden();
  // Le réglage n'est montré qu'à un matériel qui en a plusieurs.
  await expect(formulaire.locator('.watering-setting')).toHaveCount(0);
  await verifierLEtape(page, journal, 'un seul matériel, choisi d’office');

  // Un second matériel : rien de choisi, chaque ligne dit son type et ses planches.
  await attendreLaPageIrrigation(page, 'materiel');
  const b = await preparerMaterielArrosant(page, testInfo, { repere: 'B', planche: 'N02' });
  await attendreLaPageIrrigation(page, 'arrosages');
  await expect(formulaire.getByRole('radio')).toHaveCount(2);
  await expect(formulaire.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(formulaire.getByRole('radio', { name: b.materiel, exact: true })).toHaveAccessibleDescription('Goutte-à-goutte · 1 planche');
  await expect(formulaire.locator('.watering-missing')).toHaveText('Choisissez où arroser.');
  const ouSansArrosage = await hautDuPremierBloc(page);
  testInfo.annotations.push({ type: 'mesure', description: `« 1. Où ? » à ${ouSansArrosage} px du haut de la page (${testInfo.project.name}), sans arrosage en cours` });
  // Le budget de la section 7 (PR 3) : au téléphone, « Où ? » sous 400 px sans arrosage en cours.
  if (telephone) expect(ouSansArrosage, '« 1. Où ? » sous 400 px, sans arrosage en cours').toBeLessThan(400);
  testInfo.annotations.push({ type: 'mesure', description: `onglets : ${await hauteur(page.locator('.irrigation-action-tabs'))} px de haut (${testInfo.project.name})` });
  if (telephone) {
    for (const ligne of await formulaire.locator('.watering-where-row').all()) await verifierCibleTactile(ligne, 'Une ligne de « Où ? »');
    await verifierCibleTactile(page.getByRole('button', { name: /^Plus d’options/ }), '« Plus d’options »');
  }
  await verifierLEtape(page, journal, 'deux matériels, rien de choisi');

  // Le réglage de la durée, de cinq en cinq, et les pastilles.
  await formulaire.getByRole('radio', { name: a.materiel, exact: true }).check();
  const plus = formulaire.getByRole('button', { name: 'Cinq minutes de plus' });
  const moins = formulaire.getByRole('button', { name: 'Cinq minutes de moins' });
  const duree = formulaire.locator('.watering-duration strong');
  await plus.click();
  await expect(duree).toHaveText('30 min');
  await expect(formulaire.getByRole('button', { name: '30 min', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await plus.click();
  await expect(duree).toHaveText('35 min');
  await expect(formulaire.getByRole('button', { name: '30 min', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await formulaire.getByRole('button', { name: '1 h', exact: true }).click();
  await expect(duree).toHaveText('1 h');
  await moins.click();
  await expect(duree).toHaveText('55 min');
  // « Saisir en mm » : 5 mm à 10 mm/h, soit 30 min.
  const options = await ouvrirPlusDOptions(page);
  await options.getByRole('checkbox', { name: 'Saisir en mm' }).check();
  await page.getByLabel('Quantité souhaitée').fill('5');
  await expect(formulaire.locator('.watering-duration-result')).toContainText('soit 30 min');
  await options.getByRole('checkbox', { name: 'Saisir en mm' }).uncheck();
  await expect(duree).toHaveText('30 min');
  if (telephone) {
    await verifierCibleTactile(plus, '« + »');
    await verifierCibleTactile(formulaire.getByRole('button', { name: '1 h', exact: true }), 'La pastille « 1 h »');
  }
  await verifierLEtape(page, journal, 'la durée réglée au « + », au « − », aux pastilles et en mm');

  // Trois touches, sans clavier, depuis « aucun matériel choisi » : la page relue repart de rien.
  await page.reload();
  await attendreLaPagePrete(page, 'arrosages');
  await expect(formulaire.getByRole('radio', { checked: true })).toHaveCount(0);
  let touches = 0;
  await formulaire.getByRole('radio', { name: a.materiel, exact: true }).check(); touches += 1;
  await plus.click(); touches += 1;
  // 10 mm/h pendant 30 min sur N01 (30 m × 0,75 m) : 5 mm, 112,5 L.
  await expect(formulaire.locator('.watering-result').first()).toHaveText(/^Soit 5 mm sur la planche, et 113 L\.$/);
  const demarrer = page.getByRole('button', { name: new RegExp(`^Démarrer l’arrosage de ${a.materiel}, fin vers \\d{1,2} h( \\d{2})?$`) });
  await expect(demarrer).toHaveText(/^Démarrer · fin vers \d{1,2} h( \d{2})?$/);
  if (telephone) await verifierCibleTactile(demarrer, '« Démarrer »');
  await demarrer.click(); touches += 1;
  await expect(formulaire.locator('.watering-start .action-reply')).toContainText('L’irrigation a démarré.');
  await expect(page.getByLabel('Irrigations en cours')).toContainText(a.materiel);
  // La page reste ; un lien sous la réponse mène à la carte d'« Aujourd'hui » (S5-g, PR 3).
  await expect(formulaire.getByRole('link', { name: 'Voir l’arrosage en cours sur Aujourd’hui' })).toBeVisible();
  // Le formulaire vidé (F406) : rien de choisi, aucune durée.
  await expect(formulaire.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(duree).toHaveText('—');
  expect(touches, 'trois touches pour démarrer un arrosage').toBe(3);
  testInfo.annotations.push({ type: 'mesure', description: `${touches} touches, sans clavier, d’aucun matériel choisi à l’arrosage en cours (${testInfo.project.name})` });
  await page.reload();
  await attendreLaPagePrete(page, 'arrosages');
  const ouAvecArrosage = await hautDuPremierBloc(page);
  testInfo.annotations.push({ type: 'mesure', description: `« 1. Où ? » à ${ouAvecArrosage} px du haut de la page (${testInfo.project.name}), avec un arrosage en cours` });
  // Le budget de 700 px, tenu depuis D-342 (F996, F997 ; 1 011 → 800 → environ 650 px).
  if (telephone) expect(ouAvecArrosage, '« 1. Où ? » sous 700 px, avec un arrosage en cours').toBeLessThan(700);
  await verifierLEtape(page, journal, 'trois touches, la réponse sous le bouton');

  // Une pompe trop petite, habituelle du matériel B : dite dans la phrase, son dépassement au premier niveau.
  const pompe = nomUnique(testInfo, 'Pompe');
  await attendreLaPageIrrigation(page, 'ressources');
  await creerLaPompe(page, pompe);
  await choisirLaPompeHabituelle(page, b.materiel, pompe);
  await attendreLaPageIrrigation(page, 'arrosages');
  await formulaire.getByRole('radio', { name: b.materiel, exact: true }).check();
  await plus.click();
  await expect(formulaire.getByText(`Avec la pompe ${pompe}.`)).toBeVisible();
  const premierNiveau = formulaire.locator('.watering-block .hydraulic-indicator.is-exceeded');
  await expect(premierNiveau).toBeVisible();
  await expect(premierNiveau).toContainText('La pompe ne peut pas alimenter ce matériel');
  await expect(page.getByRole('button', { name: /^Plus d’options/ })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.watering-more-options .hydraulic-indicator')).toHaveCount(0);
  await verifierLEtape(page, journal, 'la pompe dite, son dépassement au premier niveau');

  // Remise en état de la ferme du parcours : l'arrosage en cours terminé.
  const enCours = page.getByLabel('Irrigations en cours');
  await enCours.getByRole('button', { name: 'Terminer l’irrigation' }).click();
  const fin = page.locator('dialog[open], [role=dialog]').filter({ hasText: 'Terminer l’irrigation' });
  await fin.getByRole('button', { name: 'Terminer l’irrigation' }).click();
  await expect(enCours).toHaveCount(0);
});

/** Le haut du titre « 1. Où ? », en pixels depuis le haut de la page. */
async function hautDuPremierBloc(page: Page): Promise<number> {
  const titre = page.getByRole('heading', { name: '1. Où ?' });
  await expect(titre).toBeVisible();
  return Math.round(await titre.evaluate((element) => element.getBoundingClientRect().top + window.scrollY));
}

async function hauteur(element: Locator): Promise<number> {
  return Math.round((await element.boundingBox())?.height ?? 0);
}

/** Une pompe sans origine, au débit trop petit pour un goutte-à-goutte de 225 L/h. */
async function creerLaPompe(page: Page, pompe: string): Promise<void> {
  await ouvrirLesReglagesDeLaPage(page); // les pompes, en bas (audit final, lot D, J2, F305)
  const formulaire = page.locator('form.pump-editor').filter({ has: page.getByRole('heading', { name: 'Nouvelle pompe' }) });
  await page.getByRole('button', { name: '+ Ajouter une pompe' }).click();
  await expect(formulaire).toBeVisible();
  await formulaire.getByLabel('Nom', { exact: true }).fill(pompe);
  await formulaire.getByLabel('Débit maximal (m³/h)').fill(DEBIT_DE_LA_POMPE_M3_H);
  await formulaire.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(formulaire).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('article.pump-card').filter({ hasText: pompe })).toContainText('Active');
}

/** La pompe habituelle d'un matériel : sa liste porte son nom, et l'écran la relit du serveur une fois enregistrée. */
async function choisirLaPompeHabituelle(page: Page, materiel: string, pompe: string): Promise<void> {
  await ouvrirLesReglagesDeLaPage(page);
  const liste = page.locator('article.pump-defaults label').filter({ hasText: materiel }).locator('select');
  await liste.selectOption({ label: pompe });
  await expect(liste.locator('option:checked')).toHaveText(pompe, { timeout: 15_000 });
  await expect(liste).toBeEnabled();
}
