import { env } from 'cloudflare:workers';
import { demonstrationModelForecastReader, demonstrationWeatherProvider } from '../../adapters/weather/demonstration-provider.ts';
import { demoSeasonWeatherProvider } from '../../adapters/weather/demo-season-provider.ts';
import { OpenMeteoWeatherProvider, openMeteoWeatherProvider } from '../../adapters/weather/open-meteo-provider.ts';
import { VisualCrossingWeatherProvider } from '../../adapters/weather/visual-crossing-provider.ts';
import { COMPLETION_FORECAST_MODEL_ID, forecastModel, type ModelForecastReader } from '../../domain/weather/forecast-models.ts';
import type { WeatherProvider } from '../../domain/weather/weather-provider.ts';
import { isDemoDeployment } from '../deployment-mode.ts';

let cachedKey: string | null = null;
let cachedProvider: WeatherProvider | null = null;
let cachedModelAccess: string | null = null;
let cachedModelReader: ModelForecastReader | null = null;

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

function readServerSetting(key: 'OPEN_METEO_API_BASE_URL' | 'OPEN_METEO_API_KEY'): string | null {
  return (process.env[key] ?? env[key])?.trim() || null;
}

/**
 * Le lecteur de la prévision d'un modèle choisi par la ferme
 * (docs/weather-models-contract.md, D-345, D-346), ou `null` quand le choix
 * n'existe pas : en démonstration, qui ne lit jamais la vraie météo
 * (règle 13). Les parcours automatisés (`WEATHER_DATA_SOURCE=mock`) reçoivent
 * une réponse fixe par modèle, sans réseau (F1022). Sans réglage, l'offre
 * gratuite ; `OPEN_METEO_API_BASE_URL` et `OPEN_METEO_API_KEY` passent à une
 * offre payante sans changer une règle (§ 10). La clé n'est jamais lue
 * ailleurs ni journalisée.
 */
export function getModelForecastReader(): ModelForecastReader | null {
  if (isDemoDeployment()) return null;
  if (readWeatherDataSource() === 'mock') return demonstrationModelForecastReader;
  const baseUrl = readServerSetting('OPEN_METEO_API_BASE_URL');
  const apiKey = readServerSetting('OPEN_METEO_API_KEY');
  if (baseUrl === null && apiKey === null) return openMeteoWeatherProvider;
  const access = JSON.stringify([baseUrl, apiKey]);
  if (cachedModelReader && cachedModelAccess === access) return cachedModelReader;
  cachedModelAccess = access;
  cachedModelReader = new OpenMeteoWeatherProvider(undefined, undefined, { baseUrl, apiKey });
  return cachedModelReader;
}

/**
 * D'où viennent les données météo affichées (docs/weather-contract.md ;
 * docs/weather-models-contract.md, § 6 ; D-346, F1021) : le fournisseur
 * d'« Automatique », ou, pour un modèle choisi (`modelId`), son producteur
 * lu par Open-Meteo, avec le complément au-delà de sa portée (règle 6).
 */
export function weatherAttribution(provider: WeatherProvider, modelId: string | null = null) {
  // Une donnée de démonstration ne doit jamais être créditée à un fournisseur
  // réel : l'écran dirait faux sur l'origine de ce qu'il affiche.
  if (provider.id === 'demonstration') {
    return 'Données météo de démonstration, sans valeur agronomique : aucun fournisseur réel n’est interrogé.';
  }
  const model = modelId === null ? null : forecastModel(modelId);
  if (model !== null && model.id !== COMPLETION_FORECAST_MODEL_ID) {
    return `Prévisions : ${model.provider}, par Open-Meteo (CC BY 4.0) ; au-delà de la portée du modèle, Automatique d’Open-Meteo. Réanalyses : Open-Meteo (CC BY 4.0).`;
  }
  if (model !== null) return 'Prévisions et réanalyses : Open-Meteo (CC BY 4.0).';
  return provider.id === 'free-weather-stack'
    ? 'Prévisions : Visual Crossing Weather. ET0 calculée selon FAO-56. Réanalyses : Open-Meteo (CC BY 4.0).'
    : 'Prévisions et réanalyses : Open-Meteo (CC BY 4.0).';
}
