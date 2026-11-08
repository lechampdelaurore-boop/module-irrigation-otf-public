'use server';
import type { IrrigationBedApplicationDraft, IrrigationEventCreationKind } from '@/lib/domain/irrigation-event-record';
import type { PlanEventKind } from '@/lib/domain/planning/contract';
import type {
  CreateIrrigationEventActionInput,
  IrrigationEventActionResult,
} from './irrigation-event/contract';
import {
  IrrigationHydraulicLimitExceededError,
  enforceDailyLimitForCreation,
  enforceDailyLimitForStart,
  enforceHydraulicLimitForStart,
  hydraulicWarning,
} from './irrigation-event/limits';
import {
  creationMessage,
  expiredSession,
  handledError,
  joinWarnings,
  warningMessage,
} from './irrigation-event/messages';
import { resolveCompletedTiming, resolveTiming } from './irrigation-event/timing';
import { normalizeNote, validateBaseInput } from './irrigation-event/validation';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/app/access-auth';
import { listEquipmentForUser } from '@/db/equipment/read';
import { listGardenGroupConfigurationForUser } from '@/db/garden-group-repository';
import { readIrrigationEventAnchorForUser } from '@/db/irrigation-event/read';
import {
  cancelPlannedIrrigationForUser,
  cancelRemainingIrrigationForUser,
  finishIrrigationEventForUser,
} from '@/db/irrigation-event/completion';
import { createIrrigationEventForUser, updatePlannedIrrigationForUser } from '@/db/irrigation-event/create';
import { IrrigationEventInputError } from '@/db/irrigation-event/errors';
import {
  pauseIrrigationEventForUser,
  resumeIrrigationEventForUser,
  startIrrigationEventForUser,
} from '@/db/irrigation-event/timer';
import { readPlanningSettingsForUser } from '@/db/planning-repository';
import { readHydraulicRevisionForUser, readWaterBudgetRevisionForUser } from '@/db/workspace-repository';
import { listPumpConfigurationForUser } from '@/db/pump-repository';
import { logJsonLine } from '@/lib/adapters/log';
import { wettedAreaSquareMeters } from '@/lib/domain/irrigation-calculations';
import { calculateIrrigationCoverage } from '@/lib/domain/irrigation-coverage';
import { irrigationPlacementForUser } from '@/lib/services/irrigation-placement-service';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import {
  cancelIrrigationPushScheduleBeforeMutation,
  synchronizeIrrigationPushSchedule,
} from '@/lib/services/irrigation-push-orchestration';
import { recalculatePlanAfterEvent } from '@/lib/services/planning-recalculation';
import { getEnabledFeaturesForUser } from '@/lib/services/feature-selection-service';
import { hydraulicFailureMessage, validatePumpAssignmentForUser } from '@/lib/services/pump-service';

/** L'événement que fait une irrigation enregistrée, pour le plan (3.7, règle 4). */
const CREATION_PLAN_EVENTS: Record<IrrigationEventCreationKind, PlanEventKind> = {
  planned: 'irrigation-planned',
  completed: 'irrigation-recorded',
  running: 'irrigation-started',
};

export async function createIrrigationEventAction(
  input: CreateIrrigationEventActionInput,
): Promise<IrrigationEventActionResult> {
  return saveIrrigationEventAction(input, null);
}

export async function updatePlannedIrrigationAction(
  input: CreateIrrigationEventActionInput & { eventEquipmentId: string },
): Promise<IrrigationEventActionResult> {
  return saveIrrigationEventAction({ ...input, kind: 'planned' }, input.eventEquipmentId);
}

