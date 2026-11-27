import type { WeatherDailyValue, WeatherReadInput } from './weather-provider.ts';

/**
 * Les modèles de prévision qu'une ferme peut choisir (docs/weather-models-contract.md,
 * § 3 et § 4, D-339, D-345) : la seule liste du logiciel. L'écran, les tests et
 * la base la lisent ici ; aucun nom n'est figé ailleurs. Retirer ou renommer un
 * modèle est une ligne de ce fichier et ses tests, sans migration : une ferme
 * qui l'avait revient à « Automatique » (règle 9, `resolveForecastModelChoice`).
 *
 * Chaque entrée a été vérifiée par l'essai A du 26 novembre 2026 (contrat,
 * § 14) : l'identifiant répond, et rend la pluie, les deux températures, l'ET0
 * et l'énergie solaire chaque jour de sa portée. Les textes disent des faits
 * vérifiables (fournisseur, maille, portée mesurée), jamais « le plus précis »
 * (règle 10).
 */

/** Une zone rectangulaire, en degrés ; `null` : partout. */
type ForecastModelZone = {
  southLatitude: number;
  northLatitude: number;
  westLongitude: number;
  eastLongitude: number;
} | null;

export type ForecastModel = {
  /** L'identifiant Open-Meteo, passé tel quel dans `models=`. */
  id: string;
  /** Le libellé du maraîcher, jamais un identifiant. */
  label: string;
  /** Qui produit le modèle, pour l'attribution (contrat, § 6). */
  provider: string;
  /** La maille, en clair, telle que la donnent les grilles d'Open-Meteo. */
  resolution: string;
  /** Les jours avec valeur mesurés par l'essai A sur une fenêtre de 15 jours (aujourd'hui compris). */
  measuredRangeDays: number;
  /**
   * Où le modèle fin du libellé existe (AROME, ICON-EU). Hors de cette zone,
   * Open-Meteo répond quand même par la version mondiale (essai A, § 14,
   * point 5) : la zone sert à ce que le libellé ne trompe pas.
   */
  zone: ForecastModelZone;
  /** Proposé aux fermes ; un modèle retiré reste lisible ici le temps de ramener ses fermes. */
  offered: boolean;
};

/** Le modèle qui complète les jours au-delà de la portée du modèle choisi (règle 6). */
export const COMPLETION_FORECAST_MODEL_ID = 'best_match';

/**
 * Grilles relevées dans le code d'Open-Meteo (`MeteoFranceDomain.swift`,
 * `Icon.swift`) le 26 novembre 2026 : AROME France, 0,025°, de 37,5° N
 * (1 121 × 717 points) à 55,4° N et de 12° O à 16° E ; ICON-EU, 0,0625°, de
 * 29,5° N à 70,5° N et de 23,5° O à 62,5° E. Le site de documentation n'est
 * pas joignable depuis le conteneur de l'assistant.
 */
const AROME_FRANCE_ZONE: ForecastModelZone = { southLatitude: 37.5, northLatitude: 55.4, westLongitude: -12, eastLongitude: 16 };
const ICON_EU_ZONE: ForecastModelZone = { southLatitude: 29.5, northLatitude: 70.5, westLongitude: -23.5, eastLongitude: 62.5 };

export const FORECAST_MODELS: readonly ForecastModel[] = [
  {
    id: COMPLETION_FORECAST_MODEL_ID,
    label: 'Automatique d’Open-Meteo',
    provider: 'Open-Meteo',
    resolution: 'Open-Meteo assemble les modèles qui couvrent le lieu',
    measuredRangeDays: 15,
    zone: null,
    offered: true,
  },
  {
    id: 'meteofrance_seamless',
    label: 'Météo-France (AROME puis ARPEGE)',
    provider: 'Météo-France',
    resolution: 'AROME, maille de 0,025° (environ 2,5 km), puis ARPEGE',
    measuredRangeDays: 4,
    zone: AROME_FRANCE_ZONE,
    offered: true,
  },
  {
    id: 'icon_seamless',
    label: 'DWD (ICON)',
    provider: 'DWD',
    resolution: 'ICON-EU, maille de 0,0625° (environ 7 km), puis ICON mondial',
    measuredRangeDays: 7,
    zone: ICON_EU_ZONE,
    offered: true,
  },
  {
    id: 'ecmwf_ifs025',
    label: 'Centre européen (ECMWF)',
    provider: 'Centre européen pour les prévisions météorologiques à moyen terme',
    resolution: 'IFS, maille de 0,25° (environ 25 km), mondial',
    measuredRangeDays: 15,
    zone: null,
    offered: true,
  },
  {
    id: 'gfs_seamless',
    label: 'NOAA (GFS)',
    provider: 'NOAA',
    resolution: 'GFS, modèle mondial',
    measuredRangeDays: 15,
    zone: null,
    offered: true,
  },
];

