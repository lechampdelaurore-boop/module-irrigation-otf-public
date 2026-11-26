import { listEquipmentPlacementsForUser } from '@/db/equipment-placement-repository';
import { listEquipmentForUser } from '@/db/equipment/read';
import { saveRouteStateForUser } from '@/db/feature-selection-repository';
import { listGardenGroupsForUser } from '@/db/garden-group-repository';
import { listZonesWithSoilForUser } from '@/db/soil-reserve/entries';
import { listHydricGoalRevisionsThroughWeekForUser, type HydricGoalRevision } from '@/db/water-management-repository';
import { readActiveWaterResourceNamesForUser } from '@/db/water-resource-repository';
import { logJsonLine } from '../adapters/log';
import type { IrrigationSnapshot } from '../domain/domain';
import type { EquipmentPlacementRecord } from '../domain/equipment-placement-record';
import type { EquipmentListItem } from '../domain/equipment-record';
import { farmObjective } from '../domain/farm-objective';
import type { RouteState } from '../domain/features/start-mode';
import type { FeatureSelection } from '../domain/features/selection';
import type { GardenGroupRecord } from '../domain/garden-group-record';
import { calculateIrrigationCoverage } from '../domain/irrigation-coverage';
import { objectiveForBed } from '../domain/irrigation-needs';
import { parcelsWithoutSoil } from '../domain/onboarding/soil';
import { routeStepsFor, type RouteCounts } from '../domain/onboarding/route';
import { soilParcelAnchor } from '../domain/today/reliability';
import { addDaysToDateKey, weekStartDateKey } from '../domain/water-management';
import { readAutomaticObjectiveSourceForUser } from './automatic-objective-source';

/**
 * La lecture de la mise en route (simplification, lot S6,
 * docs/simplification-s6-contract.md, section 6) : une seule par page,
 * lancée en même temps que le plan d'Ouvre ta ferme et l'accueil de la
 * ferme, seulement sur « Ma ferme » et « Aujourd'hui », seulement quand la
 * carte existe (`routeReadNeeded`). Chaque étape ne lit que ce qu'elle
 * compte, et seulement si sa case est cochée ; aucune requête par planche ni
 * par jardin : trois cents planches coûtent comme dix.
 *
 * Les lectures, toutes existantes sauf deux, relevées pour la section 15 :
 *
 * - « Mon matériel » et « Où il est posé » : l'inventaire
 *   (`listEquipmentForUser`, quatre requêtes), les poses de la saison
 *   (`listEquipmentPlacementsForUser`, une) et les groupes de jardins de la
 *   saison, lus sans rien écrire (`listGardenGroupsForUser`, deux) ; les
 *   planches arrosées sont celles de `calculateIrrigationCoverage`, le calcul
 *   du plan, jamais un compte à part (F958).
 * - « D'où vient l'eau » : deux noms et un `COUNT` des ressources actives
 *   (`readActiveWaterResourceNamesForUser`, un lot de deux requêtes).
 * - « Combien je vise par semaine » : les objectifs saisis jusqu'à la semaine
 *   (`listHydricGoalRevisionsThroughWeekForUser`, une) et, après le plan,
 *   l'objectif automatique (`readAutomaticObjectiveSourceForUser`, une
 *   requête quand le réglage est éteint) ; `objectiveForBed` puis
 *   `farmObjective`, comme « Aujourd'hui » (S6-i).
 * - « Mon sol » : les parcelles qui ont un sol (`listZonesWithSoilForUser`,
 *   une), puis `parcelsWithoutSoil`, comme le bandeau « À finir » (S6-i) ;
 *   la même promesse sert au bandeau, jamais deux lectures.
 *
 * Une lecture qui échoue rend son compte inconnu (`null`) : l'étape est « à
 * vérifier » (D-003), la page ne tombe pas. Le journal dit quelle étape,
 * jamais quelle personne.
 */

type EquipmentRows = {
  equipment: EquipmentListItem[];
  placements: EquipmentPlacementRecord[];
  groups: GardenGroupRecord[];
};

