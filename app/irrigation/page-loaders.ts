import { listEquipmentPlacementsForUser } from '@/db/equipment-placement-repository';
import { countFeatureDataForUser } from '@/db/feature-data-counts';
import { listEquipmentPoseHistoryForUser, listEquipmentPosesForUser } from '@/db/equipment-placement-poses';
import { listEquipmentForUser } from '@/db/equipment/read';
import { listSettingProvenancesForUser } from '@/db/equipment/setting-calculations';
import { listGardenGroupConfigurationForUser } from '@/db/garden-group-repository';
import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { readPlanningSettingsForUser } from '@/db/planning-repository';
import { listProtectedSlotsForUser } from '@/db/protected-slots-repository';
import { usesSpeciesCorrespondence, usesWeather } from '@/lib/domain/features/socle';
import { calculateIrrigationCoverage } from '@/lib/domain/irrigation-coverage';
import { getCropCoefficientsViewForUser } from '@/lib/services/crop-water-coefficients';
import { getIrrigationHistoryDashboardForUser } from '@/lib/services/irrigation-history-service';
import { getIrrigationNeedsDashboardForUser } from '@/lib/services/irrigation-needs-service';
import { readWeeklyPlanForUser } from '@/lib/services/planning-service';
import { emptyPumpDashboard, getPumpDashboardForUser } from '@/lib/services/pump-dashboard';
import { getSoilReserveViewForUser } from '@/lib/services/soil-reserve-view';
import { getWaterDashboardForUser } from '@/lib/services/water-dashboard';
import { getWaterResourceDashboardForUser } from '@/lib/services/water-resource-dashboard';
import { getTodayViewForUser } from '@/lib/services/today-service';
import type { ReadyPageContext } from './page-context';

/**
 * Chaque page ne lit que ses données (3.8, docs/feature-selection-contract.md,
 * section 5) : avant la 3.8, la page unique chargeait tous les tableaux de
 * bord à chaque ouverture. Les lectures sont celles d'avant, avec les mêmes
 * paramètres ; seules leurs places changent. Une case décochée n'est pas lue
 * (R1) : sans « Ressources et pompes », les arrosages ne voient aucune pompe ;
 * sans « Réserve du sol », le planning n'a pas de note sur le sol.
 */

function seasonPlotsOf(context: ReadyPageContext) {
  return context.snapshot.plots
    .filter((plot) => plot.seasons.includes(context.season))
    .map((plot) => ({ otfZoneId: plot.zoneId, otfPlotId: plot.id }));
}

async function loadEquipmentState(context: ReadyPageContext) {
  const [equipment, equipmentPlacements, equipmentPoses, equipmentPoseHistory, gardenGroupConfiguration] = await Promise.all([
    listEquipmentForUser(context.userId),
    listEquipmentPlacementsForUser(context.userId, context.season),
    listEquipmentPosesForUser(context.userId, context.season),
    listEquipmentPoseHistoryForUser(context.userId, context.season),
    listGardenGroupConfigurationForUser(context.userId, context.season, seasonPlotsOf(context)),
  ]);
  return { equipment, equipmentPlacements, equipmentPoses, equipmentPoseHistory, gardenGroupConfiguration };
}

function loadWaterDashboard(context: ReadyPageContext, includeWeatherAlerts = false) {
  return getWaterDashboardForUser({
    ownerUserId: context.userId,
    season: context.season,
    snapshot: context.snapshot,
    weekStart: context.week,
    includeWeatherAlerts,
    now: new Date(context.nowIso),
  });
}

/**
 * Avant la 3.8, chaque ouverture du module relisait la météo périmée en
 * construisant le tableau de l'eau. Les pages qui lisent la météo sans ce
 * tableau (le planning, la réserve du sol, le besoin par culture) le
 * construisent donc aussi, en parallèle de leurs lectures, sans l'afficher :
 * une ferme qui n'ouvre que ces pages garde une météo à jour.
 */
async function refreshStaleWeather(context: ReadyPageContext): Promise<void> {
  await loadWaterDashboard(context);
}

/**
 * « Aujourd'hui » (audit ergonomique, points 1 et 3, 3.8 quater lot 2) : la
 * page d'arrivée relit d'abord la météo périmée, comme les pages qui la
 * lisent sans le tableau de l'eau, pour que le gel des trois jours et la
 * pluie réelle ne soient jamais lus d'une météo d'hier ; puis le modèle de
 * la page, qui rassemble les lectures existantes.
 */
export async function loadAujourdhuiPage(context: ReadyPageContext) {
  if (usesWeather(context.enabled)) await refreshStaleWeather(context);
  context.lap('weather');
  const view = await getTodayViewForUser({
    ownerUserId: context.userId,
    season: context.season,
    snapshot: context.snapshot,
    enabled: context.enabled,
    now: new Date(context.nowIso),
  });
  context.lap('dashboards');
  return { view };
}

export async function loadMaterielPage(context: ReadyPageContext) {
  // Le calculateur décoché, sa provenance n'est pas lue (R1, 3.8 bis).
  const calculatorEnabled = context.enabled.includes('calculateur');
  const [state, settingProvenances] = await Promise.all([
    loadEquipmentState(context),
    calculatorEnabled ? listSettingProvenancesForUser(context.userId) : null,
  ]);
  context.lap('equipment');
  return { ...state, calculator: settingProvenances ? { provenances: settingProvenances } : null };
}

