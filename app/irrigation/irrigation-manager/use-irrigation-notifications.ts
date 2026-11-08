'use client';
import { useEffect, useRef, useState } from 'react';
import { pageHref } from '@/lib/domain/features/pages';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import {
  applicationServerKeyBytes,
  showIrrigationCompletionNotification,
} from '@/lib/domain/irrigation-notifications';
import {
  getIrrigationPushConfigurationAction,
  registerIrrigationPushSubscriptionAction,
  unregisterIrrigationPushSubscriptionAction,
} from '../push-notification-actions';
import {
  rememberCompletionSignal,
  playCompletionTone,
  wasCompletionAlreadySignaled,
} from './completion-signal';
import { remainingForEvent } from './presentation';
import { publishNotificationStatus } from './notification-status-signal';

export type NotificationStatus =
  | 'checking'
  | 'enabled'
  | 'default'
  | 'denied'
  | 'unsupported'
  | 'unavailable';

/**
 * Les notifications de fin d'irrigation : état du navigateur, abonnement Push,
 * et signal donné à la fin d'une irrigation dont le minuteur arrive au bout.
 *
 * Le composant garde la main sur ses messages : c'est lui qui fournit
 * `setWarning`, pour qu'un échec d'abonnement s'affiche au même endroit que
 * les autres avertissements de l'écran.
 */
export function useIrrigationNotifications({
  season,
  now,
  activeEvents,
  setWarning,
}: {
  season: number;
  now: Date;
  activeEvents: readonly IrrigationEventRecord[];
  setWarning: (message: string | null) => void;
}) {
  const [notificationStatus, setNotificationStatus] =
    useState<NotificationStatus>('checking');
  const notifiedEventIds = useRef(new Set<string>());
  const notificationRegistration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    publishNotificationStatus(notificationStatus);
  }, [notificationStatus]);

  useEffect(() => {
    let mounted = true;
    if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      queueMicrotask(() => {
        if (mounted) setNotificationStatus('unsupported');
      });
      return () => {
        mounted = false;
      };
    }

    void navigator.serviceWorker
      .register('/irrigation-notifications-sw.js', { scope: '/' })
      .then(async () => navigator.serviceWorker.ready)
      .then(async (registration) => {
        if (!mounted) return;
        notificationRegistration.current = registration;
        if (Notification.permission !== 'granted') {
          setNotificationStatus(Notification.permission);
          return;
        }
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          setNotificationStatus('default');
          return;
        }
        const result = await registerIrrigationPushSubscriptionAction(
          subscription.toJSON(),
        );
        if (mounted) setNotificationStatus(result.ok ? 'enabled' : 'unavailable');
      })
      .catch(() => {
        if (mounted) setNotificationStatus('unavailable');
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    for (const event of activeEvents) {
      if (event.equipment.timerState !== 'running') continue;
      if (remainingForEvent(event, now) > 0) continue;
      if (notificationStatus === 'checking') continue;
      if (notifiedEventIds.current.has(event.id)) continue;
      if (wasCompletionAlreadySignaled(event)) continue;
      notifiedEventIds.current.add(event.id);
      playCompletionTone();
      rememberCompletionSignal(event);
      if (
        notificationStatus === 'enabled' &&
        event.equipment.timerAlarmStatus === 'scheduled'
      ) {
        continue;
      }
      void showIrrigationCompletionNotification(
        notificationRegistration.current,
        Notification.permission === 'granted' ? 'granted' : 'unsupported',
        {
          eventEquipmentId: event.equipment.id,
          equipmentName: event.equipment.equipmentSnapshot.name,
          settingName: event.equipment.settingSnapshot.name,
          url: pageHref('arrosages', { season }, `irrigation-${event.equipment.id}`),
        },
      ).then((result) => {
        if (result === 'failed' || result === 'unavailable') {
          setNotificationStatus('unavailable');
        }
      });
    }
  }, [activeEvents, notificationStatus, now, season]);

  const enableNotifications = async () => {
    if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setNotificationStatus('unsupported');
      return;
    }
    try {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') {
        setNotificationStatus(permission);
        return;
      }
      let registration = notificationRegistration.current;
      if (!registration) {
        await navigator.serviceWorker.register(
          '/irrigation-notifications-sw.js',
          { scope: '/' },
        );
        registration = await navigator.serviceWorker.ready;
      }
      notificationRegistration.current = registration;
      const configuration = await getIrrigationPushConfigurationAction();
      if (!configuration.ok || !configuration.publicKey) {
        setNotificationStatus('unavailable');
        setWarning(configuration.message);
        return;
      }
      let subscription = await registration.pushManager.getSubscription();
      let createdSubscription = false;
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKeyBytes(configuration.publicKey),
        });
        createdSubscription = true;
      }
      const result = await registerIrrigationPushSubscriptionAction(
        subscription.toJSON(),
      );
      if (!result.ok) {
        if (createdSubscription) await subscription.unsubscribe().catch(() => false);
        setNotificationStatus('unavailable');
        setWarning(result.message);
        return;
      }
      setNotificationStatus('enabled');
      setWarning(null);
    } catch {
      setNotificationStatus('unavailable');
      setWarning('Les notifications n’ont pas pu être activées sur cet appareil.');
    }
  };

  const disableNotifications = async () => {
    try {
      const subscription = await notificationRegistration.current?.pushManager
        .getSubscription();
      if (subscription) {
        const result = await unregisterIrrigationPushSubscriptionAction(
          subscription.endpoint,
        );
        await subscription.unsubscribe();
        if (!result.ok) setWarning(result.message);
      }
      setNotificationStatus(Notification.permission === 'denied' ? 'denied' : 'default');
    } catch {
      setWarning('Les notifications n’ont pas pu être désactivées complètement.');
    }
  };

  return { notificationStatus, enableNotifications, disableNotifications };
}
