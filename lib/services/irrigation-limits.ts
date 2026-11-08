import { listDailyWaterLimitsForUser } from '@/db/water-management-repository';
import { formatWaterVolumeForMessage } from '@/lib/domain/irrigation-format';
import type { IrrigationBedApplicationDraft, IrrigationEventCreationKind } from '@/lib/domain/irrigation-event-record';
import type { HydraulicFeasibility } from '@/lib/domain/pumps';
import { cubicMetersFromMillimeters, millimetersForRate } from '@/lib/domain/units';
import {
  buildDailyWaterLedger,
  dailyLimitViolationPolicy,
  evaluateDailyWaterLimit,
  FARM_TIME_ZONE,
  firstLimitedDay,
  splitVolumeAcrossLocalDays,
} from '@/lib/domain/water-management';
import { listCountedIrrigationEventsForUser } from './counted-irrigation-events';
import { hydraulicFailureMessage } from './pump-service';

/**
 * La limite journalière à la création d'une irrigation (2.8), et l'avis
 * hydraulique qui accompagne une irrigation enregistrée. Déplacé ici depuis
 * `app/irrigation/irrigation-event/limits.ts` le 29 septembre 2026, sans
 * changement de comportement, pour que la validation d'une proposition du
 * planning (3.5) passe par la même garde et se teste sous Node.
 */

/** Les dates et durées d'une irrigation à créer, telles que l'action les résout. */
export type IrrigationTiming = {
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
};

export class IrrigationDailyLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IrrigationDailyLimitExceededError';
  }
}

export class IrrigationHydraulicLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IrrigationHydraulicLimitExceededError';
  }
}

export function hydraulicWarning(
  result: HydraulicFeasibility,
  kind: IrrigationEventCreationKind,
) {
  if (result.reasons.includes('pump_missing')) return 'Faisabilité hydraulique non vérifiée : aucune pompe renseignée.';
  if (kind === 'completed' && result.excessFlowCubicMetersPerHour > 0) {
    return `Dépassement historique conservé : ${hydraulicFailureMessage(result).replace('Action bloquée : ', '')}`;
  }
  if (result.originAvailability.status !== 'available') return result.originAvailability.message;
  return undefined;
}

/**
 * La limite journalière à la création (2.8). Une irrigation planifiée ou
 * démarrée qui dépasse une limite, ou dont le volume ne peut pas être vérifié
 * sous une limite active, est refusée : la garde lève
 * `IrrigationDailyLimitExceededError`, que l'action « Planifier » rend en
 * échec et la validation d'une proposition en refus. Une irrigation réelle
 * reste enregistrable : la garde rend alors l'avertissement à afficher, ou
 * rien. La modification d'une irrigation planifiée est jugée comme une
 * création, son propre volume planifié retiré du journal
 * (`excludedEventEquipmentId`) : seul le volume modifié est comparé à la
 * limite, jamais l'ancien en plus du nouveau (docs/irrigation-data-model.md,
 * point ouvert 13, corrigé le 9 octobre 2026).
 */
export async function enforceDailyLimitForCreation(
  ownerUserId: string,
  kind: IrrigationEventCreationKind,
  timing: IrrigationTiming,
  applications: readonly IrrigationBedApplicationDraft[],
  excludedEventEquipmentId: string | null = null,
): Promise<string | undefined> {
  const durationSeconds = kind === 'completed'
    ? timing.actualDurationSeconds
    : timing.plannedDurationSeconds;
  const startAt = kind === 'completed' ? timing.actualStartAt : timing.plannedStartAt;
  const endAt = kind === 'completed' ? timing.actualEndAt : timing.plannedEndAt;
  if (!startAt || !endAt) return undefined;
  const [events, limits] = await Promise.all([
    listCountedIrrigationEventsForUser(ownerUserId, undefined, true),
    listDailyWaterLimitsForUser(ownerUserId),
  ]);

  // Une planche sans surface mouillée connue rend le volume invérifiable. Une
  // irrigation réelle reste enregistrable — ses millimètres sont la vérité —
  // mais une irrigation planifiée ou démarrée est refusée dès qu'une limite
  // journalière s'applique à ses jours (docs/wetted-surface-contract.md). Le
  // refus est levé, pas rendu : rendu, l'action l'enregistrait en
  // avertissement (point ouvert 12, corrigé le 4 octobre 2026). Le jour limité
  // se cherche dans le domaine, `firstLimitedDay`, règle partagée avec la
  // garde du démarrage (point ouvert 24, corrigé le 9 octobre 2026).
  const volumeUnknown = applications.some((application) => application.wettedAreaSquareMeters === null);
  if (volumeUnknown && kind !== 'completed') {
    const limited = firstLimitedDay(limits, startAt, endAt);
    if (limited) {
      throw new IrrigationDailyLimitExceededError(
        `Irrigation refusée : une limite journalière s’applique le ${formatCivilDate(limited)} et le volume de cette aspersion ne peut pas être vérifié, une planche n’ayant pas de passe-pied renseigné dans Ouvre ta ferme.`,
      );
    }
  }
  const totalCubicMeters = applications.reduce(
    (total, application) => application.wettedAreaSquareMeters === null ? total : total +
      cubicMetersFromMillimeters(millimetersForRate(application.rateMmPerHour, durationSeconds),
      application.wettedAreaSquareMeters),
    0,
  );
  if (totalCubicMeters <= 0) return undefined;
  const violations = evaluateDailyWaterLimit({
    ledger: buildDailyWaterLedger(events, new Date(), FARM_TIME_ZONE, excludedEventEquipmentId ?? undefined)
      .map((day) => kind === 'completed' ? { ...day, plannedCubicMeters: 0, estimatedOngoingCubicMeters: 0 } : day),
    candidateByDate: splitVolumeAcrossLocalDays({
      startAt,
      endAt,
      cubicMeters: totalCubicMeters,
    }),
    limits,
  });
  if (violations.length === 0) return undefined;
  const first = violations[0];
  const message = `Limite journalière dépassée le ${formatCivilDate(first.date)} : ` +
    `${formatWaterVolumeForMessage(first.alreadyRealizedCubicMeters)} m³ déjà réalisés, ${formatWaterVolumeForMessage(first.alreadyPlannedCubicMeters)} m³ planifiés, ` +
    `${formatWaterVolumeForMessage(first.candidateCubicMeters)} m³ pour cette irrigation, ` +
    `${formatWaterVolumeForMessage(first.alreadyEstimatedCubicMeters)} m³ en cours estimés, ` +
    `limite ${formatWaterVolumeForMessage(first.limitCubicMeters)} m³, dépassement ${formatWaterVolumeForMessage(first.exceededByCubicMeters)} m³.`;
  if (dailyLimitViolationPolicy(kind) === 'warn') {
    return `${message} L’enregistrement réel a été conservé.`;
  }
  throw new IrrigationDailyLimitExceededError(message);
}

export function formatCivilDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`));
}
