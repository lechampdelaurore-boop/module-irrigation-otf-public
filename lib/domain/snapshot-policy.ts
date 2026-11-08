import type { IrrigationSnapshot } from './domain.ts';
import { OtfApiError } from './otf/api-contract.ts';

export type IrrigationUnavailableReason = 'rate-limit' | 'unavailable';

export class IrrigationDataUnavailableError extends Error {
  readonly reason: IrrigationUnavailableReason;

  constructor(reason: IrrigationUnavailableReason = 'unavailable') {
    super(
      reason === 'rate-limit'
        ? "La limite de requêtes OTF est atteinte et aucun cache n'existe."
        : "Les données d'Ouvre ta ferme sont indisponibles et aucun cache n'existe.",
    );
    this.name = 'IrrigationDataUnavailableError';
    this.reason = reason;
  }
}

type SnapshotPolicyDependencies = {
  readLive: () => Promise<IrrigationSnapshot>;
  readCache: () => Promise<IrrigationSnapshot | null>;
  writeCache: (snapshot: IrrigationSnapshot) => Promise<void>;
  maxCacheAgeMs?: number;
  now?: () => Date;
};

export async function readLiveOrLastSuccessfulSnapshot({
  readLive,
  readCache,
  writeCache,
  maxCacheAgeMs = 0,
  now = () => new Date(),
}: SnapshotPolicyDependencies): Promise<IrrigationSnapshot> {
  let cached: IrrigationSnapshot | null = null;
  try {
    cached = await readCache();
  } catch {
    // Une panne du cache ne doit pas empêcher une lecture réelle.
  }

  if (cached && isFresh(cached, maxCacheAgeMs, now())) return cached;

  try {
    const live = await readLive();
    try {
      await writeCache(live);
    } catch {
      // Cache durability must not hide a complete live response.
    }
    return live;
  } catch (error) {
    // Une saison hors de la plage OTF est une erreur de navigation, pas une
    // panne de connexion. La page doit pouvoir proposer une saison valide.
    if (error instanceof OtfApiError && error.code === 'season-unavailable') {
      throw error;
    }
    const reason = unavailableReason(error);
    if (cached) {
      return {
        ...cached,
        source: 'cache',
        warning: reason === 'rate-limit'
          ? 'Limite de requêtes OTF atteinte. La dernière lecture réussie est affichée. Patientez quelques minutes avant d’actualiser à nouveau.'
          : "Connexion à Ouvre ta ferme indisponible. La dernière lecture réussie est affichée.",
      };
    }

    throw new IrrigationDataUnavailableError(reason);
  }
}

function unavailableReason(error: unknown): IrrigationUnavailableReason {
  return error instanceof OtfApiError && error.status === 429
    ? 'rate-limit'
    : 'unavailable';
}

function isFresh(
  snapshot: IrrigationSnapshot,
  maxCacheAgeMs: number,
  now: Date,
) {
  if (maxCacheAgeMs <= 0) return false;
  const readAt = Date.parse(snapshot.lastSuccessfulReadAt);
  return Number.isFinite(readAt) && now.getTime() - readAt <= maxCacheAgeMs;
}
