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
import { dateKeys } from '../domain/irrigation-history/dates';
import { readAutomaticObjectiveSourceForUser } from './automatic-objective-source';
import {
  countHistoryStatuses,
  DEFAULT_HISTORY_STATUS_FILTER,
  matchesHistoryStatusFilter,
  type HistoryStatusCounts,
  type HistoryStatusFilter,
} from '../domain/irrigation-history/status-filter';
import { weekStartDateKey } from '../domain/water-management';
import { weatherLocationKey } from '../domain/weather/location';
import { readWeatherPreference } from './weather-preference';
import { countText } from '../domain/clock-text.ts';

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
  const preference = await readWeatherPreference(ownerUserId);
  const locationKey = weatherLocationKey(preference, snapshot.structure) ?? 'unconfigured';
  const repositoryScope: IrrigationHistoryScopeFilter = scope;
  const throughWeek = weekStartDateKey(period.endDate);
  const [events, weather, goalRevisions, protectedSlotVersions, automatic] = await Promise.all([
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
    // L'objectif automatique, quand la ferme l'a allumé sur la période (D-309) : les jours sans objectif saisi.
    readAutomaticObjectiveSourceForUser({ ownerUserId, season, snapshot, from: period.startDate, to: period.endDate, now }),
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
      automaticObjective: automatic?.dayValuesFor(scopeBeds, dateKeys(period.startDate, period.endDate)),
      automaticObjectiveProvisionalWeeks: automatic?.provisionalWeeks,
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
      : `La pluie réelle n’est disponible que pour ${countText(summary.actualRainAvailability.availableDays, 'jour')} sur ${summary.actualRainAvailability.totalDays}. L’écart à l’objectif reste indisponible.`);
  }
  if (!summary.et0Availability.complete) {
    warnings.push(summary.et0Availability.availableDays === 0
      ? 'L’ET0 est indisponible sur cette période.'
      : `L’ET0 n’est disponible que pour ${countText(summary.et0Availability.availableDays, 'jour')} sur ${summary.et0Availability.totalDays}.`);
  }
  // Une couverture partielle n'est pas une donnée manquante (D-036) : la carte
  // « Objectif » affiche le nombre de journées-planche couvertes.
  if (summary.objectiveAvailability.availableBedDays === 0) {
    warnings.push('Aucune eau visée n’est enregistrée sur cette période.');
  }
  // L'objectif automatique sans valeur un jour n'est jamais compté pour zéro en silence (D-003, D-309).
  const automaticMissing = summary.objectiveAutomatic?.missingBedDays ?? 0;
  if (automaticMissing > 0) {
    warnings.push(`L’objectif automatique n’a pas de valeur pour ${countText(automaticMissing, 'journée-planche', 'journées-planche')} (jours au-delà de la prévision météo, ET0 manquante ou hors bornes, jardin à classer, plan de culture non lu) : l’objectif et l’écart ne les comptent pas.`);
  }
  // Une semaine close pas encore enregistrée par la tâche du matin se relit : son objectif automatique est provisoire (règle 6, D-318).
  const provisional = summary.objectiveAutomatic?.provisionalWeeks ?? 0;
  if (provisional > 0) {
    warnings.push(`${provisional > 1
      ? `L’objectif automatique de ${provisional} semaines closes est provisoire : elles ne sont pas encore enregistrées`
      : 'L’objectif automatique d’une semaine close est provisoire : elle n’est pas encore enregistrée'}, la tâche du matin le fera. D’ici là, il se relit sur la météo et le plan de culture du jour.`);
  }
  return warnings;
}

async function readProtectedSlotVersions(ownerUserId: string): Promise<ProtectedSlotVersion[]> {
  const enabled = await getEnabledFeaturesForUser(ownerUserId);
  return enabled.includes('planning') ? listProtectedSlotHistoryForUser(ownerUserId) : [];
}
