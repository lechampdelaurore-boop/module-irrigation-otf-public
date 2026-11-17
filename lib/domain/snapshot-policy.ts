import type { IrrigationSnapshot } from './domain.ts';
import { OtfApiError } from './otf/api-contract.ts';
import { OtfFarmMismatchError } from './otf/farm-identity.ts';

/**
 * Pourquoi la lecture d'Ouvre ta ferme n'a pas abouti. Depuis la 4.1
 * (docs/tranche-4-contract.md, F332, F341, F342) : la clé mène à une autre
 * ferme que celle de l'espace, ou à aucune ferme lisible.
 */
export type IrrigationUnavailableReason = 'rate-limit' | 'unavailable' | 'farm-changed' | 'farm-unidentified';

/** Le message de F332, montré avec le dernier instantané de l'espace ou à sa place. */
export const FARM_CHANGED_MESSAGE =
  "La clé d'Ouvre ta ferme de ce module mène maintenant à une autre ferme. Rechargez la page pour l'ouvrir ; les réglages de la ferme précédente restent gardés à part.";

/** Le message de F341 : aucune page ne s'affiche tant que la ferme de la clé n'est pas connue. */
export const FARM_UNIDENTIFIED_MESSAGE =
  "Ouvre ta ferme n'a pas dit à quelle ferme mène la clé de ce module. Rien n'est affiché tant que la ferme n'est pas connue ; aucune donnée n'a été modifiée. Réessayez dans quelques minutes.";

const CACHED_WARNINGS: Record<IrrigationUnavailableReason, string> = {
  'rate-limit': 'Limite de requêtes OTF atteinte. La dernière lecture réussie est affichée. Patientez quelques minutes avant d’actualiser à nouveau.',
  unavailable: "Connexion à Ouvre ta ferme indisponible. La dernière lecture réussie est affichée.",
  'farm-changed': FARM_CHANGED_MESSAGE,
  'farm-unidentified': "Ouvre ta ferme n'a pas dit à quelle ferme mène la clé de ce module. La dernière lecture réussie est affichée.",
};

const UNAVAILABLE_MESSAGES: Record<IrrigationUnavailableReason, string> = {
  'rate-limit': "La limite de requêtes OTF est atteinte et aucun cache n'existe.",
  unavailable: "Les données d'Ouvre ta ferme sont indisponibles et aucun cache n'existe.",
  'farm-changed': "La clé d'Ouvre ta ferme mène à une autre ferme et aucun cache n'existe pour cet espace.",
  'farm-unidentified': "Ouvre ta ferme n'a pas dit à quelle ferme mène la clé et aucun cache n'existe.",
};

export class IrrigationDataUnavailableError extends Error {
  readonly reason: IrrigationUnavailableReason;

  constructor(reason: IrrigationUnavailableReason = 'unavailable') {
    super(UNAVAILABLE_MESSAGES[reason]);
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
      return { ...cached, source: 'cache', warning: CACHED_WARNINGS[reason] };
    }

    throw new IrrigationDataUnavailableError(reason);
  }
}

function unavailableReason(error: unknown): IrrigationUnavailableReason {
  if (error instanceof OtfFarmMismatchError) {
    return error.observedFarmId === null ? 'farm-unidentified' : 'farm-changed';
  }
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
