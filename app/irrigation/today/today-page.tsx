'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import { MEASURED_RAIN_ANCHOR } from '@/lib/domain/today/reliability';
import { dayRowLayout, type TodayBlock, type TodayView } from '@/lib/domain/today/today-view';
import { millisecondsFromMinutes, millisecondsFromSeconds } from '@/lib/domain/units';
import { recordDoneAsPlannedAction } from '../done-as-planned-actions';
import { eventReply, type TodayStart } from '@/lib/domain/today/card-action';
import { cancelPlannedIrrigationAction, finishIrrigationEventAction, pauseIrrigationEventAction, resumeIrrigationEventAction, startIrrigationEventAction } from '../irrigation-event-actions';
import { computeWeeklyPlanAction } from '../planning-actions';
import { RainEntryDialog } from '../rain-entry-dialog';
import { ActionReply, actionReply, type ActionReplyMessage } from '../shell/action-reply';
import { announceTodayBadge } from '../shell/today-badge';
import { loadTodayViewAction } from '../today-actions';
import { refuseProposalFromTodayAction, validateAndStartProposalFromTodayAction, validateProposalFromTodayAction } from '../today-card-actions';
import { ReliabilityZoneView } from './reliability-zone';
import { Timeline, TodayDay, type TodayCardWrite } from './today-day';
import { TodayDetail, useTodayDetail } from './today-detail';
import { TodayApproximateView, TodayWaterAlertView, TodayWeatherAlertView, TodayWeekBarView } from './today-essential';
import { TodayHeader } from './today-header';
import { TodaySoilBlock, TodayWaterBlockView, TodayWeekWater } from './today-gauges';
import { TodayWeather } from './today-weather';
import { TodayWeekTiles } from './today-week';
import { irrigationReply, PLAN_HEADER_REPLY, PLAN_RELIABILITY_REPLY, proposalReply, RAIN_RELIABILITY_REPLY, RAIN_TILE_REPLY, RAIN_WEEK_REPLY, TODAY_REPLY_CLASSES } from './today-replies';

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
 * sont les actions existantes « Démarrer » et « Recalculer le plan », « Tout
 * est fait » (section 3.4) et, sur la carte d'une proposition, la validation
 * et le refus du planning (simplification, lot S2, section 5) ; elle se
 * relit après chacun,
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
  const { fold, open: detailOpen, setOpen: setDetailOpen, reveal } = useTodayDetail();
  /** La réponse du dernier geste, à l'endroit du bouton pressé ; un nouveau geste la remplace. */
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);
  // « Noter la pluie » ouverte, et l'endroit du bouton qui l'a ouverte, où sa réponse s'écrit (S2, PR 4).
  const [rainFrom, setRainFrom] = useState<string | null>(null);
  /** Après un geste de la carte, le focus va au nouveau bouton principal de sa carte (contrat S2, section 3). */
  const focusCard = useRef<string | null>(null);
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

  // Le bouton principal de la carte, une fois le geste fini et la page relue.
  useEffect(() => {
    if (!focusCard.current || pending) return;
    const id = CSS.escape(focusCard.current);
    focusCard.current = null;
    pageRef.current?.querySelector<HTMLElement>(`[data-irrigation="${id}"] [data-primary], [data-proposal="${id}"] [data-primary]`)?.focus({ preventScroll: true });
  }, [pending, view]);

  // Démarrée, l'irrigation passe « En cours » : sa réponse la suit, sous sa nouvelle carte (L4, règle 2).
  const start = (eventEquipmentId: string) => startTransition(async () => {
    const origin = irrigationReply(eventEquipmentId);
    const result = await startIrrigationEventAction(eventEquipmentId);
    setReplies([result.ok
      ? actionReply(origin, 'notice', result.warning ? `${result.message} ${result.warning}` : result.message, { link: { href: pageHref('arrosages', dayQuery), label: 'Suivre sur « Arrosages »' } })
      : actionReply(origin, 'error', result.message)]);
    await reload();
    focusCard.current = eventEquipmentId;
  });

  // La carte d'une proposition (S2) : « Valider », « Démarrer tout de suite », « Pas à cette heure ».
  // Validée, elle devient une irrigation planifiée : la réponse et le focus la suivent ; sinon, la réponse reste sous la proposition.
  const cardGesture = (gesture: TodayCardWrite) => {
    if (gesture.kind === 'start') return start(gesture.eventEquipmentId);
    if (gesture.kind === 'pause' || gesture.kind === 'resume' || gesture.kind === 'cancel') {
      const id = gesture.eventEquipmentId;
      const act = gesture.kind === 'pause' ? pauseIrrigationEventAction : gesture.kind === 'resume' ? resumeIrrigationEventAction : cancelPlannedIrrigationAction;
      return eventGesture(id, () => act(id));
    }
    startTransition(async () => {
      const input = { season, proposalId: gesture.proposalId };
      const result = gesture.kind === 'validate'
        ? await validateProposalFromTodayAction(input)
        : gesture.kind === 'validate-and-start'
          ? await validateAndStartProposalFromTodayAction(input)
          : await refuseProposalFromTodayAction(input);
      const origin = result.eventEquipmentId ? irrigationReply(result.eventEquipmentId) : proposalReply(gesture.proposalId);
      const followed = gesture.kind === 'validate-and-start' && result.tone === 'notice' ? { link: { href: pageHref('arrosages', dayQuery), label: 'Suivre sur « Arrosages »' } } : {};
      setReplies([actionReply(origin, result.tone, result.text, followed)]);
      await reload();
      focusCard.current = result.eventEquipmentId ?? gesture.proposalId;
    });
  };

  // « Mettre en pause », « Reprendre », « Terminer » (S2, PR 2), « Ne pas le faire » (PR 3) : les actions d'« Arrosages » ;
  // la réponse reste sous la carte de l'irrigation, qui passe « En pause », « En cours » ou devient « ce qui reste » ;
  // terminée ou annulée, elle se lit en tête du bloc.
  const eventGesture = (eventEquipmentId: string, act: () => Promise<TodayStart>) => new Promise<boolean>((resolve) => startTransition(async () => {
    try {
      const result = await act();
      const reply = eventReply(eventEquipmentId, result);
      setReplies([actionReply(irrigationReply(eventEquipmentId), reply.tone, reply.text)]);
      if (result.ok) await reload();
      focusCard.current = eventEquipmentId;
      resolve(result.ok);
    } catch (error) {
      resolve(false);
      throw error;
    }
  }));
  const finish = (eventEquipmentId: string, actualEndAt: string | null) => eventGesture(eventEquipmentId, () => finishIrrigationEventAction({ eventEquipmentId, actualEndAt }));

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

  const openRain = view.rain ? (origin: string) => () => setRainFrom(origin) : null;
  const rainSaved = (text: string) => {
    const origin = rainFrom ?? RAIN_WEEK_REPLY;
    setRainFrom(null);
    startTransition(async () => {
      setReplies([actionReply(origin, 'notice', text)]);
      await reload();
    });
  };
  const reply = (origin: string) => <ActionReply messages={replies} origin={origin} classNames={TODAY_REPLY_CLASSES} />;
  const { essential } = view;

  // Le premier niveau (contrat S2, section 8), dans l'ordre de l'écran, le même au clavier (L6) : la journée
  // d'abord, puis le gel annoncé, la semaine, la ligne « Calcul approximatif » et la ligne d'eau ; le reste
  // dans « Le détail ». La frise passe dans le pli (S2-f) : les cartes disent déjà la journée.
  const weatherAlertView = weather ? <TodayWeatherAlertView alert={essential.weather} unposedFrost={weather.unposedFrost} scale={weather.scale} query={dayQuery} /> : null;
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
        onReveal={reveal}
      />
      <Pair
        wide={late && todo ? <TodayDay today={view.today} current={view.current} late={late} todo={todo} tomorrow={view.tomorrow} timeline={null} allDone={view.allDone} emptyLink={view.dayEmptyLink} allIrrigationsLink={view.allIrrigationsLink} query={dayQuery} pending={pending} replies={replies} onCardGesture={cardGesture} onFinish={finish} onAllDone={recordAllDone} /> : null}
        narrow={weatherAlertView}
        layout={late && todo ? dayRowLayout(late.lines.length + view.current.length, todo.lines.length) : 'wide'}
      />
      {essential.week ? <TodayWeekBarView bar={essential.week} query={dayQuery} pending={pending} onOpenRain={openRain?.(RAIN_WEEK_REPLY)} reply={reply(RAIN_WEEK_REPLY)} /> : null}
      {essential.approximate ? (
        <TodayApproximateView
          approximate={essential.approximate}
          query={dayQuery}
          pending={pending}
          // La ligne part quand sa donnée est rafraîchie : la réponse s'écrit sous le plan ou sous la semaine, qui restent.
          onRecalculatePlan={() => recalculatePlan(PLAN_HEADER_REPLY)}
          onOpenRain={openRain?.(RAIN_WEEK_REPLY)}
          onReveal={reveal}
        />
      ) : null}
      {essential.water ? <TodayWaterAlertView alert={essential.water} query={dayQuery} onReveal={reveal} /> : null}
      {essential.detail ? (
        <TodayDetail foldRef={fold} open={detailOpen} onOpenChange={setDetailOpen} summary={essential.detail}>
          {view.week ? (
            <TodayWeekTiles
              week={view.week}
              query={dayQuery}
              pending={pending}
              onOpenRain={openRain?.(RAIN_TILE_REPLY)}
              rainReply={reply(RAIN_TILE_REPLY)}
            />
          ) : null}
          <Pair
            wide={view.week ? <TodayWeekWater week={view.week} query={dayQuery} /> : null}
            narrow={view.soil ? <TodaySoilBlock soil={view.soil} query={dayQuery} /> : null}
            layout="split"
          />
          <Pair
            wide={water ? <TodayWaterBlockView block={water} query={dayQuery} /> : null}
            narrow={reliability ? <ReliabilityZoneView zone={reliability.zone} checks={reliability.checks} byBed={reliability.byBed} query={dayQuery} pending={pending} replies={replies} onRecalculatePlan={() => recalculatePlan(PLAN_RELIABILITY_REPLY)} onOpenRain={openRain?.(RAIN_RELIABILITY_REPLY)} /> : null}
            layout="half"
          />
          <Pair
            wide={view.timeline ? <TodayTimelineBlock timeline={view.timeline} /> : null}
            narrow={weather ? <TodayWeather block={weather} query={dayQuery} /> : null}
            layout="wide"
          />
        </TodayDetail>
      ) : null}
      {view.rain ? (
        <RainEntryDialog
          open={rainFrom !== null}
          entry={view.rain}
          season={season}
          planning={view.plan !== null}
          besoinsHref={pageHref('semaine', dayQuery, MEASURED_RAIN_ANCHOR)}
          onClose={() => setRainFrom(null)}
          onSaved={rainSaved}
        />
      ) : null}
    </div>
  );
}

/** La frise du jour, dans « Le détail » (S2-f) ; à l'ordinateur seulement, comme avant. */
function TodayTimelineBlock({ timeline }: { timeline: NonNullable<TodayView['timeline']> }) {
  return (
    <section className="today-block" id="today-timeline" data-kind="timeline" aria-labelledby="today-timeline-title">
      <h2 id="today-timeline-title" className="today-essential-title">La journée en frise</h2>
      <Timeline timeline={timeline} />
    </section>
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
