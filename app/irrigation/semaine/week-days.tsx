'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import { effectiveProposalStatus, type StoredProposal } from '@/lib/domain/planning/contract';
import { proposalStatusLabel, proposedIds, type PlanDay } from '@/lib/domain/planning/presentation';
import { overcommittedDayNotice } from '@/lib/domain/planning/shortage-reading';
import { planDayCells, planWeekRows, type PlanWeekRow } from '@/lib/domain/planning/week-grid';
import { dayValidateShown, pastDaysLabel } from '@/lib/domain/planning/phone-week';
import { unplacedDeficitCount } from '@/lib/domain/planning/action-summary';
import { proposalsText } from '@/lib/domain/display-words';
import { PLAN_CURRENT_WEEK_ONLY } from '@/lib/domain/semaine/week-detail';
import { weekDayLines, weekSlotText, type WeekDayEvent, type WeekDayLine, type WeekDayPlanSlots, type WeekWaterDay } from '@/lib/domain/semaine/week-days';
import type { WeekState } from '@/lib/domain/semaine/week-heading';
import { ProposalCard } from '../planning/proposal-card';
import { formatVolume } from '../planning/format';
import { UNPLACED_ANCHOR } from '../planning/weekly-plan-view';
import { useWeeklyPlan, type WeeklyPlanState } from '../planning/weekly-plan-state';

/**
 * « Jour par jour » (simplification, lot S4, PR 2,
 * docs/simplification-s4-contract.md, section 5) : les sept jours de la
 * semaine affichée, chacun avec ce qui s'y est fait ou s'y fera, sa pluie et
 * ses créneaux du plan. À l'ordinateur, les jours gardent le tableau du
 * planning (les jours en colonnes, une ligne par matériel, P46) avec les
 * cartes des propositions, réutilisées telles quelles ; au téléphone, un
 * créneau à valider tient en une ligne, « Valider » et « Autres choix », qui
 * ouvre sa carte. Les jours écoulés se replient sous « Jours écoulés (n) »
 * (F11), les jours calmes de suite se comptent en une ligne (F301).
 *
 * « Valider » appelle la même action serveur que le planning, avec les mêmes
 * gardes ; un refus d'une garde s'écrit sous la ligne avec son motif.
 * Démarrer et terminer restent sur « Aujourd'hui » (S4-h).
 */
