import { listSpeciesCorrespondencesForWorkspace } from '@/db/crop-water/entries';
import { listReferenceCropKeysForWorkspace } from '@/db/crop-water/references';
import { listEquipmentPosesForUser } from '@/db/equipment-placement-poses';
import { listEquipmentForUser } from '@/db/equipment/read';
import { saveRouteStateForUser } from '@/db/feature-selection-repository';
import { listGardenGroupsForUser } from '@/db/garden-group-repository';
import { listZonesWithSoilForUser } from '@/db/soil-reserve/entries';
import { listHydricGoalRevisionsThroughWeekForUser, type HydricGoalRevision } from '@/db/water-management-repository';
import { readActiveWaterAssetsForUser, type ActiveWaterAssets } from '@/db/water-resource-repository';
import { countWeatherAlertCriteriaForUser } from '@/db/weather-alert-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import { logJsonLine } from '../adapters/log';
import { compareNamesNaturally } from '../domain/bed-order';
import { seasonSpecies, type CorrespondenceEntry } from '../domain/crop-water/species';
import { seasonCropCount } from '../domain/crop-water/crop-summary';
import type { IrrigationSnapshot } from '../domain/domain';
import { posedPlacements, type PlacementPose } from '../domain/equipment-placement-periods';
import { poseCounts } from '../domain/equipment-pose-presentation';
import type { EquipmentListItem } from '../domain/equipment-record';
import type { FarmHomeCounts } from '../domain/farm-home/lines';
import { farmObjective } from '../domain/farm-objective';
import { farmCardPages } from '../domain/features/places';
import type { RouteState } from '../domain/features/start-mode';
import type { FeatureSelection } from '../domain/features/selection';
import type { GardenGroupRecord } from '../domain/garden-group-record';
import { calculateIrrigationCoverage } from '../domain/irrigation-coverage';
import { objectiveForBed } from '../domain/irrigation-needs';
import { needOffSeason } from '../domain/off-season';
import { parcelsWithoutSoil } from '../domain/onboarding/soil';
import { routeStepsFor, type RouteCounts } from '../domain/onboarding/route';
import { soilParcelAnchor } from '../domain/today/reliability';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '../domain/water-management';
import { weatherLocationQuery } from '../domain/weather/location';
import { readAutomaticObjectiveSourceForUser } from './automatic-objective-source';
import { readOffSeasonSourceForUser } from './off-season-source';
import { readWeatherPreference, type ResolvedWeatherPreference } from './weather-preference';

/**
 * La lecture de la mise en route et des fiches de « Ma ferme »
 * (simplification, lot S6, docs/simplification-s6-contract.md, sections 6
 * et 7) : une seule par page, lancée en même temps que le plan d'Ouvre ta
 * ferme et l'accueil de la ferme. La carte la demande sur « Ma ferme » et
 * « Aujourd'hui » quand elle existe (`routeReadNeeded`) ; les fiches, sur
 * « Ma ferme » toujours (PR 3). Chaque étape et chaque fiche ne lisent que ce
 * qu'elles comptent, et seulement si leur case est cochée ; une étape et une
 * fiche qui comptent la même chose partagent la même lecture (section 7.1) ;
 * aucune requête par planche ni par jardin : trois cents planches coûtent
 * comme dix.
 *
 * Les lectures, toutes existantes sauf quatre, relevées pour la section 15 :
 *
 * - « Mon matériel », « Où il est posé » et la fiche « Matériel et
 *   placement » : l'inventaire (`listEquipmentForUser`, quatre requêtes), les
 *   poses courantes de la saison, posées ou stockées
 *   (`listEquipmentPosesForUser`, deux) et les groupes de jardins de la
 *   saison, lus sans rien écrire (`listGardenGroupsForUser`, deux) ; les
 *   planches arrosées sont celles de `calculateIrrigationCoverage`, le calcul
 *   du plan, sur les poses ouvertes (F958) ; les posés, ceux de `poseCounts`,
 *   le compte de l'inventaire.
 * - « D'où vient l'eau » et la fiche « Ressources et pompes » : les
 *   ressources et les réserves actives (`readActiveWaterAssetsForUser`, un
 *   lot de deux requêtes).
 * - « Combien je vise par semaine » : les objectifs saisis jusqu'à la semaine
 *   (`listHydricGoalRevisionsThroughWeekForUser`, une) et, après le plan,
 *   l'objectif automatique (`readAutomaticObjectiveSourceForUser`, une
 *   requête quand le réglage est éteint) et le filtre « hors saison »
 *   (`readOffSeasonSourceForUser`, une requête, gardée pour la requête de la
 *   page : la même que le tableau des besoins, D-352) ; `objectiveForBed`
 *   puis `farmObjective`, comme « Aujourd'hui » (S6-i) : les planches hors
 *   saison sont comptées à part (F1071).
 * - « Mon sol » et la fiche « Réserve du sol » : les parcelles qui ont un sol
 *   (`listZonesWithSoilForUser`, une), puis `parcelsWithoutSoil`, comme le
 *   bandeau « À finir » (S6-i) ; la même promesse sert au bandeau.
 * - La fiche « Besoin par culture » : après l'espace, les rattachements des
 *   espèces (`listSpeciesCorrespondencesForWorkspace`, une) et les clés des
 *   cultures que la ferme connaît (`listReferenceCropKeysForWorkspace`, une,
 *   nouvelle, sans les stades), puis `seasonSpecies` et `seasonCropCount`,
 *   le titre « Vos cultures cette saison (N) » de la page ; la promesse des
 *   rattachements sert aussi au bandeau (les espèces à rattacher).
 * - La fiche « Alertes météo » : `countWeatherAlertCriteriaForUser`, un
 *   `COUNT`.
 * - La fiche « Réglages » : `readWeatherPreference` (lue une fois par
 *   requête), puis `weatherLocationQuery`.
 *
 * Une lecture qui échoue rend son compte inconnu (`null`) : l'étape est « à
 * vérifier » (D-003), la fiche garde sa ligne fixe, la page ne tombe pas. Le
 * journal dit quelle lecture, jamais quelle personne.
 */

