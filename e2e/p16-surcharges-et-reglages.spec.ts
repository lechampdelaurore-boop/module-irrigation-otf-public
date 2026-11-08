import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P16 : les surcharges de Kc et les réglages du calcul sur la page
 * « Coefficients culturaux » (docs/crop-water-need-contract.md, « Les
 * facteurs », « L'écran », 5 quater, PR 3c).
 *
 * Le parcours surcharge un Kc d'une culture de référence — le melon sur
 * ordinateur, la courgette sur téléphone —, lit la valeur de la ferme à côté
 * de celle de la source, puis revient à la valeur de la source ; règle le
 * K_abri du tunnel puis le remet à 0,80 ; paille une planche puis la
 * dépaille ; active l'ombrage, pose un filet sur une planche et le retire le
 * jour même, puis désactive l'ombrage.
 *
 * Une surcharge et un K_abri sont des révisions datées qui ne s'effacent pas,
 * et les parcours partagent une base : chaque réglage revient à une valeur
 * sans effet sur le calcul (valeur de la source, 0,80, sans paillage, filet
 * retiré, option désactivée). Les vérifications portent sur ce que le geste
 * vient d'enregistrer, jamais sur l'état de départ.
 *
 * Ce qu'il ne prouve pas : l'effet de chaque facteur sur l'ETM, prouvé par les
 * tests du domaine (tests/crop-water-etm.test.ts).
 */

const CAS = {
  ordinateur: { culture: 'Melon', planche: 'T01' },
  telephone: { culture: 'Courgette', planche: 'T02' },
} as const;

test('un Kc se surcharge et revient à la source, et le K_abri, le paillage, l’ombrage et un filet se règlent, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  const cas = CAS[testInfo.project.name as keyof typeof CAS];
  const journal = surveillerLaConsole(page);
  // Les Kc et les réglages du calcul sont sur la page « Besoin par culture » (3.8).
  await attendreLaPageIrrigation(page, 'cultures');
  const section = page.locator('section.crop-coefficients');
  const statut = section.getByRole('status');

  // Surcharger le premier Kc de la culture, puis revenir à la valeur de la source.
  const carte = section.locator('details.reference-crop-card').filter({ has: page.locator('summary strong', { hasText: new RegExp(`^${cas.culture}$`) }) });
  await expect(carte).toHaveCount(1);
  await carte.scrollIntoViewIfNeeded();
  const ouvrirFormulaire = carte.locator('details.kc-override-form-wrap > summary');
  await ouvrirParClic(carte.locator('summary').first(), ouvrirFormulaire);
  const formulaire = carte.getByRole('group', { name: `Surcharger un Kc · ${cas.culture}` });
  await ouvrirParClic(ouvrirFormulaire, formulaire);
  const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer la surcharge' });
  await expect(async () => {
    await formulaire.getByLabel('Kc de la ferme').fill('');
    await formulaire.getByLabel('Kc de la ferme').fill('0,35');
    await expect(enregistrer).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await verifierCibleTactile(enregistrer, 'Le bouton « Enregistrer la surcharge »');
  await enregistrer.click();
  await expect(statut).toHaveText('La surcharge du Kc est enregistrée.');
  await expect(carte.getByRole('list', { name: `Surcharges de Kc · ${cas.culture}` })).toContainText('aujourd’hui 0,35, valeur de la ferme');
  await expect(carte.locator('summary').first()).toContainText('1 Kc surchargé');
  await verifierLEtape(page, journal, 'Kc surchargé');

  await formulaire.getByLabel('Revenir à la valeur de la source').check();
  await formulaire.getByRole('button', { name: 'Enregistrer la surcharge' }).click();
  await expect(statut).toHaveText('Le retour à la valeur de la source est enregistré.');
  await expect(carte.getByRole('list', { name: `Surcharges de Kc · ${cas.culture}` })).toContainText('valeur de la source');
  await expect(carte.locator('summary').first()).not.toContainText('surchargé');
  await verifierLEtape(page, journal, 'retour à la valeur de la source');

  // Le K_abri du tunnel.
  const reglages = section.locator('section.crop-water-settings');
  await reglages.scrollIntoViewIfNeeded();
  await expect(reglages.getByRole('heading', { name: 'Réglages du calcul' })).toBeVisible();
  // Un seul tableau et un seul formulaire pour les abris (audit ergonomique, lot 3, point 8).
  const abri = reglages.getByRole('group', { name: 'Régler un K_abri' });
  const abris = reglages.getByRole('table', { name: 'K_abri des abris' });
  for (const [saisie, attendu] of [['0,7', '0,70'], ['0,8', '0,80']] as const) {
    await abri.getByRole('combobox').selectOption({ label: 'Tunnel 1' });
    await abri.getByLabel('Nouveau K_abri').fill(saisie);
    const bouton = abri.getByRole('button', { name: 'Enregistrer le K_abri' });
    await verifierCibleTactile(bouton, 'Le bouton « Enregistrer le K_abri »');
    await bouton.click();
    await expect(statut).toHaveText('Le K_abri de Tunnel 1 est enregistré.');
    await expect(abris.getByRole('row').filter({ hasText: 'Tunnel 1' })).toContainText(`${attendu}, valeur de la ferme`);
  }
  await verifierLEtape(page, journal, 'K_abri réglé');

  // Le paillage plastique d'une planche du tunnel.
  const paillage = reglages.locator('details.crop-water-settings-block');
  const planchePaillee = paillage.getByLabel(`Planche ${cas.planche}`);
  await ouvrirParClic(paillage.locator('summary'), planchePaillee);
  // La case suit ce qui est enregistré : elle se coche quand le serveur a répondu.
  await planchePaillee.click();
  await expect(statut).toHaveText(`La planche ${cas.planche} porte un paillage plastique.`);
  await expect(planchePaillee).toBeChecked();
  await planchePaillee.click();
  await expect(statut).toHaveText(`La planche ${cas.planche} n’a plus de paillage plastique.`);
  await expect(planchePaillee).not.toBeChecked();
  await verifierLEtape(page, journal, 'paillage réglé');

  // L'ombrage : activer l'option, poser un filet, le retirer, désactiver l'option.
  const options = reglages.getByRole('group', { name: 'Options du calcul' });
  const enregistrerOptions = options.getByRole('button', { name: 'Enregistrer les options' });
  await options.getByLabel(/Ombrage/).check();
  await verifierCibleTactile(enregistrerOptions, 'Le bouton « Enregistrer les options »');
  await enregistrerOptions.click();
  await expect(statut).toHaveText('Les options sont enregistrées.');
  await expect(options).toContainText('Ombrage · activé');

  const filet = reglages.getByRole('group', { name: 'Poser un filet d’ombrage' });
  await filet.getByLabel('Planche').selectOption({ label: `Tunnel 1 · ${cas.planche}` });
  await filet.getByLabel('Taux, en %').fill('25');
  await filet.getByRole('button', { name: 'Poser le filet' }).click();
  await expect(statut).toHaveText(`Le filet d’ombrage de la planche ${cas.planche} est enregistré.`);
  const filets = reglages.getByRole('list', { name: 'Filets d’ombrage' });
  const posé = filets.getByRole('listitem').filter({ hasText: `Planche ${cas.planche}` }).filter({ hasText: 'toujours posé' });
  await expect(posé).toHaveCount(1);
  await expect(posé).toContainText('25 %');
  const retirer = posé.getByRole('button', { name: 'Retirer aujourd’hui' });
  await verifierCibleTactile(retirer, 'Le bouton « Retirer aujourd’hui »');
  await retirer.click();
  await expect(statut).toHaveText('Le filet est retiré ; il compte jusqu’au jour du retrait, compris.');
  await expect(filets.getByRole('listitem').filter({ hasText: `Planche ${cas.planche}` }).filter({ hasText: 'toujours posé' })).toHaveCount(0);
  await verifierLEtape(page, journal, 'filet posé puis retiré');

  await options.getByLabel(/Ombrage/).uncheck();
  await enregistrerOptions.click();
  await expect(statut).toHaveText('Les options sont enregistrées.');
  await expect(options).toContainText('Ombrage · désactivé');
  await verifierLEtape(page, journal, 'ombrage désactivé');
});
