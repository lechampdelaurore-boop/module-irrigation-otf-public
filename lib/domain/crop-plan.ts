import type { CropPlan, Season } from './domain.ts';

/**
 * Le plan de culture restreint à une saison et aux planches connues de cette
 * saison : ce que le service sert au reste du module, que la source soit la
 * lecture réelle, déjà saisonnière, ou les données de démonstration, qui
 * couvrent plusieurs saisons. Ce qui est écarté ici a déjà été compté à la
 * lecture ; les compteurs restent ceux de la lecture.
 */
export function cropPlanForSeason(
  plan: CropPlan,
  season: Season,
  bedIds: ReadonlySet<string>,
): CropPlan {
  const series = plan.series.filter((item) => item.season === season);
  const seriesIds = new Set(series.map(({ id }) => id));
  return {
    series,
    places: plan.places.filter((place) => seriesIds.has(place.seriesId) && bedIds.has(place.bedId)),
    implantationTasks: plan.implantationTasks.filter((task) => seriesIds.has(task.seriesId)),
    readSummary: plan.readSummary,
  };
}
