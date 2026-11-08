import { listAdoptionsForBedForUser, type StoredAdoption } from '@/db/crop-water/adoptions';
import { listEquipmentForUser } from '@/db/equipment/read';
import { listEquipmentPlacementsForUser } from '@/db/equipment-placement-repository';
import { listHydricGoalRevisionsThroughWeekForUser } from '@/db/water-management-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import { objectiveForBed } from '../domain/irrigation-needs';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '../domain/water-management';
import { earlySprinklerWarning } from '../domain/crop-water/proposal';
import { listCountedIrrigationEventsForUser } from './counted-irrigation-events';
import { getCropWaterWeekForUser, type BedCropWater } from './crop-water-week';

/**
 * La fiche d'une planche pour le besoin par culture et par stade (5 quater,
 * PR 3b) : le stade, le Kc et l'ETM du jour de chaque culture, l'objectif
 * proposé de la semaine face à l'objectif applicable — lu par la règle même
 * du besoin —, les stades qu'on peut déclarer et les adoptions passées.
 * Depuis la PR 3d : l'avertissement de l'aspersion en début de cycle.
 */
export type BedCropWaterSheet =
  | {
      available: true;
      season: number;
      bedId: string;
      today: string;
      weekStart: string;
      weekEnd: string;
      bed: BedCropWater;
      /** On n'adopte pas la proposition d'une semaine finie : elle ne compterait pour aucun jour. */
      weekOpen: boolean;
      adoptions: StoredAdoption[];
      /** « Besoin probablement sous-estimé en début de cycle », ou `null` (« Les garde-fous »). */
      sprinklerWarning: string | null;
      unusableCrops: { name: string; problems: string[] }[];
    }
  | { available: false; season: number; bedId: string; reason: 'crop-plan-not-read' | 'unknown-bed' };

export async function getBedCropWaterSheetForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  bedId: string;
  weekStart?: string;
  now?: Date;
}): Promise<BedCropWaterSheet> {
  const now = input.now ?? new Date();
  const bed = input.snapshot.beds.find((candidate) => candidate.id === input.bedId && candidate.seasons.includes(input.season));
  if (!bed) return { available: false, season: input.season, bedId: input.bedId, reason: 'unknown-bed' };
  if (!input.snapshot.cropPlan) return { available: false, season: input.season, bedId: input.bedId, reason: 'crop-plan-not-read' };
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const weekStart = weekStartDateKey(input.weekStart ?? today);
  const weekEnd = addDaysToDateKey(weekStart, 6);
  const [revisions, adoptions, sprinklerOnBed, irrigationDates] = await Promise.all([
    listHydricGoalRevisionsThroughWeekForUser(input.ownerUserId, input.season, weekStart),
    listAdoptionsForBedForUser(input.ownerUserId, input.season, bed.id),
    sprinklerPlacedOnBed(input.ownerUserId, input.season, bed.id),
    irrigationDatesOfBed(input.ownerUserId, input.season, bed.id, addDaysToDateKey(weekStart, -SPRINKLER_LOOKBACK_DAYS), weekEnd),
  ]);
  const objective = objectiveForBed(revisions, bed, weekStart, weekEnd);
  const week = await getCropWaterWeekForUser({
    ownerUserId: input.ownerUserId,
    season: input.season,
    snapshot: input.snapshot,
    weekStart,
    now,
    objectiveMmByBed: new Map([[bed.id, objective.value]]),
    bedIds: [bed.id],
  });
  return {
    available: true,
    season: input.season,
    bedId: bed.id,
    today,
    weekStart,
    weekEnd,
    bed: week.beds[0],
    weekOpen: weekEnd >= today,
    adoptions,
    sprinklerWarning: earlySprinklerWarning({ days: week.beds[0].week.days, sprinklerOnBed, irrigationDates }),
    unusableCrops: week.unusableCrops,
  };
}

/** Un arrosage des trois jours avant la semaine peut être proche du premier de la semaine. */
const SPRINKLER_LOOKBACK_DAYS = 3;

/** Une aspersion est posée sur la planche pour la saison (`docs/equipment-placement-periods-contract.md`). */
async function sprinklerPlacedOnBed(ownerUserId: string, season: number, bedId: string): Promise<boolean> {
  const [placements, equipment] = await Promise.all([
    listEquipmentPlacementsForUser(ownerUserId, season),
    listEquipmentForUser(ownerUserId),
  ]);
  const sprinklers = new Set(equipment.filter((item) => item.kind === 'sprinkler').map((item) => item.id));
  return placements.some((placement) => sprinklers.has(placement.equipmentId)
    && placement.selectedBeds.some((selected) => selected.otfBedId === bedId));
}

/** Les jours, à la ferme, des irrigations de la planche qui comptent et ne sont pas annulées, de `from` à `to`. */
async function irrigationDatesOfBed(ownerUserId: string, season: number, bedId: string, from: string, to: string): Promise<string[]> {
  const events = await listCountedIrrigationEventsForUser(ownerUserId, season);
  return events
    .filter((event) => event.status !== 'canceled' && event.equipment.applications.some((application) => application.otfBedId === bedId))
    .map((event) => event.equipment.actualStartAt ?? event.equipment.plannedStartAt)
    .filter((start): start is string => start !== null)
    .map((start) => dateKeyInTimeZone(new Date(start), FARM_TIME_ZONE))
    .filter((date) => date >= from && date <= to);
}
