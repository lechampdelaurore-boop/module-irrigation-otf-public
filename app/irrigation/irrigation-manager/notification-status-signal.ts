'use client';
import type { NotificationStatus } from './use-irrigation-notifications';

/**
 * L'état des alertes de cet appareil, partagé avec les encarts qui en
 * parlent sans les gérer : l'encart « Alertes météo » rappelle que les
 * alertes ne partent que vers les appareils où elles sont activées
 * (docs/weather-alerts-contract.md, « L'écran »). Seul le crochet des
 * notifications publie ; les autres lisent.
 */
let current: NotificationStatus = 'checking';
const listeners = new Set<() => void>();

export function publishNotificationStatus(status: NotificationStatus): void {
  if (status === current) return;
  current = status;
  for (const listener of listeners) listener();
}

export function subscribeNotificationStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readNotificationStatus(): NotificationStatus {
  return current;
}

export function readServerNotificationStatus(): NotificationStatus {
  return 'checking';
}
