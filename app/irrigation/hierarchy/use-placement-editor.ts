'use client';

import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { GardenGroupConfiguration } from '@/lib/domain/garden-group-record';
import type { Bed } from '@/lib/domain/domain';
import { notifyFeasibilityChanged, notifyNeedsSourceChanged } from '@/lib/domain/feasibility-notifications';
import type { PlacementAnchor } from '@/lib/domain/irrigation-domain';
import { removeEquipmentPlacement, upsertEquipmentPlacement } from '@/lib/domain/equipment-placement-state';
import type { PlacementPose } from '@/lib/domain/equipment-placement-periods';
import type { ClosedPlacementPose } from '@/db/equipment-placement-poses';
import { localDateTimeInputValue } from '@/lib/domain/irrigation-timer';
import {
  loadEquipmentPosesAction,
  removeEquipmentPlacementAction,
  saveEquipmentPlacementAction,
} from '../equipment-placement-actions';
import { isoFromLocalInput } from '../irrigation-manager/presentation';
import { type EquipmentInventoryAction, type EquipmentInventoryHandle } from '../equipment-inventory';
import type { RefObject } from 'react';

export type PlacementEditor = {
  equipmentId: string;
  settingId: string;
  anchor: PlacementAnchor | null;
  selectedBedIds: string[];
};

/**
 * Le placement d'un matériel sur le plan : ce que le maraîcher est en train de
 * poser, les planches qu'il a choisies, et l'enregistrement.
 *
 * L'état vit ici plutôt que dans l'écran, mais il appartient toujours à la
 * même instance : un hook n'est qu'un appel de fonction.
 */
