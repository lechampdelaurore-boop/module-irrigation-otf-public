import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Prépare l'état de départ des parcours navigateur : réglages de démonstration
 * vérifiés, puis base locale neuve et migrée. Sans cela, un parcours hériterait
 * des matériels et des irrigations laissés par le précédent, et prouverait
 * autre chose que ce qu'il annonce (docs/browser-journeys-contract.md).
 *
 * Seule la base de développement est touchée. Elle vit sous `.wrangler/`, que
 * Git ignore, et n'a aucun rapport avec la base D1 de production, qui n'est
 * joignable qu'avec un jeton Cloudflare que ce script n'utilise jamais.
 */
const STATE_DIRECTORY = path.join('.wrangler', 'state', 'v3', 'd1');
const VARS_FILE = '.dev.vars';
const VARS_EXAMPLE = '.dev.vars.example';
const REQUIRED_SETTINGS = [
  ['OTF_DATA_SOURCE', 'mock'],
  ['LOCAL_DEMO_USER', 'true'],
  ['WEATHER_DATA_SOURCE', 'mock'],
];

// Le runtime Cloudflare ne lit pas l'environnement du processus Node qui le
// lance : il lit ce fichier. Sur une machine neuve et en intégration continue,
// il n'existe pas ; l'exemple ne contient que des réglages de démonstration et
// aucun secret, il peut donc être recopié tel quel.
if (!existsSync(VARS_FILE)) {
  copyFileSync(VARS_EXAMPLE, VARS_FILE);
  console.log(`${VARS_FILE} créé à partir de ${VARS_EXAMPLE}.`);
}

const vars = readFileSync(VARS_FILE, 'utf8');
const manquants = REQUIRED_SETTINGS.filter(([cle, valeur]) => !new RegExp(`^${cle}=${valeur}$`, 'm').test(vars));
if (manquants.length > 0) {
  console.error(
    `Réglages de démonstration absents de ${VARS_FILE} : ${manquants.map(([cle, valeur]) => `${cle}=${valeur}`).join(', ')}.`,
  );
  console.error(
    'Les parcours navigateur ne doivent jamais interroger Ouvre ta ferme, la météo réelle ni la connexion Access.',
  );
  process.exit(1);
}
console.log('Réglages de démonstration vérifiés.');

if (existsSync(STATE_DIRECTORY)) {
  rmSync(STATE_DIRECTORY, { recursive: true, force: true });
  console.log(`Base locale supprimée : ${STATE_DIRECTORY}`);
} else {
  console.log(`Aucune base locale à supprimer : ${STATE_DIRECTORY}`);
}

// Lancé par Playwright, ce script n'a pas de terminal : Wrangler ne doit ni
// poser de question ni attendre une réponse. Sa sortie est capturée pour qu'un
// échec soit lisible, au lieu du « Command failed » sans explication.
const migration = spawnSync(
  'pnpm',
  ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'module-irrigation-otf', '--local'],
  {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
  },
);

if (migration.stdout) process.stdout.write(migration.stdout);
if (migration.stderr) process.stderr.write(migration.stderr);

if (migration.error) {
  console.error(`Wrangler n'a pas pu être lancé : ${migration.error.message}`);
  process.exit(1);
}
if (migration.status !== 0) {
  console.error(`Wrangler a échoué avec le code ${migration.status}.`);
  process.exit(migration.status ?? 1);
}

console.log('Base locale recréée et migrée.');

// La ferme de démonstration utilisait déjà le module avant la 3.8 : son espace
// d'irrigation existe, sans choix des fonctionnalités enregistré. Elle voit tout
// coché et le bandeau (docs/feature-selection-contract.md, R6), comme les fermes
// réelles le jour de la mise en ligne. Une ferme neuve, pour la première
// ouverture, se choisit par le témoin `demo-farm` (app/access-auth.ts).
const seed = spawnSync(
  'pnpm',
  [
    'exec', 'wrangler', 'd1', 'execute', 'module-irrigation-otf', '--local', '--command',
    "INSERT INTO irrigation_workspaces (id, owner_user_id) VALUES ('local-demo-workspace', 'local-demo-user')",
  ],
  {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
  },
);
if (seed.error || seed.status !== 0) {
  if (seed.stdout) process.stdout.write(seed.stdout);
  if (seed.stderr) process.stderr.write(seed.stderr);
  console.error('L’espace de la ferme de démonstration n’a pas pu être créé.');
  process.exit(seed.status ?? 1);
}
console.log('Espace de la ferme de démonstration créé, sans choix des fonctionnalités.');
