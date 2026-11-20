import type { IrrigationSnapshot } from './domain.ts';
import { OtfApiError, OtfShapeError } from './otf/api-contract.ts';
import { OtfFarmMismatchError } from './otf/farm-identity.ts';
import { OtfReadDeferredError } from './otf/shared-call-pace.ts';
import { FARM_TIME_ZONE } from './water-management.ts';
import { clockText } from './clock-text.ts';

/**
 * Pourquoi la lecture d'Ouvre ta ferme n'a pas abouti. Depuis la 4.1
 * (docs/tranche-4-contract.md, F332, F341, F342) : la clé mène à une autre
 * ferme que celle de l'espace, ou à aucune ferme lisible. Depuis la 4.3
 * (F362, F363, F386) : la limite du jour d'OTF, une autre lecture de la
 * ferme en cours, une lecture de plus de 30 appels ; Ouvre ta ferme a changé
 * la forme de ses données (T4-15, F370 point 5, F394).
 */
export type IrrigationUnavailableReason = 'rate-limit' | 'unavailable' | 'farm-changed' | 'farm-unidentified' | 'day-limit' | 'read-in-progress' | 'read-too-long' | 'shape-changed';

/** Le message de F332, montré avec le dernier instantané de l'espace ou à sa place. */
export const FARM_CHANGED_MESSAGE =
  "La clé d'Ouvre ta ferme de ce module mène maintenant à une autre ferme. Rechargez la page pour l'ouvrir ; les réglages de la ferme précédente restent gardés à part.";

/** Le message de F341 : aucune page ne s'affiche tant que la ferme de la clé n'est pas connue. */
export const FARM_UNIDENTIFIED_MESSAGE =
  "Ouvre ta ferme n'a pas dit à quelle ferme mène la clé de ce module. Rien n'est affiché tant que la ferme n'est pas connue ; aucune donnée n'a été modifiée. Réessayez dans quelques minutes.";

/** Le message de F362 : une lecture de plus de 30 appels ne se fait qu'au calcul du matin. */
export const READ_TOO_LONG_MESSAGE =
  "La lecture complète de cette ferme demande plus de 30 appels, le maximum qu'Ouvre ta ferme accepte par minute : elle se fait au calcul du matin.";

/** Le message de F370 (point 5) : une route lue a changé de forme, la lecture s'est arrêtée sans rien ranger. */
export const SHAPE_CHANGED_MESSAGE =
  'Ouvre ta ferme a changé la forme de ses données : la dernière lecture réussie est affichée.';

/** Le message de F363, sans la date des données : la page la donne juste après (« Dernière synchronisation », F386). */
export const DAY_LIMIT_MESSAGE =
  "Ouvre ta ferme a atteint le nombre d'appels permis aujourd'hui pour cette ferme, tous outils confondus : nouvelle lecture possible demain.";

const CACHED_WARNINGS: Record<IrrigationUnavailableReason, string> = {
  'rate-limit': 'Limite de requêtes OTF atteinte. La dernière lecture réussie est affichée. Patientez quelques minutes avant d’actualiser à nouveau.',
  unavailable: "Connexion à Ouvre ta ferme indisponible. La dernière lecture réussie est affichée.",
  'farm-changed': FARM_CHANGED_MESSAGE,
  'farm-unidentified': "Ouvre ta ferme n'a pas dit à quelle ferme mène la clé de ce module. La dernière lecture réussie est affichée.",
  'day-limit': DAY_LIMIT_MESSAGE,
  'read-in-progress': "Une lecture d'Ouvre ta ferme est déjà en cours pour cette ferme. La dernière lecture réussie est affichée ; actualisez dans un instant.",
  'read-too-long': READ_TOO_LONG_MESSAGE,
  'shape-changed': SHAPE_CHANGED_MESSAGE,
};

