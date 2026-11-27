'use client';
import { FARM_TIME_ZONE } from '@/lib/domain/water-management';
import { millimetersText, volumeText } from '@/lib/domain/display-numbers';
import { clockText, dateClockText } from '@/lib/domain/clock-text';

/**
 * Les formats de l'écran du planning : heures et dates à la ferme (D-004),
 * millimètres et volumes comme partout (lot E, J8), débits en français.
 * Aucune règle ici.
 */
const flow = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const shortDay = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

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
  return clockText(iso, FARM_TIME_ZONE);
}

export function formatDateTime(iso: string) {
  return dateClockText(iso, FARM_TIME_ZONE);
}

/** Midi UTC : une date métier ne glisse pas d'un jour selon le fuseau du navigateur. */
export function formatShortDay(dateKey: string) {
  return shortDay.format(new Date(`${dateKey}T12:00:00Z`));
}

export function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}