async function saveIrrigationEventAction(
  input: CreateIrrigationEventActionInput,
  eventEquipmentId: string | null,
): Promise<IrrigationEventActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return expiredSession();

  try {
    validateBaseInput(input);
    const snapshot = await getIrrigationSnapshot(user.userId, {
      season: input.season,
      forceRefresh: false,
    });
    const [equipmentList, pumpConfiguration, enabledFeatures] = await Promise.all([
      listEquipmentForUser(user.userId),
      listPumpConfigurationForUser(user.userId),
      getEnabledFeaturesForUser(user.userId),
    ]);
    // Ressources et pompes décochée (3.8, R1, P26) : aucune pompe par défaut, et la faisabilité hydraulique
    // ne bloque ni n'avertit ; une pompe déjà portée par l'irrigation modifiée reste la sienne.
    const pumpsEnabled = enabledFeatures.includes('ressources');
    const equipment = equipmentList.find(
      (candidate) => candidate.id === input.equipmentId && candidate.status === 'active',
    );
    const setting = equipment?.settings.find(
      (candidate) => candidate.id === input.settingId,
    );
    // Saisie après coup : les heures réelles, lues avant tout, choisissent la
    // pose ouverte à l'heure de début, même retirée depuis (2.11, règle 12).
    const completedTiming = equipment && input.kind === 'completed'
      ? resolveCompletedTiming(input)
      : null;
    const placement = equipment
      ? await irrigationPlacementForUser({
          ownerUserId: user.userId,
          season: input.season,
          equipmentId: equipment.id,
          completed: completedTiming && {
            actualStartAt: completedTiming.actualStartAt,
            actualEndAt: completedTiming.actualEndAt,
          },
        })
      : null;
    if (!equipment || !placement || !setting) {
      throw new IrrigationEventInputError(
        'Le matériel, son réglage ou sa position n’est plus disponible.',
      );
    }

    const seasonBeds = snapshot.beds.filter((bed) =>
      bed.seasons.includes(input.season),
    );
    const seasonPlots = snapshot.plots.filter((plot) =>
      plot.seasons.includes(input.season),
    );
    const groups = await listGardenGroupConfigurationForUser(
      user.userId,
      input.season,
      seasonPlots.map((plot) => ({
        otfZoneId: plot.zoneId,
        otfPlotId: plot.id,
      })),
    );
    const eventPlacement = { ...placement, settingId: setting.id };
    const coverage = calculateIrrigationCoverage({
      beds: seasonBeds,
      groups: groups.groups,
      equipment: [equipment],
      placements: [eventPlacement],
    });
    const bedById = new Map(seasonBeds.map((bed) => [bed.id, bed]));
    const applications: IrrigationBedApplicationDraft[] = coverage.beds.flatMap(
      (bedCoverage) => {
        const bed = bedById.get(bedCoverage.bedId);
        const contribution = bedCoverage.contributions.find(
          (candidate) => candidate.equipmentId === equipment.id,
        );
        if (!bed || !contribution || bed.area <= 0) return [];
        return [{
          otfZoneId: bed.zoneId,
          otfPlotId: bed.plotId,
          otfBedId: bed.id,
          rateMmPerHour: contribution.rateMmPerHour,
          bedAreaSquareMeters: bed.area,
          // La surface qui fera le volume : celle du matériel de cette irrigation
          // (docs/wetted-surface-contract.md), inconnue sans passe-pied en aspersion.
          wettedAreaSquareMeters: wettedAreaSquareMeters(bed, equipment.kind),
        }];
      },
    );
    if (applications.length === 0) {
      throw new IrrigationEventInputError(
        'Ce réglage n’irrigue aucune planche depuis sa position actuelle.',
      );
    }

    const timing = resolveTiming(input, equipment.kind, applications);
    const selectedPumpId = input.pumpId === undefined
      ? pumpsEnabled ? pumpConfiguration.equipmentDefaults.find((entry) => entry.equipmentId === equipment.id)?.pumpId ?? null : null
      : input.pumpId;
    const hydraulicRevision = await readHydraulicRevisionForUser(user.userId);
    const hydraulic = await validatePumpAssignmentForUser({
      ownerUserId: user.userId,
      pumpId: selectedPumpId,
      pumpOriginId: input.pumpOriginId ?? null,
      applications,
      startsAt: (input.kind === 'completed' ? timing.actualStartAt : timing.plannedStartAt)!,
      endsAt: (input.kind === 'completed' ? timing.actualEndAt : timing.plannedEndAt)!,
      excludedEventEquipmentId: eventEquipmentId,
    });
    if (pumpsEnabled && input.kind !== 'completed' && !hydraulic.feasibility.possible) {
      throw new IrrigationHydraulicLimitExceededError(hydraulicFailureMessage(hydraulic.feasibility));
    }
    const waterBudgetRevision = await readWaterBudgetRevisionForUser(user.userId);
    // À la modification, l'irrigation modifiée est retirée du journal du jour :
    // son ancien volume planifié ne compte pas en plus du nouveau (point
    // ouvert 13, corrigé le 9 octobre 2026).
    const dailyLimitWarning = await enforceDailyLimitForCreation(
      user.userId,
      input.kind,
      timing,
      applications,
      eventEquipmentId,
    );
    const draft = {
      kind: input.kind,
      waterBudgetRevision,
      hydraulicRevision,
      season: input.season,
      note: normalizeNote(input.note),
      equipment,
      setting,
      placement: eventPlacement,
      plannedStartAt: timing.plannedStartAt,
      plannedEndAt: timing.plannedEndAt,
      actualStartAt: timing.actualStartAt,
      actualEndAt: timing.actualEndAt,
      plannedDurationSeconds: timing.plannedDurationSeconds,
      actualDurationSeconds: timing.actualDurationSeconds,
      applications,
      pumpAssignment: hydraulic.assignment,
    };
    // Une irrigation planifiée porte l'alerte « en retard » pour son début plus la tolérance R14 (3.7, règles 21 et 24) ;
    // à la modification, l'alerte en place est retirée avant d'être reprogrammée au nouveau créneau.
    const alarmOptions = input.kind === 'planned'
      ? { lateToleranceMinutes: (await readPlanningSettingsForUser(user.userId)).lateToleranceMinutes }
      : {};
    if (eventEquipmentId) await cancelIrrigationPushScheduleBeforeMutation(user.userId, eventEquipmentId);
    const result = eventEquipmentId
      ? await updatePlannedIrrigationForUser(user.userId, eventEquipmentId, draft, alarmOptions)
      : await createIrrigationEventForUser(user.userId, draft, alarmOptions);
    const pushWarning = await synchronizeIrrigationPushSchedule(
      user.userId,
      result,
    );
    // L'irrigation est enregistrée ; le plan de sa semaine se recalcule autour (3.7, règle 4), après la réponse.
    await recalculatePlanAfterEvent(user.userId, {
      kind: eventEquipmentId ? 'irrigation-updated' : CREATION_PLAN_EVENTS[input.kind],
      season: input.season,
      at: timing.actualStartAt ?? timing.plannedStartAt ?? new Date(),
    });

    revalidatePath('/irrigation');
    return {
      ok: true,
      message: eventEquipmentId ? 'L’irrigation planifiée a été modifiée.' : creationMessage(input.kind),
      warning: joinWarnings(warningMessage(result), dailyLimitWarning, pumpsEnabled ? hydraulicWarning(hydraulic.feasibility, input.kind) : undefined, pushWarning),
    };
  } catch (error) {
    return handledError(error);
  }
}

