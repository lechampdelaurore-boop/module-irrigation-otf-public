import * as workers from 'cloudflare:workers';
import { recordPlanEventForUser, settlePlanEvent } from '@/db/planning-events-repository';
import { logJsonLine, type LogLevel } from '../adapters/log';
import { startStopwatch } from '../adapters/stopwatch';
import type { PlanCalculationEvent, PlanEventKind, StoredWeeklyPlan } from '../domain/planning/contract';
import { FARM_TIME_ZONE, weekStartDateKey } from '../domain/water-management';
import { evaluateSprinklerAlertsForUser } from './crop-alerts-service';
import { getEnabledFeaturesForUser } from './feature-selection-service';
import { getIrrigationSnapshot } from './irrigation-service';
import { computeWeeklyPlanForUser } from './planning-service';

/**
 * Le recalcul sur événement (3.7, docs/replanning-contract.md, règles 4 à 8 ;
 * docs/planning-contract.md, « Le recalcul sur événement »). Après chaque
 * événement de la règle 4, le plan de la semaine courante se recalcule de
 * lui-même, pour la seule exploitation concernée et la saison de l'événement,
 * avec le déclencheur « événement » et le nom de l'événement.
 *
 * L'événement d'abord (règle 6) : il est déjà enregistré quand ce service est
 * appelé, et rien ici ne peut le défaire. Le calcul se lance après la réponse
 * au maraîcher quand l'hébergement le permet, avant elle sinon ; un échec se
 * journalise sans nommer personne et l'écran dit que le plan est antérieur à
 * l'événement. Ce service ne lève jamais.
 */

type PlanEvent = {
  kind: PlanEventKind;
  season: number;
  /** L'instant que l'événement concerne : le début de l'irrigation, le jour de la pluie, la semaine de l'objectif, la date de pose… */
  at: Date | string;
  /**
   * Vrai quand l'événement vaut encore après sa semaine — une limite, un
   * objectif, une pose, un niveau observé, un débit — : seule une date à venir
   * l'écarte. Faux pour ce qui n'arrive qu'une fois — une irrigation, une
   * pluie — : seule la semaine courante compte (règle 5).
   */
  lasting?: boolean;
};

type ComputeInput = { ownerUserId: string; season: number; now: Date; triggerEvent: PlanCalculationEvent };

type Dependencies = {
  now?: Date;
  /** Le Planning coché pour la ferme : décoché, aucun recalcul ni événement inscrit (3.8, R1). */
  planningEnabled?: (ownerUserId: string) => Promise<boolean>;
  compute?: (input: ComputeInput) => Promise<StoredWeeklyPlan>;
  runAfterResponse?: (work: () => Promise<void>) => Promise<void>;
  log?: (level: LogLevel, entry: Record<string, unknown>) => void;
  /** Après un plan recalculé, les aspersions à reconsidérer sont jugées de nouveau (docs/weather-crop-alerts-contract.md). */
  afterPlan?: (ownerUserId: string, now: Date) => Promise<void>;
};

export async function recalculatePlanAfterEvent(
  ownerUserId: string,
  event: PlanEvent,
  {
    now = new Date(),
    planningEnabled = isPlanningEnabled,
    compute = computeAfterSnapshot,
    runAfterResponse = afterResponse,
    log = logJsonLine,
    afterPlan = (owner, at) => evaluateSprinklerAlertsForUser(owner, { now: at }),
  }: Dependencies = {},
): Promise<void> {
  const weekStart = weekStartDateKey(now, FARM_TIME_ZONE);
  if (!concernsWeek(event, weekStart)) return;
  try {
    if (!await planningEnabled(ownerUserId)) return;
  } catch (error) {
    log('warn', { event: 'planning_event_record_failed', kind: event.kind, season: event.season, weekStart, error: describe(error), failedAt: now.toISOString() });
    return;
  }
  let eventId: string;
  try {
    eventId = await recordPlanEventForUser(ownerUserId, { season: event.season, weekStart, kind: event.kind, occurredAt: now.toISOString() });
  } catch (error) {
    log('warn', { event: 'planning_event_record_failed', kind: event.kind, season: event.season, weekStart, error: describe(error), failedAt: now.toISOString() });
    return;
  }
  await runAfterResponse(async () => {
    try {
      const stored = await compute({ ownerUserId, season: event.season, now, triggerEvent: event.kind });
      await settlePlanEvent(eventId, { calculationId: stored.calculation.id }, new Date().toISOString());
      await afterPlan(ownerUserId, now);
    } catch (error) {
      // L'échec ne touche pas à l'événement ; l'écran lira « plan antérieur à … — recalculez ».
      await settlePlanEvent(eventId, { failed: true }, new Date().toISOString()).catch(() => undefined);
      log('warn', { event: 'planning_event_recalculation_failed', kind: event.kind, season: event.season, weekStart, error: describe(error), failedAt: new Date().toISOString() });
    }
  });
}

