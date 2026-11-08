import type { IrrigationSnapshot } from '../../domain/domain.ts';
import { mapOtfConfiguration, mapOtfSnapshot } from '../../domain/otf/mapper.ts';
import { mapCropPlan } from '../../domain/otf/crop-plan-mapper.ts';
import type { OtfReadClient } from './read-client.ts';
import { OtfApiError } from '../../domain/otf/api-contract.ts';

export class OtfSeasonUnavailableError extends OtfApiError {
  readonly requestedSeason: number;
  readonly seasonFirst: number;
  readonly seasonLast: number;

  constructor(requestedSeason: number, seasonFirst: number, seasonLast: number) {
    super(
      `La saison ${requestedSeason} n'est pas disponible dans OTF.`,
      undefined,
      'season-unavailable',
    );
    this.name = 'OtfSeasonUnavailableError';
    this.requestedSeason = requestedSeason;
    this.seasonFirst = seasonFirst;
    this.seasonLast = seasonLast;
  }
}

export async function readOtfSeasonSnapshot(
  client: OtfReadClient,
  season: number,
  readAt = new Date(),
): Promise<IrrigationSnapshot> {
  const rawConfiguration = await client.getConfiguration();
  const configuration = mapOtfConfiguration(rawConfiguration);

  if (
    !Number.isInteger(season) ||
    season < configuration.seasonFirst ||
    season > configuration.seasonLast
  ) {
    throw new OtfSeasonUnavailableError(
      season,
      configuration.seasonFirst,
      configuration.seasonLast,
    );
  }
  const rawStructures = await client.getCurrentStructures();

  const zones = await readSeason('/zoneList', season, () =>
    client.listZones(season),
  );
  const plots = await readSeason('/plotList', season, () =>
    client.listPlots(season),
  );
  const beds = await readSeason('/bedList', season, () =>
    client.listBeds(season),
  );

  const snapshot = mapOtfSnapshot(
    rawConfiguration,
    uniqueValues(zones, 'parcelle'),
    uniqueValues(plots, 'jardin'),
    uniqueValues(beds, 'planche'),
    readAt,
    [season],
    rawStructures,
  );

  // Le plan de culture suit dans la même lecture (docs/series-contract.md,
  // « Lecture et cache ») : une page d'interventions, une d'espèces, une de
  // séries, une d'emplacements, puis les tâches en entier, toutes saisons.
  // Une lecture qui échoue fait échouer l'instantané entier : rien ne
  // remplace le cache tant que tout n'est pas valide.
  const rawActions = await readRoute('/actionList', () => client.listActions());
  const rawPlants = await readRoute('/plantList', () => client.listPlants());
  const rawSeries = await readSeason('/seriesList', season, () => client.listSeries(season));
  const rawPlaces = await readSeason('/placeList', season, () => client.listPlaces(season));
  const rawTasks = await readRoute('/taskList', () => client.listTasks());

  const cropPlan = mapCropPlan({
    rawActions,
    rawPlants,
    rawSeries: uniqueValues(rawSeries, 'série'),
    rawPlaces: uniqueValues(rawPlaces, 'emplacement'),
    rawTasks: uniqueValues(rawTasks, 'tâche'),
    season,
    beds: snapshot.beds,
  });

  return { ...snapshot, cropPlan };
}

export async function readCompleteOtfSnapshot(
  client: OtfReadClient,
  readAt = new Date(),
): Promise<IrrigationSnapshot> {
  const rawConfiguration = await client.getConfiguration();
  const rawStructures = await client.getCurrentStructures();
  const configuration = mapOtfConfiguration(rawConfiguration);
  const seasons = Array.from(
    { length: configuration.seasonLast - configuration.seasonFirst + 1 },
    (_, index) => configuration.seasonLast - index,
  );

  const zones = new Map<string, unknown>();
  const plots = new Map<string, unknown>();
  const beds = new Map<string, unknown>();

  for (const season of seasons) {
    mergeUnique(
      zones,
      await readSeason('/zoneList', season, () => client.listZones(season)),
      'parcelle',
    );
    mergeUnique(
      plots,
      await readSeason('/plotList', season, () => client.listPlots(season)),
      'jardin',
    );
    mergeUnique(
      beds,
      await readSeason('/bedList', season, () => client.listBeds(season)),
      'planche',
    );
  }

  return mapOtfSnapshot(
    rawConfiguration,
    [...zones.values()],
    [...plots.values()],
    [...beds.values()],
    readAt,
    undefined,
    rawStructures,
  );
}

/** Une route sans saison, dont l'erreur garde le nom de la route et le statut. */
async function readRoute(
  route: string,
  read: () => Promise<unknown[]>,
): Promise<unknown[]> {
  try {
    return await read();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur inconnue';
    const status = error instanceof OtfApiError ? error.status : undefined;
    throw new OtfApiError(`${route} — ${message}`, status);
  }
}

async function readSeason(
  route: string,
  season: number,
  read: () => Promise<unknown[]>,
): Promise<unknown[]> {
  try {
    return await read();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur inconnue';
    const status = error instanceof OtfApiError ? error.status : undefined;
    throw new OtfApiError(`${route}, saison ${season} — ${message}`, status);
  }
}

function mergeUnique(
  target: Map<string, unknown>,
  values: unknown[],
  label: string,
) {
  for (const value of values) {
    const id = readRawId(value, label);
    if (!target.has(id)) target.set(id, value);
  }
}

function uniqueValues(values: unknown[], label: string): unknown[] {
  const unique = new Map<string, unknown>();
  mergeUnique(unique, values, label);
  return [...unique.values()];
}

function readRawId(value: unknown, label: string): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OtfApiError(`Objet OTF invalide : ${label}.`);
  }
  const raw = value as Record<string, unknown>;
  const candidate = raw.id ?? raw['@id'];
  if (typeof candidate !== 'string' && typeof candidate !== 'number') {
    throw new OtfApiError(`Identifiant OTF invalide : ${label}.`);
  }
  const id = String(candidate).split('/').filter(Boolean).at(-1)?.trim();
  if (!id) throw new OtfApiError(`Identifiant OTF vide : ${label}.`);
  return id;
}
