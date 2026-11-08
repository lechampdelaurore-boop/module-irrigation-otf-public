import { listSpeciesCorrespondencesForWorkspace } from '@/db/crop-water/entries';
import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { readPlanningSettingsForUser } from '@/db/planning-repository';
import { listWeatherDailyValuesForUser, readWeatherPreferenceForUser } from '@/db/water-management-repository';
import { listWaterInfrastructureForUser } from '@/db/water-resource-repository';
import { listWeatherAlertCriteriaForWorkspace, listWeatherAlertForecastDays } from '@/db/weather-alert-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import { speciesWithoutReference } from '../domain/crop-water/species';
import type { IrrigationSnapshot } from '../domain/domain';
import type { FeatureSelection } from '../domain/features/selection';
import { actualRainLookbackDates, neverObservedSoilGardens } from '../domain/today/reliability';
import { TODAY_WEATHER_DAYS, todayView, type TodayInputs, type TodayView } from '../domain/today/today-view';
import type { TodayWeekInputs } from '../domain/today/week';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../domain/water-management';
import { weatherLocationKey } from '../domain/weather/location';
import { readCropAlertsView } from './crop-alerts-view';
import { readWeeklyPlanForUser } from './planning-service';
import { getSoilReserveViewForUser } from './soil-reserve-view';
import { getIrrigationNeedsDashboardForUser } from './irrigation-needs-service';
import { getWaterDashboardForUser } from './water-dashboard';

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
  const [workspaceId, preference] = await Promise.all([findWorkspaceIdForUser(ownerUserId), readWeatherPreferenceForUser(ownerUserId)]);
  const locationKey = weatherLocationKey(preference, snapshot.structure);
  const weatherOn = read.weather && (on('alertes-cultures') || on('alertes-meteo'));
  const lookback = actualRainLookbackDates(today);

  const [forecasts, cropAlerts, criteria, events, settings, plan, infrastructure, rainRows, soil, correspondences, week] = await Promise.all([
    weatherOn && workspaceId && locationKey
      ? listWeatherAlertForecastDays(workspaceId, locationKey, today, addDaysToDateKey(today, TODAY_WEATHER_DAYS - 1))
      : [],
    read.weather && on('alertes-cultures') ? readCropAlertsView({ ownerUserId, workspaceId, locationKey, snapshot, season, now }) : null,
    read.weather && on('alertes-meteo') && workspaceId ? listWeatherAlertCriteriaForWorkspace(workspaceId) : [],
    irrigationsOn ? listIrrigationEventsForUser(ownerUserId, season) : [],
    readPlanningSettingsForUser(ownerUserId),
    on('planning') ? readWeeklyPlanForUser({ ownerUserId, season, now }) : null,
    on('ressources') ? listWaterInfrastructureForUser(ownerUserId) : null,
    on('besoins') ? listWeatherDailyValuesForUser(ownerUserId, locationKey ?? 'unconfigured', lookback[0], lookback[lookback.length - 1]) : [],
    on('sol') ? getSoilReserveViewForUser({ ownerUserId, season, snapshot, now }) : null,
    on('cultures') && workspaceId && snapshot.cropPlan ? listSpeciesCorrespondencesForWorkspace(workspaceId) : [],
    read.weather && on('besoins') ? readWeek({ ownerUserId, season, snapshot, now }) : null,
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
    weather: {
      forecasts,
      frost: cropAlerts ? cropAlerts.upcoming.frost : null,
      criteria: on('alertes-meteo') ? criteria.filter((criterion) => criterion.active) : null,
    },
    events,
    lateToleranceMinutes: settings.lateToleranceMinutes,
    plan: plan ? { computedAt: plan.calculation.computedAt, proposals: plan.proposals } : null,
    bedNames: new Map(snapshot.beds.map((bed) => [bed.id, bed.name])),
    infrastructure,
    reliability: {
      actualRainMissingDates: rainMatters ? lookback.filter((date) => !rainKnown.has(date)) : null,
      soilGardensNeverObserved: neverObservedSoilGardens(soil?.gauge?.zones ?? []),
      speciesWithoutReference: snapshot.cropPlan
        ? speciesWithoutReference(snapshot.cropPlan.series.filter((series) => series.season === season), correspondences)
          .filter((species) => species.reason === 'missing')
          .map((species) => species.plantName)
        : [],
    },
    week,
    soil: soil ? (soil.gauge ? { zones: soil.gauge.zones } : { unavailable: soil.gaugeUnavailable ?? GAUGE_UNAVAILABLE }) : null,
  };
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
  };
}
