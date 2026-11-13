import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  DEMO_BANNER_TEXT,
  deploymentMode,
  deploymentRefusalMessage,
  type DeploymentRefusal,
  type DeploymentSettings,
} from '../lib/domain/demo/deployment-mode.ts';
import {
  demoAllowedOrigins,
  DemoOutboundRefusedError,
  guardedFetch,
  isOutboundAllowedInDemo,
} from '../lib/domain/demo/outbound-guard.ts';

/**
 * Les garde-fous du mode démo (docs/demo-guided-contract.md, section 5,
 * couches 2 et 3 ; D1 de la sous-tranche 4.0). Couche 2 : un déploiement est
 * la production ou la démonstration, et refuse de démarrer dans les deux sens
 * quand les deux se mélangent. Couche 3 : en démonstration, aucun appel ne
 * part vers Ouvre ta ferme, un fournisseur de météo ni le service de
 * notification.
 */

const ACCESS_TEAM_DOMAIN = 'https://equipe-exemple.cloudflareaccess.com';

const NOTHING_REAL: DeploymentSettings = {
  demoMode: undefined,
  otfDataSource: undefined,
  weatherDataSource: undefined,
  otfApiToken: false,
  visualCrossingApiKey: false,
  pushServiceToken: false,
  weatherSyncServiceToken: false,
  pushServiceBinding: false,
};

/** Ce que la production a réellement : `wrangler.jsonc` et ses secrets. */
const PRODUCTION: DeploymentSettings = {
  demoMode: undefined,
  otfDataSource: 'live',
  weatherDataSource: undefined,
  otfApiToken: true,
  visualCrossingApiKey: true,
  pushServiceToken: true,
  weatherSyncServiceToken: true,
  pushServiceBinding: true,
};

// --- Couche 2 : le mode du déploiement ---------------------------------------

test('sans DEMO_MODE, la production et les parcours se comportent comme avant', () => {
  assert.deepEqual(deploymentMode(PRODUCTION), { kind: 'production' });
  assert.deepEqual(deploymentMode(NOTHING_REAL), { kind: 'production' });
  assert.deepEqual(deploymentMode({ ...PRODUCTION, demoMode: 'false' }), { kind: 'production' });
  assert.deepEqual(deploymentMode({ ...PRODUCTION, demoMode: '  ' }), { kind: 'production' });
});

test('DEMO_MODE=true sans rien de réel : la démonstration démarre, sources de démonstration ou absentes', () => {
  assert.deepEqual(deploymentMode({ ...NOTHING_REAL, demoMode: 'true' }), { kind: 'demonstration' });
  assert.deepEqual(
    deploymentMode({ ...NOTHING_REAL, demoMode: 'true', otfDataSource: 'mock', weatherDataSource: 'mock' }),
    { kind: 'demonstration' },
  );
});

const DEMO_RECEIVES: readonly [string, Partial<DeploymentSettings>, DeploymentRefusal][] = [
  ['la source OTF live', { otfDataSource: 'live' }, 'otf-live-source'],
  ['un jeton OTF', { otfApiToken: true }, 'otf-token'],
  ['la météo live', { weatherDataSource: 'live' }, 'weather-live-source'],
  ['une clé de météo', { visualCrossingApiKey: true }, 'weather-key'],
  ['le jeton du service de notification', { pushServiceToken: true }, 'push-token'],
  ['la liaison au Worker de notification', { pushServiceBinding: true }, 'push-binding'],
  ['le jeton de synchronisation météo', { weatherSyncServiceToken: true }, 'weather-sync-token'],
];

for (const [label, change, refusal] of DEMO_RECEIVES) {
  test(`sens 1 : une démonstration qui reçoit ${label} refuse de démarrer`, () => {
    assert.deepEqual(deploymentMode({ ...NOTHING_REAL, demoMode: 'true', ...change }), { kind: 'refused', refusals: [refusal] });
  });
}

test('sens 2 : une production qui voit DEMO_MODE refuse de démarrer, et dit tout ce qui est réel', () => {
  assert.deepEqual(deploymentMode({ ...PRODUCTION, demoMode: 'true' }), {
    kind: 'refused',
    refusals: ['otf-live-source', 'otf-token', 'weather-key', 'push-token', 'push-binding', 'weather-sync-token'],
  });
});

test('une valeur de DEMO_MODE illisible refuse de démarrer, en production comme en démonstration', () => {
  for (const value of ['1', 'yes', 'TRUE', 'vrai', 'true,false']) {
    assert.deepEqual(deploymentMode({ ...NOTHING_REAL, demoMode: value }), { kind: 'refused', refusals: ['demo-mode-unreadable'] }, value);
    assert.deepEqual(deploymentMode({ ...PRODUCTION, demoMode: value }), { kind: 'refused', refusals: ['demo-mode-unreadable'] }, value);
  }
});

