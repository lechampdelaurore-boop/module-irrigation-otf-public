import type {
  Bed,
  IrrigationSnapshot,
  OtfConfiguration,
  OtfStructure,
  Plot,
  PlotMode,
  Season,
  Zone,
} from '../domain.ts';
import { OtfApiError, OtfShapeError, extractCollection, type OtfReadRoute } from './api-contract.ts';
import { UNKNOWN_STRUCTURE_ID, otfStructuresOf } from './farm-identity.ts';
import { readOtfOutline } from './outline.ts';

type RawRecord = Record<string, unknown>;

/**
 * Où se trouve un champ lu : sa route et son nom dans Ouvre ta ferme, jamais sa
 * valeur. Une forme illisible devient un écart de forme de cette route
 * (docs/tranche-4-contract.md, F391) : la lecture s'arrête et rien n'est rangé.
 */
export type OtfFieldPlace = { route: OtfReadRoute; field: string };

export function mapOtfSnapshot(
  rawConfiguration: unknown,
  rawZones: unknown[],
  rawPlots: unknown[],
  rawBeds: unknown[],
  readAt = new Date(),
  fallbackSeasons?: Season[],
  rawStructures?: unknown,
): IrrigationSnapshot {
  const configuration = mapOtfConfiguration(rawConfiguration);
  const allSeasons = fallbackSeasons ?? createSeasonRange(configuration);
  const zones = rawZones.map((value) => mapZone(value, allSeasons));
  const plots = rawPlots
    .filter(isUserFacingPlot)
    .map((value) => mapPlot(value, allSeasons));
  const plotIds = new Set(plots.map(({ id }) => id));
  const beds = rawBeds
    // OTF peut renvoyer dans bedList des planches dont le jardin n'est pas
    // présent dans plotList pour la même saison. Elles ne sont ni affichables
    // ni rattachables : les ignorer évite de rejeter toutes les planches saines.
    .filter((value) => plotIds.has(readBedPlotId(value)))
    .map((value) => mapBed(value, allSeasons, plots));

  validateRelations(zones, plots, beds);

  return {
    configuration,
    structure: mapOtfStructure(rawStructures),
    zones,
    plots,
    beds,
    source: 'live',
    lastSuccessfulReadAt: readAt.toISOString(),
  };
}

/**
 * La structure de `GET /me`. Plusieurs structures ne font jamais une ferme, ici
 * comme pour l'identité (F338) : la traduction les refuse au lieu de prendre la
 * première (point D2 de la revue de l'isolation, F392). Sans structure lisible,
 * le remplaçant sert à l'affichage, jamais d'identité.
 */
function mapOtfStructure(payload: unknown): OtfStructure {
  const structures = otfStructuresOf(payload);
  if (structures.length > 1) throw new OtfShapeError('/me', 'structure', 'several-structures');
  const candidate = structures[0];
  if (!isRecord(candidate)) {
    return {
      id: UNKNOWN_STRUCTURE_ID,
      name: 'Exploitation OTF',
      legalCity: null,
      legalPostcode: null,
      legalCountry: null,
    };
  }
  const raw = candidate;
  const id = identifier(raw.id ?? raw['@id'] ?? UNKNOWN_STRUCTURE_ID, { route: '/me', field: 'id' });
  return {
    id,
    name: toName(raw.name ?? raw.label ?? raw.title, `Exploitation ${id}`),
    legalCity: toOptionalText(raw.legalCity),
    legalPostcode: toOptionalText(raw.legalPostcode),
    legalCountry: toOptionalText(raw.legalCountry),
  };
}

function readBedPlotId(value: unknown): string {
  const raw = asRecord(value, { route: '/bedList', field: 'element' });
  return relationId(raw.plotId ?? raw.plot, { route: '/bedList', field: 'plot' });
}

