'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import { proposedIds } from '@/lib/domain/planning/presentation';
import { shortageAction } from '@/lib/domain/planning/shortage-reading';
import { TIMER_AWAITING_LINE, timerAwaiting, weekForecastUnavailable } from '@/lib/domain/semaine/week-detail';
import type { WeekDayEvent } from '@/lib/domain/semaine/week-days';
import { WEEK_PAGE_GARDENS_SHOWN, weekGardens } from '@/lib/domain/semaine/week-gardens';
import { weekHeading, type WeekHeading } from '@/lib/domain/semaine/week-heading';
import { weekBilan, weekSentence } from '@/lib/domain/semaine/week-sentence';
import { APPROXIMATE_TITLE, type TodayApproximate } from '@/lib/domain/today/essential';
import { todayWeek, todayWeekInputs } from '@/lib/domain/today/week';
import { readTodayApproximateAction } from '../today-actions';
import { ReliabilityAction } from '../today/reliability-zone';
import { formatVolume } from '../planning/format';
import { PlanLine, PlanShortage } from '../planning/weekly-plan-view';
import { PLAN_RECALCULATE_REQUESTED, useWeeklyPlan } from '../planning/weekly-plan-state';
import { loadWeekEventsAction } from './week-actions';
import { WEEK_NEEDS_READ, WEEK_WATER_READ, useWeekReading, type WeekNeeds, type WeekWater } from './week-signals';
import { WeekDays } from './week-days';
import { WeekBilanCard, WeekGardensList, openGoals } from './week-summary';
import { BILAN_ORIGIN, useWeekRain, type WeekRain } from './week-rain';
import { WaterSummaryTiles } from '../water-summary-tiles';

/** L'ancre du pli des objectifs, où « Poser un objectif » mène (section 7.1, n° 3). */
const GOALS_ANCHOR = 'objectifs-de-la-semaine';

/**
 * Le premier niveau de la vue « La semaine » (simplification, lot S4, PR 2,
 * docs/simplification-s4-contract.md, section 4), de haut en bas : les
 * flèches et le titre, la ligne du plan, la phrase, l'encadré d'attention
 * quand il y a lieu, le bilan, « Jour par jour », « Jardin par jardin ».
 * Tout ce qui n'y est pas est dans « Le détail », dessous. Les chiffres sont
 * ceux des tableaux de la semaine, relus par leurs sections après un geste
 * (`week-signals.ts`) ; le plan est celui du planning (`WeeklyPlanProvider`).
 */
export function WeekFirstLevel({ season, currentSeason, today, query, initialWater, initialNeeds, initialEvents, rainMatters }: {
  season: number;
  /** La saison d'aujourd'hui : une autre saison dit son année dans le titre. */
  currentSeason: number;
  /** Le jour de la ferme, lu par le serveur avec la page. */
  today: string;
  query: PageQuery;
  initialWater: WeekWater;
  initialNeeds: WeekNeeds;
  initialEvents: WeekDayEvent[];
  rainMatters: boolean;
}) {
  const water = useWeekReading(WEEK_WATER_READ, initialWater);
  const needs = useWeekReading(WEEK_NEEDS_READ, initialNeeds);
  const events = useWeekEvents(season, initialWater.weekStart, initialEvents);
  const heading = weekHeading({ weekStart: initialWater.weekStart, today, season, currentSeason });
  const weekly = useWeeklyPlan();
  const current = heading.state === 'current';
  const planShown = weekly?.plan && current && weekly.plan.calculation.weekStart === heading.weekStart ? weekly : null;
  const toValidate = planShown?.plan ? proposedIds(planShown.plan.proposals, planShown.now).length : 0;
  const week = useMemo(() => todayWeek(todayWeekInputs(water, needs, today), new Set(), WEEK_PAGE_GARDENS_SHOWN), [water, needs, today]);
  const sentence = weekSentence({ state: heading.state, farm: week?.farm ?? null, forecastRainMm: water.days.map((day) => day.forecastRainMm), rainMatters, toValidate });
  // L'encadré ne paraît que s'il a une ligne : un plan sans pénurie n'y met rien.
  const shortage = planShown?.plan ? shortageAction(planShown.plan, formatVolume, planShown.now) !== null : false;
  const approximate = useApproximate(current);
  const timer = timerAwaiting(water.days, water.todayWater);
  const forecast = current ? weekForecastUnavailable(water.days, today, rainMatters) : null;
  const rain = useWeekRain();
  // « Noter la pluie » du bilan (8.3) : pas pour une semaine qui n'a pas commencé.
  const bilanRain = rain && heading.state !== 'upcoming' ? { open: () => rain.open(BILAN_ORIGIN), pending: rain.pending, reply: rain.reply(BILAN_ORIGIN) } : null;
  return (
    <div className="week-first-level">
      <WeekNavigation heading={heading} query={query} currentSeason={currentSeason} />
      {weekly && current ? <PlanLine /> : null}
      <p className="week-sentence">
        {sentence}
        {week === null || week.farm.objectiveMm === null ? <> <a href={`#${GOALS_ANCHOR}`} onClick={(event) => openGoals(event, `#${GOALS_ANCHOR}`)}>Poser un objectif</a></> : null}
      </p>
      {current && (shortage || approximate || timer || forecast) ? (
        <div className="week-attention">
          {shortage ? <PlanShortage /> : null}
          {approximate ? <ApproximateLine approximate={approximate} query={query} pending={weekly?.pending ?? false} rain={rain} /> : null}
          {timer ? <p className="week-attention-line" role="note">{TIMER_AWAITING_LINE}</p> : null}
          {forecast ? <p className="week-attention-line" role="note">{forecast}</p> : null}
        </div>
      ) : null}
      {week ? (
        <WeekBilanCard
          bilan={weekBilan(week)}
          goalsHref={`#${GOALS_ANCHOR}`}
          tiles={<WaterSummaryTiles dashboard={water} farmObjective={needs.farmObjective ?? null} today={today} />}
          rain={bilanRain}
        />
      ) : null}
      <WeekDays weekStart={heading.weekStart} today={today} state={heading.state} days={water.days} events={events} rainMatters={rainMatters} query={query} />
      {week ? <WeekGardensList gardens={weekGardens(week)} goalsHref={`#${GOALS_ANCHOR}`} /> : null}
    </div>
  );
}

