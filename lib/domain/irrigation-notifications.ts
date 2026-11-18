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
