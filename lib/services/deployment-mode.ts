import { env } from 'cloudflare:workers';
import {
  deploymentMode,
  deploymentRefusalMessage,
  type DeploymentMode,
  type DeploymentSettings,
} from '../domain/demo/deployment-mode.ts';
import { demoAllowedOrigins, guardedFetch } from '../domain/demo/outbound-guard.ts';
import { logJsonLine } from '../adapters/log.ts';

/**
 * Le mode du déploiement lu dans les réglages du Worker (docs/demo-guided-contract.md,
 * section 5, couches 2 et 3). Comme ailleurs dans le module, le lanceur local
 * (`process.env`) prime sur les réglages du site publié (`env`). Aucune valeur
 * de secret n'est lue au-delà de sa présence, ni journalisée.
 */

type SettingKey =
  | 'DEMO_MODE'
  | 'OTF_DATA_SOURCE'
  | 'WEATHER_DATA_SOURCE'
  | 'OTF_API_TOKEN'
  | 'VISUAL_CROSSING_API_KEY'
  | 'IRRIGATION_PUSH_SERVICE_TOKEN'
  | 'WEATHER_SYNC_SERVICE_TOKEN'
  | 'ACCESS_TEAM_DOMAIN';

function readSetting(key: SettingKey): string | undefined {
  const workerEnv = env as Partial<Record<SettingKey, string>>;
  return process.env[key] ?? workerEnv[key];
}

const present = (key: SettingKey) => Boolean(readSetting(key)?.trim());

function readDeploymentSettings(): DeploymentSettings {
  return {
    demoMode: readSetting('DEMO_MODE'),
    otfDataSource: readSetting('OTF_DATA_SOURCE'),
    weatherDataSource: readSetting('WEATHER_DATA_SOURCE'),
    otfApiToken: present('OTF_API_TOKEN'),
    visualCrossingApiKey: present('VISUAL_CROSSING_API_KEY'),
    pushServiceToken: present('IRRIGATION_PUSH_SERVICE_TOKEN'),
    weatherSyncServiceToken: present('WEATHER_SYNC_SERVICE_TOKEN'),
    pushServiceBinding: Boolean((env as { IRRIGATION_PUSH?: unknown }).IRRIGATION_PUSH),
  };
}

function currentDeploymentMode(): DeploymentMode {
  return deploymentMode(readDeploymentSettings());
}

/**
 * Vrai seulement pour une démonstration dont le démarrage a été accepté. Un
 * déploiement refusé ne sert aucune page (`instrumentation.ts`) ; s'il était
 * lu quand même, il compterait comme une démonstration, la lecture la plus
 * prudente : données fictives, rien d'envoyé.
 */
export function isDemoDeployment(): boolean {
  return currentDeploymentMode().kind !== 'production';
}

export class DeploymentRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeploymentRefusedError';
  }
}

type FetchHost = { fetch: typeof fetch };

/**
 * Le contrôle du démarrage, appelé une fois par `instrumentation.ts` avant
 * toute page : il refuse un déploiement mélangé, et en démonstration il garde
 * l'appel réseau du Worker. Il rend le mode retenu.
 */
export function startDeployment(host: FetchHost = globalThis): DeploymentMode {
  const mode = currentDeploymentMode();
  if (mode.kind === 'refused') {
    logJsonLine('warn', { event: 'deployment_refused', refusals: mode.refusals });
    throw new DeploymentRefusedError(deploymentRefusalMessage(mode.refusals));
  }
  if (mode.kind === 'demonstration') {
    const allowed = demoAllowedOrigins(readSetting('ACCESS_TEAM_DOMAIN'));
    host.fetch = guardedFetch(host.fetch.bind(host), allowed) as typeof fetch;
    logJsonLine('info', { event: 'deployment_demonstration', allowedOrigins: allowed.length });
  }
  return mode;
}
