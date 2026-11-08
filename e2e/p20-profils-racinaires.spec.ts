import { expect, test } from '@playwright/test';
import { attendreLaPageIrrigation, ouvrirParClic, surveillerLaConsole, verifierCibleTactile, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P20 : le profil racinaire d'une culture sur la page « Coefficients
 * culturaux » (docs/soil-reserve-contract.md, « La profondeur racinaire et la
 * part utilisable des cultures », 5 ter, PR 3c).
 *
 * Le parcours lit le profil du jeu commun d'une culture — la carotte sur
 * ordinateur, la tomate sur téléphone —, enregistre pour la ferme une
 * profondeur de 0,25 m au premier stade, la lit à côté de celle du jeu
 * commun, puis reprend le jeu commun et l'enregistre.
 *
 * Un profil est une révision datée qui ne s'efface pas, et les parcours
 * partagent une base : le parcours finit sur un profil de la ferme aux
 * valeurs du jeu commun, sans effet sur la jauge. Les vérifications portent
 * sur ce que le geste vient d'enregistrer, jamais sur l'état de départ.
 *
 * Ce qu'il ne prouve pas : l'effet de la profondeur sur la jauge, prouvé par
 * les tests du domaine (tests/soil-reserve-crop.test.ts).
 */

const CAS = {
  ordinateur: { culture: 'Carotte', stade: 'Stade 1 · Semis → 30 j après', commun: '0,20 m' },
  telephone: { culture: 'Tomate', stade: 'Stade 1 · Plantation → Reprise', commun: '0,20 m' },
} as const;

test('le profil racinaire d’une culture se lit, se règle pour la ferme et reprend le jeu commun, sans débordement ni cible trop petite', async ({ page }, testInfo) => {
  const cas = CAS[testInfo.project.name as keyof typeof CAS];
  const journal = surveillerLaConsole(page);
  // Les profils racinaires sont sur la page « Besoin par culture » (3.8).
  await attendreLaPageIrrigation(page, 'cultures');
  const section = page.locator('section.crop-coefficients');
  const statut = section.getByRole('status');

  const carte = section.locator('details.reference-crop-card').filter({ has: page.locator('summary strong', { hasText: new RegExp(`^${cas.culture}$`) }) });
  await expect(carte).toHaveCount(1);
  await carte.scrollIntoViewIfNeeded();
  // Fermée, la carte dit qu'elle s'ouvre et résume la culture (Kc, racines, séries de la saison) :
  // à droite du nom, sous le nom au téléphone (retours du porteur du 8 novembre 2026).
  const entete = carte.locator('summary').first();
  await expect(entete.getByText('Voir le détail')).toBeVisible();
  const resume = entete.locator('.reference-crop-summary');
  await expect(resume).toHaveText(/^Kc (de )?\d,\d{2,3}( à \d,\d{2,3})? · racines (jusqu’à|:) \d,\d{2} m( proposés)? · (aucune série|\d+ séries?) de la saison$/);
  const [boiteNom, boiteResume] = await Promise.all([entete.locator('strong').boundingBox(), resume.boundingBox()]);
  if (testInfo.project.name === 'ordinateur') expect(boiteNom && boiteResume && boiteResume.x > boiteNom.x + boiteNom.width).toBe(true);
  else expect(boiteNom && boiteResume && boiteResume.y >= boiteNom.y + boiteNom.height - 1).toBe(true);
  const ouvrirFormulaire = carte.locator('details.rooting-profile-form-wrap > summary');
  await ouvrirParClic(carte.locator('summary').first(), ouvrirFormulaire);
  const profil = carte.getByRole('list', { name: `Profil racinaire · ${cas.culture}` });
  await expect(profil).toContainText('Part utilisable p');
  await expect(profil).toContainText(cas.stade);
  await verifierLEtape(page, journal, 'profil lu');

  // Une profondeur de la ferme au premier stade.
  const formulaire = carte.getByRole('group', { name: `Modifier le profil racinaire · ${cas.culture}` });
  await ouvrirParClic(ouvrirFormulaire, formulaire);
  const enregistrer = formulaire.getByRole('button', { name: 'Enregistrer le profil' });
  const premierStade = formulaire.getByRole('group', { name: cas.stade });
  await expect(async () => {
    await premierStade.getByLabel('Profondeur (m)').fill('');
    await premierStade.getByLabel('Profondeur (m)').fill('0,25');
    await formulaire.getByLabel('Source').fill('Tarière, parcours P20');
    await expect(enregistrer).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await verifierCibleTactile(enregistrer, 'Le bouton « Enregistrer le profil »');
  await enregistrer.click();
  await expect(statut).toHaveText(`Le profil racinaire est enregistré pour ${cas.culture}.`);
  await expect(profil.locator('li').filter({ hasText: cas.stade })).toContainText(`0,25 m`);
  await expect(profil.locator('li').filter({ hasText: cas.stade })).toContainText(`jeu commun : ${cas.commun}`);
  await expect(carte.locator('summary').first()).toContainText('profil racinaire de la ferme');
  await expect(carte).toContainText('Source : Tarière, parcours P20');
  await verifierLEtape(page, journal, 'profondeur de la ferme');

  // Le jeu commun repris, enregistré comme profil de la ferme.
  const reprendre = formulaire.getByRole('button', { name: 'Reprendre le jeu commun' });
  await verifierCibleTactile(reprendre, 'Le bouton « Reprendre le jeu commun »');
  await reprendre.click();
  await expect(formulaire.getByRole('group', { name: cas.stade }).getByLabel('Profondeur (m)')).toHaveValue(cas.commun.replace(' m', ''));
  await formulaire.getByRole('button', { name: 'Enregistrer le profil' }).click();
  await expect(statut).toHaveText(`Le profil racinaire est enregistré pour ${cas.culture}.`);
  await expect(profil.locator('li').filter({ hasText: cas.stade })).toContainText(cas.commun);
  await expect(profil).not.toContainText('jeu commun :');
  await verifierLEtape(page, journal, 'jeu commun repris');
});
