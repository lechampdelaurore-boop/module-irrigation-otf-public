'use client';

import type { ReactNode } from 'react';
import { pageHref, pagePath, type PageQuery } from '@/lib/domain/features/pages';
import { doneAsPlannedConfirmations, type AllDone } from '@/lib/domain/today/all-done';
import type { TodayTomorrow } from '@/lib/domain/today/ahead';
import { todayCardActions, type TodayCardChoice, type TodayCardGesture } from '@/lib/domain/today/card-action';
import type { DayTimeline, LateItem } from '@/lib/domain/today/day-plan';
import type { TodayNowLine } from '@/lib/domain/today/now-irrigations';
import type { TodayIrrigationLine } from '@/lib/domain/today/today-irrigations';
import { shortDayText } from '@/lib/domain/today/today-text';
import type { TodayBlock, TodayDayEmptyLink } from '@/lib/domain/today/today-view';
import { Icon, type IconName } from '../line-icon';
import { DoneAsPlannedButton } from '../done-as-planned-button';
import { ActionReply, type ActionReplyMessage } from '../shell/action-reply';
import { hrefWithIntent } from '../shell/url-intent';
import { useConfirm } from '../shell/use-confirm';
import { OtherChoices } from './other-choices';
import { TodayAllDone } from './today-all-done';
import { DAY_REPLY, irrigationReply, isCardReply, proposalReply, TODAY_REPLY_CLASSES } from './today-replies';

/** Un geste de la carte qui écrit : tout sauf un lien. */
export type TodayCardWrite = Exclude<TodayCardGesture, { kind: 'open' }>;

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
 * qui coule ou attend d'être repris : une irrigation en cours, avec
 * « Terminer l’irrigation » (lot K, F473) qui ouvre sa carte sur « Arrosages », et un
 * reliquat, avec « Reprendre le reliquat » (audit du 19 novembre 2026,
 * lot H, n° 2, F433 et F434). La réponse d'un geste s'écrit sous sa carte ;
 * quand la carte est partie (« Fait comme prévu »), en tête du bloc, sous
 * « Tout est fait » (6 nonies, L4, D-313).
 */
