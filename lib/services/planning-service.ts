import { listEquipmentPlacementsForUser } from '@/db/equipment-placement-repository';
import { listEquipmentForUser } from '@/db/equipment/read';
import { listGardenGroupConfigurationForUser } from '@/db/garden-group-repository';
import { listIrrigationArbitrationsForUser } from '@/db/irrigation-arbitration-repository';
import { readLatestPlanForUser, readPlanningSettingsForUser, savePlanCalculationForUser } from '@/db/planning-repository';
import { listProtectedSlotsForUser } from '@/db/protected-slots-repository';
import { listPumpConfigurationForUser } from '@/db/pump-repository';
import { listDailyWaterLimitsForUser } from '@/db/water-management-repository';
import { listWaterInfrastructureForUser } from '@/db/water-resource-repository';
import { logJsonLine, type LogLevel } from '../adapters/log';
import { startStopwatch, type Stopwatch } from '../adapters/stopwatch';
import type { IrrigationSnapshot } from '../domain/domain';
import { calculateIrrigationCoverage } from '../domain/irrigation-coverage';
import type { PlanCalculationEvent, PlanCalculationTrigger, PlanningInputs, StoredWeeklyPlan } from '../domain/planning/contract';
import { describePlanChanges } from '../domain/planning/changes';
import { buildWeeklyPlan } from '../domain/planning/engine';
import { nextDeferredQueue } from '../domain/planning/shortage';
import { FARM_TIME_ZONE, addDaysToDateKey, dateKeyInTimeZone, localDateStartUtc, weekStartDateKey } from '../domain/water-management';
import { partitionIrrigationEventsForUser } from './counted-irrigation-events';
import { getEnabledFeaturesForUser, listFarmsWithFeature } from './feature-selection-service';
import { getIrrigationFeasibilityForUser } from './irrigation-feasibility-service';
import { getIrrigationNeedsDashboardForUser } from './irrigation-needs-service';
import { getIrrigationSnapshot } from './irrigation-service';
import { notifyMorningSuggestions, type PlanningAlarmScheduler } from './planning-notifications';
import { emptyPumpDashboard } from './pump-dashboard';
import { getWaterDashboardForUser } from './water-dashboard';

/**
 * Le service du planning hebdomadaire (docs/planning-contract.md) : il
 * assemble ce que les sous-tranches précédentes savent — besoins, couverture,
 * eau, pompes, limites, irrigations de la semaine, réglages, arbitrage —,
 * fait tourner le moteur, et enregistre le calcul avec ses propositions. Rien
 * n'est arrosé, rien n'est écrit dans Ouvre ta ferme.
 */
