// Copie autonome du contrat validé côté site. Le Worker reste ainsi déployable
// depuis son propre répertoire, y compris sous les restrictions de Miniflare.
export type IrrigationPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

export type IrrigationPushNotification = {
  title: string;
  body: string;
  tag: string;
  data: { url: string };
};

export type IrrigationPushAlarmRequest = {
  eventEquipmentId: string;
  recipientKey: string;
  revision: string;
  dueAt: string;
  notification: IrrigationPushNotification;
};

function validateIrrigationPushSubscription(value: unknown) {
  if (!isRecord(value) || !isRecord(value.keys)) return null;
  const endpoint = normalizePushEndpoint(value.endpoint);
  const p256dh = normalizeBase64Url(value.keys.p256dh);
  const auth = normalizeBase64Url(value.keys.auth);
  const expirationTime = normalizeExpirationTime(value.expirationTime);
  if (!endpoint || !p256dh || !auth || expirationTime === undefined) return null;
  return { endpoint, expirationTime, keys: { p256dh, auth } };
}

export function validateIrrigationPushAlarmRequest(
  value: unknown,
): IrrigationPushAlarmRequest | null {
  if (!isRecord(value) || !isRecord(value.notification)) return null;
  const eventEquipmentId = normalizeIdentifier(value.eventEquipmentId);
  const recipientKey = normalizeIdentifier(value.recipientKey);
  const revision = normalizeIdentifier(value.revision);
  const dueAt = normalizeIsoDate(value.dueAt);
  const notification = validateNotification(value.notification);
  if (!eventEquipmentId || !recipientKey || !revision || !dueAt || !notification) {
    return null;
  }
  return { eventEquipmentId, recipientKey, revision, dueAt, notification };
}

/**
 * L'envoi immédiat (alertes météo, docs/weather-alerts-contract.md) : la
 * notification part tout de suite vers les appareils du destinataire ;
 * `notificationId` nomme l'alarme qui retente les échecs transitoires.
 */
export type IrrigationPushSendRequest = {
  notificationId: string;
  recipientKey: string;
  revision: string;
  notification: IrrigationPushNotification;
};

export function validateIrrigationPushSendRequest(
  value: unknown,
): IrrigationPushSendRequest | null {
  if (!isRecord(value) || !isRecord(value.notification)) return null;
  const notificationId = normalizeIdentifier(value.notificationId);
  const recipientKey = normalizeIdentifier(value.recipientKey);
  const revision = normalizeIdentifier(value.revision);
  const notification = validateNotification(value.notification);
  if (!notificationId || !recipientKey || !revision || !notification) return null;
  return { notificationId, recipientKey, revision, notification };
}

export function validateIrrigationPushAlarmCancellation(value: unknown) {
  if (!isRecord(value)) return null;
  const eventEquipmentId = normalizeIdentifier(value.eventEquipmentId);
  const revision = normalizeIdentifier(value.revision);
  return eventEquipmentId && revision ? { eventEquipmentId, revision } : null;
}

export function validateIrrigationPushSubscriptionRequest(value: unknown) {
  if (!isRecord(value)) return null;
  const recipientKey = normalizeIdentifier(value.recipientKey);
  const subscription = validateIrrigationPushSubscription(value.subscription);
  return recipientKey && subscription ? { recipientKey, subscription } : null;
}

export function validateIrrigationPushUnsubscriptionRequest(value: unknown) {
  if (!isRecord(value)) return null;
  const recipientKey = normalizeIdentifier(value.recipientKey);
  const endpoint = normalizePushEndpoint(value.endpoint);
  return recipientKey && endpoint ? { recipientKey, endpoint } : null;
}

function normalizePushEndpoint(value: unknown) {
  if (typeof value !== 'string') return null;
  const endpoint = value.trim();
  if (!endpoint || endpoint.length > 2_048) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
  const host = url.hostname.toLocaleLowerCase('en-US');
  const knownHost =
    host === 'fcm.googleapis.com' ||
    host === 'web.push.apple.com' ||
    host === 'updates.push.services.mozilla.com' ||
    host.endsWith('.push.services.mozilla.com') ||
    host === 'notify.windows.com' ||
    host.endsWith('.notify.windows.com');
  return knownHost ? url.href : null;
}

function validateNotification(value: Record<string, unknown>) {
  const title = normalizeDisplayText(value.title, 80);
  const body = normalizeDisplayText(value.body, 160);
  const tag = normalizeIdentifier(value.tag, 180);
  const data = isRecord(value.data) ? value.data : null;
  const url = safeIrrigationNotificationUrl(data?.url);
  return title && body && tag && url
    ? { title, body, tag, data: { url } }
    : null;
}

// `/irrigation` et ses pages (3.8, docs/feature-selection-contract.md, section 5).
const IRRIGATION_NOTIFICATION_PATH = /^\/irrigation(?:\/[a-z][a-z-]{0,39})?$/;

function safeIrrigationNotificationUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 500) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const url = new URL(value, 'https://irrigation.local');
    return url.origin === 'https://irrigation.local' && IRRIGATION_NOTIFICATION_PATH.test(url.pathname)
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}

function normalizeBase64Url(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/=+$/u, '');
  return normalized.length >= 8 &&
    normalized.length <= 256 &&
    /^[A-Za-z0-9_-]+$/u.test(normalized)
    ? normalized
    : null;
}

function normalizeExpirationTime(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || Number(value) <= 0) return undefined;
  return Math.floor(Number(value));
}

function normalizeIdentifier(value: unknown, maximumLength = 128) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maximumLength &&
    /^[A-Za-z0-9._:-]+$/u.test(normalized)
    ? normalized
    : null;
}

function normalizeDisplayText(value: unknown, maximumLength: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized && normalized.length <= maximumLength ? normalized : null;
}

function normalizeIsoDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
