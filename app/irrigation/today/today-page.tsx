'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from 'react';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import { dayRowLayout, type TodayBlock, type TodayView } from '@/lib/domain/today/today-view';
import { millisecondsFromMinutes, millisecondsFromSeconds } from '@/lib/domain/units';
import { recordDoneAsPlannedAction } from '../done-as-planned-actions';
import { startIrrigationEventAction } from '../irrigation-event-actions';
import { computeWeeklyPlanAction } from '../planning-actions';
import { actionReply, type ActionReplyMessage } from '../shell/action-reply';
import { announceTodayBadge } from '../shell/today-badge';
import { loadTodayViewAction } from '../today-actions';
import { ReliabilityZoneView } from './reliability-zone';
import { TodayDay } from './today-day';
import { TodayHeader } from './today-header';
import { TodaySoilBlock, TodayWaterBlockView, TodayWeekWater } from './today-gauges';
import { TodayWeather } from './today-weather';
import { TodayWeekTiles } from './today-week';
import { irrigationReply, PLAN_HEADER_REPLY, PLAN_RELIABILITY_REPLY } from './today-replies';

/** La page se relit seule toutes les cinq minutes, et au retour sur l'onglet après une minute (F438). */
const TODAY_REFRESH_MS = millisecondsFromMinutes(5);
const TODAY_REFRESH_SLACK_MS = millisecondsFromSeconds(5);
const TODAY_RETURN_MS = millisecondsFromMinutes(1);
/** La largeur de page sous laquelle « Aujourd'hui » est au téléphone : la borne de ses requêtes de conteneur. */
const TODAY_PHONE_MAX_PX = 620;

/**
 * La page est-elle au téléphone ? Lue sur sa propre largeur, comme ses
 * requêtes de conteneur, et relue quand elle change. Avant d'être lue, la
 * page se rend comme à l'ordinateur ; le dessin du téléphone remonte déjà
 * « Votre journée » par `order` (today.css), et le DOM suit ici, pour que
 * le clavier et le lecteur d'écran lisent dans l'ordre affiché (L6).
 */
