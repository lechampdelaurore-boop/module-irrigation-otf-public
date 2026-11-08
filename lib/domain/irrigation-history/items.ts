import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { describeWettedArea } from '../irrigation-calculations.ts';
import { cubicMetersFromMillimeterSquareMeters } from '../units.ts';
import type { IrrigationSnapshot } from '../domain.ts';
import { protectedNamesBetween, protectedSlotsInForceAt, type ProtectedSlotVersion } from '../planning/protected-slots.ts';
import { irrigationActiveIntervals } from '../water-management.ts';
import {
  HISTORY_PAGE_SIZE,
  type HistoryPeriod,
  type HistoryScope,
  type IrrigationHistoryItem,
  type IrrigationHistoryPage,
  type IrrigationTimelineEntry,
} from './contract.ts';
import { eventDisplayAt } from './dates.ts';
import { applicationMatchesScope, placementLabel, unique } from './scope.ts';
import { actualFractionInsidePeriod, contributesRealWater } from './summary.ts';

export function buildIrrigationHistoryItems({
  events,
  snapshot,
  scope,
  period,
  protectedSlotVersions = [],
}: {
  events: readonly IrrigationEventRecord[];
  snapshot: IrrigationSnapshot;
  scope: HistoryScope;
  period: HistoryPeriod;
  /** Le journal des créneaux protégés de l'exploitation, du plus récent au plus ancien ; vide : aucun signal. */
  protectedSlotVersions?: readonly ProtectedSlotVersion[];
}): IrrigationHistoryItem[] {
  const zoneNames = new Map(snapshot.zones.map((zone) => [zone.id, zone.name]));
  const plotNames = new Map(snapshot.plots.map((plot) => [plot.id, plot.name]));
  const bedNames = new Map(snapshot.beds.map((bed) => [bed.id, bed.name]));

  return events.map((event) => {
    const applications = event.equipment.applications.filter((application) =>
      applicationMatchesScope(application, scope));
    const fraction = contributesRealWater(event)
      ? actualFractionInsidePeriod(event, period)
      : 0;
    const actual = applicationMetrics(applications, 'actual', fraction);
    const planned = applicationMetrics(applications, 'planned', 1);
    const plots = unique(applications.map((application) =>
      plotNames.get(application.otfPlotId) ?? application.otfPlotId));
    const beds = unique(applications.map((application) =>
      bedNames.get(application.otfBedId) ?? application.otfBedId));
    const zoneId = applications[0]?.otfZoneId ?? null;
    const zoneName = zoneId ? zoneNames.get(zoneId) ?? zoneId : null;
    const date = eventDisplayAt(event);
    return {
      id: event.id,
      eventEquipmentId: event.equipment.id,
      date,
      status: event.status,
      statusLabel: irrigationStatusLabel(event),
      modeLabel: irrigationModeLabel(event),
      equipmentName: event.equipment.equipmentSnapshot.name,
      settingName: event.equipment.settingSnapshot.name,
      pumpName: event.equipment.pumpSnapshot?.name ?? null,
      pumpMaximumFlowCubicMetersPerHour: event.equipment.pumpSnapshot?.maximumFlowCubicMetersPerHour ?? null,
      requestedFlowCubicMetersPerHour: event.equipment.requestedFlowCubicMetersPerHour ?? null,
      pumpOriginName: event.equipment.pumpOriginSnapshot?.name ?? null,
      locationLabel: plots.length === 1 ? plots[0] : `${plots.length} jardins ou abris`,
      zoneName,
      plotNames: plots,
      bedNames: beds,
      bedIds: unique(applications.map((application) => application.otfBedId)),
      plannedStartAt: event.equipment.plannedStartAt,
      plannedEndAt: event.equipment.plannedEndAt,
      actualStartAt: event.equipment.actualStartAt,
      actualEndAt: event.equipment.actualEndAt,
      actualDurationSeconds: event.equipment.actualDurationSeconds,
      plannedDurationSeconds: event.equipment.plannedDurationSeconds,
      actualAmountMm: actual.weightedMm,
      plannedAmountMm: planned.weightedMm,
      actualCubicMeters: actual.cubicMeters,
      irrigatedAreaSquareMeters: actual.uniqueArea,
      wettedAreaSquareMeters: actual.wettedArea,
      wettedAreaLabel: describeWettedArea(event.equipment.equipmentSnapshot.kind, actual.wettedArea),
      placementLabel: placementLabel(event, bedNames),
      initialObjectiveMm: null,
      partial: event.status === 'partially_completed',
      stoppedEarly: event.status === 'partially_completed',
      canceled: event.status === 'canceled',
      note: event.note,
      protectedSlotNames: protectedSlotNamesOf(event, protectedSlotVersions),
      timeline: buildIrrigationTimeline(event),
    };
  }).sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id));
}

/**
 * Les créneaux protégés pendant lesquels une irrigation réelle a coulé
 * (docs/protected-slots-contract.md, règle 11) : ceux qui étaient en vigueur
 * à son début réel, sur ses périodes d'arrosage, pauses exclues. Elle reste
 * enregistrée telle quelle et ne reçoit aucune suggestion.
 */
