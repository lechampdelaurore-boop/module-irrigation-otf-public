import type { IrrigationEventCreationKind } from '@/lib/domain/irrigation-event-record';


export type IrrigationPreparationMode = 'amount' | 'duration';

export type CreateIrrigationEventActionInput = {
  kind: IrrigationEventCreationKind;
  season: number;
  equipmentId: string;
  settingId: string;
  preparationMode: IrrigationPreparationMode;
  targetMillimeters?: number;
  referenceBedId?: string | null;
  durationMinutes?: number;
  plannedStartAt?: string | null;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  note?: string | null;
  pumpId?: string | null;
  pumpOriginId?: string | null;
  /**
   * La seconde irrigation du même matériel sur un créneau déjà planifié est
   * confirmée par l'utilisateur (audit du 19 novembre 2026, lot G, n° 1,
   * F407) ; sans elle, le serveur n'écrit rien et demande la confirmation.
   */
  confirmScheduleConflict?: boolean;
};

/** Ce que l'utilisateur doit confirmer avant que le serveur écrive (F407). */
export type IrrigationEventConfirmation = {
  kind: 'schedule-conflict';
  plannedStartAt: string;
  plannedEndAt: string;
};

export type IrrigationEventActionResult =
  | { ok: true; message: string; warning?: string }
  | { ok: false; message: string; confirmation?: IrrigationEventConfirmation };