export function mapOtfConfiguration(payload: unknown): OtfConfiguration {
  const candidates = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? tryExtractCollection(payload)
      : [];
  const raw = asRecord(candidates[0] ?? payload, { route: '/configuration', field: 'configuration' });
  const seasonFirst = toInteger(raw.seasonFirst, { route: '/configuration', field: 'seasonFirst' });
  const seasonLast = toInteger(raw.seasonLast, { route: '/configuration', field: 'seasonLast' });

  if (seasonFirst > seasonLast || seasonLast - seasonFirst > 100) {
    throw new OtfApiError('Plage de saisons OTF invalide.');
  }

  return { seasonFirst, seasonLast };
}

function mapZone(value: unknown, fallbackSeasons: Season[]): Zone {
  const raw = asRecord(value, { route: '/zoneList', field: 'element' });
  const id = identifier(raw.id ?? raw['@id'], { route: '/zoneList', field: 'id' });
  return {
    id,
    name: toName(raw.name ?? raw.label ?? raw.title, `Parcelle ${id}`),
    area: toOptionalNonNegativeNumber(raw.area),
    seasons: mapEntitySeasons(raw, fallbackSeasons),
    ...outlineField(raw.coordinates),
  };
}

function isUserFacingPlot(value: unknown): boolean {
  const raw = asRecord(value, { route: '/plotList', field: 'element' });
  return raw.zoneFill !== true;
}

function mapPlot(value: unknown, fallbackSeasons: Season[]): Plot {
  const raw = asRecord(value, { route: '/plotList', field: 'element' });
  const id = identifier(raw.id ?? raw['@id'], { route: '/plotList', field: 'id' });
  const length = toOptionalNonNegativeNumber(raw.length) ?? 0;
  const width = toOptionalNonNegativeNumber(raw.width) ?? 0;
  return {
    id,
    zoneId: relationId(raw.zoneId ?? raw.zone, { route: '/plotList', field: 'zone' }),
    name: toName(raw.name ?? raw.label ?? raw.title, `Jardin ${id}`),
    mode: mapPlotMode(raw.mode ?? raw.type),
    length,
    width,
    area: toOptionalNonNegativeNumber(raw.area) ?? length * width,
    seasons: mapEntitySeasons(raw, fallbackSeasons),
    ...outlineField(raw.coordinates),
  };
}

/**
 * Le contour d'une parcelle ou d'un jardin (S3, F201, F202) : présent
 * seulement quand OTF en dessine un lisible ; sinon le champ manque, comme
 * dans un cache antérieur à S3, et le contour est « absent ». Jamais une
 * erreur : un contour illisible ne fait pas rejeter l'instantané.
 */
function outlineField(coordinates: unknown): Pick<Zone, 'outline'> {
  const outline = readOtfOutline(coordinates);
  return outline === null ? {} : { outline };
}

function mapBed(
  value: unknown,
  fallbackSeasons: Season[],
  plots: Plot[],
): Bed {
  const raw = asRecord(value, { route: '/bedList', field: 'element' });
  const id = identifier(raw.id ?? raw['@id'], { route: '/bedList', field: 'id' });
  const plotId = relationId(raw.plotId ?? raw.plot, { route: '/bedList', field: 'plot' });
  const parentPlot = plots.find((plot) => plot.id === plotId);
  const length = toOptionalNonNegativeNumber(raw.length) ?? 0;
  const width = centimetersToMeters(raw.width) ?? 0;
  return {
    id,
    zoneId: relationId(
      raw.zoneId ?? raw.zone ?? parentPlot?.zoneId,
      { route: '/bedList', field: 'zone' },
    ),
    plotId,
    name: toName(raw.name ?? raw.label ?? raw.title, id),
    length,
    width,
    alleyWidth: centimetersToMeters(raw.alleyWidth),
    area: toOptionalNonNegativeNumber(raw.area) ?? length * width,
    seasons: mapEntitySeasons(raw, fallbackSeasons),
  };
}

