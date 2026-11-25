'use client';

import { useState, type ReactNode } from 'react';
import { pageHref, pagePath, type PageQuery } from '@/lib/domain/features/pages';
import { doneAsPlannedConfirmations, type AllDone } from '@/lib/domain/today/all-done';
import type { TodayTomorrow } from '@/lib/domain/today/ahead';
import { finishInputText, finishValueToSend } from '@/lib/domain/finish-time';
import { localDateTimeInputValue } from '@/lib/domain/irrigation-timer';
import { DONE_OTHERWISE, lateQuestion, nowCountdownText, todayCardActions, todayNowActions, type TodayCardActions, type TodayCardChoice, type TodayCardGesture } from '@/lib/domain/today/card-action';
import type { DayTimeline, LateItem } from '@/lib/domain/today/day-plan';
import type { TodayNowLine } from '@/lib/domain/today/now-irrigations';
import type { TodayIrrigationLine } from '@/lib/domain/today/today-irrigations';
import { shortDayText } from '@/lib/domain/today/today-text';
import type { TodayBlock, TodayDayEmptyLink } from '@/lib/domain/today/today-view';
import { Icon, type IconName } from '../line-icon';
import { FinishIrrigationDialog } from '../irrigation-manager/finish-irrigation-dialog';
import { isoFromLocalInput } from '../irrigation-manager/presentation';
import { ActionReply, type ActionReplyMessage } from '../shell/action-reply';
import { hrefWithIntent } from '../shell/url-intent';
import { ConfirmDialog } from '../shell/confirm-dialog';
import { useConfirm } from '../shell/use-confirm';
import { OtherChoices } from './other-choices';
import { TodayAllDone } from './today-all-done';
import { useCardClock } from './use-card-clock';
import { DAY_REPLY, irrigationReply, isCardReply, proposalReply, TODAY_REPLY_CLASSES } from './today-replies';

/**
 * Un geste de la carte qui écrit tout de suite : ni un lien, ni « Terminer »
 * ni « C'est fait », qui passent d'abord par leur fenêtre.
 */
export type TodayCardWrite = Exclude<TodayCardGesture, { kind: 'open' } | { kind: 'finish' } | { kind: 'done-as-planned' }>;

/** « C'est fait » demandé : sa confirmation, avant tout enregistrement. */
type DoneAsked = Extract<TodayCardGesture, { kind: 'done-as-planned' }>;

/** La fenêtre de fin ouverte : l'irrigation, l'heure proposée à la seconde, et le champ tel qu'il se lit. */
type Finishing = { eventEquipmentId: string; equipmentName: string; precise: string; finishAt: string };

type LateBlock = Extract<TodayBlock, { kind: 'late' }>;
type TodoBlock = Extract<TodayBlock, { kind: 'todo' }>;

/**
 * « Votre journée » (docs/aujourdhui-tableau-de-bord-contract.md,
 * sections 3.2 et 3.3) : les anciens blocs « En retard » et « À faire
 * aujourd'hui » réunis. À l'ordinateur, la frise du jour ; puis « À
 * rattraper » et « À faire aujourd'hui » en cartes par heure, les jours
 * passés chargés repliés en une ligne (T2). Une proposition et une
 * irrigation planifiée portent un seul bouton, « Valider » ou « Démarrer »,
 * le reste dans « Autres choix » (simplification, lot S2, section 3,
 * `card-action.ts`) ; une irrigation en retard garde « Démarrer
 * maintenant » et « Ouvrir » jusqu'à la PR 3 du lot. Rien n'est validé ni
 * démarré de soi (D-028). En tête,
 * « Tout est fait (n) » quand des irrigations passées attendent encore
 * (section 3.4) ; sur chacune d'elles, « Fait comme prévu » pour elle seule
 * (audit ergonomique, lot 3, point 6.5, F43), avec la même règle. Au pied,
 * les arrosages de demain encore à valider, avec un lien vers le premier sur
 * le planning (audit ergonomique final, lot A, R1, F274). Tout en tête, ce
 * qui coule ou attend d'être repris (audit du 19 novembre 2026, lot H, n° 2,
 * F433 et F434), à un bouton depuis le lot S2, PR 2 : « Terminer », par la
 * fenêtre de fin d'« Arrosages », « Reprendre » une pause, « Reprendre ce qui
 * reste » d'un arrosage arrêté ; « Mettre en pause » dans « Autres choix ». La réponse d'un geste s'écrit sous sa carte ;
 * quand la carte est partie (« Fait comme prévu »), en tête du bloc, sous
 * « Tout est fait » (6 nonies, L4, D-313).
 */
