'use client';

import type { EquipmentSettingRecord } from '@/lib/domain/equipment-record';
import type { Bed, IrrigationSnapshot } from '@/lib/domain/domain';

export const numberFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 2,
});

const twoDecimalFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMeasure(value: number, unit: string, fixedTwoDecimals = false) {
  const formatter = fixedTwoDecimals ? twoDecimalFormatter : numberFormatter;
  return `${formatter.format(value)} ${unit}`;
}

export function formatOptionalMeasure(
  value: number | null,
  unit: string,
  fixedTwoDecimals = false,
) {
  return value === null ? 'Non renseigné' : formatMeasure(value, unit, fixedTwoDecimals);
}

export function createSeasons(first: number, last: number) {
  return Array.from({ length: last - first + 1 }, (_, index) => last - index);
}

export function settingSummary(setting: EquipmentSettingRecord) {
  if (setting.kind === 'drip') return `${numberFormatter.format(setting.rateMmPerHour)} mm/h`;
  const maxDistance = Math.max(
    setting.leftProfile.at(-1)?.distanceMeters ?? 0,
    setting.rightProfile.at(-1)?.distanceMeters ?? 0,
  );
  return `Portée renseignée jusqu’à ${numberFormatter.format(maxDistance)} m`;
}

export function sourceLabel(source: IrrigationSnapshot['source']) {
  if (source === 'live') return 'Données OTF à jour';
  if (source === 'cache') return 'Dernière lecture enregistrée';
  return 'Données de démonstration';
}

export function formatIrrigationRate(rateMmPerHour: number) {
  return `${numberFormatter.format(rateMmPerHour)} mm/h`;
}

export function bedAriaLabel(bed: Bed) {
  return [
    `Planche ${bed.name}`,
    formatMeasure(bed.length, 'm'),
    formatMeasure(bed.width, 'm', true),
    `passe-pied ${formatOptionalMeasure(bed.alleyWidth, 'm', true)}`,
  ].join(', ');
}

export function formatBedGroup(beds: Bed[]) {
  if (beds.length === 0) return 'Aucune dimension disponible';
  const first = beds[0];
  const sameDimensions = beds.every(
    (bed) => bed.length === first.length && bed.width === first.width,
  );
  const sameAlleyWidth = beds.every(
    (bed) => bed.alleyWidth === first.alleyWidth,
  );
  const dimensions = sameDimensions
    ? `${formatMeasure(first.length, 'm')} × ${formatMeasure(first.width, 'm', true)}`
    : 'Dimensions variables';
  const alley = sameAlleyWidth
    ? `passe-pied ${formatOptionalMeasure(first.alleyWidth, 'm', true)}`
    : 'passe-pieds variables';
  return `${dimensions} · ${alley}`;
}
