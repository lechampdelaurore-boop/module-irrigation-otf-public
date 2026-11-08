import { listEquipmentPosesForUser, placementRecord } from '@/db/equipment-placement-poses';
import { listEquipmentForUser } from '@/db/equipment/read';
import { listGardenGroupConfigurationForUser } from '@/db/garden-group-repository';
import { createIrrigationEventForUser } from '@/db/irrigation-event/create';
import { IrrigationEventInputError } from '@/db/irrigation-event/errors';
import { decidePlanProposalForUser, readLatestPlanForUser, readPlanningSettingsForUser } from '@/db/planning-repository';
import { readHydraulicRevisionForUser, readWaterBudgetRevisionForUser } from '@/db/workspace-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import { posedPlacements, proposalValidationBlock, proposalValidationBlockMessage } from '../domain/equipment-placement-periods';
import { wettedAreaSquareMeters } from '../domain/irrigation-calculations';
import { calculateIrrigationCoverage } from '../domain/irrigation-coverage';
import type { IrrigationBedApplicationDraft } from '../domain/irrigation-event-record';
import { effectiveProposalStatus, type StoredProposal } from '../domain/planning/contract';
import { adjustProposalTiming, isAdjusted, type ProposalAdjustment } from '../domain/planning/presentation';
import { FARM_TIME_ZONE, weekStartDateKey } from '../domain/water-management';
import {
  IrrigationDailyLimitExceededError,
  IrrigationHydraulicLimitExceededError,
  enforceDailyLimitForCreation,
  hydraulicWarning,
} from './irrigation-limits';
import { synchronizeIrrigationPushSchedule } from './irrigation-push-orchestration';
import { hydraulicFailureMessage, validatePumpAssignmentForUser } from './pump-service';

/**
 * Valider ou refuser une proposition du planning (docs/planning-contract.md,
 * « L'objet planifié », « Les statuts »). Une proposition validée devient une
 * irrigation planifiée ordinaire, par le même circuit que « Planifier » :
 * matériel, réglage et position tels qu'ils sont à cet instant, pompe
 * vérifiée par la 3.2, limite journalière vérifiée par la 2.8. Le registre
 * retient l'irrigation créée. Rien ne se valide deux fois. Un ajustement —
 * déplacer le début, réduire ou augmenter la dose — passe les mêmes gardes
 * (« Interface (3.6) », « Notes de mise en œuvre (3.6) »).
 */

export type ProposalValidationResult =
  | { ok: true; proposalId: string; eventId: string; warning?: string }
  | { ok: false; proposalId: string; message: string };

