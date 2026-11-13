/**
 * Le réseau sortant de la démonstration (docs/demo-guided-contract.md,
 * section 5, couche 3) : en démonstration, tout appel vers un autre hôte que
 * ceux de la liste est refusé, avant de partir. La liste ne contient que le
 * domaine Access de l'équipe, dont les clés publiques vérifient la connexion
 * des invités (C2) ; la base D1 et le Worker lui-même ne passent pas par le
 * réseau. Ouvre ta ferme, les fournisseurs de météo et le service de
 * notification n'y sont jamais.
 *
 * Fonctions pures : le service `lib/services/deployment-mode.ts` pose la garde
 * sur l'appel réseau du Worker au démarrage.
 */

type FetchInput = string | URL | Request;
type FetchFunction = (input: FetchInput, init?: RequestInit) => Promise<Response>;

/** L'origine d'une adresse (`https://hote:port`), ou `null` si elle ne se lit pas. */
function outboundOrigin(input: FetchInput): string | null {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** Les origines permises en démonstration, à partir des réglages lisibles ; une valeur illisible est ignorée. */
export function demoAllowedOrigins(accessTeamDomain: string | undefined): readonly string[] {
  const origin = accessTeamDomain?.trim() ? outboundOrigin(accessTeamDomain.trim()) : null;
  return origin && origin.startsWith('https:') ? [origin] : [];
}

export function isOutboundAllowedInDemo(input: FetchInput, allowedOrigins: readonly string[]): boolean {
  const origin = outboundOrigin(input);
  return origin !== null && allowedOrigins.includes(origin);
}

/** Le motif d'un refus : l'hôte seul, jamais le chemin ni les paramètres, qui peuvent porter une donnée. */
function outboundRefusalMessage(input: FetchInput): string {
  const origin = outboundOrigin(input);
  const host = origin ? new URL(origin).host : 'adresse illisible';
  return `Démonstration : appel réseau refusé vers ${host}.`;
}

export class DemoOutboundRefusedError extends Error {
  readonly host: string;

  constructor(input: FetchInput) {
    super(outboundRefusalMessage(input));
    this.name = 'DemoOutboundRefusedError';
    const origin = outboundOrigin(input);
    this.host = origin ? new URL(origin).host : '';
  }
}

/**
 * L'appel réseau gardé : il passe à l'appel d'origine les seules adresses de la
 * liste, et rejette les autres sans rien envoyer.
 */
export function guardedFetch(original: FetchFunction, allowedOrigins: readonly string[]): FetchFunction {
  return (input, init) => {
    if (!isOutboundAllowedInDemo(input, allowedOrigins)) {
      return Promise.reject(new DemoOutboundRefusedError(input));
    }
    return original(input, init);
  };
}
