import type { IrrigationBedApplicationDraft } from '../irrigation-event-record.ts';
import type { IrrigationNeedPriority } from '../irrigation-needs.ts';
import { durationSecondsForTarget, millimetersForDurationSeconds } from '../irrigation-timer.ts';
import { MILLISECONDS_PER_DAY, cubicMetersFromMillimeters, millisecondsFromMinutes, millisecondsFromSeconds, secondsForMillimeters, secondsFromMilliseconds } from '../units.ts';
import { addDaysToDateKey, dateKeyInTimeZone, localDateStartUtc } from '../water-management.ts';
import type { DoseReason, PlanBedApplication, PlanBedOutcome, PlanProposal, PlanningInputs, TimingReason, UnplacedReason, WeeklyPlan } from './contract.ts';
import { buildPlanningBeds, buildPlanningEquipment, compareBedsForService, PRIORITY_RANK, type PlanningEquipment } from './demand.ts';
import { buildSupplyChains } from './chains.ts';
import { summarizeDeficit } from './deficit.ts';
import { describeLimitingConstraint, type PumpConstraint } from './justification.ts';
import { boundingProtectedNames, endsBeforeProtected, protectedIntervalsBetween, protectedNamesWithin, startsAfterProtected, withoutProtectedIntervals, type ProtectedInterval } from './protected-slots.ts';
import { refusedIntervalsByEquipment, withoutRefusedIntervals, type RefusedInterval } from './refusals.ts';
import { buildPlanSuggestions } from './suggestions.ts';
import { applyShortage, arbitrationOutcome, placedBudgets, type BedState } from './shortage.ts';
import { redistributeShares, type ShareLedger, type SharePlacement } from './shares.ts';
import type { PlanningSettings } from './settings.ts';
import { DailyLimitLedger, datesBetween, fitWithinDailyRemaining, type ReservoirTimeline, type SupplyChain } from './supply.ts';
import { windowIntervals } from './windows.ts';

/**
 * Le moteur de planning hebdomadaire (docs/planning-contract.md, D-024) :
 * une fonction pure et déterministe qui place des créneaux du moment du
 * calcul à dimanche minuit. Les règles de quantité sont celles de la 3.3, de
 * volume celles de la 3.1, de pompe celles de la 3.2, de limite celles de la
 * 2.8 ; le moteur n'ajoute que l'ordre, le temps, et l'explication.
 */

const EPSILON = 1e-9;
/** Un reste sous un centième de millimètre est un résidu d'arrondi des secondes, pas un besoin. */
const NEGLIGIBLE_MM = 0.01;
const MAX_ITERATIONS = 10_000;
/** Les tours de placement : les parts libérées en fin de tour sont redistribuées, quatre tours au plus (D-037). */
const MAX_SHARE_ROUNDS = 4;
const MILLISECONDS_PER_MINUTE = millisecondsFromMinutes(1);