type EquipmentRows = {
  equipment: EquipmentListItem[];
  poses: PlacementPose[];
  groups: GardenGroupRecord[];
};

/** Les lectures lancées avant le plan ; `null` : rien ne les demande, rien n'est lu. */
export type StartRouteReads = {
  equipment: Promise<EquipmentRows | null> | null;
  water: Promise<ActiveWaterAssets | null> | null;
  revisions: Promise<HydricGoalRevision[] | null> | null;
  zonesWithSoil: Promise<string[] | null> | null;
  correspondences: Promise<CorrespondenceEntry[] | null> | null;
  cropKeys: Promise<string[] | null> | null;
  weatherAlerts: Promise<{ total: number; active: number } | null> | null;
  weather: Promise<ResolvedWeatherPreference | null> | null;
};

/** Qui demande la lecture : la carte (`route`), les fiches de « Ma ferme » (`cards`), ou les deux. */
export type StartRouteWants = { route: boolean; cards: boolean };

const WATER_NAMES_READ = 2;

function readFailed(step: string) {
  return (error: unknown) => {
    logJsonLine('warn', { event: 'start_route_read_failed', step, error: error instanceof Error ? error.message : 'inconnue', failedAt: new Date().toISOString() });
    return null;
  };
}

/** La semaine de l'eau visée : celle du jour, comme « Aujourd'hui » (section 8). */
function objectiveWeek(now: Date): { weekStart: string; weekEnd: string } {
  const weekStart = weekStartDateKey(now);
  return { weekStart, weekEnd: addDaysToDateKey(weekStart, 6) };
}

/**
 * Lance, sans les attendre, les lectures qui ne demandent pas le plan d'Ouvre
 * ta ferme, pour les étapes de la carte et les fiches demandées. Aucune ne
 * rejette : un échec rend `null`.
 */
export function startRouteReads(
  ownerUserId: string,
  season: number,
  enabled: FeatureSelection,
  now: Date,
  wants: StartRouteWants = { route: true, cards: false },
): StartRouteReads {
  const steps = new Set(wants.route ? routeStepsFor(enabled).map((step) => step.id) : []);
  const cards = new Set(wants.cards ? farmCardPages(enabled) : []);
  // L'espace, une fois, pour les deux lectures de la fiche « Besoin par culture ».
  const workspace = cards.has('cultures') ? findWorkspaceIdForUser(ownerUserId) : null;
  return {
    equipment: steps.has('equipment') || steps.has('placement') || cards.has('materiel')
      ? Promise.all([
        listEquipmentForUser(ownerUserId),
        listEquipmentPosesForUser(ownerUserId, season),
        listGardenGroupsForUser(ownerUserId, season),
      ]).then(([equipment, poses, groups]) => ({ equipment, poses, groups })).catch(readFailed('equipment'))
      : null,
    water: steps.has('water') || cards.has('ressources') ? readActiveWaterAssetsForUser(ownerUserId).catch(readFailed('water')) : null,
    revisions: steps.has('objective')
      ? listHydricGoalRevisionsThroughWeekForUser(ownerUserId, season, objectiveWeek(now).weekStart).catch(readFailed('objective'))
      : null,
    zonesWithSoil: steps.has('soil') || cards.has('sol') ? listZonesWithSoilForUser(ownerUserId).catch(readFailed('soil')) : null,
    correspondences: workspace
      ? workspace.then((workspaceId) => (workspaceId === null ? [] : listSpeciesCorrespondencesForWorkspace(workspaceId))).catch(readFailed('species'))
      : null,
    cropKeys: workspace ? workspace.then((workspaceId) => listReferenceCropKeysForWorkspace(workspaceId)).catch(readFailed('crops')) : null,
    weatherAlerts: cards.has('alertes-meteo') ? countWeatherAlertCriteriaForUser(ownerUserId).catch(readFailed('weather-alerts')) : null,
    weather: cards.has('reglages') ? readWeatherPreference(ownerUserId).catch(readFailed('weather')) : null,
  };
}

