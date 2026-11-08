'use client';

import { useMemo } from 'react';
import type { Bed } from '@/lib/domain/domain';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { irrigationList, type IrrigationListItem } from '@/lib/domain/irrigation-list';
import { latenessLabel } from '@/lib/domain/planning/follow-up';
import { allDone, doneAsPlannedConfirmations } from '@/lib/domain/today/all-done';
import { lateIrrigationLines } from '@/lib/domain/today/today-irrigations';
import { IrrigationRecordCard } from './irrigation-cards';

/**
 * Les irrigations à venir ou à terminer (audit ergonomique, lot 3, point 6,
 * docs/audit-ergonomie-lot3-contract.md, section 3, cas 5 à 7) : « À
 * traiter » en tête, avec les « Non faite » et les « En retard », puis une
 * ligne par irrigation, rangée par jour. « Fait comme prévu » n'apparaît que
 * sur une irrigation que la règle de « Tout est fait » accepte : planifiée,
 * jamais démarrée, son heure de fin passée.
 */
export function UpcomingIrrigations({
  events,
  beds,
  now,
  lateToleranceMinutes,
  pending,
  blockedReason,
  onRecalculatePlan,
  onStart,
  onEdit,
  onCancel,
  onDoneAsPlanned,
}: {
  /** Les planifiées non démarrées et les partielles à terminer. */
  events: IrrigationEventRecord[];
  beds: Bed[];
  now: Date;
  lateToleranceMinutes: number;
  pending: boolean;
  blockedReason: (event: IrrigationEventRecord) => string | null;
  /** « Recalculer le plan », une fois pour tout le bloc « À traiter » ; absent sans le planning. */
  onRecalculatePlan?: () => void;
  onStart: (event: IrrigationEventRecord) => void;
  onEdit: (event: IrrigationEventRecord) => void;
  onCancel: (event: IrrigationEventRecord) => void;
  onDoneAsPlanned: (event: IrrigationEventRecord) => Promise<void>;
}) {
  const list = useMemo(() => irrigationList(events, lateToleranceMinutes, now), [events, lateToleranceMinutes, now]);
  // La règle de « Tout est fait », lue ligne à ligne : la même fonction, la même confirmation (F43).
  const confirmations = useMemo(() => {
    const bedNames = new Map(beds.map((bed) => [bed.id, bed.name]));
    const lines = lateIrrigationLines({ enabled: ['arrosages'], now, events, lateToleranceMinutes, bedNames });
    return doneAsPlannedConfirmations(allDone({ lines, events, now }));
  }, [beds, events, lateToleranceMinutes, now]);
  if (events.length === 0) return null;

  const row = (item: IrrigationListItem) => {
    const event = item.event;
    const confirmation = confirmations.get(event.equipment.id);
    return (
      <IrrigationRecordCard
        key={event.id}
        event={event}
        beds={beds}
        pending={pending}
        hour={item.hour}
        status={item.status}
        lateness={item.lateness}
        blockedReason={blockedReason(event)}
        lateSignal={latenessLabel(event, lateToleranceMinutes, now)}
        doneAsPlanned={confirmation ? { confirmation, onConfirm: () => onDoneAsPlanned(event) } : null}
        onStart={() => onStart(event)}
        onEdit={event.status === 'planned' ? () => onEdit(event) : undefined}
        onCancel={() => onCancel(event)}
      />
    );
  };

  return (
    <div className="upcoming-irrigations">
      <h3>À venir ou à terminer</h3>
      {list.toHandle.length > 0 ? (
        <section className="irrigation-to-handle" aria-labelledby="irrigation-to-handle-title">
          <header>
            <h4 id="irrigation-to-handle-title">À traiter ({list.toHandle.length})</h4>
            <p>Passées sans démarrage : faites-les, démarrez-les ou annulez-les.</p>
            {onRecalculatePlan ? <button type="button" disabled={pending} onClick={onRecalculatePlan}>Recalculer le plan</button> : null}
          </header>
          <div className="irrigation-row-list">{list.toHandle.map(row)}</div>
        </section>
      ) : null}
      {list.days.map((day) => (
        <section key={day.day} className="irrigation-day" aria-label={day.title}>
          <h4>{day.title}</h4>
          <div className="irrigation-row-list">{day.items.map(row)}</div>
        </section>
      ))}
    </div>
  );
}