/** Les lectures lancées avant le plan ; `null` : l'étape n'existe pas, rien n'est lu. */
export type StartRouteReads = {
  equipment: Promise<EquipmentRows | null> | null;
  water: Promise<{ names: string[]; total: number } | null> | null;
  revisions: Promise<HydricGoalRevision[] | null> | null;
  zonesWithSoil: Promise<string[] | null> | null;
};

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
 * Lance, sans les attendre, les lectures des étapes de la ferme qui ne
 * demandent pas le plan d'Ouvre ta ferme. Aucune ne rejette : un échec rend
 * `null`.
 */
export function startRouteReads(ownerUserId: string, season: number, enabled: FeatureSelection, now: Date): StartRouteReads {
  const steps = new Set(routeStepsFor(enabled).map((step) => step.id));
  return {
    equipment: steps.has('equipment') || steps.has('placement')
      ? Promise.all([
        listEquipmentForUser(ownerUserId),
        listEquipmentPlacementsForUser(ownerUserId, season),
        listGardenGroupsForUser(ownerUserId, season),
      ]).then(([equipment, placements, groups]) => ({ equipment, placements, groups })).catch(readFailed('equipment'))
      : null,
    water: steps.has('water') ? readActiveWaterResourceNamesForUser(ownerUserId, WATER_NAMES_READ).catch(readFailed('water')) : null,
    revisions: steps.has('objective')
      ? listHydricGoalRevisionsThroughWeekForUser(ownerUserId, season, objectiveWeek(now).weekStart).catch(readFailed('objective'))
      : null,
    zonesWithSoil: steps.has('soil') ? listZonesWithSoilForUser(ownerUserId).catch(readFailed('soil')) : null,
  };
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
  const plots = new Set(snapshot.plots.map((plot) => plot.id));
  const zones = new Set(snapshot.zones.map((zone) => zone.id));
  // Les planches de la saison qui ont leur jardin et leur parcelle : celles du tableau des besoins, donc d'« Aujourd'hui ».
  const beds = snapshot.beds.filter((bed) => bed.seasons.includes(season) && plots.has(bed.plotId) && zones.has(bed.zoneId));
  const { weekStart, weekEnd } = objectiveWeek(now);
  const [equipmentRows, water, revisions, zonesWithSoil, automatic] = await Promise.all([
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
  ]);

  let equipment: RouteCounts['equipment'] = null;
  let placement: RouteCounts['placement'] = null;
  if (equipmentRows) {
    const active = equipmentRows.equipment.filter((item) => item.status === 'active');
    const withSetting = active.filter((item) => item.settings.length > 0);
    equipment = {
      drip: withSetting.filter((item) => item.kind === 'drip').length,
      sprinkler: withSetting.filter((item) => item.kind === 'sprinkler').length,
      withoutSetting: active.length - withSetting.length,
    };
    const coverage = calculateIrrigationCoverage({ beds, groups: equipmentRows.groups, equipment: equipmentRows.equipment, placements: equipmentRows.placements });
    placement = { watered: coverage.beds.length, total: beds.length };
  }

  // Un objectif automatique illisible rend l'étape inconnue : sans lui, des planches seraient dites sans eau visée à tort.
  const objective = revisions && automatic
    ? farmObjective(beds.map((bed) => ({
      areaSquareMeters: Math.max(0, bed.area),
      objectiveMm: objectiveForBed(revisions, bed, weekStart, weekEnd, automatic.source?.inputFor(bed)).value,
    })))
    : null;

  const seasonZones = snapshot.zones.filter((zone) => zone.seasons.includes(season));
  const withoutSoil = zonesWithSoil ? parcelsWithoutSoil(snapshot.zones, season, new Set(zonesWithSoil)) : null;
  return {
    equipment,
    placement,
    water: water ? { names: water.names, total: water.total } : null,
    objective: objective ? { withObjective: objective.withObjective, total: objective.total } : null,
    soil: withoutSoil ? { withoutSoil: withoutSoil.length, total: seasonZones.length, anchor: withoutSoil[0] ? soilParcelAnchor(withoutSoil[0]) : null } : null,
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
