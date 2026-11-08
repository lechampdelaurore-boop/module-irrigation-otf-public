import { type EquipmentKind, type EquipmentMobility } from '@/lib/domain/irrigation-domain';
import type { EquipmentStatus } from '@/lib/domain/equipment-record';

export type EquipmentRow = {
  id: string;
  name: string;
  kind: EquipmentKind;
  mobility: EquipmentMobility;
  status: EquipmentStatus;
  archived_at: string | null;
};

export type SettingRow = {
  id: string;
  equipment_id: string;
  name: string;
  position: number;
  kind: EquipmentKind;
};

export type ProfilePointRow = {
  setting_id: string;
  side: 'left' | 'right';
  distance_meters: number;
  rate_mm_per_hour: number;
};

export type DripRateRow = {
  setting_id: string;
  rate_mm_per_hour: number;
};
