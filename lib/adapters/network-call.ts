/**
 * L'appel réseau des adaptateurs (correctif de la météo automatique, D-164).
 *
 * Dans un Worker, le `fetch` natif refuse d'être appelé comme la méthode d'un
 * autre objet (« Illegal invocation ») : gardé tel quel dans un champ, puis
 * appelé par `this.fetchImpl(...)`, il échoue aussitôt, sans réponse ni statut.
 * Cette fonction le lit sur l'objet global au moment de l'appel, et l'appelle
 * depuis lui : elle sert de valeur par défaut aux adaptateurs, et ne dépend ni
 * de l'ordre de chargement des modules ni de ce qui enveloppe `fetch` ensuite.
 */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export const globalFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

const MAX_ERROR_TEXT = 200;

/**
 * Ce qu'un échec d'appel réseau dit de lui-même, pour le journal : son nom, son
 * message et celui de sa cause, sans aucune adresse (une adresse porte les
 * coordonnées d'une ferme ou une clé), tronqués.
 */
export function describeNetworkError(error: unknown): { errorName: string; errorMessage: string | null; errorCause: string | null } {
  const errorName = error instanceof Error ? error.name : typeof error;
  const errorMessage = error instanceof Error ? cleanErrorText(error.message) : cleanErrorText(String(error));
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
  const errorCause = cause === undefined || cause === null
    ? null
    : cleanErrorText(cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause));
  return { errorName, errorMessage, errorCause };
}

function cleanErrorText(text: string): string | null {
  const cleaned = text.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<adresse>').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, MAX_ERROR_TEXT) : null;
}
