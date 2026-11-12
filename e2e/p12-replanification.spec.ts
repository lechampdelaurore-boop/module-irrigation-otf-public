import { expect, test, type Locator, type Page, type Request } from '@playwright/test';
import { dateKeyInTimeZone } from '../lib/domain/irrigation-history/dates.ts';
import { millisecondsFromMinutes } from '../lib/domain/units.ts';
import { addDaysToDateKey, weekStartDateKey } from '../lib/domain/water-management.ts';
import { preparerMaterielArrosant } from './support/materiel.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';
import { annulerLesIrrigationsDuPlanning, carteNommee, lignesNonPlacees, montrerLaCarte, poserUnObjectifDeFerme, reglerLaPlageDuGoutteAGoutte, retirerLesObjectifs } from './support/planning.ts';

/**
 * Parcours P12 : suivre et replanifier (docs/browser-journeys-contract.md,
 * docs/replanning-contract.md « L'écran » et « Découpage et preuve de fin »).
 *
 * C'est l'écran où le plan bouge sans qu'on le lui demande. Le parcours prend
 * la part mesurable : une pluie saisie au pluviomètre et le plan recalculé
 * seul, l'en-tête nommant le déclencheur et le pli « Ce qui a changé »
 * présent ; une proposition refusée et le besoin replacé hors du créneau
 * refusé, ou « Non placé » pour créneau refusé quand la semaine n'offre plus
 * rien ; une proposition validée ; une limite journalière posée après coup,
 * la suggestion « Annuler » sur l'arrosage validé avec sa raison, listée dans
 * le pli ; la suggestion appliquée jusqu'à la disparition de l'irrigation
 * dans « À venir » et le recalcul qui suit ; la limite levée ; puis la remise
 * en état. Ce qu'il ne prouve pas : la lecture agronomique d'une vraie
 * suggestion sur la ferme, qui reste la recette réelle.
 *
 * Il reprend le dispositif de P10 : matériel sous abri — la pluie saisie n'y
 * compte pas et c'est le recalcul qui est prouvé, pas un changement de dose —,
 * objectif posé sur deux semaines, plage du goutte-à-goutte ouverte toute la
 * journée, un tunnel par largeur — le même que P10, qui y laisse sa ligne :
 * celle de P12 débite plus fort, et c'est elle qui sert la planche (R12). La
 * limite journalière est posée
 * d'aujourd'hui sans fin, pour couvrir le jour de l'arrosage validé quel qu'il
 * soit, à une valeur sous laquelle aucune dose au-dessus du minimum R4 ne
 * tient : la suggestion ne peut être qu'« Annuler ». Le refus est joué avant
 * la validation pour qu'il reste toujours une proposition à refuser, même un
 * dimanche où la semaine n'en offre qu'une ; le besoin refusé se replace plus
 * tard dans la journée ou un autre jour, et dans la dernière heure d'un
 * dimanche il n'a plus de place : la liste « Non placé » le dit alors
 * « créneau refusé » et il ne reste rien à valider, les gestes suivants ne
 * sont pas joués (docs/browser-journeys-contract.md, « l'heure où il
 * tourne »).
 */

const OBJECTIF_MM = '70';
/** Plus fort que la ligne de P10 sur la même planche : le moteur sert une planche par son matériel au débit le plus fort (R12), et les propositions vont à la ligne de P12. */
const APPORT_MM_PAR_HEURE = 12;
const PLAGE_OUVERTE = { debut: '00:00', fin: '23:59' };
const PLAGE_DE_DEPART = { debut: '06:00', fin: '22:00' };
/** Sous 0,01 m³ par jour, un goutte-à-goutte ne garde pas 3 mm (R4) sur une planche de la ferme de démonstration : la suggestion est « Annuler ». */
const LIMITE_M3 = '0,01';
const PLUIE_MM = '3';
/** Le plan se recalcule après la réponse du serveur ; la section le relit à intervalles croissants, jusqu'à 49 s. */
const RECALCUL = { timeout: millisecondsFromMinutes(1) };

