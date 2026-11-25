import { listSpeciesCorrespondencesForWorkspace } from '@/db/crop-water/entries';
import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { readPlanningSettingsForUser } from '@/db/planning-repository';
import { listWeatherDailyValuesForUser } from '@/db/water-management-repository';
import { listWaterInfrastructureForUser } from '@/db/water-resource-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import { speciesWithoutReference } from '../domain/crop-water/species';
import type { IrrigationSnapshot } from '../domain/domain';
import type { FeatureSelection } from '../domain/features/selection';
import { actualRainLookbackDates, neverObservedSoilGardens } from '../domain/today/reliability';
import { guessedStages, lastMeasuredRainOn, missingByBedBeds, rainGaugeLookbackStart, unknownSoilBeds } from '../domain/today/missing-by-bed';
import { todayView, type TodayInputs, type TodayView } from '../domain/today/today-view';
import { pastRainOrigins, type TodayWeekInputs } from '../domain/today/week';
import { dateKeyInTimeZone, FARM_TIME_ZONE, weekDateKeys, weekStartDateKey } from '../domain/water-management';
import { automaticObjectiveEnabledOn } from '../domain/automatic-objective';
import { automaticObjectiveMissingEt0Dates } from '../domain/objective-reading';
import { listAutomaticObjectiveRevisionsForUser } from '@/db/automatic-objective-repository';
import { weatherLocationKey } from '../domain/weather/location';
import { et0Readings, getCropWaterDaysForUser } from './crop-water-week';
import { readWeeklyPlanForUser } from './planning-service';
import { getSoilReserveViewForUser } from './soil-reserve-view';
import { getIrrigationNeedsDashboardForUser } from './irrigation-needs-service';
import { getWaterDashboardForUser } from './water-dashboard';
import { readTodayWeatherInputs } from './today-weather';
import { readWeatherPreference } from './weather-preference';

/**
 * Le modèle de la page « Aujourd'hui » et de la zone « Fiabilité du calcul »
 * (audit ergonomique, points 1 et 3, 3.8 quater lot 2,
 * docs/audit-ergonomie-lot2-contract.md, section 8). Le service rassemble
 * des lectures qui existent déjà — le plan de la semaine, les irrigations de
 * la saison, les prévisions et les seuils des alertes, les ressources, la
 * jauge du sol, la correspondance des espèces — et laisse `lib/domain/today/`
 * tout ranger. Aucune requête nouvelle vers Ouvre ta ferme : l'instantané est
 * celui de la page. Une case décochée n'est pas lue (R1).
 */
type TodayRequest = {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  enabled: FeatureSelection;
  now?: Date;
};

export async function getTodayViewForUser(request: TodayRequest): Promise<TodayView> {
  return todayView(await readTodayInputs(request, { weather: true }));
}

/**
 * La pastille du menu (F12) : les lignes de fiabilité et les irrigations en
 * retard, sans lire la météo, qu'elle ne compte pas. Les autres pages la
 * demandent après leur affichage, pour ne pas l'attendre.
 */
export async function getTodayBadgeForUser(request: TodayRequest): Promise<number | null> {
  return todayView(await readTodayInputs(request, { weather: false })).badge;
}

