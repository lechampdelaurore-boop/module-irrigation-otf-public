import { sortByNameNaturally } from './bed-order.ts';
import type { Bed, Plot, Zone } from './domain.ts';
import { matchesSearch } from './name-search.ts';

/**
 * Le choix du périmètre d'un objectif hydrique (audit ergonomique, point 4,
 * 3.8 quater) : au lieu d'une liste à plat de toutes les parcelles, jardins et
 * planches, des groupes — la ferme et ses parcelles d'abord, puis un groupe
 * par jardin ou abri avec ses planches —, chacun rangé dans l'ordre naturel
 * des noms, et une recherche tapée qui ne garde que ce qui correspond.
 *
 * Les valeurs restent celles d'avant (`farm`, `zone:…`, `plot:…:…`,
 * `bed:…:…:…`) : seuls l'ordre, les groupes et la recherche changent.
 */
type GoalScopeChoice = {
  value: string;
  label: string;
  /** Le libellé et ses parents : « bloc 1 » trouve les planches du jardin, « Clémentière » celles de la parcelle. */
  searchText: string;
};

export type GoalScopeChoiceGroup = {
  label: string;
  choices: GoalScopeChoice[];
};

export const FARM_SCOPE_VALUE = 'farm';
const FARM_GROUP_LABEL = 'Ferme et parcelles';

type SeasonSnapshot = {
  zones: readonly Zone[];
  plots: readonly Plot[];
  beds: readonly Bed[];
};

export function goalScopeChoiceGroups(snapshot: SeasonSnapshot, season: number): GoalScopeChoiceGroup[] {
  const zones = sortByNameNaturally(snapshot.zones.filter((zone) => zone.seasons.includes(season)), (zone) => zone.name, (zone) => zone.id);
  const severalZones = zones.length > 1;
  const farmGroup: GoalScopeChoiceGroup = {
    label: FARM_GROUP_LABEL,
    choices: [
      { value: FARM_SCOPE_VALUE, label: 'Toute la ferme', searchText: 'Toute la ferme' },
      ...zones.map((zone) => ({ value: `zone:${zone.id}`, label: `Parcelle · ${zone.name}`, searchText: `Parcelle ${zone.name}` })),
    ],
  };
  const plotGroups = zones.flatMap((zone) => {
    const plots = sortByNameNaturally(
      snapshot.plots.filter((plot) => plot.zoneId === zone.id && plot.seasons.includes(season)),
      (plot) => plot.name,
      (plot) => plot.id,
    );
    return plots.map((plot): GoalScopeChoiceGroup => {
      const parents = `${zone.name} ${plot.name}`;
      const beds = sortByNameNaturally(
        snapshot.beds.filter((bed) => bed.plotId === plot.id && bed.seasons.includes(season)),
        (bed) => bed.name,
        (bed) => bed.id,
      );
      return {
        label: severalZones ? `${plot.name} · ${zone.name}` : plot.name,
        choices: [
          { value: `plot:${zone.id}:${plot.id}`, label: `Jardin / abri · ${plot.name}`, searchText: `Jardin abri ${parents}` },
          ...beds.map((bed) => ({
            value: `bed:${zone.id}:${plot.id}:${bed.id}`,
            label: `Planche · ${bed.name}`,
            searchText: `Planche ${bed.name} ${parents}`,
          })),
        ],
      };
    });
  });
  return [farmGroup, ...plotGroups];
}

/**
 * Les groupes réduits à ce que la recherche trouve. Le choix en cours reste
 * toujours dans la liste, pour que la liste montre ce qui est choisi ; un
 * groupe sans choix disparaît.
 */
export function filterGoalScopeChoices(
  groups: readonly GoalScopeChoiceGroup[],
  query: string,
  selectedValue: string,
): GoalScopeChoiceGroup[] {
  return groups
    .map((group) => ({
      label: group.label,
      choices: group.choices.filter((choice) => choice.value === selectedValue || matchesSearch(choice.searchText, query)),
    }))
    .filter((group) => group.choices.length > 0);
}

/** Le nombre de choix que la recherche trouve, le choix en cours compté seulement s'il correspond. */
export function countGoalScopeMatches(groups: readonly GoalScopeChoiceGroup[], query: string): number {
  return groups.reduce((total, group) => total + group.choices.filter((choice) => matchesSearch(choice.searchText, query)).length, 0);
}
