import { listAutomaticObjectiveRevisionsForUser } from '@/db/automatic-objective-repository';
import { readCropWaterInputsForWorkspace } from '@/db/crop-water/inputs';
import { listWeatherDailyValuesForUser } from '@/db/water-management-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import type { Bed, IrrigationSnapshot, PlotMode } from '../domain/domain';
import {
  automaticObjectiveDayValues,
  automaticObjectivePeriod,
  automaticObjectiveSchedule,
  type AutomaticObjectiveDayValues,
  type AutomaticObjectiveInput,
} from '../domain/automatic-objective';
import { bedWaterDays } from '../domain/crop-water/proposal';
import { dateKeys } from '../domain/irrigation-history/dates';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '../domain/water-management';
import { weatherLocationKey } from '../domain/weather/location';
import { cropWaterBedInput, et0Readings } from './crop-water-week';
import { getEnabledFeaturesForUser } from './feature-selection-service';
import { readWeatherPreference } from './weather-preference';

/**
 * Ce que l'objectif automatique d'une ferme lit, pour une période (6 decies,
 * O2, docs/objectif-automatique-contract.md, règles 3 à 5 et 7 ; D-309,
 * D-317) : ses gestes sur le réglage, l'ET0 enregistrée, les K_abri, le
 * classement des jardins et, « Besoin par culture » cochée, le besoin de la
 * culture de chaque planche. Lu une fois et passé à chaque lecteur de
 * l'objectif — le besoin, et par lui le planning, la faisabilité et
 * « Aujourd'hui » ; l'aide du formulaire d'irrigation, les fiches d'une
 * planche et d'une série, l'écart entre prévu et réel, l'historique, les
 * séries — : aucun ne recalcule la règle de son côté.
 *
 * Rien n'est écrit : la valeur se relit depuis la météo enregistrée, l'objectif
 * du matin suit la synchronisation du matin (règle 5).
 */
type AutomaticObjectiveSource = {
  /** L'entrée d'une planche pour `objectiveForBed`, aux jours de la période. */
  inputFor(bed: Bed): AutomaticObjectiveInput;
  /** Les entrées de plusieurs planches, par identifiant : celles du tableau des besoins. */
  inputsFor(beds: readonly Bed[]): Map<string, AutomaticObjectiveInput>;
  /** Les valeurs jour par jour, pour un lecteur qui compose l'objectif sur une période (l'historique, les séries). */
  dayValuesFor(beds: readonly Bed[], dates: readonly string[]): AutomaticObjectiveDayValues;
};

/**
 * La source de l'objectif automatique pour les jours `from` à `to`, ou `null`
 * quand le réglage n'est allumé à aucun de ces jours : rien d'autre n'est lu,
 * et chaque lecteur garde son calcul d'avant (réglage éteint, rien ne change).
 */
export async function readAutomaticObjectiveSourceForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  from: string;
  to: string;
  now: Date;
}): Promise<AutomaticObjectiveSource | null> {
  const settings = await listAutomaticObjectiveRevisionsForUser(input.ownerUserId);
  const enabledDates = dateKeys(input.from, input.to).filter(automaticObjectiveSchedule(settings));
  if (enabledDates.length === 0) return null;
  const workspaceId = await findWorkspaceIdForUser(input.ownerUserId);
  if (workspaceId === null) return null;

  // Les semaines entières des jours allumés : « sans culture de toute la semaine » se lit du lundi au dimanche (F772).
  const mondays = [...new Set(enabledDates.map((date) => weekStartDateKey(date)))];
  const weekDates = mondays.flatMap((monday) => Array.from({ length: 7 }, (_, offset) => addDaysToDateKey(monday, offset)));
  const today = dateKeyInTimeZone(input.now, FARM_TIME_ZONE);
  const preference = await readWeatherPreference(input.ownerUserId);
  const locationKey = weatherLocationKey(preference, input.snapshot.structure);
  const [inputs, weather, features] = await Promise.all([
    readCropWaterInputsForWorkspace(workspaceId, input.season),
    locationKey
      ? listWeatherDailyValuesForUser(input.ownerUserId, locationKey, weekDates[0], weekDates[weekDates.length - 1])
      : Promise.resolve([]),
    getEnabledFeaturesForUser(input.ownerUserId),
  ]);
  const readings = et0Readings(weather);
  const plots = new Map(input.snapshot.plots.map((plot) => [plot.id, plot]));
  const cropPlan = input.snapshot.cropPlan;
  const cropsChecked = features.includes('cultures');

  const cropNeed = (bed: Bed, plotMode: PlotMode): AutomaticObjectiveInput['cropNeed'] => {
    if (!cropsChecked) return { status: 'off' };
    if (!cropPlan) return { status: 'unread' };
    // Un jardin à classer n'a pas d'objectif automatique (F769) : son besoin de culture ne sert pas, il n'est pas calculé.
    if (plotMode === 'unclassified') return { status: 'off' };
    const bedInput = cropWaterBedInput(bed, plotMode === 'greenhouse', today, cropPlan, inputs, readings);
    return { status: 'read', days: bedWaterDays(bedInput, weekDates).days };
  };

  const known = new Map<string, AutomaticObjectiveInput>();
  const inputFor = (bed: Bed): AutomaticObjectiveInput => {
    const cached = known.get(bed.id);
    if (cached) return cached;
    // Une planche dont le jardin n'est pas dans l'instantané : on ne sait pas s'il est sous abri, comme un jardin à classer.
    const plotMode = plots.get(bed.plotId)?.mode ?? 'unclassified';
    const bedInput: AutomaticObjectiveInput = {
      settings,
      today,
      et0Readings: readings,
      plotMode,
      shelterFactors: inputs.settings.shelterFactors,
      cropNeed: cropNeed(bed, plotMode),
    };
    known.set(bed.id, bedInput);
    return bedInput;
  };

  return {
    inputFor,
    inputsFor: (beds) => new Map(beds.map((bed) => [bed.id, inputFor(bed)])),
    dayValuesFor: (beds, dates) => {
      // La découpe par semaine est la même pour toutes les planches : faite une fois.
      const period = automaticObjectivePeriod(settings, dates);
      return new Map(beds.map((bed) => [bed.id, automaticObjectiveDayValues(inputFor(bed), bed, period)]));
    },
  };
}
