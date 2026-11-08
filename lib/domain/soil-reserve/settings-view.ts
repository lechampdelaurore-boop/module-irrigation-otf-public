import type { Plot, Season, Zone } from '../domain.ts';
import {
  DEFAULT_SOIL_SETTINGS,
  labRfuWarning,
  latestEffective,
  soilRfuMmPerMeter,
  type SoilRecord,
  type SoilSettings,
  type SoilSettingsRevision,
} from './soil.ts';

/**
 * Ce que les réglages de la réserve du sol montrent (docs/soil-reserve-contract.md,
 * « L'écran », 5 ter, PR 3a) : par parcelle, le sol saisi et la RFU du sol
 * calculée, avec l'avertissement de vraisemblance ; par jardin ou abri, sa
 * valeur propre ou celle de sa parcelle ; pour l'exploitation, le seuil
 * d'arrosage (D-059), les coefficients des états de surface et la part de
 * pluie sous paillage plastique. Rien n'est réécrit : chaque saisie est une
 * révision datée, l'histoire reste lisible.
 */

export type SoilRecordView = {
  record: SoilRecord;
  soilRfuMmPerMeter: number;
  warning: string | null;
};

export type PlaceSoil = {
  /** La saisie qui vaut aujourd'hui ; `null` : rien de saisi pour ce lieu. */
  current: SoilRecordView | null;
  /** Toutes les saisies du lieu, la plus récente d'abord, à venir comprises. */
  history: SoilRecordView[];
};

type PlotSoilSetting = { plotId: string; name: string; sheltered: boolean; soil: PlaceSoil };

export type ZoneSoilSetting = { zoneId: string; name: string; soil: PlaceSoil; plots: PlotSoilSetting[] };

export type SoilSettingsView = {
  today: string;
  zones: ZoneSoilSetting[];
  farm: { current: SoilSettings; isDefault: boolean; history: SoilSettingsRevision[] };
};

export function soilSettingsView(input: {
  zones: readonly Zone[];
  plots: readonly Plot[];
  season: Season;
  records: readonly SoilRecord[];
  settings: readonly SoilSettingsRevision[];
  today: string;
}): SoilSettingsView {
  const place = (zoneId: string, plotId: string | null): PlaceSoil => {
    const own = input.records.filter((record) => record.zoneId === zoneId && record.plotId === plotId);
    const current = latestEffective(own, input.today);
    return {
      current: current ? recordView(current) : null,
      history: [...own].sort(newestFirst).map(recordView),
    };
  };
  const inForce = latestEffective(input.settings, input.today);
  return {
    today: input.today,
    zones: input.zones
      .filter((zone) => zone.seasons.includes(input.season))
      .map((zone) => ({
        zoneId: zone.id,
        name: zone.name,
        soil: place(zone.id, null),
        plots: input.plots
          .filter((plot) => plot.zoneId === zone.id && plot.seasons.includes(input.season))
          .map((plot) => ({ plotId: plot.id, name: plot.name, sheltered: plot.mode === 'greenhouse', soil: place(zone.id, plot.id) })),
      })),
    farm: {
      current: inForce ? withoutDates(inForce) : DEFAULT_SOIL_SETTINGS,
      isDefault: inForce === null,
      history: [...input.settings].sort(newestFirst),
    },
  };
}

function recordView(record: SoilRecord): SoilRecordView {
  return {
    record,
    soilRfuMmPerMeter: soilRfuMmPerMeter(record.labRfuMmPerMeter, record.stoneSharePercent),
    warning: labRfuWarning(record.labRfuMmPerMeter),
  };
}

function newestFirst(a: { effectiveFrom: string; recordedAt: string }, b: { effectiveFrom: string; recordedAt: string }): number {
  return b.effectiveFrom.localeCompare(a.effectiveFrom) || b.recordedAt.localeCompare(a.recordedAt);
}

function withoutDates(revision: SoilSettingsRevision): SoilSettings {
  return { threshold: revision.threshold, surface: revision.surface, plasticMulchRainShare: revision.plasticMulchRainShare };
}

/**
 * Une part saisie à l'écran : une fraction (« 2/3 »), un nombre décimal à
 * virgule ou à point (« 0,5 ») ; `null` quand le texte ne se lit pas.
 */
export function parseShare(text: string): number | null {
  const trimmed = text.trim().replace(/\s/g, '');
  const fraction = /^(\d+)\/(\d+)$/.exec(trimmed);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? Number(fraction[1]) / denominator : null;
  }
  return parseDecimal(trimmed);
}

/** Un nombre saisi à l'écran, à virgule ou à point ; `null` quand le texte ne se lit pas ou est vide. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

const shareFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const FRACTIONS = [[1, 2], [2, 3], [1, 3], [3, 4], [1, 4]] as const;
const SHARE_TOLERANCE = 1e-9;

/** Une part de référence, écrite comme une fraction simple quand elle en est une (« 2/3 »), sinon en décimal. */
export function shareLabel(share: number): string {
  const fraction = FRACTIONS.find(([top, bottom]) => Math.abs(share - top / bottom) < SHARE_TOLERANCE);
  return fraction ? `${fraction[0]}/${fraction[1]}` : shareFormat.format(share);
}
