'use client';

import { useState, useTransition } from 'react';
import type { ChangeJournalCard } from '@/lib/domain/change-journal/card';
import type { ChangeFamily } from '@/lib/domain/change-journal/subjects';
import {
  CHANGE_JOURNAL_FILTERS,
  changeJournalEmpty,
  changeJournalIntro,
  changeJournalSummary,
  type ChangeJournalView,
} from '@/lib/domain/change-journal/view';
import { loadChangeJournalPageAction } from '../change-journal-actions';
import { AnchoredFold } from '../shell/page-settings-fold';

/** L'ancre de la section : un lien vers elle ouvre son pli. */
const CHANGE_JOURNAL_ANCHOR = 'journal-des-modifications';

/**
 * « Journal des modifications » dans « Réglages » (amélioration n° 7, §5.5
 * et §5.6 ; D-288) : lecture seule, une carte par ligne, jamais un tableau,
 * les 50 dernières d'abord, un filtre par famille et « Voir plus » par 50.
 * Toujours là, sans case de fonctionnalité ; dans un pli fermé dont la ligne
 * dit combien et la dernière, pour que « Réglages » garde sa hauteur au
 * téléphone (F715 : toute section nouvelle de « Réglages » se plie).
 */
export function ChangeJournalSection({ season, initialView }: { season: number; initialView: ChangeJournalView }) {
  const [family, setFamily] = useState<ChangeFamily | null>(initialView.family);
  const [cards, setCards] = useState(initialView.cards);
  const [next, setNext] = useState(initialView.next);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = (wanted: ChangeFamily | null, more: boolean) => startTransition(async () => {
    const result = await loadChangeJournalPageAction({ season, family: wanted, after: more ? next : null });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setFamily(result.page.family);
    setCards((current) => (more ? [...current, ...result.page.cards] : result.page.cards));
    setNext(result.page.next);
  });

  return (
    <section className="change-journal" aria-labelledby="change-journal-title">
      <AnchoredFold
        id={CHANGE_JOURNAL_ANCHOR}
        className="species-fold change-journal-fold"
        bodyClassName="species-fold-body"
        summary={<><h2 id="change-journal-title">Journal des modifications</h2><small>{changeJournalSummary(initialView)}</small></>}
      >
        <p className="change-journal-intro">{changeJournalIntro(initialView.startedAt)}</p>
        <div className="change-journal-filters" role="group" aria-label="Familles du journal">
          {CHANGE_JOURNAL_FILTERS.map((filter) => (
            <button
              type="button"
              key={filter.label}
              aria-pressed={family === filter.family}
              disabled={pending}
              onClick={() => load(filter.family, false)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {error ? <p className="water-error" role="alert">{error}</p> : null}
        {cards.length === 0
          ? <p className="change-journal-empty">{changeJournalEmpty(initialView.startedAt, family)}</p>
          : <ol className="change-journal-cards" aria-busy={pending}>{cards.map((card) => <ChangeCard key={card.id} card={card} />)}</ol>}
        {next ? (
          <button type="button" className="change-journal-more" disabled={pending} onClick={() => load(family, true)}>
            Voir plus
          </button>
        ) : null}
      </AnchoredFold>
    </section>
  );
}

/** Une ligne du journal : quand et qui, ce qui a changé et sur quoi, puis chaque champ, avant → après. */
function ChangeCard({ card }: { card: ChangeJournalCard }) {
  return (
    <li className="change-journal-card" data-family={card.family}>
      <p className="change-journal-meta"><time dateTime={card.at}>{card.when}</time> · {card.who}</p>
      <h3>
        {card.subject}
        <small>{card.action}{card.object ? ` · ${card.object}` : ''}</small>
      </h3>
      {card.lines.length > 0 ? (
        <dl>
          {card.lines.map((line, index) => (
            <div key={`${index}-${line.label}`}>
              <dt>{line.label}{'\u00a0'}:</dt>{' '}
              <dd>{line.text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}
