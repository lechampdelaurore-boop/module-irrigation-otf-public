import { DurableObject } from 'cloudflare:workers';
import type { PushSubscription, VapidKeys } from '@block65/webcrypto-web-push';
import {
  type IrrigationPushAlarmRequest,
  type IrrigationPushNotification,
  type IrrigationPushSendRequest,
  type IrrigationPushSubscription,
} from './contract';
import { handlePushApiRequest } from './api';
import { deliverWebPush } from './delivery';
import {
  compareAlarmRevisions,
  deliveryRetryDelay,
  immediateDeliveryStatus,
  shouldRetryDelivery,
  type ImmediateDeliveryCounts,
} from './domain';

const MAX_SUBSCRIPTIONS_PER_RECIPIENT = 20;
const MAX_DELIVERY_ATTEMPTS = 12;
const INITIAL_RETRY_DELAY_MS = 15_000;
const MAX_RETRY_DELAY_MS = 15 * 60_000;

type StoredAlarm = IrrigationPushAlarmRequest & {
  attempt: number;
};

type DeliveryRequest = {
  revision: string;
  notification: IrrigationPushNotification;
};

type DeliveryResult = {
  delivered: number;
  alreadyDelivered: number;
  expired: number;
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

export default {
  async fetch(request, env): Promise<Response> {
    return handlePushApiRequest(request, {
      serviceToken: env.IRRIGATION_PUSH_SERVICE_TOKEN,
      sendNow: (request) => sendNow(env, request),
      getAlarm: (eventEquipmentId) => alarmStub(env, eventEquipmentId),
      getRecipient: (recipientKey) => recipientStub(env, recipientKey),
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
        await this.remove(row.endpoint);
        result.expired += 1;
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
        await this.remove(row.endpoint);
      }
    }
    return result;
  }
}

/**
 * L'envoi immédiat : une première livraison tout de suite, dont le résultat
 * revient à l'application ; les échecs transitoires sont retentés par une
 * alarme sous la même révision, avec les mêmes tentatives bornées, sans
 * doublon pour les appareils déjà servis.
 */
async function sendNow(env: Env, request: IrrigationPushSendRequest) {
  const recipient = recipientStub(env, request.recipientKey);
  const subscriptions = await recipient.count();
  const result = await recipient.deliver({ revision: request.revision, notification: request.notification });
  const counts: ImmediateDeliveryCounts = { subscriptions, ...result };
  const status = immediateDeliveryStatus(counts);
  if (counts.transient > 0) {
    await alarmStub(env, request.notificationId).schedule({
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

function vapidKeys(env: Env): VapidKeys {
  return {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
}
