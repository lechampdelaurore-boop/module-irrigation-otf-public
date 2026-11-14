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
import { OtfApiError, extractCollection } from './api-contract.ts';
import { readOtfOutline } from './outline.ts';

type RawRecord = Record<string, unknown>;

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

function mapOtfStructure(payload: unknown): OtfStructure {
  const candidates = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? tryExtractCollection(payload)
      : [];
  const candidate = candidates[0] ?? payload;
  if (!isRecord(candidate)) {
    return {
      id: 'unknown',
      name: 'Exploitation OTF',
      legalCity: null,
      legalPostcode: null,
      legalCountry: null,
    };
  }
  const raw = candidate;
  const id = relationId(raw.id ?? raw['@id'] ?? 'unknown', 'structure');
  return {
    id,
    name: toName(raw.name ?? raw.label ?? raw.title, `Exploitation ${id}`),
    legalCity: toOptionalText(raw.legalCity),
    legalPostcode: toOptionalText(raw.legalPostcode),
    legalCountry: toOptionalText(raw.legalCountry),
  };
}

function readBedPlotId(value: unknown): string {
  const raw = asRecord(value, 'planche');
  return relationId(raw.plotId ?? raw.plot, 'jardin de la planche');
}

export function mapOtfConfiguration(payload: unknown): OtfConfiguration {
  const candidates = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? tryExtractCollection(payload)
      : [];
  const raw = asRecord(candidates[0] ?? payload, 'configuration');
  const seasonFirst = toInteger(raw.seasonFirst, 'seasonFirst');
  const seasonLast = toInteger(raw.seasonLast, 'seasonLast');

  if (seasonFirst > seasonLast || seasonLast - seasonFirst > 100) {
    throw new OtfApiError('Plage de saisons OTF invalide.');
  }

  return { seasonFirst, seasonLast };
}

function mapZone(value: unknown, fallbackSeasons: Season[]): Zone {
  const raw = asRecord(value, 'parcelle');
  const id = relationId(raw.id ?? raw['@id'], 'parcelle');
  return {
    id,
    name: toName(raw.name ?? raw.label ?? raw.title, `Parcelle ${id}`),
    area: toOptionalNonNegativeNumber(raw.area),
    seasons: mapEntitySeasons(raw, fallbackSeasons),
    ...outlineField(raw.coordinates),
  };
}

function isUserFacingPlot(value: unknown): boolean {
  const raw = asRecord(value, 'jardin');
  return raw.zoneFill !== true;
}

function mapPlot(value: unknown, fallbackSeasons: Season[]): Plot {
  const raw = asRecord(value, 'jardin');
  const id = relationId(raw.id ?? raw['@id'], 'jardin');
  const length = toOptionalNonNegativeNumber(raw.length) ?? 0;
  const width = toOptionalNonNegativeNumber(raw.width) ?? 0;
  return {
    id,
    zoneId: relationId(raw.zoneId ?? raw.zone, 'parcelle du jardin'),
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
  const raw = asRecord(value, 'planche');
  const id = relationId(raw.id ?? raw['@id'], 'planche');
  const plotId = relationId(raw.plotId ?? raw.plot, 'jardin de la planche');
  const parentPlot = plots.find((plot) => plot.id === plotId);
  const length = toOptionalNonNegativeNumber(raw.length) ?? 0;
  const width = centimetersToMeters(raw.width) ?? 0;
  return {
    id,
    zoneId: relationId(
      raw.zoneId ?? raw.zone ?? parentPlot?.zoneId,
      'parcelle de la planche',
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

export function relationId(value: unknown, field: string): string {
  let candidate = value;
  if (isRecord(value)) candidate = value.id ?? value['@id'];
  if (typeof candidate !== 'string' && typeof candidate !== 'number') {
    throw new OtfApiError(`Identifiant OTF invalide pour ${field}.`);
  }

  const text = String(candidate).trim();
  const normalized = text.split('/').filter(Boolean).at(-1) ?? '';
  if (!normalized) {
    throw new OtfApiError(`Identifiant OTF vide pour ${field}.`);
  }
  return normalized;
}

export function toName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function toOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function toInteger(value: unknown, field: string): number {
  const parsed = toOptionalInteger(value);
  if (parsed === null) throw new OtfApiError(`Valeur OTF invalide : ${field}.`);
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

export function asRecord(value: unknown, label: string): RawRecord {
  if (!isRecord(value)) throw new OtfApiError(`Objet OTF invalide : ${label}.`);
  return value;
}

function tryExtractCollection(payload: RawRecord): unknown[] {
  try {
    return extractCollection(payload);
  } catch {
    return [];
  }
}
