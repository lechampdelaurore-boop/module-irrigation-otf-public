import { AsyncLocalStorage } from 'node:async_hooks';
import { observeDatabaseCalls } from '@/db/binding';
import { logJsonLine } from '../adapters/log.ts';
import {
  loggedPath,
  outboundWaitKind,
  requestKind,
  serverTimingHeader,
  startRequestTiming,
  summarizeRequestTiming,
  waitStarted,
  type RequestTiming,
  type RequestTimingSummary,
  type WaitKind,
} from '../domain/server-timing.ts';

/**
 * Le chronomètre des requêtes du Worker (accélérer le site, A1, D-358 ;
 * docs/acceleration-du-site-contract.md, section 3). Le point d'entrée du
 * Worker, en production (`site-worker.ts`) comme en démonstration
 * (`demo-worker.ts`), pose la mesure une fois, puis fait passer chaque requête
 * par `timeRequest` : pendant la requête, chaque appel à la base et chaque
 * appel sortant est compté et chronométré dans le contexte de cette requête,
 * jamais dans une variable commune ; deux requêtes simultanées ne mêlent pas
 * leurs comptes. Au départ de la réponse, l'en-tête `Server-Timing` dit ce
 * qu'elle a attendu, et une ligne du journal le redit. Hors d'une requête
 * mesurée (tâche planifiée, tests), rien n'est compté.
 *
 * La mesure ne change ni le corps, ni le statut, ni les autres en-têtes d'une
 * réponse, et ne retient rien : un appel part au même moment, son résultat ou
 * son erreur revient tel quel. L'horloge d'un Worker n'avance qu'aux
 * entrées-sorties : le calcul pur après le dernier appel ne compte pas dans
 * `app` (`lib/adapters/stopwatch.ts`).
 */

type Clock = () => number;
type FetchHost = { fetch: typeof fetch };

const requests = new AsyncLocalStorage<RequestTiming>();
const timedHosts = new WeakSet<FetchHost>();
let clock: Clock = () => performance.now();
/** Les requêtes déjà servies par cette instance du Worker : la première est celle d'une instance neuve. */
let servedRequests = 0;

/**
 * Pose la mesure, une fois par instance : les appels à la base passent par
 * l'observateur de `db/binding.ts`, les appels sortants de `host` par un
 * `fetch` qui les chronomètre. L'horloge est injectable pour les tests.
 */
export function installRequestTiming(host: FetchHost = globalThis, now: Clock = () => performance.now()): void {
  clock = now;
  observeDatabaseCalls((call) => measured('d1', call));
  if (timedHosts.has(host)) return;
  const original = host.fetch;
  host.fetch = function timedFetch(input: RequestInfo | URL, init?: RequestInit) {
    return measured(outboundWaitKind(hostnameOf(input)), () => Reflect.apply(original, host, [input, init]) as Promise<Response>);
  } as typeof fetch;
  timedHosts.add(host);
}

/** Retire la mesure de la base (tests) ; un `fetch` déjà chronométré le reste, sans rien compter hors d'une requête. */
export function uninstallRequestTiming(): void {
  observeDatabaseCalls(null);
  clock = () => performance.now();
  servedRequests = 0;
}

/**
 * Traite une requête sous le chronomètre : `handle` la sert, comme sans
 * mesure ; sa réponse repart avec l'en-tête `Server-Timing`, et le journal
 * reçoit une ligne `irrigation_request_timing`. Une erreur de `handle`
 * repart telle quelle, après sa ligne du journal.
 */
export async function timeRequest(request: Request, handle: () => Promise<Response>): Promise<Response> {
  const timing = startRequestTiming(clock(), servedRequests === 0 ? 'neuve' : 'chaude');
  servedRequests += 1;
  const served = servedRequests;
  let response: Response;
  try {
    response = await requests.run(timing, handle);
  } catch (error) {
    logRequest(request, summarizeRequestTiming(timing, clock()), null, served);
    throw error;
  }
  const summary = summarizeRequestTiming(timing, clock());
  logRequest(request, summary, response.status, served);
  return withServerTiming(response, serverTimingHeader(summary));
}

/** Un appel de cette sorte, compté pour la requête en cours ; hors d'une requête mesurée, lancé tel quel. */
function measured<T>(kind: WaitKind, call: () => Promise<T>): Promise<T> {
  const timing = requests.getStore();
  if (!timing) return call();
  const end = waitStarted(timing, kind, clock());
  let pending: Promise<T>;
  try {
    pending = call();
  } catch (error) {
    end(clock());
    throw error;
  }
  return Promise.resolve(pending).finally(() => end(clock()));
}

/** Le seul nom d'hôte d'un appel sortant : ni le chemin, ni les paramètres (une adresse porte des coordonnées ou une clé). */
function hostnameOf(input: RequestInfo | URL): string | null {
  try {
    if (input instanceof URL) return input.hostname;
    return new URL(typeof input === 'string' ? input : input.url).hostname;
  } catch {
    return null;
  }
}

/** Ajoute l'en-tête ; une réponse aux en-têtes figés (relayée d'un `fetch`) repart en copie, même corps, même statut. */
function withServerTiming(response: Response, value: string): Response {
  // Une réponse qui ouvre un WebSocket porte sa connexion : jamais recopiée.
  if (response.status === 101) return response;
  try {
    response.headers.append('Server-Timing', value);
    return response;
  } catch {
    const copy = new Response(response.body, response);
    copy.headers.append('Server-Timing', value);
    return copy;
  }
}

/** La ligne du journal : des nombres et des mots fixes, le chemin sans rien après lui, jamais d'identifiant de personne. */
function logRequest(request: Request, summary: RequestTimingSummary, status: number | null, servedByInstance: number): void {
  const path = new URL(request.url).pathname;
  const rsc = path.endsWith('.rsc') || request.headers.get('RSC') === '1';
  const action = request.headers.has('next-action') || request.headers.has('x-rsc-action');
  const { waits } = summary;
  logJsonLine('info', {
    event: 'irrigation_request_timing',
    kind: requestKind({ method: request.method, path, rsc, action }),
    method: request.method.toUpperCase(),
    path: loggedPath(path),
    status,
    instance: summary.instance,
    servedByInstance,
    appMs: summary.appMs,
    d1Calls: waits.d1.calls,
    d1Ms: waits.d1.ms,
    otfCalls: waits.otf.calls,
    otfMs: waits.otf.ms,
    weatherCalls: waits.meteo.calls,
    weatherMs: waits.meteo.ms,
    otherCalls: waits.autres.calls,
    otherMs: waits.autres.ms,
  });
}
