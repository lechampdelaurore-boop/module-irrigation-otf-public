import { MINUTES_PER_DAY } from '../units.ts';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../water-management.ts';
import type { TimeWindow } from './settings.ts';
import { windowIntervalForDay, type WindowInterval } from './windows.ts';

/**
 * Les créneaux protégés nommés (docs/protected-slots-contract.md, D-062) :
 * des plages horaires que l'exploitant nomme — « Lavage des légumes » —,
 * répétées chaque semaine les jours qu'il choisit, pour toute l'exploitation
 * et tout le matériel, pendant lesquelles le moteur ne place jamais
 * d'arrosage. Une plage qui passe minuit appartient au jour de son début,
 * comme une plage R8 : sa traduction en instants est celle de `windows.ts`,
 * reprise et non recopiée. Rien ici n'écrit ni ne place : la vérification
 * d'un créneau saisi, sa traduction en instants sur une période, l'union des
 * créneaux qui se chevauchent, le découpage d'une plage autour d'eux, et les
 * noms que la justification et le motif d'un besoin non placé donnent, les
 * créneaux en vigueur à un instant d'après leur journal et ceux où une
 * irrigation tombe. Le moteur (`engine.ts`) les retire des plages avant les
 * créneaux refusés ; les suggestions (`suggestions.ts`) et l'historique des
 * irrigations les lisent sur les arrosages déjà validés ou faits.
 */

/** Les jours de la semaine, du lundi au dimanche (D-004) ; ce sont aussi les colonnes de la base (migration 0030). */
export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Le jour de la semaine dans l'ordre de `Date.getUTCDay`, qui commence le dimanche. */
const WEEKDAY_BY_UTC_DAY: readonly Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Un créneau protégé (règle 1) : un nom, les jours où il commence, une heure de début et de fin à la minute ; `end < start` : il passe minuit (règle 3). */
export type ProtectedSlot = TimeWindow & {
  id: string;
  name: string;
  /** Les jours où il commence, dans l'ordre de la semaine. */
  weekdays: readonly Weekday[];
};

/** Un créneau tel que l'écran le saisit, avant vérification. */
export type ProtectedSlotDraft = { name: string; weekdays: readonly string[]; startMinute: number; endMinute: number };

/** Ce qu'une version du journal a fait au créneau (règle 7, migration 0030). */
export type ProtectedSlotChange = 'created' | 'updated' | 'deleted';

/** Une version du journal : le créneau tel qu'il était après ce geste, qui l'a fait et quand. */
export type ProtectedSlotVersion = ProtectedSlot & { change: ProtectedSlotChange; actorUserId: string; createdAt: string };

/** Un créneau saisi vérifié : nom nettoyé, jours sans doublon dans l'ordre de la semaine. */
type ValidProtectedSlotDraft = { name: string; weekdays: Weekday[]; startMinute: number; endMinute: number };

/** La longueur d'un nom, la même que celle d'un matériel ou d'un groupe de jardins. */
const MAX_PROTECTED_SLOT_NAME_LENGTH = 80;

/**
 * Vérifie un créneau saisi (règles 1 et 3) : un nom non vide, un jour au
 * moins, deux heures de la journée à la minute, différentes — une journée
 * entière se déclare 00 h 00 – 23 h 59. Le nom perd ses espaces en trop et
 * les jours se rangent dans l'ordre de la semaine ; rien d'autre n'est
 * corrigé : une valeur absurde est refusée avec son message.
 */
export function validateProtectedSlotDraft(input: ProtectedSlotDraft): { value: ValidProtectedSlotDraft; errors: [] } | { value: null; errors: string[] } {
  const errors: string[] = [];
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) errors.push('Donnez un nom au créneau protégé.');
  else if (name.length > MAX_PROTECTED_SLOT_NAME_LENGTH) errors.push(`Le nom du créneau ne peut pas dépasser ${MAX_PROTECTED_SLOT_NAME_LENGTH} caractères.`);

  const given = Array.isArray(input.weekdays) ? input.weekdays : [];
  if (given.some((day) => !(WEEKDAYS as readonly string[]).includes(day))) errors.push('Un jour de la semaine est inconnu.');
  const weekdays = WEEKDAYS.filter((day) => given.includes(day));
  if (weekdays.length === 0) errors.push('Choisissez au moins un jour de la semaine.');

  const startValid = isMinuteOfDay(input.startMinute);
  const endValid = isMinuteOfDay(input.endMinute);
  if (!startValid) errors.push('L’heure de début est une heure de la journée, à la minute.');
  if (!endValid) errors.push('L’heure de fin est une heure de la journée, à la minute.');
  if (startValid && endValid && input.startMinute === input.endMinute) {
    errors.push('Le début et la fin doivent être différents ; pour une journée entière, déclarez 00 h 00 – 23 h 59.');
  }
  if (errors.length > 0) return { value: null, errors };
  return { value: { name, weekdays, startMinute: input.startMinute, endMinute: input.endMinute }, errors: [] };
}

