// Résolveur du passage « moteur commun » (jauge-moteur-commun.mjs) : seul
// l'interrupteur de la jauge est remplacé ; tout le reste se résout comme
// d'habitude (resolve-hooks.mjs).
const SWITCH = '/lib/domain/soil-reserve/gauge-switch.ts';
const VARIANT = new URL('./gauge-switch-commun.ts', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context);
  return resolved.url.endsWith(SWITCH) ? { ...resolved, url: VARIANT } : resolved;
}
