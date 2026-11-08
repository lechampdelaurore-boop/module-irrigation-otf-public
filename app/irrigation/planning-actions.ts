'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/app/access-auth';
import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { PlanningSettingsInvalidError, listPlanningSettingsHistoryForUser, savePlanningSettingsForUser } from '@/db/planning-repository';
import { keepPlanSuggestionForUser } from '@/db/planning-suggestions-repository';
import { startStopwatch } from '@/lib/adapters/stopwatch';
import type { PlanSuggestionKind, StoredWeeklyPlan } from '@/lib/domain/planning/contract';
import type { ProposalAdjustment } from '@/lib/domain/planning/presentation';
import type { PlanningSettings } from '@/lib/domain/planning/settings';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { recalculatePlanAfterEvent } from '@/lib/services/planning-recalculation';
import { computeWeeklyPlanForUser, readWeeklyPlanForUser } from '@/lib/services/planning-service';
import { refusePlanProposalForUser, validatePlanProposalForUser, type ProposalValidationResult } from '@/lib/services/planning-validation-service';
import { cancelPlannedIrrigationAction, updatePlannedIrrigationAction } from './irrigation-event-actions';

/**
 * Les actions du planning hebdomadaire (3.5 et 3.6, docs/planning-contract.md) :
 * calculer, lire, régler, valider une ou plusieurs propositions en
 * irrigations planifiées ordinaires — telles quelles ou ajustées —, refuser,
 * relire l'historique des réglages. Le propriétaire vient de la session,
 * jamais du formulaire ; la saison est vérifiée.
 */

export type WeeklyPlanActionResult =
  | { ok: true; plan: StoredWeeklyPlan | null }
  | { ok: false; message: string };

export type ProposalsActionResult =
  | { ok: true; results: ProposalValidationResult[]; plan: StoredWeeklyPlan | null }
  | { ok: false; message: string };

export type PlanningSettingsActionResult =
  | { ok: true; settings: PlanningSettings }
  | { ok: false; message: string; issues?: { path: string; message: string }[] };

export type PlanningSettingsHistoryActionResult =
  | { ok: true; history: { settings: PlanningSettings; createdAt: string }[] }
  | { ok: false; message: string };

const EXPIRED = { ok: false, message: 'Votre session a expiré.' } as const;
const INVALID_SEASON = { ok: false, message: 'La saison sélectionnée est invalide.' } as const;

function validSeason(season: number) {
  return Number.isInteger(season) && season >= 1900 && season <= 9999;
}

export async function computeWeeklyPlanAction(input: { season: number }): Promise<WeeklyPlanActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  if (!validSeason(input.season)) return INVALID_SEASON;
  try {
    // La lecture de l'instantané est mesurée ici, avec le chronomètre que le service poursuit (point ouvert 34).
    const stopwatch = startStopwatch();
    const snapshot = await getIrrigationSnapshot(user.userId, { season: input.season });
    stopwatch.lap('snapshot');
    const plan = await computeWeeklyPlanForUser({ ownerUserId: user.userId, season: input.season, snapshot, trigger: 'manual', actorUserId: user.userId, stopwatch });
    revalidatePath('/irrigation');
    return { ok: true, plan };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Le planning est momentanément indisponible.' };
  }
}

export async function loadWeeklyPlanAction(input: { season: number }): Promise<WeeklyPlanActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  if (!validSeason(input.season)) return INVALID_SEASON;
  try {
    return { ok: true, plan: await readWeeklyPlanForUser({ ownerUserId: user.userId, season: input.season }) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Le planning est momentanément indisponible.' };
  }
}

export async function savePlanningSettingsAction(input: { settings: unknown }): Promise<PlanningSettingsActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  try {
    const settings = await savePlanningSettingsForUser(user.userId, user.userId, input.settings);
    revalidatePath('/irrigation');
    return { ok: true, settings };
  } catch (error) {
    if (error instanceof PlanningSettingsInvalidError) return { ok: false, message: error.message, issues: error.issues };
    return { ok: false, message: error instanceof Error ? error.message : 'Les réglages n’ont pas pu être enregistrés.' };
  }
}

