import { changeJournalStartForUser, countChangeJournalForUser, listChangeJournalForUser } from '@/db/change-journal/read';
import { changeJournalCard, snapshotNames } from '../domain/change-journal/card';
import { CHANGE_JOURNAL_PAGE_SIZE, type ChangeJournalCursor } from '../domain/change-journal/entry';
import type { ChangeFamily } from '../domain/change-journal/subjects';
import type { ChangeJournalPage, ChangeJournalView } from '../domain/change-journal/view';
import type { IrrigationSnapshot } from '../domain/domain';

/**
 * La lecture du journal des modifications pour « Réglages » (amélioration
 * n° 7, §5.5 ; D-288) : une page de 50 cartes, de la plus récente à la plus
 * ancienne, d'une famille ou de toutes. Toute lecture porte l'espace de la
 * personne : elle ne lit jamais le journal d'une autre ferme (F709).
 */

type PageInput = {
  ownerUserId: string;
  /** Pour lire les lieux et les cultures d'Ouvre ta ferme par leur nom ; sans instantané, par leur sorte. */
  snapshot: IrrigationSnapshot | null;
  family?: ChangeFamily | null;
  after?: ChangeJournalCursor | null;
};

/** Une page : une ligne de plus est lue pour savoir s'il en reste. */
export async function getChangeJournalPageForUser({ ownerUserId, snapshot, family = null, after = null }: PageInput): Promise<ChangeJournalPage> {
  const entries = await listChangeJournalForUser(ownerUserId, { family, after, limit: CHANGE_JOURNAL_PAGE_SIZE + 1 });
  const shown = entries.slice(0, CHANGE_JOURNAL_PAGE_SIZE);
  const last = shown.at(-1);
  const reader = { viewerUserId: ownerUserId, nameOf: snapshotNames(snapshot) };
  return {
    family,
    cards: shown.map((entry) => changeJournalCard(entry, reader)),
    next: entries.length > CHANGE_JOURNAL_PAGE_SIZE && last ? { createdAt: last.createdAt, sequence: last.sequence } : null,
  };
}

/** La section à l'ouverture de la page : la première page de toutes les familles, le compte et le début du journal. */
export async function getChangeJournalViewForUser(ownerUserId: string, snapshot: IrrigationSnapshot | null): Promise<ChangeJournalView> {
  const [page, total, startedAt] = await Promise.all([
    getChangeJournalPageForUser({ ownerUserId, snapshot }),
    countChangeJournalForUser(ownerUserId),
    changeJournalStartForUser(ownerUserId),
  ]);
  // La page de toutes les familles commence par la ligne la plus récente.
  return { ...page, total, latestAt: page.cards[0]?.at ?? null, startedAt };
}
