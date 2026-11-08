'use client';

import { useState, useTransition } from 'react';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { NotificationReadiness } from '../irrigation-manager/notification-readiness';
import { useIrrigationNotifications } from '../irrigation-manager/use-irrigation-notifications';

const NO_EVENTS: readonly IrrigationEventRecord[] = [];

/**
 * Les notifications du téléphone dans Réglages (docs/feature-selection-contract.md,
 * section 3) : l'autorisation et son état, pour une ferme qui reçoit des
 * notifications sans avoir coché les arrosages (alertes météo ou cultures).
 * Le même abonnement que sur la page des arrosages.
 */
export function NotificationSettings({ season }: { season: number }) {
  const [warning, setWarning] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const [pending, startTransition] = useTransition();
  const { notificationStatus, enableNotifications, disableNotifications } = useIrrigationNotifications({
    season,
    now,
    activeEvents: NO_EVENTS,
    setWarning,
  });

  return (
    <section className="water-management-section" aria-labelledby="notifications-title">
      <header className="water-management-heading">
        <div>
          <h2 id="notifications-title">Notifications du téléphone</h2>
          <p>Les fins d’arrosage, la notification du matin et les alertes arrivent sur chaque appareil où vous les activez.</p>
        </div>
      </header>
      <NotificationReadiness
        status={notificationStatus}
        pending={pending}
        onEnable={() => startTransition(async () => enableNotifications())}
        onDisable={() => startTransition(async () => disableNotifications())}
      />
      {warning ? <p className="irrigation-event-warning" role="alert">{warning}</p> : null}
    </section>
  );
}
