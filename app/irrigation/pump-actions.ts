'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/app/access-auth';
import {
  saveEquipmentDefaultPumpForUser,
  savePumpForUser,
  setPumpArchivedForUser,
} from '@/db/pump-repository';
import { getPumpDashboardForUser } from '@/lib/services/pump-dashboard';
import type { PumpDraft } from '@/lib/domain/pumps';

export type PumpActionResult =
  | { ok: true; message: string; dashboard: Awaited<ReturnType<typeof getPumpDashboardForUser>> }
  | { ok: false; message: string };

export async function savePumpAction(input: { pumpId: string | null; pump: PumpDraft }): Promise<PumpActionResult> {
  return mutate(async (userId) => {
    await savePumpForUser(userId, userId, input.pumpId, input.pump);
    return input.pumpId ? 'La pompe a été modifiée.' : 'La pompe a été créée.';
  });
}

export async function setPumpArchivedAction(input: { pumpId: string; archived: boolean }): Promise<PumpActionResult> {
  return mutate(async (userId) => {
    await setPumpArchivedForUser(userId, userId, input.pumpId, input.archived);
    return input.archived ? 'La pompe a été archivée.' : 'La pompe a été réactivée.';
  });
}

export async function saveEquipmentDefaultPumpAction(input: { equipmentId: string; pumpId: string | null }): Promise<PumpActionResult> {
  return mutate(async (userId) => {
    await saveEquipmentDefaultPumpForUser(userId, userId, input.equipmentId, input.pumpId);
    return 'La pompe habituelle du matériel a été enregistrée.';
  });
}

async function mutate(work: (userId: string) => Promise<string>): Promise<PumpActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  try {
    const message = await work(user.userId);
    revalidatePath('/irrigation');
    return { ok: true, message, dashboard: await getPumpDashboardForUser(user.userId) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Une erreur est survenue.' };
  }
}
