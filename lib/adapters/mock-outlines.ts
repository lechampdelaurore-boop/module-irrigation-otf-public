import type { Outline, OutlineRing } from '../domain/domain';

/**
 * Les contours de la ferme de démonstration des parcours navigateur (S3,
 * docs/satellite-view-contract.md, F211 et section 12) : inventés, sur un lieu
 * fictif près de la commune de la ferme, pour jouer les trois cas de la vue
 * satellite. « Les Prés » est dessinée en entier, parcelle et jardins ;
 * « Sous le verger » en partie, la parcelle sans son jardin ; « Le Coteau »
 * ne l'est pas. Aucune ferme réelle n'est située ici.
 */
function polygon(exterior: OutlineRing): Outline {
  return [{ exterior, holes: [] }];
}

export const MOCK_OUTLINES = {
  pres: polygon([
    [-1.701, 48.052], [-1.700328, 48.052], [-1.700247, 48.052108], [-1.700247, 48.052269],
    [-1.701, 48.052269], [-1.701, 48.052],
  ]),
  jardinNord: polygon([
    [-1.700946, 48.05209], [-1.700382, 48.05209], [-1.700382, 48.052252], [-1.700946, 48.052252],
    [-1.700946, 48.05209],
  ]),
  tunnel1: polygon([
    [-1.700946, 48.052009], [-1.700543, 48.052009], [-1.700543, 48.052081], [-1.700946, 48.052081],
    [-1.700946, 48.052009],
  ]),
  verger: polygon([
    [-1.699656, 48.052], [-1.69928, 48.052], [-1.69928, 48.052144], [-1.699656, 48.052144],
    [-1.699656, 48.052],
  ]),
} satisfies Record<string, Outline>;