function protectedSlotNamesOf(event: IrrigationEventRecord, versions: readonly ProtectedSlotVersion[]): string[] {
  if (versions.length === 0 || !contributesRealWater(event)) return [];
  const intervals = irrigationActiveIntervals(event);
  if (intervals.length === 0) return [];
  const slots = protectedSlotsInForceAt(versions, intervals[0].startAt);
  return unique(intervals.flatMap((interval) => protectedNamesBetween(slots, interval.startAt, interval.endAt)));
}

export function paginateIrrigationHistory(
  items: readonly IrrigationHistoryItem[],
  requestedPage: number,
  pageSize = HISTORY_PAGE_SIZE,
): IrrigationHistoryPage {
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(requestedPage) || 1));
  const start = (page - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    page,
    pageSize: safePageSize,
    totalItems,
    totalPages,
  };
}

export function buildIrrigationTimeline(
  event: IrrigationEventRecord,
): IrrigationTimelineEntry[] {
  return (event.timerHistory ?? []).flatMap((entry) => {
    if (entry.payload.eventEquipmentId
      && entry.payload.eventEquipmentId !== event.equipment.id) return [];
    const timerAction = entry.payload.timerAction;
    let label: string | null = null;
    if (entry.action === 'created') {
      label = entry.payload.kind === 'running'
        ? 'Démarrage'
        : entry.payload.kind === 'planned'
          ? 'Planification'
          : 'Enregistrement comme déjà réalisée';
    } else if (timerAction === 'started') label = 'Démarrage';
    else if (timerAction === 'paused') label = 'Pause';
    else if (timerAction === 'resumed') label = 'Reprise';
    else if (timerAction === 'remaining_canceled') label = 'Annulation du reliquat';
    else if (entry.action === 'partially_completed') label = 'Arrêt anticipé';
    else if (entry.action === 'completed') label = entry.payload.asPlanned === true ? 'Faite comme prévu' : 'Confirmation de fin';
    else if (entry.action === 'canceled') label = 'Annulation';
    else if (entry.action === 'updated') label = 'Mise à jour';
    if (!label) return [];
    const actualEndAt = typeof entry.payload.actualEndAt === 'string'
      ? entry.payload.actualEndAt
      : null;
    return [{ at: actualEndAt ?? entry.at, label }];
  }).sort((left, right) => left.at.localeCompare(right.at));
}

function irrigationStatusLabel(event: IrrigationEventRecord) {
  if (event.status === 'completed') return 'Terminée';
  if (event.status === 'canceled') return 'Annulée';
  if (event.status === 'partially_completed') {
    return event.remainingCanceledAt ? 'Partielle · reliquat annulé' : 'Partielle';
  }
  if (event.equipment.timerState === 'running') return 'En cours';
  if (event.equipment.timerState === 'paused') return 'En pause';
  return 'Planifiée';
}

function applicationMetrics(
  applications: readonly IrrigationEventRecord['equipment']['applications'][number][],
  kind: 'actual' | 'planned',
  fraction: number,
) {
  // Deux surfaces, jamais confondues (docs/wetted-surface-contract.md) : la
  // planche pondère les millimètres, la surface mouillée fait le volume.
  let millimeterSquareMeters = 0;
  let wettedMillimeterSquareMeters = 0;
  let wettedUnknown = false;
  const areas = new Map<string, number>();
  const wettedAreas = new Map<string, number>();
  for (const application of applications) {
    const area = Math.max(0, application.bedAreaSquareMeters);
    const amount = Math.max(0, kind === 'actual'
      ? application.actualAmountMm
      : application.plannedAmountMm) * fraction;
    millimeterSquareMeters += amount * area;
    if (amount > 0) areas.set(application.otfBedId, area);
    if (application.wettedAreaSquareMeters === null) {
      if (amount > 0) wettedUnknown = true;
      continue;
    }
    wettedMillimeterSquareMeters += amount * application.wettedAreaSquareMeters;
    if (amount > 0) wettedAreas.set(application.otfBedId, application.wettedAreaSquareMeters);
  }
  const area = [...areas.values()].reduce((sum, value) => sum + value, 0);
  const wettedArea = [...wettedAreas.values()].reduce((sum, value) => sum + value, 0);
  return {
    cubicMeters: wettedUnknown ? null : cubicMetersFromMillimeterSquareMeters(wettedMillimeterSquareMeters),
    weightedMm: area > 0 ? millimeterSquareMeters / area : 0,
    uniqueArea: area,
    wettedArea: wettedUnknown ? null : wettedArea,
  };
}

function irrigationModeLabel(event: IrrigationEventRecord) {
  const creation = event.timerHistory?.find((entry) => entry.action === 'created');
  if (creation?.payload.kind === 'completed') return 'Déjà réalisée';
  if (creation?.payload.kind === 'running') return 'Irriguer maintenant';
  // « Tout est fait » (docs/aujourdhui-tableau-de-bord-contract.md, section 3.4) : enregistrée telle que prévue, sans chrono.
  const asPlanned = event.timerHistory?.some((entry) => entry.action === 'completed' && entry.payload.asPlanned === true);
  if (creation?.payload.kind === 'planned') return asPlanned ? 'Planifiée, faite comme prévu' : 'Planifiée';
  return event.equipment.actualStartAt ? 'Réalisée' : 'Planifiée';
}
