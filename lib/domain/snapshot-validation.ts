import type { IrrigationSnapshot } from './domain.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStringId(
  value: unknown,
): value is Record<string, unknown> & { id: string } {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0;
}

function hasValidZone(value: unknown): boolean {
  if (!hasStringId(value) || !isRecord(value)) return false;
  return value.area === null || (
    typeof value.area === 'number' &&
    Number.isFinite(value.area) &&
    value.area >= 0
  );
}

/**
 * Le plan de culture d'un cache : absent d'un cache antérieur à l'extension
 * séries, ce qui reste un instantané valide ; présent, il porte ses trois
 * listes d'objets identifiés et son résumé de lecture.
 */
function hasValidCropPlan(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || !isRecord(value.readSummary)) return false;
  return (
    Array.isArray(value.series) &&
    value.series.every((item) => hasStringId(item) && Array.isArray(item.cultivations)) &&
    Array.isArray(value.places) &&
    value.places.every((item) => hasStringId(item) && typeof item.seriesId === 'string' && typeof item.bedId === 'string') &&
    Array.isArray(value.implantationTasks) &&
    value.implantationTasks.every((item) => hasStringId(item) && typeof item.seriesId === 'string')
  );
}

export function isIrrigationSnapshot(value: unknown): value is IrrigationSnapshot {
  if (
    !isRecord(value) ||
    !isRecord(value.configuration) ||
    !isRecord(value.structure)
  ) return false;

  const configuration = value.configuration;
  const source = value.source;

  return (
    hasValidCropPlan(value.cropPlan) &&
    Number.isInteger(configuration.seasonFirst) &&
    Number.isInteger(configuration.seasonLast) &&
    Number(configuration.seasonFirst) <= Number(configuration.seasonLast) &&
    typeof value.structure.id === 'string' &&
    typeof value.structure.name === 'string' &&
    Array.isArray(value.zones) &&
    value.zones.every(hasValidZone) &&
    Array.isArray(value.plots) &&
    value.plots.every(hasStringId) &&
    Array.isArray(value.beds) &&
    value.beds.every(hasStringId) &&
    (source === 'mock' || source === 'live' || source === 'cache') &&
    typeof value.lastSuccessfulReadAt === 'string' &&
    !Number.isNaN(Date.parse(value.lastSuccessfulReadAt))
  );
}
