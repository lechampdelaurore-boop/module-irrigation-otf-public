'use client';

import { useState, useTransition } from 'react';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { useIrrigationNotifications, type NotificationStatus } from './irrigation-manager/use-irrigation-notifications';

const NO_EVENTS: readonly IrrigationEventRecord[] = [];

/**
 * L'état des notifications de cet appareil sur la page « Alertes météo »
 * (audit ergonomique, lot 3, point 10, cas 11) : la règle du contrat — les
 * alertes partent vers les appareils où elles sont activées —, l'état de cet
 * appareil, et le geste pour les activer, sans passer par Réglages. Le même
 * abonnement que dans Réglages et sur la page des arrosages.
 */
export function WeatherAlertsDevice({ season }: { season: number }) {
  const [warning, setWarning] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const [pending, startTransition] = useTransition();
  const { notificationStatus, enableNotifications } = useIrrigationNotifications({ season, now, activeEvents: NO_EVENTS, setWarning });
  return (
    <div className="weather-alert-device" data-status={notificationStatus}>
      <div>
        <strong>{deviceState(notificationStatus)}</strong>
        <span>Les alertes partent vers tous les appareils de l’exploitation où les alertes sont activées.</span>
      </div>
      {notificationStatus === 'default' ? (
        <button type="button" disabled={pending} onClick={() => startTransition(async () => enableNotifications())}>
          Activer sur cet appareil
        </button>
      ) : null}
      {warning ? <p className="water-error" role="alert">{warning}</p> : null}
    </div>
  );
}

function deviceState(status: NotificationStatus): string {
  switch (status) {
    case 'enabled': return 'Cet appareil reçoit les alertes.';
    case 'default': return 'Cet appareil ne reçoit pas encore les alertes.';
    case 'checking': return 'Lecture de l’état de cet appareil…';
    case 'denied': return 'Les alertes sont bloquées dans les réglages du navigateur de cet appareil.';
    case 'unsupported': return 'Ce navigateur ne peut pas recevoir les alertes.';
    case 'unavailable': return 'Le service de notification n’a pas pu démarrer sur cet appareil.';
  }
}
