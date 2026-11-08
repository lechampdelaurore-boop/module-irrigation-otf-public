import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import {
  listIrrigationHistoryForUser,
  type IrrigationHistoryScopeFilter,
} from '@/db/irrigation-history-repository';
import { listProtectedSlotHistoryForUser } from '@/db/protected-slots-repository';
import type { ProtectedSlotVersion } from '@/lib/domain/planning/protected-slots';
import { getEnabledFeaturesForUser } from './feature-selection-service';
import {
  listHydricGoalRevisionsThroughWeekForUser,
  listWeatherDailyValuesForUser,
  readWeatherPreferenceForUser,
} from '@/db/water-management-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import {
  HISTORY_PAGE_SIZE,
  type HistoryPeriod,
  type HistoryPeriodSelection,
  type HistoryScope,
  type HistoryScopeInput,
  type IrrigationHistoryExportData,
  type IrrigationHistoryPage,
  type IrrigationHistorySummary,
} from '../domain/irrigation-history/contract';
import { buildIrrigationHistoryItems } from '../domain/irrigation-history/items';
import { resolveHistoryPeriod } from '../domain/irrigation-history/period';
import {
  bedsForHistoryScope,
  historyScopeLabel,
  normalizeHistoryScope,
} from '../domain/irrigation-history/scope';
import { buildIrrigationHistorySummary } from '../domain/irrigation-history/summary';
import {
  countHistoryStatuses,
  DEFAULT_HISTORY_STATUS_FILTER,
  matchesHistoryStatusFilter,
  type HistoryStatusCounts,
  type HistoryStatusFilter,
} from '../domain/irrigation-history/status-filter';
import { weekStartDateKey } from '../domain/water-management';
import { weatherLocationKey } from '../domain/weather/location';

export type IrrigationHistoryDashboard = {
  season: number;
  period: HistoryPeriod;
  scope: HistoryScope;
  scopeLabel: string;
  summary: IrrigationHistorySummary;
  /** Les irrigations listées : réalisées par défaut (audit ergonomique, point 11). */
  statusFilter: HistoryStatusFilter;
  /** Combien d'irrigations de la période et du périmètre derrière chaque filtre. */
  statusCounts: HistoryStatusCounts;
  history: IrrigationHistoryPage;
  warnings: string[];
};

export type IrrigationHistorySelection = {
  period: HistoryPeriodSelection;
  scope: HistoryScopeInput;
  /** Absent : les irrigations réalisées. */
  status?: HistoryStatusFilter;
  page?: number;
};

export async function getIrrigationHistoryDashboardForUser({
  ownerUserId,
  season,
  snapshot,
  selection,
  now = new Date(),
}: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  selection: IrrigationHistorySelection;
  now?: Date;
}): Promise<IrrigationHistoryDashboard> {
  const analysis = await readHistoryAnalysis({
    ownerUserId,
    season,
    snapshot,
    selection,
    now,
  });
  const statusFilter = selection.status ?? DEFAULT_HISTORY_STATUS_FILTER;
  return {
    season,
    period: analysis.period,
    scope: analysis.scope,
    scopeLabel: historyScopeLabel(analysis.scope, snapshot),
    summary: analysis.summary,
    statusFilter,
    statusCounts: countHistoryStatuses(analysis.events.map((event) => event.status)),
    history: buildHistoryPage({
      events: analysis.events.filter((event) => matchesHistoryStatusFilter(event.status, statusFilter)),
      snapshot,
      scope: analysis.scope,
      period: analysis.period,
      requestedPage: selection.page ?? 1,
      protectedSlotVersions: analysis.protectedSlotVersions,
    }),
    warnings: historyWarnings(analysis.summary),
  };
}

export async function getIrrigationHistoryExportForUser({
  ownerUserId,
  season,
  snapshot,
  selection,
  now = new Date(),
}: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  selection: IrrigationHistorySelection;
  now?: Date;
}): Promise<IrrigationHistoryExportData> {
  const analysis = await readHistoryAnalysis({
    ownerUserId,
    season,
    snapshot,
    selection,
    now,
  });
  return {
    season,
    period: analysis.period,
    scope: analysis.scope,
    scopeLabel: historyScopeLabel(analysis.scope, snapshot),
    farmName: snapshot.structure.name,
    summary: analysis.summary,
    // L'export suit le filtre de la liste ; un lien sans filtre exporte tout, comme avant (audit ergonomique, point 11).
    items: buildIrrigationHistoryItems({
      events: analysis.events.filter((event) => matchesHistoryStatusFilter(event.status, selection.status ?? 'all')),
      snapshot,
      scope: analysis.scope,
      period: analysis.period,
      protectedSlotVersions: analysis.protectedSlotVersions,
    }),
    snapshot,
  };
}