/**
 * Les flèches et le titre (section 4, point 1) : « ‹ Cette semaine › » et,
 * dessous, « du lundi 15 au dimanche 21 juin ». Les flèches changent de
 * semaine sans quitter la page (section 8.4, PR 3) : un lien du routeur, que
 * le serveur rend sans recharger la page ; l'adresse dit la semaine (S4-g),
 * le rechargement, le bouton retour et un lien envoyé la retrouvent.
 * « Cette semaine » n'existe qu'ailleurs (F470).
 */
function WeekNavigation({ heading, query, currentSeason }: { heading: WeekHeading; query: PageQuery; currentSeason: number }) {
  const href = (week: string, season = query.season) => pageHref('semaine', { season, zone: query.zone, week });
  return (
    <nav className="week-navigation" aria-label="Changer de semaine">
      <Link className="week-arrow" href={href(heading.previous)} prefetch={false} aria-label="Semaine précédente">‹</Link>
      <div className="week-navigation-title">
        <h2 className="week-title">{heading.title}</h2>
        <p className="week-range">{heading.range}</p>
      </div>
      <Link className="week-arrow" href={href(heading.next)} prefetch={false} aria-label="Semaine suivante">›</Link>
      {/* Un raccourci, pas le geste de la page : en secondaire (audit du 19 novembre 2026, lot K, n° 21, F470). */}
      {heading.thisWeek ? <Link className="week-this-week" href={href(heading.thisWeek, currentSeason)} prefetch={false}>Cette semaine</Link> : null}
    </nav>
  );
}

/** Les réponses de « Noter la pluie », sous le geste qui a ouvert la fenêtre. */
const RAIN_APPROXIMATE = 'pluie-approximatif';

/**
 * Une seule ligne « Calcul approximatif » (section 4, point 3) : la première
 * donnée qui manque, dans l'ordre d'« Aujourd'hui », avec son geste existant,
 * et « + n autres » vers « Fiabilité du calcul » d'« Aujourd'hui ». « Noter la
 * pluie » ouvre la fenêtre de S2 (section 8.3, PR 3).
 */
function ApproximateLine({ approximate, query, pending, rain }: { approximate: TodayApproximate; query: PageQuery; pending: boolean; rain: WeekRain | null }) {
  return (
    <section className="today-essential-line week-attention-line" data-tone="warn" aria-labelledby="week-approximate-title">
      <p className="today-essential-line-text">
        <strong id="week-approximate-title">{APPROXIMATE_TITLE}</strong> {approximate.line.text}
      </p>
      <div className="today-essential-actions">
        <ReliabilityAction
          line={approximate.line}
          query={query}
          pending={pending}
          onRecalculatePlan={() => window.dispatchEvent(new CustomEvent(PLAN_RECALCULATE_REQUESTED))}
          onOpenRain={rain ? () => rain.open(RAIN_APPROXIMATE) : undefined}
        />
        {approximate.othersLabel ? <a className="today-action-link" href={pageHref('aujourdhui', { season: query.season, zone: query.zone }, 'today-reliability')}>{approximate.othersLabel}</a> : null}
      </div>
      {rain?.reply(RAIN_APPROXIMATE)}
    </section>
  );
}

/** La ligne « Calcul approximatif » de la semaine en cours, lue après l'affichage (section 3.4) ; ailleurs, rien. */
function useApproximate(current: boolean): TodayApproximate | null {
  const [approximate, setApproximate] = useState<TodayApproximate | null>(null);
  useEffect(() => {
    if (!current) return;
    let alive = true;
    const read = () => void readTodayApproximateAction().then((line) => { if (alive) setApproximate(line); });
    read();
    // Une pluie notée, un plan recalculé : la ligne se relit.
    const signals = ['irrigation-needs-source-changed', 'irrigation-events-changed'];
    signals.forEach((name) => window.addEventListener(name, read));
    return () => { alive = false; signals.forEach((name) => window.removeEventListener(name, read)); };
  }, [current]);
  return approximate;
}

/** Les irrigations de la semaine affichée, relues après un geste qui en change une. */
function useWeekEvents(season: number, weekStart: string, initial: WeekDayEvent[]): WeekDayEvent[] {
  const [events, setEvents] = useState(initial);
  useEffect(() => {
    let alive = true;
    const read = () => void loadWeekEventsAction({ season, weekStart }).then((next) => { if (alive && next) setEvents(next); });
    window.addEventListener('irrigation-events-changed', read);
    return () => { alive = false; window.removeEventListener('irrigation-events-changed', read); };
  }, [season, weekStart]);
  return events;
}
