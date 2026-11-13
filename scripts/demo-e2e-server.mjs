import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Le serveur des parcours de la démonstration (docs/demo-guided-contract.md,
 * D3 ; playwright.demo.config.ts) : la même application, démarrée comme le
 * Worker de démonstration le serait, sans jamais toucher `wrangler.jsonc`.
 *
 * Une configuration locale est écrite sous `.wrangler/demo-e2e/` (ignoré par
 * Git) : le point d'entrée `demo-worker.ts` (date simulée), `DEMO_MODE`, les
 * données Ouvre ta ferme et la météo de démonstration, ni liaison au Worker
 * Push ni adresse de notification (la démonstration refuse de démarrer avec
 * l'une ou l'autre, couches 1 et 2 du contrat). Sa base locale est celle des
 * parcours ordinaires, remise à zéro avant : les deux suites se suivent.
 *
 * Usage : node scripts/demo-e2e-server.mjs <port>
 */
const port = process.argv[2] ?? '3200';
const root = process.cwd();
const directory = path.join(root, '.wrangler', 'demo-e2e');

const reset = spawnSync(process.execPath, ['scripts/reset-local-database.mjs'], { stdio: 'inherit' });
if (reset.status !== 0) process.exit(reset.status ?? 1);

// `wrangler.jsonc` ne porte que des commentaires sur des lignes entières.
const production = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n'));
// Ni liaison au Worker Push, ni adresse de notification.
const rest = { ...production };
delete rest.services;
const vars = { ...production.vars };
delete vars.IRRIGATION_PUSH_SERVICE_URL;
const demo = {
  ...rest,
  name: `${production.name}-demo-e2e`,
  // Les chemins se lisent depuis le dossier du fichier : ils sont donnés en entier.
  main: path.join(root, 'demo-worker.ts'),
  assets: { ...production.assets, directory: path.join(root, production.assets.directory) },
  d1_databases: production.d1_databases.map((database) => ({ ...database, migrations_dir: path.join(root, database.migrations_dir) })),
  vars: { ...vars, OTF_DATA_SOURCE: 'mock', DEMO_MODE: 'true' },
};

mkdirSync(directory, { recursive: true });
const configPath = path.join(directory, 'wrangler.jsonc');
writeFileSync(configPath, `${JSON.stringify(demo, null, 2)}\n`);
// Le runtime lit `.dev.vars` à côté de sa configuration : les seuls réglages de démonstration, aucun secret.
writeFileSync(path.join(directory, '.dev.vars'), 'OTF_DATA_SOURCE=mock\nLOCAL_DEMO_USER=true\nWEATHER_DATA_SOURCE=mock\nDEMO_MODE=true\n');
console.log(`Configuration de démonstration écrite : ${path.relative(root, configPath)}`);

const server = spawn(process.execPath, ['node_modules/vinext/dist/cli.js', 'dev', '--host', '127.0.0.1', '--port', port], {
  stdio: 'inherit',
  env: { ...process.env, IRRIGATION_WRANGLER_CONFIG: configPath },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