export async function validatePlanProposalForUser({
  ownerUserId,
  season,
  snapshot,
  proposalId,
  actorUserId,
  adjustment = null,
  now = new Date(),
}: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  /** L'identifiant du registre (`storedId`). */
  proposalId: string;
  actorUserId: string;
  /** Le début et la dose voulus à la place de ceux de la proposition ; la durée suit la dose. */
  adjustment?: ProposalAdjustment | null;
  now?: Date;
}): Promise<ProposalValidationResult> {
  const refused = (message: string): ProposalValidationResult => ({ ok: false, proposalId, message });
  const stored = await readLatestPlanForUser(ownerUserId, season, weekStartDateKey(now, FARM_TIME_ZONE));
  const proposal = stored?.proposals.find((candidate) => candidate.storedId === proposalId);
  if (!proposal) return refused('Cette proposition n’existe plus : le plan a été recalculé.');
  const status = effectiveProposalStatus(proposal, now);
  if (status === 'validated') return refused('Cette proposition a déjà été validée.');
  if (status === 'refused') return refused('Cette proposition a été refusée.');
  if (status === 'replaced') return refused('Cette proposition a été remplacée par un calcul plus récent.');
  if (status === 'expired') return refused('Le créneau de cette proposition est passé : recalculez le plan.');
  const timing = adjustment ? adjustProposalTiming(proposal, adjustment) : proposal;
  if (!timing) return refused('L’ajustement n’est pas lisible : indiquez une dose strictement positive et un début.');
  if (adjustment && Date.parse(timing.endAt) <= now.getTime()) return refused('Le créneau ajusté est déjà terminé : choisissez un début plus tard.');
  if (adjustment && stored && Date.parse(timing.endAt) > Date.parse(stored.calculation.horizonEndAt)) {
    return refused('Le créneau ajusté doit finir au plus tard dimanche minuit : c’est la semaine du plan.');
  }
  const adjusted = adjustment !== null && isAdjusted(proposal, timing);

  try {
    const draftParts = await buildDraftParts(ownerUserId, season, snapshot, proposal, stored?.calculation.computedAt ?? proposal.calculatedAt);
    const hydraulicRevision = await readHydraulicRevisionForUser(ownerUserId);
    const hydraulic = await validatePumpAssignmentForUser({
      ownerUserId,
      pumpId: proposal.pumpId,
      pumpOriginId: proposal.pumpOriginId,
      applications: draftParts.applications,
      startsAt: timing.startAt,
      endsAt: timing.endAt,
    });
    if (!hydraulic.feasibility.possible) {
      return refused(hydraulicFailureMessage(hydraulic.feasibility));
    }
    const plannedTiming = {
      plannedStartAt: timing.startAt,
      plannedEndAt: timing.endAt,
      actualStartAt: null,
      actualEndAt: null,
      plannedDurationSeconds: timing.durationSeconds,
      actualDurationSeconds: 0,
    };
    const waterBudgetRevision = await readWaterBudgetRevisionForUser(ownerUserId);
    // La limite journalière garde la validation comme elle garde « Planifier » :
    // dépassement, ou volume invérifiable sous une limite active, la garde lève
    // `IrrigationDailyLimitExceededError`, rendue « refusée » plus bas.
    await enforceDailyLimitForCreation(ownerUserId, 'planned', plannedTiming, draftParts.applications);

    const created = await createIrrigationEventForUser(ownerUserId, {
      kind: 'planned',
      waterBudgetRevision,
      hydraulicRevision,
      season,
      note: `Planning du ${formatComputedAt(stored?.calculation.computedAt ?? now.toISOString())} · proposition ${proposal.id}${adjusted ? ` ajustée (${formatDose(timing.doseMm)} mm, début le ${formatComputedAt(timing.startAt)})` : ''}`,
      equipment: draftParts.equipment,
      setting: draftParts.setting,
      placement: draftParts.placement,
      plannedStartAt: timing.startAt,
      plannedEndAt: timing.endAt,
      actualStartAt: null,
      actualEndAt: null,
      plannedDurationSeconds: timing.durationSeconds,
      actualDurationSeconds: 0,
      applications: draftParts.applications,
      pumpAssignment: hydraulic.assignment,
    }, { lateToleranceMinutes: (await readPlanningSettingsForUser(ownerUserId)).lateToleranceMinutes });
    // L'alerte « en retard » de l'irrigation validée, comme pour « Planifier » (3.7, règles 21 et 24).
    const pushWarning = await synchronizeIrrigationPushSchedule(ownerUserId, created);
    const decided = await decidePlanProposalForUser(ownerUserId, { proposalId, status: 'validated', validatedEventId: created.eventId, actorUserId });
    const warnings = [
      decided ? undefined : 'L’irrigation a été planifiée mais la proposition avait été décidée entre-temps.',
      created.scheduleConflictCount > 0 ? 'Ce matériel possède déjà une irrigation planifiée sur ce créneau.' : undefined,
      hydraulicWarning(hydraulic.feasibility, 'planned'),
      pushWarning,
    ].filter((warning): warning is string => Boolean(warning));
    return { ok: true, proposalId, eventId: created.eventId, warning: warnings.length > 0 ? warnings.join(' ') : undefined };
  } catch (error) {
    if (error instanceof IrrigationEventInputError || error instanceof IrrigationDailyLimitExceededError || error instanceof IrrigationHydraulicLimitExceededError) {
      return refused(error.message);
    }
    if (error instanceof Error && /WATER_BUDGET_CHANGED|HYDRAULIC_CHANGED/.test(error.message)) {
      return refused('Les données ont changé pendant la validation. Réessayez.');
    }
    throw error;
  }
}