export async function startIrrigationEventAction(
  eventEquipmentId: string,
): Promise<IrrigationEventActionResult> {
  return mutateEvent(eventEquipmentId, async (userId) => {
    const revision = await readWaterBudgetRevisionForUser(userId);
    const hydraulicRevision = await readHydraulicRevisionForUser(userId);
    await enforceDailyLimitForStart(userId, eventEquipmentId);
    await enforceHydraulicLimitForStart(userId, eventEquipmentId);
    const result = await startIrrigationEventForUser(userId, eventEquipmentId, revision, hydraulicRevision);
    const pushWarning = await synchronizeIrrigationPushSchedule(userId, result);
    return {
      message: 'L’irrigation a démarré.',
      warning: joinWarnings(warningMessage(result), pushWarning),
      planEvent: 'irrigation-started',
    };
  });
}

export async function pauseIrrigationEventAction(
  eventEquipmentId: string,
): Promise<IrrigationEventActionResult> {
  // La pause et la reprise ne font pas recalculer le plan (3.7, règle 5).
  return mutateEvent(eventEquipmentId, async (userId) => {
    await cancelIrrigationPushScheduleBeforeMutation(userId, eventEquipmentId);
    await pauseIrrigationEventForUser(userId, eventEquipmentId);
    return { message: 'L’irrigation est en pause.' };
  });
}

