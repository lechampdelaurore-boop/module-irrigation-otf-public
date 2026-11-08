'use client';
import type { ClosedPlacementPose } from '@/db/equipment-placement-poses';
import { equipmentPoseState, type PlacementPose } from '@/lib/domain/equipment-placement-periods';
import { closedPoseLabel, poseStateLabel, type BedNameLookup } from '@/lib/domain/equipment-pose-presentation';

/** Ce que l'inventaire sait des poses de la saison (2.11). */
export type EquipmentPoseContext = {
  /** Les poses courantes, posées ou stockées. */
  poses: readonly PlacementPose[];
  /** Les poses fermées, de la plus récente à la plus ancienne. */
  history: readonly ClosedPlacementPose[];
  bedName: BedNameLookup;
  onRemove: (equipmentId: string) => void;
};

/** La pose courante d'un matériel, posée ou stockée. */
export function currentPoseOf(context: EquipmentPoseContext, equipmentId: string): PlacementPose | null {
  return context.poses.find((pose) => pose.equipmentId === equipmentId) ?? null;
}

/**
 * La pose d'un matériel sur sa carte (2.11, contrat, « L'écran ») : l'état en
 * clair, « Retirer (stocker) » quand il est posé, et le pli « Historique des
 * poses », de la plus récente à la plus ancienne.
 */
export function EquipmentPoseStatus({
  equipmentId,
  equipmentName,
  context,
  disabled,
}: {
  equipmentId: string;
  equipmentName: string;
  context: EquipmentPoseContext;
  disabled: boolean;
}) {
  const { bedName } = context;
  const pose = currentPoseOf(context, equipmentId);
  const history = context.history.filter((closed) => closed.equipmentId === equipmentId);
  const state = equipmentPoseState(pose);
  return (
    <div className="equipment-pose" data-state={state.kind}>
      <span className="equipment-pose-state">{poseStateLabel(pose, bedName)}</span>
      {state.kind === 'posed' ? (
        <button
          className="equipment-remove-button"
          type="button"
          disabled={disabled}
          onClick={() => context.onRemove(equipmentId)}
          aria-label={`Retirer et stocker ${equipmentName}`}
        >
          Retirer (stocker)
        </button>
      ) : null}
      {history.length > 0 ? (
        <details className="equipment-pose-history">
          <summary>Historique des poses ({history.length})</summary>
          <ol>
            {history.map((closed) => (
              <li key={closed.historyId}>{closedPoseLabel(closed, bedName)}</li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