/** Les réglages enregistrés précédemment, du plus récent au plus ancien, sans nommer personne. */
export async function loadPlanningSettingsHistoryAction(): Promise<PlanningSettingsHistoryActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  try {
    const history = await listPlanningSettingsHistoryForUser(user.userId);
    return { ok: true, history: history.map((entry) => ({ settings: entry.settings, createdAt: entry.createdAt })) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'L’historique des réglages est momentanément indisponible.' };
  }
}

/**
 * Valide une proposition avec un début et une dose choisis par le maraîcher
 * (« Interface (3.6) », Ajuster) : mêmes gardes que la validation, la durée
 * suivant la dose.
 */
export async function validateAdjustedPlanProposalAction(input: { season: number; proposalId: string; startAt: string; doseMm: number }): Promise<ProposalsActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  if (!validSeason(input.season)) return INVALID_SEASON;
  if (typeof input.proposalId !== 'string' || !input.proposalId.trim()) return { ok: false, message: 'Choisissez une proposition.' };
  const adjustment: ProposalAdjustment = { startAt: String(input.startAt), doseMm: Number(input.doseMm) };
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season: input.season });
    const result = await validatePlanProposalForUser({ ownerUserId: user.userId, season: input.season, snapshot, proposalId: input.proposalId, actorUserId: user.userId, adjustment });
    // Une proposition validée est une irrigation planifiée de plus : le plan se recalcule autour (3.7, règle 4).
    if (result.ok) await recalculatePlanAfterEvent(user.userId, { kind: 'proposal-validated', season: input.season, at: new Date() });
    revalidatePath('/irrigation');
    return { ok: true, results: [result], plan: await readWeeklyPlanForUser({ ownerUserId: user.userId, season: input.season }) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'La validation a échoué.' };
  }
}

/**
 * Valide une, plusieurs ou toutes les propositions d'un jour ou de la semaine
 * (D-024, point 10) : une par une, dans l'ordre donné, chacune avec sa
 * réponse ; un refus n'arrête pas les suivantes.
 */
export async function validatePlanProposalsAction(input: { season: number; proposalIds: string[] }): Promise<ProposalsActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  if (!validSeason(input.season)) return INVALID_SEASON;
  if (!Array.isArray(input.proposalIds) || input.proposalIds.length === 0 || input.proposalIds.length > 200) {
    return { ok: false, message: 'Choisissez au moins une proposition.' };
  }
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season: input.season });
    const results: ProposalValidationResult[] = [];
    for (const proposalId of input.proposalIds) {
      if (typeof proposalId !== 'string' || !proposalId.trim()) continue;
      results.push(await validatePlanProposalForUser({ ownerUserId: user.userId, season: input.season, snapshot, proposalId, actorUserId: user.userId }));
    }
    // Un seul recalcul pour le lot (3.7, règle 4) : le moteur lit toutes les irrigations planifiées d'un coup.
    if (results.some((result) => result.ok)) await recalculatePlanAfterEvent(user.userId, { kind: 'proposal-validated', season: input.season, at: new Date() });
    revalidatePath('/irrigation');
    return { ok: true, results, plan: await readWeeklyPlanForUser({ ownerUserId: user.userId, season: input.season }) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'La validation a échoué.' };
  }
}

export type RefusalActionResult =
  | { ok: true; refused: boolean; plan: StoredWeeklyPlan | null }
  | { ok: false; message: string };

export async function refusePlanProposalAction(input: { season: number; proposalId: string }): Promise<RefusalActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  if (!validSeason(input.season)) return INVALID_SEASON;
  try {
    const refused = await refusePlanProposalForUser({ ownerUserId: user.userId, proposalId: String(input.proposalId), actorUserId: user.userId });
    // Un refus est un événement (D-030) : le calcul qui le suit place le besoin ailleurs.
    if (refused) await recalculatePlanAfterEvent(user.userId, { kind: 'proposal-refused', season: input.season, at: new Date() });
    revalidatePath('/irrigation');
    return { ok: true, refused, plan: await readWeeklyPlanForUser({ ownerUserId: user.userId, season: input.season }) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Le refus a échoué.' };
  }
}

export type SuggestionActionResult =
  | { ok: true; message: string; warning?: string; plan: StoredWeeklyPlan | null }
  | { ok: false; message: string };

const SUGGESTION_KINDS: readonly PlanSuggestionKind[] = ['cancel', 'reduce'];