export function buildWeeklyPlan(inputs: PlanningInputs, settings: PlanningSettings): WeeklyPlan {
  const timeZone = inputs.timeZone;
  const now = inputs.now;
  const weekEndAt = localDateStartUtc(addDaysToDateKey(inputs.weekEnd, 1), timeZone);
  const horizonStart = now < weekEndAt ? now : weekEndAt;
  const equipment = buildPlanningEquipment(inputs, settings);
  const equipmentById = new Map(equipment.map((item) => [item.id, item]));
  const beds: BedState[] = buildPlanningBeds(inputs, equipment, settings, { weekEndAt }).map((bed) => ({
    ...bed,
    targetMm: bed.needMm,
    remainingMm: bed.needMm,
    placedMm: 0,
    surplusMm: 0,
    reasons: new Set(bed.unplannable ? [bed.unplannable] : []),
    proposalIds: [],
    starts: bed.irrigationStartsAt.map((at) => at.getTime()),
    shareCut: null,
  }));
  const bedsById = new Map(beds.map((bed) => [bed.bedId, bed]));

  const chains = buildSupplyChains(inputs, equipment, horizonStart, weekEndAt);
  const ledger = new DailyLimitLedger({ events: inputs.events, limits: inputs.dailyLimits, now, timeZone });
  const { budgets: pendingBudgets, shares, arbitration } = applyShortage(beds, equipment, chains, ledger, horizonStart, weekEndAt, inputs, settings);

  const proposals: PlanProposal[] = [];
  const days = horizonStart < weekEndAt ? datesBetween(horizonStart, weekEndAt, timeZone) : [];
  const blockedEquipment = new Map<string, UnplacedReason>();
  const refused = refusedIntervalsByEquipment(inputs.refusedSlots);
  // Les créneaux protégés de la semaine, pour tout le matériel de l'exploitation (D-062, règles 2 et 5).
  const protectedIntervals = protectedIntervalsBetween(inputs.protectedSlots, horizonStart, weekEndAt, timeZone);
  const protectedNamesByBed = new Map<string, string[]>();
  const context: PlacementContext = { beds: bedsById, chains, ledger, shares, refused, protectedIntervals, days, horizonStart, weekEndAt, timeZone, settings, proposals, now };

  for (let round = 0; round < MAX_SHARE_ROUNDS; round += 1) {
    const shareBlocked = new Set<string>();
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
      const candidate = nextCandidate(beds, equipment, blockedEquipment, settings, days, timeZone);
      if (!candidate) break;
      const placed = placeCandidate(candidate, context);
      if (!placed.ok) {
        blockedEquipment.set(candidate.equipment.id, placed.reason);
        if (placed.shareBound) shareBlocked.add(candidate.equipment.id);
        for (const bed of candidate.assignedBeds) {
          bed.reasons.add(placed.reason);
          const names = protectedNamesByBed.get(bed.bedId) ?? [];
          for (const name of placed.protectedSlotNames ?? []) if (!names.includes(name)) names.push(name);
          if (names.length > 0) protectedNamesByBed.set(bed.bedId, names);
        }
      }
    }
    // Fin du tour (D-037) : les parts non reçues sont libérées et redistribuées aux planches que leur matériel peut encore
    // servir ; un matériel arrêté par sa part repart si elle a grandi.
    const canStillServe = (bed: BedState) => bed.equipmentId !== null && (!blockedEquipment.has(bed.equipmentId) || shareBlocked.has(bed.equipmentId));
    if (round === MAX_SHARE_ROUNDS - 1 || !redistributeShares(new Set(shares.values()), canStillServe)) break;
    for (const id of shareBlocked) blockedEquipment.delete(id);
  }

  if (days.length === 0) {
    for (const bed of beds) if (bed.remainingMm > NEGLIGIBLE_MM) bed.reasons.add('no-time-left');
  }

  // Le niveau projeté de la réserve se lit sur le plan fini, pas au moment du placement (recette du 29 septembre 2026).
  for (const proposal of proposals) {
    const chain = chains.get(proposal.equipmentId);
    if (proposal.justification.supply && chain?.reservoir) {
      proposal.justification.supply.projectedLevelAfterCubicMeters = chain.reservoir.levelAt(Date.parse(proposal.endAt));
    }
  }

  const outcomes = beds.map((bed): PlanBedOutcome => {
    const deficitMm = bed.needMm - bed.placedMm < NEGLIGIBLE_MM ? 0 : bed.needMm - bed.placedMm;
    if (deficitMm > 0 && bed.reasons.size === 0 && bed.shareCut) bed.reasons.add(bed.shareCut);
    if (deficitMm > 0 && bed.reasons.size === 0) bed.reasons.add(fallbackReason(bed, equipmentById, bedsById, settings));
    return {
      bedId: bed.bedId,
      bedName: bed.bedName,
      plotName: bed.plotName,
      priority: bed.priority,
      needMm: bed.needMm,
      targetMm: bed.targetMm,
      placedMm: bed.placedMm,
      surplusMm: bed.surplusMm,
      deficitMm,
      reasons: [...bed.reasons].sort(),
      proposalIds: bed.proposalIds,
      equipmentId: bed.equipmentId,
      // Les noms du motif « créneau protégé », seulement quand il est là : sans créneau, la planche reste celle d'avant (D-062).
      ...(bed.reasons.has('protected-slot') ? { protectedSlotNames: protectedNamesByBed.get(bed.bedId) ?? [] } : {}),
    };
  });

  // Les suggestions sur les arrosages validés (3.7, règles 11 à 17) : lues sur les mêmes entrées, jamais appliquées par le moteur.
  const { suggestions, overcommittedDays } = buildPlanSuggestions(inputs, settings, { horizonStart, weekEndAt, lastDay: days.at(-1) });

  return {
    weekStart: inputs.weekStart,
    weekEnd: inputs.weekEnd,
    computedAt: now.toISOString(),
    horizonStartAt: horizonStart.toISOString(),
    horizonEndAt: weekEndAt.toISOString(),
    proposals,
    beds: outcomes,
    deficit: summarizeDeficit(outcomes, beds, equipmentById),
    // La part placée de chaque niveau se lit sur le plan fini, à côté de sa part visée (décision 2 de la 3.9, D-052).
    budgets: placedBudgets(pendingBudgets),
    // Sous un arbitrage validé, ce que les planches allouées n'ont pas reçu reste non attribué : le plan le dit (D-052).
    ...(arbitration ? { arbitration: arbitrationOutcome(arbitration) } : {}),
    // La file du report suivie, pour qu'un calcul sans événement la reprenne (décision 4 de la 3.9, D-052).
    ...(inputs.deferredBedIds?.length ? { deferredQueue: [...inputs.deferredBedIds] } : {}),
    suggestions,
    overcommittedDays,
    settings,
    assumptions: {
      forecastDays: inputs.days.filter((day) => day.forecastRainMm !== null).length,
      reservoirsObservedAt: inputs.infrastructure.reservoirs.map((reservoir) => ({
        reservoirId: reservoir.id,
        name: reservoir.name,
        observedAt: reservoir.currentVolumeObservedAt,
        currentCubicMeters: reservoir.currentVolumeCubicMeters,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Candidats et placement
// ---------------------------------------------------------------------------

type Candidate = {
  equipment: PlanningEquipment;
  assignedBeds: BedState[];
  lead: BedState;
  referenceBed: BedState;
  referenceRate: number;
  doseMm: number;
  doseReason: DoseReason;
  durationSeconds: number;
  minimumDurationSeconds: number;
};

function nextCandidate(
  beds: readonly BedState[],
  equipment: readonly PlanningEquipment[],
  blocked: ReadonlyMap<string, UnplacedReason>,
  settings: PlanningSettings,
  days: readonly string[],
  timeZone: string,
): Candidate | null {
  const lastDay = days.at(-1);
  const candidates: Candidate[] = [];
  for (const item of equipment) {
    if (blocked.has(item.id)) continue;
    const assigned = beds.filter((bed) => bed.equipmentId === item.id && bed.remainingMm > NEGLIGIBLE_MM && bed.unplannable === null);
    if (assigned.length === 0) continue;
    const ordered = [...assigned].sort(compareBedsForService);
    const dose = settings.doses[item.kind];
    // La planche la mieux arrosée fixe la dose (D-025) ; à taux égal, le besoin le plus élevé ou le plus faible (R11).
    const rateOf = (bed: BedState) => item.coveredBeds.find((entry) => entry.bedId === bed.bedId)?.rateMmPerHour ?? 0;
    const reference = ordered.reduce((best, bed) => {
      const gap = rateOf(bed) - rateOf(best);
      if (gap > EPSILON) return bed;
      if (gap < -EPSILON) return best;
      if (settings.collectiveDoseRule === 'highest-need') return bed.remainingMm > best.remainingMm + EPSILON ? bed : best;
      return bed.remainingMm < best.remainingMm - EPSILON ? bed : best;
    });
    let doseMm = reference.remainingMm;
    let doseReason: DoseReason = 'remaining-need';
    if (doseMm > dose.maximumMm) {
      doseMm = dose.maximumMm;
      doseReason = 'maximum-dose';
    }
    if (doseMm < dose.minimumMm - EPSILON) {
      const onlyLastDay = lastDay !== undefined && dateKeyInTimeZone(reference.earliestStartAt, timeZone) >= lastDay;
      if (!onlyLastDay && lastDay !== undefined) {
        // Trop peu pour arroser : la planche attend que son besoin grandisse, sauf le dernier jour.
        continue;
      }
      doseReason = 'last-day-below-minimum';
    }
    const covered = item.coveredBeds.find((entry) => entry.bedId === reference.bedId);
    if (!covered) continue;
    let durationSeconds = durationSecondsForTarget(doseMm, covered.rateMmPerHour);
    // Aucune planche arrosée ne reçoit plus que la dose maximale.
    for (const entry of item.coveredBeds) {
      if (entry.rateMmPerHour <= 0) continue;
      const cap = Math.max(1, Math.floor(secondsForMillimeters(dose.maximumMm, entry.rateMmPerHour)));
      if (cap < durationSeconds) {
        durationSeconds = cap;
        doseReason = 'maximum-dose';
      }
    }
    if (durationSeconds <= 0) continue;
    const minimumDurationSeconds = doseReason === 'last-day-below-minimum'
      ? 1
      : Math.min(durationSeconds, Math.max(1, Math.ceil(secondsForMillimeters(dose.minimumMm, covered.rateMmPerHour))));
    candidates.push({ equipment: item, assignedBeds: assigned, lead: ordered[0], referenceBed: reference, referenceRate: covered.rateMmPerHour, doseMm, doseReason, durationSeconds, minimumDurationSeconds });
  }
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => compareBedsForService(left.lead, right.lead)
    || left.equipment.name.localeCompare(right.equipment.name, 'fr')
    || left.equipment.id.localeCompare(right.equipment.id));
  return candidates[0];
}

type PlacementContext = {
  beds: ReadonlyMap<string, BedState>;
  chains: ReadonlyMap<string, SupplyChain>;
  ledger: DailyLimitLedger;
  /** Le registre des parts réservées de chaque matériel, quand sa chaîne a un budget fini (D-037). */
  shares: ReadonlyMap<string, ShareLedger>;
  /** Les créneaux refusés de la semaine, par matériel (D-030). */
  refused: ReadonlyMap<string, readonly RefusedInterval[]>;
  /** Les créneaux protégés de la semaine en instants, réunis, pour tout le matériel (D-062). */
  protectedIntervals: readonly ProtectedInterval[];
  days: readonly string[];
  horizonStart: Date;
  weekEndAt: Date;
  timeZone: string;
  settings: PlanningSettings;
  proposals: PlanProposal[];
  now: Date;
};

function placeCandidate(candidate: Candidate, context: PlacementContext): { ok: true } | { ok: false; reason: UnplacedReason; shareBound?: boolean; protectedSlotNames?: string[] } {
  const { equipment } = candidate;
  const chain = context.chains.get(equipment.id);
  if (!chain) return { ok: false, reason: 'no-equipment' };
  if (chain.unavailable) return { ok: false, reason: 'supply-unavailable' };
  const dose = context.settings.doses[equipment.kind];
  const spacingMs = dose.spacingDays * MILLISECONDS_PER_DAY;
  const wateredBeds = equipment.coveredBeds
    .map((covered) => ({ covered, state: context.beds.get(covered.bedId) ?? null }))
    .filter((entry) => entry.covered.rateMmPerHour > 0);
  // R6 et R7 ne comptent que les planches qui commandent ce matériel (D-025).
  const commandingBeds = wateredBeds.filter((entry) => entry.covered.commands);
  const servedBedIds = new Set(candidate.assignedBeds.map((bed) => bed.bedId));

  // Pas avant : le calcul, la pluie prévue des planches servies, l'espacement de toutes les planches arrosées.
  let earliestMs = context.horizonStart.getTime();
  let timingReason: TimingReason = 'earliest';
  for (const bed of candidate.assignedBeds) {
    if (bed.earliestStartAt.getTime() > earliestMs) {
      earliestMs = bed.earliestStartAt.getTime();
      timingReason = 'after-forecast-rain';
    }
  }
  for (const { state } of commandingBeds) {
    if (!state) continue;
    for (const start of state.starts) {
      if (start + spacingMs > earliestMs) {
        earliestMs = start + spacingMs;
        timingReason = 'spacing';
      }
    }
  }
  earliestMs = roundUpToMinute(earliestMs);

  const window = context.settings.windows[equipment.kind];
  const earliestDateKey = candidate.assignedBeds.reduce<string | null>((latest, bed) => (bed.earliestDateKey !== null && (latest === null || bed.earliestDateKey > latest) ? bed.earliestDateKey : latest), null);
  const eligibleDays = earliestDateKey === null ? context.days : context.days.filter((day) => day >= earliestDateKey);
  const windowed = windowIntervals(window, eligibleDays, { notBefore: new Date(earliestMs), notAfter: context.weekEndAt }, context.timeZone);
  // Les créneaux protégés sont retirés des plages, pour tout matériel et sans exception (D-062, règles 5 et 6), puis
  // les créneaux refusés de ce matériel, comme une plage borne (D-030, point ouvert 31).
  const usable = withoutProtectedIntervals(windowed, context.protectedIntervals);
  const intervals = withoutRefusedIntervals(usable, context.refused.get(equipment.id) ?? []);
  let blockingReason: UnplacedReason = 'pump-time';
  for (const interval of intervals) {
    let startMs = Math.max(interval.startAt.getTime(), earliestMs);
    // La plage a ouvert après l'instant permis : le motif reste celui qui a fixé le jour — pluie, espacement — ;
    // la plage ne se nomme que si rien d'autre n'a contraint (point ouvert 33, corrigé le 9 octobre 2026).
    // Un créneau refusé qui repousse le début se nomme toujours : c'est une décision du maraîcher (D-030).
    let attemptTiming: TimingReason = startMs > earliestMs && timingReason === 'earliest' ? 'window' : timingReason;
    if (interval.startsAfterRefusal && startMs === interval.startAt.getTime() && startMs > earliestMs) {
      attemptTiming = 'after-refused-slot';
      // La fin d'un créneau refusé tombe à la seconde : le créneau suivant part à la minute ronde, comme après la pompe.
      startMs = roundUpToMinute(startMs);
    } else if (startsAfterProtected(interval) && startMs === interval.startAt.getTime() && startMs > earliestMs) {
      // Un créneau protégé qui repousse le début se nomme de même ; sa fin tombe à la minute, rien à arrondir (D-062, règle 6).
      attemptTiming = 'after-protected-slot';
    }
    let pumpBefore: PumpConstraint['before'] = null;
    let pumpAfter: PumpConstraint['after'] = null;
    const dayStartsExhausted = commandingBeds.some(({ state }) => state
      && state.starts.filter((start) => dateKeyInTimeZone(new Date(start), context.timeZone) === interval.dateKey).length >= dose.irrigationsPerDay);
    if (dayStartsExhausted) {
      blockingReason = 'spacing';
      continue;
    }
    const endLimitMs = interval.endAt.getTime();
    for (let guard = 0; guard < 200 && startMs < endLimitMs; guard += 1) {
      const minimumMs = millisecondsFromSeconds(candidate.minimumDurationSeconds);
      // La durée la plus courte acceptée : la dose minimale, sauf pour une part du dernier jour (plus bas).
      let minimumSeconds = candidate.minimumDurationSeconds;
      if (endLimitMs - startMs < minimumMs) {
        // Trop court avant le créneau refusé alors que la plage entière aurait suffi : c'est le refus qui empêche.
        if (guard === 0 && interval.endsBeforeRefusal && interval.windowEndAt.getTime() - startMs >= minimumMs) blockingReason = 'refused-slot';
        // De même avant un créneau protégé, la plage R8 entière jugée (D-062, règle 5).
        else if (guard === 0 && endsBeforeProtected(interval) && interval.rangeEndAt.getTime() - startMs >= minimumMs) blockingReason = 'protected-slot';
        break;
      }
      let availableEndMs = endLimitMs;
      let doseReason = candidate.doseReason;
      // La pompe : le débit engagé plus le nôtre reste sous sa capacité.
      if (chain.pumpTimeline && equipment.flowCubicMetersPerHour !== null) {
        const fit = chain.pumpTimeline.fitFrom(startMs, equipment.flowCubicMetersPerHour, endLimitMs);
        if (fit.endMs === null) {
          if (fit.nextTryMs === null || fit.nextTryMs >= endLimitMs) break;
          pumpBefore = { kind: 'held', occupants: chain.pumpTimeline.describeConflictAt(startMs) };
          startMs = roundUpToMinute(fit.nextTryMs);
          attemptTiming = 'pump-capacity';
          continue;
        }
        availableEndMs = fit.endMs;
      }
      if (chain.resource && equipment.flowCubicMetersPerHour !== null && equipment.flowCubicMetersPerHour > chain.resource.flowCapacity() + EPSILON) {
        return { ok: false, reason: 'supply-unavailable' };
      }
      let durationSeconds = Math.min(candidate.durationSeconds, Math.floor(secondsFromMilliseconds(availableEndMs - startMs)));
      if (durationSeconds < candidate.minimumDurationSeconds) {
        // Le trou est trop court : réessayer après lui.
        if (chain.pumpTimeline && availableEndMs !== endLimitMs) pumpBefore = { kind: 'gap-too-short', occupants: chain.pumpTimeline.describeConflictAt(availableEndMs) };
        startMs = roundUpToMinute(availableEndMs);
        attemptTiming = 'pump-capacity';
        continue;
      }
      if (durationSeconds < candidate.durationSeconds) {
        doseReason = availableEndMs === endLimitMs
          ? (interval.endsBeforeRefusal ? 'refused-slot-fit' : endsBeforeProtected(interval) ? 'protected-slot-fit' : 'window-fit')
          : 'pump-gap';
        if (doseReason === 'pump-gap') pumpAfter = chain.pumpTimeline?.describeConflictAt(availableEndMs) ?? null;
      }

      let endMs = startMs + millisecondsFromSeconds(durationSeconds);
      let applications = applicationsFor(equipment, durationSeconds);
      let volume = volumeOf(applications);
      // Une coupe raccourcit le créneau depuis son début : sa fin, ses apports et son volume suivent sa durée.
      const shortenTo = (seconds: number) => {
        durationSeconds = seconds;
        endMs = startMs + millisecondsFromSeconds(seconds);
        applications = applicationsFor(equipment, seconds);
        volume = volumeOf(applications);
      };

      // La limite journalière (2.8), jour civil par jour civil depuis le début du créneau ; le premier jour plein, il part
      // à minuit si sa plage continue (point ouvert 58, D-085).
      const limit = context.ledger.evaluate(startMs, endMs, volume);
      if (limit.status === 'unknown-under-limit') {
        blockingReason = 'volume-unknown-under-limit';
        break;
      }
      if (limit.status === 'exceeded' && volume !== null && volume > 0) {
        const fit = fitWithinDailyRemaining({ startMs, durationSeconds, cubicMeters: volume, minimumSeconds: candidate.minimumDurationSeconds, endLimitMs, timeZone: context.timeZone, remainingFor: (date) => context.ledger.remainingFor(date) });
        if (fit.kind === 'midnight') {
          startMs = fit.startMs;
          attemptTiming = 'daily-limit';
          continue;
        }
        if (fit.kind === 'blocked') {
          blockingReason = 'daily-limit';
          break;
        }
        if (fit.kind === 'cut') {
          shortenTo(fit.seconds);
          doseReason = 'daily-limit';
          attemptTiming = attemptTiming === 'earliest' ? 'daily-limit' : attemptTiming;
        }
      }

      // La part réservée (D-037) : le créneau ne prend que ce que ses parts paient ; la coupe ne dépend pas du jour.
      const shares = context.shares.get(equipment.id);
      if (shares && volume !== null) {
        const shortened = shares.longestDurationWithinShares((seconds) => placementAt(equipment, seconds), durationSeconds, servedBedIds);
        if (shortened < durationSeconds) {
          // Sous la dose minimale, le matériel attend une part plus grande ; la plage du dernier jour la place quand même,
          // comme un reste hors pénurie (décision 5 de la 3.9, D-052).
          if (shortened < minimumSeconds && interval.dateKey === context.days.at(-1)) minimumSeconds = 1;
          if (shortened < minimumSeconds) return { ok: false, reason: shares.shortfallReason, shareBound: true };
          // La seconde d'arrondi de la durée n'est pas une coupe : le motif ne se nomme que si la planche de référence y perd un reste visible.
          const material = millimetersForDurationSeconds(candidate.referenceRate, durationSeconds - shortened) >= NEGLIGIBLE_MM;
          shortenTo(shortened);
          if (material) {
            doseReason = 'reserved-share';
            for (const bed of candidate.assignedBeds) bed.shareCut = shares.shortfallReason;
          }
        }
      }

      // L'eau : la réserve ne passe pas sous son minimum d'ici la fin de l'horizon, la ressource directe ne dépasse pas son jour.
      let projectedLevel: number | null = null;
      if (chain.reservoir && volume !== null) {
        const evaluation = chain.reservoir.evaluate({ startMs, endMs, cubicMeters: volume });
        if (evaluation.status === 'short') {
          if (evaluation.retryAtMs !== null && evaluation.retryAtMs < endLimitMs) {
            // Le manque est celui du créneau : l'apport le comble en attendant.
            startMs = roundUpToMinute(evaluation.retryAtMs);
            attemptTiming = 'reserve-inflow';
            continue;
          }
          // Attendre ne comble rien : la plus longue durée que la réserve accepte, sinon un autre jour.
          const shortened = longestDurationUnderReserve(chain.reservoir, equipment, startMs, durationSeconds);
          if (shortened < minimumSeconds) {
            blockingReason = 'reserve-timing';
            break;
          }
          shortenTo(shortened);
          doseReason = 'reserve-level';
        }
        projectedLevel = evaluation.status === 'unknown' ? null : chain.reservoir.minimumLevel(endMs, endMs, { startMs, endMs, cubicMeters: volume ?? 0 })?.minimum ?? null;
      }
      // Une ressource prélevée directement n'a ni stock ni minimum : sa limite de prélèvement se juge comme la limite
      // journalière, et sa coupe porte son nom (points ouverts 54 et 55, D-085).
      const directResource = chain.resource;
      if (directResource && volume !== null && volume > 0) {
        const fit = fitWithinDailyRemaining({ startMs, durationSeconds, cubicMeters: volume, minimumSeconds, endLimitMs, timeZone: context.timeZone, remainingFor: (date) => directResource.remainingForDate(date) });
        if (fit.kind === 'midnight') {
          startMs = fit.startMs;
          attemptTiming = 'withdrawal-limit';
          continue;
        }
        if (fit.kind === 'blocked') {
          blockingReason = 'withdrawal-limit';
          break;
        }
        if (fit.kind === 'cut') {
          shortenTo(fit.seconds);
          doseReason = 'withdrawal-limit';
        }
      }

      const protectedSlotNames = boundingProtectedNames(interval, { start: attemptTiming === 'after-protected-slot', end: doseReason === 'protected-slot-fit' });
      commitProposal(candidate, context, chain, { startMs, endMs, durationSeconds, applications, volume, doseReason, timingReason: attemptTiming, projectedLevel, wateredBeds, pump: { before: pumpBefore, after: pumpAfter }, protectedSlotNames });
      return { ok: true };
    }
    if (blockingReason === 'volume-unknown-under-limit' || blockingReason === 'daily-limit' || blockingReason === 'reserve-timing' || blockingReason === 'withdrawal-limit') {
      // Un autre jour peut passer : on ne bloque le matériel qu'après tous les jours.
      continue;
    }
  }
  // Aucune plage : l'espacement l'a repoussé après dimanche, ou la semaine n'en a plus ; des plages toutes protégées : les
  // créneaux protégés, nommés ; toutes refusées : le refus.
  if (windowed.length === 0) return { ok: false, reason: timingReason === 'spacing' ? 'spacing' : 'no-time-left' };
  const reason = usable.length === 0 ? 'protected-slot' : intervals.length === 0 ? 'refused-slot' : blockingReason;
  return reason === 'protected-slot' ? { ok: false, reason, protectedSlotNames: protectedNamesWithin(windowed, context.protectedIntervals) } : { ok: false, reason };
}

/**
 * Le motif d'un reste sans cause enregistrée (D-025) : la portée du matériel
 * quand la planche est arrosée moins vite que sa planche de référence et que
 * celle-ci est servie à un reste sous la dose minimale près ; une dose sous
 * le minimum qui attend ; sinon le temps de pompage.
 */
function fallbackReason(bed: BedState, equipmentById: ReadonlyMap<string, PlanningEquipment>, bedsById: ReadonlyMap<string, BedState>, settings: PlanningSettings): UnplacedReason {
  const item = bed.equipmentId ? equipmentById.get(bed.equipmentId) : undefined;
  const own = item?.coveredBeds.find((covered) => covered.bedId === bed.bedId);
  if (!item || !own) return 'pump-time';
  const minimumMm = settings.doses[item.kind].minimumMm;
  const commanding = item.coveredBeds.filter((covered) => covered.commands);
  const strongest = commanding.reduce((best, covered) => Math.max(best, covered.rateMmPerHour), 0);
  const references = commanding
    .filter((covered) => covered.rateMmPerHour + EPSILON >= strongest)
    .map((covered) => bedsById.get(covered.bedId))
    .filter((state): state is BedState => state !== undefined);
  const referenceServed = references.length > 0 && references.every((state) => state.remainingMm < minimumMm - EPSILON);
  if (own.rateMmPerHour + EPSILON < strongest && referenceServed) return 'insufficient-reach';
  if (bed.remainingMm < minimumMm - EPSILON) return 'below-minimum-dose';
  return 'pump-time';
}

function roundUpToMinute(ms: number): number {
  return Math.ceil(ms / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE;
}

type PlacedApplication = IrrigationBedApplicationDraft & { appliedMm: number; commands: boolean };

function applicationsFor(equipment: PlanningEquipment, durationSeconds: number): PlacedApplication[] {
  return equipment.coveredBeds.map((covered) => ({
    commands: covered.commands,
    otfZoneId: covered.otfZoneId,
    otfPlotId: covered.otfPlotId,
    otfBedId: covered.bedId,
    rateMmPerHour: covered.rateMmPerHour,
    bedAreaSquareMeters: covered.bedAreaSquareMeters,
    wettedAreaSquareMeters: covered.wettedAreaSquareMeters,
    appliedMm: millimetersForDurationSeconds(covered.rateMmPerHour, durationSeconds),
  }));
}

function volumeOf(applications: readonly (IrrigationBedApplicationDraft & { appliedMm: number })[]): number | null {
  let total = 0;
  for (const application of applications) {
    if (application.appliedMm <= 0) continue;
    if (application.wettedAreaSquareMeters === null) return null;
    total += cubicMetersFromMillimeters(application.appliedMm, application.wettedAreaSquareMeters);
  }
  return total;
}

/** Un créneau d'une durée donnée tel que le registre des parts le juge (D-037). */
function placementAt(equipment: PlanningEquipment, durationSeconds: number): SharePlacement {
  const applications = applicationsFor(equipment, durationSeconds);
  return { applications, volumeCubicMeters: volumeOf(applications) };
}

/**
 * La plus longue durée, en secondes entières, que la réserve accepte pour un
 * créneau commencé à cet instant, jugée jusqu'à la fin de l'horizon : le
 * niveau projeté monte quand le prélèvement baisse, une bissection suffit.
 * Zéro quand la réserve est déjà engagée sous son minimum sans ce créneau.
 */
function longestDurationUnderReserve(reservoir: ReservoirTimeline, equipment: PlanningEquipment, startMs: number, durationSeconds: number): number {
  const accepted = (seconds: number) => {
    const volume = volumeOf(applicationsFor(equipment, seconds));
    return volume === null || reservoir.evaluate({ startMs, endMs: startMs + millisecondsFromSeconds(seconds), cubicMeters: volume }).status !== 'short';
  };
  if (!accepted(0)) return 0;
  let low = 0;
  let high = durationSeconds;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (accepted(middle)) low = middle;
    else high = middle;
  }
  return low;
}

function commitProposal(
  candidate: Candidate,
  context: PlacementContext,
  chain: SupplyChain,
  placement: {
    startMs: number;
    endMs: number;
    durationSeconds: number;
    applications: PlacedApplication[];
    volume: number | null;
    doseReason: DoseReason;
    timingReason: TimingReason;
    projectedLevel: number | null;
    wateredBeds: { covered: PlanningEquipment['coveredBeds'][number]; state: BedState | null }[];
    pump: PumpConstraint;
    /** Les créneaux protégés qui l'ont repoussé ou coupé, pour la contrainte limitante (D-062). */
    protectedSlotNames: readonly string[];
  },
): void {
  const { equipment } = candidate;
  // La part réservée s'impute avant que le créneau n'entame les besoins (D-037).
  context.shares.get(equipment.id)?.charge({ applications: placement.applications, volumeCubicMeters: placement.volume }, new Set(candidate.assignedBeds.map((bed) => bed.bedId)));
  const id = `p-${context.proposals.length + 1}`;
  const flow = equipment.flowCubicMetersPerHour;
  const engagedBefore = chain.pumpTimeline ? chain.pumpTimeline.peakFlowBetween(placement.startMs, placement.endMs) : 0;
  const bedApplications: PlanBedApplication[] = [];
  let highest: IrrigationNeedPriority = candidate.lead.priority;
  for (const application of placement.applications) {
    const state = context.beds.get(application.otfBedId);
    const needBefore = state?.remainingMm ?? 0;
    const applied = application.appliedMm;
    const useful = Math.min(applied, needBefore);
    if (state) {
      state.remainingMm = Math.max(0, state.remainingMm - applied);
      state.placedMm += useful;
      if (state.remainingMm > 0 && state.remainingMm < NEGLIGIBLE_MM) {
        state.placedMm += state.remainingMm;
        state.remainingMm = 0;
      }
      state.surplusMm += Math.max(0, applied - needBefore);
      if (application.commands) state.starts.push(placement.startMs);
      state.proposalIds.push(id);
      if (PRIORITY_RANK[state.priority] < PRIORITY_RANK[highest]) highest = state.priority;
    }
    bedApplications.push({
      bedId: application.otfBedId,
      bedName: state?.bedName ?? application.otfBedId,
      needBeforeMm: needBefore,
      appliedMm: applied,
      needAfterMm: state?.remainingMm ?? 0,
      surplusMm: Math.max(0, applied - needBefore),
      wettedAreaSquareMeters: application.wettedAreaSquareMeters,
    });
  }
  if (chain.pumpTimeline && flow !== null) chain.pumpTimeline.add(placement.startMs, placement.endMs, flow, equipment.name);
  if (chain.reservoir && placement.volume !== null) chain.reservoir.addWithdrawal({ startMs: placement.startMs, endMs: placement.endMs, cubicMeters: placement.volume });
  if (chain.resource && placement.volume !== null) chain.resource.addWithdrawal(placement.startMs, placement.endMs, placement.volume);
  if (placement.volume !== null) context.ledger.add(placement.startMs, placement.endMs, placement.volume);

  const referenceApplied = placement.applications.find((application) => application.otfBedId === candidate.referenceBed.bedId)?.appliedMm ?? candidate.doseMm;
  const limitingConstraint = describeLimitingConstraint(placement, chain, context.timeZone);
  context.proposals.push({
    id,
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    kind: equipment.kind,
    settingId: equipment.settingId,
    settingName: equipment.settingName,
    placementId: equipment.placementId,
    startAt: new Date(placement.startMs).toISOString(),
    endAt: new Date(placement.endMs).toISOString(),
    durationSeconds: placement.durationSeconds,
    doseMm: referenceApplied,
    applications: placement.applications.map((application) => ({
      otfZoneId: application.otfZoneId,
      otfPlotId: application.otfPlotId,
      otfBedId: application.otfBedId,
      rateMmPerHour: application.rateMmPerHour,
      bedAreaSquareMeters: application.bedAreaSquareMeters,
      wettedAreaSquareMeters: application.wettedAreaSquareMeters,
    })),
    bedApplications,
    volumeCubicMeters: placement.volume,
    flowCubicMetersPerHour: flow,
    pumpId: chain.pumpTimeline?.pump.id ?? null,
    pumpOriginId: chain.origin?.id ?? null,
    justification: {
      priority: highest,
      doseReason: placement.doseReason,
      timingReason: placement.timingReason,
      limitingConstraint,
      pump: chain.pumpTimeline ? { pumpId: chain.pumpTimeline.pump.id, pumpName: chain.pumpTimeline.pump.name, flowCubicMetersPerHour: flow, alreadyEngagedCubicMetersPerHour: engagedBefore } : null,
      supply: chain.originKey ? { originKey: chain.originKey, originName: chain.originName, projectedLevelAfterCubicMeters: placement.projectedLevel } : null,
      hydraulicallyVerified: chain.pumpTimeline !== null && flow !== null && chain.origin !== null && (chain.reservoir ? chain.reservoir.known : chain.resource !== null),
    },
  });
}
