import { millisecondsFromDays, millisecondsFromMinutes, millisecondsFromSeconds } from '../units.ts';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, localDateStartUtc } from '../water-management.ts';
import { OtfApiError } from './api-contract.ts';
import { OTF_CALL_WINDOW_MS, OTF_CALLS_PER_MINUTE, OTF_MINUTE_LIMIT_MAX_WAIT_MS } from './call-pace.ts';

/**
 * Le compteur partagé des appels à Ouvre ta ferme (Tranche 4, 4.3, PR 1 ;
 * docs/tranche-4-contract.md, sections 6.3 et 6.3 bis, F359, F361 à F363, F381 à F390).
 * La base compte, pour toutes les instances du serveur et ferme par ferme,
 * chaque départ vers OTF ; elle applique ces règles par des écritures
 * conditionnelles (`db/otf-call-ledger-repository.ts`). Les fonctions pures
 * ci-dessous disent, à partir de ce qu'elle a compté, pourquoi un appel ou
 * une lecture ne part pas et quand une nouvelle lecture est possible.
 */

/** La pause qui suit un `429` d'OTF : la durée de `Retry-After`, une seconde au moins (F361). */
const OTF_MIN_RATE_LIMIT_PAUSE_MS = millisecondsFromSeconds(1);
/** Une ligne par appel, gardée deux jours (F361). */
export const OTF_CALL_ROWS_KEPT_MS = millisecondsFromDays(2);
/** Le compte du jour, gardé trente jours (F363). */
const OTF_DAILY_COUNTS_KEPT_DAYS = 30;
/** Le bail d'une lecture complète : deux minutes au plus, pour qu'une instance arrêtée ne bloque pas la ferme (F362). */
export const OTF_READ_LEASE_MS = millisecondsFromMinutes(2);
/** Sans lecture précédente, la réserve d'une lecture (F362 ; 22 appels sur la ferme du porteur). */
const OTF_READ_RESERVE_WITHOUT_HISTORY = 25;
/** Ce que la réserve ajoute aux appels de la dernière lecture complète (F362). */
const OTF_READ_RESERVE_MARGIN = 2;
/** Une seconde lecture de la même ferme attend au plus cinq secondes la fin de la première (F362). */
export const OTF_SECOND_READ_WAIT_MS = millisecondsFromSeconds(5);
/**
 * Le calcul du matin peut attendre qu'une minute se libère : une fenêtre
 * entière et une seconde (F362, F383). Une page, elle, n'attend que cinq
 * secondes (F334).
 */
export const OTF_MORNING_MINUTE_WAIT_MS = OTF_CALL_WINDOW_MS + millisecondsFromSeconds(1);
/** Le frein des échecs d'authentification : 10 en 15 minutes, puis 15 minutes sans appel (F359). */
export const OTF_AUTHENTICATION_BRAKE_FAILURES = 10;
export const OTF_AUTHENTICATION_BRAKE_WINDOW_MS = millisecondsFromMinutes(15);
export const OTF_AUTHENTICATION_BRAKE_PAUSE_MS = millisecondsFromMinutes(15);
/**
 * La portée d'une pause qui vaut pour tout le module : le frein, et le blocage
 * d'adresse annoncé par OTF (F359, F382). Elle ne peut pas être une ferme :
 * `*` n'a pas la forme d'un identifiant de ferme (F327).
 */
export const OTF_MODULE_PAUSE_SCOPE = '*';

/** Pourquoi plus rien ne part, pour une ferme ou pour tout le module. */
export type OtfPauseReason = 'rate-limit' | 'day-limit' | 'authentication-limit' | 'authentication-brake';

export type OtfCallPause = { scope: 'farm' | 'module'; untilMs: number; reason: OtfPauseReason };

/** Ce que la base a compté pour une ferme, à un instant. */
export type SharedPaceState = {
  /** Le dernier départ réel de la ferme dans la minute glissante, ou `null`. */
  lastStartedAtMs: number | null;
  /** Les places de la minute glissante, départs et places réservées, de la plus ancienne à la plus récente. */
  windowPlacesMs: readonly number[];
  /** Les pauses en cours, de la ferme et du module. */
  pauses: readonly OtfCallPause[];
};

