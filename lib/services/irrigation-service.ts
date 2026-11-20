import { millisecondsFromHours } from '@/lib/domain/units';
import { readCachedSnapshot, readLatestCachedSnapshot, saveCachedSnapshot } from '@/db/snapshot-cache';
import { readDeploymentFarm, saveDeploymentFarm } from '@/db/otf-deployment-farm-repository';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import { mockSnapshot } from '@/lib/adapters/mock-data';
import { cropPlanForSeason } from '@/lib/domain/crop-plan';
import { farmSpaceOf } from '@/lib/domain/farm-space';
import { OtfApiError } from '@/lib/domain/otf/api-contract';
import { OtfFarmMismatchError, snapshotFarmIdentity } from '@/lib/domain/otf/farm-identity';
import {
  OtfSeasonUnavailableError,
  readOtfSeasonSnapshot,
} from '@/lib/adapters/otf/snapshot-reader';
import { readLiveOrLastSuccessfulSnapshot } from '@/lib/domain/snapshot-policy';
import { isDemoDeployment } from '@/lib/services/deployment-mode';
import { createOtfReadClient, readOtfDataSource } from '@/lib/services/otf-connection';
import { startFarmRead, type FarmRead } from '@/lib/services/otf-farm-read';
import type { OtfReadContext } from '@/lib/domain/otf/shared-call-pace';
import { demoChoiceOfOwner } from '@/lib/domain/demo/catalogue';
import { demoFarmSnapshot } from '@/lib/adapters/demo/farms';
import { listPlotSheltersForUser } from '@/db/plot-shelter-repository';
import { applyPlotShelters } from '@/lib/domain/onboarding/plots';
import { getOnboardingForUser } from '@/lib/services/onboarding-service';

// Le plan de culture s'ajoute à l'instantané le 29 septembre 2026 : un cache
// de la version précédente n'en a pas, une nouvelle clé force sa lecture.
const SNAPSHOT_CACHE_VERSION = 'v6-plan-de-culture';
const LEGACY_SNAPSHOT_CACHE_VERSION = 'v3-zone-fill-area';

export { IrrigationDataUnavailableError } from '@/lib/domain/snapshot-policy';

type IrrigationSnapshotOptions = {
  season: number;
  forceRefresh?: boolean;
  /** Une page, par défaut, ou le calcul du matin, qui peut attendre une minute (F362). */
  context?: OtfReadContext;
};

/**
 * L'instantané d'un espace, rangé sous sa clé (docs/tranche-4-contract.md,
 * F328). Avec Ouvre ta ferme, seul l'espace de la ferme du déploiement le lit,
 * et la lecture commence par vérifier cette ferme (F332, F337, F342). Depuis
 * la 4.3 (F361, F362), une lecture complète à la fois par ferme, pour toutes
 * les instances du serveur, qui ne part que si elle peut finir ; son bail
 * est rendu après l'écriture du cache, où une seconde lecture de la même
 * ferme trouve ce qu'elle a rangé (F388).
 */
export async function getIrrigationSnapshot(cacheKey: string, options: IrrigationSnapshotOptions): Promise<IrrigationSnapshot> {
  // Le plan lu d'Ouvre ta ferme est rangé tel quel ; le classement des jardins de l'espace s'y pose à la sortie (4.4, F583).
  const [snapshot, onboarding, shelters] = await Promise.all([
    readFarmSnapshot(cacheKey, options),
    getOnboardingForUser(cacheKey),
    listPlotSheltersForUser(cacheKey),
  ]);
  return applyPlotShelters(snapshot, onboarding, shelters);
}

async function readFarmSnapshot(
  cacheKey: string,
  { season, forceRefresh = false, context = 'page' }: IrrigationSnapshotOptions,
): Promise<IrrigationSnapshot> {
  if (readOtfDataSource() !== 'live') {
    const source = mockSource(cacheKey);
    const snapshot = snapshotForSeason(source, season);
    if (snapshot) return snapshot;
    throw new OtfSeasonUnavailableError(
      season,
      source.configuration.seasonFirst,
      source.configuration.seasonLast,
    );
  }

  const spaceFarm = farmSpaceOf(cacheKey).otfFarmId;
  const versionedCacheKey = JSON.stringify([
    SNAPSHOT_CACHE_VERSION,
    cacheKey,
    season,
  ]);

  // La lecture en cours, rendue après l'écriture du cache ou à son échec.
  let farmRead: FarmRead | null = null;
  return readLiveOrLastSuccessfulSnapshot({
    readLive: async () => {
      // Avant tout appel : la ferme que cet espace peut lire (F342).
      const expectedFarm = await farmToRead(spaceFarm);
      try {
        // La ferme compte ses appels sous son identifiant, quelle que soit la clé (F361, F381).
        const read = await startFarmRead(expectedFarm, context);
        farmRead = read;
        const client = createOtfReadClient({ sharedPace: read.sharedPace, minuteWaitLimitMs: read.minuteWaitLimitMs });
        const snapshot = await readOtfSeasonSnapshot(client, season, new Date(), expectedFarm);
        read.markComplete();
        await keepDeploymentFarm(expectedFarm, snapshot.lastSuccessfulReadAt);
        return snapshot;
      } catch (error) {
        await farmRead?.finish(error);
        // La clé mène à une autre ferme : elle devient la ferme gardée, et
        // la page suivante ouvre l'espace de celle-ci (F332).
        if (error instanceof OtfFarmMismatchError && error.observedFarmId !== null) {
          await keepDeploymentFarm(error.observedFarmId, new Date().toISOString());
        }
        logSyncFailure('lecture-live', error);
        throw error;
      }
    },
    readCache: () => readSpaceCachedSnapshot(cacheKey, season),
    writeCache: async (snapshot) => {
      try {
        await saveCachedSnapshot(versionedCacheKey, snapshot);
      } catch (error) {
        logSyncFailure('écriture-cache', error);
        throw error;
      } finally {
        await farmRead?.finish();
      }
    },
    maxCacheAgeMs: forceRefresh ? 0 : millisecondsFromHours(4),
  });
}