/** Les planches de la saison qui ont leur jardin et leur parcelle : celles du tableau des besoins, donc d'« Aujourd'hui ». */
function seasonBeds(snapshot: IrrigationSnapshot, season: number) {
  const plots = new Set(snapshot.plots.map((plot) => plot.id));
  const zones = new Set(snapshot.zones.map((zone) => zone.id));
  return snapshot.beds.filter((bed) => bed.seasons.includes(season) && plots.has(bed.plotId) && zones.has(bed.zoneId));
}

/** Les matériels actifs par sorte, comptés comme l'inventaire : le goutte-à-goutte, tout ce qui n'est pas une aspersion. */
function activeEquipment(rows: EquipmentRows) {
  const active = rows.equipment.filter((item) => item.status === 'active');
  const sprinkler = active.filter((item) => item.kind === 'sprinkler').length;
  return { active, drip: active.length - sprinkler, sprinkler };
}

/**
 * Les comptes de la mise en route, une fois le plan lu : des nombres, que la
 * fonction du domaine (`startRoute`) met en étapes. Les planches et les
 * parcelles sont celles de la saison de la page.
 */
export async function startRouteCounts(reads: StartRouteReads, input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  now: Date;
}): Promise<RouteCounts> {
  const { ownerUserId, season, snapshot, now } = input;
  const beds = seasonBeds(snapshot, season);
  const { weekStart, weekEnd } = objectiveWeek(now);
  const [equipmentRows, water, revisions, zonesWithSoil, automatic, offSeason] = await Promise.all([
    reads.equipment,
    reads.water,
    reads.revisions,
    reads.zonesWithSoil,
    // L'objectif automatique demande le plan : lu après lui, une requête quand le réglage est éteint (D-316).
    // `{ source: null }` : le réglage est éteint ; `null` : la lecture a échoué.
    reads.revisions
      ? readAutomaticObjectiveSourceForUser({ ownerUserId, season, snapshot, from: weekStart, to: weekEnd, now })
        .then((source) => ({ source })).catch(readFailed('automatic-objective'))
      : null,
    // Le filtre « hors saison » (D-352, F1071), comme pour « Aujourd'hui » : `{ source: null }` : aucun geste,
    // rien n'est hors saison et rien ne change ; `null` : la lecture a échoué.
    reads.revisions
      ? readOffSeasonSourceForUser({ ownerUserId, snapshot }).then((source) => ({ source })).catch(readFailed('off-season'))
      : null,
  ]);

  let equipment: RouteCounts['equipment'] = null;
  let placement: RouteCounts['placement'] = null;
  if (equipmentRows) {
    const { active, drip, sprinkler } = activeEquipment(equipmentRows);
    equipment = { drip, sprinkler, withoutSetting: active.filter((item) => item.settings.length === 0).length };
    // Les poses ouvertes seulement : un matériel stocké n'arrose rien (`listEquipmentPlacementsForUser`).
    const coverage = calculateIrrigationCoverage({ beds, groups: equipmentRows.groups, equipment: equipmentRows.equipment, placements: posedPlacements(equipmentRows.poses) });
    placement = { watered: coverage.beds.length, total: beds.length };
  }

  // Un objectif automatique ou un filtre « hors saison » illisible rend l'étape inconnue : sans eux, des planches
  // seraient dites sans eau visée à tort.
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const objective = revisions && automatic && offSeason
    ? farmObjective(beds.map((bed) => {
      const bedObjective = objectiveForBed(revisions, bed, weekStart, weekEnd, automatic.source?.inputFor(bed), offSeason.source?.daysFor(bed));
      const { offSeasonDates } = bedObjective;
      // Hors saison sans objectif, ou hors saison aujourd'hui : hors des comptes, dite à part, comme sur « Aujourd'hui » (F1069).
      return {
        areaSquareMeters: Math.max(0, bed.area),
        objectiveMm: bedObjective.value,
        ...(offSeasonDates.length > 0 ? { offSeasonDates, offSeason: needOffSeason({ objectiveMm: bedObjective.value, offSeasonDates }, today) } : {}),
      };
    }))
    : null;

  const seasonZones = snapshot.zones.filter((zone) => zone.seasons.includes(season));
  const withoutSoil = zonesWithSoil ? parcelsWithoutSoil(snapshot.zones, season, new Set(zonesWithSoil)) : null;
  // Les ressources et les réserves, triées ensemble comme le bloc « Eau disponible ».
  const waterNames = water ? [...water.resources, ...water.reservoirs].map((item) => item.name).sort(compareNamesNaturally) : [];
  return {
    equipment,
    placement,
    water: water ? { names: waterNames.slice(0, WATER_NAMES_READ), total: waterNames.length } : null,
    objective: objective ? { withObjective: objective.withObjective, total: objective.total, ...(objective.offSeason ? { offSeason: objective.offSeason } : {}) } : null,
    soil: withoutSoil ? { withoutSoil: withoutSoil.length, total: seasonZones.length, anchor: withoutSoil[0] ? soilParcelAnchor(withoutSoil[0]) : null } : null,
  };
}