export async function computeWeeklyPlanForUser({
  ownerUserId,
  season,
  snapshot,
  now = new Date(),
  trigger = 'manual',
  triggerEvent = null,
  actorUserId = null,
  stopwatch = startStopwatch(),
  log = logJsonLine,
  scheduleAlarm,
}: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  now?: Date;
  trigger?: PlanCalculationTrigger;
  /** L'événement qui déclenche un calcul « sur événement » (3.7, règle 7) : retenu avec le calcul et nommé dans l'en-tête. */
  triggerEvent?: PlanCalculationEvent | null;
  actorUserId?: string | null;
  /** Le chronomètre de l'appelant quand il a déjà mesuré la lecture de l'instantané (point ouvert 34). */
  stopwatch?: Stopwatch;
  log?: (level: LogLevel, entry: Record<string, unknown>) => void;
  /** Le Worker de notification, remplaçable en test ; le calcul du matin seul s'en sert (3.7, règles 21 à 23). */
  scheduleAlarm?: PlanningAlarmScheduler;
}): Promise<StoredWeeklyPlan> {
  const weekStart = weekStartDateKey(now, FARM_TIME_ZONE);
  const weekEnd = addDaysToDateKey(weekStart, 6);
  const weekStartAt = localDateStartUtc(weekStart, FARM_TIME_ZONE);
  const weekEndAt = localDateStartUtc(addDaysToDateKey(weekStart, 7), FARM_TIME_ZONE);
  const seasonPlots = snapshot.plots.filter((plot) => plot.seasons.includes(season));
  const seasonBeds = snapshot.beds.filter((bed) => bed.seasons.includes(season));

  // Les irrigations de la semaine, toutes saisons : la limite journalière est
  // celle de l'exploitation, et une irrigation planifiée occupe la pompe
  // quelle que soit sa saison.
  // Une irrigation planifiée qui ne peut plus démarrer, matériel stocké ou
  // reposé ailleurs, ne compte pas (D-044).
  // Celles qu'une pose empêche de démarrer sont lues à part : le moteur suggère de les annuler (3.7, règle 16).
  const weekIrrigations = partitionIrrigationEventsForUser(ownerUserId, undefined, true, { startAt: weekStartAt.toISOString(), endAt: weekEndAt.toISOString() });
  const weekEvents = weekIrrigations.then((split) => split.counted);
  // Ressources et pompes décochée (3.8, docs/feature-selection-contract.md, section 7) : le moteur reçoit des
  // ressources et des pompes vides et fait ce qu'il fait pour une ferme qui n'en déclare pas ; aucune ligne ne change.
  const resourcesEnabled = getEnabledFeaturesForUser(ownerUserId).then((enabled) => enabled.includes('ressources'));
  const [events, water, infrastructure, pumps, equipment, placements, groups, dailyLimits, settings, previous, arbitrations, blockedIrrigations, protectedSlots] = await Promise.all([
    weekEvents,
    getWaterDashboardForUser({ ownerUserId, season, snapshot, weekStart, allowWeatherRefresh: false, now, preloadedEvents: weekEvents }),
    resourcesEnabled.then((enabled) => enabled
      ? listWaterInfrastructureForUser(ownerUserId, { startAt: localDateStartUtc(dateKeyInTimeZone(now, FARM_TIME_ZONE), FARM_TIME_ZONE).toISOString(), endAt: weekEndAt.toISOString() })
      : emptyPumpDashboard().infrastructure),
    resourcesEnabled.then((enabled) => enabled ? listPumpConfigurationForUser(ownerUserId) : { pumps: [], equipmentDefaults: [] }),
    listEquipmentForUser(ownerUserId),
    listEquipmentPlacementsForUser(ownerUserId, season),
    listGardenGroupConfigurationForUser(ownerUserId, season, seasonPlots.map((plot) => ({ otfZoneId: plot.zoneId, otfPlotId: plot.id }))),
    listDailyWaterLimitsForUser(ownerUserId),
    readPlanningSettingsForUser(ownerUserId),
    readLatestPlanForUser(ownerUserId, season, weekStart),
    // L'arbitrage naît de la faisabilité, une partie de Ressources et pompes : sans elle, il ne s'impose pas.
    resourcesEnabled.then((enabled) => enabled ? listIrrigationArbitrationsForUser(ownerUserId, season, weekStart) : []),
    weekIrrigations.then((split) => split.blocked),
    // Les créneaux protégés de l'exploitation, relus à chaque calcul (3.8 ter, D-062, règles 7 et 8).
    listProtectedSlotsForUser(ownerUserId),
  ]);
  stopwatch.lap('inputs');
  const coverage = calculateIrrigationCoverage({ beds: seasonBeds, groups: groups.groups, equipment, placements }).beds;
  const seasonEvents = events.filter((event) => event.season === season);
  const needs = await getIrrigationNeedsDashboardForUser({ ownerUserId, season, snapshot, now, events: seasonEvents, waterDashboard: water, coverage });
  stopwatch.lap('needs');

  // Un arbitrage 3.4 validé s'impose au moteur : la faisabilité donne l'eau allouée à chaque planche du niveau arbitré.
  let arbitration: PlanningInputs['arbitration'] = null;
  if (arbitrations.some((decision) => decision.invalidatedAt === null)) {
    const feasibility = await getIrrigationFeasibilityForUser({ ownerUserId, season, now });
    arbitration = feasibility.priorities
      .filter((level) => level.arbitration === 'validated')
      .flatMap((level) => level.beds
        .filter((bed) => bed.allocatedCubicMeters !== null)
        .map((bed) => ({ bedId: bed.need.bedId, allocatedCubicMeters: bed.allocatedCubicMeters ?? 0 })));
    stopwatch.lap('arbitration');
  }

  const inputs: PlanningInputs = {
    season,
    now,
    weekStart,
    weekEnd,
    timeZone: FARM_TIME_ZONE,
    needs: needs.gardens.flatMap((garden) => garden.beds),
    beds: seasonBeds,
    days: water.days.map((day) => ({ date: day.date, forecastRainMm: day.forecastRainMm, et0Mm: day.et0Mm })),
    coverage,
    equipment,
    placements,
    pumpDefaults: pumps.equipmentDefaults,
    pumps: pumps.pumps,
    infrastructure,
    dailyLimits,
    events,
    blockedIrrigations,
    arbitration,
    // La file du report n'avance qu'au calcul qui suit un événement (décision 4 de la 3.9, D-052) : un événement inscrit au
    // registre après le calcul précédent, dont le recalcul est en cours — ce calcul même — ou a échoué.
    deferredBedIds: nextDeferredQueue(previous?.calculation.summary ?? null, (previous?.pendingEvent ?? null) !== null),
    // Les créneaux refusés de la semaine (D-030, point ouvert 31) : chaque proposition refusée, de n'importe quel calcul
    // de la semaine, exclut son matériel sur ses heures ; le registre étant lu par semaine, le lundi repart sans eux.
    refusedSlots: previous?.proposals
      .filter((proposal) => proposal.status === 'refused')
      .map((proposal) => ({ equipmentId: proposal.equipmentId, startAt: proposal.startAt, endAt: proposal.endAt })) ?? [],
    protectedSlots,
  };
  const plan = buildWeeklyPlan(inputs, settings);
  // « Ce qui a changé » depuis le calcul précédent de la semaine (3.7, règle 25) : une lecture, enregistrée avec le calcul.
  const changes = describePlanChanges(previous, plan);
  stopwatch.lap('engine');
  await savePlanCalculationForUser(ownerUserId, { season, weekStart, trigger, triggerEvent, actorUserId, plan, changes });
  stopwatch.lap('save');
  const stored = await readLatestPlanForUser(ownerUserId, season, weekStart);
  stopwatch.lap('reread');
  if (!stored) throw new Error('Le calcul du planning n’a pas été enregistré.');
  // Les durées du recalcul (docs/planning-contract.md, point ouvert 34) : des nombres et des dates, jamais d'identifiant de personne.
  const { durationsMs, totalMs } = stopwatch.report();
  log('info', { event: 'planning_calculation_completed', trigger, ...(triggerEvent ? { triggerEvent } : {}), season, weekStart, snapshotSource: snapshot.source, beds: seasonBeds.length, proposals: stored.proposals.length, durationsMs, totalMs, completedAt: new Date().toISOString() });
  // Le calcul du matin, et lui seul, notifie ses suggestions sur les arrosages des prochaines 24 heures (3.7, règles 21 et 22) ; jamais après un geste à l'écran.
  if (trigger === 'daily') await notifyMorningSuggestions({ ownerUserId, plan: stored, now, schedule: scheduleAlarm, log });
  return stored;
}