function useTodayPhone(page: RefObject<HTMLDivElement | null>): boolean {
  const [phone, setPhone] = useState(false);
  useLayoutEffect(() => {
    const element = page.current;
    if (!element) return;
    const read = () => setPhone(element.getBoundingClientRect().width <= TODAY_PHONE_MAX_PX);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [page]);
  return phone;
}

/**
 * La page « Aujourd'hui », tableau de bord du module
 * (docs/aujourdhui-tableau-de-bord-contract.md, section 3.2) : l'en-tête qui
 * résume le jour, les chiffres de la semaine, puis les blocs en grille, chacun
 * présent seulement si sa case est cochée. Un bloc sans rien à dire le dit en
 * une phrase calme. La page ne contient ni formulaire ni calcul : ses boutons
 * sont les actions existantes « Démarrer maintenant » et « Recalculer le
 * plan », et « Tout est fait » (section 3.4) ; elle se relit après chacun,
 * et d'elle-même au fil des minutes (lot H, F438). La réponse d'un geste
 * s'écrit sous le bouton pressé, et à un seul endroit
 * (docs/aujourdhui-liens-contract.md, L4, D-313). Au téléphone, « Votre
 * journée » passe juste après l'en-tête, avant les tuiles de la semaine,
 * toujours (L6, D-315) ; à l'ordinateur, l'ordre ne change pas.
 */
export function TodayPage({ initialView, query }: { initialView: TodayView; query: PageQuery }) {
  const [view, setView] = useState(initialView);
  const [pending, startTransition] = useTransition();
  const pageRef = useRef<HTMLDivElement>(null);
  const phone = useTodayPhone(pageRef);
  /** La réponse du dernier geste, à l'endroit du bouton pressé ; un nouveau geste la remplace. */
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);
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

  // Démarrée, l'irrigation passe « En cours » : sa réponse la suit, sous sa nouvelle carte (L4, règle 2).
  const start = (eventEquipmentId: string) => startTransition(async () => {
    const origin = irrigationReply(eventEquipmentId);
    const result = await startIrrigationEventAction(eventEquipmentId);
    setReplies([result.ok
      ? actionReply(origin, 'notice', result.warning ? `${result.message} ${result.warning}` : result.message, { link: { href: pageHref('arrosages', dayQuery), label: 'Suivre sur « Arrosages »' } })
      : actionReply(origin, 'error', result.message)]);
    await reload();
  });

  // « Tout est fait » (section 3.4) : le message dit combien sont enregistrées, et nomme chaque refus.
  const recordAllDone = (eventEquipmentIds: string[], origin: string) => new Promise<void>((resolve) => startTransition(async () => {
    try {
      const result = await recordDoneAsPlannedAction({ eventEquipmentIds });
      if (result.ok) {
        const refused = result.refused.map((item) => `${item.title} : ${item.reason}`);
        setReplies([
          actionReply(origin, result.recorded > 0 ? 'notice' : 'error', result.message),
          ...(refused.length > 0 ? [actionReply(origin, 'error', refused.length > 1 ? 'Non enregistrées :' : 'Non enregistrée :', { lines: refused })] : []),
        ]);
      } else {
        setReplies([actionReply(origin, 'error', result.message)]);
      }
      await reload();
    } finally {
      resolve();
    }
  }));

  const recalculatePlan = (origin: string) => startTransition(async () => {
    const result = await computeWeeklyPlanAction({ season });
    setReplies([result.ok ? actionReply(origin, 'notice', 'Plan calculé.') : actionReply(origin, 'error', result.message)]);
    await reload();
  });

  const block = <K extends TodayBlock['kind']>(kind: K) => view.blocks.find((item): item is Extract<TodayBlock, { kind: K }> => item.kind === kind) ?? null;
  const weather = block('weather');
  const late = block('late');
  const todo = block('todo');
  const water = block('water');
  const reliability = block('reliability');

  // Des clés : la journée et les tuiles changent de place sans se recréer (L6).
  const tiles = view.week ? <TodayWeekTiles key="semaine" week={view.week} query={dayQuery} /> : null;
  const dayRow = (
    <Pair
      key="journee"
      wide={late && todo ? <TodayDay today={view.today} current={view.current} late={late} todo={todo} tomorrow={view.tomorrow} timeline={view.timeline} allDone={view.allDone} emptyLink={view.dayEmptyLink} query={dayQuery} pending={pending} replies={replies} onStart={start} onAllDone={recordAllDone} /> : null}
      narrow={weather ? <TodayWeather block={weather} query={dayQuery} /> : null}
      layout={late && todo ? dayRowLayout(late.lines.length + view.current.length, todo.lines.length) : 'wide'}
    />
  );

  return (
    <div ref={pageRef} className="today-page" aria-busy={pending}>
      <TodayHeader
        headline={view.headline}
        plan={view.plan}
        shortage={view.shortage}
        query={dayQuery}
        pending={pending}
        replies={replies}
        onRecalculatePlan={() => recalculatePlan(PLAN_HEADER_REPLY)}
      />
      {phone ? [dayRow, tiles] : [tiles, dayRow]}
      <Pair
        wide={view.week ? <TodayWeekWater week={view.week} query={dayQuery} /> : null}
        narrow={view.soil ? <TodaySoilBlock soil={view.soil} query={dayQuery} /> : null}
        layout="split"
      />
      <Pair
        wide={water ? <TodayWaterBlockView block={water} query={dayQuery} /> : null}
        narrow={reliability ? <ReliabilityZoneView zone={reliability.zone} checks={reliability.checks} byBed={reliability.byBed} query={dayQuery} pending={pending} replies={replies} onRecalculatePlan={() => recalculatePlan(PLAN_RELIABILITY_REPLY)} /> : null}
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
