const IRRIGATION_PUSH_SUBSCRIPTION_ENDPOINT_MAX_LENGTH = 2_048;
const IRRIGATION_PUSH_KEY_MAX_LENGTH = 256;

export type IrrigationPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type IrrigationPushNotification = {
  title: string;
  body: string;
  tag: string;
  data: {
    url: string;
  };
};

export type IrrigationPushAlarmRequest = {
  eventEquipmentId: string;
  recipientKey: string;
  revision: string;
  dueAt: string;
  notification: IrrigationPushNotification;
};

/** L'envoi immédiat d'une notification (docs/push-worker-contract.md, « Envoi immédiat »). */
export type IrrigationPushSendRequest = {
  notificationId: string;
  recipientKey: string;
  revision: string;
  notification: IrrigationPushNotification;
};

export function validateIrrigationPushSubscription(
  value: unknown,
): IrrigationPushSubscription | null {
  if (!isRecord(value) || !isRecord(value.keys)) return null;

  const endpoint = normalizePushEndpoint(value.endpoint);
  const p256dh = normalizeBase64Url(value.keys.p256dh);
  const auth = normalizeBase64Url(value.keys.auth);
  const expirationTime = normalizeExpirationTime(value.expirationTime);
  if (!endpoint || !p256dh || !auth || expirationTime === undefined) return null;

  return {
    endpoint,
    expirationTime,
    keys: { p256dh, auth },
  };
}

export function normalizePushEndpoint(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const endpoint = value.trim();
  if (!endpoint || endpoint.length > IRRIGATION_PUSH_SUBSCRIPTION_ENDPOINT_MAX_LENGTH) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    return null;
  }
  return isKnownWebPushHost(url.hostname) ? url.href : null;
}

function normalizeBase64Url(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/=+$/u, '');
  if (
    normalized.length < 8 ||
    normalized.length > IRRIGATION_PUSH_KEY_MAX_LENGTH ||
    !/^[A-Za-z0-9_-]+$/u.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function validateIrrigationPushAlarmRequest(
  value: unknown,
): IrrigationPushAlarmRequest | null {
  if (!isRecord(value) || !isRecord(value.notification)) return null;
  const eventEquipmentId = normalizeIdentifier(value.eventEquipmentId);
  const recipientKey = normalizeIdentifier(value.recipientKey);
  const revision = normalizeIdentifier(value.revision);
  const dueAt = normalizeIsoDate(value.dueAt);
  const notification = validateIrrigationPushNotification(value.notification);
  if (!eventEquipmentId || !recipientKey || !revision || !dueAt || !notification) {
    return null;
  }
  return { eventEquipmentId, recipientKey, revision, dueAt, notification };
}

/**
 * Les adresses qu'une notification peut ouvrir : `/irrigation` et ses pages
 * (3.8, docs/feature-selection-contract.md, section 5), sur le site lui-même.
 */
const IRRIGATION_NOTIFICATION_PATH = /^\/irrigation(?:\/[a-z][a-z-]{0,39})?$/;

export function safeIrrigationNotificationUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  let url: URL;
  try {
    url = new URL(value, 'https://irrigation.local');
  } catch {
    return null;
  }
  if (url.origin !== 'https://irrigation.local' || !IRRIGATION_NOTIFICATION_PATH.test(url.pathname)) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function validateIrrigationPushNotification(value: Record<string, unknown>): IrrigationPushNotification | null {
  const title = normalizeDisplayText(value.title, 80);
  const body = normalizeDisplayText(value.body, 160);
  const tag = normalizeIdentifier(value.tag, 180);
  const data = isRecord(value.data) ? value.data : null;
  const url = safeIrrigationNotificationUrl(data?.url);
  if (!title || !body || !tag || !url) return null;
  return { title, body, tag, data: { url } };
}

function isKnownWebPushHost(hostname: string): boolean {
  const host = hostname.toLocaleLowerCase('en-US');
  return (
    host === 'fcm.googleapis.com' ||
    host === 'web.push.apple.com' ||
    host === 'updates.push.services.mozilla.com' ||
    host.endsWith('.push.services.mozilla.com') ||
    host === 'notify.windows.com' ||
    host.endsWith('.notify.windows.com')
  );
}

function normalizeExpirationTime(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || Number(value) <= 0) return undefined;
  return Math.floor(Number(value));
}

function normalizeIdentifier(value: unknown, maxLength = 128): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return /^[A-Za-z0-9._:-]+$/u.test(normalized) ? normalized : null;
}

function normalizeDisplayText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
