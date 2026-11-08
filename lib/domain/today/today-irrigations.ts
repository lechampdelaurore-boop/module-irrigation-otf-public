import type { IrrigationPageId } from '../features/pages.ts';
import type { FeatureSelection } from '../features/selection.ts';
import { mmText } from '../figure-origin.ts';
import type { EquipmentKind } from '../irrigation-domain.ts';
import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { isWaitingPlannedIrrigation, plannedIrrigationLateness } from '../planned-irrigation.ts';
import { effectiveProposalStatus, type StoredProposal } from '../planning/contract.ts';
import { hoursAndMinutesFromSeconds } from '../units.ts';
import { farmDateKey, farmHourText, shortDayText, sortedNames } from './today-text.ts';

/**
 * Les blocs « En retard » et « À faire aujourd'hui » de la page
 * « Aujourd'hui » (audit ergonomique, point 1, 3.8 quater lot 2,
 * docs/audit-ergonomie-lot2-contract.md, section 5, blocs b et c, précision
 * F4). Ils lisent les irrigations comme la page des arrosages, avec la même
 * tolérance R14, et les propositions encore à valider du plan de la semaine.
 * Rien n'est annulé ni démarré ici (D-028) : chaque ligne reprend le bouton
 * existant « Démarrer maintenant » et ouvre la carte de l'irrigation.
 */

type TodayIrrigationTone = 'missed' | 'late' | 'planned' | 'proposed';

const STATUS_TEXT: Record<TodayIrrigationTone, string> = {
  missed: 'Non faite',
  late: 'En retard',
  planned: 'Planifiée',
  proposed: 'À valider',
};

export type TodayIrrigationLine = {
  /** Unique dans la page : l'irrigation par son matériel, ou la proposition. */
  key: string;
  /** L'irrigation par son matériel, ce que « Démarrer maintenant » désigne ; `null` pour une proposition. */
  eventEquipmentId: string | null;
  /** « 7 h », ou « mer. 11 nov. à 7 h » pour un autre jour. */
  time: string;
  /** « Goutte-à-goutte B · Réglage 1 ». */
  title: string;
  /** « planches P1 et P2 · 1 h 30 · 12 mm ». */
  detail: string;
  /** « En retard », « Non faite », « Planifiée », « À valider ». */
  status: string;
  /** La couleur du statut : rouge pour « Non faite », ambre pour « En retard » et « À valider ». */
  tone: TodayIrrigationTone;
  /** Le bouton existant « Démarrer maintenant » : une irrigation planifiée seulement, jamais une proposition. */
  canStart: boolean;
  /** La carte à ouvrir : sa page et son ancre. */
  open: { page: IrrigationPageId; anchor: string };
  /** L'heure de début prévue, l'instant : la frise de la journée la place. */
  startAt: string;
  /** Le jour civil à la ferme du début prévu, `AAAA-MM-JJ`. */
  day: string;
  /** « 7 h », « 18 h 30 », sans le jour. */
  hour: string;
  durationSeconds: number;
  /** « 1 h 30 », « 45 min ». */
  durationText: string;
  /** La dose prévue la plus forte des planches ; `null` quand elle n'est pas connue. */
  doseMm: number | null;
  /** « 12 mm », ou `null`. */
  doseText: string | null;
  /** « planches P1 et P2 », vide sans nom connu. */
  bedsText: string;
  /** Les planches arrosées, pour les compter d'un jour à l'autre. */
  bedIds: string[];
  equipmentName: string;
  settingName: string;
  /** Goutte-à-goutte ou aspersion, pour l'icône ; `null` pour une proposition, dont le plan ne garde pas le type. */
  equipmentKind: EquipmentKind | null;
};

/** L'ancre de la carte d'une irrigation sur la page des arrosages (`irrigation-cards.tsx`). */
function irrigationAnchor(eventEquipmentId: string): string {
  return `irrigation-${eventEquipmentId}`;
}

/** L'ancre de la carte d'une proposition sur le planning de la semaine. */
export function proposalAnchor(storedId: string): string {
  return `proposal-${storedId}`;
}

