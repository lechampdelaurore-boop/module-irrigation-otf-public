'use client';

import { useState, useTransition } from 'react';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { alertDeviceView } from '@/lib/domain/irrigation-notifications';
import { useIrrigationNotifications } from './irrigation-manager/use-irrigation-notifications';

const NO_EVENTS: readonly IrrigationEventRecord[] = [];

/**
 * L'état des notifications de cet appareil sur la page « Alertes météo »
 * (audit ergonomique, lot 3, point 10, cas 11) : la règle du contrat — les
 * alertes partent vers les appareils où elles sont activées —, l'état de cet
 * appareil, et le geste pour les activer, sans passer par Réglages. Le même
 * abonnement que dans Réglages et sur la page des arrosages. Depuis C4
 * (D-306), il dit aussi quand l'appareil n'est plus inscrit, avec le bouton
 * « Réactiver les notifications » (le même geste `activate`).
 */
export function WeatherAlertsDevice({ season }: { season: number }) {
  const [warning, setWarning] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const [pending, startTransition] = useTransition();
  const { notificationStatus, subscriptionLost, enableNotifications } = useIrrigationNotifications({ season, now, activeEvents: NO_EVENTS, setWarning });
  const view = alertDeviceView(notificationStatus, subscriptionLost);
  return (
    <div className="weather-alert-device" data-status={notificationStatus} data-lost={subscriptionLost ? 'true' : undefined}>
      <div>
        <strong>{view.state}</strong>
        <span>Les alertes partent vers tous les appareils de l’exploitation où les alertes sont activées.</span>
      </div>
      {view.action ? (
        <button type="button" disabled={pending} onClick={() => startTransition(async () => enableNotifications())}>
          {view.action}
        </button>
      ) : null}
      {warning ? <p className="water-error" role="alert">{warning}</p> : null}
    </div>
  );
}
