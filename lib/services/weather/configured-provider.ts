import { env } from 'cloudflare:workers';
import { demonstrationWeatherProvider } from '../../adapters/weather/demonstration-provider.ts';
import { demoSeasonWeatherProvider } from '../../adapters/weather/demo-season-provider.ts';
import { openMeteoWeatherProvider } from '../../adapters/weather/open-meteo-provider.ts';
import { VisualCrossingWeatherProvider } from '../../adapters/weather/visual-crossing-provider.ts';
import type { WeatherProvider } from '../../domain/weather/weather-provider.ts';
import { isDemoDeployment } from '../deployment-mode.ts';

let cachedKey: string | null = null;
let cachedProvider: WeatherProvider | null = null;

class FreeWeatherProvider implements WeatherProvider {
  readonly id = 'free-weather-stack';
  // Champ explicite plutôt qu'une propriété de paramètre : Node en mode
  // « strip-only » ne sait pas la retirer, et les tests de persistance du
  // planning chargent ce module par le tableau de bord de l'eau.
  private readonly visualCrossing: VisualCrossingWeatherProvider;

  constructor(visualCrossing: VisualCrossingWeatherProvider) {
    this.visualCrossing = visualCrossing;
  }

  sourceId(endpoint: 'geocoding' | 'forecast' | 'reanalysis') {
    return endpoint === 'forecast' ? 'visual-crossing' : 'open-meteo';
  }

  searchLocations(query: string, postcode?: string | null) {
    return openMeteoWeatherProvider.searchLocations(query, postcode);
  }

  readForecast(input: Parameters<WeatherProvider['readForecast']>[0]) {
    return this.visualCrossing.readForecast(input);
  }

  readReanalysis(input: Parameters<WeatherProvider['readReanalysis']>[0]) {
    return openMeteoWeatherProvider.readReanalysis(input);
  }
}

/**
 * `WEATHER_DATA_SOURCE=mock` retient le fournisseur de démonstration, sans
 * réseau ni hasard, pour les parcours navigateur automatisés
 * (docs/browser-journeys-contract.md). Même forme que `OTF_DATA_SOURCE` : la
 * valeur par défaut est `live`, et la production ne pose jamais ce réglage.
 */
function readWeatherDataSource(): 'mock' | 'live' {
  const configured = process.env.WEATHER_DATA_SOURCE ?? env.WEATHER_DATA_SOURCE;
  return configured === 'mock' ? 'mock' : 'live';
}

export function getConfiguredWeatherProvider(): WeatherProvider {
  // La démonstration ne lit jamais la vraie météo (docs/demo-guided-contract.md,
  // couche 2) ; la sienne porte les moments de saison des fermes fictives.
  if (isDemoDeployment()) return demoSeasonWeatherProvider;
  if (readWeatherDataSource() === 'mock') return demonstrationWeatherProvider;
  const key = (process.env.VISUAL_CROSSING_API_KEY ?? env.VISUAL_CROSSING_API_KEY)?.trim() || null;
  if (!key) return openMeteoWeatherProvider;
  if (cachedProvider && cachedKey === key) return cachedProvider;
  cachedKey = key;
  cachedProvider = new FreeWeatherProvider(new VisualCrossingWeatherProvider(key));
  return cachedProvider;
}

export function weatherAttribution(provider: WeatherProvider) {
  // Une donnée de démonstration ne doit jamais être créditée à un fournisseur
  // réel : l'écran dirait faux sur l'origine de ce qu'il affiche.
  if (provider.id === 'demonstration') {
    return 'Données météo de démonstration, sans valeur agronomique : aucun fournisseur réel n’est interrogé.';
  }
  return provider.id === 'free-weather-stack'
    ? 'Prévisions : Visual Crossing Weather. ET0 calculée selon FAO-56. Réanalyses : Open-Meteo (CC BY 4.0).'
    : 'Prévisions et réanalyses : Open-Meteo (CC BY 4.0).';
}
