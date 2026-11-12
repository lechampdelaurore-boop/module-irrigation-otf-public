import { expect, test } from '@playwright/test';
import { choisirMaterielEtReglage, horodatageLocal, preparerMaterielArrosant, soumettreIrrigation } from './support/materiel.ts';
import { trouverLaFiche } from './support/historique.ts';
import { attendreLaPageIrrigation, surveillerLaConsole, verifierLEtape } from './support/parcours.ts';

/**
 * Parcours P4 : consulter les cumuls et exporter le CSV
 * (docs/browser-journeys-contract.md).
 *
 * C'est la mémoire de la ferme : ce qui a été arrosé, quand, et combien. Le
 * parcours enregistre d'abord une irrigation pour que l'historique ait quelque
 * chose à montrer, puis change de période, ouvre un détail et récupère le
 * fichier exporté.
 */
test('les cumuls suivent la période choisie, un détail s’ouvre et le CSV s’exporte en UTF-8', async ({ page }, testInfo) => {
  const journal = surveillerLaConsole(page);
  // Un seul « maintenant » par parcours : toutes les dates en découlent.
  const reference = Date.now();
  await attendreLaPageIrrigation(page);

  const { materiel, reglage } = await preparerMaterielArrosant(page, testInfo);
  // Les irrigations se saisissent sur la page des arrosages (3.8).
  await attendreLaPageIrrigation(page, 'arrosages');

  // Une irrigation d'une demi-heure, finie à la minute précédente : une période
  // la compte dès qu'elle la chevauche, et elle chevauche la semaine, le mois et
  // la saison en cours quelle que soit l'heure, le lundi peu après minuit compris
  // (docs/browser-journeys-contract.md, « Reproductibilité », point ouvert 49).
  await page.getByRole('tab', { name: /^Déjà réalisée/ }).click();
  await choisirMaterielEtReglage(page, materiel, reglage);
  await page.getByLabel('Début réel').fill(horodatageLocal(-31, reference));
  await page.getByLabel('Fin réelle').fill(horodatageLocal(-1, reference));
  // Recharger avant la fin de l'action serveur l'interromprait, et l'irrigation
  // n'existerait jamais : on attend donc sa confirmation.
  await soumettreIrrigation(page, 'Enregistrer l’irrigation réalisée', 'parcours cumuls');

  // Les cumuls ont leur page, rendue par le serveur : l'ouvrir après
  // l'enregistrement les montre à jour.
  await attendreLaPageIrrigation(page, 'historique');

  const historique = page.locator('.irrigation-history-dashboard');
  await historique.scrollIntoViewIfNeeded();
  await expect(historique.getByRole('heading', { name: 'Cumuls et historique' })).toBeVisible();
  // Les parcours précédents ont laissé leurs irrigations dans la même
  // semaine : la fiche peut être au-delà de la première page.
  const fiche = await trouverLaFiche(historique, materiel);
  await verifierLEtape(page, journal, 'historique de la semaine');

  // La période change le périmètre sans faire disparaître l'irrigation, qui
  // appartient aussi au mois et à la saison. Les cumuls se rechargent par une
  // action serveur : le lien d'export, calculé depuis sa réponse, prouve que
  // la nouvelle période est arrivée avant qu'on y cherche la fiche.
  const lienExport = historique.getByRole('link', { name: 'Exporter CSV' });
  for (const [periode, mode] of [['Mois', 'month'], ['Saison', 'season']] as const) {
    await historique.getByRole('tab', { name: periode, exact: true }).click();
    await expect(historique.getByRole('tab', { name: periode, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(lienExport).toHaveAttribute('href', new RegExp(`mode=${mode}`));
    await trouverLaFiche(historique, materiel);
    await verifierLEtape(page, journal, `historique sur la période « ${periode} »`);
  }

  // Le détail d'une irrigation s'ouvre sur place.
  await fiche.locator('summary').click();
  await expect(fiche).toHaveAttribute('open', '');
  await verifierLEtape(page, journal, 'détail d’une irrigation ouvert');

  // L'export : le lien réel de la page, suivi jusqu'au fichier.
  const adresse = await lienExport.getAttribute('href');
  expect(adresse, 'le lien d’export porte une adresse').not.toBeNull();
  const reponse = await page.request.get(adresse!);
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()['content-type']).toContain('charset=utf-8');
  expect(reponse.headers()['content-disposition']).toContain('attachment');

  const contenu = await reponse.text();
  const enTete = contenu.split('\n')[0];
  // Les accents doivent survivre à l'export : un CSV mal encodé est illisible
  // dans un tableur, et c'est la première chose que le porteur y verrait.
  expect(enTete).toContain('é');
  expect(contenu).toContain(materiel);
  await verifierLEtape(page, journal, 'export CSV récupéré');
});
