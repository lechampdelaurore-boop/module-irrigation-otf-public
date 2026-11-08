import { FARM_TIME_ZONE } from '../water-management.ts';
import { protectedSlotsPhrase } from './follow-up.ts';
import { minutesFromTimeInput, timeInputFromMinutes } from './presentation.ts';
import {
  WEEKDAYS,
  protectedNamesBetween,
  type ProtectedSlot,
  type ProtectedSlotChange,
  type ProtectedSlotDraft,
  type ProtectedSlotVersion,
  type Weekday,
} from './protected-slots.ts';

/**
 * L'écran des créneaux protégés (docs/protected-slots-contract.md, section 7
 * et règle 12) : la ligne d'un créneau dans « Réglages du planning », son
 * formulaire et ce qu'il devient à l'enregistrement, la ligne d'une version
 * de son journal, et l'avertissement d'un arrosage planifié à la main qui
 * tombe dans un créneau protégé. Des libellés et des conversions, testés ;
 * la vérification reste celle du domaine (`validateProtectedSlotDraft`), que
 * le dépôt refait avant d'écrire.
 */

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'lundi',
  tuesday: 'mardi',
  wednesday: 'mercredi',
  thursday: 'jeudi',
  friday: 'vendredi',
  saturday: 'samedi',
  sunday: 'dimanche',
};

const PROTECTED_SLOT_CHANGE_LABELS: Record<ProtectedSlotChange, string> = {
  created: 'Créé',
  updated: 'Modifié',
  deleted: 'Supprimé',
};

/** « tous les jours », « mardi », « mardi et jeudi », « lundi, mercredi et vendredi ». */
export function protectedSlotDaysLabel(weekdays: readonly Weekday[]): string {
  const days = WEEKDAYS.filter((day) => weekdays.includes(day)).map((day) => WEEKDAY_LABELS[day]);
  if (days.length === WEEKDAYS.length) return 'tous les jours';
  if (days.length < 2) return days[0] ?? 'aucun jour';
  return `${days.slice(0, -1).join(', ')} et ${days[days.length - 1]}`;
}

/** « de 21:00 à 23:00 » ; une fin avant le début passe minuit (règle 3) : « de 22:00 à 02:00 le lendemain ». */
export function protectedSlotHoursLabel(slot: Pick<ProtectedSlot, 'startMinute' | 'endMinute'>): string {
  const hours = `de ${timeInputFromMinutes(slot.startMinute)} à ${timeInputFromMinutes(slot.endMinute)}`;
  return slot.endMinute < slot.startMinute ? `${hours} le lendemain` : hours;
}

/** La ligne d'un créneau dans la liste : « Lavage · mardi et jeudi · de 21:00 à 23:00 ». */
export function protectedSlotLine(slot: Pick<ProtectedSlot, 'name' | 'weekdays' | 'startMinute' | 'endMinute'>): string {
  return `${slot.name} · ${protectedSlotDaysLabel(slot.weekdays)} · ${protectedSlotHoursLabel(slot)}`;
}

/** Une version du journal, sans nommer personne : « Modifié : Lavage · mardi · de 21:00 à 23:00 ». */
export function protectedSlotVersionLine(version: Pick<ProtectedSlotVersion, 'change' | 'name' | 'weekdays' | 'startMinute' | 'endMinute'>): string {
  return `${PROTECTED_SLOT_CHANGE_LABELS[version.change]} : ${protectedSlotLine(version)}`;
}

/** Ce qui précède la liste des messages d'un créneau refusé, à l'écran comme au retour du serveur. */
export const PROTECTED_SLOT_REFUSED = 'Le créneau protégé n’est pas enregistré :';

/** Le formulaire d'un créneau tel que l'écran le tient : un nom, sept cases, deux heures `HH:MM`. */
export type ProtectedSlotForm = { name: string; weekdays: Record<Weekday, boolean>; start: string; end: string };

/** Le formulaire d'un créneau existant, ou d'un créneau nouveau : ni nom, ni jour, ni heure, rien de deviné. */
export function protectedSlotForm(slot: Pick<ProtectedSlot, 'name' | 'weekdays' | 'startMinute' | 'endMinute'> | null = null): ProtectedSlotForm {
  const weekdays = Object.fromEntries(WEEKDAYS.map((day) => [day, slot?.weekdays.includes(day) ?? false])) as Record<Weekday, boolean>;
  return {
    name: slot?.name ?? '',
    weekdays,
    start: slot ? timeInputFromMinutes(slot.startMinute) : '',
    end: slot ? timeInputFromMinutes(slot.endMinute) : '',
  };
}

/** Le créneau saisi, à vérifier : une heure illisible devient `NaN`, que la vérification refuse avec son message ; rien n'est corrigé. */
export function protectedSlotDraftFromForm(form: ProtectedSlotForm): ProtectedSlotDraft {
  return {
    name: form.name,
    weekdays: WEEKDAYS.filter((day) => form.weekdays[day]),
    startMinute: minutesFromTimeInput(form.start) ?? Number.NaN,
    endMinute: minutesFromTimeInput(form.end) ?? Number.NaN,
  };
}

/**
 * L'avertissement d'un arrosage planifié à la main qui tombe, même en partie,
 * dans un créneau protégé (règle 12) : il n'est pas bloqué, le maraîcher
 * décide ; seul le moteur s'interdit ces heures. `null` hors de tout créneau,
 * ou tant que le début et la durée ne se lisent pas.
 */
export function manualSlotProtectedWarning(slots: readonly ProtectedSlot[], startMs: number, endMs: number, timeZone = FARM_TIME_ZONE): string | null {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const names = protectedNamesBetween(slots, new Date(startMs), new Date(endMs), timeZone);
  if (names.length === 0) return null;
  return `Cet arrosage tombe dans ${protectedSlotsPhrase(names)} : le planning n’y propose jamais d’arrosage. Vous pouvez l’enregistrer quand même.`;
}
