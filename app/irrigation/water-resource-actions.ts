'use server';
import { instantFromIrrigationDateTimeInput } from '@/lib/domain/irrigation-format';
import { millisecondsFromMinutes } from '@/lib/domain/units';

import { getAuthenticatedUser } from '@/app/access-auth';
import {
  correctWaterReservoirVolumeForUser,
  saveDefaultWaterSupplyForUser,
  saveReservoirLinkForUser,
  saveResourceReservoirLinkForUser,
  saveWaterReservoirForUser,
  saveWaterResourceForUser,
  saveWaterResourceLimitForUser,
} from '@/db/water-resource-repository';
import {
  ResourceMeterReadingError,
  applyResourceFlowForUser,
  deleteResourceMeterReadingForUser,
  saveResourceMeterReadingForUser,
} from '@/db/water-resource-flow-repository';
import { getResourceFlowHistoryForUser } from '@/lib/services/resource-flow-history';
import type { MeterReadingRejection } from '@/lib/domain/resource-flow';
import { millisecondsFromHours, secondsFromMilliseconds } from '@/lib/domain/units';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { recalculatePlanAfterEvent } from '@/lib/services/planning-recalculation';
import {
  getWaterResourceDashboardForUser,
  type WaterResourceDashboard,
} from '@/lib/services/water-resource-dashboard';
import {
  normalizeWaterReservoirDraft,
  normalizeWaterResourceDraft,
  normalizeWaterResourceLimit,
  type IrrigationSupplyDefault,
  type ReservoirLink,
  type ResourceReservoirLink,
  type WaterReservoirDraft,
  type WaterResourceDraft,
} from '@/lib/domain/water-resources';

export type WaterResourceActionResult =
  | { ok: true; message: string; dashboard: WaterResourceDashboard }
  | { ok: false; message: string };

type ProjectionInput = {
  season: number;
  horizon: WaterResourceDashboard['horizon'];
  customEndsAt?: string | null;
};

export async function loadWaterResourceDashboardAction(
  input: ProjectionInput,
): Promise<WaterResourceActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  return dashboardResult(context.value, input, 'Projection actualisée.');
}

export async function saveWaterResourceAction(input: ProjectionInput & {
  resourceId: string | null;
  resource: WaterResourceDraft;
  limit: {
    enabled: boolean;
    maxCubicMetersPerDay: number | null;
    validFrom: string;
    validUntil: string | null;
    referenceNote: string | null;
  } | null;
}): Promise<WaterResourceActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  try {
    const resource = normalizeWaterResourceDraft(input.resource);
    const resourceId = await saveWaterResourceForUser(
      context.value.ownerUserId,
      context.value.ownerUserId,
      cleanId(input.resourceId),
      resource,
    );
    if (input.limit) {
      const limit = normalizeWaterResourceLimit(input.limit);
      await saveWaterResourceLimitForUser(
        context.value.ownerUserId,
        context.value.ownerUserId,
        resourceId,
        limit,
      );
    }
    return dashboardResult(context.value, input, input.resourceId ? 'La ressource a été modifiée.' : 'La ressource a été créée.');
  } catch (error) {
    return failure(error);
  }
}

export async function saveWaterReservoirAction(input: ProjectionInput & {
  reservoirId: string | null;
  reservoir: WaterReservoirDraft;
}): Promise<WaterResourceActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  try {
    const reservoir = normalizeWaterReservoirDraft(input.reservoir);
    await saveWaterReservoirForUser(
      context.value.ownerUserId,
      context.value.ownerUserId,
      cleanId(input.reservoirId),
      reservoir,
      new Date().toISOString(),
    );
    return dashboardResult(context.value, input, input.reservoirId ? 'La réserve a été modifiée.' : 'La réserve a été créée.');
  } catch (error) {
    return failure(error);
  }
}

export async function correctWaterReservoirVolumeAction(input: ProjectionInput & {
  reservoirId: string;
  volumeCubicMeters: number;
  observedAt: string;
  reason: string;
}): Promise<WaterResourceActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  try {
    const observed = new Date(input.observedAt);
    if (!Number.isFinite(observed.getTime()) || observed.getTime() > Date.now() + millisecondsFromMinutes(1)) {
      throw new Error('La date et l’heure de la mesure sont invalides.');
    }
    const reason = input.reason.trim().slice(0, 500) || null;
    await correctWaterReservoirVolumeForUser(
      context.value.ownerUserId,
      context.value.ownerUserId,
      input.reservoirId,
      input.volumeCubicMeters,
      observed.toISOString(),
      reason,
    );
    // Un niveau observé est la nouvelle référence de la réserve : le plan se recalcule (3.7, règle 4).
    await recalculatePlanAfterEvent(context.value.ownerUserId, { kind: 'reservoir-level-observed', season: input.season, at: observed, lasting: true });
    return dashboardResult(context.value, input, 'Le volume observé a été enregistré et ajouté à l’historique.');
  } catch (error) {
    return failure(error);
  }
}

