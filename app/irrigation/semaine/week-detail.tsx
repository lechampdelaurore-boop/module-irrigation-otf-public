'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { GAP_SECTION_FAILED, gapSectionLine, PLAN_CURRENT_WEEK_ONLY, WEEK_DETAIL_ANCHOR, WEEK_SECTION_TITLES } from '@/lib/domain/semaine/week-detail';
import { PLAN_SECTION_ANCHOR, type WeekSectionId } from '@/lib/domain/features/week-page';
import type { AppliedWaterGapView } from '@/lib/services/applied-water-gap';
import { AnchoredFold } from '../shell/page-settings-fold';
import { AppliedWaterGapBlock } from '../planning/applied-water-gap-block';
import { PlanDetail, planDetailLine } from '../planning/weekly-plan-view';
import { useWeeklyPlan } from '../planning/weekly-plan-state';
import { readAppliedWaterGapAction } from './week-actions';

/**
 * « Le détail » de la vue « La semaine » (simplification, lot S4, PR 2,
 * docs/simplification-s4-contract.md, section 7) : un seul pli, fermé, dont
 * la ligne dit ce qu'il contient ; chaque section y est un pli fermé avec sa
 * ligne. Les plis suivent le mécanisme `AnchoredFold` : une ancre qui vise
 * un élément du détail ouvre ce pli, celui de sa section et le sien
 * (section 7.4). Rien n'est retiré des trois anciennes pages.
 */
export function WeekDetail({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <AnchoredFold
      id={WEEK_DETAIL_ANCHOR}
      className="week-detail"
      bodyClassName="week-detail-body"
      summary={<><strong>Le détail</strong><small>{summary}</small></>}
    >
      {children}
    </AnchoredFold>
  );
}

/** Une section du détail, un pli fermé : son titre et sa ligne de résumé. */
export function WeekDetailSection({ id, section, line, onOpen, children }: { id: string; section: WeekSectionId; line: string; onOpen?: () => void; children: ReactNode }) {
  return (
    <AnchoredFold
      id={id}
      className="week-detail-section"
      bodyClassName="week-detail-section-body"
      summary={<><h3>{WEEK_SECTION_TITLES[section]}</h3><small>{line}</small></>}
      onOpen={onOpen}
    >
      {children}
    </AnchoredFold>
  );
}

/** L'ancre de la section « Écart du prévu des trois dernières semaines ». */
const GAP_SECTION_ANCHOR = 'ecart-du-prevu';

/**
 * « Écart du prévu des trois dernières semaines » (section 7.1, n° 7), lu à
 * la première ouverture de son pli, par la personne ou par une ancre, et non
 * plus à l'ouverture de la page (section 3.4, promesse de F918). Le bloc
 * « L'eau apportée s'écarte du prévu » ne paraît que lorsqu'une planche a un
 * signal (F735) ; sinon une ligne le dit. Une lecture échouée se relit.
 */
export function WaterGapSection({ season, rainHref }: { season: number; rainHref: string }) {
  const [view, setView] = useState<AppliedWaterGapView | 'failed' | null>(null);
  const [pending, startTransition] = useTransition();
  const read = () => {
    if (pending || (view !== null && view !== 'failed')) return;
    startTransition(async () => setView(await readAppliedWaterGapAction({ season }) ?? 'failed'));
  };
  const gap = view !== null && view !== 'failed' ? view : null;
  return (
    <WeekDetailSection id={GAP_SECTION_ANCHOR} section="ecart-du-prevu" line={gap ? gapSectionLine(gap.gaps.length) : gapSectionLine(null)} onOpen={read}>
      {pending ? <p className="week-detail-reading" role="status">Lecture de l’écart du prévu…</p> : null}
      {!pending && view === 'failed' ? (
        <p className="planning-error" role="alert">
          {GAP_SECTION_FAILED}{' '}
          <button type="button" className="week-detail-retry" onClick={read}>Relire</button>
        </p>
      ) : null}
      {gap && gap.gaps.length === 0 ? <p className="week-detail-empty">{gapSectionLine(0)} sur les trois dernières semaines.</p> : null}
      {/* « Saisir la pluie mesurée » (amélioration n° 5, F734, point 3) : le pli de la pluie mesurée, plus haut dans le détail. */}
      {gap && gap.gaps.length > 0 ? <AppliedWaterGapBlock season={season} initialView={gap} rainHref={rainHref} /> : null}
    </WeekDetailSection>
  );
}

/**
 * « Le plan, chaîne par chaîne » (section 7.1, n° 2), pour la semaine en
 * cours ; pour une autre semaine, la ligne dit que le plan ne la couvre pas
 * (S4-l) et la section garde le plan de la semaine en cours.
 */
export function PlanDetailSection({ current }: { current: boolean }) {
  const state = useWeeklyPlan();
  if (!state) return null;
  return (
    <WeekDetailSection id={PLAN_SECTION_ANCHOR} section="plan" line={current ? planDetailLine(state) : `${PLAN_CURRENT_WEEK_ONLY} ${planDetailLine(state)}`}>
      <PlanDetail />
    </WeekDetailSection>
  );
}
