'use client';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import {
  decimalFormatter,
  elapsedForEvent,
  formatCountdown,
  formatDateTime,
  formatDuration,
  formatWettedVolume,
  wettedVolumeLiters,
  oneDecimalFormatter,
  remainingForEvent,
} from './presentation';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Bed } from '@/lib/domain/domain';
import { DoneAsPlannedButton } from '../done-as-planned-button';
import { isTimerAwaitingConfirmation, millimetersForDurationSeconds } from '@/lib/domain/irrigation-timer';

function EventPumpSummary({ event }: { event: IrrigationEventRecord }) {
  const equipment = event.equipment;
  const requestedFlow = equipment.requestedFlowCubicMetersPerHour;
  if (!equipment.pumpSnapshot || requestedFlow === null || requestedFlow === undefined) {
    return <p className="event-pump-summary is-unknown">Faisabilité hydraulique non vérifiée</p>;
  }
  const exceeded = requestedFlow > equipment.pumpSnapshot.maximumFlowCubicMetersPerHour + 1e-9;
  return <p className={`event-pump-summary ${exceeded ? 'is-exceeded' : ''}`}><strong>{equipment.pumpSnapshot.name}</strong> · {decimalFormatter.format(requestedFlow)} / {decimalFormatter.format(equipment.pumpSnapshot.maximumFlowCubicMetersPerHour)} m³/h{equipment.pumpOriginSnapshot ? ` · ${equipment.pumpOriginSnapshot.name}` : ' · origine non renseignée'}{exceeded ? ' · dépassement enregistré' : ''}</p>;
}

export function ActiveIrrigationCard({
  event,
  beds,
  now,
  pending,
  onPause,
  onResume,
  onFinish,
}: {
  event: IrrigationEventRecord;
  beds: Bed[];
  now: Date;
  pending: boolean;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}) {
  const equipment = event.equipment;
  const remaining = remainingForEvent(event, now);
  const elapsed = elapsedForEvent(event, now);
  const finished = isTimerAwaitingConfirmation({
    state: equipment.timerState!,
    resumedAt: equipment.timerResumedAt,
    pausedAt: equipment.timerPausedAt,
    accumulatedSeconds: equipment.timerAccumulatedSeconds,
    targetDurationSeconds: equipment.plannedDurationSeconds,
  }, now);
  const currentVolume = wettedVolumeLiters(equipment.applications, (application) =>
    millimetersForDurationSeconds(application.rateMmPerHour, elapsed));
  return (
    <article
      id={`irrigation-${equipment.id}`}
      className="active-irrigation-card"
      data-finished={finished}
    >
      {finished ? (
        <div className="timer-finished-alert" role="alert">
          <strong>Irrigation terminée</strong>
          <span>Fermer la vanne</span>
        </div>
      ) : null}
      <header>
        <div>
          <span className="event-status" data-status={equipment.timerState}>
            {equipment.timerState === 'paused' ? 'En pause' : 'En cours'}
          </span>
          <h4>{equipment.equipmentSnapshot.name}</h4>
          <p>{equipment.settingSnapshot.name}</p>
        </div>
        <strong className="timer-countdown">
          {equipment.timerState === 'paused' ? 'PAUSE' : formatCountdown(remaining)}
        </strong>
      </header>
      <dl className="active-timer-details">
        <div><dt>Temps effectué</dt><dd>{formatDuration(elapsed)}</dd></div>
        <div>
          <dt>Fin estimée</dt>
          <dd>{equipment.timerTheoreticalEndAt
            ? formatDateTime(equipment.timerTheoreticalEndAt)
            : 'Après la reprise'}</dd>
        </div>
        <div><dt>Volume en cours</dt><dd>{formatWettedVolume(currentVolume)}</dd></div>
      </dl>
      <ApplicationDetails event={event} beds={beds} elapsedSeconds={elapsed} />
      <EventPumpSummary event={event} />
      <div className="active-timer-actions">
        {equipment.timerState === 'paused' ? (
          <button type="button" disabled={pending} onClick={onResume}>Reprendre</button>
        ) : !finished ? (
          <button type="button" disabled={pending} onClick={onPause}>Pause</button>
        ) : null}
        <button
          type="button"
          className={finished ? 'primary' : 'danger-outline'}
          disabled={pending}
          onClick={onFinish}
        >
          {finished ? 'Confirmer l’irrigation terminée' : 'Arrêter / Terminer'}
        </button>
      </div>
    </article>
  );
}

