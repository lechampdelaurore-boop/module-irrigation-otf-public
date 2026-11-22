'use client';

import type { ProposalSoilNote } from '@/lib/domain/soil-reserve/proposal-soil';
import type { StoredWeeklyPlan } from '@/lib/domain/planning/contract';
import type { ProtectedSlot } from '@/lib/domain/planning/protected-slots';
import type { PlanningSettings } from '@/lib/domain/planning/settings';
import { pagePath } from '@/lib/domain/features/pages';
import type { AppliedWaterGapView } from '@/lib/services/applied-water-gap';
import { AppliedWaterGapBlock } from '../planning/applied-water-gap-block';
import { WeeklyPlanView } from '../planning/weekly-plan-view';
import { hrefWithIntent, useUrlIntent } from '../shell/url-intent';

/**
 * La page « Planning de la semaine » (3.8, docs/feature-selection-contract.md,
 * section 5). « Ajouter un créneau à la main » ouvre le formulaire de la page
 * des arrosages ; un arrosage en retard y renvoie avec `?recalculer=1`.
 * L'écart du prévu des trois semaines passées (amélioration n° 5) suit les
 * suggestions du plan, quand une planche a un signal.
 */
export function PlanningPage({
  season,
  initialNowIso,
  weeklyPlan,
  planningSettings,
  protectedSlots,
  soilNotes,
  repartitionHref,
  waterGap,
  rainHref,
}: {
  season: number;
  initialNowIso: string;
  weeklyPlan: StoredWeeklyPlan | null;
  planningSettings: PlanningSettings;
  protectedSlots: ProtectedSlot[];
  soilNotes: Record<string, ProposalSoilNote[]>;
  /** L'écran de répartition de « Ressources », ou rien quand la ferme n'a pas coché la faisabilité (lot B, R4). */
  repartitionHref: string | null;
  /** L'écart du prévu des trois dernières semaines ; `null` quand sa lecture a échoué : le planning reste. */
  waterGap: AppliedWaterGapView | null;
  /** La saisie de la pluie mesurée, quand la ferme a coché « Objectifs et besoins ». */
  rainHref: string | null;
}) {
  useUrlIntent('recalculer', () => window.dispatchEvent(new CustomEvent('planning-recalculate-requested')));
  return (
    <WeeklyPlanView
      season={season}
      initialNowIso={initialNowIso}
      initialPlan={weeklyPlan}
      initialSettings={planningSettings}
      initialProtectedSlots={protectedSlots}
      soilNotes={soilNotes}
      repartitionHref={repartitionHref}
      onAddManualSlot={() => window.location.assign(hrefWithIntent(pagePath('arrosages'), season, 'planifier', '1'))}
      followUp={waterGap ? <AppliedWaterGapBlock season={season} initialView={waterGap} rainHref={rainHref} /> : null}
    />
  );
}
