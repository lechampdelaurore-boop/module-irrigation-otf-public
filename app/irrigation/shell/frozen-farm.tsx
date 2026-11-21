'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { FrozenFarmView } from '@/lib/domain/operations/farm-erasure-request';
import { cancelFarmErasureAction, type FarmErasureActionResult } from '../farm-erasure-actions';

/**
 * L'écran de l'espace figé (4.5, PR 3, troisième partie ;
 * docs/tranche-4-contract.md, F563, et 10 bis.22, F666, F667) : à la place de
 * toute page, le jour de l'effacement, ce qui est figé, le retrait de
 * l'autorisation dans Ouvre ta ferme, et « Annuler la demande » tant que
 * l'effacement n'a pas commencé. Rien n'y lit Ouvre ta ferme.
 */
export function FrozenFarm({ view, reopenHref }: { view: FrozenFarmView; reopenHref: string }) {
  const [answer, setAnswer] = useState<FarmErasureActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  // L'écran répond : un parcours n'appuie pas avant (docs/browser-journeys-contract.md).
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.setAttribute('data-interactive', 'true');
  }, []);
  const cancel = () => startTransition(async () => setAnswer(await cancelFarmErasureAction()));
  const reopened = answer?.ok === true;
  return (
    <section ref={section} className="fatal-state frozen-farm" aria-labelledby="frozen-farm-title">
      <p className="eyebrow">Suppression demandée</p>
      <h1 id="frozen-farm-title">{reopened ? 'La demande est annulée' : view.title}</h1>
      {reopened ? null : view.lines.map((line) => <p key={line}>{line}</p>)}
      {answer ? <p className={answer.ok ? 'water-notice' : 'water-error'} role={answer.ok ? 'status' : 'alert'}>{answer.message}</p> : null}
      {reopened
        ? <a className="primary-link" href={reopenHref}>Rouvrir la ferme</a>
        : view.cancellable
          ? <button type="button" className="frozen-farm-cancel" disabled={pending} onClick={cancel}>{pending ? 'Annulation…' : 'Annuler la demande'}</button>
          : null}
    </section>
  );
}
