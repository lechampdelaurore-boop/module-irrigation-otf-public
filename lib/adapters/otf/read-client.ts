import { OtfApiError, extractCollection } from '../../domain/otf/api-contract.ts';
import {
  EMPTY_CALL_PACE,
  holdCallsUntil,
  isCallPaceIdle,
  nextCallSlot,
  OTF_MINUTE_LIMIT_MAX_WAIT_MS,
  recordCallStart,
  type CallPaceState,
} from '../../domain/otf/call-pace.ts';
import {
  OtfReadDeferredError,
  otfRateLimitCode,
  pauseAfterRateLimit,
  retryAfterMilliseconds,
  type OtfCallPause,
  type PlaceRefusal,
  type PlaceRules,
} from '../../domain/otf/shared-call-pace.ts';
import { millisecondsFromSeconds } from '../../domain/units.ts';
import { logJsonLine } from '../log.ts';

const OTF_READ_ROUTES = [
  '/me',
  '/configuration',
  '/zoneList',
  '/plotList',
  '/bedList',
  // Extension « suivi par série » (docs/series-contract.md) : cinq routes GET
  // de plus, même portée `production:read`, mêmes règles de rythme et de pages.
  '/actionList',
  '/plantList',
  '/seriesList',
  '/placeList',
  '/taskList',
] as const;

/** Les seuls paramètres de requête que le connecteur sait envoyer, écrits ici. */
type OtfListQuery = {
  season?: number;
  withCultivations?: true;
};

const OTF_API_ORIGIN = 'https://api.ouvretaferme.org';
const OTF_API_BASE_PATH = '/0.1beta/';
// OTF accepte au plus quatre appels par seconde : au moins 250 ms entre deux
// départs de requêtes, même pour des lectures lancées simultanément.
export const OTF_MINIMUM_REQUEST_INTERVAL_MS = 250;
// Marge ajoutée à l'attente : l'horodatage du départ est pris avant l'appel
// réseau lui-même, et un minuteur peut se réveiller un peu tôt. Sans elle, un
// observateur externe peut mesurer 249 ms entre deux appels.
const RATE_SLOT_SAFETY_MARGIN_MS = 5;
// Après un 429, plus rien ne part vers OTF pendant une seconde pleine :
// la limite OTF se compte à la seconde, attendre moins la heurterait encore.
const OTF_RATE_LIMIT_COOLDOWN_MS = 1_000;

/**
 * Le quota d'OTF est celui de la ferme, toutes applications confondues
 * (docs/tranche-4-contract.md, T4-07, F334), pas celui de l'objet qui
 * appelle. Le rythme est donc tenu par un régulateur par ferme, partagé par
 * tous les clients de cette ferme : deux lectures lancées en même temps par
 * des composants différents ne peuvent pas cumuler leurs quotas (constaté le
 * 20 septembre 2026 par un 429 sur `/bedList`, docs/otf-contract.md), et une
 * ferme n'attend jamais le quota d'une autre. Ce régulateur vit dans
 * l'instance du Worker qui appelle et reste devant ; depuis la 4.3 (F361), le
 * compteur partagé de la base (`sharedPace`) fait foi pour toutes les
 * instances.
 */
type FarmPacer = { state: CallPaceState; queue: Promise<void>; pending: number };

const farmPacers = new Map<string, FarmPacer>();

/**
 * Le compteur partagé d'une ferme, tel que le connecteur le voit (F361) : la
 * base, la même pour toutes les instances du serveur, derrière un port que
 * le service branche (`lib/services/otf-farm-read.ts`) ; le connecteur
 * n'importe pas `db/`.
 */
