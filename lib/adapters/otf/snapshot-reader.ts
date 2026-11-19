import type { IrrigationSnapshot } from '../../domain/domain.ts';
import { mapOtfConfiguration, mapOtfSnapshot } from '../../domain/otf/mapper.ts';
import { mapCropPlan } from '../../domain/otf/crop-plan-mapper.ts';
import type { OtfReadClient } from './read-client.ts';
import { OtfApiError, OtfShapeError } from '../../domain/otf/api-contract.ts';
import { farmIdentityShape, OtfFarmMismatchError, otfFarmIdentity } from '../../domain/otf/farm-identity.ts';
import { identifier } from '../../domain/otf/mapper.ts';
import { checkListShape, checkMeShape, type OtfListRoute } from '../../domain/otf/route-shapes.ts';
import { OtfReadDeferredError } from '../../domain/otf/shared-call-pace.ts';
import { logJsonLine } from '../log.ts';

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

/**
 * L'instantané d'une saison. `GET /me` est lu d'abord (docs/tranche-4-contract.md,
 * F337) : avec `expectedFarmId`, la lecture s'arrête avant toute autre route
 * si la clé mène à une autre ferme, ou à aucune (F332, F341). Chaque route a
 * sa vérification de forme, dès sa réponse (T4-15, F391) : un écart arrête la
 * lecture avant l'appel suivant, et rien n'est rangé.
 */
export async function readOtfSeasonSnapshot(
  client: OtfReadClient,
  season: number,
  readAt = new Date(),
  expectedFarmId?: string,
): Promise<IrrigationSnapshot> {
  return logShapeChange(() => readSeasonSnapshot(client, season, readAt, expectedFarmId));
}

async function readSeasonSnapshot(
  client: OtfReadClient,
  season: number,
  readAt: Date,
  expectedFarmId: string | undefined,
): Promise<IrrigationSnapshot> {
  const rawStructures = await client.getCurrentStructures();
  checkMeShape(rawStructures);
  if (expectedFarmId !== undefined) {
    const observedFarmId = otfFarmIdentity(rawStructures);
    if (observedFarmId !== expectedFarmId) {
      // La forme seule, jamais l'identifiant : de quoi comprendre un refus (F341).
      if (observedFarmId === null) logJsonLine('warn', { event: 'otf_farm_identity_missing', ...farmIdentityShape(rawStructures) });
      throw new OtfFarmMismatchError(observedFarmId);
    }
  }
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

  const zones = await readList('/zoneList', season, () => client.listZones(season));
  const plots = await readList('/plotList', season, () => client.listPlots(season));
  const beds = await readList('/bedList', season, () => client.listBeds(season));

  const snapshot = mapOtfSnapshot(
    rawConfiguration,
    uniqueValues(zones, '/zoneList'),
    uniqueValues(plots, '/plotList'),
    uniqueValues(beds, '/bedList'),
    readAt,
    [season],
    rawStructures,
  );

  // Le plan de culture suit dans la même lecture (docs/series-contract.md,
  // « Lecture et cache ») : une page d'interventions, une d'espèces, une de
  // séries, une d'emplacements, puis les tâches en entier, toutes saisons.
  // Une lecture qui échoue fait échouer l'instantané entier : rien ne
  // remplace le cache tant que tout n'est pas valide.
  const rawActions = await readList('/actionList', null, () => client.listActions());
  const rawPlants = await readList('/plantList', null, () => client.listPlants());
  const rawSeries = await readList('/seriesList', season, () => client.listSeries(season));
  const rawPlaces = await readList('/placeList', season, () => client.listPlaces(season));
  const rawTasks = await readList('/taskList', null, () => client.listTasks());

  const cropPlan = mapCropPlan({
    rawActions,
    rawPlants,
    rawSeries: uniqueValues(rawSeries, '/seriesList'),
    rawPlaces: uniqueValues(rawPlaces, '/placeList'),
    rawTasks: uniqueValues(rawTasks, '/taskList'),
    season,
    beds: snapshot.beds,
  });

  return { ...snapshot, cropPlan };
}

export async function readCompleteOtfSnapshot(
  client: OtfReadClient,
  readAt = new Date(),
): Promise<IrrigationSnapshot> {
  return logShapeChange(() => readAllSeasons(client, readAt));
}

async function readAllSeasons(client: OtfReadClient, readAt: Date): Promise<IrrigationSnapshot> {
  const rawConfiguration = await client.getConfiguration();
  const configuration = mapOtfConfiguration(rawConfiguration);
  const rawStructures = await client.getCurrentStructures();
  checkMeShape(rawStructures);
  const seasons = Array.from(
    { length: configuration.seasonLast - configuration.seasonFirst + 1 },
    (_, index) => configuration.seasonLast - index,
  );

  const zones = new Map<string, unknown>();
  const plots = new Map<string, unknown>();
  const beds = new Map<string, unknown>();

  for (const season of seasons) {
    mergeUnique(zones, await readList('/zoneList', season, () => client.listZones(season)), '/zoneList');
    mergeUnique(plots, await readList('/plotList', season, () => client.listPlots(season)), '/plotList');
    mergeUnique(beds, await readList('/bedList', season, () => client.listBeds(season)), '/bedList');
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

/**
 * Une route de liste, toutes pages réunies, puis sa vérification de forme
 * (F391). L'erreur d'un appel garde le nom de la route, la saison et le statut.
 * Une lecture reportée par le compteur partagé remonte telle quelle : sa
 * raison et l'heure de la prochaine lecture font le message de la page (F386) ;
 * un écart de forme aussi : il nomme déjà sa route et son champ.
 */
async function readList(
  route: OtfListRoute,
  season: number | null,
  read: () => Promise<unknown[]>,
): Promise<unknown[]> {
  let elements: unknown[];
  try {
    elements = await read();
  } catch (error) {
    if (error instanceof OtfReadDeferredError || error instanceof OtfShapeError) throw error;
    const message = error instanceof Error ? error.message : 'erreur inconnue';
    const status = error instanceof OtfApiError ? error.status : undefined;
    const where = season === null ? route : `${route}, saison ${season}`;
    throw new OtfApiError(`${where} — ${message}`, status);
  }
  checkListShape(route, elements);
  return elements;
}

/**
 * Le journal d'un écart de forme (F391) : la route, le champ et le problème,
 * jamais une valeur. L'erreur remonte ensuite, et rien n'est rangé.
 */
async function logShapeChange<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof OtfShapeError) {
      logJsonLine('warn', { event: 'otf_route_shape_changed', route: error.route, field: error.field, problem: error.problem });
    }
    throw error;
  }
}

function mergeUnique(
  target: Map<string, unknown>,
  values: unknown[],
  route: OtfListRoute,
) {
  for (const value of values) {
    const id = readElementId(value, route);
    if (!target.has(id)) target.set(id, value);
  }
}

function uniqueValues(values: unknown[], route: OtfListRoute): unknown[] {
  const unique = new Map<string, unknown>();
  mergeUnique(unique, values, route);
  return [...unique.values()];
}

/** L'identifiant d'un élément déjà vérifié ; la même règle que sa vérification de forme. */
function readElementId(value: unknown, route: OtfListRoute): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OtfShapeError(route, 'element', 'not-object');
  }
  const raw = value as Record<string, unknown>;
  return identifier(raw.id ?? raw['@id'], { route, field: 'id' });
}
