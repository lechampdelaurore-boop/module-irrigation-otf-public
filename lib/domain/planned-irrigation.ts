import type { IrrigationEventRecord } from './irrigation-event-record.ts';
import { cubicMetersFromMillimeters, millisecondsFromMinutes } from './units.ts';
import { splitVolumeAcrossLocalDays } from './water-management.ts';
import type { PlannedWaterUseDay } from './water-resources.ts';

/** Shared 3.3/3.1 horizon: the same remaining millimetres reserve the same water. */
export function remainingPlannedApplications(events: readonly IrrigationEventRecord[], start: Date, end: Date) {
  if (!(end > start)) return [];
  return events.flatMap((event) => {
    const equipment = event.equipment;
    if (event.status === 'canceled' || equipment.status === 'canceled' || equipment.status === 'completed' || equipment.remainingCanceledAt) return [];
    const plannedStart = equipment.timerState ? start.getTime() : Date.parse(equipment.plannedStartAt ?? '');
    const plannedEnd = Date.parse(equipment.timerTheoreticalEndAt ?? equipment.plannedEndAt ?? '');
    if (!Number.isFinite(plannedStart) || !Number.isFinite(plannedEnd) || plannedEnd <= start.getTime() || plannedStart >= end.getTime()) return [];
    const startsAt = new Date(Math.max(start.getTime(), plannedStart));
    const endsAt = new Date(Math.min(end.getTime(), plannedEnd));
    if (!(endsAt > startsAt)) return [];
    const fraction = (endsAt.getTime() - startsAt.getTime()) / Math.max(1, plannedEnd - plannedStart);
    const origin = equipment.pumpOriginSnapshot;
    // Une planche sans surface mouillée connue n'a pas de volume à projeter :
    // elle est laissée de côté plutôt que comptée sur la planche seule.
    return equipment.applications.flatMap((application) => application.wettedAreaSquareMeters === null ? [] : [{
      bedId: application.otfBedId, startsAt, endsAt,
      amountMm: Math.max(0, application.plannedAmountMm - application.actualAmountMm) * fraction,
      areaSquareMeters: application.wettedAreaSquareMeters,
      sourceKey: origin ? `${origin.sourceKind}:${origin.sourceId}` : null,
    }]);
  });
}

export function plannedWaterForPeriod(events: readonly IrrigationEventRecord[], start: Date, end: Date, timeZone: string): PlannedWaterUseDay[] {
  const totals = new Map<string, PlannedWaterUseDay>();
  for (const row of remainingPlannedApplications(events, start, end)) {
    for (const [date, cubicMeters] of splitVolumeAcrossLocalDays({ startAt: row.startsAt, endAt: row.endsAt, cubicMeters: cubicMetersFromMillimeters(row.amountMm, row.areaSquareMeters), timeZone })) {
      const key = `${date}:${row.sourceKey}`;
      const previous = totals.get(key);
      totals.set(key, { date, sourceKey: row.sourceKey, cubicMeters: (previous?.cubicMeters ?? 0) + cubicMeters });
    }
  }
  return [...totals.values()];
}

/**
 * Une irrigation planifiée qui attend son heure ou un geste : ni démarrée, ni
 * enregistrée, ni annulée, avec une heure de début. C'est elle que lisent les
 * blocs de « Aujourd'hui » et que « Fait comme prévu » enregistre.
 */
export function isWaitingPlannedIrrigation(event: IrrigationEventRecord): boolean {
  const equipment = event.equipment;
  return event.status === 'planned'
    && equipment.status === 'planned'
    && !equipment.timerState
    && !equipment.timerStartedAt
    && !equipment.remainingCanceledAt
    && !equipment.canceledAt
    && !event.canceledAt
    && Boolean(equipment.plannedStartAt);
}

/**
 * Le retard d'une irrigation planifiée (docs/replanning-contract.md, règles
 * 18 à 20) : non démarrée une tolérance (R14) après son heure de début, elle
 * est « en retard » ; tout son créneau passé sans démarrage, « non faite ».
 * Nul autrement : à venir, démarrée, terminée, annulée, ou sans heure. Le
 * logiciel ne l'annule jamais ; son eau suit `remainingPlannedApplications`,
 * qui compte la part du créneau restant à venir et plus rien ensuite
 * (règle 19).
 */
export type PlannedIrrigationLateness = 'late' | 'missed';

/**
 * Ce que la règle du retard lit d'une irrigation : son état, son minuteur, ses
 * annulations et son créneau prévu. Une irrigation complète le fournit ; le
 * planning le relit aussi pour une proposition validée (audit ergonomique,
 * lot 3, point 5), sans seconde règle.
 */
export type PlannedIrrigationState = Pick<IrrigationEventRecord, 'status'> & {
  equipment: Pick<IrrigationEventRecord['equipment'], 'status' | 'timerState' | 'timerStartedAt' | 'remainingCanceledAt' | 'canceledAt' | 'plannedStartAt' | 'plannedEndAt'>;
};

export function plannedIrrigationLateness(event: PlannedIrrigationState, toleranceMinutes: number, now: Date): PlannedIrrigationLateness | null {
  const equipment = event.equipment;
  if (event.status !== 'planned' || equipment.status !== 'planned' || equipment.timerState || equipment.timerStartedAt || equipment.remainingCanceledAt || equipment.canceledAt) return null;
  const plannedStart = Date.parse(equipment.plannedStartAt ?? '');
  const plannedEnd = Date.parse(equipment.plannedEndAt ?? '');
  if (!Number.isFinite(plannedStart) || !Number.isFinite(plannedEnd)) return null;
  if (now.getTime() >= plannedEnd) return 'missed';
  if (now.getTime() >= plannedStart + millisecondsFromMinutes(toleranceMinutes)) return 'late';
  return null;
}

/**
 * L'échéance de l'alerte « en retard » (règles 21 et 24) : le début plus la
 * tolérance R14, programmée à la création ou à la modification de
 * l'irrigation planifiée. Nulle quand elle ne servirait à rien : le créneau
 * déjà passé, ou une tolérance qui le dépasse — l'irrigation serait « non
 * faite » avant d'être « en retard ». Une échéance déjà passée mais dans le
 * créneau reste : l'irrigation est en retard dès maintenant.
 */
export function lateAlarmDueAt(plannedStartAt: string, plannedEndAt: string, toleranceMinutes: number, now: Date): string | null {
  const plannedStart = Date.parse(plannedStartAt);
  const plannedEnd = Date.parse(plannedEndAt);
  if (!Number.isFinite(plannedStart) || !Number.isFinite(plannedEnd) || !Number.isFinite(toleranceMinutes)) return null;
  const dueAt = plannedStart + millisecondsFromMinutes(Math.max(0, toleranceMinutes));
  if (plannedEnd <= now.getTime() || dueAt >= plannedEnd) return null;
  return new Date(dueAt).toISOString();
}