/**
 * Pourquoi une lecture n'a pas lieu ou s'arrête sans rien ranger : la minute
 * glissante n'a pas la place (F362) ; une pause d'OTF ou du frein ; une
 * lecture de plus de 30 appels, qui ne se fait qu'au calcul du matin ; une
 * autre lecture de la même ferme en cours.
 */
export type OtfReadDeferralReason = 'minute' | OtfPauseReason | 'too-many-calls' | 'read-in-progress';

const DEFERRAL_DIAGNOSTICS: Record<OtfReadDeferralReason, string> = {
  minute: `Limite de ${OTF_CALLS_PER_MINUTE} appels par minute atteinte pour cette ferme : la minute glissante n’a pas la place, rien n’est envoyé.`,
  'rate-limit': 'Ouvre ta ferme a demandé une pause pour cette ferme : rien n’est envoyé.',
  'day-limit': 'Ouvre ta ferme a atteint la limite du jour pour cette ferme : rien n’est envoyé.',
  'authentication-limit': 'Ouvre ta ferme bloque les appels de ce serveur après des refus d’accès : rien n’est envoyé.',
  'authentication-brake': 'Trop de refus d’accès en quinze minutes : plus aucun appel ne part vers Ouvre ta ferme pendant quinze minutes.',
  'too-many-calls': 'La lecture complète de cette ferme demande plus de 30 appels : elle se fait au calcul du matin.',
  'read-in-progress': 'Une autre lecture de cette ferme est en cours : rien n’est envoyé.',
};

/**
 * Une lecture qui n'a pas lieu, ou un appel qui ne part pas, avec la raison et
 * l'instant où une nouvelle lecture est possible quand il est connu. Une
 * limite porte le statut `429`, comme une limite atteinte chez OTF.
 */
export class OtfReadDeferredError extends OtfApiError {
  readonly reason: OtfReadDeferralReason;
  readonly retryAtMs: number | null;

  constructor(reason: OtfReadDeferralReason, retryAtMs: number | null) {
    super(DEFERRAL_DIAGNOSTICS[reason], reason === 'read-in-progress' || reason === 'too-many-calls' ? undefined : 429);
    this.name = 'OtfReadDeferredError';
    this.reason = reason;
    this.retryAtMs = retryAtMs;
  }
}

/** Le jour de Paris d'un instant (D-004) : celui du compte des appels. */
export function parisDayOf(atMs: number): string {
  return dateKeyInTimeZone(new Date(atMs), FARM_TIME_ZONE);
}

/** Le plus ancien jour de compte gardé : trente jours avant celui de l'instant (F363). */
export function oldestKeptCountDay(atMs: number): string {
  return addDaysToDateKey(parisDayOf(atMs), -OTF_DAILY_COUNTS_KEPT_DAYS);
}

/** Le prochain minuit de Paris : la fin d'une pause du jour sans `Retry-After` (F363). */
function nextParisMidnightMs(atMs: number): number {
  return localDateStartUtc(addDaysToDateKey(parisDayOf(atMs), 1), FARM_TIME_ZONE).getTime();
}

/** La réserve d'une lecture : les appels de la dernière lecture complète réussie, plus deux, ou 25 sans elle (F362). */
export function farmReadReserve(basis: number | null): number {
  return basis === null ? OTF_READ_RESERVE_WITHOUT_HISTORY : basis + OTF_READ_RESERVE_MARGIN;
}

/** Comment une lecture s'est terminée, pour la réserve de la suivante. */
export type FarmReadOutcome =
  | { kind: 'complete'; calls: number }
  /** Sa réserve épuisée, un appel de plus a été refusé : elle s'est arrêtée sans rien ranger. */
  | { kind: 'out-of-places'; calls: number }
  | { kind: 'failed' };

/**
 * La base de la réserve suivante (F362) : les appels de cette lecture si elle
 * est complète ; si elle s'est arrêtée faute de place, au moins ses appels et
 * celui qui a été refusé, pour que la réserve suivante en tienne compte ;
 * sinon, celle d'avant.
 */
export function nextReserveBasis(previous: number | null, outcome: FarmReadOutcome): number | null {
  if (outcome.kind === 'complete') return outcome.calls;
  if (outcome.kind === 'out-of-places') return Math.max(previous ?? 0, outcome.calls + 1);
  return previous;
}

