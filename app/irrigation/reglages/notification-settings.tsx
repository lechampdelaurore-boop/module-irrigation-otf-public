'use client';

import { useState, useTransition } from 'react';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { NotificationReadiness } from '../irrigation-manager/notification-readiness';
import { useIrrigationNotifications } from '../irrigation-manager/use-irrigation-notifications';
import { EVENING_TIMES, eveningTimeText } from '@/lib/domain/today/evening-reminder';
import { notifyChangeJournalChanged } from '@/lib/domain/feasibility-notifications';
import { saveEveningReminderAction, saveMorningMessageAction } from '../phone-notice-actions';
import { ActionReply, actionReply, type ActionReplyMessage } from '../shell/action-reply';
import { AnchoredFold } from '../shell/page-settings-fold';

const REPLY_CLASSES = { notice: 'water-notice', warning: 'weather-stale', error: 'water-error' } as const;

const NO_EVENTS: readonly IrrigationEventRecord[] = [];

/**
 * Les notifications du téléphone dans Réglages (docs/feature-selection-contract.md,
 * section 3) : l'autorisation et son état, pour une ferme qui reçoit des
 * notifications sans avoir coché les arrosages (alertes météo ou cultures).
 * Le même abonnement que sur la page des arrosages. Pour une ferme qui coche
 * le Planning, la case du message du matin (amélioration n° 3, F702, F712) ;
 * pour une ferme qui coche les Arrosages, celle du rappel du soir et son
 * heure (amélioration n° 2, F714). Les deux dans un pli fermé dont la ligne
 * dit les réglages (F715) : « Réglages » garde sa hauteur au téléphone, et
 * l'ancre d'un réglage (`#message-du-matin`, `#rappel-du-soir`) l'ouvre.
 */
export function NotificationSettings({ season, morningMessage, evening }: {
  season: number;
  /** Le réglage du message du matin ; `null` sans le Planning, dont le calcul du matin l'envoie. */
  morningMessage: boolean | null;
  /** Le rappel du soir et son heure ; `null` sans les Arrosages, dont il rappelle les irrigations. */
  evening: { enabled: boolean; time: string } | null;
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
          <p>Les fins d’arrosage, le message du matin, le rappel du soir et les alertes arrivent sur chaque appareil où vous les activez.</p>
        </div>
      </header>
      {morningMessage === null && evening === null ? null : <PhoneNoticesFold morningMessage={morningMessage} evening={evening} />}
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

type EveningSetting = { enabled: boolean; time: string };

/** La ligne du pli : les réglages tels qu'ils sont enregistrés, relus à chaque changement. */
function phoneNoticesLine(morningMessage: boolean | null, evening: EveningSetting | null): string {
  const parts: string[] = [];
  if (morningMessage !== null) parts.push(morningMessage ? 'Message du matin activé.' : 'Message du matin coupé.');
  if (evening !== null) parts.push(evening.enabled ? `Rappel du soir à ${eveningTimeText(evening.time)}.` : 'Rappel du soir coupé.');
  return parts.join(' ');
}

/** Le pli des messages de la ferme, fermé, sa ligne de résumé à jour. */
function PhoneNoticesFold({ morningMessage, evening }: { morningMessage: boolean | null; evening: EveningSetting | null }) {
  const [morning, setMorning] = useState(morningMessage);
  const [eveningSaved, setEveningSaved] = useState(evening);
  return (
    <AnchoredFold
      id="messages-de-la-ferme"
      className="species-fold phone-notice-fold"
      bodyClassName="species-fold-body"
      summary={<><strong>Messages de la ferme</strong><small>{phoneNoticesLine(morning, eveningSaved)}</small></>}
    >
      {morningMessage === null ? null : <MorningMessageSetting initial={morningMessage} onSaved={setMorning} />}
      {evening === null ? null : <EveningReminderSetting initial={evening} onSaved={setEveningSaved} />}
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
      // Enregistré : le journal des modifications de la page se relit (F746).
      if (result.ok) { onSaved(result.morningMessage); notifyChangeJournalChanged(); }
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

/**
 * La case du rappel du soir et son heure : à l'heure choisie, un message dit
 * les arrosages prévus du jour jamais confirmés ; rien quand tout est
 * confirmé. Chaque changement s'enregistre aussitôt, pour toute la ferme.
 */
function EveningReminderSetting({ initial, onSaved }: { initial: EveningSetting; onSaved: (setting: EveningSetting) => void }) {
  const [setting, setSetting] = useState(initial);
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);
  const [pending, startTransition] = useTransition();
  // Le réglage suit le geste tout de suite ; un échec le remet comme avant et le dit.
  const change = (next: EveningSetting) => {
    const before = setting;
    setSetting(next);
    startTransition(async () => {
      const result = await saveEveningReminderAction(next);
      setSetting(result.ok ? { enabled: result.enabled, time: result.time } : before);
      if (result.ok) { onSaved({ enabled: result.enabled, time: result.time }); notifyChangeJournalChanged(); }
      setReplies([actionReply('soir', result.ok ? 'notice' : 'error', result.message)]);
    });
  };
  return (
    <div className="phone-notice-setting" id="rappel-du-soir">
      <label className="water-toggle">
        <input type="checkbox" checked={setting.enabled} disabled={pending} onChange={(event) => change({ ...setting, enabled: event.target.checked })} />
        Rappel du soir
      </label>
      <label className="phone-notice-time">
        <span>Heure du rappel</span>
        <select value={setting.time} disabled={pending || !setting.enabled} onChange={(event) => change({ ...setting, time: event.target.value })}>
          {EVENING_TIMES.map((time) => <option key={time} value={time}>{eveningTimeText(time)}</option>)}
        </select>
      </label>
      <p className="phone-notice-hint">
        À l’heure choisie, un message dit les arrosages prévus du jour que personne n’a confirmés. Il ne confirme rien
        lui-même : « Aujourd’hui » s’ouvre, avec « Fait comme prévu ». Rien n’est envoyé quand tout est confirmé.
      </p>
      <ActionReply messages={replies} origin="soir" classNames={REPLY_CLASSES} />
    </div>
  );
}
