import { HOURS_PER_DAY, millisecondsFromHours } from '../units.ts';

/**
 * Ce qu'est devenu un appel à Ouvre ta ferme, une fois envoyé (4.5, PR 2 ;
 * docs/tranche-4-contract.md, F564 ; 10 bis.13, F614). Chaque essai envoyé
 * compte : un `5xx` retenté puis réussi fait une erreur et une réussite. Un
 * appel que le régulateur ou le compteur partagé n'a pas laissé partir ne
 * compte pas : rien n'est parti vers OTF.
 */
export const OTF_CALL_OUTCOMES = ['ok', 'unauthorized', 'forbidden', 'rate-limited', 'server', 'refused', 'timeout', 'network'] as const;

export type OtfCallOutcome = (typeof OTF_CALL_OUTCOMES)[number];

type OtfCallError = Exclude<OtfCallOutcome, 'ok'>;

/** Ce qu'une réponse d'OTF dit de l'appel, par son seul statut. */
export function outcomeOfStatus(status: number): OtfCallOutcome {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';
  return 'refused';
}

/**
 * Un envoi sans réponse : le délai de l'appel dépassé (le connecteur coupe
 * la requête), sinon le réseau (adresse introuvable, connexion coupée).
 */
export function outcomeOfSendFailure(error: unknown): 'timeout' | 'network' {
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : undefined;
  return name === 'AbortError' || name === 'TimeoutError' ? 'timeout' : 'network';
}

/** Les résultats sont comptés par heure pleine : la page lit 24 heures et 7 jours, jamais un appel seul. */
export function outcomeHourStartMs(atMs: number): number {
  const hourMs = millisecondsFromHours(1);
  return Math.floor(atMs / hourMs) * hourMs;
}

/**
 * Les heures gardées : 7 jours pour la page, et un jour de plus pour que la
 * fenêtre de 7 jours soit toujours pleine au moment où elle se lit.
 */
export const OTF_CALL_OUTCOME_HOURS_KEPT = 8 * HOURS_PER_DAY;

export type OtfCallCounts = Partial<Record<OtfCallOutcome, number>>;

/** Les mots de chaque erreur, au pluriel près, tels que l'exploitant les lit. */
const ERROR_WORDS: Record<OtfCallError, [one: string, many: string]> = {
  unauthorized: ['accès refusé (401)', 'accès refusés (401)'],
  forbidden: ['lecture interdite (403)', 'lectures interdites (403)'],
  'rate-limited': ['limite atteinte (429)', 'limites atteintes (429)'],
  server: ['erreur d’OTF (5xx)', 'erreurs d’OTF (5xx)'],
  refused: ['autre refus d’OTF', 'autres refus d’OTF'],
  timeout: ['délai dépassé', 'délais dépassés'],
  network: ['erreur réseau', 'erreurs réseau'],
};

export type OtfErrorRate = {
  calls: number;
  errors: number;
  /** Les erreurs, la plus fréquente d'abord, en mots : « 2 délais dépassés, 1 limite atteinte (429) ». */
  detail: string;
};

export function otfErrorRate(counts: OtfCallCounts): OtfErrorRate {
  const errors = OTF_CALL_OUTCOMES
    .filter((outcome): outcome is OtfCallError => outcome !== 'ok')
    .map((outcome) => ({ outcome, count: counts[outcome] ?? 0 }))
    .filter(({ count }) => count > 0)
    .sort((left, right) => right.count - left.count);
  const errorCount = errors.reduce((sum, { count }) => sum + count, 0);
  return {
    calls: (counts.ok ?? 0) + errorCount,
    errors: errorCount,
    detail: errors.map(({ outcome, count }) => `${count} ${ERROR_WORDS[outcome][count > 1 ? 1 : 0]}`).join(', '),
  };
}
