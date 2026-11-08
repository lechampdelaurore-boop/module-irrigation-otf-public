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
};

export type IrrigationEventActionResult =
  | { ok: true; message: string; warning?: string }
  | { ok: false; message: string };
