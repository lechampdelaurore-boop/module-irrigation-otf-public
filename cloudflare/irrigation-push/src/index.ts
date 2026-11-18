import { DurableObject } from 'cloudflare:workers';
import type { PushSubscription, VapidKeys } from '@block65/webcrypto-web-push';
import {
  type IrrigationPushAlarmRequest,
  type IrrigationPushNotification,
  type IrrigationPushRegistration,
  type IrrigationPushSendRequest,
  type IrrigationPushSubscription,
} from './contract.ts';
import { handlePushApiRequest } from './api.ts';
import { deliverWebPush } from './delivery.ts';
import {
  decideDelivery,
  decideRegistration,
  holderAfterUnregistration,
  type DeviceHolder,
} from './devices.ts';
import {
  compareAlarmRevisions,
  deliveryRetryDelay,
  immediateDeliveryStatus,
  retryAlarmName,
  shouldRetryDelivery,
  type ImmediateDeliveryCounts,
} from './domain.ts';

const MAX_SUBSCRIPTIONS_PER_RECIPIENT = 20;
const MAX_DELIVERY_ATTEMPTS = 12;
const INITIAL_RETRY_DELAY_MS = 15_000;
const MAX_RETRY_DELAY_MS = 15 * 60_000;
const DEVICE_HOLDER_KEY = 'holder';

type StoredAlarm = IrrigationPushAlarmRequest & {
  attempt: number;
};

type DeliveryRequest = {
  /** L'espace qui envoie : chaque appareil de sa liste doit encore y être inscrit (F371). */
  recipientKey: string;
  revision: string;
  notification: IrrigationPushNotification;
};

type DeliveryResult = {
  delivered: number;
  alreadyDelivered: number;
  expired: number;
  reassigned: number;
  transient: number;
  permanent: number;
};

type SubscriptionRow = {
  endpoint: string;
  expiration_time: number | null;
  p256dh: string;
  auth: string;
  last_sent_revision: string | null;
};

export type DeviceRegistrationResult = { status: 'registered' | 'other-person' };

export default {
  async fetch(request, env): Promise<Response> {
    return handlePushApiRequest(request, {
      serviceToken: env.IRRIGATION_PUSH_SERVICE_TOKEN,
      sendNow: (request) => sendNow(env, request),
      getAlarm: (eventEquipmentId) => alarmStub(env, eventEquipmentId),
      getDevice: (endpoint) => deviceStub(env, endpoint),
    });
  },
} satisfies ExportedHandler<Env>;

export class IrrigationAlarm extends DurableObject<Env> {
  async schedule(request: IrrigationPushAlarmRequest) {
    const current = await this.ctx.storage.get<StoredAlarm>('alarm');
    if (current && compareAlarmRevisions(current.revision, request.revision) > 0) {
      return { status: 'stale' as const, revision: current.revision };
    }

    const alarm: StoredAlarm = { ...request, attempt: 0 };
    await this.ctx.storage.put('alarm', alarm);
    await this.ctx.storage.setAlarm(
      Math.max(Date.now(), new Date(request.dueAt).getTime()),
    );
    return { status: 'scheduled' as const, revision: request.revision };
  }

