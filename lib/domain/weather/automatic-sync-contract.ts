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
  recordWorkspaceResult(input: {
    workspaceId: string;
    at: string;
    successful: boolean;
    error: string | null;
    notBeforeAt: string | null;
  }): Promise<void>;
};
