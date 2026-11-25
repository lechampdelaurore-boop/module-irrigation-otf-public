import type { IrrigationPageId } from '../features/pages.ts';
import type { FeatureSelection } from '../features/selection.ts';
import { waterText } from '../figure-origin.ts';
import type { EquipmentKind } from '../irrigation-domain.ts';
import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { isTimerAwaitingConfirmation } from '../irrigation-timer.ts';
import { remainingIrrigationForStart } from '../water-management.ts';
import { bedsText, durationText, irrigationAnchor, irrigationPage, timeText } from './today-irrigations.ts';
import { farmDateKey } from './today-text.ts';
import { SIMPLE_WORDS } from '../simple-words.ts';

/**
 * Ce qui coule ou attend d'être repris, en tête de « Votre journée »
 * (audit du 19 novembre 2026, lot H, n° 2, F433 à F435 ;
 * docs/audit-ergonomie-2026-11-19-lot-h-contract.md, section 5) : une
 * irrigation dont le minuteur tourne, est en pause ou attend sa
 * confirmation, et le reliquat d'une irrigation partielle encore à
 * reprendre. Les gestes restent ceux d'« Arrosages » (D-028) : l'arrêt, avec
 * sa durée réelle à confirmer, s'y fait depuis la carte ; « Reprendre le
 * reliquat » est le même geste que là-bas.
 */

type NowTone = 'running' | 'paused' | 'finished' | 'remainder';

const STATUS_TEXT: Record<NowTone, string> = {
  running: 'En cours',
  paused: 'En pause',
  finished: 'Durée atteinte',
  remainder: SIMPLE_WORDS.stoppedRemainder,
};

export type TodayNowLine = {
  key: string;
  eventEquipmentId: string;
  tone: NowTone;
  /** « En cours », « En pause », « Durée atteinte », ou le reste d’un arrosage arrêté (`SIMPLE_WORDS.stoppedRemainder`). */
  status: string;
  /** « Goutte-à-goutte B · Réglage 1 ». */
  title: string;
  /** « depuis 9 h 40, fin prévue à 13 h 50 », « reste 1 h 20 · 1,3 m³ ». */
  detail: string;
  /** « planches P1 et P2 », vide sans nom connu. */
  bedsText: string;
  bedIds: string[];
  equipmentKind: EquipmentKind;
  /** « Reprendre le reliquat » : le reliquat seulement ; une irrigation en cours s'arrête sur « Arrosages ». */
  canResume: boolean;
  open: { page: IrrigationPageId; anchor: string };
};

function tone(event: IrrigationEventRecord, now: Date): NowTone {
  const equipment = event.equipment;
  if (equipment.timerState === 'paused') return 'paused';
  return isTimerAwaitingConfirmation({
    state: 'running',
    resumedAt: equipment.timerResumedAt,
    pausedAt: equipment.timerPausedAt,
    accumulatedSeconds: equipment.timerAccumulatedSeconds,
    targetDurationSeconds: equipment.plannedDurationSeconds,
  }, now) ? 'finished' : 'running';
}

function runningDetail(event: IrrigationEventRecord, state: NowTone, today: string): string {
  const equipment = event.equipment;
  const since = equipment.timerStartedAt ?? equipment.actualStartAt;
  const parts: string[] = [];
  if (state === 'paused' && equipment.timerPausedAt) parts.push(`en pause depuis ${timeText(equipment.timerPausedAt, today)}`);
  else if (since) parts.push(`depuis ${timeText(since, today)}`);
  if (state === 'finished') parts.push('fermer la vanne');
  else if (state === 'running' && equipment.timerTheoreticalEndAt) parts.push(`fin prévue à ${timeText(equipment.timerTheoreticalEndAt, today)}`);
  return parts.join(', ');
}

function remainderDetail(event: IrrigationEventRecord, now: Date): string {
  const remaining = remainingIrrigationForStart(event, now);
  return [`reste ${durationText(remaining.seconds)}`, remaining.cubicMeters > 0 ? waterText(remaining.cubicMeters, 'm³') : null]
    .filter((part): part is string => part !== null).join(' · ');
}

/** Un reliquat à reprendre, comme le lit « Arrosages » : partielle, reliquat non annulé, minuteur arrêté. */
function isOpenRemainder(event: IrrigationEventRecord): boolean {
  return event.status === 'partially_completed' && !event.remainingCanceledAt && !event.equipment.remainingCanceledAt && !event.equipment.timerState;
}

/** Les irrigations en cours d'abord, par début, puis les reliquats, par début prévu. */
export function nowIrrigationLines(input: {
  enabled: FeatureSelection;
  now: Date;
  events: readonly IrrigationEventRecord[];
  bedNames: ReadonlyMap<string, string>;
}): TodayNowLine[] {
  const today = farmDateKey(input.now);
  const page = irrigationPage(input.enabled);
  const line = (event: IrrigationEventRecord, state: NowTone): TodayNowLine => {
    const equipment = event.equipment;
    const bedIds = equipment.applications.map((application) => application.otfBedId);
    return {
      key: `${state === 'remainder' ? 'remainder' : 'running'}:${equipment.id}`,
      eventEquipmentId: equipment.id,
      tone: state,
      status: STATUS_TEXT[state],
      title: `${equipment.equipmentSnapshot.name} · ${equipment.settingSnapshot.name}`,
      detail: state === 'remainder' ? remainderDetail(event, input.now) : runningDetail(event, state, today),
      bedsText: bedsText(bedIds, input.bedNames),
      bedIds,
      equipmentKind: equipment.equipmentSnapshot.kind,
      canResume: state === 'remainder',
      open: { page, anchor: irrigationAnchor(equipment.id) },
    };
  };
  const started = (event: IrrigationEventRecord) => event.equipment.timerStartedAt ?? event.equipment.actualStartAt ?? event.equipment.plannedStartAt ?? '';
  const running = input.events
    .filter((event) => event.equipment.timerState !== null && event.status !== 'canceled')
    .sort((a, b) => started(a).localeCompare(started(b)))
    .map((event) => line(event, tone(event, input.now)));
  const remainders = input.events
    .filter(isOpenRemainder)
    .sort((a, b) => (a.equipment.plannedStartAt ?? '').localeCompare(b.equipment.plannedStartAt ?? ''))
    .map((event) => line(event, 'remainder'));
  return [...running, ...remainders];
}
