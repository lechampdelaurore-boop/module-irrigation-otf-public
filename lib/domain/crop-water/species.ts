import type { CropSeries } from '../domain.ts';

/**
 * La correspondance des espèces d'Ouvre ta ferme avec les cultures de
 * référence (« Quelle source pour quelle espèce », D-054).
 *
 * Elle rattache par espèce, avec une exception possible par série, quand une
 * même espèce porte des cultures conduites autrement (l'ail sec et l'aillet).
 * Une analogie est permise et dite. Une espèce sans rattachement est
 * signalée, jamais devinée ; une espèce rattachée à « sans référence » garde
 * son objectif saisi ; l'engrais vert n'est pas une culture à Kc mais l'état
 * de la surface d'une planche nue, que la réserve du sol (5 ter) lit.
 */

type CorrespondenceTarget =
  | { kind: 'reference'; referenceCropId: string; analogy: boolean }
  | { kind: 'without-reference' }
  | { kind: 'surface-state' };

export type CorrespondenceEntry = {
  plantId: string;
  /** `null` : le rattachement de l'espèce ; sinon l'exception de cette série. */
  seriesId: string | null;
  target: CorrespondenceTarget;
};

/** Le rattachement retenu pour une culture, et s'il vient d'une exception de série. */
export type ResolvedCorrespondence =
  | (CorrespondenceTarget & { exception: boolean })
  | { kind: 'missing' };

/** L'exception de la série prime sur le rattachement de l'espèce ; sans l'un ni l'autre, la correspondance manque. */
export function resolveCorrespondence(
  entries: readonly CorrespondenceEntry[],
  seriesId: string,
  plantId: string,
): ResolvedCorrespondence {
  const exception = entries.find((entry) => entry.plantId === plantId && entry.seriesId === seriesId);
  if (exception) return { ...exception.target, exception: true };
  const species = entries.find((entry) => entry.plantId === plantId && entry.seriesId === null);
  if (species) return { ...species.target, exception: false };
  return { kind: 'missing' };
}

export type SpeciesWithoutReference = {
  plantId: string;
  plantName: string;
  /** `missing` : aucun rattachement saisi ; `without-reference` : rattachée à « sans référence ». */
  reason: 'missing' | 'without-reference';
  seriesIds: string[];
};

/**
 * La liste « sans référence Kc » : les espèces des séries posées sur des
 * planches qui n'ont pas de culture de référence, par espèce et par raison,
 * avec les séries concernées. Les séries en bloc n'ont pas de planche (D-022,
 * règle 3) : elles n'y figurent pas.
 */
export function speciesWithoutReference(
  series: readonly CropSeries[],
  entries: readonly CorrespondenceEntry[],
): SpeciesWithoutReference[] {
  const listed = new Map<string, SpeciesWithoutReference>();
  for (const item of series) {
    if (item.use === 'block') continue;
    for (const cultivation of item.cultivations) {
      const resolved = resolveCorrespondence(entries, item.id, cultivation.plantId);
      if (resolved.kind !== 'missing' && resolved.kind !== 'without-reference') continue;
      const key = `${cultivation.plantId}:${resolved.kind}`;
      const entry = listed.get(key)
        ?? { plantId: cultivation.plantId, plantName: cultivation.plantName, reason: resolved.kind, seriesIds: [] };
      if (!entry.seriesIds.includes(item.id)) entry.seriesIds.push(item.id);
      listed.set(key, entry);
    }
  }
  return [...listed.values()].sort((a, b) => a.plantName.localeCompare(b.plantName, 'fr') || a.reason.localeCompare(b.reason));
}

/** Une espèce des séries d'une saison, avec son rattachement et les exceptions de ses séries. */
export type SeasonSpecies = {
  plantId: string;
  plantName: string;
  /** Les séries posées sur des planches qui portent l'espèce, par nom. */
  series: { id: string; name: string }[];
  /** Le rattachement de l'espèce ; `null` : aucun n'est saisi. */
  link: CorrespondenceEntry | null;
  /** Les exceptions des séries de la saison qui portent l'espèce. */
  exceptions: CorrespondenceEntry[];
};

/**
 * Les espèces à rattacher pour une saison : celles des séries posées sur des
 * planches, par nom ; les séries en bloc n'ont pas de planche (D-022,
 * règle 3) et ne comptent pas. Chacune porte son rattachement et les
 * exceptions de ses séries, sans rien deviner.
 */
export function seasonSpecies(
  series: readonly CropSeries[],
  entries: readonly CorrespondenceEntry[],
): SeasonSpecies[] {
  const species = new Map<string, SeasonSpecies>();
  for (const item of series) {
    if (item.use === 'block') continue;
    for (const cultivation of item.cultivations) {
      const known = species.get(cultivation.plantId) ?? {
        plantId: cultivation.plantId,
        plantName: cultivation.plantName,
        series: [],
        link: entries.find((entry) => entry.plantId === cultivation.plantId && entry.seriesId === null) ?? null,
        exceptions: [],
      };
      if (!known.series.some((candidate) => candidate.id === item.id)) known.series.push({ id: item.id, name: item.name });
      const exception = entries.find((entry) => entry.plantId === cultivation.plantId && entry.seriesId === item.id);
      if (exception && !known.exceptions.includes(exception)) known.exceptions.push(exception);
      species.set(cultivation.plantId, known);
    }
  }
  return [...species.values()]
    .map((item) => ({ ...item, series: item.series.sort((a, b) => a.name.localeCompare(b.name, 'fr')) }))
    .sort((a, b) => a.plantName.localeCompare(b.plantName, 'fr') || a.plantId.localeCompare(b.plantId));
}