/**
 * Après un changement des fonctionnalités qui touche le plan (3.8,
 * docs/feature-selection-contract.md, R9, P8 et P28) : Ressources et pompes
 * cochée ou décochée, Planning coché. Le plan de la semaine se recalcule avant
 * la réponse, pour que la page rechargée le montre, et son en-tête dit
 * « après un changement des fonctionnalités ». Il ne passe pas par le registre
 * des événements de la 3.7, dont la liste est fermée par la base. Un échec se
 * journalise sans nommer personne ; le choix reste enregistré. Ne lève jamais.
 */
export async function recalculatePlanAfterFeatureChange(
  ownerUserId: string,
  season: number,
  {
    now = new Date(),
    compute = computeAfterSnapshot,
    log = logJsonLine,
    afterPlan = (owner, at) => evaluateSprinklerAlertsForUser(owner, { now: at }),
  }: Pick<Dependencies, 'now' | 'compute' | 'log' | 'afterPlan'> = {},
): Promise<void> {
  try {
    await compute({ ownerUserId, season, now, triggerEvent: 'features-changed' });
    await afterPlan(ownerUserId, now);
  } catch (error) {
    log('warn', { event: 'planning_features_recalculation_failed', season, weekStart: weekStartDateKey(now, FARM_TIME_ZONE), error: describe(error), failedAt: new Date().toISOString() });
  }
}

async function isPlanningEnabled(ownerUserId: string): Promise<boolean> {
  return (await getEnabledFeaturesForUser(ownerUserId)).includes('planning');
}

/** Un événement d'une autre semaine ne change pas le plan de celle-ci (règle 5) ; un événement durable compte dès qu'il n'est pas à venir. */
function concernsWeek(event: PlanEvent, weekStart: string): boolean {
  let eventWeek: string;
  try {
    eventWeek = weekStartDateKey(event.at, FARM_TIME_ZONE);
  } catch {
    return true;
  }
  return event.lasting ? eventWeek <= weekStart : eventWeek === weekStart;
}

async function computeAfterSnapshot({ ownerUserId, season, now, triggerEvent }: ComputeInput): Promise<StoredWeeklyPlan> {
  // La lecture de l'instantané est mesurée ici, avec le chronomètre que le service poursuit (point ouvert 34).
  const stopwatch = startStopwatch();
  const snapshot = await getIrrigationSnapshot(ownerUserId, { season });
  stopwatch.lap('snapshot');
  return computeWeeklyPlanForUser({ ownerUserId, season, snapshot, now, trigger: 'event', triggerEvent, stopwatch });
}

/**
 * Après la réponse quand l'hébergement le permet (règle 6) : le Worker
 * poursuit le travail confié à `waitUntil` une fois la réponse envoyée. Hors
 * Worker — les tests, un serveur Node —, le travail se fait avant la réponse,
 * borné par le budget de temps du calcul (D-027).
 */
async function afterResponse(work: () => Promise<void>): Promise<void> {
  const { waitUntil } = workers as { waitUntil?: (promise: Promise<unknown>) => void };
  const promise = work();
  if (typeof waitUntil === 'function') {
    try {
      waitUntil(promise);
      return;
    } catch {
      // Hors contexte de requête : on attend soi-même.
    }
  }
  await promise;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