test('le message du refus nomme les réglages, jamais une valeur', () => {
  const message = deploymentRefusalMessage(['otf-token', 'push-binding']);
  assert.match(message, /^Démarrage refusé : /);
  assert.match(message, /OTF_API_TOKEN/);
  assert.match(message, /IRRIGATION_PUSH\)/);
});

// --- Couche 3 : le réseau sortant --------------------------------------------

const REAL_SERVICES = [
  'https://api.ouvretaferme.org/0.1beta/zones?season=2026',
  'https://www.ouvretaferme.org/static/production/plant/image/plants.svg',
  'https://geocoding-api.open-meteo.com/v1/search?name=Rennes',
  'https://api.open-meteo.com/v1/forecast?latitude=48&longitude=-1',
  'https://archive-api.open-meteo.com/v1/archive',
  'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/48,-1',
  'https://irrigation-otf-push.exemple.workers.dev/v1/notifications/send',
];

test('en démonstration, un appel vers Ouvre ta ferme, la météo ou le service de notification est refusé sans partir', async () => {
  const sent: string[] = [];
  const guarded = guardedFetch(async (input) => {
    sent.push(String(input));
    return new Response('ok');
  }, demoAllowedOrigins(ACCESS_TEAM_DOMAIN));

  for (const url of REAL_SERVICES) {
    await assert.rejects(guarded(url), (error: unknown) => error instanceof DemoOutboundRefusedError && error.message === `Démonstration : appel réseau refusé vers ${new URL(url).host}.`, url);
    await assert.rejects(guarded(new URL(url)), DemoOutboundRefusedError, url);
    await assert.rejects(guarded(new Request(url)), DemoOutboundRefusedError, url);
  }
  assert.deepEqual(sent, [], 'aucun appel n’est parti');
});

test('en démonstration, seul le domaine Access de l’équipe reste joignable, à l’origine exacte', async () => {
  const allowed = demoAllowedOrigins(ACCESS_TEAM_DOMAIN);
  assert.deepEqual(allowed, [ACCESS_TEAM_DOMAIN]);
  assert.equal(isOutboundAllowedInDemo(`${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`, allowed), true);
  for (const lookalike of [
    'https://equipe-exemple.cloudflareaccess.com.exemple.net/cdn-cgi/access/certs',
    'http://equipe-exemple.cloudflareaccess.com/cdn-cgi/access/certs',
    'https://equipe-exemple.cloudflareaccess.com:8443/cdn-cgi/access/certs',
    'https://autre.cloudflareaccess.com/cdn-cgi/access/certs',
    'pas une adresse',
  ]) {
    assert.equal(isOutboundAllowedInDemo(lookalike, allowed), false, lookalike);
  }
  const sent: string[] = [];
  const guarded = guardedFetch(async (input) => {
    sent.push(String(input));
    return new Response('{}');
  }, allowed);
  await guarded(`${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
  assert.deepEqual(sent, [`${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`]);
});

test('sans domaine Access lisible, la démonstration ne joint rien du tout', () => {
  assert.deepEqual(demoAllowedOrigins(undefined), []);
  assert.deepEqual(demoAllowedOrigins(''), []);
  assert.deepEqual(demoAllowedOrigins('pas une adresse'), []);
  assert.deepEqual(demoAllowedOrigins('http://equipe-exemple.cloudflareaccess.com'), []);
});

// --- La bannière, le push et la saisie de jeton ------------------------------

test('la bannière dit ce que le contrat demande, mot pour mot', () => {
  assert.equal(DEMO_BANNER_TEXT, 'Démonstration : données fictives. Rien ici ne touche une vraie ferme.');
});

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sources(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}

test('aucun écran ne saisit ni ne lit le jeton Ouvre ta ferme : il reste un secret du serveur', () => {
  const screens = sources('app').filter((file) => /\.tsx?$/.test(file));
  const readers = screens.filter((file) => /OTF_API_TOKEN/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(readers, []);
});

test('la barre du haut porte la bannière en démonstration et n’y montre jamais la cloche', () => {
  const topbar = readFileSync('app/irrigation/shell/topbar.tsx', 'utf8');
  assert.match(topbar, /\{demo \? <DemoBanner selection=\{demoSelection\} tour=\{tour\} \/> : null\}/);
  assert.match(topbar, /const bellHref = demo \? null : notificationsHref;/);
  // Chaque page passe par la barre du haut : le gabarit, l'état indisponible, la première ouverture et la page introuvable.
  for (const file of ['app/irrigation/shell/irrigation-shell.tsx', 'app/irrigation/shell/unavailable-state.tsx', 'app/irrigation/bienvenue/welcome-choice.tsx', 'app/not-found.tsx']) {
    assert.match(readFileSync(file, 'utf8'), /<Topbar[^>]*demo=\{demo\}/, file);
  }
});
