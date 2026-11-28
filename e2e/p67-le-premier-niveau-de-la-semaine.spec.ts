import { expect, test, type Page } from '@playwright/test';
import { ouvrirUneFermeToutCochee, preparerLaFermeNeuve } from './support/fonctionnalites.ts';
import { preparerMaterielArrosant } from './support/materiel.ts';
import {
  attendreLaPageIrrigation,
  ouvrirLeDetailDuJour,
  ouvrirLePli,
  surveillerLaConsole,
  verifierCibleTactile,
  verifierLEtape,
} from './support/parcours.ts';
import { montrerLaCarte, poserUnObjectifDeFerme, reglerLaPlageDuGoutteAGoutte } from './support/planning.ts';

/**
 * Parcours P67 : le premier niveau de la semaine (simplification, lot S4,
 * PR 2, docs/simplification-s4-contract.md, sections 4 à 7 et 11 ; D-335 ;
 * docs/browser-journeys-contract.md), aux deux largeurs.
 *
 * Le lundi matin sur « Semaine », sur une ferme neuve, propre au parcours
 * et à la largeur, toutes les cases cochées, comme le cas mesuré du contrat
 * (section 11 : quelques jardins, peu d'arrosages à valider) : un matériel
 * posé sous abri, un objectif de ferme de 20 mm, que la planche sous abri
 * reçoit en deux arrosages de 10 mm, le plan calculé. La page se rouvre
 * telle qu'on la trouve :
 * - de haut en bas, les flèches et « Cette semaine », la ligne du plan, la
 *   phrase (« … reçus sur … visés », ce qui reste à valider), le bilan (sa
 *   barre nommée comme la phrase, trois chiffres), « Jour par jour » (sept
 *   jours, une ligne chacun), « Jardin par jardin », puis « Le détail »,
 *   fermé, dont la ligne dit ce qu'il contient ;
 * - l'eau visée est celle d'« Aujourd'hui », le même chiffre ;
 * - quand un créneau attend encore, la flèche « Semaine précédente » mène à
 *   la semaine d'avant, dite dans l'adresse, sans plan ni aucun « Valider » ;
 *   le retour du navigateur ramène à « Cette semaine » ;
 * - un créneau se valide d'un geste sur sa ligne, puis « Valider toute la
 *   semaine » valide le reste ; la phrase ne dit plus rien à valider.
 *
 * Au téléphone, les mesures de la section 11 sont relevées en annotation et
 * tenues aux bornes mesurées (section 13 du contrat) : la hauteur du premier
 * niveau, la place de la phrase, de la barre et du premier « Valider », les
 * choses à toucher, la hauteur de « Le détail » replié et déplié.
 *
 * La ferme neuve est propre au parcours : rien à remettre en état.
 */

/**
 * Deux arrosages de 50 min à 12 mm/h : un créneau se valide d'un geste, l'autre par « Valider toute
 * la semaine » ; le cas mesuré du contrat (un créneau à valider) à un créneau près.
 */
const OBJECTIF_MM = '20';
const PLAGE_OUVERTE = { debut: '00:00', fin: '23:59' };
/** Un apport franc, comme P62 : le plan propose un arrosage sur la planche sous abri. */
const APPORT_MM_PAR_HEURE = 12;

/**
 * Les bornes du téléphone, à 390 px, sur la mesure faite le 26 novembre 2026
 * (contrat, sections 11 et 13). Le contrat vise 1 700 px pour le premier
 * niveau, la phrase et la barre à moins de 400 px du haut, le premier
 * « Valider » à moins de 900 px, au plus 24 choses à toucher. Mesuré en PR 2 :
 * premier niveau 1 590 px, phrase 383, barre 621, premier « Valider » 1 123,
 * 16 choses à toucher. En PR 3, les trois gestes du bilan (« Comprendre ces
 * chiffres », « Changer l'eau visée », « Noter la pluie ») prennent deux
 * lignes de 44 px à 390 px : premier niveau 1 687 px, premier « Valider »
 * 1 221, 19 choses à toucher. La barre et le premier « Valider » ne tiennent
 * pas la cible : la ferme neuve porte « À finir » au-dessus de la page et
 * « Calcul approximatif » (sa pluie réelle manque) au-dessus du bilan ; c'est
 * dit dans la section 13, comme au lot J. Les bornes sont la mesure et 60 px,
 * la phrase ou l'encadré d'un autre jour pouvant prendre une ligne de plus ;
 * le premier niveau, sous les 1 700 px du contrat de 13 px seulement, garde
 * la même marge (F939).
 */