/**
 * « Garder » une suggestion (3.7, règle 17) : elle se tait, avec sa dose,
 * jusqu'à ce qu'un calcul en fasse une autre. Ce n'est pas un événement :
 * rien ne se recalcule ; le plan est relu pour marquer la suggestion gardée.
 */
export async function keepPlanSuggestionAction(input: { season: number; eventEquipmentId: string; suggestion: PlanSuggestionKind; doseMm: number | null }): Promise<SuggestionActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  if (!validSeason(input.season)) return INVALID_SEASON;
  if (!SUGGESTION_KINDS.includes(input.suggestion)) return { ok: false, message: 'Suggestion inconnue.' };
  try {
    const outcome = await keepPlanSuggestionForUser(user.userId, {
      eventEquipmentId: String(input.eventEquipmentId),
      suggestion: input.suggestion,
      doseMm: input.doseMm === null || input.doseMm === undefined ? null : Number(input.doseMm),
      actorUserId: user.userId,
    });
    if (outcome === 'not-found') return { ok: false, message: 'Cette irrigation planifiée est introuvable.' };
    revalidatePath('/irrigation');
    return {
      ok: true,
      message: outcome === 'kept' ? 'Suggestion gardée : elle se taira tant qu’un calcul n’en fait pas une autre.' : 'Cette suggestion était déjà gardée.',
      plan: await readWeeklyPlanForUser({ ownerUserId: user.userId, season: input.season }),
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'La suggestion n’a pas pu être gardée.' };
  }
}

/**
 * « Appliquer » une suggestion (3.7, règle 17) : par le circuit existant —
 * l'annulation ou la modification ordinaire de l'irrigation planifiée —, qui
 * fait l'événement et le recalcul. La suggestion est relue dans le dernier
 * plan : si elle n'y est plus, rien n'est fait.
 */
export async function applyPlanSuggestionAction(input: { season: number; eventEquipmentId: string }): Promise<SuggestionActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  if (!validSeason(input.season)) return INVALID_SEASON;
  try {
    const plan = await readWeeklyPlanForUser({ ownerUserId: user.userId, season: input.season });
    const suggestion = plan?.suggestions.find((candidate) => candidate.eventEquipmentId === input.eventEquipmentId && !candidate.kept);
    if (!suggestion) return { ok: false, message: 'Cette suggestion n’est plus dans le dernier plan : recalculez, puis relisez.' };
    const reread = () => readWeeklyPlanForUser({ ownerUserId: user.userId, season: input.season });
    if (suggestion.suggestion === 'cancel') {
      const result = await cancelPlannedIrrigationAction(suggestion.eventEquipmentId);
      return result.ok ? { ok: true, message: 'Suggestion appliquée : l’irrigation planifiée est annulée.', warning: result.warning, plan: await reread() } : result;
    }
    const event = (await listIrrigationEventsForUser(user.userId, input.season)).find((candidate) => candidate.equipment.id === suggestion.eventEquipmentId);
    if (!event || event.status !== 'planned' || !event.equipment.plannedStartAt || suggestion.durationSeconds === null) {
      return { ok: false, message: 'Cette irrigation planifiée est introuvable ou a changé.' };
    }
    const durationMinutes = Math.max(1, Math.round(suggestion.durationSeconds / 60));
    const result = await updatePlannedIrrigationAction({
      eventEquipmentId: event.equipment.id,
      kind: 'planned',
      season: input.season,
      equipmentId: event.equipment.equipmentId,
      settingId: event.equipment.settingId,
      preparationMode: 'duration',
      durationMinutes,
      plannedStartAt: event.equipment.plannedStartAt,
      note: event.note,
      pumpId: event.equipment.pumpId,
      pumpOriginId: event.equipment.pumpOriginId,
    });
    return result.ok
      ? { ok: true, message: `Suggestion appliquée : l’irrigation est réduite à ${durationMinutes} min, soit ${suggestionDose(suggestion.doseMm)}.`, warning: result.warning, plan: await reread() }
      : result;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'La suggestion n’a pas pu être appliquée.' };
  }
}

const doseFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
function suggestionDose(doseMm: number | null): string {
  return doseMm === null ? 'la dose utile' : `${doseFormat.format(doseMm)} mm de référence`;
}
