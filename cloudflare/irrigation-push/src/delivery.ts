import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription,
  type VapidKeys,
} from '@block65/webcrypto-web-push';
import type { IrrigationPushNotification } from './contract.ts';

export type PushDeliveryDisposition =
  | 'delivered'
  | 'expired'
  | 'transient'
  | 'permanent';

/**
 * Une heure de validité, et la priorité haute de la RFC 8030 (en-tête
 * `Urgency`) : une fin d'irrigation ou une alerte de gel n'attend pas le
 * réveil du téléphone. En priorité normale, le service du téléphone peut
 * garder le message tant que l'appareil dort, jusqu'au déverrouillage :
 * l'alerte de gel de la recette réelle de la 5 quinquies (6 novembre 2026)
 * n'est apparue qu'au déverrouillage.
 */
export const PUSH_DELIVERY_OPTIONS = { ttl: 60 * 60, urgency: 'high' } as const;

export async function deliverWebPush(
  subscription: PushSubscription,
  notification: IrrigationPushNotification,
  vapid: VapidKeys,
  dependencies: {
    build?: typeof buildPushPayload;
    send?: typeof fetch;
  } = {},
): Promise<PushDeliveryDisposition> {
  try {
    const message: PushMessage = {
      data: JSON.stringify(notification),
      options: { ...PUSH_DELIVERY_OPTIONS },
    };
    const payload = await (dependencies.build ?? buildPushPayload)(
      message,
      subscription,
      vapid,
    );
    const response = await (dependencies.send ?? fetch)(
      subscription.endpoint,
      payload,
    );
    if (response.ok) return 'delivered';
    if (response.status === 404 || response.status === 410) return 'expired';
    if (
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      return 'transient';
    }
    return 'permanent';
  } catch {
    return 'transient';
  }
}