/** Le dernier plan enregistré de la semaine courante, sans recalcul. */
export async function readWeeklyPlanForUser({ ownerUserId, season, now = new Date() }: { ownerUserId: string; season: number; now?: Date }): Promise<StoredWeeklyPlan | null> {
  return readLatestPlanForUser(ownerUserId, season, weekStartDateKey(now, FARM_TIME_ZONE));
}

/**
 * Le recalcul quotidien (docs/planning-contract.md, « Le cycle ») : après la
 * synchronisation météo, chaque exploitation reçoit un nouveau calcul de la
 * semaine en cours, pour la saison de l'année. Un échec sur une exploitation
 * n'arrête pas les autres ; il est journalisé, sans identifiant de personne.
 */
export async function recalculateWeeklyPlansForAllWorkspaces({
  now = new Date(),
  log = (line: string) => console.error(line),
}: { now?: Date; log?: (line: string) => void } = {}): Promise<{ recalculated: number; failed: number }> {
  const season = Number(dateKeyInTimeZone(now, FARM_TIME_ZONE).slice(0, 4));
  let recalculated = 0;
  let failed = 0;
  // Seules les fermes qui ont coché le Planning reçoivent le calcul du matin et sa notification (3.8, R1).
  for (const { ownerUserId } of await listFarmsWithFeature('planning')) {
    try {
      const stopwatch = startStopwatch();
      const snapshot = await getIrrigationSnapshot(ownerUserId, { season });
      stopwatch.lap('snapshot');
      await computeWeeklyPlanForUser({ ownerUserId, season, snapshot, now, trigger: 'daily', stopwatch });
      recalculated += 1;
    } catch (error) {
      failed += 1;
      log(JSON.stringify({ event: 'planning_daily_recalculation_failed', season, error: error instanceof Error ? error.message : 'unknown', failedAt: now.toISOString() }));
    }
  }
  return { recalculated, failed };
}