function validateRelations(zones: Zone[], plots: Plot[], beds: Bed[]) {
  const zoneIds = new Set(zones.map(({ id }) => id));
  const plotIds = new Set(plots.map(({ id }) => id));

  if (plots.some(({ zoneId }) => !zoneIds.has(zoneId))) {
    throw new OtfApiError('Un jardin OTF référence une parcelle inconnue.');
  }
  if (
    beds.some(
      ({ zoneId, plotId }) => !zoneIds.has(zoneId) || !plotIds.has(plotId),
    )
  ) {
    throw new OtfApiError('Une planche OTF référence un parent inconnu.');
  }
}

function createSeasonRange(configuration: OtfConfiguration): Season[] {
  return Array.from(
    { length: configuration.seasonLast - configuration.seasonFirst + 1 },
    (_, index) => configuration.seasonFirst + index,
  );
}

function mapSeasons(value: unknown, fallback: Season[]): Season[] {
  const source = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const seasons = source
    .map((item) => {
      if (isRecord(item)) {
        return toOptionalInteger(item.year ?? item.season ?? item.name);
      }
      return toOptionalInteger(item);
    })
    .filter((item): item is number => item !== null)
    .filter((item) => item >= 1900 && item <= 2200);

  return seasons.length > 0 ? [...new Set(seasons)] : [...fallback];
}

function mapEntitySeasons(raw: RawRecord, fallback: Season[]): Season[] {
  if (raw.seasons !== undefined || raw.season !== undefined) {
    return mapSeasons(raw.seasons ?? raw.season, fallback);
  }

  const fallbackFirst = fallback.at(0);
  const fallbackLast = fallback.at(-1);
  const first = toOptionalInteger(raw.seasonFirst) ?? fallbackFirst;
  const last = toOptionalInteger(raw.seasonLast) ?? fallbackLast;

  if (first === undefined || last === undefined || first > last) {
    throw new OtfApiError("Plage de saisons OTF invalide pour un élément du plan.");
  }

  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
    .filter((season) => fallback.includes(season));
}

function mapPlotMode(value: unknown): PlotMode {
  const normalized = String(value ?? '').toLocaleLowerCase('fr-FR');
  return /abri|cover|greenhouse|shelter|tunnel/.test(normalized)
    ? 'greenhouse'
    : 'garden';
}

/** L'identifiant d'un élément : un nombre ou un texte (d'une adresse `@id`, le dernier segment), jamais vide. */
export function identifier(value: unknown, place: OtfFieldPlace): string {
  const id = readableId(value);
  if (id === null) throw new OtfShapeError(place.route, place.field, 'unreadable-id');
  return id;
}

/** L'identifiant de l'élément qu'un champ désigne : le même, ou celui de l'objet qui le porte (`{ id }`). */
export function relationId(value: unknown, place: OtfFieldPlace): string {
  const id = readableId(value);
  if (id === null) throw new OtfShapeError(place.route, place.field, 'unreadable-relation');
  return id;
}

function readableId(value: unknown): string | null {
  const candidate = isRecord(value) ? value.id ?? value['@id'] : value;
  if (typeof candidate !== 'string' && typeof candidate !== 'number') return null;
  const normalized = String(candidate).trim().split('/').filter(Boolean).at(-1) ?? '';
  return normalized === '' ? null : normalized;
}

export function toName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function toOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function toInteger(value: unknown, place: OtfFieldPlace): number {
  const parsed = toOptionalInteger(value);
  if (parsed === null) throw new OtfShapeError(place.route, place.field, 'not-integer');
  return parsed;
}

function toOptionalInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function toOptionalNonNegativeNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function centimetersToMeters(value: unknown): number | null {
  const centimeters = toOptionalNonNegativeNumber(value);
  return centimeters === null ? null : centimeters / 100;
}

export function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown, place: OtfFieldPlace): RawRecord {
  if (!isRecord(value)) throw new OtfShapeError(place.route, place.field, 'not-object');
  return value;
}

function tryExtractCollection(payload: RawRecord): unknown[] {
  try {
    return extractCollection(payload);
  } catch {
    return [];
  }
}