export function usePlacementEditor({
  equipmentPlacements,
  equipmentPoses,
  equipmentPoseHistory,
  equipmentById,
  bedById,
  gardenGroupConfiguration,
  season,
  equipmentInventoryRef,
  setZoneId,
  setBedId,
}: {
  equipmentPlacements: EquipmentPlacementRecord[];
  /** Les poses courantes de la saison, posées ou stockées, avec leurs dates (2.11). */
  equipmentPoses: PlacementPose[];
  /** Les poses fermées de la saison, de la plus récente à la plus ancienne. */
  equipmentPoseHistory: ClosedPlacementPose[];
  equipmentById: Map<string, EquipmentListItem>;
  bedById: Map<string, Bed>;
  gardenGroupConfiguration: GardenGroupConfiguration;
  season: number;
  equipmentInventoryRef: RefObject<EquipmentInventoryHandle | null>;
  setZoneId: (value: string | null) => void;
  setBedId: (value: string | null) => void;
}) {
  const [placementEditor, setPlacementEditor] = useState<PlacementEditor | null>(null);
  const [currentEquipmentPlacements, setCurrentEquipmentPlacements] = useState(
    equipmentPlacements,
  );
  const [placementNotice, setPlacementNotice] = useState<string | null>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [highlightedEquipmentId, setHighlightedEquipmentId] = useState<string | null>(null);
  const [placementPending, startPlacementTransition] = useTransition();
  const [currentPoses, setCurrentPoses] = useState(equipmentPoses);
  const [poseHistory, setPoseHistory] = useState(equipmentPoseHistory);
  // La date de la pose qu'on enregistre, et celle d'un retrait en cours de
  // confirmation : maintenant par défaut, reportable dans le passé (2.11, règles 2 et 3).
  const [placementDate, setPlacementDate] = useState('');
  const [removal, setRemoval] = useState<{ equipmentId: string; removedAt: string; error: string | null } | null>(null);

  const refreshPoses = async () => {
    const result = await loadEquipmentPosesAction({ season });
    if (!result.ok) return;
    setCurrentPoses(result.poses);
    setPoseHistory(result.history);
  };

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setCurrentEquipmentPlacements(equipmentPlacements),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, [equipmentPlacements]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCurrentPoses(equipmentPoses);
      setPoseHistory(equipmentPoseHistory);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [equipmentPoses, equipmentPoseHistory]);

  const placementByEquipmentId = useMemo(
    () => new Map(
      currentEquipmentPlacements.map((placement) => [placement.equipmentId, placement]),
    ),
    [currentEquipmentPlacements],
  );
  const poseByEquipmentId = useMemo(
    () => new Map(currentPoses.map((pose) => [pose.equipmentId, pose])),
    [currentPoses],
  );

  /**
   * La position d'où part l'éditeur : la pose ouverte, ou, pour un matériel
   * stocké, la dernière pose — « Reposer » reprend ses planches et son réglage
   * (contrat, « L'écran »).
   */
  const startingPose = (equipmentId: string) =>
    placementByEquipmentId.get(equipmentId) ?? poseByEquipmentId.get(equipmentId) ?? null;

  const startEquipmentPlacement = (equipmentId: string) => {
    const item = equipmentById.get(equipmentId);
    if (!item || item.status !== 'active') return;
    if (item.settings.length === 0) {
      setPlacementError('Ajoutez au moins un réglage avant de placer ce matériel.');
      return;
    }

    const current = startingPose(equipmentId);
    const settingId = current && item.settings.some(
      (setting) => setting.id === current.settingId,
    )
      ? current.settingId
      : item.settings[0].id;
    setPlacementEditor({
      equipmentId,
      settingId,
      anchor: current?.anchor ?? null,
      selectedBedIds: current?.selectedBeds.map((bed) => bed.otfBedId) ?? [],
    });
    setPlacementDate(localDateTimeInputValue(new Date()));
    setPlacementNotice(null);
    setPlacementError(null);
    if (current) {
      setZoneId(current.otfZoneId);
      if (current.anchor.type === 'bed_center') {
        setBedId(current.anchor.anchorBedOtfId);
      }
    }
    window.setTimeout(() => {
      document.getElementById('farm-plan')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  };

  const runEquipmentActionFromPlan = (
    equipmentId: string,
    action: EquipmentInventoryAction,
  ) => {
    equipmentInventoryRef.current?.runAction(equipmentId, action);
  };

  const editorForEquipment = (equipmentId: string): PlacementEditor | null => {
    if (placementEditor?.equipmentId === equipmentId) return placementEditor;
    const item = equipmentById.get(equipmentId);
    if (!item || item.status !== 'active' || item.settings.length === 0) return null;
    const current = startingPose(equipmentId);
    const settingId = current && item.settings.some(
      (setting) => setting.id === current.settingId,
    )
      ? current.settingId
      : item.settings[0].id;
    return {
      equipmentId,
      settingId,
      anchor: current?.anchor ?? null,
      selectedBedIds: current?.selectedBeds.map((bed) => bed.otfBedId) ?? [],
    };
  };

  const chooseBedForPlacement = (equipmentId: string, bed: Bed) => {
    const editor = editorForEquipment(equipmentId);
    const item = equipmentById.get(equipmentId);
    if (!editor || !item) return;

    if (item.kind === 'drip') {
      const alreadySelected = editor.selectedBedIds.includes(bed.id);
      const selectedBedIds = alreadySelected
        ? editor.selectedBedIds.filter((id) => id !== bed.id)
        : [...editor.selectedBedIds, bed.id];
      setPlacementEditor({
        ...editor,
        anchor: selectedBedIds.length > 0
          ? { type: 'bed_center', anchorBedOtfId: selectedBedIds[0] }
          : null,
        selectedBedIds,
      });
    } else {
      setPlacementEditor({
        ...editor,
        anchor: { type: 'bed_center', anchorBedOtfId: bed.id },
        selectedBedIds: [],
      });
    }
    setBedId(bed.id);
    setPlacementError(null);
  };

  const chooseGapForPlacement = (
    equipmentId: string,
    beforeBed: Bed,
    afterBed: Bed,
  ) => {
    const editor = editorForEquipment(equipmentId);
    const item = equipmentById.get(equipmentId);
    if (!editor || !item) return;
    if (item.kind !== 'sprinkler') {
      setPlacementError(
        'Le goutte-à-goutte se positionne en sélectionnant ses planches.',
      );
      return;
    }
    setPlacementEditor({
      ...editor,
      anchor: {
        type: 'between_beds',
        beforeBedOtfId: beforeBed.id,
        afterBedOtfId: afterBed.id,
      },
      selectedBedIds: [],
    });
    setPlacementError(null);
  };

  const savePlacement = () => {
    if (!placementEditor || !placementEquipment || !placementSetting) return;
    const anchor = placementEditor.anchor;
    if (!anchor) {
      setPlacementError(
        placementEquipment.kind === 'drip'
          ? 'Sélectionnez au moins une planche.'
          : 'Choisissez une planche ou un espace entre deux planches.',
      );
      return;
    }

    const anchorBed = anchor.type === 'bed_center'
      ? bedById.get(anchor.anchorBedOtfId)
      : bedById.get(anchor.afterBedOtfId);
    if (!anchorBed) {
      setPlacementError('La planche choisie n’est plus disponible pour cette saison.');
      return;
    }
    const selectedBeds = placementEditor.selectedBedIds.flatMap((id) => {
      const bed = bedById.get(id);
      return bed
        ? [{ otfZoneId: bed.zoneId, otfPlotId: bed.plotId, otfBedId: bed.id }]
        : [];
    });
    const gardenGroupId = gardenGroupConfiguration.groups.find((group) =>
      group.members.some((member) => member.otfPlotId === anchorBed.plotId),
    )?.id ?? null;

    setPlacementError(null);
    startPlacementTransition(async () => {
      const result = await saveEquipmentPlacementAction({
        equipmentId: placementEditor.equipmentId,
        settingId: placementEditor.settingId,
        season,
        gardenGroupId,
        otfZoneId: anchorBed.zoneId,
        otfPlotId: anchorBed.plotId,
        anchor,
        selectedBeds,
      }, isoFromLocalInput(placementDate));
      if (!result.ok) {
        setPlacementError(result.message);
        return;
      }
      setCurrentEquipmentPlacements((current) =>
        upsertEquipmentPlacement(current, result.placement),
      );
      setPlacementEditor(null);
      setPlacementNotice(result.message);
      await refreshPoses();
      notifyFeasibilityChanged();
      notifyNeedsSourceChanged();
    });
  };

  /** « Retirer (stocker) » : ouvre la confirmation, la date proposée à maintenant (règles 2 à 5). */
  const openRemoval = (equipmentId: string) => {
    setRemoval({ equipmentId, removedAt: localDateTimeInputValue(new Date()), error: null });
    setPlacementNotice(null);
  };

  const confirmRemoval = () => {
    if (!removal) return;
    startPlacementTransition(async () => {
      const result = await removeEquipmentPlacementAction({
        equipmentId: removal.equipmentId,
        season,
        removedAt: isoFromLocalInput(removal.removedAt),
      });
      if (!result.ok) {
        setRemoval({ ...removal, error: result.message });
        return;
      }
      setCurrentEquipmentPlacements((current) =>
        removeEquipmentPlacement(current, result.equipmentId),
      );
      if (placementEditor?.equipmentId === result.equipmentId) setPlacementEditor(null);
      setRemoval(null);
      setPlacementNotice(result.message);
      notifyFeasibilityChanged();
      notifyNeedsSourceChanged();
      await refreshPoses();
    });
  };

  const placementEquipment = placementEditor
    ? equipmentById.get(placementEditor.equipmentId) ?? null
    : null;
  const placementSetting = placementEquipment && placementEditor
    ? placementEquipment.settings.find(
        (setting) => setting.id === placementEditor.settingId,
      ) ?? null
    : null;

  /**
   * Prend en compte une position mise à jour ailleurs que dans l'éditeur de
   * plan — aujourd'hui le changement de réglage depuis la fiche du matériel.
   * La faisabilité est prévenue : changer la portée change les planches
   * arrosées, donc la chaîne hydraulique.
   */
  const applyPlacementUpdate = (placement: EquipmentPlacementRecord) => {
    setCurrentEquipmentPlacements((current) =>
      upsertEquipmentPlacement(current, placement),
    );
    notifyFeasibilityChanged();
    notifyNeedsSourceChanged();
  };

  return {
    placementEditor,
    placementEquipment,
    setPlacementEditor,
    applyPlacementUpdate,
    currentEquipmentPlacements,
    placementNotice,
    placementError,
    setPlacementError,
    highlightedEquipmentId,
    setHighlightedEquipmentId,
    placementPending,
    placementByEquipmentId,
    startEquipmentPlacement,
    runEquipmentActionFromPlan,
    chooseBedForPlacement,
    chooseGapForPlacement,
    savePlacement,
    placementDate,
    setPlacementDate,
    currentPoses,
    poseByEquipmentId,
    poseHistory,
    removal,
    setRemoval,
    openRemoval,
    confirmRemoval,
  };
}