/**
 * La ferme que l'espace peut lire chez Ouvre ta ferme : la sienne, si c'est
 * celle de la clé du déploiement. Un espace sans ferme (d'avant la 4.1, sa
 * personne pas encore revenue) ou d'une autre ferme ne lit pas OTF : son
 * dernier instantané en cache sert (F342).
 */
async function farmToRead(spaceFarm: string | null): Promise<string> {
  if (spaceFarm === null) {
    throw new OtfApiError('Espace sans ferme : Ouvre ta ferme n’est pas lu avant son rattachement.');
  }
  const deploymentFarm = (await readDeploymentFarm())?.otfFarmId ?? null;
  if (deploymentFarm !== spaceFarm) throw new OtfFarmMismatchError(deploymentFarm);
  return spaceFarm;
}

/** La ferme observée devient la ferme gardée ; une panne de la base n'empêche pas la lecture. */
async function keepDeploymentFarm(otfFarmId: string, observedAt: string) {
  try {
    await saveDeploymentFarm(otfFarmId, observedAt);
  } catch (error) {
    logSyncFailure('écriture-ferme', error);
  }
}

/**
 * L'instantané déjà lu, sans aucun appel à Ouvre ta ferme : la démonstration,
 * ou le dernier mis en cache pour la saison, quel que soit son âge ; `null`
 * quand rien n'est en cache. Les alertes par culture le lisent
 * (docs/weather-crop-alerts-contract.md : « Aucun appel nouveau vers Ouvre
 * ta ferme »).
 */
export async function readCachedIrrigationSnapshot(cacheKey: string, season: number): Promise<IrrigationSnapshot | null> {
  if (readOtfDataSource() !== 'live') return snapshotForSeason(mockSource(cacheKey), season);
  return readSpaceCachedSnapshot(cacheKey, season);
}

/**
 * Le dernier instantané d'un espace, toutes saisons : la preuve de la ferme
 * d'où viennent ses données, pour le rattachement (F331, F340).
 */
export async function readLatestCachedSnapshotOfSpace(cacheKey: string): Promise<IrrigationSnapshot | null> {
  const scopedPrefix = JSON.stringify([SNAPSHOT_CACHE_VERSION, cacheKey]).slice(0, -1) + ',';
  return readLatestCachedSnapshot({ prefix: scopedPrefix, exactKey: legacyCacheKeyOf(cacheKey) });
}

/**
 * L'instantané en cache d'un espace pour la saison. Un espace qui vient
 * d'être rattaché n'a encore rien sous sa clé : il lit celui de sa personne
 * d'avant la 4.1, seulement s'il est de la même ferme ; rien n'est copié
 * (F343).
 */
async function readSpaceCachedSnapshot(cacheKey: string, season: number): Promise<IrrigationSnapshot | null> {
  const own = await readCachedSnapshotOfKey(cacheKey, season);
  if (own) return own;
  const { ownerUserId, otfFarmId } = farmSpaceOf(cacheKey);
  if (otfFarmId === null) return null;
  const beforeAttachment = await readCachedSnapshotOfKey(ownerUserId, season);
  return beforeAttachment && snapshotFarmIdentity(beforeAttachment) === otfFarmId ? beforeAttachment : null;
}

async function readCachedSnapshotOfKey(cacheKey: string, season: number): Promise<IrrigationSnapshot | null> {
  const scoped = await readCachedSnapshot(JSON.stringify([SNAPSHOT_CACHE_VERSION, cacheKey, season]));
  if (scoped) return scoped;
  const legacy = await readCachedSnapshot(legacyCacheKeyOf(cacheKey));
  return legacy ? snapshotForSeason(legacy, season) : null;
}

function legacyCacheKeyOf(cacheKey: string): string {
  return `${LEGACY_SNAPSHOT_CACHE_VERSION}:${cacheKey}`;
}

function logSyncFailure(stage: 'lecture-live' | 'écriture-cache' | 'écriture-ferme', error: unknown) {
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

/**
 * Le plan de démonstration : en démonstration, celui de la ferme fictive et
 * du moment de l'espace (docs/demo-guided-contract.md, section 6) ; ailleurs,
 * la ferme de démonstration des parcours navigateur, inchangée.
 */
function mockSource(cacheKey: string): IrrigationSnapshot {
  const choice = isDemoDeployment() ? demoChoiceOfOwner(cacheKey) : null;
  return choice ? demoFarmSnapshot(choice.profile.id, choice.moment.dateKey) : mockSnapshot;
}
