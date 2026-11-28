/**
 * Le temps d'une requête du module, mesuré côté serveur (accélérer le site,
 * A1, D-358 ; docs/acceleration-du-site-contract.md, section 3) : ce que la
 * requête a attendu de la base, d'Ouvre ta ferme, de la météo et des autres
 * appels, le temps jusqu'au départ de sa réponse, et si l'instance du Worker
 * qui la sert venait de démarrer. Dit au navigateur par l'en-tête
 * `Server-Timing`, et au journal par une ligne.
 *
 * Ce module ne lit aucune horloge : les instants lui sont donnés, en
 * millisecondes, par `lib/services/request-timing.ts`. Il ne garde ni
 * adresse, ni identifiant, ni contenu : des nombres et des mots fixes.
 */

/** Les quatre attentes comptées : la base D1, Ouvre ta ferme, les fournisseurs météo, tout autre appel sortant. */
export type WaitKind = 'd1' | 'otf' | 'meteo' | 'autres';

const WAIT_KINDS: readonly WaitKind[] = ['d1', 'otf', 'meteo', 'autres'];

/**
 * Une instance du Worker à sa première requête, ou qui en a déjà servi : la
 * première paie le démarrage à froid, que la mesure ne voit pas elle-même (il
 * a lieu avant que le code du module ne tourne), mais qu'elle signale.
 */
export type InstanceState = 'neuve' | 'chaude';

type WaitTally = { calls: number; busyMs: number; inFlight: number; busySince: number };

/** La mesure d'une requête en cours : son départ, son instance, et le décompte de chaque attente. */
export type RequestTiming = {
  readonly startedAt: number;
  readonly instance: InstanceState;
  readonly waits: Record<WaitKind, WaitTally>;
};

export function startRequestTiming(startedAt: number, instance: InstanceState): RequestTiming {
  const waits = {} as Record<WaitKind, WaitTally>;
  for (const kind of WAIT_KINDS) waits[kind] = { calls: 0, busyMs: 0, inFlight: 0, busySince: startedAt };
  return { startedAt, instance, waits };
}

/**
 * Un appel commence à `at` : il compte pour un appel de sa sorte. Rend la
 * fonction qui le termine, à appeler une fois, à son instant de fin ; un
 * second appel ne change rien. Le temps d'une sorte est celui pendant lequel
 * au moins un de ses appels était en cours : deux appels qui se recouvrent ne
 * comptent pas deux fois le même instant.
 */
export function waitStarted(timing: RequestTiming, kind: WaitKind, at: number): (endedAt: number) => void {
  const tally = timing.waits[kind];
  tally.calls += 1;
  if (tally.inFlight === 0) tally.busySince = at;
  tally.inFlight += 1;
  let ended = false;
  return (endedAt) => {
    if (ended) return;
    ended = true;
    tally.inFlight -= 1;
    if (tally.inFlight === 0) tally.busyMs += Math.max(0, endedAt - tally.busySince);
  };
}

type WaitSummary = { calls: number; ms: number };

export type RequestTimingSummary = {
  /** Du début du traitement de la requête au départ de sa réponse, en millisecondes entières. */
  appMs: number;
  instance: InstanceState;
  waits: Record<WaitKind, WaitSummary>;
};

/** Ce que la requête a attendu jusqu'à `at`, en millisecondes entières ; un appel encore en cours compte jusqu'à `at`. */
export function summarizeRequestTiming(timing: RequestTiming, at: number): RequestTimingSummary {
  const waits = {} as Record<WaitKind, WaitSummary>;
  for (const kind of WAIT_KINDS) {
    const tally = timing.waits[kind];
    const running = tally.inFlight > 0 ? Math.max(0, at - tally.busySince) : 0;
    waits[kind] = { calls: tally.calls, ms: Math.round(tally.busyMs + running) };
  }
  return { appMs: Math.round(Math.max(0, at - timing.startedAt)), instance: timing.instance, waits };
}

/** « 0 appel », « 1 appel », « 2 appels » : en ASCII, comme tout l'en-tête. */
function callsText(calls: number): string {
  return `${calls} ${calls > 1 ? 'appels' : 'appel'}`;
}

/**
 * La valeur de l'en-tête `Server-Timing` (norme W3C) : `app`, puis chaque
 * attente avec son nombre d'appels, puis l'instance. Toujours les six
 * entrées, dans cet ordre, en ASCII : le navigateur les lit telles quelles
 * (outils de développement, `performance.getEntriesByType('navigation')`).
 */
export function serverTimingHeader(summary: RequestTimingSummary): string {
  const waits = WAIT_KINDS.map((kind) => `${kind};dur=${summary.waits[kind].ms};desc="${callsText(summary.waits[kind].calls)}"`);
  return [`app;dur=${summary.appMs}`, ...waits, `instance;desc="${summary.instance}"`].join(', ');
}

/** Les domaines de chaque attente sortante, avec leurs sous-domaines (`api.`, `archive-api.`, `www.`…). */
const OUTBOUND_DOMAINS: readonly { domain: string; kind: Exclude<WaitKind, 'd1'> }[] = [
  { domain: 'ouvretaferme.org', kind: 'otf' },
  { domain: 'open-meteo.com', kind: 'meteo' },
  { domain: 'visualcrossing.com', kind: 'meteo' },
];

/** La sorte d'un appel sortant, d'après le seul nom de son hôte ; inconnu ou illisible, « autres ». */
export function outboundWaitKind(hostname: string | null): Exclude<WaitKind, 'd1'> {
  if (!hostname) return 'autres';
  const host = hostname.toLowerCase();
  return OUTBOUND_DOMAINS.find(({ domain }) => host === domain || host.endsWith(`.${domain}`))?.kind ?? 'autres';
}

/** Ce qu'est la requête, pour le journal : une page, un changement de page (RSC), une action, une route d'API. */
export type RequestKind = 'page' | 'rsc' | 'action' | 'route' | 'autre';

export function requestKind(input: { method: string; path: string; rsc: boolean; action: boolean }): RequestKind {
  if (input.action) return 'action';
  if (input.rsc) return 'rsc';
  if (input.path.startsWith('/api/')) return 'route';
  return input.method.toUpperCase() === 'GET' ? 'page' : 'autre';
}

/**
 * Le chemin écrit au journal : celui d'une page ou d'une route du module,
 * sans rien de l'adresse après lui (une adresse peut porter un code de
 * connexion) ; tout autre chemin, que n'importe qui peut écrire, devient
 * « (autre) ».
 */
export function loggedPath(path: string): string {
  const known = path === '/' || path === '/irrigation' || path.startsWith('/irrigation/') || path.startsWith('/api/');
  return known && /^[a-z0-9/._-]{1,120}$/i.test(path) ? path : '(autre)';
}
