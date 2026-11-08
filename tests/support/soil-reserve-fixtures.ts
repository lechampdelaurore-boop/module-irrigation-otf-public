import type { CropWaterDay, DayEt0 } from '../../lib/domain/crop-water/etm.ts';
import type { BedWaterDay } from '../../lib/domain/crop-water/proposal.ts';
import type { StagedDay } from '../../lib/domain/crop-water/stage.ts';
import type { SurfaceDeclaration } from '../../lib/domain/soil-reserve/bare-soil.ts';
import type { BedSoilInput, DayRain, IrrigationInterval, SoilObservation } from '../../lib/domain/soil-reserve/gauge.ts';
import type { RootingProfile, RootingStage } from '../../lib/domain/soil-reserve/rooting.ts';
import { SOIL_DEFAULTS, type SoilRecord, type SoilSettingsRevision } from '../../lib/domain/soil-reserve/soil.ts';
import { addDaysToDateKey } from '../../lib/domain/water-management.ts';

/**
 * Les données des scénarios de la réserve du sol
 * (docs/soil-reserve-contract.md, « Scénarios chiffrés ») : une planche, ses
 * jours avec l'ETM et les cultures que la 5 quater lui donne, le sol de sa
 * parcelle et les profils racinaires. Ce sont des données de test.
 */

export const BED = { id: 'planche-a', zoneId: 'parcelle', plotId: 'jardin', sheltered: false };
export const SHELTER_BED = { id: 'planche-abri', zoneId: 'parcelle', plotId: 'abri', sheltered: true };

/** Un sol de parcelle ; 62 mm/m sans cailloux par défaut, la valeur d'exemple des scénarios 1 à 9. */
export function soilRecord(overrides: Partial<SoilRecord> = {}): SoilRecord {
  return {
    zoneId: BED.zoneId,
    plotId: null,
    labRfuMmPerMeter: 62,
    stoneSharePercent: 0,
    referenceShare: SOIL_DEFAULTS.referenceShare,
    provenance: 'analysis',
    sampledDepthCm: 20,
    source: 'Celesta-lab, 31 mars 2025',
    tewMm: SOIL_DEFAULTS.tewMm,
    rewMm: SOIL_DEFAULTS.rewMm,
    surfaceLayerCm: SOIL_DEFAULTS.surfaceLayerCm,
    soilDepthCeilingM: null,
    effectiveFrom: '2026-01-01',
    recordedAt: '2026-01-01T08:00:00.000Z',
    ...overrides,
  };
}

/** La ferme du porteur : 62 mm/m au laboratoire, 18 % de cailloux, 51 mm/m (scénarios 10 à 41). */
export const FARM_SOIL = soilRecord({ stoneSharePercent: 18, provenance: 'estimate' });

export function profile(referenceCropId: string, p: number | null, stages: RootingStage[]): RootingProfile {
  return {
    referenceCropId,
    p,
    stages,
    source: 'test',
    note: null,
    effectiveFrom: '2026-01-01',
    recordedAt: '2026-01-01T08:00:00.000Z',
  };
}

export const fixed = (rank: number | null, depthM: number): RootingStage => ({ rank, depthM, endDepthM: null, progressionDays: null });
export const progressive = (rank: number | null, depthM: number, endDepthM: number, progressionDays: number): RootingStage => (
  { rank, depthM, endDepthM, progressionDays }
);

/** Une culture d'exemple à 50 cm, p 0,4, au stade 2 (scénarios 1 à 9). */
const SAMPLE_CROP = profile('exemple', 0.4, [fixed(1, 0.3), fixed(2, 0.5)]);

export function staged(rank: number, startedOn: string, extra: Partial<StagedDay> = {}): StagedDay {
  return {
    status: 'staged',
    rank,
    label: `Stade ${rank}`,
    origin: 'calculated',
    declaration: null,
    startedOn,
    estimated: false,
    nextChange: null,
    waitingForHarvest: false,
    position: { shape: 'steps', rank },
    ...extra,
  };
}

type CropOptions = {
  referenceCropId?: string;
  name?: string;
  rank?: number;
  startedOn?: string;
  stage?: StagedDay;
  etmMm?: number | null;
  kc?: number;
};

