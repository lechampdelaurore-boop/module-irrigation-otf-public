'use client';

import { useState, useTransition } from 'react';
import type { BedWaterGap, FlowCause, GapAdoption, GapCause, ObjectiveCause, RainCause } from '@/lib/domain/applied-water-gap';
import {
  GAP_BLOCK_TITLE,
  GAP_CAUSE_TITLES,
  UNDETERMINED_CAUSE,
  flowCauseText,
  gapDirectionText,
  gapPercentText,
  objectiveCauseText,
  rainCauseText,
  settingRatesText,
} from '@/lib/domain/applied-water-gap-text';
import { millimetersText } from '@/lib/domain/display-numbers';
import { notifyFeasibilityChanged, notifyNeedsSourceChanged } from '@/lib/domain/feasibility-notifications';
import type { AppliedWaterGapView } from '@/lib/services/applied-water-gap';
import { adoptAppliedWaterGapAction } from '../applied-water-gap-actions';
import { formatShortDay } from './format';

/**
 * Le bloc « L'eau apportée s'écarte du prévu » (amélioration n° 5,
 * docs/ameliorations-4-5-contract.md, §4.3, F735, D-291) : présent seulement
 * quand une planche a un signal. Par planche, les trois semaines, la cause
 * ou « cause non déterminée », la proposition et son bouton. Rien ne change
 * sans « Adopter », que le serveur vérifie avant d'écrire.
 */
