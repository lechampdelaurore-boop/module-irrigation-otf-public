import { roundToDecimals } from './irrigation-format.ts';
import type { IrrigationHistoryExportData } from './irrigation-history/contract';
import { dateKeyInTimeZone } from './water-management.ts';
import { seriesNamesOccupyingBedsOn } from './series/lookup.ts';

const HEADERS = [
  'Type de ligne',
  'Date début période',
  'Date fin période',
  'Saison',
  'Ferme',
  'Niveau de filtre',
  'Parcelle filtrée',
  'Jardin filtré',
  'Planche filtrée',
  'Volume irrigation (m3)',
  'Apport irrigation (mm)',
  'Surface irriguée (m2)',
  'Pluie réelle (mm)',
  'ET0 (mm)',
  'Objectif hydrique (mm)',
  'Irrigation + pluie réelle (mm)',
  "Écart à l'objectif (mm)",
  'Identifiant irrigation',
  'Identifiant matériel historique',
  'Date irrigation',
  'Début prévu',
  'Fin prévue',
  'Début réel',
  'Fin réelle',
  'Durée réelle (secondes)',
  'Statut',
  'Mode',
  'Parcelle',
  'Jardin(s)',
  'Planche(s)',
  'Séries',
  'Matériel',
  'Réglage',
  'Placement',
  'Volume réel dans la période (m3)',
  'Apport réel dans la période (mm)',
  'Surface concernée (m2)',
  'Objectif initial (mm)',
  'Partielle',
  'Arrêt anticipé',
  'Annulée',
  'Chronologie',
  'Note',
] as const;

export function buildIrrigationHistoryCsv(data: IrrigationHistoryExportData) {
  const context = csvContext(data);
  const summary = data.summary;
  const rows: CsvRow[] = [{
    ...context,
    'Type de ligne': 'Résumé de période',
    'Volume irrigation (m3)': numberValue(summary.irrigationCubicMeters),
    'Apport irrigation (mm)': numberValue(summary.irrigationMm),
    'Surface irriguée (m2)': numberValue(summary.irrigatedAreaSquareMeters),
    'Pluie réelle (mm)': numberValue(summary.actualRainMm),
    'ET0 (mm)': numberValue(summary.et0Mm),
    'Objectif hydrique (mm)': numberValue(summary.objectiveMm),
    'Irrigation + pluie réelle (mm)': numberValue(summary.irrigationAndRainMm),
    "Écart à l'objectif (mm)": numberValue(summary.gapToObjectiveMm),
  }];

  for (const item of data.items) {
    rows.push({
      ...context,
      'Type de ligne': 'Irrigation',
      'Identifiant irrigation': item.id,
      'Identifiant matériel historique': item.eventEquipmentId,
      'Date irrigation': item.date,
      'Début prévu': item.plannedStartAt ?? '',
      'Fin prévue': item.plannedEndAt ?? '',
      'Début réel': item.actualStartAt ?? '',
      'Fin réelle': item.actualEndAt ?? '',
      'Durée réelle (secondes)': String(item.actualDurationSeconds),
      Statut: item.statusLabel,
      Mode: item.modeLabel,
      Parcelle: item.zoneName ?? '',
      'Jardin(s)': item.plotNames.join(' | '),
      'Planche(s)': item.bedNames.join(' | '),
      // Les séries qui occupaient les planches arrosées le jour de l'irrigation (docs/series-contract.md).
      Séries: seriesNamesOccupyingBedsOn(data.snapshot.cropPlan, item.bedIds, dateKeyInTimeZone(item.date)).join(' | '),
      Matériel: item.equipmentName,
      Réglage: item.settingName,
      Placement: item.placementLabel,
      'Volume réel dans la période (m3)': numberValue(item.actualCubicMeters),
      'Apport réel dans la période (mm)': numberValue(item.actualAmountMm),
      'Surface concernée (m2)': numberValue(item.irrigatedAreaSquareMeters),
      'Objectif initial (mm)': numberValue(item.initialObjectiveMm),
      Partielle: yesNo(item.partial),
      'Arrêt anticipé': yesNo(item.stoppedEarly),
      Annulée: yesNo(item.canceled),
      Chronologie: item.timeline.map((entry) => `${entry.at} — ${entry.label}`).join(' | '),
      Note: item.note ?? '',
    });
  }

  return `\uFEFF${[
    HEADERS.join(';'),
    ...rows.map((row) => HEADERS.map((header) => escapeCsv(row[header] ?? '')).join(';')),
  ].join('\r\n')}\r\n`;
}

export function irrigationHistoryCsvFileName(data: IrrigationHistoryExportData) {
  return `irrigation-${data.season}-${data.period.startDate}-${data.period.endDate}.csv`;
}

type CsvRow = Partial<Record<(typeof HEADERS)[number], string>>;

function csvContext(data: IrrigationHistoryExportData): CsvRow {
  const zone = data.scope.zoneId
    ? data.snapshot.zones.find((item) => item.id === data.scope.zoneId)?.name ?? data.scope.zoneId
    : '';
  const plot = data.scope.plotId
    ? data.snapshot.plots.find((item) => item.id === data.scope.plotId)?.name ?? data.scope.plotId
    : '';
  const bed = data.scope.bedId
    ? data.snapshot.beds.find((item) => item.id === data.scope.bedId)?.name ?? data.scope.bedId
    : '';
  return {
    'Date début période': data.period.startDate,
    'Date fin période': data.period.endDate,
    Saison: String(data.season),
    Ferme: data.farmName,
    'Niveau de filtre': scopeLevelLabel(data.scope.level),
    'Parcelle filtrée': zone,
    'Jardin filtré': plot,
    'Planche filtrée': bed,
  };
}

function scopeLevelLabel(level: IrrigationHistoryExportData['scope']['level']) {
  if (level === 'farm') return 'Ferme';
  if (level === 'zone') return 'Parcelle';
  if (level === 'plot') return 'Jardin';
  return 'Planche';
}

function numberValue(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? ''
    : String(roundToDecimals(value, 3)).replace('.', ',');
}

function yesNo(value: boolean) {
  return value ? 'Oui' : 'Non';
}

function escapeCsv(value: string) {
  return /[;"\r\n]/.test(value)
    ? `"${value.replaceAll('"', '""')}"`
    : value;
}
