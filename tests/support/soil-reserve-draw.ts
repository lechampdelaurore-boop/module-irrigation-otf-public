import type { CropWaterDay } from '../../lib/domain/crop-water/etm.ts';
import type { BedWaterDay } from '../../lib/domain/crop-water/proposal.ts';
import type { SurfaceDeclaration, SurfaceState } from '../../lib/domain/soil-reserve/bare-soil.ts';
import { dayGaps } from '../../lib/domain/soil-reserve/gauge-comparison.ts';
import { bedSoilReserve, dayBounds, type BedSoilInput, type DayRain, type IrrigationInterval, type SoilObservation, type SoilReserveDay } from '../../lib/domain/soil-reserve/gauge.ts';
import type { RootingProfile, RootingStage } from '../../lib/domain/soil-reserve/rooting.ts';
import { SOIL_DEFAULTS, soilRfuMmPerMeter, type SoilRecord, type SoilSettingsRevision } from '../../lib/domain/soil-reserve/soil.ts';
import { addDaysToDateKey } from '../../lib/domain/water-management.ts';
import { CARROT, TOMATO } from './crop-water-references.ts';
import {
  BED,
  bareDay,
  crop,
  cropDay,
  cropWithoutKc,
  dates,
  fixed,
  irrigation,
  observation,
  profile,
  progressive,
  SHELTER_BED,
  soilInput,
  soilRecord,
  staged,
} from './soil-reserve-fixtures.ts';

/**
 * Des planches tirées au hasard, à graine fixe, pour comparer les deux calculs
 * de la jauge (docs/shared-engine-adapter-contract.md, « L'interrupteur et la
 * preuve d'égalité ») : cultures, engrais verts, enherbée et sol nu mêlés,
 * jours sans sol, observations, apports, pluies et ETM manquantes, abri,
 * paillage, changements d'heure. Une graine redonne les mêmes planches.
 * Ce sont des données de test.
 */

type Draw = {
  real: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  coin: (probability: number) => boolean;
  pick: <T>(list: readonly T[]) => T;
};

/** Un tirage à graine (mulberry32), comme le script de comparaison du dépôt commun. */
function seededDraw(seed: number): Draw {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    real: (min, max) => min + (max - min) * next(),
    int,
    coin: (probability) => next() < probability,
    pick: (list) => list[int(0, list.length - 1)],
  };
}

const MINUTE_MS = 60_000;
const DAY_MINUTES = 1440;
const HALF_DAY_MINUTES = 720;
const PERCENT = 100;
/** Les changements d'heure de 2026 et 2027 à la ferme : des journées de 23 et 25 heures. */
const CLOCK_CHANGES = ['2026-03-29', '2026-10-25', '2027-03-28', '2027-10-31'];
const SURFACE_STATES: readonly SurfaceState[] = [
  'bare', 'impermeable-tarp', 'permeable-tarp', 'mulched', 'green-manure-emergence',
  'green-manure-partial', 'green-manure-full', 'green-manure-destroyed', 'grass',
];
const DEPTHS = [0.2, 0.3, 0.4, 0.5, 0.8];
const GREEN_MANURE: CropWaterDay = { seriesId: 'ev', seriesName: 'Engrais vert', cultivationId: 'ev-c', plantId: 'p-phacelie', plantName: 'Phacélie', status: 'surface-state' };

