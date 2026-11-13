/**
 * L'horloge simulée côté navigateur (docs/demo-guided-contract.md, C3).
 * Le serveur joue chaque requête au jour du moment (`lib/services/demo-clock.ts`) ;
 * les écrans qui lisent l'heure dans le navigateur (le planning de la
 * semaine, les formulaires datés du jour, « dans 2 h ») doivent lire la même.
 * Le serveur écrit donc en tête de page un court script qui décale l'horloge
 * du navigateur du même écart, avant que les écrans ne s'animent. Jamais
 * écrit hors démonstration.
 */

/** Le script, qui ne porte qu'un nombre : l'écart en millisecondes, entier. */
export function browserClockScript(offsetMs: number): string {
  if (!Number.isSafeInteger(offsetMs)) throw new RangeError('Écart de l’horloge illisible.');
  return [
    '(function(o){',
    'var R=Date;',
    'function n(){return R.now()+o;}',
    'function S(){',
    'if(!new.target)return new R(n()).toString();',
    'return Reflect.construct(R,arguments.length?Array.prototype.slice.call(arguments):[n()],new.target);',
    '}',
    'S.prototype=R.prototype;S.now=n;S.parse=R.parse;S.UTC=R.UTC;',
    'window.Date=S;',
    `})(${offsetMs});`,
  ].join('');
}
