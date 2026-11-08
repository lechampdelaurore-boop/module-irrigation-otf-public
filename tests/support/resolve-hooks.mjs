// Résolveur de modules pour les tests Node (sous-tranche Q2).
//
// Le code applicatif est écrit pour Vite et le Worker Cloudflare. Trois choses
// empêchent Node de l'exécuter tel quel :
// - `cloudflare:workers` n'existe qu'à l'exécution dans le Worker : il est
//   remplacé par `cloudflare-workers.mjs`, qui expose un `env` vide ;
// - l'alias `@/` de `tsconfig.json` pointe sur la racine du dépôt ;
// - les imports relatifs sont écrits sans extension (`./schema`), alors que
//   Node exige `./schema.ts`.
// Rien d'autre n'est réécrit : Node exécute les vrais fichiers TypeScript
// grâce à `--experimental-strip-types`.
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const workersStub = new URL('./cloudflare-workers.mjs', import.meta.url).href;
const EXTENSIONS = ['.ts', '.mts', '.js', '.mjs'];
const INDEX_FILES = ['index.ts', 'index.js'];

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers') {
    return { url: workersStub, shortCircuit: true, format: 'module' };
  }
  const candidate = candidatePath(specifier, context.parentURL);
  if (candidate) {
    const resolved = withExtension(candidate);
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }
  return nextResolve(specifier, context);
}

function candidatePath(specifier, parentURL) {
  if (specifier.startsWith('@/')) return path.join(projectRoot, specifier.slice(2));
  if (!parentURL || !parentURL.startsWith('file:')) return null;
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.resolve(path.dirname(fileURLToPath(parentURL)), specifier);
  }
  return null;
}

function withExtension(candidate) {
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  for (const extension of EXTENSIONS) {
    if (existsSync(candidate + extension)) return candidate + extension;
  }
  for (const indexFile of INDEX_FILES) {
    const indexPath = path.join(candidate, indexFile);
    if (existsSync(indexPath)) return indexPath;
  }
  return null;
}
