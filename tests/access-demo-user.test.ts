import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Revue de sécurité de la 3.9 (lot 5, `docs/recette-tranche-3.md`, D3) :
 * l'utilisateur de démonstration n'existe jamais en production.
 *
 * `LOCAL_DEMO_USER=true` ouvre le module sans Cloudflare Access, pour les
 * parcours et le développement. La garde est la condition
 * `process.env.NODE_ENV !== 'production'`, que la compilation remplace par
 * `false` : `pnpm build`, la commande du déploiement, retire alors la branche
 * entière du paquet (constaté le 9 novembre 2026 sur le paquet construit).
 * Ce test lit le code réel, comme la règle de taille du lint, pour que la
 * garde tienne demain : tout usage de la variable dans le code servi doit
 * porter la condition sur la même ligne.
 */

const SERVED = ['app', 'lib', 'db'];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sources(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}

test('LOCAL_DEMO_USER : chaque lecture dans le code servi porte la garde « hors production » sur la même ligne', () => {
  const reads = SERVED.flatMap(sources)
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
    .flatMap((file) => readFileSync(file, 'utf8').split('\n')
      .map((line, index) => ({ file, line: index + 1, text: line }))
      .filter(({ text }) => /process\.env\.LOCAL_DEMO_USER|env\.LOCAL_DEMO_USER|\[['"]LOCAL_DEMO_USER['"]\]/.test(text)));

  assert.ok(reads.length >= 1, 'la lecture d’app/access-auth.ts est trouvée : sinon ce test ne garde plus rien');
  const unguarded = reads.filter(({ text }) => !text.includes("process.env.NODE_ENV !== 'production' &&"));
  assert.deepEqual(unguarded.map(({ file, line }) => `${file}:${line}`), []);
});

test('l’utilisateur de démonstration ne se lit qu’après la garde, jamais avant', () => {
  const source = readFileSync('app/access-auth.ts', 'utf8');
  const guard = source.indexOf("process.env.NODE_ENV !== 'production' && process.env.LOCAL_DEMO_USER === 'true'");
  assert.ok(guard > 0, 'la garde est écrite telle quelle');
  const firstDemoUse = source.indexOf('return demoUser(');
  assert.ok(firstDemoUse > guard, 'le seul retour de l’utilisateur de démonstration suit la garde');
  assert.equal(source.split('return demoUser(').length - 1, 1, 'un seul retour de l’utilisateur de démonstration');
});
