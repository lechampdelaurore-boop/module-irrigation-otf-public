'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import {
  continueLabel,
  doneFoldText,
  ROUTE_COMPLETE_TEXT,
  ROUTE_FINISH_LABEL,
  ROUTE_LATER_LABEL,
  ROUTE_RESUME_LABEL,
  ROUTE_TITLE,
  ROUTE_UNREADABLE_TEXT,
  type RouteLink,
  type RouteStep,
  type RouteStepStatus,
  type StartRoute,
} from '@/lib/domain/onboarding/route';
import { Icon } from '../line-icon';
import { ActionReply, actionReply, type ActionReplyMessage, type ActionReplyTone } from '../shell/action-reply';
import { saveRouteStateAction } from '../start-route-actions';

/**
 * La carte « Mise en route » en tête de « Ma ferme » (simplification, lot S6,
 * docs/simplification-s6-contract.md, sections 5.2 à 5.4) : le titre, « 3
 * étapes sur 5 » et sa barre (`role="img"`, le même texte, jamais la couleur
 * seule), les étapes (coche verte « fait », rond à bord vert « en cours »,
 * rond gris « à faire »), chacune un lien de 44 px vers sa page ; « Continuer
 * l'étape n », un lien de 48 px, et « Plus tard ». Remise à plus tard, une
 * ligne « Reprendre la mise en route » ; toutes les étapes faites, une ligne
 * et « Terminer la mise en route ». Un seul composant pour tous les états :
 * la réponse d'un geste reste à l'écran quand la page se relit.
 */

const ROUTE_REPLY = 'mise-en-route';
const REPLY_CLASSES: Record<ActionReplyTone, string> = {
  notice: 'start-route-notice',
  warning: 'start-route-notice',
  error: 'start-route-error',
};

const STATUS_WORDS: Readonly<Record<RouteStepStatus, string>> = {
  done: 'fait',
  current: 'en cours',
  todo: 'à faire',
  unknown: 'à vérifier',
};

function hrefOf(link: RouteLink, query: PageQuery): string {
  return pageHref(link.page, { ...query, ...(link.tab ? { tab: link.tab } : {}) }, link.anchor);
}

function StepLine({ step, query }: { step: RouteStep; query: PageQuery }) {
  const content = (
    <>
      <span className="start-route-mark" role="img" aria-label={STATUS_WORDS[step.status]}>
        {step.status === 'done' ? <Icon name="coche" /> : step.status === 'unknown' ? '?' : step.number}
      </span>
      <span className="start-route-step-text">
        <strong>{step.label}</strong>
        {step.line ? <span className="start-route-step-line">{step.line}</span> : null}
        {step.unlocks ? <span className="start-route-unlocks">{step.unlocks}</span> : null}
      </span>
    </>
  );
  return (
    <li className="start-route-step" data-status={step.status}>
      {/* Une étape qui attend une autre étape ne mène nulle part avant (section 5.1). */}
      {step.link ? <a className="start-route-step-link" href={hrefOf(step.link, query)}>{content}</a> : <div className="start-route-step-link">{content}</div>}
    </li>
  );
}

export function StartRouteCard({ route, query }: { route: StartRoute; query: PageQuery }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);

  const gesture = (choice: 'later' | 'resume' | 'done') => startTransition(async () => {
    const result = await saveRouteStateAction({ gesture: choice });
    setReplies([actionReply(ROUTE_REPLY, result.ok ? 'notice' : 'error', result.message)]);
    // La page se relit : la carte, la ligne ou rien, selon l'état écrit ; le bandeau « À finir » suit (S6-d).
    if (result.ok) router.refresh();
  });
  const reply = <ActionReply messages={replies} origin={ROUTE_REPLY} classNames={REPLY_CLASSES} />;

  let body: ReactNode = null;
  if (route.kind === 'unreadable') {
    body = <p className="start-route-line" role="status">{ROUTE_UNREADABLE_TEXT}</p>;
  } else if (route.kind === 'later') {
    body = (
      <p className="start-route-line">
        <button type="button" className="start-route-link" disabled={pending} onClick={() => gesture('resume')}>
          {ROUTE_RESUME_LABEL} · {route.progress}
        </button>
      </p>
    );
  } else if (route.kind === 'complete') {
    body = (
      <section className="start-route" data-kind="complete" aria-label={ROUTE_TITLE}>
        <p className="start-route-complete">
          <span className="start-route-mark" aria-hidden="true"><Icon name="coche" /></span>
          {ROUTE_COMPLETE_TEXT}
        </p>
        <button type="button" className="primary-button start-route-finish" disabled={pending} onClick={() => gesture('done')}>{ROUTE_FINISH_LABEL}</button>
      </section>
    );
  } else if (route.kind === 'card') {
    const folded = route.foldDone ? route.steps.filter((step) => step.status === 'done') : [];
    const listed = route.foldDone ? route.steps.filter((step) => step.status !== 'done') : route.steps;
    body = (
      <section className="start-route" data-kind="card" aria-labelledby="start-route-title" aria-busy={pending}>
        <div className="start-route-head">
          <h2 id="start-route-title">{ROUTE_TITLE}</h2>
          <span className="start-route-count">{route.progress}</span>
        </div>
        <div className="start-route-bar" role="img" aria-label={route.progress}>
          <span style={{ width: `${Math.round(route.done / route.total * 100)}%` }} />
        </div>
        {folded.length > 0 ? (
          // Les étapes faites en une ligne, dès trois ; le pli ne cache jamais l'étape en cours (section 5.2).
          <details className="start-route-fold">
            <summary>
              <span className="start-route-mark" aria-hidden="true"><Icon name="coche" /></span>
              {doneFoldText(folded.length)}
            </summary>
            <ol className="start-route-steps">{folded.map((step) => <StepLine key={step.id} step={step} query={query} />)}</ol>
          </details>
        ) : null}
        <ol className="start-route-steps">{listed.map((step) => <StepLine key={step.id} step={step} query={query} />)}</ol>
        {route.current?.link ? <a className="primary-button start-route-continue" href={hrefOf(route.current.link, query)}>{continueLabel(route.current)}</a> : null}
        <p className="start-route-later">
          <button type="button" className="start-route-link" disabled={pending} onClick={() => gesture('later')}>{ROUTE_LATER_LABEL}</button>
        </p>
      </section>
    );
  }
  if (body === null && replies.length === 0) return null;
  return (
    <div className="start-route-zone">
      {body}
      {reply}
    </div>
  );
}
