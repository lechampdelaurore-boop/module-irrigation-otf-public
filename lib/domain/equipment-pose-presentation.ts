import type { EquipmentPlacementRecord } from './equipment-placement-record.ts';
import {
  equipmentPoseState,
  formatFarmMoment,
  plannedIrrigationStartBlock,
  plannedStartBlockMessage,
  poseAt,
  type CountableIrrigation,
  type PlacementPose,
} from './equipment-placement-periods.ts';

/**
 * Ce que l'écran dit de la pose d'un matériel (sous-tranche 2.11, PR 3b ;
 * docs/equipment-placement-periods-contract.md, « L'écran ») : son état en
 * clair, l'endroit, l'historique des poses, le compte de l'inventaire, le
 * signal d'une irrigation planifiée qui ne peut pas démarrer. Les règles
 * restent dans `equipment-placement-periods.ts` ; ici, des mots.
 */

/** Le nom d'une planche de la saison, ou `null` si elle n'y est plus. */
export type BedNameLookup = (bedId: string) => string | null;

/** L'état d'un matériel sur sa carte (règles 1 et 7). */
export function poseStateLabel(current: PlacementPose | null, bedName: BedNameLookup): string {
  const state = equipmentPoseState(current);
  if (state.kind === 'never' || current === null) return 'Jamais posé cette saison';
  if (state.kind === 'stored') return `Stocké depuis le ${formatFarmMoment(state.removedAt)}`;
  // « Posé sur P1, P2 », mais « Posé entre P3 et P4 » pour une aspersion
  // ancrée sur le trait entre deux planches.
  const place = posePlaceLabel(current, bedName);
  const between = current.selectedBeds.length === 0 && current.anchor.type === 'between_beds';
  const where = between ? place : `sur ${place}`;
  return state.placedAt === null
    ? `Posé ${where} · date de pose non renseignée`
    : `Posé ${where} depuis le ${formatFarmMoment(state.placedAt)}`;
}

/**
 * L'endroit d'une pose : les planches cochées d'un goutte-à-goutte, la planche
 * ou l'espace entre deux planches d'une aspersion.
 */
export function posePlaceLabel(
  pose: Pick<EquipmentPlacementRecord, 'anchor' | 'selectedBeds'>,
  bedName: BedNameLookup,
): string {
  const name = (bedId: string) => bedName(bedId) ?? 'une planche absente de cette saison';
  if (pose.selectedBeds.length > 0) return pose.selectedBeds.map((bed) => name(bed.otfBedId)).join(', ');
  if (pose.anchor.type === 'bed_center') return name(pose.anchor.anchorBedOtfId);
  return `entre ${name(pose.anchor.beforeBedOtfId)} et ${name(pose.anchor.afterBedOtfId)}`;
}

/** Une pose fermée, dans l'historique des poses : ses dates, son endroit, son réglage (règle 8). */
export function closedPoseLabel(
  pose: Pick<EquipmentPlacementRecord, 'anchor' | 'selectedBeds'> & { placedAt: string | null; removedAt: string; settingName: string },
  bedName: BedNameLookup,
): string {
  const dates = pose.placedAt === null
    ? `Jusqu’au ${formatFarmMoment(pose.removedAt)}, date de pose non renseignée`
    : `Du ${formatFarmMoment(pose.placedAt)} au ${formatFarmMoment(pose.removedAt)}`;
  return `${dates} · ${posePlaceLabel(pose, bedName)} · ${pose.settingName}`;
}

/** Le compte de l'inventaire : posés et stockés, parmi les matériels actifs. */
export function poseCounts(
  activeEquipmentIds: readonly string[],
  currentPoses: readonly PlacementPose[],
): { posed: number; stored: number } {
  const active = new Set(activeEquipmentIds);
  let posed = 0;
  let stored = 0;
  for (const pose of currentPoses) {
    if (!active.has(pose.equipmentId)) continue;
    if (equipmentPoseState(pose).kind === 'posed') posed += 1;
    else stored += 1;
  }
  return { posed, stored };
}

/**
 * Le signal d'une irrigation planifiée, pas encore démarrée, que la règle 13
 * empêche de démarrer : « Matériel stocké depuis le … » ou « Matériel reposé
 * ailleurs », avec ce qu'il faut faire. `null` quand elle peut démarrer.
 */
export function plannedIrrigationSignal(
  event: CountableIrrigation,
  current: PlacementPose | null,
): string | null {
  if (event.status !== 'planned' || event.equipment.timerState !== null) return null;
  const planned = event.equipment.placementSnapshot as Partial<EquipmentPlacementRecord> | null;
  if (!planned?.anchor) return null;
  const block = plannedIrrigationStartBlock({ anchor: planned.anchor, selectedBeds: planned.selectedBeds ?? [] }, current);
  return block ? plannedStartBlockMessage(block) : null;
}

/**
 * Les positions qu'une irrigation saisie après coup peut utiliser : pour
 * chaque matériel, la pose ouverte à l'heure de début, même fermée depuis
 * (règle 12). `poses` : les poses fermées et les poses courantes ouvertes.
 */
export function placementsOpenAt(poses: readonly PlacementPose[], at: string): EquipmentPlacementRecord[] {
  const byEquipment = new Map<string, PlacementPose[]>();
  for (const pose of poses) byEquipment.set(pose.equipmentId, [...(byEquipment.get(pose.equipmentId) ?? []), pose]);
  return [...byEquipment.values()].flatMap((equipmentPoses) => {
    const open = poseAt(equipmentPoses, at);
    return open ? [positionOnly(open)] : [];
  });
}

function positionOnly(pose: PlacementPose): EquipmentPlacementRecord {
  return {
    id: pose.id,
    equipmentId: pose.equipmentId,
    settingId: pose.settingId,
    season: pose.season,
    gardenGroupId: pose.gardenGroupId,
    otfZoneId: pose.otfZoneId,
    otfPlotId: pose.otfPlotId,
    anchor: pose.anchor,
    selectedBeds: pose.selectedBeds,
  };
}
