import { env } from 'cloudflare:workers';
import { DEPLOYMENT_KEY_FARM, OTF_MINIMUM_REQUEST_INTERVAL_MS, OtfReadClient } from '@/lib/adapters/otf/read-client';
import { isDemoDeployment } from '@/lib/services/deployment-mode';

/**
 * La source des données d'Ouvre ta ferme et son client de lecture, en un seul
 * endroit : la lecture de l'instantané et celle de l'identité de la ferme
 * (4.1, docs/tranche-4-contract.md, F339) suivent la même règle.
 */

export function readOtfDataSource(): 'mock' | 'live' {
  // La démonstration ne lit jamais Ouvre ta ferme (docs/demo-guided-contract.md, couche 2).
  if (isDemoDeployment()) return 'mock';
  // En développement local, le lanceur sécurisé fournit les réglages via
  // process.env. Ils doivent donc primer sur les bindings du site publié.
  const configured = process.env.OTF_DATA_SOURCE ?? env.OTF_DATA_SOURCE;
  return configured === 'live' ? 'live' : 'mock';
}

/**
 * Le client de lecture, avec la clé du déploiement, qui reste côté serveur.
 * Avant la 4.3, cette clé mène à une seule ferme : ses appels passent par le
 * régulateur de cette ferme (docs/tranche-4-contract.md, F334).
 */
export function createOtfReadClient(): OtfReadClient {
  return new OtfReadClient({
    baseUrl: readRequiredServerSetting('OTF_API_BASE_URL'),
    token: readRequiredServerSetting('OTF_API_TOKEN'),
    minimumRequestIntervalMs: OTF_MINIMUM_REQUEST_INTERVAL_MS,
    farmKey: DEPLOYMENT_KEY_FARM,
  });
}

function readRequiredServerSetting(
  key: 'OTF_API_BASE_URL' | 'OTF_API_TOKEN',
): string {
  const workerValue =
    key === 'OTF_API_BASE_URL' ? env.OTF_API_BASE_URL : env.OTF_API_TOKEN;
  const value = process.env[key] ?? workerValue;
  if (!value?.trim()) throw new Error(`Configuration serveur absente : ${key}`);
  return value.trim();
}
