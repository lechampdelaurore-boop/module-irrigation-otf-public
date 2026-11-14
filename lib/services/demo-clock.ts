import { AsyncLocalStorage } from 'node:async_hooks';
import { simulatedOffsetMs } from '../domain/demo/simulated-clock.ts';

/**
 * L'horloge de la démonstration, posée requête par requête
 * (docs/demo-guided-contract.md, C3 ; `lib/domain/demo/simulated-clock.ts`).
 * Le module lit l'heure par `new Date()` et `Date.now()` en près de deux
 * cents endroits : plutôt que de les reprendre un à un, la démonstration
 * remplace l'horloge du Worker par une horloge qui lit, pour chaque requête,
 * le décalage du moment choisi par l'invité. Deux invités dans deux moments
 * différents ne se gênent pas : le décalage vit dans le contexte de leur
 * requête, jamais dans une variable commune. Hors d'une requête de
 * démonstration, l'horloge est l'horloge réelle.
 *
 * Jamais posée en production : seul le point d'entrée de la démonstration
 * (`demo-worker.ts`) l'installe.
 */

const offsets = new AsyncLocalStorage<number>();
const RealDate = globalThis.Date;
let installedOn: { Date: DateConstructor } | null = null;

function simulatedNow(): number {
  return RealDate.now() + (offsets.getStore() ?? 0);
}

function buildSimulatedDate(): DateConstructor {
  function SimulatedDate(this: unknown, ...args: unknown[]) {
    // `Date()` appelé sans `new` rend un texte, comme l'horloge réelle.
    if (!new.target) return new RealDate(simulatedNow()).toString();
    return Reflect.construct(RealDate, args.length === 0 ? [simulatedNow()] : args, new.target);
  }
  SimulatedDate.prototype = RealDate.prototype;
  SimulatedDate.now = simulatedNow;
  SimulatedDate.parse = RealDate.parse;
  SimulatedDate.UTC = RealDate.UTC;
  SimulatedDate.realNow = () => RealDate.now();
  return SimulatedDate as unknown as DateConstructor;
}

/** Remplace l'horloge, une seule fois ; les dates déjà créées restent des dates. */
export function installSimulatedDate(host: { Date: DateConstructor } = globalThis): void {
  if (installedOn === host) return;
  host.Date = buildSimulatedDate();
  installedOn = host;
}

/** Retire l'horloge simulée (tests). */
export function uninstallSimulatedDate(host: { Date: DateConstructor } = globalThis): void {
  host.Date = RealDate;
  if (installedOn === host) installedOn = null;
}

/**
 * L'heure réelle, même au milieu d'une requête de démonstration : pour ce
 * qui se vérifie contre le monde réel, comme la validité d'un jeton Cloudflare
 * Access (émis aujourd'hui, il paraîtrait « pas encore valide » au jour simulé
 * d'avril). Lue sur l'horloge installée plutôt que sur une variable de ce
 * module, pour rester juste même si le module est chargé deux fois.
 */
export function realNow(): number {
  const clock = globalThis.Date as DateConstructor & { realNow?: () => number };
  return typeof clock.realNow === 'function' ? clock.realNow() : clock.now();
}

/** L'écart de la requête en cours, ou `null` hors d'une requête de démonstration. */
export function currentSimulatedOffsetMs(): number | null {
  return offsets.getStore() ?? null;
}

/** Exécute un traitement au jour du moment, à l'heure réelle de la ferme. */
export function runOnSimulatedDay<T>(momentDateKey: string, work: () => T): T {
  return offsets.run(simulatedOffsetMs(RealDate.now(), momentDateKey), work);
}