  async cancel(revision: string) {
    const current = await this.ctx.storage.get<StoredAlarm>('alarm');
    if (!current || current.revision !== revision) {
      return { status: 'unchanged' as const };
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.delete('alarm');
    return { status: 'canceled' as const };
  }

  async alarm() {
    const current = await this.ctx.storage.get<StoredAlarm>('alarm');
    if (!current) return;

    const result = await recipientStub(this.env, current.recipientKey).deliver({
      recipientKey: current.recipientKey,
      revision: current.revision,
      notification: current.notification,
    });
    if (shouldRetryDelivery(
      result.transient,
      current.attempt + 1,
      MAX_DELIVERY_ATTEMPTS,
    )) {
      const attempt = current.attempt + 1;
      await this.ctx.storage.put('alarm', { ...current, attempt });
      await this.ctx.storage.setAlarm(Date.now() + deliveryRetryDelay(
        attempt,
        INITIAL_RETRY_DELAY_MS,
        MAX_RETRY_DELAY_MS,
      ));
      return;
    }

    await this.ctx.storage.delete('alarm');
  }
}

export class PushRecipient extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        expiration_time INTEGER,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        last_sent_revision TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );
  }

  async upsert(subscription: IrrigationPushSubscription) {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO push_subscriptions (
        endpoint, expiration_time, p256dh, auth, last_sent_revision,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        expiration_time = excluded.expiration_time,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        updated_at = excluded.updated_at`,
      subscription.endpoint,
      subscription.expirationTime,
      subscription.keys.p256dh,
      subscription.keys.auth,
      now,
      now,
    );
    this.ctx.storage.sql.exec(
      `DELETE FROM push_subscriptions
       WHERE endpoint IN (
         SELECT endpoint FROM push_subscriptions
         ORDER BY updated_at DESC
         LIMIT -1 OFFSET ?
       )`,
      MAX_SUBSCRIPTIONS_PER_RECIPIENT,
    );
  }

  async remove(endpoint: string) {
    this.ctx.storage.sql.exec(
      'DELETE FROM push_subscriptions WHERE endpoint = ?',
      endpoint,
    );
  }

  async count() {
    const row = this.ctx.storage.sql
      .exec<{ count: number }>('SELECT COUNT(*) AS count FROM push_subscriptions')
      .one();
    return Number(row.count);
  }

  async deliver(request: DeliveryRequest): Promise<DeliveryResult> {
    const result: DeliveryResult = {
      delivered: 0,
      alreadyDelivered: 0,
      expired: 0,
      reassigned: 0,
      transient: 0,
      permanent: 0,
    };
    const rows = this.ctx.storage.sql
      .exec<SubscriptionRow>('SELECT * FROM push_subscriptions ORDER BY created_at')
      .toArray();
    const vapid = vapidKeys(this.env);

    for (const row of rows) {
      if (row.last_sent_revision === request.revision) {
        result.alreadyDelivered += 1;
        continue;
      }
      if (row.expiration_time !== null && row.expiration_time <= Date.now()) {
        await this.forgetExpired(row.endpoint);
        result.expired += 1;
        continue;
      }
      // Un appareil, une personne (F371) : vérifié au moment d'envoyer,
      // appareil par appareil ; s'il est passé ailleurs, il quitte la liste
      // sans rien recevoir. Une vérification impossible n'envoie rien et se
      // retente comme un échec transitoire.
      const admitted = await deviceStub(this.env, row.endpoint)
        .admit(request.recipientKey)
        .catch(() => null);
      if (admitted === null) {
        result.transient += 1;
        continue;
      }
      if (!admitted) {
        await this.remove(row.endpoint);
        result.reassigned += 1;
        continue;
      }

      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        expirationTime: row.expiration_time,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      const disposition = await deliverWebPush(
        subscription,
        request.notification,
        vapid,
      );
      result[disposition] += 1;
      if (disposition === 'delivered') {
        this.ctx.storage.sql.exec(
          `UPDATE push_subscriptions
           SET last_sent_revision = ?, updated_at = ?
           WHERE endpoint = ?`,
          request.revision,
          Date.now(),
          row.endpoint,
        );
      } else if (disposition === 'expired') {
        await this.forgetExpired(row.endpoint);
      }
    }
    return result;
  }

  /** Un abonnement expiré quitte la liste, et le service oublie l'appareil : son adresse ne sert plus à rien. */
  private async forgetExpired(endpoint: string) {
    await this.remove(endpoint);
    await deviceStub(this.env, endpoint).forget().catch(() => undefined);
  }
}

/**
 * Un appareil, désigné par son adresse d'abonnement (F371 à F377) : à qui il
 * est, et dans quels espaces de cette personne il est inscrit. Chaque
 * inscription, chaque retrait et chaque vérification d'envoi passent par
 * lui, l'un après l'autre : deux inscriptions simultanées du même appareil ne
 * peuvent pas le laisser dans les espaces de deux personnes, et un envoi ne
 * lit jamais un appareil à moitié inscrit.
 */
export class PushDevice extends DurableObject<Env> {
  async register(registration: IrrigationPushRegistration): Promise<DeviceRegistrationResult> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const decision = decideRegistration(await this.holder(), registration);
      if (decision.status === 'other-person') return { status: 'other-person' };
      // La décision est rangée d'abord : si un retrait échoue ensuite,
      // l'appareil est déjà refusé aux espaces qu'il quitte (F371).
      await this.ctx.storage.put(DEVICE_HOLDER_KEY, decision.holder);
      for (const recipientKey of decision.detachFrom) {
        await recipientStub(this.env, recipientKey).remove(registration.subscription.endpoint);
      }
      await recipientStub(this.env, registration.recipientKey).upsert(registration.subscription);
      return { status: 'registered' };
    });
  }

  async unregister(recipientKey: string, endpoint: string): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      await this.ctx.storage.put(
        DEVICE_HOLDER_KEY,
        holderAfterUnregistration(await this.holder(), recipientKey),
      );
      await recipientStub(this.env, recipientKey).remove(endpoint);
    });
  }

  /** L'espace qui envoie peut-il servir cet appareil ? Un appareil jamais vu lui est réservé (F375). */
  async admit(recipientKey: string): Promise<boolean> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const decision = decideDelivery(await this.holder(), recipientKey);
      if (decision.admitted && decision.claim) await this.ctx.storage.put(DEVICE_HOLDER_KEY, decision.claim);
      return decision.admitted;
    });
  }

  async forget(): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => this.ctx.storage.deleteAll());
  }

  private async holder(): Promise<DeviceHolder | null> {
    return (await this.ctx.storage.get<DeviceHolder>(DEVICE_HOLDER_KEY)) ?? null;
  }
}

/**
 * L'envoi immédiat : une première livraison tout de suite, dont le résultat
 * revient à l'application ; les échecs transitoires sont retentés par une
 * alarme sous la même révision, avec les mêmes tentatives bornées, sans
 * doublon pour les appareils déjà servis. L'alarme est nommée par l'espace
 * et l'identifiant de la notification ensemble (F377).
 */
async function sendNow(env: Env, request: IrrigationPushSendRequest) {
  const recipient = recipientStub(env, request.recipientKey);
  const subscriptions = await recipient.count();
  const result = await recipient.deliver({
    recipientKey: request.recipientKey,
    revision: request.revision,
    notification: request.notification,
  });
  const counts: ImmediateDeliveryCounts = { subscriptions, ...result };
  const status = immediateDeliveryStatus(counts);
  if (counts.transient > 0) {
    await alarmStub(env, retryAlarmName(request.recipientKey, request.notificationId)).schedule({
      eventEquipmentId: request.notificationId,
      recipientKey: request.recipientKey,
      revision: request.revision,
      dueAt: new Date(Date.now() + INITIAL_RETRY_DELAY_MS).toISOString(),
      notification: request.notification,
    });
  }
  return { status, ...counts };
}

function alarmStub(env: Env, eventEquipmentId: string) {
  return env.IRRIGATION_ALARMS.get(
    env.IRRIGATION_ALARMS.idFromName(eventEquipmentId),
  ) as unknown as DurableObjectStub & Pick<IrrigationAlarm, 'schedule' | 'cancel'>;
}

function recipientStub(env: Env, recipientKey: string) {
  return env.PUSH_RECIPIENTS.get(
    env.PUSH_RECIPIENTS.idFromName(recipientKey),
  ) as unknown as DurableObjectStub & Pick<PushRecipient, 'upsert' | 'remove' | 'count' | 'deliver'>;
}

function deviceStub(env: Env, endpoint: string) {
  return env.PUSH_DEVICES.get(
    env.PUSH_DEVICES.idFromName(endpoint),
  ) as unknown as DurableObjectStub & Pick<PushDevice, 'register' | 'unregister' | 'admit' | 'forget'>;
}

function vapidKeys(env: Env): VapidKeys {
  return {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
}