/** « 1 h 30 », « 45 min », « 2 h ». */
export function durationText(seconds: number): string {
  const { hours, minutes } = hoursAndMinutesFromSeconds(seconds);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`;
}

/** « planche P1 », « planches P1 et P2 », dans l'ordre naturel ; vide sans nom connu. */
function bedsText(bedIds: Iterable<string>, bedNames: ReadonlyMap<string, string>): string {
  const names = sortedNames([...bedIds].flatMap((id) => {
    const name = bedNames.get(id);
    return name ? [name] : [];
  }));
  if (names.length === 0) return '';
  const listed = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
  return `planche${names.length > 1 ? 's' : ''} ${listed}`;
}

function timeText(instant: string, today: string): string {
  const day = farmDateKey(instant);
  return day === today ? farmHourText(instant) : `${shortDayText(day)} à ${farmHourText(instant)}`;
}

function detailText(parts: (string | null)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}

/** La carte d'une irrigation s'ouvre sur les arrosages, ou sur le planning quand les arrosages ne sont pas cochés. */
function irrigationPage(enabled: FeatureSelection): IrrigationPageId {
  return enabled.includes('arrosages') ? 'arrosages' : 'planning';
}

function irrigationLine(
  event: IrrigationEventRecord,
  tone: Exclude<TodayIrrigationTone, 'proposed'>,
  context: { today: string; bedNames: ReadonlyMap<string, string>; page: IrrigationPageId },
): TodayIrrigationLine {
  const equipment = event.equipment;
  const doses = equipment.applications.map((application) => application.plannedAmountMm).filter((value) => Number.isFinite(value));
  const dose = doses.length > 0 ? Math.max(...doses) : null;
  const startAt = equipment.plannedStartAt ?? '';
  const bedIds = equipment.applications.map((application) => application.otfBedId);
  const beds = bedsText(bedIds, context.bedNames);
  return {
    key: `irrigation:${equipment.id}`,
    eventEquipmentId: equipment.id,
    time: timeText(startAt, context.today),
    title: `${equipment.equipmentSnapshot.name} · ${equipment.settingSnapshot.name}`,
    detail: detailText([beds, durationText(equipment.plannedDurationSeconds), dose === null ? null : mmText(dose)]),
    status: STATUS_TEXT[tone],
    tone,
    canStart: true,
    open: { page: context.page, anchor: irrigationAnchor(equipment.id) },
    ...drawn({ startAt, durationSeconds: equipment.plannedDurationSeconds, doseMm: dose, bedIds, beds }),
    equipmentName: equipment.equipmentSnapshot.name,
    settingName: equipment.settingSnapshot.name,
    equipmentKind: equipment.equipmentSnapshot.kind,
  };
}

/** Les valeurs que l'écran dessine (la frise, les étiquettes), à côté des phrases. */
function drawn(input: { startAt: string; durationSeconds: number; doseMm: number | null; bedIds: string[]; beds: string }) {
  return {
    startAt: input.startAt,
    day: farmDateKey(input.startAt),
    hour: farmHourText(input.startAt),
    durationSeconds: input.durationSeconds,
    durationText: durationText(input.durationSeconds),
    doseMm: input.doseMm,
    doseText: input.doseMm === null ? null : mmText(input.doseMm),
    bedsText: input.beds,
    bedIds: input.bedIds,
  };
}

function byPlannedStart(a: IrrigationEventRecord, b: IrrigationEventRecord): number {
  return (a.equipment.plannedStartAt ?? '').localeCompare(b.equipment.plannedStartAt ?? '');
}

/**
 * Bloc b : les irrigations « En retard » (la tolérance R14 passée) et « Non
 * faites » (tout le créneau passé), quel que soit leur jour, les plus
 * anciennes d'abord.
 */
export function lateIrrigationLines(input: {
  enabled: FeatureSelection;
  now: Date;
  events: readonly IrrigationEventRecord[];
  lateToleranceMinutes: number;
  bedNames: ReadonlyMap<string, string>;
}): TodayIrrigationLine[] {
  const context = { today: farmDateKey(input.now), bedNames: input.bedNames, page: irrigationPage(input.enabled) };
  return input.events
    .filter(isWaitingPlannedIrrigation)
    .map((event) => ({ event, lateness: plannedIrrigationLateness(event, input.lateToleranceMinutes, input.now) }))
    .filter((item) => item.lateness !== null)
    .sort((a, b) => byPlannedStart(a.event, b.event))
    .map(({ event, lateness }) => irrigationLine(event, lateness === 'missed' ? 'missed' : 'late', context));
}

/**
 * Bloc c : les irrigations planifiées du jour qui ne sont pas en retard, et
 * les propositions du jour encore à valider, par heure de début. Une
 * proposition validée est déjà une irrigation planifiée : elle n'est pas
 * comptée deux fois.
 */
export function todayTodoLines(input: {
  enabled: FeatureSelection;
  now: Date;
  events: readonly IrrigationEventRecord[];
  lateToleranceMinutes: number;
  /** `null` quand le planning n'est pas coché. */
  proposals: readonly StoredProposal[] | null;
  bedNames: ReadonlyMap<string, string>;
}): TodayIrrigationLine[] {
  const today = farmDateKey(input.now);
  const context = { today, bedNames: input.bedNames, page: irrigationPage(input.enabled) };
  const planned = input.events
    .filter(isWaitingPlannedIrrigation)
    .filter((event) => farmDateKey(event.equipment.plannedStartAt ?? '') === today)
    .filter((event) => plannedIrrigationLateness(event, input.lateToleranceMinutes, input.now) === null)
    .map((event) => ({ startAt: event.equipment.plannedStartAt ?? '', line: irrigationLine(event, 'planned', context) }));
  const proposals = (input.proposals ?? [])
    .filter((proposal) => effectiveProposalStatus(proposal, input.now) === 'proposed')
    .filter((proposal) => farmDateKey(proposal.startAt) === today)
    .map((proposal) => {
      const bedIds = proposal.applications.map((application) => application.otfBedId);
      const beds = bedsText(bedIds, input.bedNames);
      return {
        startAt: proposal.startAt,
        line: {
          key: `proposal:${proposal.storedId}`,
          eventEquipmentId: null,
          time: timeText(proposal.startAt, today),
          title: `${proposal.equipmentName} · ${proposal.settingName}`,
          detail: detailText([beds, durationText(proposal.durationSeconds), mmText(proposal.doseMm)]),
          status: STATUS_TEXT.proposed,
          tone: 'proposed',
          canStart: false,
          open: { page: 'planning', anchor: proposalAnchor(proposal.storedId) },
          ...drawn({ startAt: proposal.startAt, durationSeconds: proposal.durationSeconds, doseMm: proposal.doseMm, bedIds, beds }),
          equipmentName: proposal.equipmentName,
          settingName: proposal.settingName,
          equipmentKind: null,
        } satisfies TodayIrrigationLine,
      };
    });
  return [...planned, ...proposals]
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.line.key.localeCompare(b.line.key))
    .map((item) => item.line);
}

export const NOTHING_LATE = 'Aucune irrigation en retard.';
export const NOTHING_TO_DO = 'Rien à faire aujourd’hui.';