const BORNES = {
  premierNiveauPx: 1_750,
  phrasePx: 400,
  barrePx: 680,
  premierValiderPx: 1_280,
  chosesAToucher: 24,
} as const;

type Mesures = {
  premierNiveau: number;
  phrase: number;
  barre: number | null;
  premierValider: number | null;
  chosesAToucher: number;
  detailReplie: number;
};

/** Ce que mesure la section 11, du haut de la page. */
async function mesurer(page: Page): Promise<Mesures> {
  return page.evaluate(() => {
    const haut = (element: Element | null) => (element ? Math.round(element.getBoundingClientRect().top + window.scrollY) : null);
    const visible = (element: Element) => {
      const boite = element.getBoundingClientRect();
      return boite.width > 0 && boite.height > 0 && getComputedStyle(element).visibility !== 'hidden';
    };
    const premier = document.querySelector('.week-first-level')!;
    const valider = [...premier.querySelectorAll('button')].find((bouton) => /^Valider/.test((bouton.textContent ?? '').trim()) && visible(bouton)) ?? null;
    return {
      premierNiveau: Math.round(premier.getBoundingClientRect().height),
      phrase: haut(document.querySelector('.week-sentence'))!,
      barre: haut(document.querySelector('.week-bilan-bar')),
      premierValider: haut(valider),
      chosesAToucher: [...premier.querySelectorAll('a, button, summary, input, select')].filter(visible).length,
      detailReplie: Math.round(document.querySelector('details#le-detail')!.getBoundingClientRect().height),
    };
  });
}

/** Tous les plis de « Le détail » ouverts, le sien d'abord : sa hauteur dépliée, dite sans borne. */
async function hauteurDuDetailDeplie(page: Page): Promise<number> {
  const detail = await ouvrirLePli(page.locator('details#le-detail'));
  for (const pli of await detail.locator(':scope > .week-detail-body details:not([open])').all()) {
    if (await pli.isVisible()) await pli.locator(':scope > summary').click();
  }
  return detail.evaluate((element) => Math.round(element.getBoundingClientRect().height));
}

/** Le chiffre « visés » du bilan, tel qu'écrit. */
async function eauVisee(page: Page): Promise<string> {
  const vises = page.locator('.week-bilan-figures > div').filter({ has: page.locator('dt', { hasText: /^visés$/ }) });
  return (await vises.locator('strong').innerText()).trim();
}