test('le plan se recalcule seul après une pluie et un refus, suggère « Annuler » sous une limite posée après coup et applique la suggestion depuis l’écran, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  await attendreLaPageIrrigation(page);

  const planche = testInfo.project.name === 'telephone' ? 'T02' : 'T01';
  const { materiel } = await preparerMaterielArrosant(page, testInfo, { planche, apportMmParHeure: APPORT_MM_PAR_HEURE });
  await verifierLEtape(page, journal, 'matériel posé sous abri');

  // Chaque geste se fait sur sa page (3.8) : l'objectif et la pluie sur celle
  // des besoins, la limite et les arrosages sur celle des arrosages. Le plan se
  // recalcule sur le serveur et se relit sur la page du planning.
  await attendreLaPageIrrigation(page, 'besoins');
  await poserUnObjectifDeFerme(page, OBJECTIF_MM);
  await attendreLaPageIrrigation(page, 'planning');
  const planning = page.locator('section.planning-section');
  await planning.scrollIntoViewIfNeeded();
  await reglerLaPlageDuGoutteAGoutte(planning, PLAGE_OUVERTE);
  await verifierLEtape(page, journal, 'objectif posé, plage ouverte');

  await planning.getByRole('button', { name: /^(Calculer le plan de la semaine|Recalculer le plan)$/ }).click();
  const meta = planning.locator('.planning-meta');
  await expect(meta).toContainText('(à la demande)', { timeout: 30_000 });
  // Un filtre « has » se résout dans l'élément filtré : le sélecteur intérieur
  // part de la page, jamais de la section, sans quoi il ne trouve rien.
  const proposeesDe = (racine: Locator | Page) => racine.locator('article.planning-proposal[data-status="proposed"]').filter({ hasText: materiel });
  const proposees = () => proposeesDe(planning);
  await expect(proposees().first()).toBeVisible();
  await verifierLEtape(page, journal, 'plan calculé');

  // Une pluie saisie au pluviomètre est un événement : le plan se recalcule
  // seul, après la réponse du serveur, et l'en-tête nomme le déclencheur. Le
  // pli « Ce qui a changé » compare au calcul précédent.
  await attendreLaPageIrrigation(page, 'besoins');
  await saisirLaPluieDuJour(page, PLUIE_MM);
  await attendreLaPageIrrigation(page, 'planning');
  await expect(meta).toContainText('(après la pluie saisie au pluviomètre)', RECALCUL);
  const pli = planning.locator('details.planning-changes');
  await expect(pli.locator('summary')).toContainText('Ce qui a changé depuis le calcul du');
  await verifierLEtape(page, journal, 'plan recalculé seul après la pluie');

  // Un refus est un événement : au recalcul, le créneau refusé est évité
  // (D-030) et le besoin se place ailleurs — plus tard dans la journée ou un
  // autre jour, jamais au même créneau du même jour — ou, quand la semaine
  // n'offre plus rien, entre dans « Non placé » pour créneau refusé.
  const refusee = await carteNommee(planning, proposees().first());
  await montrerLaCarte(planning, refusee);
  const identifiantRefuse = await refusee.getAttribute('data-proposal-id');
  const creneauRefuse = await refusee.locator('.planning-proposal-time strong').innerText();
  await refusee.getByRole('button', { name: 'Refuser' }).click();
  await expect(refusee.locator('.planning-status')).toHaveText('Refusée', { timeout: 30_000 });
  await expect(meta).toContainText('(après une proposition refusée)', RECALCUL);
  const jourDuRefus = planning.locator('li.planning-day').filter({ has: page.locator(`article.planning-proposal[data-proposal-id="${identifiantRefuse}"]`) });
  await expect(proposeesDe(jourDuRefus).filter({ has: page.locator('.planning-proposal-time strong').getByText(creneauRefuse, { exact: true }) })).toHaveCount(0);
  const replace = (await proposees().count()) > 0;
  if (!replace) {
    await expect((await lignesNonPlacees(planning)).filter({ hasText: planche })).toContainText('créneau refusé');
  }
  await verifierLEtape(page, journal, replace ? 'besoin replacé après le refus' : 'besoin non placé pour créneau refusé');

  if (replace) {
    // Une proposition validée devient une irrigation planifiée ordinaire ;
    // c'est sur elle que portera la suggestion. La validation aussi fait
    // recalculer.
    const validee = await carteNommee(planning, proposees().first());
    await montrerLaCarte(planning, validee);
    await verifierCibleTactile(validee.getByRole('button', { name: 'Valider', exact: true }), 'le bouton « Valider »');
    await validee.getByRole('button', { name: 'Valider', exact: true }).click();
    await expect(validee.locator('.planning-status')).toHaveText('Validée', { timeout: 30_000 });
    await expect(meta).toContainText('(après une proposition validée)', RECALCUL);
    await verifierLEtape(page, journal, 'proposition validée');
    await attendreLaPageIrrigation(page, 'arrosages');
    const aVenir = page.locator('.upcoming-irrigations article').filter({ hasText: materiel });
    await expect(aVenir).toHaveCount(1);

    // Une limite journalière posée après coup est un événement ; sous cette
    // limite, l'arrosage validé ne tient plus : le moteur suggère « Annuler »,
    // avec la limite et ce que le jour porte pour raison, et le pli le liste.
    // Le moteur ne modifie jamais l'arrosage : la suggestion a ses deux boutons.
    await reglerLaLimiteJournaliere(page, { active: true, metresCubes: LIMITE_M3 });
    await attendreLaPageIrrigation(page, 'planning');
    await expect(meta).toContainText('(après une limite journalière changée)', RECALCUL);
    const suggestion = planning.locator('li.planning-suggestion').filter({ hasText: materiel });
    await expect(suggestion).toHaveCount(1);
    await expect(suggestion).toHaveAttribute('data-suggestion', 'cancel');
    await expect(suggestion.locator('.planning-suggestion-head strong')).toHaveText('Annuler');
    await expect(suggestion.locator('.planning-suggestion-causes')).toContainText(/limite journalière du .* : 0,01 m³ pour \d+,\d{2} m³ engagés/);
    await expect(suggestion.getByRole('button', { name: 'Garder' })).toBeVisible();
    await pli.locator('summary').click();
    await expect(pli.locator('li[data-kind="suggestion"]').filter({ hasText: materiel })).toContainText('Suggestion nouvelle : annuler');
    await verifierLEtape(page, journal, 'suggestion « Annuler » sous la limite');

    // « Appliquer » passe par l'annulation ordinaire de l'irrigation : elle
    // quitte « À venir », l'annulation fait recalculer, et la suggestion s'en va
    // avec le calcul suivant.
    const appliquer = suggestion.getByRole('button', { name: 'Appliquer' });
    await verifierCibleTactile(appliquer, 'le bouton « Appliquer »');
    await appliquer.click();
    // Le message reste dans le bandeau de la section, que la suggestion s'en aille ou non avec le recalcul (recette réelle du 31 octobre 2026).
    await expect(planning.locator('.planning-notice').filter({ hasText: 'Suggestion appliquée : l’irrigation planifiée est annulée.' })).toBeVisible({ timeout: 30_000 });
    await expect(meta).toContainText('(après une irrigation annulée)', RECALCUL);
    await expect(planning.locator('li.planning-suggestion').filter({ hasText: materiel })).toHaveCount(0);
    // La carte validée lit le réel : « Annulée », hors du compte des validées (statuts du contrat ; recette réelle du 31 octobre 2026).
    await expect(validee.locator('.planning-status')).toHaveText('Annulée');
    await expect(planning.locator('.planning-summary-card').filter({ hasText: 'Faites' })).toContainText('sur 0 validée');
    await verifierLEtape(page, journal, 'suggestion appliquée');
    await attendreLaPageIrrigation(page, 'arrosages');
    await expect(aVenir).toHaveCount(0);

    // La limite levée est un événement comme les autres.
    await reglerLaLimiteJournaliere(page, { active: false });
    await attendreLaPageIrrigation(page, 'planning');
    await expect(meta).toContainText('(après une limite journalière changée)', RECALCUL);
    await verifierLEtape(page, journal, 'limite levée');
  }

  // Remise en état : les irrigations du planning annulées s'il en reste, la
  // plage rendue, l'objectif retiré des deux semaines, la pluie du jour remise
  // à 0 mm, une mesure comme une autre. Les parcours partagent une base.
  await attendreLaPageIrrigation(page, 'arrosages');
  await annulerLesIrrigationsDuPlanning(page);
  await attendreLaPageIrrigation(page, 'planning');
  await reglerLaPlageDuGoutteAGoutte(planning, PLAGE_DE_DEPART);
  await attendreLaPageIrrigation(page, 'besoins');
  await retirerLesObjectifs(page);
  await saisirLaPluieDuJour(page, '0');
  await verifierLEtape(page, journal, 'état initial rétabli');

  // Le champ « Millimètres » montre la mesure déjà saisie du jour choisi (détail
  // de la recette 3.7, choix du porteur du 7 novembre 2026) : vide la veille,
  // sans mesure ; « 0 » aujourd'hui, une mesure comme une autre ; et de même
  // dès l'ouverture de la page.
  const pluie = page.locator('.water-management-section .water-panel').filter({ hasText: 'Pluie mesurée' });
  const aujourdhui = dateKeyInTimeZone(new Date());
  await pluie.getByLabel('Date', { exact: true }).fill(addDaysToDateKey(aujourdhui, -1));
  await expect(pluie.getByLabel('Millimètres')).toHaveValue('', { timeout: 15_000 });
  await pluie.getByLabel('Date', { exact: true }).fill(aujourdhui);
  await expect(pluie.getByLabel('Millimètres')).toHaveValue('0', { timeout: 15_000 });
  await attendreLaPageIrrigation(page, 'besoins');
  await expect(page.locator('.water-management-section .water-panel').filter({ hasText: 'Pluie mesurée' }).getByLabel('Millimètres')).toHaveValue('0');
  await verifierLEtape(page, journal, 'mesure du jour montrée dans le champ');

  // Le dernier jour choisi l'emporte (point ouvert 50) : un jour de la semaine
  // passée fait charger sa semaine, et si l'on revient à aujourd'hui avant la
  // réponse, celle-ci, arrivée en retard, ne remplace ni le champ ni la semaine
  // affichée. La réponse est retenue jusqu'après le retour à aujourd'hui, pour
  // que la course se joue à chaque passage, quel que soit le jour : sans cela,
  // elle ne se jouait que le lundi, quand la veille est dans la semaine passée.
  const pluieRouverte = page.locator('.water-management-section .water-panel').filter({ hasText: 'Pluie mesurée' });
  const semaineAffichee = page.locator('.water-week-navigation strong');
  const semaineDAujourdhui = (await semaineAffichee.textContent()) ?? '';
  const unJourDeLaSemainePassee = addDaysToDateKey(aujourdhui, -7);
  const lundiDeLaSemainePassee = weekStartDateKey(unJourDeLaSemainePassee);
  const chargeLaSemainePassee = (requete: Request) => requete.method() === 'POST' && (requete.postData() ?? '').includes(lundiDeLaSemainePassee);
  const pageDesBesoins = (adresse: URL) => adresse.pathname === '/irrigation/besoins';
  let retenue = false;
  let relacher: () => void = () => {};
  const relachee = new Promise<void>((resolve) => { relacher = resolve; });
  await page.route(pageDesBesoins, async (route) => {
    if (retenue || !chargeLaSemainePassee(route.request())) {
      await route.continue();
      return;
    }
    retenue = true;
    const reponse = await route.fetch();
    await relachee;
    await route.fulfill({ response: reponse });
  });
  await pluieRouverte.getByLabel('Date', { exact: true }).fill(unJourDeLaSemainePassee);
  await expect.poll(() => retenue).toBe(true);
  await pluieRouverte.getByLabel('Date', { exact: true }).fill(aujourdhui);
  await expect(pluieRouverte.getByLabel('Millimètres')).toHaveValue('0');
  const reponseArrivee = page.waitForResponse((reponse) => chargeLaSemainePassee(reponse.request()));
  relacher();
  await reponseArrivee;
  // La réponse lue, la page rend la main : « Enregistrer » se réactive.
  await expect(pluieRouverte.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  await expect(pluieRouverte.getByLabel('Millimètres')).toHaveValue('0');
  await expect(semaineAffichee).toHaveText(semaineDAujourdhui);
  await page.unroute(pageDesBesoins);
  await verifierLEtape(page, journal, 'réponse en retard sans effet sur le champ ni la semaine');
});

