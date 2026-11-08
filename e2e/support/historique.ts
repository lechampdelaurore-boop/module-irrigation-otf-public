import { expect, type Locator } from '@playwright/test';

/**
 * Cherche la fiche d'une irrigation dans l'historique, page après page.
 *
 * L'historique montre les irrigations les plus récentes d'abord, par pages de
 * `HISTORY_PAGE_SIZE` : ce que les parcours précédents ont laissé dans la
 * période peut repousser la fiche cherchée au-delà de la première page, et
 * deux irrigations commencées à la même minute se classent dans un ordre que
 * rien ne fixe. Un parcours ne juge que ce qu'il a créé : il feuillette donc
 * jusqu'à sa fiche et s'arrête à la dernière page
 * (docs/browser-journeys-contract.md).
 *
 * À appeler sur une liste déjà à jour : après un changement de période ou de
 * périmètre, attendre d'abord une preuve de la réponse du serveur.
 */
export async function trouverLaFiche(historique: Locator, materiel: string): Promise<Locator> {
  const fiche = historique.locator('details').filter({ hasText: materiel });
  const pagination = historique.getByRole('navigation', { name: 'Pages de l’historique' });
  const suivante = pagination.getByRole('button', { name: 'Suivante →' });

  for (;;) {
    if ((await fiche.count()) > 0) return fiche;
    const position = await lirePosition(pagination);
    if (position === null || position.page >= position.pages) break;
    await expect(suivante).toBeEnabled();
    await suivante.click();
    await expect(pagination).toContainText(`Page ${position.page + 1} sur ${position.pages}`);
  }

  // La fiche n'est sur aucune page : l'échec nomme ce qui manque, après avoir
  // laissé à la dernière page le temps d'un rendu.
  await expect(fiche, `« ${materiel} » est absente de toutes les pages de l’historique`).toHaveCount(1);
  return fiche;
}

/** Lit « Page N sur M » ; `null` quand l'historique tient sur une seule page et n'affiche pas de pagination. */
async function lirePosition(pagination: Locator): Promise<{ page: number; pages: number } | null> {
  if ((await pagination.count()) === 0) return null;
  const lecture = /Page (\d+) sur (\d+)/.exec(await pagination.innerText());
  if (!lecture) return null;
  return { page: Number(lecture[1]), pages: Number(lecture[2]) };
}
