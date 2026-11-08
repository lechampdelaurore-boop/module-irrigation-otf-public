import { OtfApiError, extractCollection } from '../../domain/otf/api-contract.ts';
import { millisecondsFromSeconds } from '../../domain/units.ts';

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
 * Le quota de quatre appels par seconde vaut pour le jeton du module, pas pour
 * l'objet qui appelle. Le rythme est donc tenu par un régulateur unique du
 * module, partagé par tous les clients : deux lectures lancées en même temps
 * par des composants différents ne peuvent plus cumuler leurs quotas. Constaté
 * le 20 septembre 2026 par un 429 sur `/bedList` (docs/otf-contract.md).
 */
const otfRatePacer = {
  lastRequestStartedAt: 0,
  notBefore: 0,
  queue: Promise.resolve() as Promise<void>,
};

/** Remet le régulateur à zéro entre deux tests, qui se suivent sans attendre. */
export function resetOtfRatePacer(): void {
  otfRatePacer.lastRequestStartedAt = 0;
  otfRatePacer.notBefore = 0;
  otfRatePacer.queue = Promise.resolve();
}

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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        await this.waitForRateSlot();
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
        if (response.status === 429) this.holdAfterRateLimit();
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

      await delay(120 * (attempt + 1));
    }

    throw new OtfApiError('Lecture OTF impossible.');
  }

  private waitForRateSlot(): Promise<void> {
    const pacer = otfRatePacer;
    const dueAt = () => Math.max(
      pacer.lastRequestStartedAt + this.minimumRequestIntervalMs + RATE_SLOT_SAFETY_MARGIN_MS,
      pacer.notBefore,
    );
    const slot = pacer.queue.then(async () => {
      let waitMs = Math.max(0, dueAt() - Date.now());

      // Un minuteur peut se réveiller légèrement avant son échéance. Recalculer
      // évite alors de démarrer une requête trop tôt et sérialise aussi les
      // lectures lancées simultanément par le lecteur d'instantané.
      while (waitMs > 0) {
        await delay(waitMs);
        waitMs = Math.max(0, dueAt() - Date.now());
      }

      pacer.lastRequestStartedAt = Date.now();
    });

    pacer.queue = slot.catch(() => undefined);
    return slot;
  }

  /** Une limite atteinte fait patienter tout le module, pas seulement ce client. */
  private holdAfterRateLimit(): void {
    otfRatePacer.notBefore = Math.max(otfRatePacer.notBefore, Date.now() + OTF_RATE_LIMIT_COOLDOWN_MS);
  }
}

function delay(durationMs: number) {
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
