import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P19 : la jauge de la réserve du sol, dans la section « Planning
 * de la semaine » (docs/soil-reserve-contract.md, « L'écran »,
 * « L'observation : le curseur », 5 ter, PR 3b).
 *
 * Le parcours saisit le sol des Prés, lit la pastille de l'eau arrosée en
 * trop, puis règle le curseur : celui de la
 * parcelle à 50 % sur ordinateur, qui règle ses jardins de plein champ, celui
 * du tunnel à 75 % sur téléphone ; lit l'observation et l'état d'une planche
 * sans culture, au % observé, avec son départ ; voit refusée une observation
 * reportée à trois jours ; déclare une bâche imperméable sur cette planche,
 * puis la rend au sol nu.
 *
 * Une observation est une donnée datée qui ne s'efface pas ; seule la jauge
 * la lit. L'état de surface revient au sol nu à la fin. Les vérifications
 * portent sur ce que le geste vient d'enregistrer, jamais sur l'état de
 * départ.
 *
 * Ce qu'il ne prouve pas : les chiffres de la jauge jour par jour, prouvés
 * par les tests du domaine (tests/soil-reserve-crop.test.ts,
 * tests/soil-reserve-bare.test.ts) et du service
 * (tests/db/soil-reserve-view.test.ts).
 */

const CAS = {
  ordinateur: {
    jardin: 'Jardin Nord',
    planche: 'N03',
    curseur: 'Observer la parcelle',
    pourcent: '50',
    message: 'L’observation de la parcelle, 50 % du plein, est enregistrée pour ses jardins de plein champ.',
  },
  telephone: {
    jardin: 'Tunnel 1 · abri',
    planche: 'T02',
    curseur: 'Observer l’abri',
    pourcent: '75',
    message: 'L’observation, 75 % du plein, est enregistrée.',
  },
} as const;

/** Le jour d'il y a trois jours à la ferme, au format d'un champ date et heure. */
function ilYATroisJours(): string {
  const jour = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() - 3 * 24 * 3_600_000));
  return `${jour}T08:00`;
}

test('le curseur règle la jauge, une planche sans culture se lit au % observé et son état de surface se déclare, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  const cas = CAS[testInfo.project.name as keyof typeof CAS];
  const journal = surveillerLaConsole(page);
  // La réserve du sol a sa page (3.8).
  await attendreLaPageIrrigation(page, 'sol');
  const section = page.locator('section.soil-reserve');
  await section.scrollIntoViewIfNeeded();
  const statut = section.getByRole('status');

  // Le sol des Prés, sans lequel la jauge reste inconnue.
  const sol = section.getByRole('region', { name: 'Sol · Les Prés' });
  await ouvrirParClic(section.locator('details.soil-settings > summary'), sol);
  const formulaire = sol.getByRole('group', { name: 'Enregistrer le sol de la parcelle' });
  await sol.locator('details.soil-record-fold > summary').first().click();
  const enregistrerLeSol = formulaire.getByRole('button', { name: 'Enregistrer le sol de la parcelle' });
  await expect(async () => {
    await formulaire.getByLabel('RFU du laboratoire (mm/m)').fill('');
    await formulaire.getByLabel('RFU du laboratoire (mm/m)').fill('62');
    await expect(enregistrerLeSol).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await formulaire.getByLabel('Part de cailloux (%)').fill('18');
  await enregistrerLeSol.click();
  await expect(statut).toHaveText('Le sol de la parcelle est enregistré.');
  await verifierLEtape(page, journal, 'sol saisi');

  // La pastille de l'eau arrosée en trop, en tête du bloc, se lit sur sept jours.
  const pastille = section.locator('details.water-surplus');
  await expect(pastille.locator(':scope > summary')).toContainText('Eau arrosée en trop sur sept jours');
  await pastille.locator(':scope > summary').click();
  await expect(pastille).toContainText('Le drainage d’un jour se partage entre la pluie et l’irrigation');
  await verifierLEtape(page, journal, 'pastille lue');

  // Le curseur : celui de la parcelle règle ses jardins de plein champ, celui de l'abri règle l'abri seul.
  const parcelle = section.getByRole('region', { name: 'Réserve · Les Prés' });
  const jardin = parcelle.locator('details.soil-garden').filter({ has: page.locator('summary strong', { hasText: new RegExp(`^${cas.jardin}$`) }) });
  await expect(jardin).toHaveCount(1);
  await jardin.locator(':scope > summary').click();
  const curseur = cas.curseur === 'Observer la parcelle'
    ? parcelle.getByRole('group', { name: cas.curseur })
    : jardin.getByRole('group', { name: cas.curseur });
  await curseur.getByRole('slider').fill(cas.pourcent);
  await expect(curseur).toContainText(`${cas.pourcent} % du plein`);
  const enregistrerObservation = curseur.getByRole('button', { name: 'Enregistrer l’observation' });
  await verifierCibleTactile(enregistrerObservation, 'Le bouton « Enregistrer l’observation »');
  await enregistrerObservation.click();
  await expect(statut).toHaveText(cas.message);
  await expect(jardin.getByRole('group', { name: /^Observer / })).toContainText(`Dernière observation : ${cas.pourcent} % du plein`);
  await verifierLEtape(page, journal, 'observation enregistrée');

  // La planche sans culture se lit au % observé, avec son départ.
  const planche = jardin.locator('details.soil-bed').filter({ has: page.locator('summary strong', { hasText: `Planche ${cas.planche}` }) });
  await planche.locator(':scope > summary').click();
  await expect(planche.locator(':scope > summary')).toContainText(`${cas.pourcent} % du plein`);
  await expect(planche).toContainText('Départ par une observation');
  await verifierLEtape(page, journal, 'planche lue');

  // Une observation reportée à trois jours est refusée, avec la règle.
  const reportee = jardin.getByRole('group', { name: /^Observer / });
  await reportee.getByLabel('plus tôt, aujourd’hui ou hier').check();
  await reportee.getByLabel('Jour et heure de l’observation').fill(ilYATroisJours());
  await reportee.getByRole('button', { name: 'Enregistrer l’observation' }).click();
  await expect(section.getByRole('alert').filter({ hasText: 'jamais plus tôt' })).toHaveText('Une observation se reporte au jour même ou à la veille, jamais plus tôt.');
  await reportee.getByLabel('maintenant', { exact: true }).check();
  await verifierLEtape(page, journal, 'observation trop ancienne refusée');

  // L'état de surface de la planche, déclaré puis rendu au sol nu.
  const surface = planche.getByRole('group', { name: `État de surface · planche ${cas.planche}` });
  const declarer = surface.getByRole('button', { name: 'Déclarer l’état' });
  await surface.getByLabel('État de surface').selectOption({ label: 'bâche imperméable' });
  await verifierCibleTactile(declarer, 'Le bouton « Déclarer l’état »');
  await declarer.click();
  await expect(statut).toHaveText(`L’état de surface de la planche ${cas.planche} est enregistré.`);
  await expect(planche.locator(':scope > summary')).toContainText('bâche imperméable');
  await expect(planche).toContainText('État de surface déclaré depuis le');
  await verifierLEtape(page, journal, 'bâche déclarée');

  await surface.getByLabel('État de surface').selectOption({ label: 'sol nu' });
  await surface.getByRole('button', { name: 'Déclarer l’état' }).click();
  await expect(statut).toHaveText(`L’état de surface de la planche ${cas.planche} est enregistré.`);
  await expect(planche.locator(':scope > summary')).toContainText('sol nu');
  await verifierLEtape(page, journal, 'sol nu rendu');
});