/** Une culture sur la planche un jour donné, comme la 5 quater la rend. */
export function crop(options: CropOptions = {}): CropWaterDay {
  const referenceCropId = options.referenceCropId ?? 'exemple';
  const name = options.name ?? referenceCropId;
  const stage = options.stage ?? staged(options.rank ?? 2, options.startedOn ?? '2026-01-01');
  const kc = options.kc ?? 1;
  const identity = { seriesId: `serie-${referenceCropId}`, seriesName: `Série ${name}`, cultivationId: `c-${referenceCropId}`, plantId: `p-${referenceCropId}`, plantName: name };
  const trace = {
    referenceCropId,
    referenceCropName: name,
    source: 'criiam' as const,
    analogy: false,
    exception: false,
    stage,
    firstStage: stage.rank === 1,
    kc: { kc, referenceKc: kc, overridden: false, abatement: 1, smoothed: false },
    shelterFactor: 1,
    mulchFactor: 1,
    shadeFactor: 1,
    shadeNetRate: null,
  };
  if (options.etmMm === null) return { ...identity, status: 'unknown', trace };
  return { ...identity, status: 'computed', etmMm: options.etmMm ?? 0, et0: { mm: options.etmMm ?? 0, nature: 'reanalysis' }, irrigationStop: kc === 0, trace };
}

/** Une culture sans Kc : rattachée à « sans référence ». */
export function cropWithoutKc(name: string): CropWaterDay {
  return { seriesId: `serie-${name}`, seriesName: `Série ${name}`, cultivationId: `c-${name}`, plantId: `p-${name}`, plantName: name, status: 'no-etm', reason: 'without-reference' };
}

/** Le jour d'une planche cultivée : l'ETM la plus élevée de ses cultures, inconnue si l'une l'est. */
export function cropDay(date: string, crops: CropWaterDay[], et0: DayEt0 | null = { mm: 4, nature: 'reanalysis' }): BedWaterDay {
  const base = { date, et0, crops, problems: [] };
  if (crops.some((item) => item.status === 'no-etm')) {
    const computed = crops.filter((item) => item.status === 'computed');
    return { ...base, status: computed.length > 0 ? 'partial' : 'no-etm', etmMm: null, irrigationStop: false };
  }
  if (crops.some((item) => item.status === 'unknown')) return { ...base, status: 'unknown', etmMm: null, irrigationStop: false };
  const etms = crops.map((item) => (item.status === 'computed' ? item.etmMm : 0));
  return {
    ...base,
    status: 'computed',
    etmMm: Math.max(...etms),
    irrigationStop: crops.every((item) => item.status === 'computed' && item.irrigationStop),
  };
}

/** Le jour d'une planche sans culture, avec l'ET0 du jour. */
export function bareDay(date: string, et0Mm: number | null, crops: CropWaterDay[] = []): BedWaterDay {
  return { date, status: 'no-crop', etmMm: 0, et0: et0Mm === null ? null : { mm: et0Mm, nature: 'reanalysis' }, crops, irrigationStop: false, problems: [] };
}

export function dates(first: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDaysToDateKey(first, index));
}

export function rain(entries: Record<string, number>, nature: DayRain['nature'] = 'gauge'): Map<string, DayRain> {
  return new Map(Object.entries(entries).map(([date, mm]) => [date, { mm, nature }]));
}

/** Pas de pluie, jour par jour, au pluviomètre. */
export function dryDays(days: readonly string[]): Map<string, DayRain> {
  return rain(Object.fromEntries(days.map((date) => [date, 0])));
}

export function observation(percent: number, observedAt: string, plotId: string | null = BED.plotId, zoneId = BED.zoneId): SoilObservation {
  return { zoneId, plotId, percent, observedAt, recordedAt: observedAt };
}

export function irrigation(startAt: string, endAt: string, mm: number, nature: IrrigationInterval['nature'] = 'actual'): IrrigationInterval {
  return { startAt, endAt, mm, nature };
}

export function declaration(date: string, state: SurfaceDeclaration['state'], bedId = BED.id): SurfaceDeclaration {
  return { bedId, date, state, recordedAt: `${date}T08:00:00.000Z` };
}

export function farmThreshold(percent: number): SoilSettingsRevision {
  return {
    threshold: { mode: 'farm', percent },
    surface: {
      permeableTarpEvaporation: 0.1,
      mulchedEvaporation: 0.5,
      greenManureEmergenceKc: 0.3,
      greenManurePartialKc: 0.6,
      greenManureFullKc: 1,
      grassKc: 0.6,
    },
    plasticMulchRainShare: 1,
    effectiveFrom: '2026-01-01',
    recordedAt: '2026-01-01T08:00:00.000Z',
  };
}

/** L'entrée de la jauge d'une planche, à compléter par chaque scénario. */
export function soilInput(overrides: Partial<BedSoilInput> & Pick<BedSoilInput, 'waterDays'>): BedSoilInput {
  return {
    bed: BED,
    today: '2026-12-31',
    rain: dryDays(overrides.waterDays.map((day) => day.date)),
    irrigations: [],
    soilRecords: [soilRecord()],
    rootingProfiles: [SAMPLE_CROP],
    referenceCrops: [],
    upcomingCrops: [],
    observations: [],
    surfaceDeclarations: [],
    settings: [],
    waterSettings: { bedId: BED.id, shelterId: null, shelterFactors: [], mulch: [] },
    forecastRainShare: 1,
    ...overrides,
  };
}
