import { millisecondsFromHours } from '@/lib/domain/units';
import { env } from 'cloudflare:workers';
import { readCachedSnapshot, saveCachedSnapshot } from '@/db/snapshot-cache';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import { mockSnapshot } from '@/lib/adapters/mock-data';
import { cropPlanForSeason } from '@/lib/domain/crop-plan';
import {
  OTF_MINIMUM_REQUEST_INTERVAL_MS,
  OtfReadClient,
} from '@/lib/adapters/otf/read-client';
import { OtfApiError } from '@/lib/domain/otf/api-contract';
import {
  OtfSeasonUnavailableError,
  readOtfSeasonSnapshot,
} from '@/lib/adapters/otf/snapshot-reader';
import { readLiveOrLastSuccessfulSnapshot } from '@/lib/domain/snapshot-policy';

// Le plan de culture s'ajoute à l'instantané le 29 septembre 2026 : un cache
// de la version précédente n'en a pas, une nouvelle clé force sa lecture.
const SNAPSHOT_CACHE_VERSION = 'v6-plan-de-culture';
const LEGACY_SNAPSHOT_CACHE_VERSION = 'v3-zone-fill-area';

export { IrrigationDataUnavailableError } from '@/lib/domain/snapshot-policy';

type IrrigationSnapshotOptions = {
  season: number;
  forceRefresh?: boolean;
};

export async function getIrrigationSnapshot(
  cacheKey: string,
  { season, forceRefresh = false }: IrrigationSnapshotOptions,
): Promise<IrrigationSnapshot> {
  if (readDataSource() !== 'live') {
    const snapshot = snapshotForSeason(mockSnapshot, season);
    if (snapshot) return snapshot;
    throw new OtfSeasonUnavailableError(
      season,
      mockSnapshot.configuration.seasonFirst,
      mockSnapshot.configuration.seasonLast,
    );
  }

  const versionedCacheKey = JSON.stringify([
    SNAPSHOT_CACHE_VERSION,
    cacheKey,
    season,
  ]);
  const legacyCacheKey = `${LEGACY_SNAPSHOT_CACHE_VERSION}:${cacheKey}`;

  return readLiveOrLastSuccessfulSnapshot({
    readLive: async () => {
      try {
        const client = new OtfReadClient({
          baseUrl: readRequiredServerSetting('OTF_API_BASE_URL'),
          token: readRequiredServerSetting('OTF_API_TOKEN'),
          minimumRequestIntervalMs: OTF_MINIMUM_REQUEST_INTERVAL_MS,
        });
        return await readOtfSeasonSnapshot(client, season);
      } catch (error) {
        logSyncFailure('lecture-live', error);
        throw error;
      }
    },
    readCache: async () => {
      const scoped = await readCachedSnapshot(versionedCacheKey);
      if (scoped) return scoped;

      const legacy = await readCachedSnapshot(legacyCacheKey);
      return legacy ? snapshotForSeason(legacy, season) : null;
    },
    writeCache: async (snapshot) => {
      try {
        await saveCachedSnapshot(versionedCacheKey, snapshot);
      } catch (error) {
        logSyncFailure('écriture-cache', error);
        throw error;
      }
    },
    maxCacheAgeMs: forceRefresh ? 0 : millisecondsFromHours(4),
  });
}

/**
 * L'instantané déjà lu, sans aucun appel à Ouvre ta ferme : la démonstration,
 * ou le dernier mis en cache pour la saison, quel que soit son âge ; `null`
 * quand rien n'est en cache. Les alertes par culture le lisent
 * (docs/weather-crop-alerts-contract.md : « Aucun appel nouveau vers Ouvre
 * ta ferme »).
 */
export async function readCachedIrrigationSnapshot(cacheKey: string, season: number): Promise<IrrigationSnapshot | null> {
  if (readDataSource() !== 'live') return snapshotForSeason(mockSnapshot, season);
  const scoped = await readCachedSnapshot(JSON.stringify([SNAPSHOT_CACHE_VERSION, cacheKey, season]));
  if (scoped) return scoped;
  const legacy = await readCachedSnapshot(`${LEGACY_SNAPSHOT_CACHE_VERSION}:${cacheKey}`);
  return legacy ? snapshotForSeason(legacy, season) : null;
}

function logSyncFailure(stage: 'lecture-live' | 'écriture-cache', error: unknown) {
  const diagnostic = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        status: error instanceof OtfApiError ? error.status : undefined,
      }
    : { name: 'UnknownError', message: 'Erreur inconnue.' };

  console.error(`[irrigation-sync] ${stage}`, diagnostic);
}

function snapshotForSeason(
  snapshot: IrrigationSnapshot,
  season: number,
): IrrigationSnapshot | null {
  const { seasonFirst, seasonLast } = snapshot.configuration;
  if (!Number.isInteger(season) || season < seasonFirst || season > seasonLast) {
    return null;
  }

  const zones = snapshot.zones
    .filter((zone) => zone.seasons.includes(season))
    .map((zone) => ({ ...zone, seasons: [season] }));
  const zoneIds = new Set(zones.map((zone) => zone.id));
  const plots = snapshot.plots
    .filter(
      (plot) => zoneIds.has(plot.zoneId) && plot.seasons.includes(season),
    )
    .map((plot) => ({ ...plot, seasons: [season] }));
  const plotIds = new Set(plots.map((plot) => plot.id));
  const beds = snapshot.beds
    .filter(
      (bed) =>
        zoneIds.has(bed.zoneId) &&
        plotIds.has(bed.plotId) &&
        bed.seasons.includes(season),
    )
    .map((bed) => ({ ...bed, seasons: [season] }));

  return {
    ...snapshot,
    zones,
    plots,
    beds,
    cropPlan: snapshot.cropPlan
      ? cropPlanForSeason(snapshot.cropPlan, season, new Set(beds.map((bed) => bed.id)))
      : undefined,
    warning: undefined,
  };
}

function readDataSource(): 'mock' | 'live' {
  // En développement local, le lanceur sécurisé fournit les réglages via
  // process.env. Ils doivent donc primer sur les bindings du site publié.
  const configured = process.env.OTF_DATA_SOURCE ?? env.OTF_DATA_SOURCE;
  return configured === 'live' ? 'live' : 'mock';
}

function readRequiredServerSetting(
  key: 'OTF_API_BASE_URL' | 'OTF_API_TOKEN',
): string {
  const workerValue =
    key === 'OTF_API_BASE_URL' ? env.OTF_API_BASE_URL : env.OTF_API_TOKEN;
  const value = process.env[key] ?? workerValue;
  if (!value?.trim()) throw new Error(`Configuration serveur absente : ${key}`);
  return value.trim();
}
