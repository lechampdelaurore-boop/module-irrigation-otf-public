import {
  beginOtfFarmRead,
  claimOtfCallPlace,
  endOtfFarmRead,
  holdOtfCalls,
  readOtfFarmPace,
  recordOtfAuthenticationFailure,
} from '@/db/otf-call-ledger-repository';
import type { OtfSharedCallPace } from '@/lib/adapters/otf/read-client';
import { logJsonLine } from '@/lib/adapters/log';
import {
  farmReadReserve,
  farmReadStart,
  nextReserveBasis,
  OTF_MORNING_MINUTE_WAIT_MS,
  OTF_SECOND_READ_WAIT_MS,
  OtfReadDeferredError,
  sharedPlaceRefusal,
  type FarmReadOutcome,
  type OtfReadContext,
} from '@/lib/domain/otf/shared-call-pace';

/**
 * Une lecture complète d'Ouvre ta ferme pour une ferme (4.3, PR 1 ;
 * docs/tranche-4-contract.md, F361, F362, F383, F384, F388) : une à la fois
 * par ferme, pour toutes les instances du serveur, et qui ne part que si elle
 * peut finir. Le service prend le bail de lecture et réserve les places, puis
 * donne au connecteur le compteur partagé de cette lecture ; il rend le bail
 * et garde la base de la réserve suivante quand la lecture est finie.
 */

/**
 * La clé du compteur pour la clé du déploiement avant que sa ferme soit
 * connue : le seul appel concerné est le premier `GET /me` (F339). Elle ne
 * peut pas être une ferme (F327, F381).
 */
export const DEPLOYMENT_KEY_UNKNOWN_FARM_PACE = 'clé-du-déploiement·ferme-inconnue';

type ReadClock = { now: () => number; sleep: (durationMs: number) => Promise<void> };

