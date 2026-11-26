import type { ForecastArchiveRow } from './forecast-archive.ts';
import type { RecordedDayShape } from './hourly-et0.ts';
import type { WeatherDailyValue } from './weather-provider.ts';

/**
 * Contrat de la synchronisation météo automatique : lieu à synchroniser,
 * cible par espace de travail et opérations de persistance attendues. Le
 * service l'implémente avec les dépôts ; db/ le réalise sans dépendre du
 * service.
 */
export type WeatherSyncLocation = {
  locationKey: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type AutomaticWeatherTarget = WeatherSyncLocation & {
  workspaceId: string;
  refreshNotBeforeAt: string | null;
  /**
   * Le modèle de prévision enregistré par l'exploitation
   * (docs/weather-models-contract.md, D-346) ; absent ou `null` :
   * « Automatique », la lecture d'avant ce chantier (règle 1).
   */
  forecastModel?: string | null;
};

export type AutomaticWeatherSyncRepository = {
  claimJob(at: string, lockExpiresAt: string): Promise<string | null>;
  finishJob(input: {
    token: string;
    at: string;
    successful: boolean;
    error: string | null;
  }): Promise<void>;
  listTargets(): Promise<AutomaticWeatherTarget[]>;
  upsertValues(input: {
    target: AutomaticWeatherTarget;
    kind: 'forecast' | 'reanalysis';
    values: readonly WeatherDailyValue[];
    source: string;
    fetchedAt: string;
  }): Promise<void>;
  /**
   * La photographie du jour des prévisions J+1 à J+7 d'une exploitation
   * (docs/forecast-archive-contract.md, D-297) : jamais écrasée ; rend le
   * nombre de lignes nouvelles.
   */
  archiveForecast(input: {
    workspaceId: string;
    locationKey: string;
    issuedOn: string;
    rows: readonly ForecastArchiveRow[];
    source: string;
    fetchedAt: string;
  }): Promise<number>;
  /**
   * La forme de la journée d'un lieu, J0 à J+2, sous la source de la ligne du
   * jour (docs/et0-horaire-contract.md, D-349) : une lecture plus récente
   * remplace la forme d'un jour ; rend le nombre de lignes écrites. Absent :
   * rien ne s'écrit et l'écran prend la forme théorique.
   */
  writeDayShapes?(input: {
    placeKey: string;
    rows: readonly RecordedDayShape[];
    source: string;
    fetchedAt: string;
  }): Promise<number>;
  recordWorkspaceResult(input: {
    workspaceId: string;
    at: string;
    successful: boolean;
    error: string | null;
    notBeforeAt: string | null;
  }): Promise<void>;
  /**
   * Règle 9 des modèles (docs/weather-models-contract.md, D-346) : ramène une
   * exploitation à « Automatique » quand son modèle n'est plus proposé ou ne
   * couvre plus son lieu, si elle l'a encore, avec sa ligne au journal des
   * modifications (« Le module ») ; rend `true` si la ferme a changé. Absent :
   * la ferme lit « Automatique » sans que rien ne s'écrive.
   */
  returnForecastModelToAutomatic?(input: { workspaceId: string; savedModelId: string; at: string }): Promise<boolean>;
};