export async function refusePlanProposalForUser({ ownerUserId, proposalId, actorUserId }: { ownerUserId: string; proposalId: string; actorUserId: string }): Promise<boolean> {
  return decidePlanProposalForUser(ownerUserId, { proposalId, status: 'refused', validatedEventId: null, actorUserId });
}

/**
 * Le matériel, le réglage, la position et les planches arrosées **tels qu'ils
 * sont à la validation** : la couverture est recalculée, et si elle n'arrose
 * plus les mêmes planches que la proposition, celle-ci est refusée plutôt
 * que validée sur des bases périmées. Un matériel retiré, ou reposé, depuis
 * le calcul refuse la validation avec un message qui le nomme, dit quand et
 * ce qu'il faut faire (2.11, règle 14).
 */
async function buildDraftParts(ownerUserId: string, season: number, snapshot: IrrigationSnapshot, proposal: StoredProposal, calculatedAt: string) {
  const [equipmentList, poses] = await Promise.all([
    listEquipmentForUser(ownerUserId),
    listEquipmentPosesForUser(ownerUserId, season),
  ]);
  const equipment = equipmentList.find((candidate) => candidate.id === proposal.equipmentId && candidate.status === 'active');
  const current = poses.find((candidate) => candidate.equipmentId === proposal.equipmentId) ?? null;
  const block = equipment ? proposalValidationBlock({ equipmentName: equipment.name, calculatedAt, current }) : null;
  if (block) throw new IrrigationEventInputError(proposalValidationBlockMessage(block));
  const [placement] = posedPlacements(current ? [current] : []).map(placementRecord);
  const setting = equipment?.settings.find((candidate) => candidate.id === proposal.settingId);
  if (!equipment || !placement || !setting) {
    throw new IrrigationEventInputError('Le matériel, son réglage ou sa position n’est plus disponible : recalculez le plan.');
  }
  if (placement.settingId !== setting.id) {
    throw new IrrigationEventInputError('Le réglage appliqué à ce matériel a changé depuis le calcul : recalculez le plan.');
  }
  const seasonBeds = snapshot.beds.filter((bed) => bed.seasons.includes(season));
  const seasonPlots = snapshot.plots.filter((plot) => plot.seasons.includes(season));
  const groups = await listGardenGroupConfigurationForUser(ownerUserId, season, seasonPlots.map((plot) => ({ otfZoneId: plot.zoneId, otfPlotId: plot.id })));
  const coverage = calculateIrrigationCoverage({ beds: seasonBeds, groups: groups.groups, equipment: [equipment], placements: [placement] });
  const bedById = new Map(seasonBeds.map((bed) => [bed.id, bed]));
  const applications: IrrigationBedApplicationDraft[] = coverage.beds.flatMap((bedCoverage) => {
    const bed = bedById.get(bedCoverage.bedId);
    const contribution = bedCoverage.contributions.find((candidate) => candidate.equipmentId === equipment.id);
    if (!bed || !contribution || bed.area <= 0) return [];
    return [{
      otfZoneId: bed.zoneId,
      otfPlotId: bed.plotId,
      otfBedId: bed.id,
      rateMmPerHour: contribution.rateMmPerHour,
      bedAreaSquareMeters: bed.area,
      wettedAreaSquareMeters: wettedAreaSquareMeters(bed, equipment.kind),
    }];
  });
  const proposedBeds = proposal.applications.map((application) => application.otfBedId).sort().join(',');
  const currentBeds = applications.map((application) => application.otfBedId).sort().join(',');
  if (proposedBeds !== currentBeds) {
    throw new IrrigationEventInputError('La position de ce matériel a changé depuis le calcul : recalculez le plan.');
  }
  return { equipment, setting, placement, applications };
}

function formatComputedAt(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: FARM_TIME_ZONE }).format(new Date(value));
}

function formatDose(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
}