export async function resumeIrrigationEventAction(
  eventEquipmentId: string,
): Promise<IrrigationEventActionResult> {
  return mutateEvent(eventEquipmentId, async (userId) => {
    const revision = await readWaterBudgetRevisionForUser(userId);
    const hydraulicRevision = await readHydraulicRevisionForUser(userId);
    await enforceDailyLimitForStart(userId, eventEquipmentId);
    await enforceHydraulicLimitForStart(userId, eventEquipmentId);
    const result = await resumeIrrigationEventForUser(userId, eventEquipmentId, revision, hydraulicRevision);
    const pushWarning = await synchronizeIrrigationPushSchedule(userId, result);
    return {
      message: 'L’irrigation a repris.',
      warning: joinWarnings(warningMessage(result), pushWarning),
    };
  });
}

export async function finishIrrigationEventAction(input: {
  eventEquipmentId: string;
  actualEndAt?: string | null;
}): Promise<IrrigationEventActionResult> {
  return mutateEvent(input.eventEquipmentId, async (userId) => {
    await cancelIrrigationPushScheduleBeforeMutation(
      userId,
      input.eventEquipmentId,
    );
    const status = await finishIrrigationEventForUser(
      userId,
      input.eventEquipmentId,
      input.actualEndAt ?? null,
    );
    return {
      message: status === 'completed'
        ? 'L’irrigation réalisée a été enregistrée.'
        : 'L’irrigation partielle a été enregistrée. Le reliquat reste planifié.',
      planEvent: status === 'completed' ? 'irrigation-completed' : 'irrigation-partially-completed',
    };
  });
}

export async function cancelPlannedIrrigationAction(
  eventEquipmentId: string,
): Promise<IrrigationEventActionResult> {
  return mutateEvent(eventEquipmentId, async (userId) => {
    // L'alerte « en retard » part avec l'irrigation (3.7, règle 24).
    await cancelIrrigationPushScheduleBeforeMutation(userId, eventEquipmentId);
    await cancelPlannedIrrigationForUser(userId, eventEquipmentId);
    return { message: 'L’irrigation planifiée a été annulée.', planEvent: 'irrigation-canceled' };
  });
}

export async function cancelRemainingIrrigationAction(
  eventEquipmentId: string,
): Promise<IrrigationEventActionResult> {
  return mutateEvent(eventEquipmentId, async (userId) => {
    await cancelRemainingIrrigationForUser(userId, eventEquipmentId);
    return { message: 'Le reliquat planifié a été annulé.', planEvent: 'irrigation-remaining-canceled' };
  });
}

/**
 * Une mutation d'irrigation, puis, si elle en est un, l'événement qu'elle
 * fait pour le plan (3.7, règle 4) : la saison et le début de l'irrigation
 * datent l'événement ; une semaine autre que la courante ne fait pas
 * recalculer (règle 5). La mutation est faite quoi qu'il arrive au plan.
 */
async function mutateEvent(
  eventEquipmentId: string,
  mutation: (
    userId: string,
  ) => Promise<{ message: string; warning?: string; planEvent?: PlanEventKind }>,
): Promise<IrrigationEventActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return expiredSession();
  try {
    const { planEvent, ...result } = await mutation(user.userId);
    if (planEvent) await recalculatePlanAfterIrrigation(user.userId, eventEquipmentId, planEvent);
    revalidatePath('/irrigation');
    return { ok: true, ...result };
  } catch (error) {
    return handledError(error);
  }
}

async function recalculatePlanAfterIrrigation(userId: string, eventEquipmentId: string, kind: PlanEventKind): Promise<void> {
  try {
    const anchor = await readIrrigationEventAnchorForUser(userId, eventEquipmentId);
    if (anchor) await recalculatePlanAfterEvent(userId, { kind, season: anchor.season, at: anchor.startAt });
  } catch (error) {
    // L'irrigation est enregistrée ; le plan se recalculera au prochain événement ou à la demande.
    logJsonLine('warn', { event: 'planning_event_anchor_failed', kind, error: error instanceof Error ? error.message : 'unknown', failedAt: new Date().toISOString() });
  }
}
