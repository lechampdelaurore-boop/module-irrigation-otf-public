import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';
import { poserUnObjectifDeFerme, reglerLaPlageDuGoutteAGoutte } from './support/planning.ts';

/**
 * Parcours P62 : « Aujourd'hui » où l'on fait tout (simplification, lot S2,
 * docs/simplification-s2-contract.md, sections 3, 5 et 12 ;
 * docs/browser-journeys-contract.md). Sur une ferme neuve propre au parcours
 * et à la largeur, jamais la ferme réelle : rien à rendre en partant.
 *
 * PR 1, valider et démarrer :
 *
 * - une irrigation planifiée plus tard dans la journée porte un seul bouton,
 *   « Démarrer », à 50 px de haut, et « Autres choix », qui déplie « Modifier
 *   ou annuler sur « Arrosages » » et se referme à Échap, le focus rendu ;
 *   « Démarrer » la fait passer « En cours », la réponse sous sa carte ;
 *
 * - le matin de bout en bout sur la page seule : une proposition du plan du
 *   jour porte « Valider », « Démarrer tout de suite » et « Autres choix »
 *   (« Changer l'heure ou la dose », « Pas à cette heure ») ; « Pas à cette
 *   heure » se confirme d'une ligne ; « Valider » la fait passer
 *   « Planifiée », la réponse et le focus sur sa carte, sur « Démarrer » ;
 *   « Démarrer » la fait couler ; PR 2 : en cours, elle dit « Terminer » et
 *   « Reste … », « Mettre en pause » rangé dans « Autres choix » ; en pause,
 *   « Reprendre », le focus dessus ; reprise, « Terminer » ouvre la fenêtre
 *   d'« Arrosages » (« Retour » ne fait rien), et l'irrigation arrêtée en
 *   route devient ce qui reste, « Reprendre ce qui reste » : le matin de bout
 *   en bout sans quitter la page ;
 *
 * - « Démarrer tout de suite », sur une autre ferme neuve : la proposition du
 *   jour validée et démarrée d'un appui, « En cours », la réponse sous sa
 *   carte. Le démarrage refusé (le matériel coule déjà), validation gardée,
 *   demande deux propositions du même matériel le même jour, que le plan ne
 *   donne pas à coup sûr : le parcours le joue quand il y en a une seconde,
 *   et tests/db/simplification-s2-carte.test.ts le prouve toujours.
 *
 * Le matériel du matin est posé sous abri (T01, T02 au téléphone), comme
 * P12 : la pluie prévue n'y compte pas et le plan propose dès aujourd'hui.
 * L'heure où il tourne : le plan ne propose rien aujourd'hui quand la
 * journée est finie ; les gestes qui demandent une proposition du jour ne
 * sont alors pas joués, et le parcours le dit (comme P12).
 */

const OBJECTIF_MM = '70';
const PLAGE_OUVERTE = { debut: '00:00', fin: '23:59' };
/** Le débit de la ligne de P12 sur les mêmes tunnels : chaque parcours tourne sur sa ferme neuve, rien ne se partage. */
const APPORT_MM_PAR_HEURE = 12;

/** Les cartes du jour d'un matériel, par leur ton : « proposed », « planned », ou celles qui coulent. */
function cartes(page: Page, materiel: string, ton: 'proposed' | 'planned'): Locator {
  return page.locator(`#today-day [data-group="todo"] .today-irrigation[data-tone="${ton}"]`).filter({ hasText: materiel });
}

function enCours(page: Page, materiel: string): Locator {
  return page.locator('#today-day [data-group="now"] .today-irrigation').filter({ hasText: materiel });
}

/** Une carte à un bouton : un seul bouton principal, et « Autres choix » qui se déplie, se referme à Échap et rend le focus. */
async function verifierLaCarteAUnBouton(page: Page, carte: Locator, principal: string, rangés: string[], telephone: boolean): Promise<void> {
  await expect(carte.locator('[data-primary]')).toHaveCount(1);
  const bouton = carte.getByRole('button', { name: new RegExp(`^${principal} : `) });
  await expect(bouton).toHaveText(principal);
  const hauteur = (await bouton.boundingBox())?.height ?? 0;
  expect(Math.round(hauteur), `« ${principal} » mesure ${Math.round(hauteur)} px`).toBeGreaterThanOrEqual(50);
  const autres = carte.getByRole('button', { name: /^Autres choix : / });
  await expect(autres).toHaveAttribute('aria-expanded', 'false');
  for (const nom of rangés) await expect(carte.getByText(nom, { exact: true })).toBeHidden();
  if (telephone) await verifierCibleTactile(autres, '« Autres choix »');
  await autres.click();
  await expect(autres).toHaveAttribute('aria-expanded', 'true');
  for (const nom of rangés) {
    const choix = carte.getByText(nom, { exact: true });
    await expect(choix).toBeVisible();
    if (telephone) await verifierCibleTactile(choix, `« ${nom} »`);
  }
  await page.keyboard.press('Escape');
  await expect(autres).toHaveAttribute('aria-expanded', 'false');
  await expect(autres).toBeFocused();
}