const UNAVAILABLE_MESSAGES: Record<IrrigationUnavailableReason, string> = {
  'rate-limit': "La limite de requêtes OTF est atteinte et aucun cache n'existe.",
  unavailable: "Les données d'Ouvre ta ferme sont indisponibles et aucun cache n'existe.",
  'farm-changed': "La clé d'Ouvre ta ferme mène à une autre ferme et aucun cache n'existe pour cet espace.",
  'farm-unidentified': "Ouvre ta ferme n'a pas dit à quelle ferme mène la clé et aucun cache n'existe.",
  'day-limit': "Ouvre ta ferme a atteint la limite d'appels du jour pour cette ferme et aucun cache n'existe.",
  'read-in-progress': "Une autre lecture d'Ouvre ta ferme de cette ferme est en cours et aucun cache n'existe.",
  'read-too-long': "La lecture de cette ferme se fait au calcul du matin et aucun cache n'existe.",
  'shape-changed': "Ouvre ta ferme a changé la forme de ses données et aucun cache n'existe.",
};

/**
 * Le message montré avec le dernier instantané. Quand l'heure de la
 * prochaine lecture possible est connue et qu'elle est aujourd'hui, la
 * limite atteinte la dit (F362, F386) : « nouvelle lecture possible à 22:41 ».
 */
function cachedWarning(reason: IrrigationUnavailableReason, retryAtMs: number | null, now: Date): string {
  if (reason !== 'rate-limit' || retryAtMs === null || !sameParisDay(retryAtMs, now.getTime())) return CACHED_WARNINGS[reason];
  return `Limite de requêtes OTF atteinte. La dernière lecture réussie est affichée ; nouvelle lecture possible à ${parisTime(retryAtMs)}.`;
}

function parisTime(atMs: number): string {
  return clockText(new Date(atMs), FARM_TIME_ZONE);
}

function sameParisDay(firstMs: number, secondMs: number): boolean {
  const day = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeZone: FARM_TIME_ZONE });
  return day.format(new Date(firstMs)) === day.format(new Date(secondMs));
}

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
    // Une autre lecture de la ferme était en cours : ce qu'elle a rangé, s'il
    // est plus récent que le cache lu avant elle, est la lecture de celle-ci
    // (F362, F388).
    if (error instanceof OtfReadDeferredError && error.reason === 'read-in-progress') {
      const stored = await readCacheQuietly(readCache);
      if (stored && isNewer(stored, cached)) return stored;
    }
    const reason = unavailableReason(error);
    if (cached) {
      return { ...cached, source: 'cache', warning: cachedWarning(reason, error instanceof OtfReadDeferredError ? error.retryAtMs : null, now()) };
    }

    throw new IrrigationDataUnavailableError(reason);
  }
}

async function readCacheQuietly(readCache: () => Promise<IrrigationSnapshot | null>): Promise<IrrigationSnapshot | null> {
  try {
    return await readCache();
  } catch {
    return null;
  }
}

function isNewer(stored: IrrigationSnapshot, before: IrrigationSnapshot | null): boolean {
  if (!before) return true;
  return Date.parse(stored.lastSuccessfulReadAt) > Date.parse(before.lastSuccessfulReadAt);
}

function unavailableReason(error: unknown): IrrigationUnavailableReason {
  if (error instanceof OtfFarmMismatchError) {
    return error.observedFarmId === null ? 'farm-unidentified' : 'farm-changed';
  }
  if (error instanceof OtfReadDeferredError) return deferralReason(error);
  if (error instanceof OtfShapeError) return 'shape-changed';
  return error instanceof OtfApiError && error.status === 429
    ? 'rate-limit'
    : 'unavailable';
}

/**
 * Ce que la page dit d'une lecture reportée (F386) : une minute pleine ou une
 * pause d'OTF sont une limite de requêtes ; le frein et le blocage pour refus
 * d'accès, une connexion indisponible (le journal dit le frein, F359).
 */
function deferralReason(error: OtfReadDeferredError): IrrigationUnavailableReason {
  switch (error.reason) {
    case 'minute':
    case 'rate-limit':
      return 'rate-limit';
    case 'day-limit':
      return 'day-limit';
    case 'read-in-progress':
      return 'read-in-progress';
    case 'too-many-calls':
      return 'read-too-long';
    case 'authentication-brake':
    case 'authentication-limit':
      return 'unavailable';
  }
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
