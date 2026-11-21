'use client';

import { useState, useTransition } from 'react';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { NotificationReadiness } from '../irrigation-manager/notification-readiness';
import { useIrrigationNotifications } from '../irrigation-manager/use-irrigation-notifications';
import { saveMorningMessageAction } from '../phone-notice-actions';
import { ActionReply, actionReply, type ActionReplyMessage } from '../shell/action-reply';
import { AnchoredFold } from '../shell/page-settings-fold';

const REPLY_CLASSES = { notice: 'water-notice', warning: 'weather-stale', error: 'water-error' } as const;

const NO_EVENTS: readonly IrrigationEventRecord[] = [];

/**
 * Les notifications du téléphone dans Réglages (docs/feature-selection-contract.md,
 * section 3) : l'autorisation et son état, pour une ferme qui reçoit des
 * notifications sans avoir coché les arrosages (alertes météo ou cultures).
 * Le même abonnement que sur la page des arrosages. Pour une ferme qui coche
 * le Planning, la case du message du matin (amélioration n° 3, F702, F712),
 * dans un pli fermé dont la ligne dit le réglage (F715) : « Réglages » garde
 * sa hauteur au téléphone, et l'ancre `#message-du-matin` l'ouvre.
 */
export function NotificationSettings({ season, morningMessage }: {
  season: number;
  /** Le réglage du message du matin ; `null` sans le Planning, dont le calcul du matin l'envoie. */
  morningMessage: boolean | null;
}) {
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
          <p>Les fins d’arrosage, le message du matin et les alertes arrivent sur chaque appareil où vous les activez.</p>
        </div>
      </header>
      {morningMessage === null ? null : <PhoneNoticesFold morningMessage={morningMessage} />}
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

/** La ligne du pli : le réglage tel qu'il est enregistré, relu à chaque changement. */
function phoneNoticesLine(morningMessage: boolean): string {
  return morningMessage ? 'Message du matin activé.' : 'Message du matin coupé.';
}

/** Le pli des messages de la ferme, fermé, sa ligne de résumé à jour. */
function PhoneNoticesFold({ morningMessage }: { morningMessage: boolean }) {
  const [morning, setMorning] = useState(morningMessage);
  return (
    <AnchoredFold
      id="messages-de-la-ferme"
      className="species-fold phone-notice-fold"
      bodyClassName="species-fold-body"
      summary={<><strong>Messages de la ferme</strong><small>{phoneNoticesLine(morning)}</small></>}
    >
      <MorningMessageSetting initial={morningMessage} onSaved={setMorning} />
    </AnchoredFold>
  );
}

/**
 * La case du message du matin : chaque matin, après le calcul du planning, un
 * seul message dit la journée ; rien quand il n'y a rien à dire. Le choix
 * vaut pour toute la ferme et s'enregistre aussitôt.
 */
function MorningMessageSetting({ initial, onSaved }: { initial: boolean; onSaved: (enabled: boolean) => void }) {
  const [enabled, setEnabled] = useState(initial);
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);
  const [pending, startTransition] = useTransition();
  // La case suit le geste tout de suite ; un échec la remet comme avant et le dit.
  const change = (next: boolean) => {
    setEnabled(next);
    startTransition(async () => {
      const result = await saveMorningMessageAction({ enabled: next });
      setEnabled(result.ok ? result.morningMessage : !next);
      if (result.ok) onSaved(result.morningMessage);
      setReplies([actionReply('matin', result.ok ? 'notice' : 'error', result.message)]);
    });
  };
  return (
    <div className="phone-notice-setting" id="message-du-matin">
      <label className="water-toggle">
        <input type="checkbox" checked={enabled} disabled={pending} onChange={(event) => change(event.target.checked)} />
        Message du matin
      </label>
      <p className="phone-notice-hint">
        Chaque matin, après le calcul du planning, un seul message dit les arrosages prévus du jour, la pluie annoncée,
        les alertes en cours et les suggestions du planning. Rien n’est envoyé quand il n’y a rien à dire.
      </p>
      <ActionReply messages={replies} origin="matin" classNames={REPLY_CLASSES} />
    </div>
  );
}
