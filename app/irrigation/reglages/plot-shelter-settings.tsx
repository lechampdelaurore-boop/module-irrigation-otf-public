'use client';

import { useState, useTransition } from 'react';
import type { PlotShelterLine } from '@/lib/domain/onboarding/plots';
import { confirmRemainingProposalsAction, savePlotShelterAction, type PlotShelterActionResult } from '../plot-shelter-actions';
import { ActionReply, actionReply, type ActionReplyMessage } from '../shell/action-reply';

const REPLY_CLASSES = { notice: 'water-notice', warning: 'weather-stale', error: 'water-error' } as const;

const ANSWERS = [
  { value: 'sheltered', label: 'Abri' },
  { value: 'open-field', label: 'Plein champ' },
  { value: 'unknown', label: 'Je ne sais pas' },
] as const;

const STATE_ANSWER = { sheltered: 'sheltered', 'open-field': 'open-field', unclassified: 'unknown' } as const;

/**
 * « Parcelles et abris », dans Réglages (4.4, docs/tranche-4-contract.md,
 * F420 ; PR 2b, F583) : chaque jardin de la saison, sa proposition (le type
 * du jardin dans Ouvre ta ferme, sinon son nom), et le choix de la personne.
 * Un jardin « à classer » n'a pas de besoin en eau calculé. Seulement pour
 * une ferme qui fait l'accueil : une ferme d'avant garde le classement
 * d'Ouvre ta ferme (F426).
 */
export function PlotShelterSettings({ season, initialLines }: { season: number; initialLines: PlotShelterLine[] }) {
  const [lines, setLines] = useState(initialLines);
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);
  const [pending, startTransition] = useTransition();
  const remaining = lines.filter((line) => line.state === 'unclassified').length;

  const receive = (result: PlotShelterActionResult, origin: string) => {
    if (result.ok) setLines(result.lines);
    setReplies([actionReply(origin, result.ok ? 'notice' : 'error', result.message)]);
  };

  return (
    <section className="water-management-section plot-shelters" aria-labelledby="parcelles-et-abris">
      <header className="water-management-heading">
        <div>
          <h2 id="parcelles-et-abris">Parcelles et abris</h2>
          <p>
            Sous abri, la pluie ne compte pas et le coefficient d’abri s’applique : dites-le pour chaque jardin.
            {remaining > 0 ? ` ${remaining} jardin${remaining > 1 ? 's' : ''} à classer : leur besoin en eau n’est pas calculé.` : ' Chaque jardin est classé.'}
          </p>
        </div>
      </header>
      <ul className="plot-shelter-list">
        {lines.map((line) => (
          <li key={line.plotId} className={`plot-shelter plot-shelter-${line.state}`}>
            <fieldset disabled={pending}>
              <legend>
                <strong>{line.name}</strong> <small>{line.zoneName}</small>
              </legend>
              <p className="plot-shelter-proposal">
                Proposé : {line.proposedSheltered ? 'abri' : 'plein champ'}.
                {line.origin ? ` Classé : ${line.state === 'sheltered' ? 'abri' : 'plein champ'}, ${line.origin}.` : ' À classer.'}
              </p>
              <div className="plot-shelter-answers">
                {ANSWERS.map((answer) => (
                  <label key={answer.value}>
                    <input
                      type="radio"
                      name={`abri-${line.plotId}`}
                      value={answer.value}
                      checked={STATE_ANSWER[line.state] === answer.value}
                      onChange={() => startTransition(async () => receive(await savePlotShelterAction({ season, plotId: line.plotId, answer: answer.value }), line.plotId))}
                    />
                    <span>{answer.label}</span>
                  </label>
                ))}
              </div>
              <ActionReply messages={replies} origin={line.plotId} classNames={REPLY_CLASSES} />
            </fieldset>
          </li>
        ))}
      </ul>
      {remaining > 0 ? (
        <button
          type="button"
          className="secondary-button"
          disabled={pending}
          onClick={() => startTransition(async () => receive(await confirmRemainingProposalsAction({ season }), 'tout'))}
        >
          Confirmer les propositions restantes
        </button>
      ) : null}
      <ActionReply messages={replies} origin="tout" classNames={REPLY_CLASSES} />
    </section>
  );
}
