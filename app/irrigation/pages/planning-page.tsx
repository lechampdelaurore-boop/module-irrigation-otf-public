'use client';

import type { ProposalSoilNote } from '@/lib/domain/soil-reserve/proposal-soil';
import type { StoredWeeklyPlan } from '@/lib/domain/planning/contract';
import type { ProtectedSlot } from '@/lib/domain/planning/protected-slots';
import type { PlanningSettings } from '@/lib/domain/planning/settings';
import { pagePath } from '@/lib/domain/features/pages';
import { WeeklyPlanView } from '../planning/weekly-plan-view';
import { hrefWithIntent, useUrlIntent } from '../shell/url-intent';

/**
 * La page « Planning de la semaine » (3.8, docs/feature-selection-contract.md,
 * section 5). « Ajouter un créneau à la main » ouvre le formulaire de la page
 * des arrosages ; un arrosage en retard y renvoie avec `?recalculer=1`.
 */
export function PlanningPage({
  season,
  initialNowIso,
  weeklyPlan,
  planningSettings,
  protectedSlots,
  soilNotes,
}: {
  season: number;
  initialNowIso: string;
  weeklyPlan: StoredWeeklyPlan | null;
  planningSettings: PlanningSettings;
  protectedSlots: ProtectedSlot[];
  soilNotes: Record<string, ProposalSoilNote[]>;
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
      onAddManualSlot={() => window.location.assign(hrefWithIntent(pagePath('arrosages'), season, 'planifier', '1'))}
    />
  );
}
