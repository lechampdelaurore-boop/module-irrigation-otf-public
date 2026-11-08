import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import type { IrrigationSnapshot } from '../domain.ts';

export const HISTORY_PERIOD_MODES = ['week', 'month', 'season', 'custom'] as const;
export type HistoryPeriodMode = (typeof HISTORY_PERIOD_MODES)[number];
export const HISTORY_SCOPE_LEVELS = ['farm', 'zone', 'plot', 'bed'] as const;
export type HistoryScopeLevel = (typeof HISTORY_SCOPE_LEVELS)[number];
export const HISTORY_PAGE_SIZE = 12;

export type HistoryPeriodSelection = {
  mode: HistoryPeriodMode;
  anchorDate?: string | null;
  customStartDate?: string | null;
  customEndDate?: string | null;
};

export type HistoryPeriod = {
  mode: HistoryPeriodMode;
  startDate: string;
  endDate: string;
  startAt: string;
  endAtExclusive: string;
};

export type HistoryScopeInput = {
  level: HistoryScopeLevel;
  zoneId?: string | null;
  plotId?: string | null;
  bedId?: string | null;
};

export type HistoryScope = {
  level: HistoryScopeLevel;
  zoneId: string | null;
  plotId: string | null;
  bedId: string | null;
};

export type GoalRevisionLike = {
  id: string;
  weekStart: string;
  scopeType: HistoryScopeLevel;
  otfZoneId: string | null;
  otfPlotId: string | null;
  otfBedId: string | null;
  amountMm: number | null;
  action: 'set' | 'cleared';
  createdAt: string;
  copiedFromGoalId?: string | null;
};

export type WeatherDailyLike = {
  date: string;
  dataKind: 'forecast' | 'reanalysis' | 'manual_precipitation';
  precipitationMm: number | null;
  et0Mm: number | null;
};

export type HistoryAvailability = {
  availableDays: number;
  totalDays: number;
  complete: boolean;
};

export type IrrigationHistorySummary = {
  /** Somme des volumes connus ; incomplète quand `irrigationVolumeIncomplete` est vrai. */
  irrigationCubicMeters: number;
  irrigationVolumeIncomplete: boolean;
  irrigationMm: number | null;
  irrigatedAreaSquareMeters: number;
  actualRainMm: number | null;
  actualRainAvailability: HistoryAvailability;
  et0Mm: number | null;
  et0Availability: HistoryAvailability;
  objectiveMm: number | null;
  objectiveAvailability: {
    availableBedDays: number;
    totalBedDays: number;
    complete: boolean;
  };
  irrigationAndRainMm: number | null;
  gapToObjectiveMm: number | null;
  scopeAreaSquareMeters: number;
};

export type IrrigationTimelineEntry = {
  at: string;
  label: string;
};

export type IrrigationHistoryItem = {
  id: string;
  eventEquipmentId: string;
  date: string;
  status: IrrigationEventRecord['status'];
  statusLabel: string;
  modeLabel: string;
  equipmentName: string;
  settingName: string;
  pumpName?: string | null;
  pumpMaximumFlowCubicMetersPerHour?: number | null;
  requestedFlowCubicMetersPerHour?: number | null;
  pumpOriginName?: string | null;
  locationLabel: string;
  zoneName: string | null;
  plotNames: string[];
  bedNames: string[];
  /** Identifiants OTF des planches arrosées : la colonne « Séries » de l'export s'en sert. */
  bedIds: string[];
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  actualDurationSeconds: number;
  plannedDurationSeconds: number;
  actualAmountMm: number;
  plannedAmountMm: number;
  /** Nul quand une planche arrosée n'a pas de surface mouillée connue : le volume est inconnu, pas zéro. */
  actualCubicMeters: number | null;
  /** Surface de planche, celle qui pondère les millimètres. */
  irrigatedAreaSquareMeters: number;
  /** Surface qui a converti les millimètres en volume (docs/wetted-surface-contract.md), nulle si inconnue. */
  wettedAreaSquareMeters: number | null;
  wettedAreaLabel: string;
  placementLabel: string;
  initialObjectiveMm: number | null;
  partial: boolean;
  stoppedEarly: boolean;
  canceled: boolean;
  note: string | null;
  /** Les créneaux protégés pendant lesquels elle a coulé, ceux en vigueur à son début réel (docs/protected-slots-contract.md, règle 11) ; vide pour ce qui n'a pas été fait. */
  protectedSlotNames: string[];
  timeline: IrrigationTimelineEntry[];
};

export type IrrigationHistoryPage = {
  items: IrrigationHistoryItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export class IrrigationHistoryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IrrigationHistoryInputError';
  }
}

/** Données complètes d'un export d'historique (CSV), composées des types ci-dessus. */
export type IrrigationHistoryExportData = {
  season: number;
  period: HistoryPeriod;
  scope: HistoryScope;
  scopeLabel: string;
  farmName: string;
  summary: IrrigationHistorySummary;
  items: IrrigationHistoryItem[];
  snapshot: IrrigationSnapshot;
};
