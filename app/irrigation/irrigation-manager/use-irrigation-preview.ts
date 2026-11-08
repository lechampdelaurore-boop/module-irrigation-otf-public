'use client';
import { useMemo } from 'react';
import type { Bed } from '@/lib/domain/domain';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { GardenGroupRecord } from '@/lib/domain/garden-group-record';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import type { ProtectedSlot } from '@/lib/domain/planning/protected-slots';
import { manualSlotProtectedWarning } from '@/lib/domain/planning/protected-slots-view';
import { calculateIrrigationCoverage } from '@/lib/domain/irrigation-coverage';
import {
  completedDurationSeconds,
  durationSecondsForTarget,
  millimetersForDurationSeconds,
  irrigationPreviewOrigin,
  plannedStartKnown,
  previewSlot,
} from '@/lib/domain/irrigation-timer';
import {
  evaluateHydraulicFeasibility,
  requestedFlowCubicMetersPerHour,
  resolvePumpOriginAvailability,
  type PumpUsage,
} from '@/lib/domain/pumps';
import type { PumpDashboard } from '@/lib/services/pump-dashboard';
import { wettedAreaSquareMeters } from '@/lib/domain/irrigation-calculations';
import { cubicMetersForFlow, millisecondsFromSeconds } from '@/lib/domain/units';
import type { IrrigationPreparationMode } from '../irrigation-event/contract';
import type { CreationKind } from './presentation';
import { formatDuration, formatVolume, numericInput } from './presentation';

/**
 * Ce que l'écran calcule à partir du formulaire, avant d'écrire quoi que ce
 * soit : le matériel retenu, les planches arrosées, la durée, le volume, et la
 * faisabilité hydraulique de l'irrigation en préparation.
 *
 * Tout est en mémoire ; rien n'est enregistré tant que le maraîcher n'a pas
 * validé.
 */