export function forecastModel(id: string): ForecastModel | null {
  return FORECAST_MODELS.find((model) => model.id === id) ?? null;
}

type Place = { latitude: number; longitude: number };

function zoneCovers(zone: ForecastModelZone, place: Place): boolean {
  if (zone === null) return true;
  return place.latitude >= zone.southLatitude && place.latitude <= zone.northLatitude
    && place.longitude >= zone.westLongitude && place.longitude <= zone.eastLongitude;
}

/** Les modèles qu'une ferme de ce lieu peut choisir, dans l'ordre de la liste (règle 3). */
export function forecastModelsCovering(place: Place): ForecastModel[] {
  return FORECAST_MODELS.filter((model) => model.offered && zoneCovers(model.zone, place));
}

export type ForecastModelChoice =
  | { kind: 'automatic' }
  | { kind: 'model'; model: ForecastModel }
  /** Règle 9 : le modèle enregistré n'est plus proposé, ou ne couvre plus le lieu ; la ferme lit « Automatique ». */
  | { kind: 'back-to-automatic'; savedModelId: string; reason: 'withdrawn' | 'outside-zone' };

/**
 * Ce que la ferme lit vraiment, d'après le modèle enregistré et son lieu.
 * Sans modèle enregistré : « Automatique », la lecture d'aujourd'hui (règle 1).
 * Sans lieu, rien n'est lu : le modèle reste tel quel.
 */
export function resolveForecastModelChoice(savedModelId: string | null, place: Place | null): ForecastModelChoice {
  if (savedModelId === null) return { kind: 'automatic' };
  const model = forecastModel(savedModelId);
  if (model === null || !model.offered) return { kind: 'back-to-automatic', savedModelId, reason: 'withdrawn' };
  if (place !== null && !zoneCovers(model.zone, place)) return { kind: 'back-to-automatic', savedModelId, reason: 'outside-zone' };
  return { kind: 'model', model };
}

/** La `source` d'une ligne écrite par un modèle (contrat, § 6) : `open-meteo:<identifiant>`. */
export function forecastModelSource(modelId: string): string {
  return `open-meteo:${modelId}`;
}

/** Un jour de prévision lu pour un modèle choisi, avec le modèle qui l'a vraiment donné. */
export type ModelForecastDay = WeatherDailyValue & { source: string };

/**
 * Le jour de chaque date, pour un modèle choisi (règle 6) : le jour du modèle
 * tant qu'il donne la pluie du jour ; sinon le jour entier d'« Automatique
 * d'Open-Meteo », jamais un mélange des champs d'un même jour. Open-Meteo ne
 * donne une valeur du jour que si le jour est entier (essai A, § 14, point 3) :
 * la pluie du modèle n'est jamais un cumul partiel. Une valeur absente reste
 * `null` (règle 5, D-003).
 */
export function forecastDaysForModel(
  modelId: string,
  chosenDays: readonly WeatherDailyValue[],
  completionDays: readonly WeatherDailyValue[],
): ModelForecastDay[] {
  const chosen = new Map(chosenDays.map((day) => [day.date, day]));
  const completion = new Map(completionDays.map((day) => [day.date, day]));
  const dates = [...new Set([...chosen.keys(), ...completion.keys()])].sort();
  return dates.flatMap((date): ModelForecastDay[] => {
    const fromModel = chosen.get(date);
    if (fromModel && fromModel.precipitationMm !== null) return [{ ...fromModel, source: forecastModelSource(modelId) }];
    const fromCompletion = completion.get(date);
    if (fromCompletion) return [{ ...fromCompletion, source: forecastModelSource(COMPLETION_FORECAST_MODEL_ID) }];
    return fromModel ? [{ ...fromModel, source: forecastModelSource(modelId) }] : [];
  });
}