export function TodayDay({ today, current = [], late, todo, tomorrow, timeline, allDone, emptyLink = null, query, pending, replies = [], onStart, onCardGesture, onAllDone }: {
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
  onStart: (eventEquipmentId: string) => void;
  /** Un geste de la carte à un bouton (S2) : valider, démarrer, refuser ; un refus est déjà confirmé. */
  onCardGesture: (gesture: TodayCardWrite) => void;
  /** `origin` : l'endroit du geste, « Tout est fait » ou la carte de « Fait comme prévu ». */
  onAllDone: (eventEquipmentIds: string[], origin: string) => Promise<void>;
}) {
  const nothing = current.length === 0 && late.lines.length === 0 && todo.lines.length === 0;
  const confirmations = doneAsPlannedConfirmations(allDone);
  const { confirm, dialog } = useConfirm();
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
  const gesture = async (choice: TodayCardWrite) => {
    if (choice.kind === 'refuse' && !await confirm({ ...choice.confirmation, tone: 'erase' })) return;
    onCardGesture(choice);
  };
  const card = (line: TodayIrrigationLine) => {
    const id = line.eventEquipmentId;
    const confirmation = id ? confirmations.get(id) : undefined;
    const origin = id ? irrigationReply(id) : line.proposalId ? proposalReply(line.proposalId) : null;
    return (
      <IrrigationCard
        key={line.key}
        line={line}
        today={today}
        query={query}
        pending={pending}
        onStart={onStart}
        onGesture={(choice) => void gesture(choice)}
        doneAsPlanned={id && confirmation ? { confirmation, onConfirm: () => onAllDone([id], irrigationReply(id)) } : null}
        reply={origin ? reply(origin) : null}
      />
    );
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
            {current.map((line) => <NowCard key={line.key} line={line} query={query} pending={pending} onStart={onStart} reply={reply(irrigationReply(line.eventEquipmentId))} />)}
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

/** Une irrigation en cours, en pause ou à confirmer, ou un reliquat (F433, F434). */
function NowCard({ line, query, pending, onStart, reply }: {
  line: TodayNowLine;
  query: PageQuery;
  pending: boolean;
  onStart: (eventEquipmentId: string) => void;
  reply: ReactNode;
}) {
  return (
    <li className="today-irrigation" data-tone={line.tone} data-irrigation={line.eventEquipmentId}>
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
      </div>
      <div className="today-irrigation-actions">
        {line.canResume ? (
          <button type="button" className="primary" data-primary="" disabled={pending} onClick={() => onStart(line.eventEquipmentId)}>
            Reprendre ce qui reste
          </button>
        ) : null}
        <a
          className="today-action-link"
          data-primary={line.canResume ? undefined : ''}
          href={pageHref(line.open.page, query, line.open.anchor)}
          aria-label={`${line.canResume ? 'Ouvrir' : 'Arrêter ou terminer'} : ${line.title}`}
        >
          {line.canResume ? 'Ouvrir' : 'Terminer l’irrigation'}
        </a>
      </div>
      {reply}
    </li>
  );
}

function Timeline({ timeline }: { timeline: DayTimeline }) {
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

function IrrigationCard({ line, today, query, pending, onStart, onGesture, doneAsPlanned, reply }: {
  line: TodayIrrigationLine;
  today: string;
  query: PageQuery;
  pending: boolean;
  onStart: (eventEquipmentId: string) => void;
  onGesture: (gesture: TodayCardWrite) => void;
  /** « Fait comme prévu », seulement quand la règle de « Tout est fait » accepte l'irrigation. */
  doneAsPlanned: { confirmation: string; onConfirm: () => Promise<void> } | null;
  /** La réponse d'un geste de la carte, sous ses boutons (L4). */
  reply: ReactNode;
}) {
  const actions = todayCardActions(line);
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
      </div>
      {actions ? (
        <div className="today-irrigation-actions" data-actions="one-button">
          <CardChoice choice={actions.primary} query={query} pending={pending} onGesture={onGesture} primary />
          {actions.secondary ? <CardChoice choice={actions.secondary} query={query} pending={pending} onGesture={onGesture} /> : null}
          {actions.others.length > 0 ? (
            <OtherChoices title={`${line.title}, ${line.time}`} pending={pending}>
              {actions.others.map((choice) => (
                <li key={choice.label}><CardChoice choice={choice} query={query} pending={pending} onGesture={onGesture} /></li>
              ))}
            </OtherChoices>
          ) : null}
        </div>
      ) : (
        <LateActions line={line} query={query} pending={pending} onStart={onStart} doneAsPlanned={doneAsPlanned} />
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
function CardChoice({ choice, query, pending, onGesture, primary = false }: {
  choice: TodayCardChoice;
  query: PageQuery;
  pending: boolean;
  onGesture: (gesture: TodayCardWrite) => void;
  primary?: boolean;
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
      className={primary ? 'primary today-card-primary' : 'today-card-secondary'}
      data-primary={primary ? '' : undefined}
      disabled={pending}
      aria-label={choice.accessibleName}
      onClick={() => onGesture(gesture)}
    >
      {choice.label}
    </button>
  );
}

/**
 * Les gestes d'une irrigation en retard ou non faite, inchangés jusqu'à la
 * PR 3 du lot S2 : « Fait comme prévu », « Démarrer maintenant », « Ouvrir ».
 */
function LateActions({ line, query, pending, onStart, doneAsPlanned }: {
  line: TodayIrrigationLine;
  query: PageQuery;
  pending: boolean;
  onStart: (eventEquipmentId: string) => void;
  doneAsPlanned: { confirmation: string; onConfirm: () => Promise<void> } | null;
}) {
  const startId = line.canStart ? line.eventEquipmentId : null;
  return (
    <div className="today-irrigation-actions">
      {doneAsPlanned ? <DoneAsPlannedButton title={line.title} confirmation={doneAsPlanned.confirmation} pending={pending} onConfirm={doneAsPlanned.onConfirm} /> : null}
      {startId ? (
        <button type="button" className="primary" disabled={pending} onClick={() => onStart(startId)}>
          Démarrer maintenant
        </button>
      ) : null}
      <a className="today-action-link" href={pageHref(line.open.page, query, line.open.anchor)} aria-label={`${line.open.label} : ${line.title}, ${line.time}`}>
        {line.open.label}
      </a>
    </div>
  );
}
