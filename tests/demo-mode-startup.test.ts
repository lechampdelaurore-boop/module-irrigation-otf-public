import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { env } from 'cloudflare:workers';
import { register } from '../instrumentation.ts';
import { readPlantSymbols } from '../lib/adapters/otf/plant-sprite.ts';
import { OtfReadClient } from '../lib/adapters/otf/read-client.ts';
import { OpenMeteoWeatherProvider } from '../lib/adapters/weather/open-meteo-provider.ts';
import { demonstrationWeatherProvider } from '../lib/adapters/weather/demonstration-provider.ts';
import { DemoOutboundRefusedError } from '../lib/domain/demo/outbound-guard.ts';
import { DeploymentRefusedError, isDemoDeployment, startDeployment } from '../lib/services/deployment-mode.ts';
import { getIrrigationPushPublicKey, registerIrrigationPushSubscription } from '../lib/services/irrigation-push-service.ts';
import { getConfiguredWeatherProvider } from '../lib/services/weather/configured-provider.ts';

/**
 * Le démarrage réel du module (docs/demo-guided-contract.md, section 5,
 * couches 2 et 3) : `instrumentation.ts`, que vinext attend avant toute page,
 * lit les réglages comme le Worker (`process.env`, puis `env`), refuse un
 * déploiement mélangé, et en démonstration garde l'appel réseau avant que
 * les adaptateurs réels ne s'en servent. Les réglages sont remis en l'état
 * après chaque test ; chaque fichier de test tourne dans son propre processus.
 */

const KEYS = [
  'DEMO_MODE',
  'OTF_DATA_SOURCE',
  'WEATHER_DATA_SOURCE',
  'OTF_API_TOKEN',
  'VISUAL_CROSSING_API_KEY',
  'IRRIGATION_PUSH_SERVICE_TOKEN',
  'IRRIGATION_PUSH_SERVICE_URL',
  'IRRIGATION_PUSH_VAPID_PUBLIC_KEY',
  'WEATHER_SYNC_SERVICE_TOKEN',
  'ACCESS_TEAM_DOMAIN',
] as const;

const savedEnv = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
const savedFetch = globalThis.fetch;
const workerEnv = env as unknown as Record<string, unknown>;

afterEach(() => {
  for (const key of KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  delete workerEnv.IRRIGATION_PUSH;
  delete workerEnv.OTF_API_TOKEN;
  globalThis.fetch = savedFetch;
});

function clearSettings() {
  for (const key of KEYS) delete process.env[key];
}

/** Un faux réseau qui note chaque appel : en démonstration, rien ne doit l'atteindre. */
function recordingNetwork(): string[] {
  const sent: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    sent.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  return sent;
}

test('le démarrage refuse une démonstration qui a un jeton Ouvre ta ferme (sens 1)', async () => {
  clearSettings();
  process.env.DEMO_MODE = 'true';
  process.env.OTF_API_TOKEN = 'jeton-de-test-sans-valeur';
  await assert.rejects(register(), (error: unknown) =>
    error instanceof DeploymentRefusedError
    && /OTF_API_TOKEN/.test(error.message)
    && !error.message.includes('jeton-de-test-sans-valeur'));
});

test('le démarrage refuse une démonstration liée au Worker de notification de la production (sens 1)', () => {
  clearSettings();
  process.env.DEMO_MODE = 'true';
  workerEnv.IRRIGATION_PUSH = { fetch: async () => new Response('') };
  assert.throws(() => startDeployment({ fetch: savedFetch }), DeploymentRefusedError);
});

test('le démarrage refuse la production quand elle voit DEMO_MODE (sens 2), même par les réglages du Worker', async () => {
  clearSettings();
  process.env.DEMO_MODE = 'true';
  process.env.OTF_DATA_SOURCE = 'live';
  workerEnv.OTF_API_TOKEN = 'jeton-de-test-sans-valeur';
  await assert.rejects(register(), (error: unknown) =>
    error instanceof DeploymentRefusedError && /OTF_DATA_SOURCE=live/.test(error.message) && /OTF_API_TOKEN/.test(error.message));
});

test('la production démarre sans garde réseau, comme avant D1', async () => {
  clearSettings();
  process.env.OTF_DATA_SOURCE = 'live';
  process.env.OTF_API_TOKEN = 'jeton-de-test-sans-valeur';
  const sent = recordingNetwork();
  const network = globalThis.fetch;
  await register();
  assert.equal(globalThis.fetch, network, 'l’appel réseau n’est pas remplacé');
  assert.equal(isDemoDeployment(), false);
  await fetch('https://api.open-meteo.com/v1/forecast');
  assert.deepEqual(sent, ['https://api.open-meteo.com/v1/forecast']);
});

test('en démonstration, les vrais adaptateurs n’atteignent ni Ouvre ta ferme ni la météo', async () => {
  clearSettings();
  process.env.DEMO_MODE = 'true';
  process.env.ACCESS_TEAM_DOMAIN = 'https://equipe-exemple.cloudflareaccess.com';
  const sent = recordingNetwork();
  await register();
  assert.equal(isDemoDeployment(), true);

  // Les dessins des espèces : la lecture échoue proprement, sans appel.
  assert.equal(await readPlantSymbols(['carotte']), null);
  // L'API d'Ouvre ta ferme, même avec un jeton fourni à la main.
  const otf = new OtfReadClient({ baseUrl: 'https://api.ouvretaferme.org/0.1beta', token: 'jeton-de-test-sans-valeur', minimumRequestIntervalMs: 0 });
  await assert.rejects(otf.getConfiguration());
  // La météo : géocodage d'Open-Meteo.
  const openMeteo = new OpenMeteoWeatherProvider(undefined, () => {});
  await assert.rejects(openMeteo.searchLocations('Rennes'));
  // Et tout appel direct.
  await assert.rejects(fetch('https://weather.visualcrossing.com/'), DemoOutboundRefusedError);

  assert.deepEqual(sent, [], 'aucun appel n’est parti');

  // Le domaine Access reste joignable : la connexion des invités se vérifie.
  await fetch('https://equipe-exemple.cloudflareaccess.com/cdn-cgi/access/certs');
  assert.deepEqual(sent, ['https://equipe-exemple.cloudflareaccess.com/cdn-cgi/access/certs']);
});

test('en démonstration, la météo est celle de démonstration même sans WEATHER_DATA_SOURCE', () => {
  clearSettings();
  assert.notEqual(getConfiguredWeatherProvider(), demonstrationWeatherProvider, 'hors démonstration, la valeur par défaut reste live');
  process.env.DEMO_MODE = 'true';
  assert.equal(getConfiguredWeatherProvider(), demonstrationWeatherProvider);
});

test('en démonstration, aucune notification : pas de clé publique, service désactivé', async () => {
  clearSettings();
  process.env.IRRIGATION_PUSH_VAPID_PUBLIC_KEY = 'cle-publique-de-test';
  process.env.IRRIGATION_PUSH_SERVICE_URL = 'https://irrigation-otf-push.exemple.workers.dev';
  assert.equal(getIrrigationPushPublicKey(), 'cle-publique-de-test');
  process.env.DEMO_MODE = 'true';
  const sent = recordingNetwork();
  assert.equal(getIrrigationPushPublicKey(), null);
  const result = await registerIrrigationPushSubscription('espace', {
    endpoint: 'https://push.exemple.net/abonnement',
    keys: { p256dh: 'p', auth: 'a' },
  } as Parameters<typeof registerIrrigationPushSubscription>[1]);
  assert.deepEqual(result, { status: 'disabled' });
  assert.deepEqual(sent, []);
});
