'use client';
import { FARM_TIME_ZONE } from '@/lib/domain/water-management';
import { millimetersText, volumeText } from '@/lib/domain/display-numbers';

/**
 * Les formats de l'écran du planning : heures et dates à la ferme (D-004),
 * millimètres et volumes comme partout (lot E, J8), débits en français.
 * Aucune règle ici.
 */
const flow = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FARM_TIME_ZONE });
const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: FARM_TIME_ZONE });
const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDay = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const weekdayAndDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', timeZone: 'UTC' });

export function formatMm(value: number | null) {
  return value === null ? 'inconnu' : millimetersText(value);
}

export function formatVolume(value: number | null) {
  return value === null ? 'volume inconnu' : volumeText(value);
}

export function formatFlow(value: number | null) {
  return value === null ? 'débit inconnu' : `${flow.format(value)} m³/h`;
}

export function formatTime(iso: string) {
  return time.format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso));
}

/** Midi UTC : une date métier ne glisse pas d'un jour selon le fuseau du navigateur. */
export function formatLongDay(dateKey: string) {
  return longDay.format(new Date(`${dateKey}T12:00:00Z`));
}

/** « lundi 2 » : l'en-tête d'une colonne de la semaine en tableau (précision P46). */
export function formatWeekdayAndDay(dateKey: string) {
  return weekdayAndDay.format(new Date(`${dateKey}T12:00:00Z`));
}

export function formatShortDay(dateKey: string) {
  return shortDay.format(new Date(`${dateKey}T12:00:00Z`));
}

export function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}
