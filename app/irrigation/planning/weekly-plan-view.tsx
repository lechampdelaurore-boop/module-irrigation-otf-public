'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition, type CSSProperties, type RefObject } from 'react';
import { notifyFeasibilityChanged } from '@/lib/domain/feasibility-notifications';
import { priorityLabel } from '@/lib/domain/irrigation-feasibility';
import type { PlanBedOutcome, PlanEventNotice, StoredPlanSuggestion, StoredWeeklyPlan, SupplyBudget } from '@/lib/domain/planning/contract';
import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_LABELS,
  arbitrationNote,
  bedReasonLabels,
  budgetDemandText,
  budgetLevelsText,
  calculationTriggerLabel,
  pendingEventNotice,
  planDays,
  proposedIds,
  summarizePlan,
  unplacedBeds,
  unplacedReasonsExpertNote,
  waterDeficitExplanation,
  type PlanDay,
  type PlanSummary,
} from '@/lib/domain/planning/presentation';
import { unknownWaterChainCount, waterDeficitTileDetail, waterDeficitValue } from '@/lib/domain/planning/water-deficit-summary';
import type { ProtectedSlot } from '@/lib/domain/planning/protected-slots';
import type { PlanningSettings } from '@/lib/domain/planning/settings';
import { millisecondsFromSeconds } from '@/lib/domain/units';
import {
  applyPlanSuggestionAction,
  computeWeeklyPlanAction,
  keepPlanSuggestionAction,
  loadWeeklyPlanAction,
  refusePlanProposalAction,
  validateAdjustedPlanProposalAction,
  validatePlanProposalsAction,
  type ProposalsActionResult,
} from '../planning-actions';
import { ChangesFold, SuggestionList, type SuggestionFeedback } from './follow-up-blocks';
import { PlanningSettingsForm } from './planning-settings-form';
import { ProtectedSlotsSection } from './protected-slots-section';
import { ProposalCard, type ProposalFeedback } from './proposal-card';
import type { ProposalSoilNote } from '@/lib/domain/soil-reserve/proposal-soil';
import { capitalize, formatDateTime, formatLongDay, formatShortDay, formatVolume, formatWeekdayAndDay } from './format';
import { unplacedOrigin } from '@/lib/domain/planning/origins';
import { planDayCells, planWeekRows, type PlanWeekRow } from '@/lib/domain/planning/week-grid';
import { pastDaysLabel, phoneWeekFolds, planSummaryLine, unplacedFoldLabel, type PhoneDayFold } from '@/lib/domain/planning/phone-week';
import { UNPLACED_GROUP_MEANING, planActionCounts, planActionLine, planActionTiles, unplacedGroups, unplacedTileDetail, type UnplacedGroups } from '@/lib/domain/planning/action-summary';
import { pageHref } from '@/lib/domain/features/pages';
import { Icon } from '../line-icon';
import { FigureOrigin } from '../shell/figure-origin';

type Props = {
  season: number;
  initialNowIso: string;
  initialPlan: StoredWeeklyPlan | null;
  initialSettings: PlanningSettings;
  /** Les créneaux protégés de l'exploitation, dans le pli des réglages (3.8 ter, section 7). */
  initialProtectedSlots: ProtectedSlot[];
  /** La dose au-delà de ce que le sol retient, par proposition, calculée au chargement de la page (5 ter, PR 3d). */
  soilNotes?: Record<string, ProposalSoilNote[]>;
  /** « Ajouter un créneau à la main » : le formulaire « Planifier » est sur la page des arrosages depuis la 3.8. */
  onAddManualSlot: () => void;
};

/** Les délais entre deux relectures après un événement, en secondes : un recalcul prend de quelques secondes à trois quarts de minute sur le site (point ouvert 34). */
const REFRESH_DELAYS_SECONDS = [1, 2, 3, 5, 8, 10, 10, 10];
/** Les signaux que les autres sections envoient après un événement de la règle 4 (3.7) ; le canal porte ceux des autres onglets. */
const REFRESH_SIGNALS = ['irrigation-events-changed', 'irrigation-needs-source-changed', 'irrigation-feasibility-source-changed'];

/**
 * La section « Planning de la semaine » (docs/planning-contract.md,
 * « Interface (3.6) ») : le dernier calcul, son résumé, la semaine en jours
 * avec ses propositions, ce qui n'a pas été placé, et les réglages. Elle
 * appelle les actions du moteur ; les regroupements et les comptes viennent
 * de `lib/domain/planning/presentation.ts`.
 */