test('une irrigation planifiée : « Démarrer » seul, le reste dans « Autres choix » ; démarrée, la réponse la suit', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  const reference = Date.now();
  const debut = horodatageLocal(30, reference);
  test.skip(debut.slice(0, 10) !== horodatageLocal(0, reference).slice(0, 10), 'trop près de minuit : plus d’irrigation planifiée aujourd’hui');
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'p62-planifiee');
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'materiel');
  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo, { repere: 'p62 planifiée' });
  await attendreLaPageIrrigation(page, 'arrosages');
  await page.getByRole('tab', { name: /^Planifier/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage, '5');
  await page.getByLabel('Date et heure de début').fill(debut);
  await page.getByRole('button', { name: 'Planifier l’irrigation' }).click();
  await expect(page.locator('.irrigation-preview .action-reply .irrigation-event-notice')).toHaveText(/planifiée/);

  await attendreLaPageIrrigation(page, 'aujourdhui');
  const carte = cartes(page, materiel, 'planned');
  await expect(carte).toHaveCount(1);
  await expect(carte.getByRole('button', { name: 'Démarrer maintenant' })).toHaveCount(0);
  await verifierLaCarteAUnBouton(page, carte, 'Démarrer', ['Modifier ou annuler sur « Arrosages »'], telephone);
  await verifierLEtape(page, journal, 'la carte planifiée à un bouton');

  await carte.getByRole('button', { name: /^Démarrer : / }).click();
  const coule = enCours(page, materiel);
  await expect(coule.locator('.today-status')).toHaveText('En cours');
  await expect(coule.locator('.action-reply')).toContainText('L’irrigation a démarré.');
  await expect(page.locator('.today-page')).toHaveAttribute('aria-busy', 'false');
  await expect(cartes(page, materiel, 'planned')).toHaveCount(0);
  await verifierLEtape(page, journal, 'démarrée depuis la carte, la réponse sous elle');
});

/**
 * Une ferme neuve dont le plan du jour propose un arrosage : matériel sous
 * abri (T01, T02 au téléphone), comme P12, où la pluie prévue de la météo de
 * démonstration ne repousse pas l'arrosage ; objectif posé, plage ouverte,
 * plan calculé. Rend le nom du matériel.
 */
async function preparerUnPlanDuJour(page: Page, context: BrowserContext, testInfo: TestInfo, repere: string, journal: ReturnType<typeof surveillerLaConsole>): Promise<string> {
  await ouvrirUneFermeToutCochee(page, context, testInfo, repere);
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'materiel');
  const planche = testInfo.project.name === 'telephone' ? 'T02' : 'T01';
  const { materiel } = await preparerMaterielArrosant(page, testInfo, { planche, apportMmParHeure: APPORT_MM_PAR_HEURE, repere: repere.replace('-', ' ') });
  await attendreLaPageIrrigation(page, 'besoins');
  await poserUnObjectifDeFerme(page, OBJECTIF_MM);
  await attendreLaPageIrrigation(page, 'planning');
  const planning = page.locator('section.planning-section');
  await reglerLaPlageDuGoutteAGoutte(planning, PLAGE_OUVERTE);
  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  await expect(planning.locator('.planning-meta')).toContainText('(à la demande)', { timeout: 30_000 });
  await verifierLEtape(page, journal, 'plan calculé');
  return materiel;
}

