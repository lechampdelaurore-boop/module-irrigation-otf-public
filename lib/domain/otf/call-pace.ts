import { millisecondsFromSeconds } from '../units.ts';

/**
 * Le rythme des appels à Ouvre ta ferme, ferme par ferme (Tranche 4, 4.2,
 * docs/tranche-4-contract.md, F334) : un départ toutes les 250 ms au plus
 * (quatre par seconde), trente départs par minute au plus, et quand la
 * minute est pleine, une attente de cinq secondes au plus ; au-delà, l'appel
 * n'est pas envoyé. Fonctions pures : l'horloge, l'attente et la file
 * restent au connecteur (lib/adapters/otf/read-client.ts).
 */

export const OTF_CALLS_PER_MINUTE = 30;
const OTF_MINUTE_MS = millisecondsFromSeconds(60);
/** L'attente la plus longue qu'un appel accepte quand la minute est pleine. */
export const OTF_MINUTE_LIMIT_MAX_WAIT_MS = millisecondsFromSeconds(5);
// OTF compte les appels à leur arrivée, le module à leur départ : une
// seconde de marge couvre l'écart. Trente appels tiennent donc dans 61
// secondes au moins, jamais dans une minute.
const OTF_MINUTE_SAFETY_MARGIN_MS = millisecondsFromSeconds(1);

/** Ce que le régulateur d'une ferme sait de ses derniers appels, en millisecondes. */
export type CallPaceState = {
  /** Le départ du dernier appel. */
  lastStartedAt: number;
  /** Rien ne part avant cet instant, après une limite atteinte chez OTF. */
  notBefore: number;
  /** Les départs de la dernière minute, du plus ancien au plus récent. */
  recentStarts: readonly number[];
};

export type CallSlot =
  | { kind: 'start-at'; at: number }
  | { kind: 'refused'; minuteFreesAt: number };

export const EMPTY_CALL_PACE: CallPaceState = { lastStartedAt: 0, notBefore: 0, recentStarts: [] };

/**
 * Le prochain départ possible pour un appel qui se présente à `now` : après
 * l'espacement (`spacingMs`, marge comprise) et la pause qui suit une limite
 * atteinte ; si les trente places de la minute sont prises, quand la plus
 * ancienne se libère, à condition que ce soit dans cinq secondes au plus.
 * Sinon l'appel est refusé, et rien n'est compté.
 */
export function nextCallSlot(state: CallPaceState, now: number, spacingMs: number): CallSlot {
  const spacedAt = Math.max(state.lastStartedAt + spacingMs, state.notBefore, now);
  const inWindow = startsWithinMinute(state.recentStarts, now);
  if (inWindow.length < OTF_CALLS_PER_MINUTE) return { kind: 'start-at', at: spacedAt };

  // La place se libère quand le trentième départ avant celui-ci a une minute,
  // marge comprise.
  const minuteFreesAt = inWindow[inWindow.length - OTF_CALLS_PER_MINUTE] + OTF_MINUTE_MS + OTF_MINUTE_SAFETY_MARGIN_MS;
  if (minuteFreesAt - now > OTF_MINUTE_LIMIT_MAX_WAIT_MS) return { kind: 'refused', minuteFreesAt };
  return { kind: 'start-at', at: Math.max(spacedAt, minuteFreesAt) };
}

/** L'état après un départ à `startedAt` : il compte dans la minute qui suit. */
export function recordCallStart(state: CallPaceState, startedAt: number): CallPaceState {
  return {
    ...state,
    lastStartedAt: startedAt,
    recentStarts: [...startsWithinMinute(state.recentStarts, startedAt), startedAt],
  };
}

/** L'état après une limite atteinte chez OTF : plus rien ne part avant `until`. */
export function holdCallsUntil(state: CallPaceState, until: number): CallPaceState {
  return { ...state, notBefore: Math.max(state.notBefore, until) };
}

// Les départs qui comptent encore à `now` : ceux de la dernière minute,
// marge comprise.
function startsWithinMinute(starts: readonly number[], now: number): readonly number[] {
  const horizon = now - OTF_MINUTE_MS - OTF_MINUTE_SAFETY_MARGIN_MS;
  return starts.filter((startedAt) => startedAt > horizon);
}