export function WeekDays({ weekStart, today, state, days, events, rainMatters, query }: {
  weekStart: string;
  today: string;
  state: WeekState;
  days: readonly WeekWaterDay[];
  events: readonly WeekDayEvent[];
  rainMatters: boolean;
  query: PageQuery;
}) {
  const weekly = useWeeklyPlan();
  // Le plan ne couvre que la semaine en cours (S4-l) : ailleurs, aucun créneau.
  const plan = weekly?.plan && state === 'current' && weekly.plan.calculation.weekStart === weekStart ? weekly : null;
  const planDays = useMemo(() => new Map((plan?.days ?? []).map((day) => [day.dateKey, day])), [plan?.days]);
  const rows = useMemo(() => planWeekRows(plan?.days ?? []), [plan?.days]);
  const planNow = weekly?.now;
  const now = useMemo(() => planNow ?? new Date(), [planNow]);
  const view = useMemo(() => weekDayLines({
    weekStart,
    today,
    now,
    state,
    days,
    events,
    plan: plan ? Object.fromEntries(plan.days.map((day): [string, WeekDayPlanSlots] => [day.dateKey, { total: day.proposals.length, toValidate: proposedIds(day.proposals, now).length }])) : null,
    shownEventIds: new Set((plan?.days ?? []).flatMap((day) => day.proposals.flatMap((proposal) => (proposal.validatedEventId ? [proposal.validatedEventId] : [])))),
    rainMatters,
  }), [weekStart, today, now, state, days, events, plan, rainMatters]);
  const [pastOpen, setPastOpen] = useState(false);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const reveal = (id: string) => setRevealed((current) => new Set(current).add(id));
  const toggle = (id: string) => setRevealed((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  useEffect(() => {
    // Une ancre `proposal-<id>` (section 7.4) ouvre son jour et sa carte, au chargement comme à un lien suivi dans la page.
    const openTargetedSlot = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith('proposal-')) return;
      const card = document.getElementById(id);
      const slot = card?.closest<HTMLElement>('[data-slot]');
      if (!card || !slot) return;
      if (slot.closest('[data-fold="past"]')) setPastOpen(true);
      reveal(slot.dataset.slot ?? '');
      requestAnimationFrame(() => card.scrollIntoView({ block: 'start' }));
    };
    openTargetedSlot();
    window.addEventListener('hashchange', openTargetedSlot);
    return () => window.removeEventListener('hashchange', openTargetedSlot);
  }, []);

  const unplaced = plan ? unplacedDeficitCount(plan.groups) : 0;
  return (
    <section className="week-days" aria-labelledby="week-days-title">
      <h3 id="week-days-title">Jour par jour</h3>
      {weekly && state !== 'current' ? <p className="week-plan-elsewhere">{PLAN_CURRENT_WEEK_ONLY}</p> : null}
      <ol className="planning-days" aria-label="Jours de la semaine" data-past-open={pastOpen} style={{ '--planning-rows': Math.max(rows.length, 1) } as CSSProperties}>
        {plan ? (
          <>
            <li className="planning-row-label planning-corner" aria-hidden="true" style={{ '--row': 1 } as CSSProperties}><span>Matériel</span></li>
            {rows.map((row, index) => (
              <li key={`ligne-${row.equipmentId}`} className="planning-row-label" aria-hidden="true" style={{ '--row': index + 2 } as CSSProperties}><span>{row.equipmentName}</span></li>
            ))}
          </>
        ) : null}
        {view.pastCount > 0 ? (
          <li className="planning-past-toggle">
            <button type="button" aria-expanded={pastOpen} onClick={() => setPastOpen((value) => !value)}>{pastDaysLabel(view.pastCount)}</button>
          </li>
        ) : null}
        {view.lines.map((line, index) => (
          <WeekDay key={line.dateKey} line={line} column={index} planDay={planDays.get(line.dateKey) ?? null} rows={rows} plan={plan} revealed={revealed} onToggleSlot={toggle} query={query} />
        ))}
      </ol>
      {plan && plan.weekProposed.length > 0 ? (
        <button type="button" className="primary week-validate-all" disabled={plan.pending} onClick={() => plan.validate(plan.weekProposed)}>
          Valider toute la semaine ({plan.weekProposed.length})
        </button>
      ) : null}
      {/* Le plan ne promet jamais ce qu'il ne place pas, et ne le cache pas (S4-i) : une ligne, qui ouvre la liste dans le détail. */}
      {unplaced > 0 ? (
        <p className="week-unplaced-line">
          {unplaced} planche{unplaced > 1 ? 's' : ''} non servie{unplaced > 1 ? 's' : ''} · <a href={`#${UNPLACED_ANCHOR}`}>Voir</a>
        </p>
      ) : null}
    </section>
  );
}