/** Une planche sur des jours consécutifs, avec tout ce qui fait varier la jauge. */
function drawBedInput(d: Draw): BedSoilInput {
  const first = d.coin(0.35) ? addDaysToDateKey(d.pick(CLOCK_CHANGES), -d.int(0, 6)) : addDaysToDateKey('2026-01-05', d.int(0, 690));
  const days = dates(first, d.int(4, 40));
  const anyDay = () => days[d.int(0, days.length - 1)];
  const today = d.pick([first, anyDay(), anyDay(), addDaysToDateKey(days[days.length - 1], 1), addDaysToDateKey(first, -1)]);
  const bed = d.coin(0.2) ? SHELTER_BED : BED;
  // Des suites sans trou de données, d'autres avec peu ou beaucoup : des états suivis longtemps et des redémarrages.
  const holes = d.pick([0, 0.25, 1]);
  const soilRecords = drawSoils(d, bed, days);
  const observations = drawObservations(d, bed, days);
  const season = Number(first.slice(0, 4));
  return soilInput({
    bed,
    today,
    waterDays: drawWaterDays(d, days, holes),
    rain: drawRain(d, days, holes, soilRecords),
    irrigations: drawIrrigations(d, days, observations, soilRecords),
    soilRecords,
    rootingProfiles: [CARROT.id, TOMATO.id].flatMap((id) => drawProfiles(d, id, anyDay)),
    referenceCrops: [CARROT, TOMATO],
    upcomingCrops: Array.from({ length: d.int(0, 2) }, () => ({
      presenceStart: addDaysToDateKey(first, d.int(-5, days.length + 10)),
      referenceCropId: d.pick([CARROT.id, TOMATO.id, null]),
    })),
    observations,
    surfaceDeclarations: drawDeclarations(d, bed, days),
    settings: drawSettings(d, days),
    waterSettings: {
      bedId: bed.id,
      shelterId: bed.sheltered ? bed.plotId : null,
      shelterFactors: bed.sheltered && d.coin(0.5)
        ? [{ shelterId: bed.plotId, value: d.real(0.6, 1), effectiveFrom: d.pick([addDaysToDateKey(first, -1), anyDay()]), recordedAt: `${first}T07:00:00.000Z` }]
        : [],
      mulch: d.coin(0.4) ? [{ bedId: bed.id, season: d.pick([season, season + 1]), plasticMulch: true }] : [],
    },
    forecastRainShare: d.pick([1, 1, 0.8, 0.5, 0, d.real(0, 1)]),
  });
}

/** Une à trois révisions du sol ; parfois rien les premiers jours (« no-soil »), parfois un sol de jardin. */
function drawSoils(d: Draw, bed: BedSoilInput['bed'], days: readonly string[]): SoilRecord[] {
  const records: SoilRecord[] = [];
  const count = d.int(1, 3);
  for (let index = 0; index < count; index += 1) {
    const effectiveFrom = index === 0
      ? (d.coin(0.15) ? days[d.int(1, Math.min(5, days.length - 1))] : addDaysToDateKey(days[0], -d.int(0, 30)))
      : days[d.int(0, days.length - 1)];
    const tewMm = d.pick([SOIL_DEFAULTS.tewMm, d.int(6, 25)]);
    records.push(soilRecord({
      plotId: d.coin(0.25) ? bed.plotId : null,
      labRfuMmPerMeter: d.int(20, 160),
      stoneSharePercent: d.pick([0, 0, null, d.int(0, 50)]),
      referenceShare: d.pick([SOIL_DEFAULTS.referenceShare, d.real(0.4, 0.95)]),
      soilDepthCeilingM: d.pick([null, null, d.pick([0.2, 0.25, 0.35, 0.6, 1])]),
      tewMm,
      rewMm: d.pick([Math.min(SOIL_DEFAULTS.rewMm, tewMm - 1), d.real(1, tewMm - 0.5)]),
      surfaceLayerCm: d.pick([SOIL_DEFAULTS.surfaceLayerCm, 5, 15]),
      effectiveFrom,
      recordedAt: `${effectiveFrom}T0${index}:00:00.000Z`,
    }));
  }
  return records;
}

function drawStages(d: Draw): RootingStage[] {
  const rows: RootingStage[] = [];
  for (const rank of [1, 2, 3]) {
    if (d.coin(0.15)) continue; // pas de ligne : celle de tous les stades, ou 30 cm proposés
    rows.push(d.coin(0.3) ? progressive(rank, d.pick(DEPTHS), d.pick(DEPTHS), d.int(1, 20)) : fixed(rank, d.pick(DEPTHS)));
  }
  if (d.coin(0.3)) rows.push(fixed(null, d.pick(DEPTHS)));
  return rows;
}