test('le matin sur la page seule : « Pas à cette heure », « Valider », « Démarrer », « Mettre en pause », « Reprendre », « Terminer »', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  const materiel = await preparerUnPlanDuJour(page, context, testInfo, 'p62-matin', journal);

  await attendreLaPageIrrigation(page, 'aujourdhui');
  const proposees = cartes(page, materiel, 'proposed');
  const aujourdhui = await proposees.count();
  test.skip(aujourdhui === 0, 'le plan ne propose rien aujourd’hui pour ce matériel (journée finie) : les gestes du jour ne sont pas joués');

  const premiere = proposees.first();
  await verifierLaCarteAUnBouton(page, premiere, 'Valider', ['Changer l’heure ou la dose', 'Pas à cette heure'], telephone);
  await expect(premiere.getByRole('button', { name: /^Démarrer tout de suite : / })).toBeVisible();
  // Replié, le lien sort de l'arbre d'accessibilité : il se lit par son attribut.
  await expect(premiere.locator('a[aria-label^="Changer l’heure ou la dose : "]')).toHaveAttribute('href', /^\/irrigation\/planning\?season=\d{4}#proposal-/);
  await expect(page.getByText('Valider au planning')).toHaveCount(0);
  await verifierLEtape(page, journal, 'la proposition à un bouton');

  // « Pas à cette heure » se confirme ; « Garder la proposition » ne fait rien.
  await premiere.getByRole('button', { name: /^Autres choix : / }).click();
  await premiere.getByRole('button', { name: /^Pas à cette heure : / }).click();
  const fenetre = page.locator('dialog.module-confirm-dialog[open]');
  await expect(fenetre).toContainText('Pas à cette heure ?');
  await expect(fenetre).toContainText('Le module cherchera une autre place pour cet arrosage.');
  await fenetre.getByRole('button', { name: 'Garder la proposition' }).click();
  await expect(fenetre).toHaveCount(0);
  await expect(proposees).toHaveCount(aujourdhui);

  // « Valider » : la proposition devient une irrigation planifiée ; la réponse la suit, le focus va sur « Démarrer ».
  const titre = (await premiere.getByRole('button', { name: /^Valider : / }).getAttribute('aria-label'))?.replace(/^Valider : /, '') ?? '';
  await premiere.getByRole('button', { name: /^Valider : / }).click();
  const planifiee = page.locator('#today-day .today-irrigation[data-tone="planned"]').filter({ has: page.getByRole('button', { name: `Démarrer : ${titre}` }) });
  await expect(planifiee).toHaveCount(1, { timeout: 30_000 });
  await expect(planifiee.locator('.action-reply')).toContainText('Validé : l’arrosage est planifié.');
  await expect(planifiee.getByRole('button', { name: `Démarrer : ${titre}` })).toBeFocused();
  await verifierLEtape(page, journal, 'validée sur la carte, la réponse et le focus sur elle');

  // « Démarrer » : elle coule, sans avoir quitté la page.
  await planifiee.getByRole('button', { name: `Démarrer : ${titre}` }).click();
  await expect(enCours(page, materiel).locator('.today-status')).toHaveText('En cours');
  await expect(page).toHaveURL(/\/irrigation\/aujourdhui/);
  await verifierLEtape(page, journal, 'démarrée sur la carte');

  // PR 2 : en cours, la carte dit « Terminer » et son compte à rebours ; « Mettre en pause » est rangé dans « Autres choix ».
  const coule = enCours(page, materiel);
  await verifierLaCarteAUnBouton(page, coule, 'Terminer', ['Mettre en pause', 'Ouvrir sur « Arrosages »'], telephone);
  await expect(coule.locator('.today-countdown')).toHaveText(/^Reste (\d+ h( \d{2})?|\d+ min)$/);
  await coule.getByRole('button', { name: /^Autres choix : / }).click();
  await coule.getByRole('button', { name: /^Mettre en pause : / }).click();
  await expect(coule.locator('.today-status')).toHaveText('En pause');
  await expect(coule.locator('.action-reply')).toContainText('L’irrigation est en pause.');
  await expect(coule.getByRole('button', { name: /^Reprendre : / })).toBeFocused();
  await expect(coule.locator('.today-countdown')).toHaveCount(0);
  await expect(coule.getByRole('button', { name: /^Terminer : / })).toBeVisible();
  await verifierLEtape(page, journal, 'en pause depuis la carte, « Reprendre » en tête');

  await coule.getByRole('button', { name: /^Reprendre : / }).click();
  const repriseA = Date.now();
  await expect(coule.locator('.today-status')).toHaveText('En cours');
  await expect(coule.locator('.action-reply')).toContainText('L’irrigation a repris.');
  await expect(coule.getByRole('button', { name: /^Terminer : / })).toBeFocused();
  await verifierLEtape(page, journal, 'reprise depuis la carte');

  // « Terminer » : la fenêtre d'« Arrosages », l'heure réelle pré-remplie ; arrêtée avant la fin, ce qui reste se lit sur la carte.
  await coule.getByRole('button', { name: /^Terminer : / }).click();
  const fin = page.getByRole('dialog', { name: 'Terminer l’irrigation' });
  await expect(fin).toContainText(`Vérifiez que la vanne de ${materiel} est fermée`);
  await expect(fin.getByLabel('Heure réelle de fin')).toHaveValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  await fin.getByRole('button', { name: 'Retour' }).click();
  await expect(fin).toHaveCount(0);
  await expect(coule.locator('.today-status')).toHaveText('En cours');
  // L'heure proposée est prise à la seconde à l'ouverture de la fenêtre : dans la seconde même de la reprise, le
  // serveur la refuserait (« ne peut pas précéder la dernière reprise »), comme sur « Arrosages ». Un vrai geste
  // prend plus de temps ; le parcours attend deux secondes après la reprise (comme P38 après le démarrage).
  await expect.poll(() => Date.now() - repriseA).toBeGreaterThan(2_000);
  await coule.getByRole('button', { name: /^Terminer : / }).click();
  await fin.getByRole('button', { name: 'Terminer l’irrigation' }).click();
  await expect(fin).toHaveCount(0);
  await expect(coule.locator('.today-status')).toHaveText('Ce qui reste d’un arrosage arrêté');
  await expect(coule.locator('.action-reply')).toContainText('L’irrigation partielle a été enregistrée. Ce qui reste est planifié.');
  await expect(coule.getByRole('button', { name: /^Reprendre ce qui reste : / })).toBeFocused();
  await expect(page).toHaveURL(/\/irrigation\/aujourdhui/);
  await verifierLEtape(page, journal, 'terminée sur la carte : valider, démarrer, terminer sans quitter la page');

  // « Démarrer tout de suite » sur une autre proposition du même matériel : validée, mais pas démarrée, le matériel coule.
  const autre = cartes(page, materiel, 'proposed').first();
  if (await autre.count() > 0) {
    await autre.getByRole('button', { name: /^Démarrer tout de suite : / }).click();
    const reponse = page.locator('#today-day .action-reply').filter({ hasText: 'Validé, mais pas démarré' });
    await expect(reponse).toContainText('L’arrosage reste planifié.');
    await verifierLEtape(page, journal, '« Démarrer tout de suite », démarrage refusé, validation gardée');
  } else {
    testInfo.annotations.push({ type: 'non joué', description: '« Démarrer tout de suite » : plus d’autre proposition aujourd’hui pour ce matériel (le refus du démarrage est prouvé par tests/db/simplification-s2-carte.test.ts)' });
  }

  // « Pas à cette heure » confirmé sur une proposition qui reste : le refus du planning, dit en tête du bloc.
  const derniere = cartes(page, materiel, 'proposed').first();
  if (await derniere.count() > 0) {
    await derniere.getByRole('button', { name: /^Autres choix : / }).click();
    await derniere.getByRole('button', { name: /^Pas à cette heure : / }).click();
    await page.locator('dialog.module-confirm-dialog[open]').getByRole('button', { name: 'Chercher une autre place' }).click();
    await expect(page.locator('#today-day .action-reply').filter({ hasText: 'Heure refusée' })).toContainText('Heure refusée : le module cherche une autre place pour cet arrosage.');
    await verifierLEtape(page, journal, '« Pas à cette heure » confirmé');
  } else {
    testInfo.annotations.push({ type: 'non joué', description: '« Pas à cette heure » confirmé : plus de proposition aujourd’hui pour ce matériel' });
  }
});

test('« Démarrer tout de suite » : la proposition du jour validée et démarrée d’un appui, la réponse sous sa carte', async ({ page, context }, testInfo) => {
  const journal = surveillerLaConsole(page);
  const materiel = await preparerUnPlanDuJour(page, context, testInfo, 'p62-tout-de-suite', journal);
  await attendreLaPageIrrigation(page, 'aujourdhui');
  const proposee = cartes(page, materiel, 'proposed').first();
  test.skip(await proposee.count() === 0, 'le plan ne propose rien aujourd’hui pour ce matériel (journée finie) : le geste du jour n’est pas joué');

  await proposee.getByRole('button', { name: /^Démarrer tout de suite : / }).click();
  const coule = enCours(page, materiel);
  await expect(coule.locator('.today-status')).toHaveText('En cours', { timeout: 30_000 });
  await expect(coule.locator('.action-reply')).toContainText('Validé. L’irrigation a démarré.');
  await expect(page).toHaveURL(/\/irrigation\/aujourdhui/);
  await verifierLEtape(page, journal, 'validée et démarrée d’un appui');
});