/**
 * Ce que l'écran dira des jours complétés (règle 6) : le dernier jour donné
 * par le modèle choisi et le premier jour complété, ou `null` si aucun.
 */
export function forecastCompletion(modelId: string, days: readonly Pick<SourcedWeatherDay, 'date' | 'source'>[]): {
  lastModelDate: string | null;
  firstCompletedDate: string | null;
} {
  const own = forecastModelSource(modelId);
  const fromModel = days.filter((day) => day.source === own);
  const completed = modelId === COMPLETION_FORECAST_MODEL_ID ? [] : days.filter((day) => day.source !== own);
  return {
    lastModelDate: fromModel.at(-1)?.date ?? null,
    firstCompletedDate: completed[0]?.date ?? null,
  };
}

/** Le lecteur de prévision par modèle (l'adaptateur Open-Meteo), vu du domaine. */
export interface ModelForecastReader {
  readModelForecast(input: WeatherReadInput, modelId: string): Promise<ModelForecastDay[]>;
}

/**
 * Le modèle qu'une lecture demande pour une ferme (règles 1, 9 et 13) : son
 * modèle enregistré, s'il est encore proposé et couvre son lieu, et si le
 * déploiement sait lire les modèles ; sinon `null`, « Automatique », la
 * lecture d'avant ce chantier.
 */
export function forecastModelToRead(choice: ForecastModelChoice, modelsReadable: boolean): string | null {
  return modelsReadable && choice.kind === 'model' ? choice.model.id : null;
}

/** Une lecture de prévision partagée : un modèle lu (`null` : « Automatique ») et les fermes qui la reçoivent. */
export type ForecastReading<T> = { modelId: string | null; members: T[] };

/**
 * Les lectures de prévision des fermes d'un même lieu (contrat, § 5) : une
 * par modèle lu, quel que soit le nombre de fermes qui le partagent ; deux
 * fermes de modèles différents ne partagent jamais une lecture, et
 * « Automatique » n'en partage aucune avec un modèle. Chaque ferme écrit
 * ensuite **ses** lignes, sous son espace : une lecture se partage, une ligne
 * jamais. L'ordre est celui de la première ferme de chaque lecture.
 */
export function forecastReadingsAtPlace<T>(members: readonly T[], modelOf: (member: T) => string | null): ForecastReading<T>[] {
  const readings = new Map<string | null, T[]>();
  for (const member of members) {
    const modelId = modelOf(member);
    const reading = readings.get(modelId) ?? [];
    reading.push(member);
    readings.set(modelId, reading);
  }
  return [...readings.entries()].map(([modelId, readingMembers]) => ({ modelId, members: readingMembers }));
}

/** Un jour de prévision lu, avec la `source` qu'il porte quand il vient d'un modèle choisi. */
export type SourcedWeatherDay = WeatherDailyValue & { source?: string };

/**
 * Les jours d'une lecture rangés par `source` (contrat, § 6 ; règle 6) : un
 * jour d'un modèle choisi porte la sienne (`open-meteo:<modèle>`, ou
 * `open-meteo:best_match` pour un jour complété) ; un jour qui n'en porte pas
 * vient du fournisseur d'« Automatique » et prend la sienne. Chaque groupe
 * s'écrit sous sa `source` : la table et l'archive disent, jour par jour, qui
 * a donné la ligne. L'ordre est celui du premier jour de chaque `source`.
 */
export function forecastDaysBySource(
  days: readonly SourcedWeatherDay[],
  providerSource: string,
): { source: string; values: WeatherDailyValue[] }[] {
  const groups = new Map<string, WeatherDailyValue[]>();
  for (const { source, ...value } of days) {
    const key = source ?? providerSource;
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([source, values]) => ({ source, values }));
}