async function readTodayInputs(
  { ownerUserId, season, snapshot, enabled, now = new Date() }: TodayRequest,
  read: { weather: boolean },
): Promise<TodayInputs> {
  const on = (feature: FeatureSelection[number]) => enabled.includes(feature);
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const irrigationsOn = on('planning') || on('arrosages');
  const [workspaceId, preference] = await Promise.all([findWorkspaceIdForUser(ownerUserId), readWeatherPreference(ownerUserId)]);
  const locationKey = weatherLocationKey(preference, snapshot.structure);
  const lookback = actualRainLookbackDates(today);
  // Le dépliant « Par planche » (amélioration n° 6) se lit pour la page seulement : la pastille ne le compte pas (F710).
  const byBed = read.weather;

  const [weather, events, settings, plan, infrastructure, rainRows, soil, correspondences, week, cropDays, automaticMissingEt0] = await Promise.all([
    read.weather
      ? readTodayWeatherInputs({ ownerUserId, workspaceId, locationKey, snapshot, season, enabled, now })
      : { forecasts: [], frost: null, criteria: on('alertes-meteo') ? [] : null },
    irrigationsOn ? listIrrigationEventsForUser(ownerUserId, season) : [],
    readPlanningSettingsForUser(ownerUserId),
    on('planning') ? readWeeklyPlanForUser({ ownerUserId, season, now }) : null,
    on('ressources') ? listWaterInfrastructureForUser(ownerUserId) : null,
    // Trente jours lus pour le pluviomètre (F701) ; la pluie réelle n'en regarde que sept.
    on('besoins') ? listWeatherDailyValuesForUser(ownerUserId, locationKey ?? 'unconfigured', rainGaugeLookbackStart(today), today) : [],
    on('sol') ? getSoilReserveViewForUser({ ownerUserId, season, snapshot, now }) : null,
    on('cultures') && workspaceId && snapshot.cropPlan ? listSpeciesCorrespondencesForWorkspace(workspaceId) : [],
    read.weather && on('besoins') ? readWeek({ ownerUserId, season, snapshot, now }) : null,
    byBed && on('cultures') ? getCropWaterDaysForUser({ ownerUserId, season, snapshot, dates: [today], now }) : null,
    on('besoins') ? automaticObjectiveMissingEt0(ownerUserId, locationKey, today) : null,
  ]);

  const seasonBeds = snapshot.beds.filter((bed) => bed.seasons.includes(season));
  const shelteredPlots = new Set(snapshot.plots.filter((plot) => plot.mode === 'greenhouse').map((plot) => plot.id));
  // Sous abri, la pluie vaut zéro (D-032) : une ferme tout sous abri n'a pas de pluie réelle à compléter.
  const rainMatters = seasonBeds.some((bed) => !shelteredPlots.has(bed.plotId));
  const rainKnown = new Set(rainRows
    .filter((row) => (row.dataKind === 'manual_precipitation' || row.dataKind === 'reanalysis') && row.precipitationMm !== null)
    .map((row) => row.date));

  return {
    enabled,
    now,
    weather,
    events,
    lateToleranceMinutes: settings.lateToleranceMinutes,
    plan: plan ? { computedAt: plan.calculation.computedAt, proposals: plan.proposals } : null,
    shortagePlan: plan,
    bedNames: new Map(snapshot.beds.map((bed) => [bed.id, bed.name])),
    bedPlots: new Map(snapshot.beds.map((bed) => [bed.id, bed.plotId])),
    infrastructure,
    reliability: {
      actualRainMissingDates: rainMatters ? lookback.filter((date) => !rainKnown.has(date)) : null,
      automaticObjectiveMissingEt0Dates: automaticMissingEt0,
      soilGardensNeverObserved: neverObservedSoilGardens(soil?.gauge?.zones ?? []),
      speciesWithoutReference: snapshot.cropPlan
        ? speciesWithoutReference(snapshot.cropPlan.series.filter((series) => series.season === season), correspondences)
          .filter((species) => species.reason === 'missing')
          .map((species) => species.plantName)
        : [],
    },
    missingByBed: byBed
      ? {
          beds: missingByBedBeds(snapshot, season, today),
          unknownSoilBeds: soil?.gauge ? unknownSoilBeds(soil.gauge.zones) : null,
          guessedStages: cropDays ? guessedStages(cropDays.beds, today) : null,
          lastMeasuredRainOn: lastMeasuredRainOn(rainRows),
        }
      : null,
    week,
    soil: soil ? (soil.gauge ? { zones: soil.gauge.zones } : { unavailable: soil.gaugeUnavailable ?? GAUGE_UNAVAILABLE }) : null,
  };
}

/**
 * Les jours de la semaine en cours sans ET0 où l'objectif automatique
 * s'applique (6 decies, O4, section 5, point 5 ; D-319) ; `null` quand le
 * réglage est éteint aujourd'hui : une requête, rien d'autre n'est lu.
 */
async function automaticObjectiveMissingEt0(ownerUserId: string, locationKey: string | null, today: string): Promise<string[] | null> {
  const settings = await listAutomaticObjectiveRevisionsForUser(ownerUserId);
  if (!automaticObjectiveEnabledOn(settings, today)) return null;
  const dates = weekDateKeys(weekStartDateKey(today));
  const rows = await listWeatherDailyValuesForUser(ownerUserId, locationKey ?? 'unconfigured', dates[0], dates[6]);
  return automaticObjectiveMissingEt0Dates(settings, et0Readings(rows), dates, today);
}

/** La jauge du sol absente sans raison donnée : jamais lue comme un sol plein (D-003). */
const GAUGE_UNAVAILABLE = 'La réserve du sol ne se calcule pas aujourd’hui.';

/**
 * La semaine en cours comme la lit « Objectifs et besoins » : le tableau de
 * l'eau, sans relire la météo (la page l'a fait avant), puis le tableau des
 * besoins par planche. Lu pour la page seulement, jamais pour la pastille.
 */
async function readWeek(request: { ownerUserId: string; season: number; snapshot: IrrigationSnapshot; now: Date }): Promise<TodayWeekInputs> {
  const waterDashboard = await getWaterDashboardForUser({ ...request, allowWeatherRefresh: false });
  const needs = await getIrrigationNeedsDashboardForUser({ ...request, waterDashboard });
  return {
    weekStart: needs.weekStart,
    weekEnd: needs.weekEnd,
    beds: needs.gardens.flatMap((garden) => garden.beds),
    water: {
      weekCubicMeters: waterDashboard.totals.realizedIrrigationCubicMeters,
      todayCubicMeters: waterDashboard.todayWater.realizedIrrigationCubicMeters,
      incomplete: waterDashboard.days.some((day) => day.volumeIncomplete),
    },
    rainOrigins: pastRainOrigins(waterDashboard.days, dateKeyInTimeZone(request.now, FARM_TIME_ZONE)),
  };
}
