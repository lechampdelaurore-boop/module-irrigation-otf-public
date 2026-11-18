// Résolveur de modules des tests du Worker Push : seul `cloudflare:workers`
// est remplacé ; le reste du code est le vrai, exécuté par Node grâce à
// `--experimental-strip-types`.
const workersStub = new URL('./cloudflare-workers.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers') {
    return { url: workersStub, shortCircuit: true, format: 'module' };
  }
  return nextResolve(specifier, context);
}