export async function saveResourceReservoirLinkAction(input: ProjectionInput & {
  link: Omit<ResourceReservoirLink, 'id'> & { id?: string };
}): Promise<WaterResourceActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  try {
    if (!['automatic', 'manual'].includes(input.link.fillMode)) throw new Error('Le mode de remplissage est invalide.');
    await saveResourceReservoirLinkForUser(context.value.ownerUserId, context.value.ownerUserId, input.link);
    return dashboardResult(context.value, input, 'La liaison entre la ressource et la réserve a été enregistrée.');
  } catch (error) {
    return failure(error);
  }
}

export async function saveReservoirLinkAction(input: ProjectionInput & {
  link: Omit<ReservoirLink, 'id'> & { id?: string };
}): Promise<WaterResourceActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  try {
    if (!['automatic', 'manual'].includes(input.link.transferMode)) throw new Error('Le mode de transfert est invalide.');
    await saveReservoirLinkForUser(context.value.ownerUserId, context.value.ownerUserId, input.link);
    return dashboardResult(context.value, input, 'La connexion entre les réserves a été enregistrée. Son débit sera caractérisé en 3.2.');
  } catch (error) {
    return failure(error);
  }
}

export async function saveDefaultWaterSupplyAction(input: ProjectionInput & {
  supply: IrrigationSupplyDefault | null;
}): Promise<WaterResourceActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  try {
    await saveDefaultWaterSupplyForUser(context.value.ownerUserId, context.value.ownerUserId, input.supply);
    return dashboardResult(context.value, input, input.supply ? 'L’alimentation d’irrigation par défaut a été enregistrée.' : 'L’alimentation par défaut a été retirée.');
  } catch (error) {
    return failure(error);
  }
}

type Context = { ownerUserId: string; season: number; snapshot: Awaited<ReturnType<typeof getIrrigationSnapshot>> };

async function loadContext(season: number): Promise<{ ok: true; value: Context } | { ok: false; message: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(season) || season < 1900 || season > 9999) return { ok: false, message: 'Saison invalide.' };
  try {
    return { ok: true, value: { ownerUserId: user.userId, season, snapshot: await getIrrigationSnapshot(user.userId, { season }) } };
  } catch (error) {
    return failure(error);
  }
}

async function dashboardResult(context: Context, input: ProjectionInput, message: string): Promise<WaterResourceActionResult> {
  try {
    return {
      ok: true,
      message,
      dashboard: await getWaterResourceDashboardForUser({
        ownerUserId: context.ownerUserId,
        season: context.season,
        snapshot: context.snapshot,
        horizon: input.horizon,
        customEndsAt: input.customEndsAt ?? null,
      }),
    };
  } catch (error) {
    return failure(error);
  }
}

function cleanId(value: string | null) {
  return value?.trim() || null;
}

function failure(error: unknown): { ok: false; message: string } {
  return { ok: false, message: error instanceof Error ? error.message : 'L’opération a échoué.' };
}

/**
 * Relevés du compteur d'une ressource (`docs/resource-flow-contract.md`).
 *
 * Ces actions renvoient le tableau de bord complet comme les autres : appliquer
 * un débit change la référence de la ressource, donc les projections. Les
 * rafraîchir n'est pas un luxe, c'est la condition pour que l'écran ne mente
 * pas.
 *
 * Un relevé est une lecture, et une lecture fautive se corrige : l'action
 * d'enregistrement corrige celui que `readingId` désigne, ou en crée un quand
 * il est nul. La décision de débit qu'un relevé a pu servir à prendre, elle, ne
 * se réécrit pas.
 */
export async function saveResourceMeterReadingAction(input: ProjectionInput & {
  resourceId: string;
  readingId: string | null;
  takenAt: string;
  meterIndexCubicMeters: number;
  stoppedHours: number;
  stoppedMinutes: number;
  meterReplaced: boolean;
  note: string | null;
}): Promise<WaterResourceActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  try {
    await saveResourceMeterReadingForUser(
      context.value.ownerUserId,
      context.value.ownerUserId,
      input.resourceId,
      {
        takenAt: readingInstant(input.takenAt),
        meterIndexCubicMeters: input.meterIndexCubicMeters,
        stoppedSeconds: stoppedSeconds(input.stoppedHours, input.stoppedMinutes),
        meterReplaced: input.meterReplaced,
        note: readingNote(input.note),
      },
      input.readingId,
    );
    return dashboardResult(
      context.value,
      input,
      input.readingId ? 'Le relevé a été corrigé.' : 'Le relevé a été enregistré.',
    );
  } catch (error) {
    return readingFailure(error);
  }
}

