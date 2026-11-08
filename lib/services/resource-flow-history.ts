import {
  listResourceFlowRevisionsForUser,
  listResourceMeterReadingsForUser,
  type ResourceFlowRevisionRecord,
  type ResourceMeterReadingRecord,
} from '@/db/water-resource-flow-repository';
import { resourceFlowSeries, type ResourceFlowMeasurement } from '@/lib/domain/resource-flow';

/**
 * Ce que l'écran des ressources sait du débit : les relevés, les mesures
 * qu'ils portent, et les décisions de référence prises à partir d'elles
 * (`docs/resource-flow-contract.md`).
 */

export type ResourceFlowHistoryEntry = {
  readings: ResourceMeterReadingRecord[];
  measurements: ResourceFlowMeasurement[];
  revisions: ResourceFlowRevisionRecord[];
};

export type ResourceFlowHistory = Record<string, ResourceFlowHistoryEntry>;

export async function getResourceFlowHistoryForUser(
  ownerUserId: string,
): Promise<ResourceFlowHistory> {
  const [readings, revisions] = await Promise.all([
    listResourceMeterReadingsForUser(ownerUserId),
    listResourceFlowRevisionsForUser(ownerUserId),
  ]);

  const history: ResourceFlowHistory = {};
  for (const reading of readings) entryFor(history, reading.resourceId).readings.push(reading);
  for (const revision of revisions) entryFor(history, revision.resourceId).revisions.push(revision);
  for (const entry of Object.values(history)) {
    entry.measurements = resourceFlowSeries(entry.readings);
  }
  return history;
}

function entryFor(history: ResourceFlowHistory, resourceId: string): ResourceFlowHistoryEntry {
  const existing = history[resourceId];
  if (existing) return existing;
  const created: ResourceFlowHistoryEntry = { readings: [], measurements: [], revisions: [] };
  history[resourceId] = created;
  return created;
}