/** Le profil racinaire d'une culture de référence, parfois révisé en cours de route. */
function drawProfiles(d: Draw, id: string, anyDay: () => string): RootingProfile[] {
  const profiles = [profile(id, d.pick([null, 0.4, d.real(0.2, 0.7)]), drawStages(d))];
  if (d.coin(0.2)) {
    const effectiveFrom = anyDay();
    profiles.push({ ...profile(id, d.pick([null, d.real(0.2, 0.7)]), drawStages(d)), effectiveFrom, recordedAt: `${effectiveFrom}T09:00:00.000Z` });
  }
  return profiles;
}

/**
 * Les jours de la planche : des périodes cultivées (une ou deux cultures dont
 * le stade change) et des périodes sans culture, parfois avec un engrais vert,
 * leur ET0 parfois inconnue.
 */
function drawWaterDays(d: Draw, days: readonly string[], holes: number): BedWaterDay[] {
  const crops = (d.coin(0.3) ? [CARROT.id, TOMATO.id] : [d.pick([CARROT.id, TOMATO.id])]).map((id) => ({
    id,
    rank: d.int(1, 3),
    stageStart: addDaysToDateKey(days[0], -d.int(0, 25)),
    changes: new Set(Array.from({ length: d.int(0, 2) }, () => days[d.int(0, days.length - 1)])),
  }));
  const greenManure = d.coin(0.4);
  let cropped = d.coin(0.5);
  return days.map((date) => {
    if (d.coin(0.12)) cropped = !cropped;
    if (!cropped) {
      const et0Mm = d.coin(0.1 * holes) ? null : d.pick([0, d.real(0, 7), Math.round(d.real(0, 7) * 10) / 10]);
      return bareDay(date, et0Mm, greenManure ? [GREEN_MANURE] : []);
    }
    const day = cropDay(date, crops.map((item) => {
      if (item.changes.has(date)) {
        item.rank = Math.min(3, item.rank + 1);
        item.stageStart = date;
      }
      const u = d.real(0, 1);
      if (u < 0.04 * holes) return cropWithoutKc(`sans-kc-${item.id}`);
      const etmMm = u < 0.11 * holes ? null : d.pick([0, Math.round(d.real(0, 8) * 100) / 100, d.real(0, 12)]);
      return crop({ referenceCropId: item.id, stage: staged(item.rank, item.stageStart), etmMm });
    }));
    return d.coin(0.03 * holes) ? { ...day, status: 'blocked', etmMm: null, problems: ['ET0 hors bornes'] } : day;
  });
}

/** Les états de surface déclarés, parfois avant le premier jour, parfois d'une autre planche. */
function drawDeclarations(d: Draw, bed: BedSoilInput['bed'], days: readonly string[]): SurfaceDeclaration[] {
  const declarations: SurfaceDeclaration[] = [];
  for (let index = d.pick([0, 1, 2, 3, 5]); index > 0; index -= 1) {
    const date = d.coin(0.2) ? addDaysToDateKey(days[0], -d.int(1, 10)) : days[d.int(0, days.length - 1)];
    declarations.push({ bedId: d.coin(0.05) ? 'autre-planche' : bed.id, date, state: d.pick(SURFACE_STATES), recordedAt: `${date}T0${index}:00:00.000Z` });
  }
  return declarations;
}

/** Des pluies qui remplissent tout juste la planche, l'égalité qui fait repartir, et des jours sans pluie connue. */
function drawRain(d: Draw, days: readonly string[], holes: number, soils: readonly SoilRecord[]): Map<string, DayRain> {
  const rain = new Map<string, DayRain>();
  for (const date of days) {
    if (d.coin(0.08 * holes)) continue;
    rain.set(date, { mm: d.coin(0.5) ? 0 : drawMm(d, 40, soils), nature: d.pick(['gauge', 'reanalysis', 'estimated', 'forecast'] as const) });
  }
  return rain;
}