/**
 * Une irrigation à venir ou à terminer, en une ligne (audit ergonomique,
 * lot 3, point 6, cas 5 et 6, précisions F45 et F47) : l'heure, le matériel,
 * le volume et l'état ; « Fait comme prévu » quand la règle l'accepte,
 * « Démarrer maintenant » et « Modifier » visibles ; « Annuler » rangé dans le
 * menu « … », avec sa confirmation d'avant. La carte entière (durées, note,
 * pompe, planches) s'ouvre d'un geste, et d'elle-même quand un lien y mène.
 */
export function IrrigationRecordCard({
  event,
  beds,
  pending,
  hour,
  status,
  lateness = null,
  blockedReason = null,
  lateSignal = null,
  doneAsPlanned = null,
  onStart,
  onEdit,
  onCancel,
}: {
  event: IrrigationEventRecord;
  beds: Bed[];
  pending: boolean;
  /** « 7 h », « 18 h 30 ». */
  hour: string;
  /** « Non faite », « En retard », « Planifiée », « Partielle ». */
  status: string;
  lateness?: 'late' | 'missed' | null;
  /** Une irrigation planifiée qui ne peut pas démarrer, matériel stocké ou reposé ailleurs (2.11, règle 13). */
  blockedReason?: string | null;
  /** « En retard » ou « Non faite » (3.7, règles 18 à 20) : elle se démarre encore, s'annule à la main, ou le plan se recalcule. */
  lateSignal?: string | null;
  /** La confirmation de « Fait comme prévu », seulement quand la règle l'accepte (F43). */
  doneAsPlanned?: { confirmation: string; onConfirm: () => Promise<void> } | null;
  onStart?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
}) {
  const equipment = event.equipment;
  const anchor = `irrigation-${equipment.id}`;
  const actualVolume = wettedVolumeLiters(equipment.applications, (application) => application.actualAmountMm);
  const plannedVolume = wettedVolumeLiters(equipment.applications, (application) => application.plannedAmountMm);
  const volume = formatWettedVolume(equipment.actualDurationSeconds > 0 ? actualVolume : plannedVolume);
  const title = `${equipment.equipmentSnapshot.name} · ${equipment.settingSnapshot.name}`;
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    // Un lien vers la carte (« Ouvrir » sur « Aujourd'hui ») l'ouvre entière.
    const openFromHash = () => { if (window.location.hash === `#${anchor}`) setDetailsOpen(true); };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [anchor]);
  return (
    <article id={anchor} className="irrigation-record-card irrigation-row" data-lateness={lateness ?? undefined}>
      <div className="irrigation-row-line">
        <span className="irrigation-row-time">{hour}</span>
        <span className="irrigation-row-what">
          <strong>{equipment.equipmentSnapshot.name}</strong>
          <small>{equipment.settingSnapshot.name}{equipment.plannedDurationSeconds > 0 ? ` · ${formatDuration(equipment.plannedDurationSeconds)}` : ''}</small>
        </span>
        <span className="irrigation-row-volume">{volume}</span>
        <span className="event-status" data-status={event.status} data-lateness={lateness ?? undefined}>{status}</span>
      </div>
      {blockedReason ? <p className="event-blocked" role="note">{blockedReason}</p> : null}
      {(doneAsPlanned || onStart || onEdit || onCancel) ? (
        <div className="record-actions">
          {doneAsPlanned ? <DoneAsPlannedButton title={title} confirmation={doneAsPlanned.confirmation} pending={pending} onConfirm={doneAsPlanned.onConfirm} /> : null}
          {onStart ? (
            <button type="button" className={doneAsPlanned ? undefined : 'primary'} disabled={pending || Boolean(blockedReason)} onClick={onStart}>
              {event.status === 'partially_completed' ? 'Reprendre le reliquat' : 'Démarrer maintenant'}
            </button>
          ) : null}
          {onEdit ? <button type="button" disabled={pending} onClick={onEdit}>Modifier</button> : null}
          {onCancel ? (
            <RowMenu label={`Plus d’actions : ${title}`}>
              <button type="button" role="menuitem" className="danger-outline" disabled={pending} onClick={onCancel}>
                {event.status === 'partially_completed' ? 'Annuler le reliquat' : 'Annuler'}
              </button>
            </RowMenu>
          ) : null}
        </div>
      ) : null}
      <details className="irrigation-row-details" open={detailsOpen} onToggle={(toggled) => setDetailsOpen(toggled.currentTarget.open)}>
        <summary>Voir la fiche</summary>
        <dl>
          <div>
            <dt>{event.status === 'planned' ? 'Début prévu' : 'Date'}</dt>
            <dd>{formatDateTime(
              equipment.actualStartAt ?? equipment.plannedStartAt ?? event.createdAt,
            )}</dd>
          </div>
          <div>
            <dt>Durée prévue</dt>
            <dd>{equipment.plannedDurationSeconds > 0
              ? formatDuration(equipment.plannedDurationSeconds)
              : 'Non planifiée'}</dd>
          </div>
          <div>
            <dt>Durée réelle</dt>
            <dd>{equipment.actualDurationSeconds > 0
              ? formatDuration(equipment.actualDurationSeconds)
              : '—'}</dd>
          </div>
          <div>
            <dt>Volume</dt>
            <dd>{volume}</dd>
          </div>
        </dl>
        {event.note ? <p className="event-note">{event.note}</p> : null}
        {lateSignal ? <p className="event-late" role="status" data-lateness={lateness ?? 'late'}>{lateSignal}</p> : null}
        <EventPumpSummary event={event} />
        <ApplicationDetails event={event} beds={beds} />
      </details>
    </article>
  );
}

