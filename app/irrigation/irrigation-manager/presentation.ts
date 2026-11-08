'use client';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import {
  LITERS_PER_CUBIC_METER,
  SECONDS_PER_HOUR,
  cubicMetersFromLiters,
  hoursFromSeconds,
} from '@/lib/domain/units';

import type { PumpDashboard } from '@/lib/services/pump-dashboard';
import { type PumpOrigin } from '@/lib/domain/pumps';
import { activeTimerSeconds, remainingTimerSeconds } from '@/lib/domain/irrigation-timer';

export type CreationKind = 'running' | 'planned' | 'completed';

export const decimalFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 2,
});

export const oneDecimalFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

export function pumpOriginLabel(
  origin: PumpOrigin,
  dashboard: PumpDashboard,
) {
  return origin.sourceKind === 'resource'
    ? dashboard.infrastructure.resources.find((item) => item.id === origin.resourceId)?.name ?? 'Ressource'
    : dashboard.infrastructure.reservoirs.find((item) => item.id === origin.reservoirId)?.name ?? 'Réserve';
}

export function elapsedForEvent(event: IrrigationEventRecord, now: Date) {
  const equipment = event.equipment;
  if (!equipment.timerState) return equipment.actualDurationSeconds;
  return activeTimerSeconds({
    state: equipment.timerState,
    resumedAt: equipment.timerResumedAt,
    pausedAt: equipment.timerPausedAt,
    accumulatedSeconds: equipment.timerAccumulatedSeconds,
    targetDurationSeconds: equipment.plannedDurationSeconds,
  }, now);
}

export function remainingForEvent(event: IrrigationEventRecord, now: Date) {
  const equipment = event.equipment;
  if (!equipment.timerState) return 0;
  return remainingTimerSeconds({
    state: equipment.timerState,
    resumedAt: equipment.timerResumedAt,
    pausedAt: equipment.timerPausedAt,
    accumulatedSeconds: equipment.timerAccumulatedSeconds,
    targetDurationSeconds: equipment.plannedDurationSeconds,
  }, now);
}

export function countLiveOverlapBeds(events: readonly IrrigationEventRecord[]) {
  const counts = new Map<string, number>();
  events.forEach((event) => {
    event.equipment.applications.forEach((application) => {
      counts.set(application.otfBedId, (counts.get(application.otfBedId) ?? 0) + 1);
    });
  });
  return [...counts.values()].filter((count) => count > 1).length;
}

export function creationButtonLabel(kind: CreationKind) {
  if (kind === 'running') return 'Démarrer l’irrigation';
  if (kind === 'planned') return 'Planifier l’irrigation';
  return 'Enregistrer l’irrigation réalisée';
}

export function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const roundedMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

export function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(hoursFromSeconds(safe));
  const minutes = Math.floor((safe % SECONDS_PER_HOUR) / 60);
  const remainingSeconds = safe % 60;
  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function formatRate(rate: number) {
  return `${decimalFormatter.format(rate)} mm/h`;
}

/**
 * Volume d'une irrigation en litres, millimètres de chaque planche sur sa surface
 * mouillée (docs/wetted-surface-contract.md). Nul dès qu'une planche arrosée n'a
 * pas de surface connue : un volume partiel se lirait comme un volume.
 */
export function wettedVolumeLiters<T extends { wettedAreaSquareMeters: number | null }>(
  applications: readonly T[],
  millimeters: (application: T) => number,
): number | null {
  let total = 0;
  for (const application of applications) {
    const amount = millimeters(application);
    if (application.wettedAreaSquareMeters === null) {
      if (amount > 0) return null;
      continue;
    }
    total += amount * application.wettedAreaSquareMeters;
  }
  return total;
}

export function formatWettedVolume(liters: number | null) {
  return liters === null ? 'Inconnu — passe-pied non renseigné' : formatVolume(liters);
}

export function formatVolume(liters: number) {
  if (!Number.isFinite(liters) || liters < 0) return '—';
  if (liters > LITERS_PER_CUBIC_METER) return `${decimalFormatter.format(cubicMetersFromLiters(liters))} m³`;
  return `${decimalFormatter.format(liters)} L`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateTimeFormatter.format(date) : '—';
}

export function numericInput(value: string) {
  return Number(value.replace(',', '.')) || 0;
}

export function isoFromLocalInput(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
