'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { cancelErasureOfSpace, FarmFrozenError, requestErasureOfSpace } from '@/lib/services/farm-erasure-request';

/**
 * La demande d'effacement de sa ferme, par la personne (4.5, PR 3, troisième
 * partie ; docs/tranche-4-contract.md, F563, et 10 bis.22, F665 à F667) :
 * « Supprimer ma ferme et mes données », dans Réglages, et « Annuler la
 * demande », sur l'écran de l'espace figé. Le serveur relit tout : la session,
 * l'espace, le nom de la ferme ; jamais en démonstration.
 */

export type FarmErasureActionResult = { ok: boolean; message: string };

const EXPIRED: FarmErasureActionResult = { ok: false, message: 'Votre session a expiré : reconnectez-vous.' };

export async function requestFarmErasureAction(input: { typedName: string; season: number }): Promise<FarmErasureActionResult> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return EXPIRED;
    return await requestErasureOfSpace(user.userId, input);
  } catch (error) {
    // Une page ouverte avant la demande, dans un autre onglet : la demande est déjà là.
    if (error instanceof FarmFrozenError) return { ok: true, message: error.view.title };
    throw error;
  }
}

export async function cancelFarmErasureAction(): Promise<FarmErasureActionResult> {
  const user = await getAuthenticatedUser({ allowFrozen: true });
  if (!user) return EXPIRED;
  return cancelErasureOfSpace(user.userId);
}
