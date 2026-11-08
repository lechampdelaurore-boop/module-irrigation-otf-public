'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/app/access-auth';
import {
  deleteGardenGroupForUser,
  GardenAlreadyGroupedError,
  GardenGroupNameAlreadyExistsError,
  saveGardenGroupForUser,
} from '@/db/garden-group-repository';
import {
  validateGardenGroupInput,
  type GardenGroupInput,
} from '@/lib/domain/garden-group-domain';

export type GardenGroupActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveGardenGroupAction(input: {
  id: string | null;
  group: GardenGroupInput;
}): Promise<GardenGroupActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };

  const validation = validateGardenGroupInput(input.group);
  if (!validation.value) {
    return { ok: false, message: validation.errors[0] };
  }

  try {
    const savedId = await saveGardenGroupForUser(
      user.userId,
      input.id,
      validation.value,
    );
    if (!savedId) {
      return { ok: false, message: 'Ce groupe de jardins est introuvable.' };
    }

    revalidatePath('/irrigation');
    return {
      ok: true,
      message: input.id ? 'Le groupe a été modifié.' : 'Le groupe a été créé.',
    };
  } catch (error) {
    if (
      error instanceof GardenGroupNameAlreadyExistsError ||
      error instanceof GardenAlreadyGroupedError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteGardenGroupAction(input: {
  id: string;
  season: number;
}): Promise<GardenGroupActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (
    !input.id ||
    !Number.isInteger(input.season) ||
    input.season < 1900 ||
    input.season > 9999
  ) {
    return { ok: false, message: 'Groupe invalide.' };
  }

  const deleted = await deleteGardenGroupForUser(
    user.userId,
    input.season,
    input.id,
  );
  if (!deleted) {
    return { ok: false, message: 'Ce groupe est introuvable.' };
  }

  revalidatePath('/irrigation');
  return { ok: true, message: 'Le groupe a été supprimé.' };
}