/**
 * Le menu « … » d'une ligne : les gestes rares ou destructifs y sont rangés,
 * à une cible de 44 px ; il se ferme à Échap, au clic ailleurs et après un
 * choix.
 */
function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current?.open && !(event.target instanceof Node && menu.current.contains(event.target))) menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !menu.current?.open) return;
      menu.current.open = false;
      menu.current.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <details ref={menu} className="row-menu" onClick={(event) => {
      // Un choix dans le menu le referme.
      if (event.target instanceof HTMLElement && event.target.closest('[role="menuitem"]') && menu.current) menu.current.open = false;
    }}>
      <summary aria-label={label} title="Plus d’actions">…</summary>
      <div role="menu">{children}</div>
    </details>
  );
}

function ApplicationDetails({
  event,
  beds,
  elapsedSeconds,
}: {
  event: IrrigationEventRecord;
  beds: Bed[];
  elapsedSeconds?: number;
}) {
  const bedNames = new Map(beds.map((bed) => [bed.id, bed.name]));
  return (
    <details className="application-details">
      <summary>
        {event.equipment.applications.length} planche{event.equipment.applications.length > 1 ? 's' : ''} · détail des apports
      </summary>
      <div className="application-table-wrap">
        <table>
          <thead><tr><th>Planche</th><th>mm/h</th><th>Prévu</th><th>Réel</th></tr></thead>
          <tbody>
            {event.equipment.applications.map((application) => {
              const actual = elapsedSeconds === undefined
                ? application.actualAmountMm
                : millimetersForDurationSeconds(
                    application.rateMmPerHour,
                    elapsedSeconds,
                  );
              return (
                <tr key={application.otfBedId}>
                  <td>{bedNames.get(application.otfBedId) ?? application.otfBedId}</td>
                  <td>{decimalFormatter.format(application.rateMmPerHour)}</td>
                  <td>{oneDecimalFormatter.format(application.plannedAmountMm)} mm</td>
                  <td>{oneDecimalFormatter.format(actual)} mm</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
