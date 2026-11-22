import { countText, dateClockText } from '../clock-text.ts';
import type { ChangeJournalCard } from './card.ts';
import type { ChangeJournalCursor } from './entry.ts';
import { CHANGE_FAMILY_LABELS, isChangeFamily, type ChangeFamily } from './subjects.ts';

/**
 * La section « Journal des modifications » de « Réglages » (amélioration
 * n° 7, §5.5 et §5.6 ; D-288) : lecture seule, les 50 dernières lignes, un
 * filtre par famille, « Voir plus » par 50. Ses phrases se composent ici.
 */

/** Une page du journal : ses cartes, et où reprendre ; `null` quand tout est lu. */
export type ChangeJournalPage = {
  family: ChangeFamily | null;
  cards: ChangeJournalCard[];
  next: ChangeJournalCursor | null;
};

export type ChangeJournalView = ChangeJournalPage & {
  /** Toutes familles. */
  total: number;
  /** L'instant de la ligne la plus récente, toutes familles. */
  latestAt: string | null;
  /** Le jour où le journal de la ferme commence (§5.6, F723). */
  startedAt: string | null;
};

/** Les choix du filtre, « Tout » d'abord. */
export const CHANGE_JOURNAL_FILTERS: readonly { family: ChangeFamily | null; label: string }[] = [
  { family: null, label: 'Tout' },
  ...(Object.entries(CHANGE_FAMILY_LABELS) as [ChangeFamily, string][]).map(([family, label]) => ({ family, label })),
];

/** Une famille venue de l'écran, vérifiée ; tout autre texte vaut « Tout ». */
export function changeFamilyFilter(value: unknown): ChangeFamily | null {
  return typeof value === 'string' && isChangeFamily(value) ? value : null;
}

/** « 21/11/2026 » : le jour de la ferme. */
function startDay(startedAt: string): string {
  return dateClockText(startedAt).split(' à ')[0];
}

/** La phrase de tête : le journal commence à sa mise en service, rien n'est reconstitué d'avant (§5.6). */
export function changeJournalIntro(startedAt: string | null): string {
  const since = startedAt === null ? 'à sa mise en service' : `à sa mise en service, le ${startDay(startedAt)}`;
  return `Le journal garde qui a changé un objectif, un réglage ou du matériel, quand, et l’avant et l’après. Il commence ${since} : les changements d’avant n’y sont pas. Il se garde tant que la ferme existe et se lit seulement.`;
}

/** La ligne du pli fermé : combien, et la dernière ; sans ligne, la phrase vide du contrat (§5.5). */
export function changeJournalSummary(view: Pick<ChangeJournalView, 'total' | 'latestAt' | 'startedAt'>): string {
  if (view.total === 0 || view.latestAt === null) return changeJournalEmpty(view.startedAt, null);
  return `${countText(view.total, 'modification')}, la dernière le ${dateClockText(view.latestAt)}.`;
}

/** Une liste vide : « Aucune modification enregistrée depuis le 21/11/2026. », ou rien de la famille choisie. */
export function changeJournalEmpty(startedAt: string | null, family: ChangeFamily | null): string {
  if (family !== null) return `Aucune modification enregistrée dans « ${CHANGE_FAMILY_LABELS[family]} ».`;
  return startedAt === null ? 'Aucune modification enregistrée.' : `Aucune modification enregistrée depuis le ${startDay(startedAt)}.`;
}
