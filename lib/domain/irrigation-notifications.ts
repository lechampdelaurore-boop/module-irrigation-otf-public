export type IrrigationNotificationPermission =
  | NotificationPermission
  | 'unsupported';

export type IrrigationNotificationResult =
  | 'shown'
  | 'not-permitted'
  | 'unavailable'
  | 'failed';

export type IrrigationNotificationPayload = {
  eventEquipmentId: string;
  equipmentName: string;
  settingName: string;
  url: string;
};

type PersistentNotificationRegistration = {
  showNotification: (
    title: string,
    options?: NotificationOptions,
  ) => Promise<void>;
};

/**
 * Affiche exclusivement une notification persistante portée par un service
 * worker. Cette voie évite le constructeur direct, non pris en charge sur mobile.
 * Toute erreur est convertie en résultat métier afin que l'expiration d'un
 * minuteur ne puisse jamais faire tomber l'interface.
 */
export async function showIrrigationCompletionNotification(
  registration: PersistentNotificationRegistration | null,
  permission: IrrigationNotificationPermission,
  payload: IrrigationNotificationPayload,
): Promise<IrrigationNotificationResult> {
  if (permission !== 'granted') return 'not-permitted';
  if (!registration) return 'unavailable';

  try {
    const options: NotificationOptions & {
      renotify: boolean;
      requireInteraction: boolean;
    } = {
      body: `${payload.equipmentName} · ${payload.settingName}`,
      tag: `irrigation-finished-${payload.eventEquipmentId}`,
      renotify: true,
      requireInteraction: true,
      data: { url: payload.url },
    };
    await registration.showNotification(
      'Irrigation terminée – fermer la vanne',
      options,
    );
    return 'shown';
  } catch {
    return 'failed';
  }
}

/**
 * L'état de cet appareil après le renouvellement fait à l'ouverture d'une
 * page (docs/tranche-4-contract.md, F372) : inscrit, il reçoit les alertes ;
 * à une autre personne, il se présente comme un appareil où elles ne sont
 * pas encore activées, avec le bouton « Activer », sans que la page ne le
 * prenne d'elle-même ; sinon, le service n'a pas pu l'inscrire.
 */
export function deviceStatusAfterRefresh(
  result: { ok: boolean; reason?: 'other-person' },
): 'enabled' | 'default' | 'unavailable' {
  if (result.ok) return 'enabled';
  return result.reason === 'other-person' ? 'default' : 'unavailable';
}

export function applicationServerKeyBytes(value: string): ArrayBuffer {
  const normalized = value.trim().replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = window.atob(padded);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes.buffer;
}

/** L'état des notifications de cet appareil, tel que la page le lit. */
export type DeviceNotificationStatus =
  | 'checking'
  | 'enabled'
  | 'default'
  | 'denied'
  | 'unsupported'
  | 'unavailable';

/**
 * L'état de l'appareil à l'ouverture d'une page, avant le renouvellement :
 * l'autorisation est donnée mais le navigateur n'a plus d'inscription
 * (alertes sur le téléphone, C4, D-306). L'autorisation ne se donne qu'au
 * geste « Activer » : l'appareil était donc inscrit, et son inscription
 * s'est perdue (données du navigateur effacées, inscription expirée ou
 * retirée par le service de notification).
 */
export function deviceSubscriptionLost(permission: NotificationPermission, hasSubscription: boolean): boolean {
  return permission === 'granted' && !hasSubscription;
}

export const ACTIVATE_LABEL = 'Activer sur cet appareil';
export const REACTIVATE_LABEL = 'Réactiver les notifications';

/**
 * Ce que l'écran des alertes dit de cet appareil, et le geste qu'il propose
 * (C4, D-306) : « Activer » pour un appareil jamais inscrit ;
 * « Réactiver les notifications » quand son inscription s'est perdue ou que
 * le service n'a pas pu l'inscrire, le même geste `activate` (F372). Aucun
 * geste quand le navigateur bloque ou ne sait pas recevoir : seul son
 * réglage y peut quelque chose.
 */
export function alertDeviceView(status: DeviceNotificationStatus, subscriptionLost: boolean): { state: string; action: string | null } {
  switch (status) {
    case 'enabled': return { state: 'Cet appareil reçoit les alertes.', action: null };
    case 'default':
      return subscriptionLost
        ? { state: 'Cet appareil ne reçoit plus les alertes : son inscription aux notifications s’est perdue.', action: REACTIVATE_LABEL }
        : { state: 'Cet appareil ne reçoit pas encore les alertes.', action: ACTIVATE_LABEL };
    case 'checking': return { state: 'Lecture de l’état de cet appareil…', action: null };
    case 'denied': return { state: 'Les alertes sont bloquées dans les réglages du navigateur de cet appareil.', action: null };
    case 'unsupported': return { state: 'Ce navigateur ne peut pas recevoir les alertes.', action: null };
    case 'unavailable': return { state: 'Cet appareil ne reçoit pas les alertes : le service de notification n’a pas pu l’inscrire.', action: REACTIVATE_LABEL };
  }
}