export type OtfSharedCallPace = {
  /** Prend la place d'un appel qui part à `atMs`, par une seule écriture conditionnelle ; `false` si la base la refuse. */
  claimPlace: (atMs: number, spacingMs: number) => Promise<boolean>;
  /**
   * Pourquoi la base a refusé la place, d'après ce qu'elle a compté pour la
   * ferme, et quand en redemander une (`sharedPlaceRefusal`) ; le service sait
   * si l'appel prend une place réservée par sa lecture.
   */
  placeRefusal: (atMs: number, rules: PlaceRules) => Promise<PlaceRefusal>;
  /** Une limite d'OTF : la pause vaut pour toutes les instances. */
  holdCalls: (pause: OtfCallPause) => Promise<void>;
  /** Un `401`, compté pour tout le module (F359) ; rend la pause du frein quand elle court. */
  recordAuthenticationFailure: (atMs: number) => Promise<OtfCallPause | null>;
};

/**
 * Les refus de la base qu'un appel accepte avant de renoncer : chacun suit
 * une attente (l'espacement, une place de la minute) ou une course perdue
 * contre une autre instance. Au-delà, l'appel n'est pas envoyé (F385).
 */
const SHARED_PLACE_MAX_ATTEMPTS = 20;

/**
 * Avant la 4.3, la seule clé est celle du déploiement, rattachée à une seule
 * ferme (F330) : tous ses appels, y compris le premier `GET /me` qui fait
 * connaître sa ferme, passent par un même régulateur.
 */
export const DEPLOYMENT_KEY_FARM = 'ferme-de-la-cle-du-deploiement';

/**
 * Le régulateur d'une ferme ; ceux des autres fermes qui ne retiennent plus
 * rien (aucun appel en attente, aucun départ dans la minute, aucune pause)
 * sont oubliés au passage : la mémoire ne grandit pas avec le nombre de
 * fermes (point D5 de la revue de l'isolation, F361).
 */
function farmPacer(farmKey: string, nowMs: number): FarmPacer {
  for (const [key, pacer] of farmPacers) {
    if (key !== farmKey && pacer.pending === 0 && isCallPaceIdle(pacer.state, nowMs)) farmPacers.delete(key);
  }
  const known = farmPacers.get(farmKey);
  if (known) return known;
  const created: FarmPacer = { state: EMPTY_CALL_PACE, queue: Promise.resolve(), pending: 0 };
  farmPacers.set(farmKey, created);
  return created;
}

/** Remet les régulateurs à zéro entre deux tests, qui se suivent sans attendre. */
export function resetOtfRatePacer(): void {
  farmPacers.clear();
}

/** Le nombre de régulateurs gardés en mémoire : les tests du point D5 le lisent. */
export function otfRatePacerCount(): number {
  return farmPacers.size;
}

/** L'horloge du régulateur ; les tests la remplacent pour parcourir une minute sans l'attendre. */
type OtfClock = {
  now: () => number;
  sleep: (durationMs: number) => Promise<void>;
};

const realClock: OtfClock = { now: () => Date.now(), sleep: delay };

export type OtfReadRoute = (typeof OTF_READ_ROUTES)[number];

type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

type OtfReadClientOptions = {
  baseUrl: string;
  token: string;
  fetchImpl?: FetchLike;
  pageSize?: number;
  maxPages?: number;
  timeoutMs?: number;
  minimumRequestIntervalMs?: number;
  /** La ferme dont ce client dépense le quota ; par défaut, celle de la clé du déploiement. */
  farmKey?: string;
  clock?: OtfClock;
  /**
   * Le compteur partagé de la base (F361). Sans lui, seul le régulateur en
   * mémoire tient le rythme : les tests du connecteur et le script d'essai
   * manuel ; le serveur le branche toujours (`lib/services/otf-connection.ts`).
   */
  sharedPace?: OtfSharedCallPace;
  /**
   * L'attente la plus longue d'une place quand la minute est pleine : cinq
   * secondes à l'écran (F334), une minute au calcul du matin, qui peut
   * attendre (F362).
   */
  minuteWaitLimitMs?: number;
};

export function assertAllowedReadRoute(value: string): asserts value is OtfReadRoute {
  if (!OTF_READ_ROUTES.includes(value as OtfReadRoute)) {
    throw new OtfApiError('Route OTF non autorisée.');
  }
}

