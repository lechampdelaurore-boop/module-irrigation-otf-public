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