/**
 * La pause qui court à `atMs` et finit la dernière, celle du module à
 * égalité ; sinon `null`. Rien ne part avant sa fin : c'est l'heure de la
 * prochaine lecture possible.
 */
function activePause(pauses: readonly OtfCallPause[], atMs: number): OtfCallPause | null {
  let last: OtfCallPause | null = null;
  for (const pause of pauses) {
    if (pause.untilMs <= atMs) continue;
    if (last === null || pause.untilMs > last.untilMs || (pause.untilMs === last.untilMs && pause.scope === 'module')) last = pause;
  }
  return last;
}

/**
 * Quand la minute glissante aura la place de `places` appels de plus :
 * `null` si elle l'a déjà. Une place compte tant qu'elle a moins d'une
 * fenêtre ; la k-ième plus ancienne sort à son heure plus la fenêtre.
 */
function minuteRoomAt(windowPlacesMs: readonly number[], atMs: number, places: number): number | null {
  const inWindow = windowPlacesMs.filter((placeMs) => placeMs > atMs - OTF_CALL_WINDOW_MS);
  const excess = inWindow.length + places - OTF_CALLS_PER_MINUTE;
  if (excess <= 0) return null;
  return inWindow[excess - 1] + OTF_CALL_WINDOW_MS;
}

/** Ce que fait un appel dont la place a été refusée par la base. */
export type PlaceRefusal =
  | { kind: 'retry-at'; atMs: number }
  | { kind: 'stop'; reason: OtfReadDeferralReason; retryAtMs: number };

/** Les règles d'une demande de place : l'espacement, l'attente acceptée, et la place réservée qu'elle prend. */
export type PlaceRules = {
  /** L'espacement du connecteur, marge comprise (255 ms : F361). */
  spacingMs: number;
  /** L'attente la plus longue d'une place quand la minute est pleine : cinq secondes à l'écran (F334). */
  maxWaitMs?: number;
  /**
   * L'heure de la place réservée par la lecture que l'appel prend, ou `null`
   * pour une place neuve. Une place réservée encore dans la minute glissante y
   * compte déjà : la prendre n'en demande pas une de plus (F362, F384).
   */
  reservedPlaceAtMs?: number | null;
};

/**
 * Pourquoi la base a refusé la place d'un appel, et quand en redemander une
 * (F361) : une pause arrête l'appel ; une minute pleine le fait attendre
 * `maxWaitMs` au plus (cinq secondes, F334), sinon l'arrête ; l'espacement
 * le fait attendre. Sans raison visible (une autre instance a pris la place
 * entre-temps), il redemande aussitôt.
 */
export function sharedPlaceRefusal(
  state: SharedPaceState,
  atMs: number,
  { spacingMs, maxWaitMs = OTF_MINUTE_LIMIT_MAX_WAIT_MS, reservedPlaceAtMs = null }: PlaceRules,
): PlaceRefusal {
  const pause = activePause(state.pauses, atMs);
  if (pause) return { kind: 'stop', reason: pause.reason, retryAtMs: pause.untilMs };
  const reservedInWindow = reservedPlaceAtMs !== null && reservedPlaceAtMs > atMs - OTF_CALL_WINDOW_MS;
  const roomAt = minuteRoomAt(state.windowPlacesMs, atMs, reservedInWindow ? 0 : 1);
  if (roomAt !== null && roomAt - atMs > maxWaitMs) return { kind: 'stop', reason: 'minute', retryAtMs: roomAt };
  const spacedAt = state.lastStartedAtMs === null ? atMs : state.lastStartedAtMs + spacingMs;
  return { kind: 'retry-at', atMs: Math.max(atMs, spacedAt, roomAt ?? atMs) };
}

/** Une lecture d'une page, ou du calcul du matin, qui peut attendre (F362). */
export type OtfReadContext = 'page' | 'morning';

export type FarmReadStart =
  | { kind: 'start'; places: number }
  | { kind: 'busy' }
  | { kind: 'deferred'; reason: OtfReadDeferralReason; retryAtMs: number | null };

/**
 * Une lecture complète peut-elle partir (F362) ? Pas pendant une pause ; pas
 * pendant une autre lecture de la même ferme (elle attend sa fin) ; pas si
 * sa réserve ne tient pas dans la minute glissante, et l'heure où elle
 * tiendra est rendue. Une réserve de plus de 30 appels ne tient dans aucune
 * minute : à l'écran, la lecture n'a pas lieu ; au calcul du matin, elle part
 * avec 30 places et prend les autres une à une.
 */