async function readHistoryAnalysis({
  ownerUserId,
  season,
  snapshot,
  selection,
  now,
}: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  selection: IrrigationHistorySelection;
  now: Date;
}): Promise<{
  period: HistoryPeriod;
  scope: HistoryScope;
  summary: IrrigationHistorySummary;
  events: IrrigationEventRecord[];
  protectedSlotVersions: ProtectedSlotVersion[];
}> {
  const period = resolveHistoryPeriod(season, selection.period, now);
  const scope = normalizeHistoryScope(selection.scope, snapshot, season);
  const scopeBeds = bedsForHistoryScope(snapshot, season, scope);
  const preference = await readWeatherPreferenceForUser(ownerUserId);
  const locationKey = weatherLocationKey(preference, snapshot.structure) ?? 'unconfigured';
  const repositoryScope: IrrigationHistoryScopeFilter = scope;
  const throughWeek = weekStartDateKey(period.endDate);
  const [events, weather, goalRevisions, protectedSlotVersions] = await Promise.all([
    listIrrigationHistoryForUser(ownerUserId, {
      season,
      startAt: period.startAt,
      endAtExclusive: period.endAtExclusive,
      scope: repositoryScope,
    }),
    listWeatherDailyValuesForUser(
      ownerUserId,
      locationKey,
      period.startDate,
      period.endDate,
    ),
    listHydricGoalRevisionsThroughWeekForUser(ownerUserId, season, throughWeek),
    // Le journal des créneaux protégés : une irrigation faite pendant l'un d'eux le dit sur sa carte (3.8 ter, règle 11),
    // Planning coché seulement : les créneaux sont un réglage du planning, ni affichés ni pris en compte décoché (3.8, R1).
    readProtectedSlotVersions(ownerUserId),
  ]);
  return {
    period,
    scope,
    summary: buildIrrigationHistorySummary({
      events,
      scopeBeds,
      plots: snapshot.plots,
      scope,
      period,
      weather,
      goalRevisions,
    }),
    events,
    protectedSlotVersions,
  };
}

function buildHistoryPage({
  events,
  snapshot,
  scope,
  period,
  requestedPage,
  protectedSlotVersions,
}: {
  events: readonly IrrigationEventRecord[];
  snapshot: IrrigationSnapshot;
  scope: HistoryScope;
  period: HistoryPeriod;
  requestedPage: number;
  protectedSlotVersions: readonly ProtectedSlotVersion[];
}): IrrigationHistoryPage {
  const totalItems = events.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / HISTORY_PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Math.floor(requestedPage) || 1));
  const start = (page - 1) * HISTORY_PAGE_SIZE;
  return {
    items: buildIrrigationHistoryItems({
      events: events.slice(start, start + HISTORY_PAGE_SIZE),
      snapshot,
      scope,
      period,
      protectedSlotVersions,
    }),
    page,
    pageSize: HISTORY_PAGE_SIZE,
    totalItems,
    totalPages,
  };
}

function historyWarnings(summary: IrrigationHistorySummary) {
  const warnings: string[] = [];
  if (!summary.actualRainAvailability.complete) {
    warnings.push(summary.actualRainAvailability.availableDays === 0
      ? 'La pluie réelle est indisponible sur cette période. L’écart à l’objectif ne peut pas être calculé.'
      : `La pluie réelle n’est disponible que pour ${summary.actualRainAvailability.availableDays} jour(s) sur ${summary.actualRainAvailability.totalDays}. L’écart à l’objectif reste indisponible.`);
  }
  if (!summary.et0Availability.complete) {
    warnings.push(summary.et0Availability.availableDays === 0
      ? 'L’ET0 est indisponible sur cette période.'
      : `L’ET0 n’est disponible que pour ${summary.et0Availability.availableDays} jour(s) sur ${summary.et0Availability.totalDays}.`);
  }
  // Une couverture partielle n'est pas une donnée manquante (D-036) : la carte
  // « Objectif » affiche le nombre de journées-planche couvertes.
  if (summary.objectiveAvailability.availableBedDays === 0) {
    warnings.push('Aucun objectif hydrique applicable n’est historisé sur cette période.');
  }
  return warnings;
}

async function readProtectedSlotVersions(ownerUserId: string): Promise<ProtectedSlotVersion[]> {
  const enabled = await getEnabledFeaturesForUser(ownerUserId);
  return enabled.includes('planning') ? listProtectedSlotHistoryForUser(ownerUserId) : [];
}
