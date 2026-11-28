'use client';

import { useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import { notifyChangeJournalChanged } from '@/lib/domain/feasibility-notifications';
import { OFF_SEASON_HELP } from '@/lib/domain/features/help';
import type { OffSeasonScope } from '@/lib/domain/off-season';
import {
  OFF_SEASON_ANCHOR,
  offSeasonCanceledText,
  offSeasonPlannedQuestion,
  offSeasonScopeChoiceGroups,
  offSeasonScopeFromValue,
  offSeasonSinceText,
  type OffSeasonPlannedLine,
  type OffSeasonView,
} from '@/lib/domain/off-season-view';
import { cancelPlannedIrrigationAction } from './irrigation-event-actions';
import { readOffSeasonPlannedAction, saveOffSeasonAction, type OffSeasonActionResult } from './off-season-actions';
import { GoalScopePicker } from './goal-scope-picker';
import { ActionReply, actionReply, type ActionReplyMessage } from './shell/action-reply';
import { useSectionHelp } from './shell/section-help';

/**
 * Le bloc « Hors saison » du pli « Objectifs de la semaine » (6
 * quaterdecies, B3, docs/objectif-automatique-saison-contract.md, sections
 * 4.3 à 4.5 et 10 ; D-337, D-353) : les endroits hors saison en puces, chacun
 * avec « Reprendre » ; « Mettre hors saison » ouvre le choix des cinq
 * portées ; quand des arrosages planifiés ou validés arrosent ces planches,
 * une fenêtre propose « Les annuler » ou « Les garder » (le défaut).
 * L'annulation passe par le geste du planning, arrosage par arrosage ; un
 * arrosage démarré n'est pas proposé. Même geste au téléphone.
 */
const REPLY_CLASSES = { notice: 'water-notice', warning: 'weather-stale', error: 'water-error' } as const;
const TITLE = 'Hors saison';

export function OffSeasonPanel({ season, snapshot, initialView }: { season: number; snapshot: IrrigationSnapshot; initialView: OffSeasonView }) {
  const [view, setView] = useState(initialView);
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);
  const [pending, startTransition] = useTransition();
  const [choosing, setChoosing] = useState(false);
  const groups = useMemo(() => offSeasonScopeChoiceGroups(snapshot, season, view.modes), [snapshot, season, view.modes]);
  const [value, setValue] = useState(() => groups[0]?.choices[0]?.value ?? '');
  const [planned, setPlanned] = useState<{ scope: OffSeasonScope; lines: OffSeasonPlannedLine[] } | null>(null);
  const help = useSectionHelp(TITLE, OFF_SEASON_HELP);
  const titleId = useId();
  const say = (tone: 'notice' | 'error', message: string) => setReplies([actionReply('hors-saison', tone, message)]);

  /** Un geste qui a réussi : le bloc se relit, les besoins, le planning et le journal aussi. */
  const received = (result: OffSeasonActionResult, extra = '') => {
    if (!result.ok) {
      say('error', result.message);
      return false;
    }
    setView(result.view);
    say('notice', extra === '' ? result.message : `${result.message} ${extra}`);
    window.dispatchEvent(new CustomEvent('irrigation-needs-source-changed'));
    notifyChangeJournalChanged();
    return true;
  };

  const putOffSeason = (scope: OffSeasonScope, cancel: readonly OffSeasonPlannedLine[]) => startTransition(async () => {
    const result = await saveOffSeasonAction({ season, scope, offSeason: true });
    if (!result.ok || cancel.length === 0) {
      received(result);
      return;
    }
    // L'annulation, une par une, par le geste existant du planning (section 10, question 2).
    let canceled = 0;
    for (const line of cancel) {
      const done = await cancelPlannedIrrigationAction(line.eventEquipmentId);
      if (done.ok) canceled += 1;
    }
    received(result, offSeasonCanceledText(canceled, cancel.length - canceled));
    window.dispatchEvent(new CustomEvent('irrigation-events-changed'));
  });

  const confirmChoice = () => {
    const scope = offSeasonScopeFromValue(value);
    if (!scope) {
      say('error', 'Choisissez un endroit.');
      return;
    }
    setChoosing(false);
    startTransition(async () => {
      const result = await readOffSeasonPlannedAction({ season, scope });
      if (!result.ok) {
        say('error', result.message);
        return;
      }
      if (result.planned.length === 0) putOffSeason(scope, []);
      else setPlanned({ scope, lines: result.planned });
    });
  };

  const resume = (scope: OffSeasonScope) => startTransition(async () => {
    received(await saveOffSeasonAction({ season, scope, offSeason: false }));
  });

  const choosePlanned = (choice: 'cancel' | 'keep' | 'back') => {
    const asked = planned;
    setPlanned(null);
    if (asked && choice !== 'back') putOffSeason(asked.scope, choice === 'cancel' ? asked.lines : []);
  };

  return (
    <section id={OFF_SEASON_ANCHOR} className="off-season-block" aria-labelledby={titleId}>
      <div className="off-season-heading">
        <h4 id={titleId}>{TITLE}</h4>
        {help.toggle}
      </div>
      {help.panel}
      <p className="off-season-lede">Pour ignorer l’irrigation d’un endroit, l’hiver par exemple : ni objectif, ni arrosage proposé. La pluie reste suivie.</p>
      {view.chips.length === 0 ? <p className="off-season-empty">Aucun endroit hors saison : toute la ferme suit son objectif.</p> : (
        <ul className="off-season-chips">
          {view.chips.map((chip) => (
            <li key={chip.key} className="off-season-chip">
              <span><strong>{chip.label}</strong> · {offSeasonSinceText(chip.since)}</span>
              <small>{chip.beds} planche{chip.beds > 1 ? 's' : ''}</small>
              <button type="button" className="secondary-button" disabled={pending} onClick={() => resume(chip.scope)}>Reprendre</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="secondary-button off-season-open" disabled={pending || groups.length === 0} onClick={() => setChoosing(true)}>Mettre hors saison</button>
      <ActionReply messages={replies} origin="hors-saison" classNames={REPLY_CLASSES} />
      <ModalDialog open={choosing} title="Mettre hors saison" className="off-season-choice" onCancel={() => setChoosing(false)}>
        <div className="module-confirm-body">
          <GoalScopePicker snapshot={snapshot} season={season} value={value} onChange={setValue} groups={groups} />
          {view.unclassifiedGardens > 0 ? <p className="off-season-unclassified">{unclassifiedText(view.unclassifiedGardens)}</p> : null}
          <p>À partir d’aujourd’hui, son irrigation est ignorée : ni objectif, ni arrosage proposé. La pluie, la météo et les alertes restent suivies. Rien ne reprend seul : « Reprendre » le lève.</p>
        </div>
        <div className="irrigation-dialog-actions">
          <button type="button" onClick={() => setChoosing(false)}>Annuler</button>
          <button type="button" className="primary" disabled={pending} onClick={confirmChoice}>Mettre hors saison</button>
        </div>
      </ModalDialog>
      <ModalDialog open={planned !== null} title="Des arrosages sont déjà prévus" className="off-season-planned" onCancel={() => choosePlanned('back')} focusLast>
        <div className="module-confirm-body">
          <p>{planned ? offSeasonPlannedQuestion(planned.lines.length) : ''}</p>
          <ul className="off-season-planned-list">
            {planned?.lines.map((line) => (
              <li key={line.eventEquipmentId}>
                <strong>{line.text}</strong> · {line.covered}
                {line.others ? <small>Arrose aussi {line.others}, en saison : l’annuler les prive aussi de cette eau.</small> : null}
              </li>
            ))}
          </ul>
          <p>Un arrosage déjà démarré n’est pas proposé : il se termine. Les garder : ils restent planifiés, et vous pouvez les annuler plus tard dans « Arrosages ».</p>
        </div>
        <div className="irrigation-dialog-actions">
          <button type="button" onClick={() => choosePlanned('back')}>Ne rien faire</button>
          <button type="button" className="confirm-erase" onClick={() => choosePlanned('cancel')}>Les annuler</button>
          <button type="button" className="primary" onClick={() => choosePlanned('keep')}>Les garder</button>
        </div>
      </ModalDialog>
    </section>
  );
}

/** « 2 jardins à classer : … » (section 4.3) : ni tout le plein champ ni tout le sous-abri ne les couvre, jamais deviné (D-003). */
function unclassifiedText(count: number): string {
  return count > 1
    ? `${count} jardins à classer : ni « tout le plein champ » ni « tout le sous-abri » ne les couvre. Classez-les, ou mettez-les hors saison un par un.`
    : '1 jardin à classer : ni « tout le plein champ » ni « tout le sous-abri » ne le couvre. Classez-le, ou mettez-le hors saison seul.';
}

/**
 * Une fenêtre modale, comme celle d'allumage de l'objectif automatique :
 * Échap vaut « Annuler ». `focusLast` met le focus sur le dernier bouton, le
 * choix par défaut (« Les garder »).
 */
function ModalDialog({ open, title, className, onCancel, focusLast = false, children }: {
  open: boolean;
  title: string;
  className: string;
  onCancel: () => void;
  focusLast?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      if (focusLast) element.querySelector<HTMLButtonElement>('.irrigation-dialog-actions button:last-child')?.focus();
    }
    if (!open && element.open) element.close();
  }, [open, focusLast]);
  return (
    <dialog ref={dialog} className={`module-confirm-dialog ${className}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <h3 id={titleId}>{title}</h3>
      {children}
    </dialog>
  );
}
