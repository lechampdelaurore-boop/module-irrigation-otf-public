'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import { dayRowLayout, type TodayBlock, type TodayView } from '@/lib/domain/today/today-view';
import { millisecondsFromMinutes, millisecondsFromSeconds } from '@/lib/domain/units';
import { recordDoneAsPlannedAction } from '../done-as-planned-actions';
import { startIrrigationEventAction } from '../irrigation-event-actions';
import { computeWeeklyPlanAction } from '../planning-actions';
import { announceTodayBadge } from '../shell/today-badge';
import { loadTodayViewAction } from '../today-actions';
import { ReliabilityZoneView } from './reliability-zone';
import { TodayDay } from './today-day';
import { TodayHeader } from './today-header';
import { TodaySoilBlock, TodayWaterBlockView, TodayWeekWater } from './today-gauges';
import { TodayWeather } from './today-weather';
import { TodayWeekTiles } from './today-week';

/** La page se relit seule toutes les cinq minutes, et au retour sur l'onglet après une minute (F438). */
const TODAY_REFRESH_MS = millisecondsFromMinutes(5);
const TODAY_REFRESH_SLACK_MS = millisecondsFromSeconds(5);
const TODAY_RETURN_MS = millisecondsFromMinutes(1);

/**
 * La page « Aujourd'hui », tableau de bord du module
 * (docs/aujourdhui-tableau-de-bord-contract.md, section 3.2) : l'en-tête qui
 * résume le jour, les chiffres de la semaine, puis les blocs en grille, chacun
 * présent seulement si sa case est cochée. Un bloc sans rien à dire le dit en
 * une phrase calme. La page ne contient ni formulaire ni calcul : ses boutons
 * sont les actions existantes « Démarrer maintenant » et « Recalculer le
 * plan », et « Tout est fait » (section 3.4) ; elle se relit après chacun,
 * et d'elle-même au fil des minutes (lot H, F438).
 */