export class OtfReadClient {
  private readonly options: OtfReadClientOptions;
  private readonly baseUrl: URL;
  private readonly fetchImpl: FetchLike;
  private readonly pageSize: number;
  private readonly maxPages: number;
  private readonly timeoutMs: number;
  private readonly minimumRequestIntervalMs: number;
  private readonly farmKey: string;
  private readonly clock: OtfClock;
  private readonly sharedPace: OtfSharedCallPace | null;
  private readonly minuteWaitLimitMs: number;

  constructor(options: OtfReadClientOptions) {
    if (!options.token.trim()) {
      throw new OtfApiError('Le jeton OTF serveur est absent.');
    }

    const baseUrl = new URL(options.baseUrl);
    if (baseUrl.protocol !== 'https:') {
      throw new OtfApiError("L'URL de l'API OTF doit utiliser HTTPS.");
    }

    if (
      baseUrl.origin !== OTF_API_ORIGIN ||
      normalizeBasePath(baseUrl.pathname) !== OTF_API_BASE_PATH
    ) {
      throw new OtfApiError("L'adresse de l'API OTF n'est pas autorisée.");
    }

    this.options = options;
    this.baseUrl = new URL(
      baseUrl.pathname.endsWith('/') ? baseUrl.href : `${baseUrl.href}/`,
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.pageSize = Math.min(Math.max(options.pageSize ?? 500, 1), 500);
    this.maxPages = Math.min(Math.max(options.maxPages ?? 50, 1), 100);
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 8_000, 500), 30_000);
    this.minimumRequestIntervalMs = Math.min(
      Math.max(
        options.minimumRequestIntervalMs ?? OTF_MINIMUM_REQUEST_INTERVAL_MS,
        OTF_MINIMUM_REQUEST_INTERVAL_MS,
      ),
      millisecondsFromSeconds(1),
    );
    this.farmKey = options.farmKey ?? DEPLOYMENT_KEY_FARM;
    this.clock = options.clock ?? realClock;
    this.sharedPace = options.sharedPace ?? null;
    this.minuteWaitLimitMs = Math.max(options.minuteWaitLimitMs ?? OTF_MINUTE_LIMIT_MAX_WAIT_MS, OTF_MINUTE_LIMIT_MAX_WAIT_MS);
  }

  async getConfiguration(): Promise<unknown> {
    return this.requestJson('/configuration');
  }

  async getCurrentStructures(): Promise<unknown> {
    return this.requestJson('/me');
  }

  async listZones(season: number): Promise<unknown[]> {
    return this.readAllPages('/zoneList', { season });
  }

  async listPlots(season: number): Promise<unknown[]> {
    return this.readAllPages('/plotList', { season });
  }

  async listBeds(season: number): Promise<unknown[]> {
    return this.readAllPages('/bedList', { season });
  }

  async listActions(): Promise<unknown[]> {
    return this.readAllPages('/actionList', {});
  }

  async listPlants(): Promise<unknown[]> {
    return this.readAllPages('/plantList', {});
  }

  async listSeries(season: number): Promise<unknown[]> {
    return this.readAllPages('/seriesList', { season, withCultivations: true });
  }

  async listPlaces(season: number): Promise<unknown[]> {
    return this.readAllPages('/placeList', { season });
  }

  /**
   * Les tâches se lisent en entier, toutes saisons : OTF ignore leur filtre
   * `season`, qui n'est donc pas envoyé (docs/series-contract.md, D-022).
   */
  async listTasks(): Promise<unknown[]> {
    return this.readAllPages('/taskList', {});
  }

  private async readAllPages(
    route: OtfReadRoute,
    query: OtfListQuery,
  ): Promise<unknown[]> {
    const allItems: unknown[] = [];

    for (let page = 1; page <= this.maxPages; page += 1) {
      const payload = await this.requestJson(route, page, query);
      const pageItems = extractCollection(payload);
      allItems.push(...pageItems);

      const total = extractTotal(payload);
      if (total !== null && allItems.length >= total) {
        return allItems.slice(0, total);
      }

      if (!hasNextPage(payload) && pageItems.length < this.pageSize) {
        return allItems;
      }
    }

    throw new OtfApiError(
      `La pagination OTF a dépassé la limite de ${this.maxPages} pages.`,
    );
  }

  private async requestJson(
    route: OtfReadRoute,
    page?: number,
    query: OtfListQuery = {},
  ): Promise<unknown> {
    assertAllowedReadRoute(route);
    const url = new URL(route.slice(1), this.baseUrl);

    if (url.origin !== this.baseUrl.origin) {
      throw new OtfApiError('Hôte OTF non autorisé.');
    }

    if (page !== undefined) {
      url.searchParams.set('start', String((page - 1) * this.pageSize + 1));
      url.searchParams.set('limit', String(this.pageSize));
    }
    if (query.season !== undefined) {
      const { season } = query;
      if (!Number.isInteger(season) || season < 1900 || season > 2200) {
        throw new OtfApiError('Saison OTF invalide.');
      } else {
        url.searchParams.set('season', String(season));
      }
    }
    if (query.withCultivations) {
      url.searchParams.set('withCultivations', 'true');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      // L'attente d'une place ne compte pas dans le délai de l'appel ; un
      // refus du régulateur n'envoie rien et ne se retente pas.
      await this.waitForRateSlot();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${this.options.token}`,
          },
          signal: controller.signal,
        });

        if (response.ok) {
          return await response.json();
        }

        // Répéter immédiatement une réponse 429 consommerait encore davantage
        // le quota OTF. Seules les erreurs serveur transitoires sont retentées.
        if (response.status === 429) throw await this.holdAfterRateLimit(response);
        if (response.status === 401) await this.countAuthenticationFailure();
        const retryable = response.status >= 500;
        if (!retryable || attempt === 2) {
          throw new OtfApiError(
            `Lecture OTF impossible (statut ${response.status}).`,
            response.status,
          );
        }
      } catch (error) {
        if (error instanceof OtfApiError) throw error;
        if (isDnsError(error)) {
          throw new OtfApiError("L'adresse de l'API OTF est introuvable (DNS).");
        }
        if (attempt === 2) {
          throw new OtfApiError('Lecture OTF impossible après plusieurs essais.');
        }
      } finally {
        clearTimeout(timeout);
      }

      await this.clock.sleep(120 * (attempt + 1));
    }

    throw new OtfApiError('Lecture OTF impossible.');
  }

  /**
   * La place de cet appel dans le rythme de sa ferme (F334) : un départ
   * toutes les 250 ms au plus, trente par minute ; quand la minute est
   * pleine, une attente de cinq secondes au plus, sinon l'appel est refusé
   * comme sur une limite atteinte, sans rien envoyer à OTF. Puis sa place
   * dans le compteur partagé de la base (F361), qui fait foi pour toutes les
   * instances ; le départ n'est noté en mémoire qu'ensuite, juste avant
   * l'envoi, pour que l'espacement mesuré soit celui des envois réels (F385).
   */
  private waitForRateSlot(): Promise<void> {
    const pacer = farmPacer(this.farmKey, this.clock.now());
    const { now } = this.clock;
    pacer.pending += 1;
    const slot = pacer.queue.then(async () => {
      await this.waitForLocalSlot(pacer);
      await this.claimSharedPlace();
      pacer.state = recordCallStart(pacer.state, now());
    }).finally(() => { pacer.pending -= 1; });

    pacer.queue = slot.catch(() => undefined);
    return slot;
  }

  /** Le rythme de cette instance, en mémoire : devant le compteur partagé (F361). */
  private async waitForLocalSlot(pacer: FarmPacer): Promise<void> {
    const { now, sleep } = this.clock;
    const spacingMs = this.minimumRequestIntervalMs + RATE_SLOT_SAFETY_MARGIN_MS;
    // Un minuteur peut se réveiller légèrement avant son échéance. Recalculer
    // évite alors de démarrer une requête trop tôt et sérialise aussi les
    // lectures lancées simultanément par le lecteur d'instantané.
    for (;;) {
      const next = nextCallSlot(pacer.state, now(), spacingMs, this.minuteWaitLimitMs);
      // Trente départs dans la minute et une place trop lointaine : rien n'est
      // envoyé, comme sur un refus du compteur partagé (F362, F384).
      if (next.kind === 'refused') throw new OtfReadDeferredError('minute', next.minuteFreesAt);
      const waitMs = next.at - now();
      if (waitMs <= 0) return;
      await sleep(waitMs);
    }
  }

  /**
   * La place de l'appel dans le compteur partagé (F361) : la base l'accorde
   * ou la refuse ; un refus se lit dans ce qu'elle a compté. Une pause arrête
   * l'appel, une minute pleine le fait attendre `minuteWaitLimitMs` au plus,
   * l'espacement le fait attendre ; rien n'est envoyé à OTF sans place.
   */
  private async claimSharedPlace(): Promise<void> {
    const shared = this.sharedPace;
    if (!shared) return;
    const { now, sleep } = this.clock;
    const spacingMs = this.minimumRequestIntervalMs + RATE_SLOT_SAFETY_MARGIN_MS;
    for (let attempt = 1; attempt <= SHARED_PLACE_MAX_ATTEMPTS; attempt += 1) {
      if (await shared.claimPlace(now(), spacingMs)) return;
      const askedAt = now();
      const refusal = await shared.placeRefusal(askedAt, { spacingMs, maxWaitMs: this.minuteWaitLimitMs });
      if (refusal.kind === 'stop') throw new OtfReadDeferredError(refusal.reason, refusal.retryAtMs);
      const waitMs = refusal.atMs - now();
      if (waitMs > 0) await sleep(waitMs);
    }
    logJsonLine('warn', { event: 'otf_shared_place_unavailable', attempts: SHARED_PLACE_MAX_ATTEMPTS });
    throw new OtfReadDeferredError('minute', null);
  }

  /**
   * Une limite atteinte chez OTF (F361, F363, F382) : la ferme, ou tout le
   * module, ne part plus jusqu'à la fin de la pause, pour toutes les
   * instances ; en mémoire, une seconde pour tous les clients de la ferme.
   * Rend l'erreur que la lecture remonte, avec la raison et la fin de la
   * pause.
   */
  private async holdAfterRateLimit(response: Response): Promise<OtfReadDeferredError> {
    const atMs = this.clock.now();
    const pacer = farmPacer(this.farmKey, atMs);
    pacer.state = holdCallsUntil(pacer.state, atMs + OTF_RATE_LIMIT_COOLDOWN_MS);
    const pause = pauseAfterRateLimit({
      code: otfRateLimitCode(await response.json().catch(() => null)),
      retryAfterMs: retryAfterMilliseconds(response.headers.get('Retry-After'), atMs),
      atMs,
    });
    try {
      await this.sharedPace?.holdCalls(pause);
    } catch (error) {
      // La limite d'OTF reste remontée ; sans la base, la mémoire tient la seconde de pause.
      logJsonLine('warn', { event: 'otf_pause_not_recorded', reason: pause.reason, message: error instanceof Error ? error.message : 'erreur inconnue' });
    }
    return new OtfReadDeferredError(pause.reason, pause.untilMs);
  }

  /** Un refus d'accès compte pour le frein du module (F359) ; le journal dit quand il serre. */
  private async countAuthenticationFailure(): Promise<void> {
    try {
      const brake = await this.sharedPace?.recordAuthenticationFailure(this.clock.now());
      if (brake) logJsonLine('warn', { event: 'otf_authentication_brake', pausedUntil: new Date(brake.untilMs).toISOString() });
    } catch (error) {
      logJsonLine('warn', { event: 'otf_authentication_failure_not_recorded', message: error instanceof Error ? error.message : 'erreur inconnue' });
    }
  }
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractTotal(payload: unknown): number | null {
  if (!isRecord(payload)) return null;
  const value = payload.count;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function hasNextPage(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  const view = payload['hydra:view'];
  return isRecord(view) && typeof view['hydra:next'] === 'string';
}

function normalizeBasePath(pathname: string): string {
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function isDnsError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('cause' in error)) {
    return false;
  }
  const cause = error.cause;
  if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
    return false;
  }
  return cause.code === 'ENOTFOUND' || cause.code === 'EAI_AGAIN';
}