function drawMm(d: Draw, max: number, soils: readonly SoilRecord[]): number {
  const fills = soils.flatMap((soil) => [0.2, 0.3, 0.4, 0.5].map((depthM) => soilRfuMmPerMeter(soil.labRfuMmPerMeter, soil.stoneSharePercent) * depthM));
  return d.pick([0, d.real(0, max), Math.round(d.real(0, max) * 10) / 10, d.pick(fills)]);
}

/** Un instant tiré à la minute, de 12 h avant le premier jour à 12 h après le dernier. */
function drawInstant(d: Draw, days: readonly string[]): number {
  return dayBounds(days[0]).from + d.int(-HALF_DAY_MINUTES, days.length * DAY_MINUTES + HALF_DAY_MINUTES) * MINUTE_MS;
}

/** Des réglages du curseur : du jardin, de la parcelle, d'ailleurs ; parfois deux au même instant. */
function drawObservations(d: Draw, bed: BedSoilInput['bed'], days: readonly string[]): SoilObservation[] {
  const observations: SoilObservation[] = [];
  for (let index = d.pick([0, 0, 1, 1, 2, 4]); index > 0; index -= 1) {
    const at = d.coin(0.1) ? dayBounds(days[d.int(0, days.length - 1)]).from : drawInstant(d, days);
    const observedAt = new Date(at).toISOString();
    const plotId = d.pick([bed.plotId, bed.plotId, bed.plotId, bed.plotId, null, null, 'autre-jardin']);
    const zoneId = d.coin(0.05) ? 'autre-parcelle' : bed.zoneId;
    const percent = d.pick([0, PERCENT, d.int(0, PERCENT), d.real(0, PERCENT)]);
    const recordedAt = new Date(at + d.pick([0, 0, d.int(1, 600)]) * MINUTE_MS).toISOString();
    observations.push({ ...observation(percent, observedAt, plotId, zoneId), recordedAt });
    if (d.coin(0.15)) {
      const again = d.pick([recordedAt, new Date(at + d.int(1, 600) * MINUTE_MS).toISOString()]);
      observations.push({ ...observation(d.int(0, PERCENT), observedAt, plotId, zoneId), recordedAt: again });
    }
  }
  return observations;
}

/** Des apports ponctuels, à l'envers ou étalés, parfois pile à l'heure d'une observation ou à minuit. */
function drawIrrigations(d: Draw, days: readonly string[], observations: readonly SoilObservation[], soils: readonly SoilRecord[]): IrrigationInterval[] {
  const marks = [...observations.map((item) => Date.parse(item.observedAt)), ...days.map((date) => dayBounds(date).from)];
  const irrigations: IrrigationInterval[] = [];
  for (let index = d.int(0, 8); index > 0; index -= 1) {
    const start = d.coin(0.2) ? d.pick(marks) : drawInstant(d, days);
    const shape = d.int(0, 9);
    const end = shape === 0 ? start : shape === 1 ? start - d.int(1, 120) * MINUTE_MS
      : start + (shape < 6 ? d.int(1, 120) : d.int(2, 30) * 30) * MINUTE_MS;
    irrigations.push(irrigation(new Date(start).toISOString(), new Date(end).toISOString(), drawMm(d, 35, soils), d.pick(['actual', 'planned', 'proposed'] as const)));
  }
  return irrigations;
}

