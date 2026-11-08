import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import type { Bed, IrrigationSnapshot } from '../domain.ts';
import {
  HISTORY_SCOPE_LEVELS,
  type HistoryScope,
  type HistoryScopeInput,
  IrrigationHistoryInputError,
} from './contract.ts';

export function normalizeHistoryScope(
  input: HistoryScopeInput,
  snapshot: IrrigationSnapshot,
  season: number,
): HistoryScope {
  if (!HISTORY_SCOPE_LEVELS.includes(input.level)) {
    throw new IrrigationHistoryInputError('Le niveau géographique est invalide.');
  }
  if (input.level === 'farm') {
    return { level: 'farm', zoneId: null, plotId: null, bedId: null };
  }
  const zone = snapshot.zones.find(
    (item) => item.id === input.zoneId && item.seasons.includes(season),
  );
  if (!zone) throw new IrrigationHistoryInputError('La parcelle sélectionnée est invalide.');
  if (input.level === 'zone') {
    return { level: 'zone', zoneId: zone.id, plotId: null, bedId: null };
  }
  const plot = snapshot.plots.find(
    (item) => item.id === input.plotId && item.zoneId === zone.id && item.seasons.includes(season),
  );
  if (!plot) throw new IrrigationHistoryInputError('Le jardin sélectionné est invalide.');
  if (input.level === 'plot') {
    return { level: 'plot', zoneId: zone.id, plotId: plot.id, bedId: null };
  }
  const bed = snapshot.beds.find(
    (item) => item.id === input.bedId && item.zoneId === zone.id
      && item.plotId === plot.id && item.seasons.includes(season),
  );
  if (!bed) throw new IrrigationHistoryInputError('La planche sélectionnée est invalide.');
  return { level: 'bed', zoneId: zone.id, plotId: plot.id, bedId: bed.id };
}

export function bedsForHistoryScope(
  snapshot: IrrigationSnapshot,
  season: number,
  scope: HistoryScope,
): Bed[] {
  return snapshot.beds.filter((bed) => bed.seasons.includes(season)
    && (scope.zoneId === null || bed.zoneId === scope.zoneId)
    && (scope.plotId === null || bed.plotId === scope.plotId)
    && (scope.bedId === null || bed.id === scope.bedId));
}

export function historyScopeLabel(
  scope: HistoryScope,
  snapshot: IrrigationSnapshot,
) {
  if (scope.level === 'farm') return snapshot.structure.name;
  if (scope.level === 'zone') {
    return snapshot.zones.find((zone) => zone.id === scope.zoneId)?.name ?? 'Parcelle';
  }
  if (scope.level === 'plot') {
    return snapshot.plots.find((plot) => plot.id === scope.plotId)?.name ?? 'Jardin ou abri';
  }
  return snapshot.beds.find((bed) => bed.id === scope.bedId)?.name ?? 'Planche';
}

export function applicationMatchesScope(
  application: IrrigationEventRecord['equipment']['applications'][number],
  scope: HistoryScope,
) {
  return (scope.zoneId === null || application.otfZoneId === scope.zoneId)
    && (scope.plotId === null || application.otfPlotId === scope.plotId)
    && (scope.bedId === null || application.otfBedId === scope.bedId);
}

export function bedMatchesScope(
  bed: Pick<Bed, 'id' | 'zoneId' | 'plotId'>,
  scope: HistoryScope,
) {
  return (scope.zoneId === null || bed.zoneId === scope.zoneId)
    && (scope.plotId === null || bed.plotId === scope.plotId)
    && (scope.bedId === null || bed.id === scope.bedId);
}

export function placementLabel(
  event: IrrigationEventRecord,
  bedNames: ReadonlyMap<string, string>,
) {
  const anchor = event.equipment.placementSnapshot.anchor;
  if (anchor.type === 'bed_center') {
    return `Sur ${bedNames.get(anchor.anchorBedOtfId) ?? anchor.anchorBedOtfId}`;
  }
  return `Entre ${bedNames.get(anchor.beforeBedOtfId) ?? anchor.beforeBedOtfId} et ${bedNames.get(anchor.afterBedOtfId) ?? anchor.afterBedOtfId}`;
}

export function unique(values: readonly string[]) {
  return [...new Set(values)];
}
