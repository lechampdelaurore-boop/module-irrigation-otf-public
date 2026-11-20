import { SOIL_DEFAULTS } from '../soil-reserve/soil.ts';
import type { ResolvedOnboarding } from './steps.ts';

/**
 * Le sol à l'accueil (4.4, docs/tranche-4-contract.md, F421 ; PR 3, F584) :
 * un espace qui fait l'accueil ne reçoit plus seul l'eau évaporable d'un
 * « limon sableux » (TEW 14 mm, REW 7 mm). Il choisit la texture de chaque
 * parcelle ; TEW et REW lui sont proposés au milieu de la fourchette du
 * tableau 19 de la FAO-56, la fourchette entière dite à côté, et il les
 * ajuste (F428, réponse 1). La part de référence 2/3 (CRIIAM) et Ze 10 cm
 * (FAO-56) restent proposées, dites « proposé, à ajuster ».
 *
 * Un espace d'avant l'accueil garde ses valeurs de départ d'avant (F426), et
 * la démonstration les siennes.
 */

/**
 * Les valeurs qui préremplissent la saisie du sol d'une parcelle qui n'en a
 * pas encore. Pour un espace qui fait l'accueil : ni TEW ni REW avant le
 * choix d'une texture, et la part de référence et Ze dites proposées. Pour
 * les autres : les valeurs de départ d'avant (D-053), inchangées (F426).
 */
export type SoilStartingValues = {
  referenceShare: number;
  surfaceLayerCm: number;
  /** `null` : rien n'est proposé avant le choix d'une texture. */
  tewMm: number | null;
  rewMm: number | null;
  /** Vrai : les valeurs sont dites « proposé, à ajuster », avec leur source. */
  proposed: boolean;
};

export function soilStartingValues(onboarding: ResolvedOnboarding): SoilStartingValues {
  const { referenceShare, surfaceLayerCm, tewMm, rewMm } = SOIL_DEFAULTS;
  if (onboarding.kind !== 'onboarding') return { referenceShare, surfaceLayerCm, tewMm, rewMm, proposed: false };
  return { referenceShare, surfaceLayerCm, tewMm: null, rewMm: null, proposed: true };
}

/** La phrase des valeurs proposées d'office à un espace qui fait l'accueil (F421, réponse Q11). */
export const STARTING_VALUES_TEXT = 'Part de référence 2/3 (CRIIAM) et couche de surface Ze 10 cm (FAO-56) : proposées, à ajuster. '
  + 'TEW et REW suivent la texture choisie.';

/** Les parcelles de la saison qui n'ont encore aucun sol saisi, dans l'ordre du plan. */
export function parcelsWithoutSoil(
  zones: readonly { id: string; seasons: readonly number[] }[],
  season: number,
  zonesWithSoil: ReadonlySet<string>,
): string[] {
  return zones.filter((zone) => zone.seasons.includes(season) && !zonesWithSoil.has(zone.id)).map((zone) => zone.id);
}
