import type {
  CropCultivation,
  CropPlace,
  CropPlan,
  CropSeries,
  ImplantationTask,
  Season,
  WeekKey,
} from '../domain.ts';
import { OtfApiError } from './api-contract.ts';
import {
  asRecord,
  isRecord,
  relationId,
  toInteger,
  toName,
  toOptionalNonNegativeNumber,
} from './mapper.ts';

/**
 * Le plan de culture d'une saison, tel que le module le retient
 * (docs/series-contract.md, « Lecture et cache ») : les séries de la saison
 * et leurs mises en culture nommées, les emplacements rattachés à une série et
 * à une planche connues, et les seules tâches qui servent — semis direct et
 * plantation des séries de la saison —, réduites aux champs utiles. Tout ce
 * qui est écarté est compté, jamais perdu en silence.
 */
export function mapCropPlan(input: {
  rawActions: unknown[];
  rawPlants: unknown[];
  rawSeries: unknown[];
  rawPlaces: unknown[];
  rawTasks: unknown[];
  season: Season;
  beds: readonly { id: string }[];
}): CropPlan {
  const implantationKinds = mapImplantationActions(input.rawActions);
  const plantNames = mapPlantNames(input.rawPlants);

  const series = input.rawSeries
    .map((value) => mapSeries(value, plantNames))
    .filter((item) => item.season === input.season);
  const seriesIds = new Set(series.map(({ id }) => id));
  const bedIds = new Set(input.beds.map(({ id }) => id));

  const places: CropPlace[] = [];
  let placesWithoutSeries = 0;
  let placesOfUnknownSeries = 0;
  let placesWithUnknownBed = 0;
  for (const value of input.rawPlaces) {
    const raw = asRecord(value, 'emplacement');
    const id = relationId(raw.id ?? raw['@id'], 'emplacement');
    if (raw.series === null || raw.series === undefined) {
      placesWithoutSeries += 1;
      continue;
    }
    const seriesId = relationId(raw.series, "série de l'emplacement");
    if (!seriesIds.has(seriesId)) {
      placesOfUnknownSeries += 1;
      continue;
    }
    const bedId = relationId(raw.bed, "planche de l'emplacement");
    if (!bedIds.has(bedId)) {
      placesWithUnknownBed += 1;
      continue;
    }
    places.push({ id, seriesId, bedId, lengthMeters: toOptionalNonNegativeNumber(raw.length) });
  }

  const implantationTasks: ImplantationTask[] = [];
  for (const value of input.rawTasks) {
    const task = mapImplantationTask(value, implantationKinds, seriesIds);
    if (task) implantationTasks.push(task);
  }

  return {
    series,
    places,
    implantationTasks,
    readSummary: {
      seriesRead: input.rawSeries.length,
      placesRead: input.rawPlaces.length,
      tasksRead: input.rawTasks.length,
      tasksRetained: implantationTasks.length,
      placesWithoutSeries,
      placesOfUnknownSeries,
      placesWithUnknownBed,
    },
  };
}

/** Identifiant d'intervention → nature d'implantation, d'après le `fqn` stable d'OTF. */
function mapImplantationActions(rawActions: unknown[]): Map<string, ImplantationTask['kind']> {
  const kinds = new Map<string, ImplantationTask['kind']>();
  for (const value of rawActions) {
    const raw = asRecord(value, 'intervention');
    const id = relationId(raw.id ?? raw['@id'], 'intervention');
    if (raw.fqn === 'semis-direct') kinds.set(id, 'direct-sowing');
    else if (raw.fqn === 'plantation') kinds.set(id, 'planting');
    // Semis en pépinière, récolte, fertilisation et interventions à `fqn` nul
    // ne mettent rien au champ : ignorées (D-021).
  }
  return kinds;
}

function mapPlantNames(rawPlants: unknown[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const value of rawPlants) {
    const raw = asRecord(value, 'espèce');
    const id = relationId(raw.id ?? raw['@id'], 'espèce');
    names.set(id, toName(raw.name, `Espèce ${id}`));
  }
  return names;
}

function mapSeries(value: unknown, plantNames: Map<string, string>): CropSeries {
  const raw = asRecord(value, 'série');
  const id = relationId(raw.id ?? raw['@id'], 'série');
  const cultivations = Array.isArray(raw.cultivations) ? raw.cultivations : [];
  return {
    id,
    name: toName(raw.name, `Série ${id}`),
    season: toInteger(raw.season, `saison de la série ${id}`),
    use: raw.use === 'block' ? 'block' : 'bed',
    cycle: raw.cycle === 'perennial' ? 'perennial' : 'annual',
    cultivations: cultivations.map((item) => mapCultivation(item, plantNames)),
  };
}

function mapCultivation(value: unknown, plantNames: Map<string, string>): CropCultivation {
  const raw = asRecord(value, 'mise en culture');
  const id = relationId(raw.id ?? raw['@id'], 'mise en culture');
  const plantId = relationId(raw.plant, `espèce de la mise en culture ${id}`);
  return {
    id,
    plantId,
    plantName: plantNames.get(plantId) ?? `Espèce ${plantId}`,
    harvestWeeks: mapWeekList(raw.harvestWeeks, `récoltes de la mise en culture ${id}`),
    harvestWeeksExpected: mapWeekList(raw.harvestWeeksExpected, `récoltes attendues de la mise en culture ${id}`),
  };
}

function mapImplantationTask(
  value: unknown,
  kinds: Map<string, ImplantationTask['kind']>,
  seriesIds: Set<string>,
): ImplantationTask | null {
  const raw = asRecord(value, 'tâche');
  if (raw.series === null || raw.series === undefined) return null;
  const seriesId = relationId(raw.series, 'série de la tâche');
  if (!seriesIds.has(seriesId)) return null;
  if (raw.action === null || raw.action === undefined) return null;
  const kind = kinds.get(relationId(raw.action, 'intervention de la tâche'));
  if (!kind) return null;

  const id = relationId(raw.id ?? raw['@id'], 'tâche');
  const cultivationId = raw.cultivation === null || raw.cultivation === undefined
    ? null
    : relationId(raw.cultivation, `mise en culture de la tâche ${id}`);
  return {
    id,
    seriesId,
    cultivationId,
    kind,
    plannedWeek: mapOptionalWeek(raw.plannedWeek, `semaine planifiée de la tâche ${id}`),
    doneWeek: mapOptionalWeek(raw.doneWeek, `semaine réalisée de la tâche ${id}`),
    status: raw.status === 'done' ? 'done' : 'todo',
  };
}

const WEEK_KEY_PATTERN = /^\d{4}-W\d{2}$/;

function mapOptionalWeek(value: unknown, field: string): WeekKey | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !WEEK_KEY_PATTERN.test(value)) {
    throw new OtfApiError(`Semaine OTF invalide : ${field}.`);
  }
  return value;
}

function mapWeekList(value: unknown, field: string): WeekKey[] {
  if (value === null || value === undefined) return [];
  const items = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : null;
  if (items === null) throw new OtfApiError(`Semaines OTF invalides : ${field}.`);
  return items.map((item) => {
    const week = mapOptionalWeek(item, field);
    if (week === null) throw new OtfApiError(`Semaine OTF invalide : ${field}.`);
    return week;
  });
}
