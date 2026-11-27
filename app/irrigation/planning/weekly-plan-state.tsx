'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode, type RefObject } from 'react';
import { notifyFeasibilityChanged } from '@/lib/domain/feasibility-notifications';
import type { PlanBedOutcome, PlanEventNotice, StoredPlanSuggestion, StoredProposal, StoredWeeklyPlan } from '@/lib/domain/planning/contract';
import { planDays, proposedIds, summarizePlan, unplacedBeds, type PlanDay, type PlanSummary } from '@/lib/domain/planning/presentation';
import { waterReceivedWithoutShareMm } from '@/lib/domain/planning/shortage-reading';
import { planActionCounts, unplacedGroups, type UnplacedGroups } from '@/lib/domain/planning/action-summary';
import type { ProtectedSlot } from '@/lib/domain/planning/protected-slots';
import type { PlanningSettings } from '@/lib/domain/planning/settings';
import type { ProposalSoilNote } from '@/lib/domain/soil-reserve/proposal-soil';
import { millisecondsFromSeconds } from '@/lib/domain/units';
import { refusalMessage, refusalReplacement } from '@/lib/domain/planning/refusal-replacement';
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
import { ConfirmDialog } from '../shell/confirm-dialog';
import { useUrlIntent } from '../shell/url-intent';
import type { SuggestionFeedback } from './follow-up-blocks';
import type { ProposalFeedback } from './proposal-card';

/**
 * L'état du plan de la semaine, partagé par les morceaux de la page
 * « Semaine » (simplification, lot S4, PR 2) : la ligne du plan et
 * « Jour par jour » au premier niveau, « Le plan, chaîne par chaîne » et ses
 * réglages dans le détail. Un seul plan, une seule heure, les mêmes actions
 * serveur et les mêmes gardes qu'avant (docs/planning-contract.md,
 * « Interface (3.6) ») : seul l'endroit où chaque morceau se lit change.
 */

/** Les délais entre deux relectures après un événement, en secondes : un recalcul prend de quelques secondes à trois quarts de minute sur le site (point ouvert 34). */
const REFRESH_DELAYS_SECONDS = [1, 2, 3, 5, 8, 10, 10, 10];
/** Les signaux que les autres sections envoient après un événement de la règle 4 (3.7) ; le canal porte ceux des autres onglets. */
const REFRESH_SIGNALS = ['irrigation-events-changed', 'irrigation-needs-source-changed', 'irrigation-feasibility-source-changed'];
/** « Recalculer le plan » demandé d'ailleurs : la carte d'un arrosage en retard (3.7, règle 20), `?recalculer=1`, la ligne « Calcul approximatif ». */
export const PLAN_RECALCULATE_REQUESTED = 'planning-recalculate-requested';

export type WeeklyPlanState = {
  season: number;
  plan: StoredWeeklyPlan | null;
  now: Date;
  pending: boolean;
  notice: string | null;
  error: string | null;
  feedback: Record<string, ProposalFeedback>;
  suggestionFeedback: Record<string, SuggestionFeedback>;
  settings: PlanningSettings;
  protectedSlots: ProtectedSlot[];
  soilNotes: Record<string, ProposalSoilNote[]>;
  repartitionHref: string | null;
  days: PlanDay[];
  summary: PlanSummary | null;
  unplaced: PlanBedOutcome[];
  groups: UnplacedGroups;
  received: ReadonlyMap<string, number | null>;
  actions: ReturnType<typeof planActionCounts> | null;
  /** Les créneaux de la semaine qui attendent leur validation, pour « Valider toute la semaine (n) ». */
  weekProposed: string[];
  compute: () => void;
  validate: (proposalIds: string[]) => void;
  adjust: (proposalId: string, startAt: string, doseMm: number) => void;
  /** Demande la confirmation du refus (D-030 ; lot G, n° 7, F411). */
  askRefuse: (proposalId: string) => void;
  applySuggestion: (suggestion: StoredPlanSuggestion) => void;
  keepSuggestion: (suggestion: StoredPlanSuggestion) => void;
};

const WeeklyPlanContext = createContext<WeeklyPlanState | null>(null);

/** L'état du plan ; `null` hors du fournisseur, quand la ferme n'a pas coché « Planning de la semaine ». */
export function useWeeklyPlan(): WeeklyPlanState | null {
  return useContext(WeeklyPlanContext);
}

type ProviderProps = {
  season: number;
  initialNowIso: string;
  initialPlan: StoredWeeklyPlan | null;
  initialSettings: PlanningSettings;
  /** Les créneaux protégés de l'exploitation, dans le pli des réglages (3.8 ter, section 7). */
  initialProtectedSlots: ProtectedSlot[];
  /** La dose au-delà de ce que le sol retient, par proposition, calculée au chargement de la page (5 ter, PR 3d). */
  soilNotes?: Record<string, ProposalSoilNote[]>;
  /** L'écran de répartition de « Ressources », ou rien sans la faisabilité (audit final, lot B, R4, F247). */
  repartitionHref?: string | null;
  children: ReactNode;
};