const realClock: ReadClock = {
  now: () => Date.now(),
  sleep: (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
};

/** Le relevé du bail pendant qu'une seconde lecture attend la première (F388). */
const LEASE_POLL_MS = 250;
/** Les courses perdues contre une autre instance qu'un départ de lecture accepte avant de renoncer. */
const READ_START_MAX_ATTEMPTS = 5;

/** Le compteur partagé d'un appel isolé, hors de toute lecture complète : une place neuve à chaque appel. */
export function sharedPaceForLoneCalls(paceKey: string): OtfSharedCallPace {
  return {
    claimPlace: (atMs, spacingMs) => claimOtfCallPlace({ paceKey, atMs, spacingMs, readId: null, fromReservation: false }),
    placeRefusal: async (atMs, rules) => sharedPlaceRefusal((await readOtfFarmPace(paceKey, atMs)).state, atMs, rules),
    holdCalls: (pause) => holdOtfCalls(paceKey, pause),
    recordAuthenticationFailure: (atMs) => recordOtfAuthenticationFailure(atMs),
  };
}

/** Une lecture complète en cours : son compteur, et sa fin. */
export type FarmRead = {
  sharedPace: OtfSharedCallPace;
  minuteWaitLimitMs: number | undefined;
  /** La lecture a tout lu : sa fin gardera ses appels comme base de la réserve suivante. */
  markComplete: () => void;
  /** Rend le bail et les places inutilisées ; idempotent. Après l'écriture du cache, pour qu'une seconde lecture trouve ce qui a été rangé. */
  finish: (error?: unknown) => Promise<void>;
};

/**
 * Le départ d'une lecture complète de la ferme `paceKey` (F362) : le bail et
 * la réserve, sinon une erreur qui dit pourquoi elle n'a pas lieu et quand
 * elle sera possible. Pendant la lecture d'une autre instance, elle attend au
 * plus cinq secondes sa fin, puis remonte « lecture en cours » : la politique
 * de l'instantané relit alors le cache, où la première a rangé ce qu'elle a
 * lu. Le calcul du matin attend qu'une minute ait la place, au lieu de
 * renoncer.
 */
export async function startFarmRead(paceKey: string, context: OtfReadContext, clock: ReadClock = realClock): Promise<FarmRead> {
  const morningDeadline = clock.now() + OTF_MORNING_MINUTE_WAIT_MS;
  for (let attempt = 1; attempt <= READ_START_MAX_ATTEMPTS; attempt += 1) {
    const atMs = clock.now();
    const pace = await readOtfFarmPace(paceKey, atMs);
    const decision = farmReadStart({ state: pace.state, leaseHeld: pace.leaseHeld, reserve: farmReadReserve(pace.reserveBasis), atMs, context });
    if (decision.kind === 'busy') {
      await waitForLeaseRelease(paceKey, clock);
      throw new OtfReadDeferredError('read-in-progress', null);
    }
    if (decision.kind === 'deferred') {
      if (context === 'morning' && decision.reason === 'minute' && decision.retryAtMs !== null && decision.retryAtMs <= morningDeadline) {
        await clock.sleep(Math.max(0, decision.retryAtMs - clock.now()));
        continue;
      }
      throw new OtfReadDeferredError(decision.reason, decision.retryAtMs);
    }
    const readId = crypto.randomUUID();
    if (await beginOtfFarmRead({ paceKey, readId, atMs, places: decision.places })) {
      return farmRead({ paceKey, readId, reservedAtMs: atMs, places: decision.places, previousBasis: pace.reserveBasis, context, clock });
    }
  }
  // Une autre instance a pris la place à chaque essai : rien n'est envoyé, comme sur une minute pleine.
  throw new OtfReadDeferredError('minute', null);
}

/** Attend que le bail de la ferme soit rendu, cinq secondes au plus (F362). */
async function waitForLeaseRelease(paceKey: string, clock: ReadClock): Promise<void> {
  const deadline = clock.now() + OTF_SECOND_READ_WAIT_MS;
  while (clock.now() < deadline) {
    await clock.sleep(Math.min(LEASE_POLL_MS, deadline - clock.now()));
    if (!(await readOtfFarmPace(paceKey, clock.now())).leaseHeld) return;
  }
}

function farmRead({ paceKey, readId, reservedAtMs, places, previousBasis, context, clock }: {
  paceKey: string;
  readId: string;
  /** L'heure des places réservées : celle du départ de la lecture. */
  reservedAtMs: number;
  places: number;
  previousBasis: number | null;
  context: OtfReadContext;
  clock: ReadClock;
}): FarmRead {
  let reservedLeft = places;
  let calls = 0;
  let complete = false;
  let finished = false;
  return {
    sharedPace: {
      claimPlace: async (atMs, spacingMs) => {
        const fromReservation = reservedLeft > 0;
        const granted = await claimOtfCallPlace({ paceKey, atMs, spacingMs, readId, fromReservation });
        if (granted) {
          calls += 1;
          if (fromReservation) reservedLeft -= 1;
        }
        return granted;
      },
      placeRefusal: async (atMs, rules) => sharedPlaceRefusal((await readOtfFarmPace(paceKey, atMs)).state, atMs, {
        ...rules,
        reservedPlaceAtMs: reservedLeft > 0 ? reservedAtMs : null,
      }),
      holdCalls: (pause) => holdOtfCalls(paceKey, pause),
      recordAuthenticationFailure: (atMs) => recordOtfAuthenticationFailure(atMs),
    },
    minuteWaitLimitMs: context === 'morning' ? OTF_MORNING_MINUTE_WAIT_MS : undefined,
    markComplete: () => { complete = true; },
    finish: async (error) => {
      if (finished) return;
      finished = true;
      const outcome: FarmReadOutcome = complete
        ? { kind: 'complete', calls }
        : reservedLeft === 0 && error instanceof OtfReadDeferredError && error.reason === 'minute'
          ? { kind: 'out-of-places', calls }
          : { kind: 'failed' };
      try {
        await endOtfFarmRead({ paceKey, readId, reserveBasis: nextReserveBasis(previousBasis, outcome), atMs: clock.now() });
      } catch (endError) {
        // Le bail expire seul dans deux minutes ; la lecture, elle, a eu lieu ou non.
        logJsonLine('warn', { event: 'otf_farm_read_not_released', message: endError instanceof Error ? endError.message : 'erreur inconnue' });
      }
      logJsonLine('info', { event: 'otf_farm_read_finished', outcome: outcome.kind, calls, reserved: places });
    },
  };
}