/**
 * Les comptes des fiches de « Ma ferme » (section 7), des mêmes lectures que
 * la carte : la fonction du domaine (`farmCardLines`) les met en lignes.
 */
export async function farmHomeCounts(reads: StartRouteReads, input: {
  season: number;
  snapshot: IrrigationSnapshot;
}): Promise<FarmHomeCounts> {
  const { season, snapshot } = input;
  const [equipmentRows, water, zonesWithSoil, correspondences, cropKeys, weatherAlerts, weather] = await Promise.all([
    reads.equipment, reads.water, reads.zonesWithSoil, reads.correspondences, reads.cropKeys, reads.weatherAlerts, reads.weather,
  ]);
  let equipment: FarmHomeCounts['equipment'] = null;
  if (equipmentRows) {
    const { active, drip, sprinkler } = activeEquipment(equipmentRows);
    equipment = { drip, sprinkler, posed: poseCounts(active.map((item) => item.id), equipmentRows.poses).posed };
  }
  // Sans plan des cultures lu, les espèces sont inconnues : la fiche garde sa ligne fixe.
  const species = correspondences && cropKeys && snapshot.cropPlan
    ? seasonSpecies(snapshot.cropPlan.series.filter((item) => item.season === season), correspondences)
    : null;
  const withoutSoil = zonesWithSoil ? parcelsWithoutSoil(snapshot.zones, season, new Set(zonesWithSoil)) : null;
  return {
    equipment,
    water: water ? { resources: water.resources, reservoirs: water.reservoirs } : null,
    crops: species && cropKeys ? { inUse: seasonCropCount(cropKeys, species), species: species.length } : null,
    soil: withoutSoil ? { withoutSoil: withoutSoil.length, total: snapshot.zones.filter((zone) => zone.seasons.includes(season)).length } : null,
    weatherAlerts,
    weather: weather ? { city: weatherLocationQuery(weather, snapshot.structure)?.city ?? null, confirmed: weather.locationConfirmed } : null,
  };
}

/** Ce que dit l'appui sur un bouton de la carte. */
export type RouteStateOutcome = { ok: true; message: string } | { ok: false; message: string };

const ROUTE_STATE_MESSAGES: Readonly<Record<'later' | 'resume' | 'done', string>> = {
  later: 'La mise en route est remise à plus tard. Elle vous attend ici.',
  resume: 'La mise en route est reprise.',
  done: 'La mise en route est terminée.',
};

/**
 * « Plus tard », « Reprendre la mise en route », « Terminer la mise en
 * route » (section 5.4) : écrit `route_state` dans l'espace de la personne,
 * rien d'autre. Une ferme d'avant S6, ou une mise en route déjà terminée,
 * n'a rien à changer : la réponse le dit.
 */
export async function changeRouteStateForUser(ownerUserId: string, gesture: unknown, now: Date = new Date()): Promise<RouteStateOutcome> {
  if (gesture !== 'later' && gesture !== 'resume' && gesture !== 'done') return { ok: false, message: 'Ce geste n’est pas connu.' };
  const state: RouteState | null = gesture === 'resume' ? null : gesture;
  if (!await saveRouteStateForUser(ownerUserId, state, now)) return { ok: false, message: 'La mise en route est déjà terminée.' };
  return { ok: true, message: ROUTE_STATE_MESSAGES[gesture] };
}
