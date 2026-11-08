import { listHydricGoalRevisionsThroughWeekForUser } from '@/db/water-management-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import type { CropWaterDay, Et0Nature } from '../domain/crop-water/etm';
import type { WeekProposal } from '../domain/crop-water/proposal';
import { objectiveForBed } from '../domain/irrigation-needs';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '../domain/water-management';
import { getCropWaterWeekForUser, type StageChoice } from './crop-water-week';

/**
 * La fiche d'une série pour le besoin par culture et par stade
 * (docs/crop-water-need-contract.md, « L'écran », 5 quater, PR 3e) : sur
 * chacune de ses planches, le stade, le Kc et l'ETM du jour de ses cultures,
 * et l'objectif proposé de la semaine de la planche face à son objectif
 * applicable. La proposition est celle de la planche entière, toutes ses
 * cultures comprises : elle s'adopte dans la fiche de la planche. Un stade
 * se déclare ici pour toute la série.
 */
export type SeriesBedCropWater = {
  bedId: string;
  bedName: string;
  plotName: string;
  /** Les cultures de la série sur la planche aujourd'hui ; vide quand elle n'y est pas ce jour-là. */
  crops: CropWaterDay[];
  /** Les autres séries présentes aujourd'hui sur la planche, qui entrent dans sa proposition. */
  otherSeries: string[];
  bedEtmMm: number | null;
  et0: { mm: number; nature: Et0Nature } | null;
  week: Pick<WeekProposal, 'status' | 'proposedMm' | 'objectiveMm' | 'differenceMm' | 'differencePercent' | 'adoptable'>;
};

export type SeriesCropWaterSheet =
  | {
      available: true;
      season: number;
      seriesId: string;
      seriesName: string;
      today: string;
      weekStart: string;
      weekEnd: string;
      beds: SeriesBedCropWater[];
      /** Les cultures de la série qui ont une culture de référence, et les stades qu'on peut y déclarer. */
      stageChoices: StageChoice[];
      unusableCrops: { name: string; problems: string[] }[];
    }
  | { available: false; season: number; seriesId: string; reason: 'crop-plan-not-read' | 'unknown-series' };

export async function getSeriesCropWaterSheetForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  seriesId: string;
  now?: Date;
}): Promise<SeriesCropWaterSheet> {
  const unavailable = (reason: 'crop-plan-not-read' | 'unknown-series') => ({ available: false as const, season: input.season, seriesId: input.seriesId, reason });
  const cropPlan = input.snapshot.cropPlan;
  if (!cropPlan) return unavailable('crop-plan-not-read');
  const series = cropPlan.series.find((item) => item.id === input.seriesId && item.season === input.season);
  if (!series) return unavailable('unknown-series');
  const now = input.now ?? new Date();
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const weekStart = weekStartDateKey(today);
  const weekEnd = addDaysToDateKey(weekStart, 6);
  const placed = new Set(cropPlan.places.filter((place) => place.seriesId === series.id).map((place) => place.bedId));
  const beds = input.snapshot.beds.filter((bed) => placed.has(bed.id) && bed.seasons.includes(input.season));
  const revisions = await listHydricGoalRevisionsThroughWeekForUser(input.ownerUserId, input.season, weekStart);
  const week = await getCropWaterWeekForUser({
    ownerUserId: input.ownerUserId,
    season: input.season,
    snapshot: input.snapshot,
    weekStart,
    now,
    objectiveMmByBed: new Map(beds.map((bed) => [bed.id, objectiveForBed(revisions, bed, weekStart, weekEnd).value])),
    bedIds: beds.map((bed) => bed.id),
  });
  const plots = new Map(input.snapshot.plots.map((plot) => [plot.id, plot.name]));
  const choices = new Map<string, StageChoice>();
  for (const choice of week.beds.flatMap((bed) => bed.stageChoices)) {
    if (choice.seriesId === series.id && !choices.has(choice.referenceCropId)) choices.set(choice.referenceCropId, choice);
  }
  return {
    available: true,
    season: input.season,
    seriesId: series.id,
    seriesName: series.name,
    today,
    weekStart,
    weekEnd,
    unusableCrops: week.unusableCrops,
    stageChoices: [...choices.values()],
    beds: beds.flatMap((bed) => {
      const computed = week.beds.find((candidate) => candidate.bedId === bed.id);
      if (!computed) return [];
      const present = computed.today.crops.filter((crop) => crop.status !== 'absent');
      const { status, proposedMm, objectiveMm, differenceMm, differencePercent, adoptable } = computed.week;
      return [{
        bedId: bed.id,
        bedName: bed.name,
        plotName: plots.get(bed.plotId) ?? '',
        crops: present.filter((crop) => crop.seriesId === series.id),
        otherSeries: [...new Set(present.filter((crop) => crop.seriesId !== series.id).map((crop) => crop.seriesName))],
        bedEtmMm: computed.today.etmMm,
        et0: computed.today.et0,
        week: { status, proposedMm, objectiveMm, differenceMm, differencePercent, adoptable },
      }];
    }),
  };
}
