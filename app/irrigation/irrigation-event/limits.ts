import { millisecondsFromSeconds } from '@/lib/domain/units';

import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { listDailyWaterLimitsForUser } from '@/db/water-management-repository';
import { formatWaterVolumeForMessage } from '@/lib/domain/irrigation-format';
import {
  buildDailyWaterLedger,
  evaluateDailyWaterLimit,
  FARM_TIME_ZONE,
  firstLimitedDay,
  irrigationVolumeIncomplete,
  remainingIrrigationForStart,
  splitVolumeAcrossLocalDays,
} from '@/lib/domain/water-management';
import {
  IrrigationDailyLimitExceededError,
  IrrigationHydraulicLimitExceededError,
  formatCivilDate,
} from '@/lib/services/irrigation-limits';
import { listCountedIrrigationEventsForUser } from '@/lib/services/counted-irrigation-events';
import { getEnabledFeaturesForUser } from '@/lib/services/feature-selection-service';
import { hydraulicFailureMessage, validatePumpAssignmentForUser } from '@/lib/services/pump-service';

// La garde à la création et l'avis hydraulique vivent désormais dans le
// service `lib/services/irrigation-limits.ts`, que la validation d'une
// proposition du planning emprunte aussi ; les actions les importent d'ici
// comme avant.
export {
  IrrigationDailyLimitExceededError,
  IrrigationHydraulicLimitExceededError,
  enforceDailyLimitForCreation,
  hydraulicWarning,
} from '@/lib/services/irrigation-limits';

export async function enforceDailyLimitForStart(
  ownerUserId: string,
  eventEquipmentId: string,
) {
  // Une irrigation planifiée qui ne peut plus démarrer ne compte pas (D-044) ;
  // si c'est celle qu'on démarre, le démarrage dira pourquoi (règle 13).
  const [events, limits] = await Promise.all([
    listCountedIrrigationEventsForUser(ownerUserId, undefined, true),
    listDailyWaterLimitsForUser(ownerUserId),
  ]);
  const candidate = events.find((event) => event.equipment.id === eventEquipmentId);
  if (!candidate) return;
  const start = new Date();
  const remaining = remainingIrrigationForStart(candidate, start);
  const end = new Date(start.getTime() + millisecondsFromSeconds(remaining.seconds));
  // Une planche sans surface mouillée connue rend le volume invérifiable :
  // sous une limite active, le démarrage comme la reprise sont refusés, même
  // pour une irrigation planifiée avant la limite
  // (docs/wetted-surface-contract.md, point ouvert 24, corrigé le 9 octobre
  // 2026). Jusque-là, seul le volume connu — nul quand toutes les planches
  // sont inconnues — était jugé.
  if (irrigationVolumeIncomplete(candidate.equipment.applications, 'planned')) {
    const limited = firstLimitedDay(limits, start, end);
    if (limited) {
      throw new IrrigationDailyLimitExceededError(
        `Démarrage bloqué : une limite journalière s’applique le ${formatCivilDate(limited)} et le volume de cette aspersion ne peut pas être vérifié, une planche n’ayant pas de passe-pied renseigné dans Ouvre ta ferme.`,
      );
    }
  }
  const violations = evaluateDailyWaterLimit({
    ledger: buildDailyWaterLedger(
      events,
      start,
      FARM_TIME_ZONE,
      eventEquipmentId,
    ),
    candidateByDate: splitVolumeAcrossLocalDays({
      startAt: start,
      endAt: end,
      cubicMeters: remaining.cubicMeters,
    }),
    limits,
  });
  if (violations.length === 0) return;
  const first = violations[0];
  throw new IrrigationDailyLimitExceededError(
    `Démarrage bloqué : limite journalière dépassée le ${formatCivilDate(first.date)}. ` +
    `${formatWaterVolumeForMessage(first.alreadyRealizedCubicMeters)} m³ déjà réalisés, ${formatWaterVolumeForMessage(first.alreadyPlannedCubicMeters)} m³ planifiés, ` +
    `${formatWaterVolumeForMessage(first.candidateCubicMeters)} m³ à démarrer, ` +
    `limite ${formatWaterVolumeForMessage(first.limitCubicMeters)} m³, dépassement prévu ${formatWaterVolumeForMessage(first.exceededByCubicMeters)} m³.`,
  );
}

export async function enforceHydraulicLimitForStart(ownerUserId: string, eventEquipmentId: string) {
  // Ressources et pompes décochée : la pompe n'entre plus dans les calculs des arrosages (3.8, R1, P26).
  if (!(await getEnabledFeaturesForUser(ownerUserId)).includes('ressources')) return;
  const events = await listIrrigationEventsForUser(ownerUserId, undefined, true);
  const event = events.find((item) => item.equipment.id === eventEquipmentId);
  if (!event || !event.equipment.pumpId) return;
  const remainingSeconds = Math.max(1, event.equipment.plannedDurationSeconds - event.equipment.actualDurationSeconds);
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + millisecondsFromSeconds(remainingSeconds));
  const result = await validatePumpAssignmentForUser({
    ownerUserId,
    pumpId: event.equipment.pumpId,
    pumpOriginId: event.equipment.pumpOriginId ?? null,
    applications: event.equipment.applications,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    excludedEventEquipmentId: eventEquipmentId,
  });
  if (!result.feasibility.possible) {
    throw new IrrigationHydraulicLimitExceededError(hydraulicFailureMessage(result.feasibility));
  }
}
