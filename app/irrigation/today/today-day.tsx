'use client';

import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import { doneAsPlannedConfirmations, type AllDone } from '@/lib/domain/today/all-done';
import type { DayTimeline, LateItem } from '@/lib/domain/today/day-plan';
import type { TodayIrrigationLine } from '@/lib/domain/today/today-irrigations';
import { shortDayText } from '@/lib/domain/today/today-text';
import type { TodayBlock } from '@/lib/domain/today/today-view';
import { Icon, type IconName } from '../line-icon';
import { DoneAsPlannedButton } from '../done-as-planned-button';
import { TodayAllDone } from './today-all-done';

type LateBlock = Extract<TodayBlock, { kind: 'late' }>;
type TodoBlock = Extract<TodayBlock, { kind: 'todo' }>;

const TIMELINE_LEGEND: { tone: TodayIrrigationLine['tone'] | 'past'; label: string }[] = [
  { tone: 'late', label: 'En retard' },
  { tone: 'planned', label: 'Planifiée' },
  { tone: 'proposed', label: 'À valider' },
  { tone: 'past', label: 'Déjà passé' },
];

/**
 * « Votre journée » (docs/aujourdhui-tableau-de-bord-contract.md,
 * sections 3.2 et 3.3) : les anciens blocs « En retard » et « À faire
 * aujourd'hui » réunis. À l'ordinateur, la frise du jour ; puis « À
 * rattraper » et « À faire aujourd'hui » en cartes par heure, les jours
 * passés chargés repliés en une ligne (T2). Chaque carte garde les gestes
 * existants : « Démarrer maintenant » pour une irrigation planifiée, et
 * « Ouvrir » vers sa carte. Rien n'est démarré de soi (D-028). En tête,
 * « Tout est fait (n) » quand des irrigations passées attendent encore
 * (section 3.4) ; sur chacune d'elles, « Fait comme prévu » pour elle seule
 * (audit ergonomique, lot 3, point 6.5, F43), avec la même règle.
 */
export function TodayDay({ today, late, todo, timeline, allDone, query, pending, onStart, onAllDone }: {
  today: string;
  late: LateBlock;
  todo: TodoBlock;
  timeline: DayTimeline | null;
  allDone: AllDone | null;
  query: PageQuery;
  pending: boolean;
  onStart: (eventEquipmentId: string) => void;
  onAllDone: (eventEquipmentIds: string[]) => Promise<void>;
}) {
  const nothing = late.lines.length === 0 && todo.lines.length === 0;
  const confirmations = doneAsPlannedConfirmations(allDone);
  const card = (line: TodayIrrigationLine) => {
    const id = line.eventEquipmentId;
    const confirmation = id ? confirmations.get(id) : undefined;
    return (
      <IrrigationCard
        key={line.key}
        line={line}
        today={today}
        query={query}
        pending={pending}
        onStart={onStart}
        doneAsPlanned={id && confirmation ? { confirmation, onConfirm: () => onAllDone([id]) } : null}
      />
    );
  };
  return (
    <section className="today-block" id="today-day" data-kind="day" aria-labelledby="today-day-title">
      <div className="today-block-heading">
        <span className="today-block-badge"><Icon name="goutte" /></span>
        <div>
          <h2 id="today-day-title">Votre journée</h2>
          <p className="today-block-sub">{daySummary(late, todo)}</p>
        </div>
        {allDone ? <TodayAllDone allDone={allDone} pending={pending} onConfirm={onAllDone} /> : null}
      </div>
      {timeline ? <Timeline timeline={timeline} /> : null}
      {nothing ? (
        <div className="today-empty">
          <svg viewBox="0 0 64 44" aria-hidden="true" focusable="false">
            <path d="M6 38h52M10 38c2-6 6-9 10-9s8 3 10 9M34 38c2-5 5-7 8-7s6 2 8 7M40 6s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9zM37.5 15l2 2 3.5-3.5" />
          </svg>
          <div>
            <b>Rien à arroser aujourd’hui</b>
            <p>{late.empty} {todo.empty}</p>
          </div>
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
    </section>
  );
}

/** « Aucune irrigation en retard · 2 à faire aujourd’hui ». */
function daySummary(late: LateBlock, todo: TodoBlock): string {
  const lateText = late.lines.length === 0 ? 'Aucune en retard' : `${late.lines.length} à rattraper`;
  const todoText = todo.lines.length === 0 ? 'rien à faire aujourd’hui' : `${todo.lines.length} à faire aujourd’hui`;
  return `${lateText} · ${todoText}`;
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
        {TIMELINE_LEGEND.map((item) => <span key={item.tone}><i data-tone={item.tone} />{item.label}</span>)}
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

function IrrigationCard({ line, today, query, pending, onStart, doneAsPlanned }: {
  line: TodayIrrigationLine;
  today: string;
  query: PageQuery;
  pending: boolean;
  onStart: (eventEquipmentId: string) => void;
  /** « Fait comme prévu », seulement quand la règle de « Tout est fait » accepte l'irrigation. */
  doneAsPlanned: { confirmation: string; onConfirm: () => Promise<void> } | null;
}) {
  const startId = line.canStart ? line.eventEquipmentId : null;
  return (
    <li className="today-irrigation" data-tone={line.tone}>
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
      <div className="today-irrigation-actions">
        {doneAsPlanned ? <DoneAsPlannedButton title={line.title} confirmation={doneAsPlanned.confirmation} pending={pending} onConfirm={doneAsPlanned.onConfirm} /> : null}
        {startId ? (
          <button type="button" className="primary" disabled={pending} onClick={() => onStart(startId)}>
            Démarrer maintenant
          </button>
        ) : null}
        <a className="today-action-link" href={pageHref(line.open.page, query, line.open.anchor)} aria-label={`Ouvrir : ${line.title}, ${line.time}`}>
          Ouvrir
        </a>
      </div>
    </li>
  );
}