/** Les réglages de l'exploitation : seuil, coefficients des états de surface, pluie sous paillage plastique. */
function drawSettings(d: Draw, days: readonly string[]): SoilSettingsRevision[] {
  const revisions: SoilSettingsRevision[] = [];
  for (let index = d.pick([0, 0, 1, 2]); index > 0; index -= 1) {
    const effectiveFrom = d.pick([addDaysToDateKey(days[0], -1), days[d.int(0, days.length - 1)]]);
    revisions.push({
      threshold: d.coin(0.5) ? { mode: 'farm', percent: d.pick([20, 50, 80]) } : { mode: 'crop' },
      surface: {
        permeableTarpEvaporation: d.pick([0.1, 0, d.real(0, 1)]),
        mulchedEvaporation: d.pick([0.5, 0, d.real(0, 1)]),
        greenManureEmergenceKc: d.real(0, 1.3),
        greenManurePartialKc: d.real(0, 1.3),
        greenManureFullKc: d.real(0, 1.3),
        grassKc: d.pick([0.6, 0, d.real(0, 1.3)]),
      },
      plasticMulchRainShare: d.pick([1, 0.5, 0, d.real(0, 1)]),
      effectiveFrom,
      recordedAt: `${effectiveFrom}T10:0${index}:00.000Z`,
    });
  }
  return revisions;
}

/** Ce que la comparaison a vu et ce qui s'écarte, pour la preuve d'égalité. */
export type EngineComparison = {
  beds: number;
  days: number;
  /** Ce que les planches tirées ont couvert, compté sur l'ancien calcul : chaque cas doit être joué. */
  seen: Record<string, number>;
  maxGap: number;
  gaps: { bed: number; date: string; field: string; module: unknown; commun: unknown }[];
};

/** Compare les deux calculs sur `beds` planches tirées depuis une graine ; un écart au-delà de `tolerance` est relevé. */
export function compareEnginesOnDrawnBeds(seed: number, beds: number, tolerance: number): EngineComparison {
  const d = seededDraw(seed);
  const result: EngineComparison = { beds: 0, days: 0, seen: {}, maxGap: 0, gaps: [] };
  for (let bed = 0; bed < beds; bed += 1) {
    const input = drawBedInput(d);
    const reference = bedSoilReserve(input, 'module');
    const other = bedSoilReserve(input, 'commun');
    result.beds += 1;
    if (input.bed.sheltered) see(result, 'planches sous abri');
    if (reference.length !== other.length) result.gaps.push({ bed, date: '', field: 'days', module: reference.length, commun: other.length });
    reference.forEach((day, index) => {
      result.days += 1;
      countDay(result, day, reference[index - 1]);
      const compared = other[index];
      if (compared === undefined) return;
      const { gaps, maxGap } = dayGaps(day, compared, tolerance);
      result.maxGap = Math.max(result.maxGap, maxGap);
      for (const gap of gaps) result.gaps.push({ bed, date: day.date, field: gap.field, module: gap.reference, commun: gap.other });
    });
  }
  return result;
}

const ONE_COMPARTMENT = new Set(['crop', 'cover']);

function countDay(result: EngineComparison, day: SoilReserveDay, previous: SoilReserveDay | undefined): void {
  see(result, day.mode === null ? 'jours sans sol' : `jours en mode ${day.mode}`);
  see(result, day.stateMm === null ? `jours inconnus : ${day.unknown?.kind}` : 'jours connus');
  if (day.restart !== null) see(result, `départs : ${day.restart}`);
  if (day.nature === 'forecast') see(result, 'jours prévus');
  const { from, to } = dayBounds(day.date);
  if (to - from !== DAY_MINUTES * MINUTE_MS) see(result, 'jours de changement d’heure');
  if (previous === undefined || previous.stateMm === null || day.mode === null) return;
  const fromOne = ONE_COMPARTMENT.has(previous.mode ?? '');
  const toOne = ONE_COMPARTMENT.has(day.mode);
  if (previous.mode === 'bare' && toOne) see(result, 'passages du sol nu à un compartiment');
  if (fromOne && day.mode === 'bare') see(result, 'passages d’un compartiment au sol nu');
  if (fromOne && toOne && previous.capacityMm !== day.capacityMm) see(result, 'changements de capacité dans un tronçon');
}

function see(result: EngineComparison, what: string): void {
  result.seen[what] = (result.seen[what] ?? 0) + 1;
}
