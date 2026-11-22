'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { ChangeJournalCard } from '@/lib/domain/change-journal/card';
import type { ChangeJournalCursor } from '@/lib/domain/change-journal/entry';
import type { ChangeFamily } from '@/lib/domain/change-journal/subjects';
import {
  CHANGE_JOURNAL_FILTERS,
  changeJournalEmpty,
  changeJournalIntro,
  changeJournalSummary,
  type ChangeJournalView,
} from '@/lib/domain/change-journal/view';
import { CHANGE_JOURNAL_CHANGED } from '@/lib/domain/feasibility-notifications';
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
 *
 * Sans recharger la page (F746, D-294) : un changement enregistré sur la
 * page le signale, et la section se relit au serveur, sa ligne avec, pli
 * fermé comme ouvert ; elle se relit aussi à chaque ouverture de son pli.
 */
export function ChangeJournalSection({ season, initialView }: { season: number; initialView: ChangeJournalView }) {
  const [view, setView] = useState(initialView);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // La dernière lecture demandée l'emporte : la réponse d'une plus ancienne, arrivée après, ne remplace rien.
  const lastRead = useRef(0);
  // La famille demandée en dernier : une relecture la garde, même si sa réponse n'est pas encore là.
  const wantedFamily = useRef<ChangeFamily | null>(initialView.family);

  const read = useCallback((family: ChangeFamily | null, after: ChangeJournalCursor | null) => {
    const ticket = lastRead.current + 1;
    lastRead.current = ticket;
    wantedFamily.current = family;
    startTransition(async () => {
      const result = await loadChangeJournalPageAction({ season, family, after });
      if (ticket !== lastRead.current) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      // « Voir plus » ajoute la suite ; le filtre et la relecture repartent des dernières lignes. La ligne du pli suit toujours.
      setView((current) => (after === null ? result.view : { ...result.view, cards: [...current.cards, ...result.view.cards] }));
    });
  }, [season]);

  const reread = useCallback(() => read(wantedFamily.current, null), [read]);

  useEffect(() => {
    window.addEventListener(CHANGE_JOURNAL_CHANGED, reread);
    return () => window.removeEventListener(CHANGE_JOURNAL_CHANGED, reread);
  }, [reread]);

  return (
    <section className="change-journal" aria-labelledby="change-journal-title">
      <AnchoredFold
        id={CHANGE_JOURNAL_ANCHOR}
        className="species-fold change-journal-fold"
        bodyClassName="species-fold-body"
        summary={<><h2 id="change-journal-title">Journal des modifications</h2><small>{changeJournalSummary(view)}</small></>}
        onOpen={reread}
      >
        <p className="change-journal-intro">{changeJournalIntro(view.startedAt)}</p>
        <div className="change-journal-filters" role="group" aria-label="Familles du journal">
          {CHANGE_JOURNAL_FILTERS.map((filter) => (
            <button
              type="button"
              key={filter.label}
              aria-pressed={view.family === filter.family}
              disabled={pending}
              onClick={() => read(filter.family, null)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {error ? <p className="water-error" role="alert">{error}</p> : null}
        {view.cards.length === 0
          ? <p className="change-journal-empty">{changeJournalEmpty(view.startedAt, view.family)}</p>
          : <ol className="change-journal-cards" aria-busy={pending}>{view.cards.map((card) => <ChangeCard key={card.id} card={card} />)}</ol>}
        {view.next ? (
          <button type="button" className="change-journal-more" disabled={pending} onClick={() => read(view.family, view.next)}>
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