function isMinuteOfDay(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < MINUTES_PER_DAY;
}

/** Le jour de la semaine d'une date `AAAA-MM-JJ` du calendrier de la ferme. */
export function weekdayOfDateKey(dateKey: string): Weekday {
  return WEEKDAY_BY_UTC_DAY[new Date(`${dateKey}T12:00:00.000Z`).getUTCDay()];
}

/** Un créneau protégé en instants, ou l'union de plusieurs qui se chevauchent ou se touchent, avec leurs noms dans l'ordre du temps, sans doublon. */
export type ProtectedInterval = { startMs: number; endMs: number; names: readonly string[] };

/**
 * Les créneaux protégés en instants entre deux instants, réunis (règle 4) :
 * chaque créneau, chaque jour où il commence — la veille du premier jour
 * comprise, pour un créneau qui passe minuit —, aux heures murales de la
 * ferme (D-004), y compris les jours de changement d'heure. Les créneaux
 * qui se chevauchent ou se touchent n'en font qu'un, et chaque instant est
 * rogné à la période. Un créneau impossible — début égal à la fin, heure hors
 * de la journée —, que la saisie et la base refusent, n'exclut rien.
 */
export function protectedIntervalsBetween(slots: readonly ProtectedSlot[] | undefined, from: Date, to: Date, timeZone = FARM_TIME_ZONE): ProtectedInterval[] {
  const usable = (slots ?? []).filter((slot) => isMinuteOfDay(slot.startMinute) && isMinuteOfDay(slot.endMinute) && slot.startMinute !== slot.endMinute);
  if (usable.length === 0 || !(to > from)) return [];
  const pieces: { startMs: number; endMs: number; name: string }[] = [];
  const lastDay = dateKeyInTimeZone(to, timeZone);
  for (let day = addDaysToDateKey(dateKeyInTimeZone(from, timeZone), -1); day <= lastDay; day = addDaysToDateKey(day, 1)) {
    const weekday = weekdayOfDateKey(day);
    for (const slot of usable) {
      if (!slot.weekdays.includes(weekday)) continue;
      const interval = windowIntervalForDay(slot, day, timeZone);
      const startMs = Math.max(interval.startAt.getTime(), from.getTime());
      const endMs = Math.min(interval.endAt.getTime(), to.getTime());
      if (endMs > startMs) pieces.push({ startMs, endMs, name: slot.name });
    }
  }
  pieces.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.name.localeCompare(right.name, 'fr'));
  const merged: { startMs: number; endMs: number; names: string[] }[] = [];
  for (const piece of pieces) {
    const last = merged.at(-1);
    if (last && piece.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, piece.endMs);
      if (!last.names.includes(piece.name)) last.names.push(piece.name);
    } else {
      merged.push({ startMs: piece.startMs, endMs: piece.endMs, names: [piece.name] });
    }
  }
  return merged;
}

/** Le créneau protégé qui borne un morceau de plage : l'instant où il finit, ou commence, et ses noms. */
type ProtectedBound = { atMs: number; names: readonly string[] };

/**
 * Un morceau de plage utilisable (règle 6) : la plage R8 d'un jour moins les
 * créneaux protégés. Il garde le jour de planning de sa plage, la fin de la
 * plage entière, et les créneaux protégés qui le bornent, pour que la
 * justification et le motif les nomment.
 */
type UsableInterval = WindowInterval & {
  /** Le créneau protégé dont la fin ouvre ce morceau ; nul quand il commence avec sa plage. */
  afterProtected: ProtectedBound | null;
  /** Le créneau protégé dont le début ferme ce morceau ; nul quand il finit avec sa plage. */
  beforeProtected: ProtectedBound | null;
  /** La fin de la plage R8 entière : dit si, sans le créneau protégé, la place aurait suffi. */
  rangeEndAt: Date;
};

