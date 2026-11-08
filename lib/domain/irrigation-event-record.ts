import type {
  EquipmentListItem,
  EquipmentSettingRecord,
} from './equipment-record.ts';
import type { EquipmentPlacementRecord } from './equipment-placement-record.ts';
import type { IrrigationEventStatus } from './irrigation-domain.ts';
import type { IrrigationTimerState } from './irrigation-timer.ts';
import type { PumpOriginSnapshot, PumpSnapshot } from './pumps.ts';

/**
 * Forme d'une irrigation, du projet jusqu'à l'archive. Décision D-020 : c'est
 * une notion du métier, pas une notion de la base ; `db/` l'importe pour dire
 * ce qu'il lit et ce qu'il écrit.
 *
 * Une irrigation garde une copie du matériel, du réglage et de la position au
 * moment où elle a eu lieu. C'est voulu : renommer un matériel ou déplacer une
 * rampe ne doit pas réécrire l'histoire de la ferme.
 */

/** Ce qu'une irrigation apporte à une planche, avant de connaître le résultat. */
export type IrrigationBedApplicationDraft = {
  otfZoneId: string;
  otfPlotId: string;
  otfBedId: string;
  rateMmPerHour: number;
  /** Surface de la planche : elle pondère les millimètres, et ne change pas. */
  bedAreaSquareMeters: number;
  /**
   * Surface qui convertit les millimètres en volume, selon le matériel de
   * l'irrigation (docs/wetted-surface-contract.md) : la planche seule en
   * goutte-à-goutte, la planche et son passe-pied en aspersion. Nulle quand
   * le passe-pied n'était pas connu : le volume est alors inconnu, jamais zéro.
   */
  wettedAreaSquareMeters: number | null;
};

export type IrrigationBedApplicationRecord = IrrigationBedApplicationDraft & {
  plannedAmountMm: number;
  actualAmountMm: number;
};

export type IrrigationEventCreationKind = 'planned' | 'completed' | 'running';

export type IrrigationPushAlarmStatus =
  | 'pending'
  | 'scheduled'
  | 'failed'
  | 'disabled';

/**
 * Les deux alarmes qu'une irrigation porte, une à la fois, sous la même
 * révision : la fin du minuteur (« Irrigation terminée »), et le retard d'une
 * irrigation planifiée non démarrée (3.7, règles 21 et 24) ; le démarrage
 * remplace la seconde par la première.
 */
type IrrigationPushAlarmKind = 'finished' | 'late';

export type IrrigationPushScheduleRecord = {
  workspaceId: string;
  eventEquipmentId: string;
  season: number;
  kind: IrrigationPushAlarmKind;
  revision: string;
  dueAt: string;
  status: IrrigationPushAlarmStatus;
  equipmentName: string;
  settingName: string;
};

type IrrigationEventEquipmentRecord = {
  id: string;
  equipmentId: string;
  settingId: string;
  placementId: string;
  status: IrrigationEventStatus;
  pumpId?: string | null;
  pumpOriginId?: string | null;
  requestedFlowCubicMetersPerHour?: number | null;
  pumpSnapshot?: PumpSnapshot | null;
  pumpOriginSnapshot?: PumpOriginSnapshot | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  equipmentSnapshot: Pick<EquipmentListItem, 'id' | 'name' | 'kind' | 'mobility'>;
  settingSnapshot: EquipmentSettingRecord;
  placementSnapshot: EquipmentPlacementRecord;
  timerState: IrrigationTimerState | null;
  timerStartedAt: string | null;
  timerResumedAt: string | null;
  timerPausedAt: string | null;
  timerTheoreticalEndAt: string | null;
  timerAccumulatedSeconds: number;
  timerAlarmRevision: string | null;
  timerAlarmStatus: IrrigationPushAlarmStatus | null;
  timerAlarmSyncedAt: string | null;
  remainingCanceledAt: string | null;
  canceledAt: string | null;
  applications: IrrigationBedApplicationRecord[];
};

export type IrrigationEventRecord = {
  timerHistory?: Array<{ action: string; at: string; payload: Record<string, unknown> }>;
  id: string;
  season: number;
  status: IrrigationEventStatus;
  note: string | null;
  remainingCanceledAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  equipment: IrrigationEventEquipmentRecord;
};