export function WeeklyPlanView({ season, initialNowIso, initialPlan, initialSettings, initialProtectedSlots, soilNotes = {}, onAddManualSlot }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [now, setNow] = useState(() => new Date(initialNowIso));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, ProposalFeedback>>({});
  const [suggestionFeedback, setSuggestionFeedback] = useState<Record<string, SuggestionFeedback>>({});
  const [pending, startTransition] = useTransition();
  const planRef = useRef(initialPlan);
  useEffect(() => { planRef.current = plan; }, [plan]);
  const receiveRecalculated = useCallback((recalculated: StoredWeeklyPlan | null) => { setNow(new Date()); setPlan(recalculated); }, []);
  const refreshAfterEvent = usePlanRefreshAfterEvents(season, planRef, receiveRecalculated);
  useEffect(() => {
    // Un événement saisi sur une autre page (3.8) — une pluie, une limite, un
    // arrosage — peut avoir un recalcul encore en cours à l'ouverture du
    // planning : la section le relit comme après un geste fait ici.
    if (planRef.current?.pendingEvent?.status === 'pending') refreshAfterEvent();
  }, [refreshAfterEvent]);

  useEffect(() => {
    // Les statuts se lisent avec l'heure de l'écran : elle se remet à l'heure
    // quand la page revient, et le plan aussi — le recalcul du matin a pu
    // passer pendant que l'onglet dormait. Un calcul inchangé ne touche à rien.
    const update = () => {
      if (document.visibilityState !== 'visible') return;
      setNow(new Date());
      startTransition(async () => {
        const result = await loadWeeklyPlanAction({ season });
        if (!result.ok || result.plan?.calculation.id === planRef.current?.calculation.id) return;
        setPlan(result.plan);
        setFeedback({});
      });
    };
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [season]);

  const receiveProposals = useCallback((result: ProposalsActionResult) => {
    setNow(new Date());
    if (!result.ok) { setError(result.message); setNotice(null); return; }
    setPlan(result.plan);
    const validated = result.results.filter((item) => item.ok).length;
    const refused = result.results.length - validated;
    setFeedback((current) => ({
      ...current,
      ...Object.fromEntries(result.results.map((item) => [
        item.proposalId,
        item.ok
          ? { ok: true, message: item.warning ? `Irrigation planifiée · ${item.warning}` : 'Irrigation planifiée.' }
          : { ok: false, message: item.message },
      ])),
    }));
    setNotice(`${validated} irrigation${validated > 1 ? 's' : ''} planifiée${validated > 1 ? 's' : ''}${refused > 0 ? `, ${refused} proposition${refused > 1 ? 's' : ''} refusée${refused > 1 ? 's' : ''} par une garde : le motif est sur la carte` : ''}.`);
    setError(null);
    if (validated > 0) {
      window.dispatchEvent(new CustomEvent('irrigation-events-changed'));
      notifyFeasibilityChanged();
    }
  }, []);

  const compute = () => startTransition(async () => {
    const result = await computeWeeklyPlanAction({ season });
    setNow(new Date());
    if (result.ok) { setPlan(result.plan); setFeedback({}); setSuggestionFeedback({}); setNotice('Plan calculé.'); setError(null); }
    else { setError(result.message); setNotice(null); }
  });
  useEffect(() => {
    // « Recalculer le plan » depuis la carte d'un arrosage en retard (3.7, règle 20) : un calcul à la demande.
    const handler = () => compute();
    window.addEventListener('planning-recalculate-requested', handler);
    return () => window.removeEventListener('planning-recalculate-requested', handler);
  });
  // « Appliquer » une suggestion (règle 17) passe par le circuit ordinaire de l'irrigation : les autres sections relisent, le plan se recalcule après la réponse.
  const applySuggestion = (suggestion: StoredPlanSuggestion) => startTransition(async () => {
    const result = await applyPlanSuggestionAction({ season, eventEquipmentId: suggestion.eventEquipmentId });
    setNow(new Date());
    setSuggestionFeedback((current) => ({ ...current, [suggestion.eventEquipmentId]: { ok: result.ok, message: result.ok && result.warning ? `${result.message} ${result.warning}` : result.message } }));
    if (!result.ok) return;
    setPlan(result.plan);
    // Le message reste dans le bandeau de la section : la carte de la suggestion s'en va avec le recalcul qui suit (recette réelle du 31 octobre 2026).
    setNotice(result.warning ? `${result.message} ${result.warning}` : result.message);
    setError(null);
    window.dispatchEvent(new CustomEvent('irrigation-events-changed'));
    notifyFeasibilityChanged();
    refreshAfterEvent();
  });
  const keepSuggestion = (suggestion: StoredPlanSuggestion) => startTransition(async () => {
    const result = await keepPlanSuggestionAction({ season, eventEquipmentId: suggestion.eventEquipmentId, suggestion: suggestion.suggestion, doseMm: suggestion.doseMm });
    setSuggestionFeedback((current) => ({ ...current, [suggestion.eventEquipmentId]: { ok: result.ok, message: result.message } }));
    if (result.ok) setPlan(result.plan);
  });
  const validate = (proposalIds: string[]) => startTransition(async () => receiveProposals(await validatePlanProposalsAction({ season, proposalIds })));
  const adjust = (proposalId: string, startAt: string, doseMm: number) => startTransition(async () => receiveProposals(await validateAdjustedPlanProposalAction({ season, proposalId, startAt, doseMm })));
  const refuse = (proposalId: string) => startTransition(async () => {
    const result = await refusePlanProposalAction({ season, proposalId });
    setNow(new Date());
    if (!result.ok) { setError(result.message); return; }
    setPlan(result.plan);
    setFeedback((current) => ({ ...current, [proposalId]: { ok: true, message: result.refused ? 'Proposition refusée : le besoin reste affiché.' : 'Cette proposition avait déjà été décidée.' } }));
    setNotice(null);
    setError(null);
    // Un refus est un événement : le serveur recalcule après sa réponse, la section relit le plan quand il est prêt (3.7).
    if (result.refused) refreshAfterEvent();
  });

  const days = useMemo(() => (plan ? planDays(plan, now) : []), [plan, now]);
  // Au téléphone, les jours se replient (audit ergonomique, point 2, F11) ; un geste ouvre ou replie un jour, l'ordinateur ne replie rien.
  const folds = useMemo(() => phoneWeekFolds(days, now), [days, now]);
  const [dayToggles, setDayToggles] = useState<Record<string, boolean>>({});
  const [pastOpen, setPastOpen] = useState(false);
  const rows = useMemo(() => planWeekRows(days), [days]);
  const summary = useMemo(() => (plan ? summarizePlan(plan, now) : null), [plan, now]);
  const unplaced = useMemo(() => (plan ? unplacedBeds(plan) : []), [plan]);
  const groups = useMemo(() => unplacedGroups(unplaced), [unplaced]);
  const actions = useMemo(() => (plan && summary ? planActionCounts(plan, summary, initialSettings.lateToleranceMinutes, now) : null), [plan, summary, initialSettings.lateToleranceMinutes, now]);
  const weekProposed = plan ? proposedIds(plan.proposals, now) : [];

  return (
    <section className="planning-section" aria-labelledby="planning-title" aria-busy={pending}>
      <header className="planning-heading">
        <div>
          <p className="eyebrow">Planning · saison {season}</p>
          <h2 id="planning-title">Planning de la semaine</h2>
          <p>Des propositions de créneaux, du calcul à dimanche, que vous validez une par une, par jour ou toutes ensemble. Rien n’est arrosé sans vous.</p>
        </div>
        <div className="planning-heading-actions">
          <button type="button" className="primary" disabled={pending} onClick={compute}>
            {pending ? 'Calcul en cours…' : plan ? 'Recalculer le plan' : 'Calculer le plan de la semaine'}
          </button>
          <button type="button" onClick={onAddManualSlot}>Ajouter un créneau à la main</button>
        </div>
      </header>

      {notice ? <p className="planning-notice" role="status">{notice}</p> : null}
      {error ? <p className="planning-error" role="alert">{error}</p> : null}

      {!plan || !summary ? (
        <p className="planning-empty">Aucun calcul pour cette semaine. Le plan se calcule chaque matin après la météo, ou maintenant d’un clic.</p>
      ) : (
        <>
          <p className="planning-meta">
            Semaine du {formatShortDay(plan.calculation.weekStart)} au {formatShortDay(plan.calculation.summary.weekEnd)} · calculé le {formatDateTime(plan.calculation.computedAt)} ({calculationTriggerLabel(plan.calculation)}) · prévision météo sur {plan.calculation.summary.assumptions.forecastDays} jour{plan.calculation.summary.assumptions.forecastDays > 1 ? 's' : ''}
            {plan.calculation.summary.assumptions.reservoirsObservedAt.map((reservoir) => (
              <span key={reservoir.reservoirId}> · {reservoir.name} : {reservoir.currentCubicMeters === null ? 'niveau inconnu' : `${formatVolume(reservoir.currentCubicMeters)} observés${reservoir.observedAt ? ` le ${formatDateTime(reservoir.observedAt)}` : ''}`}</span>
            ))}
          </p>
          {plan.pendingEvent ? (
            <p className={plan.pendingEvent.status === 'failed' ? 'planning-error' : 'planning-empty'} role={plan.pendingEvent.status === 'failed' ? 'alert' : 'status'}>
              {pendingEventNotice(plan.pendingEvent, formatDateTime(plan.pendingEvent.occurredAt))}
            </p>
          ) : null}
          {actions ? <PlanSummaryCards summary={summary} plan={plan} actions={planActionTiles(actions)} actionLine={planActionLine(actions)} unplacedCount={unplaced.length} unplacedDetail={unplacedTileDetail(groups, plan.calculation.summary.deficit.bedCount)} /> : null}
          {plan.calculation.summary.changes ? <ChangesFold changes={plan.calculation.summary.changes} /> : null}
          {plan.calculation.summary.budgets.length > 0 ? <BudgetList budgets={plan.calculation.summary.budgets} /> : null}
          <SuggestionList suggestions={plan.suggestions} pending={pending} feedback={suggestionFeedback} onApply={applySuggestion} onKeep={keepSuggestion} />

          <div className="planning-week-heading">
            <h3>La semaine</h3>
            {weekProposed.length > 0 ? (
              <button type="button" className="primary" disabled={pending} onClick={() => validate(weekProposed)}>
                Valider toute la semaine ({weekProposed.length})
              </button>
            ) : null}
          </div>
          {/* Sur un grand écran, la semaine en tableau : les jours en colonnes, une ligne par matériel (précision P46). */}
          <ol className="planning-days" aria-label="Jours de la semaine" data-past-open={pastOpen} style={{ '--planning-rows': Math.max(rows.length, 1) } as CSSProperties}>
            <li className="planning-row-label planning-corner" aria-hidden="true" style={{ '--row': 1 } as CSSProperties}><span>Matériel</span></li>
            {rows.map((row, index) => (
              <li key={`ligne-${row.equipmentId}`} className="planning-row-label" aria-hidden="true" style={{ '--row': index + 2 } as CSSProperties}><span>{row.equipmentName}</span></li>
            ))}
            {folds.pastCount > 0 ? (
              <li className="planning-past-toggle">
                <button type="button" aria-expanded={pastOpen} onClick={() => setPastOpen((value) => !value)}>{pastDaysLabel(folds.pastCount)}</button>
              </li>
            ) : null}
            {days.map((day, index) => {
              const fold = folds.folds[day.dateKey];
              const expanded = dayToggles[day.dateKey] ?? fold === 'open';
              return (
                <DayBlock key={day.dateKey} day={day} column={index} rows={rows} fold={fold} expanded={expanded} onToggle={() => setDayToggles((current) => ({ ...current, [day.dateKey]: !expanded }))} calculationId={plan.calculation.id} now={now} pending={pending} feedback={feedback} soilNotes={soilNotes} onValidateDay={validate} onValidate={(id) => validate([id])} onAdjust={adjust} onRefuse={refuse} />
              );
            })}
          </ol>

          <UnplacedList beds={unplaced} groups={groups} season={season} />
        </>
      )}

      <PlanningSettingsForm initialSettings={initialSettings}>
        <ProtectedSlotsSection initialSlots={initialProtectedSlots} />
      </PlanningSettingsForm>
    </section>
  );
}

/**
 * La relecture du plan après un événement (3.7, règle 6) : le serveur
 * recalcule après sa réponse, et la section relit le plan à intervalles
 * croissants jusqu'à ce qu'un nouveau calcul paraisse, que le recalcul ait
 * échoué — l'avis le dit — ou qu'aucun recalcul ne soit en cours, puis
 * s'arrête. Rien ne tourne en continu, et rien ne tourne onglet caché : le
 * retour de l'onglet relit le plan de lui-même.
 */
function usePlanRefreshAfterEvents(season: number, planRef: RefObject<StoredWeeklyPlan | null>, receive: (plan: StoredWeeklyPlan | null) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    let attempt = 0;
    const schedule = () => {
      if (attempt >= REFRESH_DELAYS_SECONDS.length) return;
      timer.current = setTimeout(() => void tick(), millisecondsFromSeconds(REFRESH_DELAYS_SECONDS[attempt++]));
    };
    const tick = async () => {
      timer.current = null;
      if (document.visibilityState !== 'visible') return;
      const before = planRef.current;
      const result = await loadWeeklyPlanAction({ season });
      if (!result.ok) return;
      const changed = result.plan?.calculation.id !== before?.calculation.id;
      if (changed || !sameNotice(result.plan?.pendingEvent ?? null, before?.pendingEvent ?? null)) receive(result.plan);
      if (!changed && result.plan?.pendingEvent?.status === 'pending') schedule();
    };
    schedule();
  }, [season, planRef, receive]);
  useEffect(() => {
    REFRESH_SIGNALS.forEach((name) => window.addEventListener(name, refresh));
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('irrigation-feasibility');
    if (channel) channel.onmessage = refresh;
    return () => {
      REFRESH_SIGNALS.forEach((name) => window.removeEventListener(name, refresh));
      channel?.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);
  return refresh;
}

function sameNotice(left: PlanEventNotice | null, right: PlanEventNotice | null): boolean {
  return left?.kind === right?.kind && left?.status === right?.status && left?.occurredAt === right?.occurredAt;
}

function DayBlock({ day, column, rows, fold, expanded, onToggle, calculationId, now, pending, feedback, soilNotes, onValidateDay, onValidate, onAdjust, onRefuse }: {
  day: PlanDay;
  /** Le rang du jour dans la semaine, à partir de 0 : sa colonne dans le tableau. */
  column: number;
  rows: readonly PlanWeekRow[];
  /** Le repli du jour au téléphone (F11) ; l'ordinateur l'ignore. */
  fold: PhoneDayFold;
  /** Au téléphone, les créneaux du jour sont montrés. */
  expanded: boolean;
  onToggle: () => void;
  calculationId: string;
  now: Date;
  pending: boolean;
  feedback: Record<string, ProposalFeedback>;
  soilNotes: Record<string, ProposalSoilNote[]>;
  onValidateDay: (ids: string[]) => void;
  onValidate: (id: string) => void;
  onAdjust: (id: string, startAt: string, doseMm: number) => void;
  onRefuse: (id: string) => void;
}) {
  const proposed = proposedIds(day.proposals, now);
  const counts = PROPOSAL_STATUSES.filter((status) => day.counts[status] > 0).map((status) => `${day.counts[status]} ${PROPOSAL_STATUS_LABELS[status].toLocaleLowerCase('fr-FR')}${day.counts[status] > 1 ? 's' : ''}`);
  const proposalsId = useId();
  return (
    <li className="planning-day" data-before-horizon={day.beforeHorizon} data-fold={fold} data-expanded={expanded} aria-label={capitalize(formatLongDay(day.dateKey))} style={{ '--col': column + 2 } as CSSProperties}>
      <div className="planning-day-band" aria-hidden="true" />
      <header className="planning-day-heading">
        <div>
          <h4>
            <span className="planning-label-long">{capitalize(formatLongDay(day.dateKey))}</span>
            <span className="planning-label-short" aria-hidden="true">{capitalize(formatWeekdayAndDay(day.dateKey))}</span>
          </h4>
          <small>
            {day.proposals.length === 0
              ? (day.beforeHorizon ? 'Jour écoulé avant le calcul.' : 'Aucune proposition.')
              : `${counts.join(' · ')} · ${formatVolume(day.volumeCubicMeters)}${day.unknownVolumeCount > 0 ? ` + ${day.unknownVolumeCount} au volume inconnu` : ''}`}
          </small>
          {day.proposals.length > 0 ? (
            <button type="button" className="planning-day-toggle" aria-expanded={expanded} aria-controls={proposalsId} onClick={onToggle}>
              {expanded ? 'Replier le jour' : `Voir les créneaux (${day.proposals.length})`}
            </button>
          ) : null}
        </div>
        {proposed.length > 0 ? (
          <button type="button" disabled={pending} aria-label={`Valider les ${proposed.length} proposition${proposed.length > 1 ? 's' : ''} du jour`} onClick={() => onValidateDay(proposed)}>
            <span className="planning-label-long">Valider les {proposed.length} proposition{proposed.length > 1 ? 's' : ''} du jour</span>
            <span className="planning-label-short">Tout valider ({proposed.length})</span>
          </button>
        ) : null}
      </header>
      {day.proposals.length > 0 ? (
        <div className="planning-proposals" id={proposalsId}>
          {planDayCells(day, rows).map((cell) => (
            <div key={cell.row} className="planning-cell" style={{ '--row': cell.row + 2 } as CSSProperties}>
              {cell.proposals.map((proposal) => (
                <ProposalCard key={proposal.storedId} proposal={proposal} currentCalculationId={calculationId} now={now} pending={pending} feedback={feedback[proposal.storedId]} soilNotes={soilNotes[proposal.storedId] ?? []} onValidate={onValidate} onAdjust={onAdjust} onRefuse={onRefuse} />
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function PlanSummaryCards({ summary, plan, actions, actionLine, unplacedCount, unplacedDetail }: {
  summary: PlanSummary;
  plan: StoredWeeklyPlan;
  /** « À valider », « Faites », « En retard » : les cartes de tête (audit ergonomique, lot 3, point 5, cas 1). */
  actions: ReturnType<typeof planActionTiles>;
  actionLine: string[];
  unplacedCount: number;
  unplacedDetail: string;
}) {
  const { deficit } = plan.calculation.summary;
  // Une chaîne servie à l'eau inconnue : son manque ne peut pas être chiffré, et le résumé le dit (point ouvert 51, D-089).
  const unknownWater = unknownWaterChainCount(plan.calculation.summary.budgets);
  const explanation = waterDeficitExplanation(plan);
  // Sous un arbitrage validé, aucune ligne de budget : la note dit l'eau allouée et ce qui ne peut pas être reçu (D-052).
  const arbitration = arbitrationNote(plan.calculation.summary);
  // Au téléphone, les tuiles tiennent en une ligne de résumé, dépliable (F11).
  const [open, setOpen] = useState(false);
  const tilesId = useId();
  return (
    <>
      <button type="button" className="planning-summary-line" aria-expanded={open} aria-controls={tilesId} onClick={() => setOpen((value) => !value)}>
        <span>{planSummaryLine(summary, actionLine, deficit, unplacedCount, formatVolume, unknownWater)}</span>
        <small>{open ? 'Replier' : 'Détail'}</small>
      </button>
      <div className="planning-summary" id={tilesId} data-open={open}>
        {actions.map((tile) => <SummaryCard key={tile.label} label={tile.label} value={tile.value} detail={tile.detail} tone={tile.tone} action />)}
        <SummaryCard label="Volume proposé et validé" value={formatVolume(summary.volumeCubicMeters)} detail={summary.unknownVolumeCount > 0 ? `${summary.unknownVolumeCount} créneau${summary.unknownVolumeCount > 1 ? 'x' : ''} au volume inconnu en plus` : 'Volumes connus'} />
        <SummaryCard label="Non vérifié" value={String(summary.unverifiedCount)} detail="Créneaux sans pompe, origine ou stock connu" />
        <SummaryCard label="Manque d’eau" value={waterDeficitValue(deficit.waterCubicMeters, unknownWater, formatVolume)} detail={waterDeficitTileDetail(deficit, unknownWater)} tone={deficit.waterCubicMeters > 0 ? 'deficit' : undefined} />
        <SummaryCard label="Temps de pompage manquant" value={formatVolume(deficit.pumpTimeCubicMeters)} detail="Ce qui ne tient pas dans les plages horaires" tone={deficit.pumpTimeCubicMeters > 0 ? 'deficit' : undefined} />
        <SummaryCard label="Planches non servies" value={String(unplacedCount)} detail={unplacedDetail} tone={unplacedCount > 0 ? 'deficit' : undefined} />
      </div>
      {explanation ? <p className="planning-summary-note">{explanation}</p> : null}
      {arbitration ? <p className="planning-summary-note">{arbitration}</p> : null}
    </>
  );
}

function SummaryCard({ label, value, detail, tone, action = false }: { label: string; value: string; detail: string; tone?: string; action?: boolean }) {
  return <div className="planning-summary-card" data-tone={tone} data-action={action || undefined}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function BudgetList({ budgets }: { budgets: readonly SupplyBudget[] }) {
  return (
    <details className="planning-budgets">
      <summary>Budget d’eau d’ici dimanche, chaîne par chaîne</summary>
      <ul>
        {budgets.map((budget) => (
          <li key={budget.originKey}>
            <strong>{budget.originName}</strong>
            <span>
              {/* Une chaîne dont rien ne peut venir d'ici dimanche le dit, sans eau mobilisable (points ouverts 52 et 53, D-088). */}
              {budget.unavailable
                ? 'indisponible cette semaine, aucune eau mobilisable'
                : budget.availableCubicMeters === null ? 'eau mobilisable inconnue' : `${formatVolume(budget.availableCubicMeters)} mobilisables`} pour {budgetDemandText(budget, formatVolume)}
              {budget.dailyLimitRemainingCubicMeters !== null ? ` · limite journalière : ${formatVolume(budget.dailyLimitRemainingCubicMeters)} restants` : ''}
              {/* La part visée et la part placée de chaque niveau, « — » sans demande (décision 2 de la 3.9, D-052). */}
              {` · ${budgetLevelsText(budget)}`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Les planches non servies, repliées par défaut derrière leur titre et leur
 * flèche (demande du porteur du 8 novembre 2026), rangées par motif, le plus
 * gros groupe d'abord (audit ergonomique, lot 3, point 5, cas 2). Les
 * planches qu'aucun matériel n'arrose sont dites en action vers « Matériel »,
 * au-dessus du pli, jamais comme un manque d'eau. Une liste vide dit en une
 * phrase que tout est servi.
 */
function UnplacedList({ beds, groups, season }: { beds: readonly PlanBedOutcome[]; groups: UnplacedGroups; season: number }) {
  if (beds.length === 0) {
    return (
      <div className="planning-unplaced">
        <h3>Planches non servies</h3>
        <p className="planning-empty">Toutes les planches qui ont un besoin sont servies en entier.</p>
      </div>
    );
  }
  return (
    <div className="planning-unplaced-wrap">
      {groups.noEquipment ? (
        <p className="planning-unplaced-action">
          <Icon name="rampe" />
          <span>{groups.noEquipment.lead} :</span>
          <a href={pageHref('materiel', { season })}>{groups.noEquipment.link}</a>
        </p>
      ) : null}
      <details className="planning-unplaced">
        <summary>
          <h3>{unplacedFoldLabel(beds.length)}</h3>
          <Icon name="fleche-bas" />
        </summary>
        <p className="planning-unplaced-caption">Chaque planche que le plan ne sert pas en entier, rangée par motif : aussi important que ce qui est placé.</p>
        {groups.groups.map((group) => (
          <section key={group.key} className="planning-unplaced-group" data-group={group.key} aria-label={group.title}>
            <h4>{group.title}</h4>
            {UNPLACED_GROUP_MEANING[group.key] ? <p className="planning-unplaced-meaning">{UNPLACED_GROUP_MEANING[group.key]}</p> : null}
            <table className="planning-table planning-unplaced-table">
              <thead>
                <tr><th scope="col">Planche</th><th scope="col">Jardin ou abri</th><th scope="col">Priorité</th><th scope="col">Besoin</th><th scope="col">Placé</th><th scope="col">Manque</th><th scope="col">Motif</th></tr>
              </thead>
              <tbody>
                {group.beds.map((bed) => (
                  <tr key={bed.bedId}>
                    <th scope="row">{bed.bedName}</th>
                    <td data-label="Jardin ou abri">{bed.plotName}</td>
                    <td data-label="Priorité">{priorityLabel(bed.priority)}</td>
                    <td data-label="Besoin">{mmLabel(bed.needMm)}</td>
                    <td data-label="Placé">{mmLabel(bed.placedMm)}</td>
                    <td data-label="Manque">{mmLabel(bed.deficitMm)}<FigureOrigin text={unplacedOrigin(bed)} /></td>
                    <td data-label="Motif" title={unplacedReasonsExpertNote(bed.reasons) ?? undefined}>{bed.reasons.length === 0 ? 'manque partiel, faute de place' : bedReasonLabels(bed).join(' ; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </details>
    </div>
  );
}

const mmFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
function mmLabel(value: number) {
  return `${mmFormatter.format(value)} mm`;
}
