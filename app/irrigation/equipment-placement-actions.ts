'use server';

import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { PlacementPose } from '@/lib/domain/equipment-placement-periods';
import { getAuthenticatedUser } from '@/app/access-auth';
import {
  EquipmentPlacementChangedError,
  EquipmentPlacementDateError,
  EquipmentPlacementGroupError,
  EquipmentPlacementKindError,
  removeEquipmentPlacementForUser,
  saveEquipmentPlacementForUser,
  updateEquipmentPlacementSettingForUser,
} from '@/db/equipment-placement-repository';
import {
  listEquipmentPoseHistoryForUser,
  listEquipmentPosesForUser,
  type ClosedPlacementPose,
} from '@/db/equipment-placement-poses';
import {
  validateEquipmentPlacementInput,
  type EquipmentPlacementInput,
} from '@/lib/domain/equipment-placement-domain';
import { recalculatePlanAfterEvent } from '@/lib/services/planning-recalculation';

export type EquipmentPlacementActionResult =
  | { ok: true; message: string; placement: EquipmentPlacementRecord }
  | { ok: false; message: string };

/**
 * Pose, repose ou déplace un matériel à la date `at`, instant ISO choisi à
 * l'écran, maintenant par défaut (2.11, règles 2 à 4). Au même endroit, la
 * pose garde sa date et `at` ne sert pas.
 */
export async function saveEquipmentPlacementAction(
  input: EquipmentPlacementInput,
  at: string | null = null,
): Promise<EquipmentPlacementActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };

  const validation = validateEquipmentPlacementInput(input);
  if (!validation.value) {
    return { ok: false, message: validation.errors[0] };
  }

  const placedAt = poseInstant(at);
  if (!placedAt) return { ok: false, message: 'La date de pose n’est pas valide.' };

  try {
    const placement = await saveEquipmentPlacementForUser(
      user.userId,
      validation.value,
      placedAt,
    );
    if (!placement) {
      return {
        ok: false,
        message: 'Ce matériel ou ce réglage est introuvable.',
      };
    }
    // Un matériel posé, reposé ou déplacé change la couverture : le plan se recalcule dès que la pose n'est pas à venir (3.7, règle 4).
    await recalculatePlanAfterEvent(user.userId, { kind: 'equipment-placed', season: validation.value.season, at: placedAt, lasting: true });

    return {
      ok: true,
      message: 'La position du matériel a été enregistrée.',
      placement,
    };
  } catch (error) {
    if (isPlacementRefusal(error)) return { ok: false, message: error.message };
    throw error;
  }
}

/**
 * Change le réglage appliqué sans passer par le plan
 * (`docs/equipment-setting-change-contract.md`). Sur la ferme, on ne déplace
 * pas une rampe pour changer sa buse.
 */
export async function changeEquipmentPlacementSettingAction(input: {
  equipmentId: string;
  season: number;
  settingId: string;
}): Promise<EquipmentPlacementActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!input.equipmentId || !input.settingId || !Number.isInteger(input.season)) {
    return { ok: false, message: 'Réglage invalide.' };
  }

  const placement = await updateEquipmentPlacementSettingForUser(
    user.userId,
    input.equipmentId,
    input.season,
    input.settingId,
  );
  if (!placement) {
    return {
      ok: false,
      message: 'Ce matériel, ce réglage ou cette position est introuvable.',
    };
  }
  await recalculatePlanAfterEvent(user.userId, { kind: 'equipment-setting-changed', season: input.season, at: new Date(), lasting: true });

  return {
    ok: true,
    message: 'Le réglage appliqué a été changé.',
    placement,
  };
}

/**
 * Retire un matériel et le stocke (2.11, règle 8) : la pose se ferme, rien ne
 * s'efface, même quand le matériel a déjà arrosé. Un refus dit pourquoi.
 */
export async function removeEquipmentPlacementAction(input: {
  equipmentId: string;
  season: number;
  /** La date du retrait, instant ISO choisi à l'écran ; maintenant par défaut (règles 2 à 5). */
  removedAt?: string | null;
}): Promise<
  | { ok: true; message: string; equipmentId: string }
  | { ok: false; message: string }
> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!input.equipmentId || !Number.isInteger(input.season)) {
    return { ok: false, message: 'Position invalide.' };
  }

  const removedAt = poseInstant(input.removedAt ?? null);
  if (!removedAt) return { ok: false, message: 'La date de retrait n’est pas valide.' };

  try {
    const result = await removeEquipmentPlacementForUser(
      user.userId,
      input.equipmentId,
      input.season,
      removedAt,
    );
    if (result === 'not_found') {
      return { ok: false, message: 'Aucune position enregistrée pour ce matériel.' };
    }
  } catch (error) {
    if (isPlacementRefusal(error)) return { ok: false, message: error.message };
    throw error;
  }
  // Un matériel retiré n'arrose plus : le plan se recalcule dès que le retrait n'est pas à venir (3.7, règle 4).
  await recalculatePlanAfterEvent(user.userId, { kind: 'equipment-removed', season: input.season, at: removedAt, lasting: true });

  return {
    ok: true,
    message: 'Le matériel a été retiré et stocké ; ses irrigations passées restent dans l’historique.',
    equipmentId: input.equipmentId,
  };
}

export type EquipmentPosesActionResult =
  | { ok: true; poses: PlacementPose[]; history: ClosedPlacementPose[] }
  | { ok: false; message: string };

/**
 * Les poses d'une saison, courantes — posées ou stockées — et fermées : ce que
 * les cartes du matériel affichent, relu après une pose ou un retrait.
 */
export async function loadEquipmentPosesAction(input: { season: number }): Promise<EquipmentPosesActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(input.season)) return { ok: false, message: 'Saison invalide.' };
  const [poses, history] = await Promise.all([
    listEquipmentPosesForUser(user.userId, input.season),
    listEquipmentPoseHistoryForUser(user.userId, input.season),
  ]);
  return { ok: true, poses, history };
}

/** Une date choisie à l'écran, ou maintenant ; `null` si elle ne se lit pas. */
function poseInstant(value: string | null): string | null {
  if (value === null || value === '') return new Date().toISOString();
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function isPlacementRefusal(error: unknown): error is Error {
  return error instanceof EquipmentPlacementKindError
    || error instanceof EquipmentPlacementGroupError
    || error instanceof EquipmentPlacementDateError
    || error instanceof EquipmentPlacementChangedError;
}