export function farmReadStart({ state, leaseHeld, reserve, atMs, context }: {
  state: SharedPaceState;
  leaseHeld: boolean;
  reserve: number;
  atMs: number;
  context: OtfReadContext;
}): FarmReadStart {
  const pause = activePause(state.pauses, atMs);
  if (pause) return { kind: 'deferred', reason: pause.reason, retryAtMs: pause.untilMs };
  if (leaseHeld) return { kind: 'busy' };
  if (reserve > OTF_CALLS_PER_MINUTE && context === 'page') return { kind: 'deferred', reason: 'too-many-calls', retryAtMs: null };
  const places = Math.min(reserve, OTF_CALLS_PER_MINUTE);
  const roomAt = minuteRoomAt(state.windowPlacesMs, atMs, places);
  if (roomAt !== null) return { kind: 'deferred', reason: 'minute', retryAtMs: roomAt };
  return { kind: 'start', places };
}

/** Les quatre codes d'un `429` d'OTF (F349). */
type OtfRateLimitCode = 'rate_limit_second' | 'rate_limit_minute' | 'rate_limit_day' | 'rate_limit_authentication';

const RATE_LIMIT_CODES: readonly OtfRateLimitCode[] = ['rate_limit_second', 'rate_limit_minute', 'rate_limit_day', 'rate_limit_authentication'];

/**
 * Le code d'un `429` dans le corps de la réponse, s'il est l'un des quatre
 * qu'OTF documente, lu dans `error` ou `code` (ou `error.code`) ; sinon
 * `null`. La forme exacte du corps se constate à l'essai de bout en bout
 * (F382) : rien d'autre n'est deviné.
 */
export function otfRateLimitCode(body: unknown): OtfRateLimitCode | null {
  if (!isRecord(body)) return null;
  const nested = isRecord(body.error) ? body.error.code : undefined;
  for (const candidate of [body.error, body.code, nested]) {
    const code = RATE_LIMIT_CODES.find((known) => known === candidate);
    if (code) return code;
  }
  return null;
}

/**
 * L'en-tête `Retry-After` en millisecondes : un nombre de secondes, ou une
 * date HTTP, qui nomme toujours son jour ou son mois ; `null` s'il est absent
 * ou illisible.
 */
export function retryAfterMilliseconds(header: string | null, atMs: number): number | null {
  if (header === null) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return millisecondsFromSeconds(Number(trimmed));
  if (!/[A-Za-z]/.test(trimmed)) return null;
  const date = Date.parse(trimmed);
  return Number.isFinite(date) ? Math.max(0, date - atMs) : null;
}

/**
 * La pause qui suit un `429` d'OTF (F361, F363, F382) : la limite du jour
 * arrête la ferme jusqu'à l'heure de `Retry-After`, sinon jusqu'à minuit
 * (heure de Paris) ; le blocage pour échecs d'authentification arrête tout le
 * module, quinze minutes sans `Retry-After` ; les autres arrêtent la ferme la
 * durée de `Retry-After`. Toujours une seconde au moins.
 */
export function pauseAfterRateLimit({ code, retryAfterMs, atMs }: { code: OtfRateLimitCode | null; retryAfterMs: number | null; atMs: number }): OtfCallPause {
  const atLeastOneSecond = (durationMs: number) => atMs + Math.max(durationMs, OTF_MIN_RATE_LIMIT_PAUSE_MS);
  if (code === 'rate_limit_day') {
    return { scope: 'farm', reason: 'day-limit', untilMs: retryAfterMs === null ? Math.max(nextParisMidnightMs(atMs), atLeastOneSecond(0)) : atLeastOneSecond(retryAfterMs) };
  }
  if (code === 'rate_limit_authentication') {
    return { scope: 'module', reason: 'authentication-limit', untilMs: atLeastOneSecond(retryAfterMs ?? OTF_AUTHENTICATION_BRAKE_WINDOW_MS) };
  }
  return { scope: 'farm', reason: 'rate-limit', untilMs: atLeastOneSecond(retryAfterMs ?? 0) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