export async function loadArrosagesPage(context: ReadyPageContext) {
  const [state, irrigationEvents, pumpDashboard, planningSettings, protectedSlots, waterDashboard] = await Promise.all([
    loadEquipmentState(context),
    listIrrigationEventsForUser(context.userId, context.season, true),
    context.enabled.includes('ressources') ? getPumpDashboardForUser(context.userId) : emptyPumpDashboard(),
    readPlanningSettingsForUser(context.userId),
    // L'avertissement d'un arrosage planifié dans un créneau protégé (3.8 ter, règle 12) : Planning coché seulement (R1).
    context.enabled.includes('planning') ? listProtectedSlotsForUser(context.userId) : [],
    loadWaterDashboard(context),
  ]);
  context.lap('dashboards');
  return { ...state, irrigationEvents, pumpDashboard, planningSettings, protectedSlots, waterDashboard };
}

export async function loadBesoinsPage(context: ReadyPageContext) {
  const [state, irrigationEvents, waterDashboard] = await Promise.all([
    loadEquipmentState(context),
    listIrrigationEventsForUser(context.userId, context.season, true),
    loadWaterDashboard(context),
  ]);
  context.lap('dashboards');
  const coverage = calculateIrrigationCoverage({
    beds: context.snapshot.beds.filter((bed) => bed.seasons.includes(context.season)),
    groups: state.gardenGroupConfiguration.groups,
    equipment: state.equipment,
    placements: state.equipmentPlacements,
  });
  const irrigationNeeds = await getIrrigationNeedsDashboardForUser({
    ownerUserId: context.userId,
    season: context.season,
    snapshot: context.snapshot,
    now: new Date(context.nowIso),
    waterDashboard,
    events: irrigationEvents,
    coverage: coverage.beds,
  });
  context.lap('needs');
  return { waterDashboard, irrigationNeeds };
}

export async function loadPlanningPage(context: ReadyPageContext) {
  const [weeklyPlan, planningSettings, protectedSlots, soilReserve] = await Promise.all([
    readWeeklyPlanForUser({ ownerUserId: context.userId, season: context.season, now: new Date(context.nowIso) }),
    readPlanningSettingsForUser(context.userId),
    listProtectedSlotsForUser(context.userId),
    context.enabled.includes('sol')
      ? getSoilReserveViewForUser({ ownerUserId: context.userId, season: context.season, snapshot: context.snapshot, now: new Date(context.nowIso) })
      : null,
    refreshStaleWeather(context),
  ]);
  context.lap('dashboards');
  return { weeklyPlan, planningSettings, protectedSlots, soilNotes: soilReserve?.proposalSoilNotes ?? {} };
}

export async function loadRessourcesPage(context: ReadyPageContext) {
  const [equipment, irrigationEvents, waterResourceDashboard, pumpDashboard] = await Promise.all([
    listEquipmentForUser(context.userId),
    listIrrigationEventsForUser(context.userId, context.season, true),
    getWaterResourceDashboardForUser({ ownerUserId: context.userId, season: context.season, snapshot: context.snapshot, now: new Date(context.nowIso) }),
    getPumpDashboardForUser(context.userId),
  ]);
  context.lap('dashboards');
  return { equipment, irrigationEvents, waterResourceDashboard, pumpDashboard };
}

export async function loadSolPage(context: ReadyPageContext) {
  const [soilReserve] = await Promise.all([
    getSoilReserveViewForUser({ ownerUserId: context.userId, season: context.season, snapshot: context.snapshot, now: new Date(context.nowIso) }),
    refreshStaleWeather(context),
  ]);
  context.lap('dashboards');
  return { soilReserve };
}

export async function loadCulturesPage(context: ReadyPageContext) {
  const [cropCoefficients] = await Promise.all([
    getCropCoefficientsViewForUser({ ownerUserId: context.userId, season: context.season, snapshot: context.snapshot }),
    refreshStaleWeather(context),
  ]);
  context.lap('dashboards');
  return { cropCoefficients };
}

/** Les deux pages d'alertes lisent le tableau de l'eau de la semaine, qui porte leurs encarts. */
export async function loadWaterDashboardPage(context: ReadyPageContext, includeWeatherAlerts: boolean) {
  const waterDashboard = await loadWaterDashboard(context, includeWeatherAlerts);
  context.lap('dashboards');
  return { waterDashboard };
}

export async function loadHistoriquePage(context: ReadyPageContext) {
  const irrigationHistory = await getIrrigationHistoryDashboardForUser({
    ownerUserId: context.userId,
    season: context.season,
    snapshot: context.snapshot,
    now: new Date(context.nowIso),
    selection: { period: { mode: 'week' }, scope: { level: 'farm' }, page: 1 },
  });
  context.lap('dashboards');
  return { irrigationHistory };
}

/**
 * Réglages (section 3) : la liste des cases et ce qu'il faut pour
 * l'avertissement (R2), puis le socle que les cases cochées demandent : le
 * lieu de la météo et la correspondance des espèces (P3).
 */
export async function loadReglagesPage(context: ReadyPageContext) {
  const [counts, waterDashboard, cropCoefficients] = await Promise.all([
    countFeatureDataForUser(context.userId),
    usesWeather(context.enabled) ? loadWaterDashboard(context) : null,
    usesSpeciesCorrespondence(context.enabled)
      ? getCropCoefficientsViewForUser({ ownerUserId: context.userId, season: context.season, snapshot: context.snapshot })
      : null,
  ]);
  context.lap('dashboards');
  return { counts, waterDashboard, cropCoefficients };
}
