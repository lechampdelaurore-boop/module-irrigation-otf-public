'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/app/access-auth';
import { duplicateEquipmentForUser } from '@/db/equipment/duplication';
import {
  createEquipmentForUser,
  deleteEquipmentForUser,
  setEquipmentArchivedForUser,
  updateEquipmentForUser,
} from '@/db/equipment/equipment';
import {
  EquipmentDuplicateKindMismatchError,
  EquipmentKindLockedBySettingsError,
  EquipmentNameAlreadyExistsError,
  EquipmentSettingKindMismatchError,
  EquipmentSettingNameAlreadyExistsError,
  EquipmentSettingsLimitError,
} from '@/db/equipment/errors';
import { deleteEquipmentSettingForUser, saveEquipmentSettingForUser } from '@/db/equipment/settings';
import {
  validateEquipmentDraft,
  validateEquipmentSettingInput,
  type EquipmentDraftInput,
  type EquipmentSettingInput,
} from '@/lib/domain/irrigation-domain';
import type { SubmittedProvenance } from '@/lib/domain/irrigation-calculator/provenance';
import { getEnabledFeaturesForUser } from '@/lib/services/feature-selection-service';

export type EquipmentActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveEquipmentAction(input: {
  id: string | null;
  duplicateFromId?: string | null;
  equipment: EquipmentDraftInput;
}): Promise<EquipmentActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };

  const validation = validateEquipmentDraft(input.equipment);
  if (!validation.value) {
    return { ok: false, message: validation.errors[0] };
  }
  if (input.id && input.duplicateFromId) {
    return { ok: false, message: 'Demande de duplication invalide.' };
  }

  try {
    if (input.id) {
      const updated = await updateEquipmentForUser(
        user.userId,
        input.id,
        validation.value,
      );
      if (!updated) {
        return {
          ok: false,
          message: 'Ce matériel est introuvable ou déjà archivé.',
        };
      }
      revalidatePath('/irrigation');
      return { ok: true, message: 'Le matériel a été modifié.' };
    }

    if (input.duplicateFromId) {
      const duplicated = await duplicateEquipmentForUser(
        user.userId,
        input.duplicateFromId,
        validation.value,
      );
      if (!duplicated) {
        return {
          ok: false,
          message: 'Le matériel à dupliquer est introuvable.',
        };
      }
      revalidatePath('/irrigation');
      return {
        ok: true,
        message: duplicated.settingsCount === 0
          ? 'Le matériel a été dupliqué.'
          : `Le matériel et ses ${duplicated.settingsCount} réglage${duplicated.settingsCount > 1 ? 's' : ''} ont été dupliqués.`,
      };
    }

    await createEquipmentForUser(user.userId, validation.value);
    revalidatePath('/irrigation');
    return { ok: true, message: 'Le matériel a été ajouté.' };
  } catch (error) {
    if (
      error instanceof EquipmentNameAlreadyExistsError ||
      error instanceof EquipmentKindLockedBySettingsError ||
      error instanceof EquipmentDuplicateKindMismatchError ||
      error instanceof EquipmentSettingsLimitError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function saveEquipmentSettingAction(input: {
  id: string | null;
  equipmentId: string;
  setting: EquipmentSettingInput;
  /** Ce que le calculateur dit de la provenance (3.8 bis) ; absent quand il n'est pas coché. */
  provenance?: SubmittedProvenance;
}): Promise<EquipmentActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!input.equipmentId) {
    return { ok: false, message: 'Matériel invalide.' };
  }
  // Calculateur décoché : ni pris en compte, ni effacé (docs/feature-selection-contract.md, R1).
  const calculatorEnabled = input.provenance !== undefined && (await getEnabledFeaturesForUser(user.userId)).includes('calculateur');
  const provenance: SubmittedProvenance = calculatorEnabled && input.provenance
    ? { calculation: input.provenance.calculation ?? null, measured: input.provenance.measured === true }
    : { calculation: null, measured: null };

  const validation = validateEquipmentSettingInput(input.setting);
  if (!validation.value) {
    return { ok: false, message: validation.errors[0] };
  }

  try {
    const savedId = await saveEquipmentSettingForUser(
      user.userId,
      input.equipmentId,
      input.id,
      validation.value,
      provenance,
    );
    if (!savedId) {
      return {
        ok: false,
        message: 'Ce matériel ou ce réglage est introuvable.',
      };
    }

    revalidatePath('/irrigation');
    return {
      ok: true,
      message: input.id ? 'Le réglage a été modifié.' : 'Le réglage a été ajouté.',
    };
  } catch (error) {
    if (
      error instanceof EquipmentSettingNameAlreadyExistsError ||
      error instanceof EquipmentSettingsLimitError ||
      error instanceof EquipmentSettingKindMismatchError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteEquipmentSettingAction(input: {
  equipmentId: string;
  settingId: string;
}): Promise<EquipmentActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!input.equipmentId || !input.settingId) {
    return { ok: false, message: 'Réglage invalide.' };
  }

  const result = await deleteEquipmentSettingForUser(
    user.userId,
    input.equipmentId,
    input.settingId,
  );
  if (result === 'has_history') {
    return {
      ok: false,
      message:
        'Ce réglage a déjà servi à une irrigation et doit être conservé dans l’historique.',
    };
  }
  if (result === 'not_found') {
    return { ok: false, message: 'Ce réglage est introuvable.' };
  }

  revalidatePath('/irrigation');
  return { ok: true, message: 'Le réglage a été supprimé.' };
}

export async function archiveEquipmentAction(
  equipmentId: string,
): Promise<EquipmentActionResult> {
  return setArchived(equipmentId, true);
}

export async function restoreEquipmentAction(
  equipmentId: string,
): Promise<EquipmentActionResult> {
  return setArchived(equipmentId, false);
}

export async function deleteEquipmentAction(
  equipmentId: string,
): Promise<EquipmentActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!equipmentId) return { ok: false, message: 'Matériel invalide.' };

  const result = await deleteEquipmentForUser(user.userId, equipmentId);
  if (result === 'has_history') {
    return {
      ok: false,
      message:
        'Ce matériel possède un historique d’irrigation. Il doit être archivé plutôt que supprimé.',
    };
  }
  if (result === 'not_found') {
    return { ok: false, message: 'Ce matériel est introuvable.' };
  }

  revalidatePath('/irrigation');
  return { ok: true, message: 'Le matériel a été supprimé définitivement.' };
}

async function setArchived(
  equipmentId: string,
  archived: boolean,
): Promise<EquipmentActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!equipmentId) return { ok: false, message: 'Matériel invalide.' };

  const updated = await setEquipmentArchivedForUser(
    user.userId,
    equipmentId,
    archived,
  );
  if (!updated) return { ok: false, message: 'Ce matériel est introuvable.' };

  revalidatePath('/irrigation');
  return {
    ok: true,
    message: archived
      ? 'Le matériel a été archivé.'
      : 'Le matériel est de nouveau actif.',
  };
}
