'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { findIrrigationWorkspaceIdForUser } from '@/db/irrigation-event/read';
import {
  irrigationPushPersonKey,
  irrigationPushRegistrationIntent,
  normalizePushEndpoint,
  validateIrrigationPushSubscription,
} from '@/lib/domain/irrigation-push-contract';
import {
  getIrrigationPushPublicKey,
  registerIrrigationPushSubscription,
  unregisterIrrigationPushSubscription,
} from '@/lib/services/irrigation-push-service';

export type IrrigationPushActionResult =
  | { ok: true; message: string; publicKey?: string }
  | { ok: false; message: string; reason?: 'other-person' };

export async function getIrrigationPushConfigurationAction(): Promise<IrrigationPushActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return expiredSession();
  const publicKey = getIrrigationPushPublicKey();
  if (!publicKey) {
    return {
      ok: false,
      message: 'Les notifications serveur ne sont pas encore configurées.',
    };
  }
  return {
    ok: true,
    message: 'Configuration disponible.',
    publicKey,
  };
}

/**
 * Inscrit cet appareil dans l'espace de la personne connectée
 * (docs/tranche-4-contract.md, F371 à F375). `intent` vient du navigateur :
 * `activate` pour le bouton « Activer », qui peut prendre l'appareil d'une
 * autre personne ; tout le reste n'est qu'un renouvellement, qui ne le prend
 * jamais. L'espace et l'empreinte de la personne viennent du serveur.
 */
export async function registerIrrigationPushSubscriptionAction(
  input: unknown,
  intent?: unknown,
): Promise<IrrigationPushActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return expiredSession();
  const subscription = validateIrrigationPushSubscription(input);
  if (!subscription) {
    return { ok: false, message: 'L’abonnement transmis par le navigateur est invalide.' };
  }
  const workspaceId = await findIrrigationWorkspaceIdForUser(user.userId);
  if (!workspaceId) {
    return { ok: false, message: 'Espace d’irrigation introuvable.' };
  }
  const result = await registerIrrigationPushSubscription({
    recipientKey: workspaceId,
    personKey: await irrigationPushPersonKey(user.userId),
    intent: irrigationPushRegistrationIntent(intent),
    subscription,
  });
  if (result.status === 'ok') {
    return {
      ok: true,
      message: 'Notifications activées sur cet appareil.',
    };
  }
  if (result.status === 'other-person') {
    // Rien ne dit à qui est l'appareil ni ce qu'il reçoit (F374).
    return {
      ok: false,
      reason: 'other-person',
      message: 'Les notifications ne sont pas encore activées pour vous sur cet appareil.',
    };
  }
  return {
    ok: false,
    message: result.status === 'disabled'
      ? 'Les notifications serveur ne sont pas encore configurées.'
      : 'L’appareil n’a pas pu être enregistré auprès du service de notification.',
  };
}

export async function unregisterIrrigationPushSubscriptionAction(
  endpoint: string,
): Promise<IrrigationPushActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return expiredSession();
  const normalizedEndpoint = normalizePushEndpoint(endpoint);
  if (!normalizedEndpoint) {
    return { ok: false, message: 'L’abonnement de cet appareil est invalide.' };
  }
  const workspaceId = await findIrrigationWorkspaceIdForUser(user.userId);
  if (!workspaceId) {
    return { ok: false, message: 'Espace d’irrigation introuvable.' };
  }
  const result = await unregisterIrrigationPushSubscription(
    workspaceId,
    normalizedEndpoint,
  );
  if (result.status === 'failed') {
    return {
      ok: false,
      message: 'L’abonnement distant n’a pas pu être supprimé.',
    };
  }
  return {
    ok: true,
    message: 'Notifications désactivées sur cet appareil.',
  };
}

function expiredSession(): IrrigationPushActionResult {
  return { ok: false, message: 'Votre session a expiré.' };
}