export function useIrrigationPreview({
  equipment,
  placements,
  groups,
  beds,
  events,
  pumpDashboard,
  now,
  creationKind,
  equipmentId,
  settingId,
  pumpId,
  pumpOriginId,
  preparationMode,
  targetMillimeters,
  durationHours,
  durationMinutes,
  referenceBedId,
  plannedStartAt,
  actualStartAt,
  actualEndAt,
  editingEventEquipmentId,
  protectedSlots = [],
}: {
  equipment: EquipmentListItem[];
  placements: EquipmentPlacementRecord[];
  groups: GardenGroupRecord[];
  beds: Bed[];
  events: IrrigationEventRecord[];
  pumpDashboard: PumpDashboard;
  now: Date;
  creationKind: CreationKind;
  equipmentId: string;
  settingId: string;
  pumpId: string;
  pumpOriginId: string;
  preparationMode: IrrigationPreparationMode;
  targetMillimeters: string;
  durationHours: string;
  durationMinutes: string;
  referenceBedId: string;
  plannedStartAt: string;
  actualStartAt: string;
  actualEndAt: string;
  editingEventEquipmentId: string | null;
  /** Les créneaux protégés de l'exploitation, Planning coché seulement (3.8 ter, règle 12). */
  protectedSlots?: readonly ProtectedSlot[];
}) {
  const placementByEquipmentId = useMemo(
    () => new Map(placements.map((placement) => [placement.equipmentId, placement])),
    [placements],
  );
  const usableEquipment = useMemo(
    () => equipment.filter(
      (item) =>
        item.status === 'active' &&
        item.settings.length > 0 &&
        placementByEquipmentId.has(item.id),
    ),
    [equipment, placementByEquipmentId],
  );
  // Aucun matériel par défaut (audit ergonomique, lot 3, point 6, cas 3) : seul le choix de l'utilisateur en désigne un.
  const selectedEquipment = usableEquipment.find((item) => item.id === equipmentId) ?? null;
  const selectedPlacement = selectedEquipment
    ? placementByEquipmentId.get(selectedEquipment.id) ?? null
    : null;
  const selectedSetting = selectedEquipment?.settings.find(
    (setting) => setting.id === settingId,
  ) ?? selectedEquipment?.settings.find(
    (setting) => setting.id === selectedPlacement?.settingId,
  ) ?? selectedEquipment?.settings[0] ?? null;
  const selectedPump = pumpDashboard.pumps.find((item) => item.id === pumpId && item.status === 'active') ?? null;
  const selectedPumpOrigin = selectedPump?.origins.find((item) => item.id === pumpOriginId)
    ?? selectedPump?.origins.find((item) => item.isDefault) ?? null;

  const preview = useMemo(() => {
    if (!selectedEquipment || !selectedPlacement || !selectedSetting) return null;
    const placement = { ...selectedPlacement, settingId: selectedSetting.id };
    const coverage = calculateIrrigationCoverage({
      beds,
      groups,
      equipment: [selectedEquipment],
      placements: [placement],
    });
    const bedById = new Map(beds.map((bed) => [bed.id, bed]));
    const applications = coverage.beds.flatMap((coveredBed) => {
      const bed = bedById.get(coveredBed.bedId);
      const contribution = coveredBed.contributions.find(
        (candidate) => candidate.equipmentId === selectedEquipment.id,
      );
      return bed && contribution
        ? [{ bed, rateMmPerHour: contribution.rateMmPerHour }]
        : [];
    });
    return { applications, placement };
  }, [beds, groups, selectedEquipment, selectedPlacement, selectedSetting]);

  const effectiveReferenceBedId = preview?.applications.some(
    (application) => application.bed.id === referenceBedId,
  )
    ? referenceBedId
    : preview?.applications[0]?.bed.id ?? '';

  // Inconnue (null) pour une irrigation déjà réalisée dont les dates ne se
  // lisent pas encore : volume et apports le sont alors aussi (point ouvert 45).
  const previewDurationSeconds = useMemo((): number | null => {
    if (creationKind === 'completed') {
      return completedDurationSeconds(Date.parse(actualStartAt), Date.parse(actualEndAt));
    }
    if (preparationMode === 'duration') {
      return Math.max(
        0,
        Math.round(
          (numericInput(durationHours) * 60 + numericInput(durationMinutes)) * 60,
        ),
      );
    }
    const reference = selectedEquipment?.kind === 'sprinkler'
      ? preview?.applications.find(
          (application) => application.bed.id === effectiveReferenceBedId,
        )
      : preview?.applications[0];
    return durationSecondsForTarget(
      numericInput(targetMillimeters),
      reference?.rateMmPerHour ?? 0,
    );
  }, [
    actualEndAt,
    actualStartAt,
    creationKind,
    durationHours,
    durationMinutes,
    preparationMode,
    preview,
    effectiveReferenceBedId,
    selectedEquipment?.kind,
    targetMillimeters,
  ]);

  const previewApplications = useMemo(
    () => (preview?.applications ?? []).map((application) => ({
      ...application,
      amountMm: previewDurationSeconds === null
        ? null
        : millimetersForDurationSeconds(application.rateMmPerHour, previewDurationSeconds),
    })),
    [preview, previewDurationSeconds],
  );
  // Surface mouillée selon la nature du matériel (docs/wetted-surface-contract.md) :
  // nulle en aspersion sans passe-pied connu, et alors volume et débit le sont aussi.
  const previewWettedApplications = previewApplications.map((item) => ({
    ...item,
    wettedAreaSquareMeters: selectedEquipment ? wettedAreaSquareMeters(item.bed, selectedEquipment.kind) : item.bed.area,
  }));
  const previewVolumeLiters = previewWettedApplications.reduce<number | null>(
    (total, application) => total === null || application.amountMm === null || application.wettedAreaSquareMeters === null
      ? null
      : total + application.amountMm * application.wettedAreaSquareMeters,
    0,
  );
  const previewFlowCubicMetersPerHour = requestedFlowCubicMetersPerHour(previewWettedApplications);
  const referenceApplication = selectedEquipment?.kind === 'sprinkler'
    ? preview?.applications.find((application) => application.bed.id === effectiveReferenceBedId)
    : preview?.applications[0];
  // La bulle « d'où vient ce chiffre » de la durée et du volume (3.8).
  const previewOrigin = previewDurationSeconds === null || previewDurationSeconds <= 0 ? null : irrigationPreviewOrigin({
    source: creationKind === 'completed' ? 'completed' : preparationMode,
    targetMm: numericInput(targetMillimeters),
    reference: referenceApplication ? { bedName: referenceApplication.bed.name, rateMmPerHour: referenceApplication.rateMmPerHour } : null,
    durationText: formatDuration(previewDurationSeconds),
    applications: previewWettedApplications.map((application) => ({ bedName: application.bed.name, amountMm: application.amountMm, wettedAreaSquareMeters: application.wettedAreaSquareMeters })),
    volumeText: previewVolumeLiters === null ? null : formatVolume(previewVolumeLiters),
  });
  const hydraulicPreview = useMemo(() => {
    const start = creationKind === 'completed' ? Date.parse(actualStartAt)
      : creationKind === 'planned' ? Date.parse(plannedStartAt) : now.getTime();
    const end = creationKind === 'completed' ? Date.parse(actualEndAt)
      : start + millisecondsFromSeconds(previewDurationSeconds ?? 0);
    const { startsAt, endsAt } = previewSlot(start, end, now.getTime());
    const usages = events.flatMap((event): PumpUsage[] => {
      const item = event.equipment;
      if (item.id === editingEventEquipmentId) return [];
      const usageFlow = item.requestedFlowCubicMetersPerHour;
      if (!item.pumpId || usageFlow === null || usageFlow === undefined || item.timerState === 'paused') return [];
      const usageStart = item.timerState === 'running'
        ? item.timerResumedAt ?? item.actualStartAt ?? item.plannedStartAt
        : item.plannedStartAt;
      const usageEnd = item.timerState === 'running' ? item.timerTheoreticalEndAt : item.plannedEndAt;
      if (!usageStart || !usageEnd || (!item.timerState && !['planned', 'partially_completed'].includes(item.status))) return [];
      return [{ eventEquipmentId: item.id, label: item.equipmentSnapshot.name, pumpId: item.pumpId, startsAt: usageStart, endsAt: usageEnd, requestedFlowCubicMetersPerHour: usageFlow }];
    });
    const originAvailability = selectedPump ? resolvePumpOriginAvailability({
      infrastructure: pumpDashboard.infrastructure,
      origin: selectedPumpOrigin,
      startsAt,
      // Durée inconnue : le créneau éprouvé n'est que la seconde de `previewSlot`.
      requiredVolumeCubicMeters: cubicMetersForFlow(previewFlowCubicMetersPerHour ?? 0, Math.max(0, previewDurationSeconds ?? 0)),
    }) : undefined;
    return evaluateHydraulicFeasibility({
      pump: selectedPump,
      candidate: { eventEquipmentId: 'preview', label: 'Cette irrigation', startsAt, endsAt, requestedFlowCubicMetersPerHour: previewFlowCubicMetersPerHour ?? 0 },
      usages,
      originAvailability,
    });
  }, [actualEndAt, actualStartAt, creationKind, editingEventEquipmentId, events, now, plannedStartAt, previewDurationSeconds, previewFlowCubicMetersPerHour, pumpDashboard.infrastructure, selectedPump, selectedPumpOrigin]);

  // Un arrosage planifié à la main dans un créneau protégé n'est pas bloqué : l'écran avertit et le maraîcher décide (3.8 ter, règle 12).
  const plannedStartMs = Date.parse(plannedStartAt);
  const protectedSlotWarning = creationKind === 'planned' && previewDurationSeconds !== null
    ? manualSlotProtectedWarning(protectedSlots, plannedStartMs, plannedStartMs + millisecondsFromSeconds(previewDurationSeconds))
    : null;

  return {
    usableEquipment,
    selectedEquipment,
    selectedPlacement,
    selectedSetting,
    selectedPump,
    selectedPumpOrigin,
    preview,
    effectiveReferenceBedId,
    previewDurationSeconds,
    previewApplications,
    previewVolumeLiters,
    previewOrigin,
    // Faux pour une irrigation planifiée dont la date de début ne se lit pas
    // encore : rien ne se planifie alors (point ouvert 46).
    previewStartKnown: plannedStartKnown(creationKind, Date.parse(plannedStartAt)),
    hydraulicPreview,
    protectedSlotWarning,
  };
}