export async function deleteResourceMeterReadingAction(input: ProjectionInput & {
  readingId: string;
}): Promise<WaterResourceActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  try {
    await deleteResourceMeterReadingForUser(context.value.ownerUserId, input.readingId);
    return dashboardResult(context.value, input, 'Le relevé a été supprimé.');
  } catch (error) {
    return readingFailure(error);
  }
}

/**
 * Le débit appliqué n'est jamais celui que le navigateur envoie : il est
 * recalculé ici à partir des deux relevés désignés. Ce qui vient du navigateur
 * ne dit que sur quels relevés porter la décision.
 */
export async function applyResourceFlowAction(input: ProjectionInput & {
  resourceId: string;
  fromReadingId: string;
  toReadingId: string;
}): Promise<WaterResourceActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  try {
    const history = await getResourceFlowHistoryForUser(context.value.ownerUserId);
    const measurement = history[input.resourceId]?.measurements.find(
      (item) => item.fromReadingId === input.fromReadingId && item.toReadingId === input.toReadingId,
    );
    if (!measurement) {
      return { ok: false, message: 'Cette mesure n’existe plus : les relevés ont changé depuis l’affichage.' };
    }
    if (measurement.runningFlowCubicMetersPerHour === null) {
      return { ok: false, message: 'Cette mesure n’a pas de débit en fonctionnement : la pompe n’a pas tourné.' };
    }
    await applyResourceFlowForUser(context.value.ownerUserId, context.value.ownerUserId, {
      resourceId: input.resourceId,
      flowCubicMetersPerHour: measurement.runningFlowCubicMetersPerHour,
      fromReadingId: input.fromReadingId,
      toReadingId: input.toReadingId,
      referenceNote: null,
    });
    // Un débit appliqué change les apports projetés : le plan se recalcule (3.7, règle 4).
    await recalculatePlanAfterEvent(context.value.ownerUserId, { kind: 'resource-flow-applied', season: input.season, at: new Date(), lasting: true });
    return dashboardResult(context.value, input, 'Le débit de la ressource a été mis à jour.');
  } catch (error) {
    return readingFailure(error);
  }
}

function readingFailure(error: unknown): { ok: false; message: string } {
  if (error instanceof ResourceMeterReadingError) {
    return { ok: false, message: READING_REJECTION_MESSAGES[error.rejection] };
  }
  return failure(error);
}

const READING_REJECTION_MESSAGES: Record<MeterReadingRejection, string> = {
  invalid_date: 'La date et l’heure du relevé sont invalides.',
  future_date: 'Un relevé ne peut pas être daté dans le futur.',
  invalid_index: 'L’index du compteur doit être un nombre.',
  negative_index: 'L’index du compteur ne peut pas être négatif.',
  invalid_stopped: 'La durée d’arrêt doit être un nombre.',
  negative_stopped: 'La durée d’arrêt ne peut pas être négative.',
  duplicate_instant: 'Un relevé existe déjà à cette date et cette heure pour cette ressource.',
  index_went_backwards: 'L’index saisi est inférieur au précédent. Si le compteur a été remplacé ou remis à zéro, cochez la case prévue.',
  stopped_exceeds_elapsed: 'La durée d’arrêt dépasse le temps écoulé depuis le relevé voisin. Corrigez-la, ou corrigez celle du relevé suivant.',
  production_without_running_time: 'Un volume a été produit alors que la pompe n’aurait pas tourné du tout.',
};

function stoppedSeconds(hours: number, minutes: number): number {
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  return secondsFromMilliseconds(millisecondsFromHours(safeHours) + millisecondsFromMinutes(safeMinutes));
}

/**
 * La date et l'heure saisies au forage sont une heure d'horloge à la ferme
 * (D-004). Les lire avec `new Date()` les plaçait dans le fuseau du Worker,
 * c'est-à-dire en UTC : un relevé fait à 18 h était enregistré à 20 h, et tout
 * relevé de moins de deux heures était refusé comme daté dans le futur.
 * Une saisie illisible est laissée telle quelle : le domaine la refuse.
 */
function readingInstant(value: string): string {
  return instantFromIrrigationDateTimeInput(value) ?? value;
}

function readingNote(value: string | null): string | null {
  const trimmed = (value ?? '').trim().slice(0, 500);
  return trimmed.length > 0 ? trimmed : null;
}