/**
 * Le fournisseur de l'état du plan : il appelle les actions du moteur et
 * relit le plan après un événement ; les regroupements et les comptes
 * viennent de `lib/domain/planning/`.
 */
export function WeeklyPlanProvider({ season, initialNowIso, initialPlan, initialSettings, initialProtectedSlots, soilNotes = {}, repartitionHref = null, children }: ProviderProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [now, setNow] = useState(() => new Date(initialNowIso));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, ProposalFeedback>>({});
  const [suggestionFeedback, setSuggestionFeedback] = useState<Record<string, SuggestionFeedback>>({});
  const [pending, startTransition] = useTransition();
  const planRef = useRef(initialPlan);
  useEffect(() => { planRef.current = plan; }, [plan]);
  // Les créneaux refusés qui attendent le recalcul pour dire où leur besoin est allé (lot G, n° 7, F412).
  const refusals = useRef(new Map<string, StoredProposal>());
  const [refusing, setRefusing] = useState<string | null>(null);
  const receiveRecalculated = useCallback((recalculated: StoredWeeklyPlan | null) => {
    setNow(new Date());
    setPlan(recalculated);
    if (!recalculated) return;
    for (const [proposalId, refused] of refusals.current) {
      const replacement = refusalReplacement(refused, recalculated);
      if (replacement === undefined) continue;
      refusals.current.delete(proposalId);
      setFeedback((current) => ({ ...current, [proposalId]: { ok: true, message: refusalMessage(replacement) } }));
    }
  }, []);
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
    const handler = () => compute();
    window.addEventListener(PLAN_RECALCULATE_REQUESTED, handler);
    return () => window.removeEventListener(PLAN_RECALCULATE_REQUESTED, handler);
  });
  // Un arrosage en retard renvoie ici avec `?recalculer=1` (docs/replanning-contract.md) : un calcul à la demande, une fois.
  useUrlIntent('recalculer', () => compute());
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
    setRefusing(null);
    const refused = planRef.current?.proposals.find((proposal) => proposal.storedId === proposalId);
    const result = await refusePlanProposalAction({ season, proposalId });
    setNow(new Date());
    if (!result.ok) { setError(result.message); return; }
    setPlan(result.plan);
    if (result.refused && refused) refusals.current.set(proposalId, refused);
    setFeedback((current) => ({ ...current, [proposalId]: { ok: true, message: result.refused ? 'Créneau refusé. Le plan se recalcule pour replacer le besoin…' : 'Cette proposition avait déjà été décidée.' } }));
    setNotice(null);
    setError(null);
    // Un refus est un événement : le serveur recalcule après sa réponse, la section relit le plan quand il est prêt (3.7).
    if (result.refused) refreshAfterEvent();
  });

  const days = useMemo(() => (plan ? planDays(plan, now) : []), [plan, now]);
  const summary = useMemo(() => (plan ? summarizePlan(plan, now) : null), [plan, now]);
  const unplaced = useMemo(() => (plan ? unplacedBeds(plan) : []), [plan]);
  const groups = useMemo(() => unplacedGroups(unplaced), [unplaced]);
  // L'eau qu'une planche non servie reçoit quand même du matériel de ses voisines (remarque 2 de la recette 3.9, F254).
  const received = useMemo(() => new Map(plan ? unplaced.map((bed) => [bed.bedId, waterReceivedWithoutShareMm(plan, bed, now)] as const) : []), [plan, unplaced, now]);
  const actions = useMemo(() => (plan && summary ? planActionCounts(plan, summary, initialSettings.lateToleranceMinutes, now) : null), [plan, summary, initialSettings.lateToleranceMinutes, now]);
  const weekProposed = plan ? proposedIds(plan.proposals, now) : [];

  const state: WeeklyPlanState = {
    season, plan, now, pending, notice, error, feedback, suggestionFeedback,
    settings: initialSettings, protectedSlots: initialProtectedSlots, soilNotes, repartitionHref,
    days, summary, unplaced, groups, received, actions, weekProposed,
    compute, validate, adjust, askRefuse: setRefusing, applySuggestion, keepSuggestion,
  };
  return (
    <WeeklyPlanContext.Provider value={state}>
      {children}
      {/* « Refuser » se confirme : un refus vaut pour toute la semaine (D-030 ; lot G, n° 7, F411). */}
      <ConfirmDialog
        open={refusing !== null}
        title="Refuser ce créneau pour toute la semaine ?"
        confirmLabel="Refuser le créneau"
        cancelLabel="Garder la proposition"
        tone="erase"
        pending={pending}
        onConfirm={() => refusing && refuse(refusing)}
        onCancel={() => setRefusing(null)}
      >
        <p>Ce matériel ne sera plus proposé à ces heures cette semaine ; le besoin sera replacé ailleurs si c’est possible.</p>
      </ConfirmDialog>
    </WeeklyPlanContext.Provider>
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
