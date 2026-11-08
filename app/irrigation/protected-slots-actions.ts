'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/app/access-auth';
import {
  ProtectedSlotInvalidError,
  ProtectedSlotNotFoundError,
  createProtectedSlotForUser,
  deleteProtectedSlotForUser,
  listProtectedSlotHistoryForUser,
  listProtectedSlotsForUser,
  updateProtectedSlotForUser,
} from '@/db/protected-slots-repository';
import type { ProtectedSlot, ProtectedSlotDraft, ProtectedSlotVersion } from '@/lib/domain/planning/protected-slots';
import { PROTECTED_SLOT_REFUSED } from '@/lib/domain/planning/protected-slots-view';

/**
 * Les actions des créneaux protégés (docs/protected-slots-contract.md,
 * règles 7 et 8) : créer, modifier, supprimer, relire le journal. Le
 * propriétaire vient de la session, jamais du formulaire ; le dépôt vérifie
 * la saisie avant d'écrire. Comme tout réglage du planning, un créneau vaut
 * au prochain calcul : aucune action ne recalcule le plan d'elle-même.
 */

export type ProtectedSlotsActionResult =
  | { ok: true; slots: ProtectedSlot[] }
  | { ok: false; message: string; errors?: string[] };

/** Une version du journal, sans nommer personne. */
export type ProtectedSlotHistoryEntry = Omit<ProtectedSlotVersion, 'actorUserId'>;

export type ProtectedSlotHistoryActionResult =
  | { ok: true; history: ProtectedSlotHistoryEntry[] }
  | { ok: false; message: string };

const EXPIRED = { ok: false, message: 'Votre session a expiré.' } as const;

export async function saveProtectedSlotAction(input: { slotId?: string | null; draft: unknown }): Promise<ProtectedSlotsActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  const draft = draftFrom(input.draft);
  try {
    if (typeof input.slotId === 'string' && input.slotId) await updateProtectedSlotForUser(user.userId, user.userId, input.slotId, draft);
    else await createProtectedSlotForUser(user.userId, user.userId, draft);
    revalidatePath('/irrigation');
    return { ok: true, slots: await listProtectedSlotsForUser(user.userId) };
  } catch (error) {
    return failure(error, 'Le créneau protégé n’a pas pu être enregistré.');
  }
}

export async function deleteProtectedSlotAction(input: { slotId: string }): Promise<ProtectedSlotsActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  if (typeof input.slotId !== 'string' || !input.slotId) return { ok: false, message: 'Choisissez un créneau protégé.' };
  try {
    await deleteProtectedSlotForUser(user.userId, user.userId, input.slotId);
    revalidatePath('/irrigation');
    return { ok: true, slots: await listProtectedSlotsForUser(user.userId) };
  } catch (error) {
    return failure(error, 'Le créneau protégé n’a pas pu être supprimé.');
  }
}

/** Le journal des créneaux, du plus récent au plus ancien, sans nommer personne. */
export async function loadProtectedSlotHistoryAction(): Promise<ProtectedSlotHistoryActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return EXPIRED;
  try {
    const history = await listProtectedSlotHistoryForUser(user.userId);
    // Une liste blanche : ce qui n'y est pas, l'auteur du geste en premier, ne quitte pas le serveur.
    return { ok: true, history: history.map((entry) => ({ id: entry.id, name: entry.name, weekdays: entry.weekdays, startMinute: entry.startMinute, endMinute: entry.endMinute, change: entry.change, createdAt: entry.createdAt })) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'L’historique des créneaux protégés est momentanément indisponible.' };
  }
}

/** Ce que le formulaire envoie, sans rien deviner : un champ absent ou illisible arrive tel quel à la vérification, qui le refuse. */
function draftFrom(input: unknown): ProtectedSlotDraft {
  const value = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  return {
    name: typeof value.name === 'string' ? value.name : '',
    weekdays: Array.isArray(value.weekdays) ? value.weekdays.map(String) : [],
    startMinute: typeof value.startMinute === 'number' ? value.startMinute : Number.NaN,
    endMinute: typeof value.endMinute === 'number' ? value.endMinute : Number.NaN,
  };
}

function failure(error: unknown, fallback: string): ProtectedSlotsActionResult {
  if (error instanceof ProtectedSlotInvalidError) return { ok: false, message: PROTECTED_SLOT_REFUSED, errors: error.errors };
  if (error instanceof ProtectedSlotNotFoundError) return { ok: false, message: error.message };
  return { ok: false, message: error instanceof Error ? error.message : fallback };
}
