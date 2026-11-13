import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { deploymentMode } from '../lib/domain/demo/deployment-mode.ts';

/**
 * Le déploiement séparé de la démonstration (docs/demo-guided-contract.md,
 * C1 et section 5, couche 1 ; D4) : `wrangler.demo.jsonc` décrit un autre
 * Worker et une autre base que la production, sans secret ni liaison au
 * Worker de notification, et le mode démo l'accepte tel quel ; la CI le
 * déploie après la production, jamais à sa place.
 */

type WranglerConfig = {
  name: string;
  main: string;
  compatibility_date: string;
  compatibility_flags?: string[];
  workers_dev?: boolean;
  preview_urls?: boolean;
  services?: unknown[];
  d1_databases: { binding: string; database_name: string; database_id: string; migrations_dir: string }[];
  vars: Record<string, string>;
  triggers?: { crons?: string[] };
};

/** Les deux configurations ne portent que des commentaires sur des lignes entières. */
function readConfig(file: string): WranglerConfig {
  return JSON.parse(readFileSync(file, 'utf8').split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n')) as WranglerConfig;
}

const production = readConfig('wrangler.jsonc');
const demo = readConfig('wrangler.demo.jsonc');

test('la démonstration est un autre Worker, sur une autre base, au même code et au même runtime', () => {
  assert.notEqual(demo.name, production.name);
  assert.equal(demo.main, 'demo-worker.ts');
  assert.equal(demo.compatibility_date, production.compatibility_date);
  assert.deepEqual(demo.compatibility_flags, production.compatibility_flags);
  assert.equal(demo.d1_databases.length, 1);
  const [base] = demo.d1_databases;
  const [productionBase] = production.d1_databases;
  assert.equal(base.binding, productionBase.binding);
  assert.equal(base.migrations_dir, productionBase.migrations_dir);
  assert.notEqual(base.database_id, productionBase.database_id);
  assert.notEqual(base.database_name, productionBase.database_name);
  assert.match(base.database_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('ni liaison au Worker de notification, ni source réelle, ni réglage de notification ; une seule adresse', () => {
  assert.equal(demo.services, undefined);
  assert.equal(demo.vars.DEMO_MODE, 'true');
  assert.equal(demo.vars.OTF_DATA_SOURCE, 'mock');
  assert.equal(demo.vars.WEATHER_DATA_SOURCE, 'mock');
  assert.deepEqual(Object.keys(demo.vars).filter((name) => /PUSH|OTF_API|TOKEN|KEY|SECRET|LOCAL_DEMO/.test(name)), []);
  assert.equal(demo.vars.ACCESS_TEAM_DOMAIN, production.vars.ACCESS_TEAM_DOMAIN);
  assert.equal(demo.workers_dev, true);
  assert.equal(demo.preview_urls, false);
});

test('le mode démo accepte cette configuration telle qu’elle est écrite', () => {
  const mode = deploymentMode({
    demoMode: demo.vars.DEMO_MODE,
    otfDataSource: demo.vars.OTF_DATA_SOURCE,
    weatherDataSource: demo.vars.WEATHER_DATA_SOURCE,
    otfApiToken: false,
    visualCrossingApiKey: false,
    pushServiceToken: false,
    weatherSyncServiceToken: false,
    pushServiceBinding: Boolean(demo.services?.length),
  });
  assert.deepEqual(mode, { kind: 'demonstration' });
});

test('la remise à zéro de nuit est planifiée une fois par jour', () => {
  assert.deepEqual(demo.triggers?.crons?.length, 1);
  assert.match(demo.triggers!.crons![0], /^\d{1,2} \d{1,2} \* \* \*$/);
});

test('la CI déploie la démonstration après la production, sur sa propre base', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  const job = workflow.slice(workflow.indexOf('\n  deploy-demo:'));
  assert.ok(job.length > 1, 'job deploy-demo absent');
  assert.match(job, /needs: \[deploy\]/);
  assert.match(job, /pnpm demo:build/);
  assert.match(job, /pnpm demo:migrate:remote/);
  assert.match(job, /pnpm demo:deploy/);
  const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts;
  assert.match(scripts['demo:build'], /IRRIGATION_WRANGLER_CONFIG=wrangler\.demo\.jsonc/);
  assert.equal(scripts['demo:migrate:remote'], `wrangler d1 migrations apply ${demo.d1_databases[0].database_name} --remote --config wrangler.demo.jsonc`);
  assert.doesNotMatch(scripts['demo:migrate:remote'], new RegExp(`${production.d1_databases[0].database_name}(?!-demo)`));
});