export function TodayPage({ initialView, query }: { initialView: TodayView; query: PageQuery }) {
  const [view, setView] = useState(initialView);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ text: string; arrosages: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Les irrigations que « Tout est fait » n'a pas pu enregistrer, chacune avec son nom et sa raison. */
  const [refused, setRefused] = useState<string[]>([]);
  // La saison du jour (F2) : les liens vers les cartes et les données du jour la portent.
  const season = Number(view.today.slice(0, 4));
  const dayQuery: PageQuery = { ...query, season };

  const readAt = useRef(0);
  const reload = async () => {
    readAt.current = Date.now();
    const result = await loadTodayViewAction();
    if (!result.ok) return;
    setView(result.view);
    announceTodayBadge(result.view.badge);
  };
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  });

  // La page se relit seule (audit du 19 novembre 2026, lot H, n° 13, F438) :
  // toutes les cinq minutes à l'écran, et au retour sur l'onglet quand sa
  // lecture a plus d'une minute ; jamais pendant un geste, ni quand une
  // fenêtre de la page est ouverte.
  useEffect(() => {
    readAt.current = Date.now();
    const quiet = () => document.visibilityState === 'visible' && !document.querySelector('.today-page[aria-busy="true"], .today-page dialog[open], .today-page [role="dialog"]');
    const refresh = (olderThanMs: number) => {
      if (!quiet() || Date.now() - readAt.current < olderThanMs) return;
      void reloadRef.current();
    };
    const timer = window.setInterval(() => refresh(TODAY_REFRESH_MS - TODAY_REFRESH_SLACK_MS), TODAY_REFRESH_MS);
    const onVisible = () => refresh(TODAY_RETURN_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const start = (eventEquipmentId: string) => startTransition(async () => {
    const result = await startIrrigationEventAction(eventEquipmentId);
    setRefused([]);
    if (result.ok) {
      setNotice({ text: result.warning ? `${result.message} ${result.warning}` : result.message, arrosages: true });
      setError(null);
    } else {
      setError(result.message);
      setNotice(null);
    }
    await reload();
  });

  // « Tout est fait » (section 3.4) : le message dit combien sont enregistrées, et nomme chaque refus.
  const recordAllDone = (eventEquipmentIds: string[]) => new Promise<void>((resolve) => startTransition(async () => {
    try {
      const result = await recordDoneAsPlannedAction({ eventEquipmentIds });
      if (result.ok) {
        setNotice(result.recorded > 0 ? { text: result.message, arrosages: false } : null);
        setRefused(result.refused.map((item) => `${item.title} : ${item.reason}`));
        setError(result.recorded > 0 ? null : result.message);
      } else {
        setError(result.message);
        setRefused([]);
        setNotice(null);
      }
      await reload();
    } finally {
      resolve();
    }
  }));

  const recalculatePlan = () => startTransition(async () => {
    const result = await computeWeeklyPlanAction({ season });
    setRefused([]);
    if (result.ok) {
      setNotice({ text: 'Plan calculé.', arrosages: false });
      setError(null);
    } else {
      setError(result.message);
      setNotice(null);
    }
    await reload();
  });

  const block = <K extends TodayBlock['kind']>(kind: K) => view.blocks.find((item): item is Extract<TodayBlock, { kind: K }> => item.kind === kind) ?? null;
  const weather = block('weather');
  const late = block('late');
  const todo = block('todo');
  const water = block('water');
  const reliability = block('reliability');

  return (
    <div className="today-page" aria-busy={pending}>
      <TodayHeader
        headline={view.headline}
        plan={view.plan}
        shortage={view.shortage}
        query={dayQuery}
        pending={pending}
        onRecalculatePlan={recalculatePlan}
      />
      {notice ? (
        <p className="today-notice" role="status">
          {notice.text}
          {notice.arrosages ? <> <a href={pageHref('arrosages', dayQuery)}>Suivre sur « Arrosages »</a></> : null}
        </p>
      ) : null}
      {error ? <p className="today-error" role="alert">{error}</p> : null}
      {refused.length > 0 ? (
        <div className="today-error" role="alert">
          <p>{refused.length > 1 ? 'Non enregistrées :' : 'Non enregistrée :'}</p>
          <ul>{refused.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      ) : null}
      {view.week ? <TodayWeekTiles week={view.week} query={dayQuery} /> : null}
      <Pair
        wide={late && todo ? <TodayDay today={view.today} current={view.current} late={late} todo={todo} tomorrow={view.tomorrow} timeline={view.timeline} allDone={view.allDone} query={dayQuery} pending={pending} onStart={start} onAllDone={recordAllDone} /> : null}
        narrow={weather ? <TodayWeather block={weather} query={dayQuery} /> : null}
        layout={late && todo ? dayRowLayout(late.lines.length + view.current.length, todo.lines.length) : 'wide'}
      />
      <Pair
        wide={view.week ? <TodayWeekWater week={view.week} query={dayQuery} /> : null}
        narrow={view.soil ? <TodaySoilBlock soil={view.soil} query={dayQuery} /> : null}
        layout="split"
      />
      <Pair
        wide={water ? <TodayWaterBlockView block={water} query={dayQuery} /> : null}
        narrow={reliability ? <ReliabilityZoneView zone={reliability.zone} checks={reliability.checks} byBed={reliability.byBed} query={dayQuery} pending={pending} onRecalculatePlan={recalculatePlan} /> : null}
        layout="half"
      />
    </div>
  );
}

/**
 * Deux blocs côte à côte à l'ordinateur : deux tiers et un tiers (`wide`),
 * sept et cinq douzièmes (`split`), moitié-moitié (`half`), l'un sous l'autre
 * (`stack`, une journée courte, J13). Un seul présent
 * prend toute la largeur ; aucun, rien.
 */
function Pair({ wide, narrow, layout }: { wide: ReactNode; narrow: ReactNode; layout: 'wide' | 'split' | 'half' | 'stack' }) {
  if (!wide && !narrow) return null;
  return (
    <div className="today-row" data-layout={wide && narrow ? layout : 'single'}>
      {wide}
      {narrow}
    </div>
  );
}