/**
 * Les plages moins les créneaux protégés (règle 6) : chaque plage est
 * découpée autour de chaque créneau protégé qui la recouvre, même en partie ;
 * les morceaux vides sont écartés et l'ordre du temps est gardé. Un créneau
 * qui touche une plage sans la recouvrir — il finit quand elle commence, ou
 * commence quand elle finit — ne l'entame pas. Aucun morceau ne saute un
 * créneau protégé : un arrosage tient dans un morceau, ou ne tient pas.
 */
export function withoutProtectedIntervals(intervals: readonly WindowInterval[], protectedIntervals: readonly ProtectedInterval[]): UsableInterval[] {
  const result: UsableInterval[] = [];
  for (const interval of intervals) {
    let pieces: UsableInterval[] = [{ ...interval, afterProtected: null, beforeProtected: null, rangeEndAt: interval.endAt }];
    for (const slot of protectedIntervals) {
      const next: UsableInterval[] = [];
      for (const piece of pieces) {
        const startMs = piece.startAt.getTime();
        const endMs = piece.endAt.getTime();
        if (slot.endMs <= startMs || slot.startMs >= endMs) {
          next.push(piece);
          continue;
        }
        if (slot.startMs > startMs) next.push({ ...piece, endAt: new Date(slot.startMs), beforeProtected: { atMs: slot.startMs, names: slot.names } });
        if (slot.endMs < endMs) next.push({ ...piece, startAt: new Date(slot.endMs), afterProtected: { atMs: slot.endMs, names: slot.names } });
      }
      pieces = next;
    }
    result.push(...pieces);
  }
  return result;
}

/**
 * Le morceau commence à la fin d'un créneau protégé. L'instant compte, pas
 * seulement la marque : un refus qui recoupe le morceau ensuite (D-030) lui
 * donne un autre début, et c'est alors le refus qui l'a repoussé.
 */
export function startsAfterProtected(interval: UsableInterval): boolean {
  return interval.afterProtected !== null && interval.afterProtected.atMs === interval.startAt.getTime();
}

/** Le morceau finit au début d'un créneau protégé, à l'instant près, comme pour son début. */
export function endsBeforeProtected(interval: UsableInterval): boolean {
  return interval.beforeProtected !== null && interval.beforeProtected.atMs === interval.endAt.getTime();
}

/** Les noms des créneaux protégés qui bornent un créneau placé : celui qui a repoussé son début, celui qui a coupé sa dose. */
export function boundingProtectedNames(interval: UsableInterval, bounds: { start: boolean; end: boolean }): string[] {
  const names = [...(bounds.start ? interval.afterProtected?.names ?? [] : []), ...(bounds.end ? interval.beforeProtected?.names ?? [] : [])];
  return names.filter((name, index) => names.indexOf(name) === index);
}

/** Les noms des créneaux protégés qui prennent du temps à ces plages, dans l'ordre du temps, sans doublon : ceux que le motif nomme. */
export function protectedNamesWithin(intervals: readonly WindowInterval[], protectedIntervals: readonly ProtectedInterval[]): string[] {
  const names: string[] = [];
  for (const slot of protectedIntervals) {
    if (!intervals.some((interval) => slot.startMs < interval.endAt.getTime() && slot.endMs > interval.startAt.getTime())) continue;
    for (const name of slot.names) if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** Les noms des créneaux protégés où tombe un intervalle de temps, même en partie, dans l'ordre du temps, sans doublon. */
export function protectedNamesBetween(slots: readonly ProtectedSlot[] | undefined, from: Date, to: Date, timeZone = FARM_TIME_ZONE): string[] {
  const names = protectedIntervalsBetween(slots, from, to, timeZone).flatMap((interval) => interval.names);
  return names.filter((name, index) => names.indexOf(name) === index);
}

/**
 * Les créneaux protégés en vigueur à un instant, d'après leur journal
 * (règle 7) : pour chaque créneau, sa dernière version enregistrée jusqu'à
 * cet instant, s'il n'était pas supprimé. Le journal se lit du plus récent
 * au plus ancien, comme le dépôt le rend (docs/revision-order-contract.md).
 */
export function protectedSlotsInForceAt(versions: readonly ProtectedSlotVersion[], at: Date): ProtectedSlot[] {
  const seen = new Set<string>();
  const slots: ProtectedSlot[] = [];
  for (const version of versions) {
    if (seen.has(version.id) || !(Date.parse(version.createdAt) <= at.getTime())) continue;
    seen.add(version.id);
    if (version.change !== 'deleted') slots.push({ id: version.id, name: version.name, weekdays: version.weekdays, startMinute: version.startMinute, endMinute: version.endMinute });
  }
  return slots;
}