/** La pluie mesurée d'aujourd'hui, la date que le formulaire propose de lui-même. */
async function saisirLaPluieDuJour(page: Page, millimetres: string): Promise<void> {
  const panneau = page.locator('.water-management-section .water-panel').filter({ hasText: 'Pluie mesurée' });
  await panneau.scrollIntoViewIfNeeded();
  await panneau.getByLabel('Millimètres').fill(millimetres);
  await panneau.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('.water-management-section .water-notice')).toContainText('La pluie mesurée a été enregistrée.', { timeout: 15_000 });
}

/**
 * La limite journalière d'irrigation, posée d'aujourd'hui sans fin ou levée
 * sur la même période. Levée, elle reste enregistrée désactivée : l'écran et
 * le moteur la lisent comme une absence de limite.
 */
async function reglerLaLimiteJournaliere(page: Page, limite: { active: true; metresCubes: string } | { active: false }): Promise<void> {
  const panneau = page.locator('.water-management-section .water-panel').filter({ hasText: 'Limite journalière d’irrigation' });
  await panneau.scrollIntoViewIfNeeded();
  await panneau.getByLabel('Activer la limite').setChecked(limite.active);
  if (limite.active) {
    await panneau.getByLabel('m³ / jour').fill(limite.metresCubes);
    await panneau.getByLabel('Du', { exact: true }).fill(dateKeyInTimeZone(new Date()));
    await panneau.getByLabel('Au', { exact: true }).fill('');
  }
  await panneau.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('.water-management-section .water-notice')).toContainText(
    limite.active ? 'La limite journalière a été enregistrée.' : 'La limite journalière est désactivée pour cette période.',
    { timeout: 15_000 },
  );
}