export function TodayDay({ today, current = [], late, todo, tomorrow, timeline, allDone, emptyLink = null, query, pending, replies = [], onCardGesture, onFinish, onAllDone }: {
  today: string;
  current?: readonly TodayNowLine[];
  late: LateBlock;
  todo: TodoBlock;
  tomorrow: TodayTomorrow | null;
  timeline: DayTimeline | null;
  allDone: AllDone | null;
  /** Le lien de « Rien à arroser aujourd’hui » (6 nonies, L3) ; `null` : aucun. */
  emptyLink?: TodayDayEmptyLink | null;
  query: PageQuery;
  pending: boolean;
  /** La réponse du dernier geste, avec l'endroit du bouton pressé (L4). */
  replies?: readonly ActionReplyMessage[];
  /** Un geste de la carte à un bouton (S2) : valider, démarrer, refuser, mettre en pause, reprendre ; un refus est déjà confirmé. */
  onCardGesture: (gesture: TodayCardWrite) => void;
  /** « Terminer », l'heure réelle confirmée dans la fenêtre ; la fenêtre se ferme à la réponse. */
  onFinish: (eventEquipmentId: string, actualEndAt: string | null) => Promise<unknown>;
  /** `origin` : l'endroit du geste, « Tout est fait » ou la carte de « Fait comme prévu ». */
  onAllDone: (eventEquipmentIds: string[], origin: string) => Promise<void>;
}) {
  const nothing = current.length === 0 && late.lines.length === 0 && todo.lines.length === 0;
  const confirmations = doneAsPlannedConfirmations(allDone);
  const { confirm, dialog } = useConfirm();
  const [finishing, setFinishing] = useState<Finishing | null>(null);
  const [doneAsked, setDoneAsked] = useState<DoneAsked | null>(null);
  // Une réponse dont la carte n'est plus sur la page se lit en tête du bloc : jamais perdue (L4, règle 2).
  const cards = new Set([
    ...[...current.map((line) => line.eventEquipmentId), ...late.lines.map((line) => line.eventEquipmentId), ...todo.lines.map((line) => line.eventEquipmentId)]
      .filter((id): id is string => id !== null)
      .map(irrigationReply),
    ...todo.lines.map((line) => line.proposalId).filter((id): id is string => id !== null).map(proposalReply),
  ]);
  const shown = replies.map((reply) => (isCardReply(reply.origin) && !cards.has(reply.origin) ? { ...reply, origin: DAY_REPLY } : reply));
  const reply = (origin: string) => <ActionReply messages={shown} origin={origin} classNames={TODAY_REPLY_CLASSES} />;
  // « Pas à cette heure » se confirme d'une ligne : un refus ne se défait pas (contrat S2, section 5).
  // « Terminer » ouvre la fenêtre d'« Arrosages », l'heure proposée comme là-bas : celle de la pause, sinon maintenant (section 6).
  const gesture = async (choice: Exclude<TodayCardGesture, { kind: 'open' }>) => {
    if (choice.kind === 'finish') {
      const precise = localDateTimeInputValue(choice.suggestedEndAt ? new Date(choice.suggestedEndAt) : new Date(), true);
      setFinishing({ eventEquipmentId: choice.eventEquipmentId, equipmentName: choice.equipmentName, precise, finishAt: finishInputText(precise) });
      return;
    }
    // « C'est fait » écrit une donnée réelle qui ne se corrige plus : sa confirmation d'abord (D-006, section 4).
    if (choice.kind === 'done-as-planned') {
      setDoneAsked(choice);
      return;
    }
    if (choice.kind === 'refuse' && !await confirm({ ...choice.confirmation, tone: 'erase' })) return;
    if (choice.kind === 'cancel' && !await confirm({ ...choice.confirmation, tone: 'erase' })) return;
    onCardGesture(choice);
  };
  const card = (line: TodayIrrigationLine) => {
    const id = line.eventEquipmentId;
    const origin = id ? irrigationReply(id) : line.proposalId ? proposalReply(line.proposalId) : null;
    return (
      <IrrigationCard
        key={line.key}
        line={line}
        today={today}
        query={query}
        pending={pending}
        onGesture={(choice) => void gesture(choice)}
        doneAsPlanned={id ? confirmations.get(id) ?? null : null}
        reply={origin ? reply(origin) : null}
      />
    );
  };
  const recordDone = (asked: DoneAsked) => {
    const id = asked.eventEquipmentId;
    void onAllDone([id], irrigationReply(id)).then(() => setDoneAsked(null));
  };
  return (
    <section className="today-block" id="today-day" data-tour="aujourdhui-journee" data-kind="day" aria-labelledby="today-day-title">
      <div className="today-block-heading">
        <span className="today-block-badge"><Icon name="goutte" /></span>
        <div>
          <h2 id="today-day-title">Votre journée</h2>
          <p className="today-block-sub">{daySummary(current, late, todo)}</p>
        </div>
        {allDone ? <TodayAllDone allDone={allDone} pending={pending} onConfirm={(ids) => onAllDone(ids, DAY_REPLY)} /> : null}
      </div>
      {reply(DAY_REPLY)}
      {timeline ? <Timeline timeline={timeline} /> : null}
      {nothing ? (
        <div className="today-empty">
          <svg viewBox="0 0 64 44" aria-hidden="true" focusable="false">
            <path d="M6 38h52M10 38c2-6 6-9 10-9s8 3 10 9M34 38c2-5 5-7 8-7s6 2 8 7M40 6s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9zM37.5 15l2 2 3.5-3.5" />
          </svg>
          <div>
            <b>Rien à arroser aujourd’hui</b>
            <p>{late.empty} {todo.empty}</p>
            {emptyLink ? (
              <a className="today-action-link" href={emptyLink.intent && query.season ? hrefWithIntent(pagePath(emptyLink.page), query.season, emptyLink.intent, '1') : pageHref(emptyLink.page, query)}>
                {emptyLink.label}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {current.length > 0 ? (
        <div className="today-group" data-group="now">
          <h3 className="today-group-title">{nowTitle(current)}</h3>
          <ul className="today-irrigations">
            {current.map((line) => <NowCard key={line.key} line={line} query={query} pending={pending} onGesture={(choice) => void gesture(choice)} reply={reply(irrigationReply(line.eventEquipmentId))} />)}
          </ul>
        </div>
      ) : null}
      {late.lines.length > 0 ? (
        <div className="today-group" data-group="late">
          <h3 className="today-group-title">À rattraper ({late.lines.length})</h3>
          <ul className="today-irrigations">
            {late.items.map((item) => (item.kind === 'day'
              ? <LateDay key={`day-${item.date}`} item={item} query={query} />
              : card(item.line)))}
          </ul>
        </div>
      ) : null}
      {todo.lines.length > 0 ? (
        <div className="today-group" data-group="todo">
          <h3 className="today-group-title">À faire aujourd’hui ({todo.lines.length})</h3>
          <ul className="today-irrigations">
            {todo.lines.map(card)}
          </ul>
        </div>
      ) : null}
      {tomorrow ? (
        <p className="today-tomorrow">
          <Icon name="calendrier" />
          <span>{tomorrow.text}</span>
          <a href={pageHref(tomorrow.link.page, query, tomorrow.link.anchor)}>Voir au planning</a>
        </p>
      ) : null}
      {dialog}
      <ConfirmDialog
        open={doneAsked !== null}
        title="Fait comme prévu ?"
        confirmLabel="Enregistrer comme faite"
        cancelLabel="Ne rien enregistrer"
        pending={pending}
        onConfirm={() => doneAsked && recordDone(doneAsked)}
        onCancel={() => !pending && setDoneAsked(null)}
      >
        <p>{doneAsked?.confirmation}</p>
        {doneAsked?.otherwise ? (
          <p>
            {DONE_OTHERWISE.text}{' '}
            <a href={pageHref(doneAsked.otherwise.page, query, doneAsked.otherwise.anchor)}>{DONE_OTHERWISE.link}</a>
          </p>
        ) : null}
      </ConfirmDialog>
      {finishing ? (
        <FinishIrrigationDialog
          equipmentName={finishing.equipmentName}
          finishAt={finishing.finishAt}
          pending={pending}
          onFinishAtChange={(finishAt) => setFinishing({ ...finishing, finishAt })}
          onCancel={() => !pending && setFinishing(null)}
          onConfirm={() => {
            // Fermée à la réponse, réussie ou non : la réponse, un refus aussi, se lit sous la carte (L4), pas derrière la fenêtre.
            void onFinish(finishing.eventEquipmentId, isoFromLocalInput(finishValueToSend(finishing.finishAt, finishing.precise)))
              .then(() => setFinishing(null));
          }}
        />
      ) : null}
    </section>
  );
}

/** « 1 en cours · Aucune en retard · 2 à faire aujourd’hui ». */
function daySummary(current: readonly TodayNowLine[], late: LateBlock, todo: TodoBlock): string {
  const running = current.filter((line) => line.tone !== 'remainder').length;
  const remainders = current.length - running;
  const nowText = [
    running > 0 ? `${running} en cours` : null,
    remainders > 0 ? `${remainders} arrosage${remainders > 1 ? 's' : ''} arrêté${remainders > 1 ? 's' : ''} à reprendre` : null,
  ];
  const lateText = late.lines.length === 0 ? 'aucune en retard' : `${late.lines.length} à rattraper`;
  const todoText = todo.lines.length === 0 ? 'rien à faire aujourd’hui' : `${todo.lines.length} à faire aujourd’hui`;
  const text = [...nowText, lateText, todoText].filter((part): part is string => part !== null).join(' · ');
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

/** « En cours (1) », « À reprendre (1) », « En cours et à reprendre (2) » : un arrosage arrêté en route (simplification S1, mots). */
function nowTitle(current: readonly TodayNowLine[]): string {
  const remainders = current.filter((line) => line.tone === 'remainder').length;
  const label = remainders === 0 ? 'En cours' : remainders === current.length ? 'À reprendre' : 'En cours et à reprendre';
  return `${label} (${current.length})`;
}

/**
 * Une irrigation en cours, en pause ou à durée atteinte, ou ce qui reste d'un
 * arrosage arrêté (F433, F434), à un bouton (lot S2, PR 2) ; le compte à
 * rebours se lit sur le minuteur, dans le navigateur.
 */
function NowCard({ line, query, pending, onGesture, reply }: {
  line: TodayNowLine;
  query: PageQuery;
  pending: boolean;
  onGesture: (gesture: CardGesture) => void;
  reply: ReactNode;
}) {
  const now = useCardClock();
  const countdown = now ? nowCountdownText(line, now) : null;
  return (
    <li className="today-irrigation" data-tone={line.tone} data-irrigation={line.eventEquipmentId} data-one-button="">
      <div className="today-irrigation-body">
        <p className="today-irrigation-title">
          <Icon name={EQUIPMENT_ICONS[line.equipmentKind]} />
          <span>{line.title}</span>
          <span className="today-status" data-tone={line.tone}>{line.status}</span>
        </p>
        <p className="today-irrigation-meta">
          <span>{line.detail}</span>
          {line.bedsText ? <span>{line.bedsText}</span> : null}
        </p>
        {countdown ? <p className="today-countdown" data-tone={line.tone}>{countdown}</p> : null}
      </div>
      <OneButtonActions actions={todayNowActions(line)} title={line.title} query={query} pending={pending} onGesture={onGesture} />
      {reply}
    </li>
  );
}

/** Un geste de la carte, avant sa fenêtre : tout sauf un lien. */
type CardGesture = Exclude<TodayCardGesture, { kind: 'open' }>;

/** Le bouton principal, le lien d'appoint au plus, et « Autres choix » (contrat S2, section 3). */
function OneButtonActions({ actions, title, query, pending, onGesture }: {
  actions: TodayCardActions;
  /** Le nom de la carte, pour « Autres choix : … ». */
  title: string;
  query: PageQuery;
  pending: boolean;
  onGesture: (gesture: CardGesture) => void;
}) {
  return (
    <div className="today-irrigation-actions" data-actions="one-button">
      <CardChoice choice={actions.primary} query={query} pending={pending} onGesture={onGesture} primary />
      {actions.secondary ? <CardChoice choice={actions.secondary} query={query} pending={pending} onGesture={onGesture} twin={actions.twin} /> : null}
      {actions.others.length > 0 ? (
        <OtherChoices title={title} pending={pending}>
          {actions.others.map((choice) => (
            <li key={choice.label}><CardChoice choice={choice} query={query} pending={pending} onGesture={onGesture} /></li>
          ))}
        </OtherChoices>
      ) : null}
    </div>
  );
}

export function Timeline({ timeline }: { timeline: DayTimeline }) {
  const label = `Frise de la journée, de ${timeline.startHour} h à ${timeline.endHour} h${timeline.bars.length > 0 ? ` : ${timeline.bars.map((bar) => bar.label).join(' ; ')}` : ''}.`;
  return (
    <div className="today-timeline-wrap">
      <div className="today-timeline" role="img" aria-label={label}>
        <span className="today-timeline-track" />
        {timeline.now ? <span className="today-timeline-past" style={{ width: `${timeline.now.percent}%` }} /> : null}
        {timeline.bars.map((bar) => (
          <span key={bar.key} className="today-timeline-bar" data-tone={bar.tone} style={{ left: `${bar.leftPercent}%`, width: `${bar.widthPercent}%` }} title={bar.label} />
        ))}
        {timeline.now ? <span className="today-timeline-now" style={{ left: `${timeline.now.percent}%` }}><span>{timeline.now.label}</span></span> : null}
        {timeline.ticks.map((tick) => (
          <span key={tick.label} className="today-timeline-tick" style={{ left: `${tick.percent}%` }}>{tick.label}</span>
        ))}
      </div>
      <p className="today-legend" aria-hidden="true">
        {timeline.legend.map((item) => <span key={item.tone}><i data-tone={item.tone} />{item.label}</span>)}
      </p>
    </div>
  );
}

function LateDay({ item, query }: { item: Extract<LateItem, { kind: 'day' }>; query: PageQuery }) {
  return (
    <li className="today-late-day">
      <span className="today-late-day-count" aria-hidden="true">{item.count}</span>
      <p><b>{item.title}</b>{item.detail}</p>
      <a className="today-action-link" href={pageHref(item.open.page, query)}>{item.open.label}</a>
    </li>
  );
}

const EQUIPMENT_ICONS: Record<NonNullable<TodayIrrigationLine['equipmentKind']>, IconName> = {
  sprinkler: 'asperseur',
  drip: 'rampe',
};

function IrrigationCard({ line, today, query, pending, onGesture, doneAsPlanned, reply }: {
  line: TodayIrrigationLine;
  today: string;
  query: PageQuery;
  pending: boolean;
  onGesture: (gesture: CardGesture) => void;
  /** La confirmation de « C'est fait », seulement quand la règle de « Tout est fait » accepte l'irrigation (T15). */
  doneAsPlanned: string | null;
  /** La réponse d'un geste de la carte, sous ses boutons (L4). */
  reply: ReactNode;
}) {
  const actions = todayCardActions(line, { doneAsPlanned });
  const question = lateQuestion(line, today);
  return (
    <li
      className="today-irrigation"
      data-tone={line.tone}
      data-irrigation={line.eventEquipmentId ?? undefined}
      data-proposal={line.proposalId ?? undefined}
      data-one-button={actions ? '' : undefined}
    >
      <p className="today-irrigation-time">
        <strong>{line.hour}</strong>
        {line.day === today ? null : <span>{shortDayText(line.day)}</span>}
      </p>
      <div className="today-irrigation-body">
        <p className="today-irrigation-title">
          <Icon name={line.equipmentKind ? EQUIPMENT_ICONS[line.equipmentKind] : 'goutte'} />
          <span>{line.title}</span>
          <span className="today-status" data-tone={line.tone}>{line.status}</span>
        </p>
        <p className="today-irrigation-meta">
          {line.bedsText ? <span>{line.bedsText}</span> : null}
          <span className="today-tag" data-kind="duration">{line.durationText}</span>
          {line.doseText ? <span className="today-tag" data-kind="dose">{line.doseText}</span> : null}
        </p>
        {question ? <p className="today-late-question">{question}</p> : null}
      </div>
      {actions ? (
        <OneButtonActions actions={actions} title={`${line.title}, ${line.time}`} query={query} pending={pending} onGesture={onGesture} />
      ) : (
        <div className="today-irrigation-actions">
          <a className="today-action-link" href={pageHref(line.open.page, query, line.open.anchor)} aria-label={`${line.open.label} : ${line.title}, ${line.time}`}>
            {line.open.label}
          </a>
        </div>
      )}
      {reply}
    </li>
  );
}

/**
 * Un choix de la carte : un bouton qui fait le geste, ou un lien vers sa
 * page. Le bouton principal porte `data-primary`, que le focus retrouve
 * après le geste (contrat S2, section 3).
 */
function CardChoice({ choice, query, pending, onGesture, primary = false, twin = false }: {
  choice: TodayCardChoice;
  query: PageQuery;
  pending: boolean;
  onGesture: (gesture: CardGesture) => void;
  primary?: boolean;
  /** Le second geste à la taille du premier, bordé (l'arrosage à rattraper, section 4). */
  twin?: boolean;
}) {
  const gesture = choice.gesture;
  if (gesture.kind === 'open') {
    return (
      <a className="today-action-link" href={pageHref(gesture.page, query, gesture.anchor)} aria-label={choice.accessibleName}>
        {choice.label}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={primary ? 'primary today-card-primary' : twin ? 'today-card-twin' : 'today-card-secondary'}
      data-primary={primary ? '' : undefined}
      disabled={pending}
      aria-label={choice.accessibleName}
      onClick={() => onGesture(gesture)}
    >
      {choice.label}
    </button>
  );
}