function WeekDay({ line, column, planDay, rows, plan, revealed, onToggleSlot, query }: {
  line: WeekDayLine;
  /** Le rang du jour dans la semaine, à partir de 0 : sa colonne dans le tableau. */
  column: number;
  planDay: PlanDay | null;
  rows: readonly PlanWeekRow[];
  plan: WeeklyPlanState | null;
  revealed: ReadonlySet<string>;
  onToggleSlot: (id: string) => void;
  query: PageQuery;
}) {
  const proposals = planDay?.proposals ?? [];
  const proposed = plan ? proposedIds(proposals, plan.now) : [];
  // Le jour qu'une limite posée après coup met en défaut le dit dans sa colonne (remarque 5 de la recette 3.9, F256).
  const overcommitted = plan?.plan ? overcommittedDayNotice(plan.plan.calculation.summary.overcommittedDays, line.dateKey, formatVolume) : null;
  const text = line.facts.length > 0 ? line.facts.join(' · ') : line.calmText;
  return (
    <li
      className="planning-day week-day"
      data-before-horizon={planDay?.beforeHorizon ?? line.past}
      data-fold={line.fold}
      data-today={line.today || undefined}
      data-calm-run={line.calmRun?.role}
      aria-label={line.label}
      style={{ '--col': column + 2 } as CSSProperties}
    >
      <div className="planning-day-band" aria-hidden="true" />
      <header className="planning-day-heading">
        <div>
          <h4>
            <span className="planning-label-long">{line.label}</span>
            <span className="planning-label-short" aria-hidden="true">{line.shortLabel}</span>
            {line.today ? <span className="week-day-today">aujourd’hui</span> : null}
          </h4>
          {/* Au téléphone, la suite de jours calmes se lit en une ligne, sur son premier jour (F301). */}
          {line.calmRun?.role === 'start' ? <p className="week-day-run">{line.calmRun.label}</p> : null}
          {text ? <p className="week-day-facts">{text}</p> : null}
          {line.ongoing.length > 0 ? (
            <p className="week-day-ongoing">
              En cours · {line.ongoing.join(', ')} · <a href={pageHref('aujourdhui', { season: query.season, zone: query.zone })}>Aujourd’hui</a>
            </p>
          ) : null}
          {overcommitted ? <p className="planning-day-overcommitted" role="note">{overcommitted}</p> : null}
        </div>
        {/* Une seule proposition : son « Valider » suffit, pas un second bouton pour le même geste (lot K, n° 17, F466). */}
        {plan && dayValidateShown(proposed.length) ? (
          <button type="button" className="planning-day-validate" disabled={plan.pending} aria-label={`Valider ${proposalsText(proposed.length)} du jour`} onClick={() => plan.validate(proposed)}>
            <span className="planning-label-long">Valider {proposalsText(proposed.length)} du jour</span>
            <span className="planning-label-short">Tout valider ({proposed.length})</span>
          </button>
        ) : null}
      </header>
      {plan && planDay && proposals.length > 0 ? (
        <div className="planning-proposals" data-tour="planning-propositions">
          {planDayCells(planDay, rows).map((cell) => (
            <div key={cell.row} className="planning-cell" style={{ '--row': cell.row + 2 } as CSSProperties}>
              {cell.proposals.map((proposal) => (
                <WeekSlot key={proposal.storedId} proposal={proposal} plan={plan} revealed={revealed.has(proposal.storedId)} onToggle={() => onToggleSlot(proposal.storedId)} />
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Un créneau du plan. Au téléphone, sa ligne compacte et, pour une
 * proposition à valider, « Valider » et « Autres choix » ; la carte entière
 * (justification, « Ajuster », « Refuser ») s'ouvre dessous. À l'ordinateur,
 * la carte seule, comme au planning. Une seule carte par créneau : son
 * ancre `proposal-<id>` ne se double jamais.
 */
function WeekSlot({ proposal, plan, revealed, onToggle }: { proposal: StoredProposal; plan: WeeklyPlanState; revealed: boolean; onToggle: () => void }) {
  const status = effectiveProposalStatus(proposal, plan.now);
  const feedback = plan.feedback[proposal.storedId];
  const toValidate = status === 'proposed';
  return (
    <div className="week-slot" data-slot={proposal.storedId} data-revealed={revealed || undefined}>
      <div className="week-slot-line" data-status={status}>
        <p>
          <span>{weekSlotText(proposal)}</span>
          {toValidate ? null : <small> · {proposalStatusLabel(proposal, plan.now)}</small>}
        </p>
        <div className="week-slot-actions">
          {toValidate ? <button type="button" className="primary" disabled={plan.pending} onClick={() => plan.validate([proposal.storedId])}>Valider</button> : null}
          <button type="button" aria-expanded={revealed} onClick={onToggle}>{toValidate ? 'Autres choix' : 'Détail'}</button>
        </div>
        {feedback ? <p className={feedback.ok ? 'planning-proposal-feedback' : 'planning-proposal-refusal'} role={feedback.ok ? 'status' : 'alert'}>{feedback.message}</p> : null}
      </div>
      <ProposalCard proposal={proposal} currentCalculationId={plan.plan?.calculation.id ?? ''} now={plan.now} pending={plan.pending} feedback={feedback} soilNotes={plan.soilNotes[proposal.storedId] ?? []} onValidate={(id) => plan.validate([id])} onAdjust={plan.adjust} onRefuse={plan.askRefuse} />
    </div>
  );
}