test('le lundi matin sur « Semaine » : la phrase, le bilan, les jours, les jardins, un créneau puis la semaine validés', async ({ page, context }, testInfo) => {
  // La ferme neuve se prépare dans Réglages avant le parcours lui-même.
  test.setTimeout(180_000);
  const journal = surveillerLaConsole(page);
  const telephone = testInfo.project.name === 'telephone';
  await ouvrirUneFermeToutCochee(page, context, testInfo, 'p67-semaine');
  await preparerLaFermeNeuve(page);
  await attendreLaPageIrrigation(page, 'materiel');
  const planche = telephone ? 'T02' : 'T01';
  const { materiel } = await preparerMaterielArrosant(page, testInfo, { planche, apportMmParHeure: APPORT_MM_PAR_HEURE, repere: 'p67' });
  await attendreLaPageIrrigation(page, 'semaine');
  await poserUnObjectifDeFerme(page, OBJECTIF_MM);
  const planning = page.locator('section.planning-section');
  await reglerLaPlageDuGoutteAGoutte(planning, PLAGE_OUVERTE);
  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  await expect(planning.locator('.planning-meta')).toContainText('(à la demande)', { timeout: 30_000 });
  await verifierLEtape(page, journal, 'objectif posé, plan calculé');

  // La page rouverte, telle qu'on la trouve le lundi matin.
  await attendreLaPageIrrigation(page, 'semaine');
  const premier = page.locator('.week-first-level');
  const navigation = premier.getByRole('navigation', { name: 'Changer de semaine' });
  await expect(navigation.locator('.week-title')).toHaveText('Cette semaine');
  await expect(navigation.locator('.week-range')).toHaveText(/^du lundi (1er|\d{1,2})( \S+( \d{4})?)? au dimanche (1er|\d{1,2}) \S+( \d{4})?$/);
  for (const nom of ['Semaine précédente', 'Semaine suivante']) await verifierCibleTactile(navigation.getByRole('link', { name: nom }), `la flèche « ${nom} »`);
  await expect(navigation.getByRole('link', { name: 'Cette semaine' })).toHaveCount(0);
  await expect(premier.locator('.week-plan-line > p')).toHaveText(/^Plan calculé aujourd’hui à \d{1,2} h( \d{2})?/);
  await expect(premier.getByRole('button', { name: 'Recalculer le plan' })).toHaveText('Recalculer');

  // La phrase dit des faits : reçu sur visé, ce qui manque, ce qui reste à valider ; jamais un jugement.
  const phrase = premier.locator('.week-sentence');
  await expect(phrase).toHaveText(/^[\d,]+ mm (reçus|irrigués) sur [\d,]+ mm visés/);
  await expect(phrase).toContainText(/\d+ arrosages? (reste|restent) à valider\.$/);
  await expect(phrase).not.toContainText(/bien|bon|mauvais|insuffisant|suffisant|ET0|évaporation/i);
  // La barre porte le nom de la première phrase ; les trois chiffres sont écrits.
  const barre = premier.getByRole('img', { name: /^[\d,]+ mm (reçus|irrigués) sur [\d,]+ mm visés/ });
  await expect(barre).toBeVisible();
  expect((await phrase.innerText()).startsWith((await barre.getAttribute('aria-label'))!), 'la phrase commence par le nom de la barre').toBe(true);
  await expect(premier.locator('.week-bilan-figures dt')).toHaveText([/^(reçus|Eau reçue)$/, 'visés', 'arrosés']);
  const vise = await eauVisee(page);
  expect(vise).toMatch(/^[\d,]+ mm$/);
  await verifierLEtape(page, journal, 'la phrase et le bilan');

  // « Jour par jour » : sept jours, une ligne chacun ; « Jardin par jardin », un lien par jardin vers son pli.
  const jours = premier.locator('li.week-day');
  await expect(jours).toHaveCount(7);
  await expect(premier.locator('li.week-day[data-today="true"]')).toHaveCount(1);
  const jardins = premier.locator('.week-gardens li.week-garden');
  expect(await jardins.count()).toBeGreaterThan(0);
  await expect(jardins.first().locator('a.week-garden-link')).toHaveAttribute('href', /^#besoin-jardin-/);
  const detail = page.locator('details#le-detail');
  await expect(detail).not.toHaveAttribute('open', '');
  await expect(detail.locator(':scope > summary small')).toHaveText(/^\d+ jardins? · le besoin par planche · le plan · l’eau visée · la pluie · la météo · les jours( · l’écart du prévu)? · les réglages$/);
  await verifierLEtape(page, journal, 'les jours, les jardins, le détail fermé');

  // Les mesures du téléphone (section 11), avant tout geste, une fois lue la ligne « Calcul approximatif » (lue après l'affichage, F925).
  if (telephone) {
    await page.waitForLoadState('networkidle');
    const mesures = await mesurer(page);
    const deplie = await hauteurDuDetailDeplie(page);
    testInfo.annotations.push({ type: 'mesures à 390 px', description: JSON.stringify({ ...mesures, detailDeplie: deplie }) });
    expect(mesures.phrase, 'la phrase, du haut').toBeLessThanOrEqual(BORNES.phrasePx);
    expect(mesures.barre ?? 0, 'la barre, du haut').toBeLessThanOrEqual(BORNES.barrePx);
    expect(mesures.premierValider, 'un « Valider » au premier niveau').not.toBeNull();
    expect(mesures.premierValider!, 'le premier « Valider », du haut').toBeLessThanOrEqual(BORNES.premierValiderPx);
    // La hauteur et les choses à toucher valent pour le cas mesuré : deux arrosages de 50 min. Lancé après
    // 23 h, le parcours trouve une journée qui ne tient plus 50 min (la plage finit à 23 h 59) : le plan
    // propose des arrosages plus courts, un par jour qui reste, et « Jour par jour » s'allonge d'autant
    // (2 060 px pour quatre arrosages, le 26 novembre 2026 à 23 h 34). Hors jeu pour ces deux bornes, et dit
    // comme tel ; tout le reste du parcours se joue.
    const aValider = Number(/(\d+) arrosages? (?:reste|restent) à valider/.exec(await phrase.innerText())?.[1] ?? 0);
    if (aValider <= 2) {
      expect(mesures.premierNiveau, 'le premier niveau').toBeLessThanOrEqual(BORNES.premierNiveauPx);
      expect(mesures.chosesAToucher, 'les choses à toucher du premier niveau').toBeLessThanOrEqual(BORNES.chosesAToucher);
    } else {
      testInfo.annotations.push({ type: 'hors jeu', description: `${aValider} arrosages à valider au lieu de deux : la journée finit avant 50 min ; hauteur et choses à toucher non bornées ici` });
    }
    await attendreLaPageIrrigation(page, 'semaine');
  }

  // L'eau visée est celle d'« Aujourd'hui » : le même chiffre (section 4.3, S1-O1).
  await attendreLaPageIrrigation(page, 'aujourdhui');
  await ouvrirLeDetailDuJour(page);
  const tuile = page.locator('a.today-kpi').filter({ has: page.locator('.today-kpi-label', { hasText: 'Eau visée cette semaine' }) });
  await expect(tuile.locator('.today-kpi-value')).toHaveText(vise);
  await verifierLEtape(page, journal, 'la même eau visée qu’« Aujourd’hui »');

  // La semaine précédente, par la flèche, quand un créneau attend encore : l'adresse la dit ; pas de plan,
  // une ligne le dit une fois ; rien ne s'y valide.
  await attendreLaPageIrrigation(page, 'semaine');
  await expect(phrase).toContainText('à valider');
  await navigation.getByRole('link', { name: 'Semaine précédente' }).click();
  await expect(page).toHaveURL(/\/irrigation\/semaine\?(.*&)?week=\d{4}-\d{2}-\d{2}/);
  await expect(navigation.locator('.week-title')).toHaveText(/^Semaine du /);
  await expect(page.locator('main.app-shell[data-interactive="true"]')).toHaveCount(1);
  await expect(premier.locator('.week-plan-line')).toHaveCount(0);
  await expect(premier.locator('.week-plan-elsewhere')).toHaveText('Le plan ne couvre que la semaine en cours.');
  await expect(premier.locator('article.planning-proposal')).toHaveCount(0);
  // Aucun « Valider », ni d'un créneau ni de la semaine : la semaine passée ne se valide pas.
  await expect(premier.getByRole('button', { name: /^Valider/ })).toHaveCount(0);
  await expect(phrase).not.toContainText('à valider');
  await page.goBack();
  await expect(navigation.locator('.week-title')).toHaveText('Cette semaine');
  await verifierLEtape(page, journal, 'la semaine précédente et le retour');

  // Un créneau se valide d'un geste, sur sa ligne au téléphone, sur sa carte à l'ordinateur.
  await attendreLaPageIrrigation(page, 'semaine');
  const proposees = () => premier.locator('article.planning-proposal[data-status="proposed"]').filter({ hasText: materiel });
  await expect(proposees()).not.toHaveCount(0);
  const laCarte = `article.planning-proposal[data-proposal-id="${await proposees().first().getAttribute('data-proposal-id')}"]`;
  const carte = premier.locator(laCarte);
  // Un filtre `has` se lit dans l'élément filtré : la carte y est cherchée par son seul sélecteur.
  const creneau = premier.locator('.week-slot').filter({ has: page.locator(laCarte) });
  if (telephone) {
    const jour = premier.locator('li.week-day').filter({ has: page.locator(laCarte) });
    if (!(await jour.isVisible())) await premier.getByRole('button', { name: /^Jours écoulés \(\d+\)$/ }).click();
    const ligne = creneau.locator('.week-slot-line');
    await expect(ligne.locator('p > span')).toContainText(materiel);
    const valider = ligne.getByRole('button', { name: 'Valider', exact: true });
    await verifierCibleTactile(valider, 'le « Valider » de la ligne');
    await valider.click();
    await expect(ligne.locator('.planning-proposal-feedback')).toContainText('Irrigation planifiée', { timeout: 30_000 });
  } else {
    await montrerLaCarte(planning, carte);
    await carte.getByRole('button', { name: 'Valider', exact: true }).click();
  }
  await expect(carte.locator('.planning-status')).toHaveText('Validée', { timeout: 30_000 });
  await verifierLEtape(page, journal, 'un créneau validé d’un geste');

  // « Valider toute la semaine » valide ce qui reste ; la phrase ne dit plus rien à valider.
  const toute = premier.getByRole('button', { name: /^Valider toute la semaine \(\d+\)$/ });
  if (await proposees().count() > 0) {
    await verifierCibleTactile(toute, '« Valider toute la semaine »');
    await toute.click();
    await expect(proposees()).toHaveCount(0, { timeout: 30_000 });
  }
  await expect(toute).toHaveCount(0, { timeout: 30_000 });
  await expect(phrase).not.toContainText('à valider');
  await verifierLEtape(page, journal, 'la semaine validée');

});