export function AppliedWaterGapBlock({ season, initialView, rainHref }: {
  season: number;
  initialView: AppliedWaterGapView;
  /** « Saisir la pluie mesurée » : la saisie au pluviomètre, quand la ferme a coché « Objectifs et besoins ». */
  rainHref: string | null;
}) {
  const [view, setView] = useState(initialView);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const adopt = (adoption: GapAdoption) => startTransition(async () => {
    const result = await adoptAppliedWaterGapAction({ season, weekStart: view.weekStart, adoption });
    if (!result.ok) { setFeedback({ ok: false, message: result.message }); return; }
    const { adopted, message, weekStart, weeks, gaps, objectiveCauseNotice } = result;
    setView({ weekStart, weeks, gaps, objectiveCauseNotice });
    setFeedback({ ok: adopted, message });
    // Le plan se recalcule après la réponse : la section du planning relit, les autres onglets aussi (3.7, règle 6).
    if (adopted) { notifyNeedsSourceChanged(); notifyFeasibilityChanged(); }
  });
  const message = feedback ? (
    <p className={feedback.ok ? 'planning-notice' : 'planning-error'} role={feedback.ok ? 'status' : 'alert'}>{feedback.message}</p>
  ) : null;
  if (view.gaps.length === 0) return message;
  return (
    <section className="water-gap" aria-labelledby="water-gap-title" aria-busy={pending} data-testid="applied-water-gap">
      <h3 id="water-gap-title">{GAP_BLOCK_TITLE}</h3>
      <p className="water-gap-lead">
        Sur les trois dernières semaines, l’eau apportée à {view.gaps.length > 1 ? 'ces planches' : 'cette planche'} s’est écartée
        de plus de 20 % de l’eau prévue, chaque semaine dans le même sens. Rien ne change sans votre geste : « Adopter » enregistre
        la proposition, puis le plan se recalcule.
      </p>
      {view.objectiveCauseNotice ? <p className="water-gap-note" role="note">{view.objectiveCauseNotice}</p> : null}
      {message}
      <ul className="water-gap-beds">
        {view.gaps.map((gap) => (
          <li key={gap.bedId} className="water-gap-bed">
            <BedGap gap={gap} pending={pending} rainHref={rainHref} onAdopt={adopt} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BedGap({ gap, pending, rainHref, onAdopt }: {
  gap: BedWaterGap;
  pending: boolean;
  rainHref: string | null;
  onAdopt: (adoption: GapAdoption) => void;
}) {
  return (
    <>
      <p className="water-gap-bed-name"><strong>{gap.bedName}</strong> · {gap.plotName}</p>
      <p className="water-gap-direction">{gapDirectionText(gap.direction)}</p>
      <table className="water-gap-weeks">
        <caption className="sr-only">Eau prévue et apportée à {gap.bedName}, semaine par semaine</caption>
        <thead>
          <tr><th scope="col">Semaine du</th><th scope="col">Prévu</th><th scope="col">Apporté</th><th scope="col">Écart</th></tr>
        </thead>
        <tbody>
          {gap.weeks.map((week) => (
            <tr key={week.weekStart}>
              <th scope="row">{formatShortDay(week.weekStart)}</th>
              <td>{millimetersText(week.plannedMm)}</td>
              <td>{millimetersText(week.appliedMm)}</td>
              <td>{gapPercentText(week.gapPercent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {gap.causes.length === 0 ? <p className="water-gap-undetermined">{UNDETERMINED_CAUSE}</p> : (
        <ul className="water-gap-causes">
          {gap.causes.map((cause) => (
            <li key={causeKey(cause)}>
              <Cause cause={cause} bedId={gap.bedId} bedName={gap.bedName} pending={pending} rainHref={rainHref} onAdopt={onAdopt} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Cause({ cause, bedId, bedName, pending, rainHref, onAdopt }: {
  cause: GapCause;
  bedId: string;
  bedName: string;
  pending: boolean;
  rainHref: string | null;
  onAdopt: (adoption: GapAdoption) => void;
}) {
  if (cause.kind === 'flow') return <FlowProposal cause={cause} bedId={bedId} pending={pending} onAdopt={onAdopt} />;
  if (cause.kind === 'objective') return <ObjectiveProposal cause={cause} bedId={bedId} bedName={bedName} pending={pending} onAdopt={onAdopt} />;
  return <RainProposal cause={cause} rainHref={rainHref} />;
}

function FlowProposal({ cause, bedId, pending, onAdopt }: { cause: FlowCause; bedId: string; pending: boolean; onAdopt: (adoption: GapAdoption) => void }) {
  const proposed = cause.proposed;
  return (
    <div className="water-gap-cause">
      <div>
        <p className="water-gap-cause-title">{GAP_CAUSE_TITLES.flow}</p>
        <p>{flowCauseText(cause)}</p>
        <p className="water-gap-figures">Réglé aujourd’hui : {settingRatesText(cause.current)}</p>
        {proposed
          ? <p className="water-gap-figures">Proposé : {settingRatesText(proposed)}</p>
          : <p className="water-gap-figures">Pas de débit à proposer au dixième de mm/h près.</p>}
      </div>
      {proposed ? (
        <button type="button" disabled={pending} onClick={() => onAdopt({ kind: 'flow', bedId, settingId: cause.settingId, proposed })}
          aria-label={`Adopter le débit proposé pour le réglage « ${cause.settingName} » de ${cause.equipmentName}`}>
          Adopter
        </button>
      ) : null}
    </div>
  );
}

function ObjectiveProposal({ cause, bedId, bedName, pending, onAdopt }: { cause: ObjectiveCause; bedId: string; bedName: string; pending: boolean; onAdopt: (adoption: GapAdoption) => void }) {
  return (
    <div className="water-gap-cause">
      <div>
        <p className="water-gap-cause-title">{GAP_CAUSE_TITLES.objective}</p>
        <p>{objectiveCauseText(cause)}</p>
        <p className="water-gap-figures">Proposé : {millimetersText(cause.proposedMm)} par semaine, à partir d’aujourd’hui</p>
      </div>
      <button type="button" disabled={pending} onClick={() => onAdopt({ kind: 'objective', bedId, proposedMm: cause.proposedMm })}
        aria-label={`Adopter l’objectif proposé pour ${bedName}`}>
        Adopter
      </button>
    </div>
  );
}

/** Pas de valeur à adopter : la pluie mesurée se saisit (F734, point 3). */
function RainProposal({ cause, rainHref }: { cause: RainCause; rainHref: string | null }) {
  return (
    <div className="water-gap-cause">
      <div>
        <p className="water-gap-cause-title">{GAP_CAUSE_TITLES.rain}</p>
        <p>{rainCauseText(cause)}</p>
      </div>
      {rainHref ? <a className="water-gap-link" href={rainHref}>Saisir la pluie mesurée</a> : null}
    </div>
  );
}

function causeKey(cause: GapCause): string {
  return cause.kind === 'flow' ? `flow:${cause.settingId}` : cause.kind;
}
