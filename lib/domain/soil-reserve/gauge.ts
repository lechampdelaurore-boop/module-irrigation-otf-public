import type { ReferenceCrop } from '../crop-water/reference.ts';
import { plasticMulchOn, shelterFactorOn, type BedWaterSettings, type CropWaterDay } from '../crop-water/etm.ts';
import type { BedWaterDay } from '../crop-water/proposal.ts';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, localDateStartUtc } from '../water-management.ts';
import {
  bareSoilCapacity,
  bareSoilDay,
  bareSoilFillMm,
  bareSoilGauge,
  bareSoilGeometry,
  coverKc,
  evaporationShare,
  splitFullness,
  surfaceRainShare,
  surfaceStateHasThreshold,
  surfaceStateModel,
  type BareSoilGeometry,
  type BareSoilState,
  type SurfaceDeclaration,
  type SurfaceState,
} from './bare-soil.ts';
import {
  cappedDepth,
  cropRooting,
  cropThresholdPercent,
  DEFAULT_P,
  firstStageDepth,
  PROPOSED_DEPTH_M,
  rootingProfileOn,
  thresholdMm,
  type RootingProfile,
} from './rooting.ts';
import { PERCENT, resolveBedSoil, soilSettingsOn, type ResolvedSoil, type SoilRecord, type SoilSettings, type SoilSettingsRevision } from './soil.ts';

/**
 * La jauge de la réserve du sol d'une planche, jour par jour
 * (docs/soil-reserve-contract.md, « Le calcul de la jauge », D-041, D-047,
 * D-053, D-056, D-057, D-059).
 *
 * Elle part d'une observation du maraîcher, ou d'un jour d'apports qui
 * remplit la planche, puis suit la pluie, l'irrigation et la consommation —
 * l'ETM de la 5 quater sur une planche cultivée, l'évaporation du sol nu ou
 * la consommation d'un couvert sinon — bornée à 0 et à la capacité ; l'eau
 * au-delà est drainée. Elle est inconnue au départ et à partir d'un trou de
 * données, jamais inventée (D-003) ; estimée avant aujourd'hui, prévue
 * ensuite (D-006). C'est une information : elle n'entre ni dans le besoin,
 * ni dans le planning, ni dans la dose (D-028, D-047).
 */

type RainNature = 'gauge' | 'reanalysis' | 'estimated' | 'forecast';

/** La pluie extérieure d'un jour, en mm, et sa nature : pluviomètre, réanalyse, prévision enregistrée d'un jour passé, prévision. */
export type DayRain = { mm: number; nature: RainNature };

/** Un apport d'irrigation sur la planche, en mm sur sa surface mouillée, comme le besoin le compte. */
export type IrrigationInterval = { startAt: string; endAt: string; mm: number; nature: 'actual' | 'planned' | 'proposed' };

/** Un réglage du curseur : `plotId` nul, la parcelle entière, qui ne règle que ses jardins de plein champ (D-053). */
export type SoilObservation = { zoneId: string; plotId: string | null; percent: number; observedAt: string; recordedAt: string };

export type BedSoilInput = {
  bed: { id: string; zoneId: string; plotId: string; sheltered: boolean };
  /** Aujourd'hui à la ferme : les jours d'avant sont estimés, aujourd'hui et la suite prévus. */
  today: string;
  /** Les jours suivis, consécutifs, avec l'ETM de la planche et ses cultures (5 quater). */
  waterDays: readonly BedWaterDay[];
  /** La pluie extérieure par jour ; un jour absent : pluie inconnue. Sous abri, elle n'est pas lue. */
  rain: ReadonlyMap<string, DayRain>;
  irrigations: readonly IrrigationInterval[];
  soilRecords: readonly SoilRecord[];
  rootingProfiles: readonly RootingProfile[];
  referenceCrops: readonly ReferenceCrop[];
  /** Les cultures de la planche et leur premier jour, pour la profondeur de référence d'une planche sans culture. */
  upcomingCrops: readonly { presenceStart: string; referenceCropId: string | null }[];
  observations: readonly SoilObservation[];
  surfaceDeclarations: readonly SurfaceDeclaration[];
  settings: readonly SoilSettingsRevision[];
  waterSettings: Pick<BedWaterSettings, 'bedId' | 'shelterId' | 'shelterFactors' | 'mulch'>;
  /** R2 du planning : la part de la pluie prévue retenue, de 0 à 1. */
  forecastRainShare: number;
};

export type UnknownReason =
  | { kind: 'no-soil' }
  | { kind: 'not-started' }
  | { kind: 'missing-rain'; date: string }
  | { kind: 'missing-et0'; date: string }
  | { kind: 'crop-without-etm'; date: string; crops: { seriesName: string; plantName: string }[] }
  | { kind: 'blocked'; date: string; problems: string[] };

type GaugeMode = 'crop' | 'bare' | 'cover';

type SoilCrop = {
  seriesName: string;
  plantName: string;
  referenceCropName: string;
  depthM: number;
  proposedDepth: boolean;
  p: number;
  defaultP: boolean;
};

export type SoilReserveDay = {
  date: string;
  nature: 'estimated' | 'forecast';
  mode: GaugeMode | null;
  /** L'état de surface d'une planche sans culture, et s'il a été déclaré. */
  surfaceState: SurfaceState | null;
  surfaceStateDeclared: boolean;
  /** Le jour de la déclaration de l'état en cours : la date de pose d'une bâche. */
  surfaceStateSince: string | null;
  depthM: number | null;
  capacityMm: number | null;
  p: number | null;
  thresholdMm: number | null;
  /** Le seuil selon la culture, en % du plein, quand l'exploitation règle le sien (D-059). */
  cropThresholdPercent: number | null;
  crops: SoilCrop[];
  irrigationStop: boolean;
  /** L'état au début du jour, après un changement de capacité ; `null` : inconnu. */
  startMm: number | null;
  bareStart: BareSoilState | null;
  /** L'état à la fin du jour. */
  stateMm: number | null;
  percent: number | null;
  bare: BareSoilState | null;
  geometry: BareSoilGeometry | null;
  drainageMm: number;
  /** La pluie comptée, part du jour et réductions appliquées ; `null` : inconnue. */
  rainMm: number | null;
  rainNature: RainNature | null;
  irrigationMm: number;
  consumptionMm: number | null;
  observation: SoilObservation | null;
  /** Le jour de l'observation ne compte qu'après son heure : la part du jour qui reste, de 0 à 1. */
  fraction: number;
  restart: 'observation' | 'inflow' | null;
  unknown: UnknownReason | null;
  mentions: { stonesMissing: boolean; mulchRainShare: number | null; weeds: boolean };
};

type Carry = { mode: GaugeMode; capacityMm: number; stateMm: number; bare: BareSoilState | null; geometry: BareSoilGeometry | null; surfaceState: SurfaceState | null };

/** La jauge d'une planche sur les jours suivis. */
export function bedSoilReserve(input: BedSoilInput): SoilReserveDay[] {
  const result: SoilReserveDay[] = [];
  let carry: Carry | null = null;
  let reason: UnknownReason = { kind: 'not-started' };
  let lastCropDate: string | null = null;
  for (const water of input.waterDays) {
    const date = water.date;
    const soil = resolveBedSoil(input.soilRecords, input.bed, date);
    const settings = soilSettingsOn(input.settings, date);
    const hasCrop = water.status !== 'no-crop';
    const surface = hasCrop ? null : surfaceStateOf(input, water, date, lastCropDate);
    if (hasCrop) lastCropDate = date;
    if (soil === null) {
      result.push(emptyDay(input, water, { kind: 'no-soil' }));
      carry = null;
      reason = { kind: 'not-started' };
      continue;
    }
    const day = computeDay({ input, water, soil, settings, surface, carry, reason });
    result.push(day.output);
    carry = day.carry;
    reason = day.reason;
  }
  return result;
}

type DayContext = {
  input: BedSoilInput;
  water: BedWaterDay;
  soil: ResolvedSoil;
  settings: SoilSettings;
  surface: { state: SurfaceState; declared: boolean; since: string | null } | null;
  carry: Carry | null;
  reason: UnknownReason;
};

function computeDay(context: DayContext): { output: SoilReserveDay; carry: Carry | null; reason: UnknownReason } {
  const { input, water, soil, settings, surface } = context;
  const date = water.date;
  const record = soil.record;
  const mode: GaugeMode = surface === null ? 'crop' : surfaceStateModel(surface.state) === 'cover' ? 'cover' : 'bare';
  const crops = mode === 'crop' ? soilCrops(input, water) : [];
  const shape = dayShape({ input, mode, soil, crops, surface, date });
  const threshold = shape.capacityMm !== null && shape.p !== null
    ? thresholdMm(shape.capacityMm, shape.p, record.referenceShare, settings.threshold)
    : null;
  const mulched = mode === 'crop' && plasticMulchOn(input.waterSettings, date);

  const base: SoilReserveDay = {
    ...emptyDay(input, water, null),
    mode,
    surfaceState: surface?.state ?? null,
    surfaceStateDeclared: surface?.declared ?? false,
    surfaceStateSince: surface?.since ?? null,
    depthM: shape.depthM,
    capacityMm: shape.capacityMm,
    p: shape.p,
    thresholdMm: threshold,
    cropThresholdPercent: settings.threshold.mode === 'farm' && shape.p !== null ? cropThresholdPercent(shape.p, record.referenceShare) : null,
    crops,
    irrigationStop: mode === 'crop' && water.irrigationStop,
    geometry: shape.geometry,
    mentions: { stonesMissing: soil.stonesMissing, mulchRainShare: mulched ? settings.plasticMulchRainShare : null, weeds: surface?.state === 'grass' },
  };

  // Changement de capacité : la jauge garde son % du plein (règle 7, passages entre culture et sol nu).
  let start = context.carry === null || shape.capacityMm === null ? null : carried(context.carry, shape, surface?.state ?? null);

  // Le jour d'une observation ne compte qu'après son heure.
  const { from, to } = dayBounds(date);
  const observation = latestObservation(input, date);
  let fraction = 1;
  let restart: SoilReserveDay['restart'] = null;
  if (observation !== null && shape.capacityMm !== null) {
    const observedAt = Date.parse(observation.observedAt);
    fraction = Math.max(0, Math.min(1, (to - observedAt) / (to - from)));
    start = fromFullness(shape, observation.percent / PERCENT);
    restart = 'observation';
  }
  const irrigationFrom = observation !== null && restart === 'observation' ? Date.parse(observation.observedAt) : from;
  const irrigationMm = irrigationBetween(input.irrigations, irrigationFrom, to);

  // Les données du jour : la pluie (sauf sous abri ou bâche imperméable) et la consommation.
  const rain = rainOfDay(input, date, mode, surface?.state ?? null, mulched ? settings.plasticMulchRainShare : 1);
  const consumption = consumptionOfDay(water, mode, surface?.state ?? null, settings, shelterFactorOn(input.waterSettings, date));
  const gap = dataGap(date, rain, consumption, shape.capacityMm);
  const rainMm = rain.mm === null ? null : rain.mm * fraction;
  const known = { ...base, rainMm, rainNature: rain.nature, irrigationMm, consumptionMm: consumption.mm === null ? null : consumption.mm * fraction, observation: restart ? observation : null, fraction };

  if (gap !== null || start === null) {
    // Inconnue : elle repart à la fin d'un jour d'apports qui remplit la planche.
    const fillMm = shape.capacityMm === null ? null : shape.geometry ? bareSoilFillMm(shape.geometry) : shape.capacityMm;
    const inflow = (rainMm ?? 0) + irrigationMm;
    const full = fillMm !== null && inflow >= fillMm ? fromFullness(shape, 1) : null;
    if (full !== null && fillMm !== null) {
      const output = finish({ ...known, restart: 'inflow' }, shape, full, Math.max(0, inflow - fillMm));
      return { output, carry: toCarry(output, shape, surface?.state ?? null), reason: { kind: 'not-started' } };
    }
    // Un trou de données se nomme dès qu'il y avait de quoi partir : un état
    // de la veille, ou une observation du jour qui n'a pas pu servir faute de
    // capacité — une culture sans Kc ou sans stade (précision de la PR 3b).
    const unknown = gap !== null && (start !== null || context.carry !== null || observation !== null) ? gap : context.reason;
    return { output: { ...known, startMm: null, unknown, restart: null }, carry: null, reason: unknown };
  }

  const inflowMm = (rainMm ?? 0) + irrigationMm;
  const consumed = (consumption.mm ?? 0) * fraction;
  if (shape.geometry !== null && start.bare !== null) {
    const bareDay = bareSoilDay({
      geometry: shape.geometry,
      previous: start.bare,
      inflowMm,
      et0Mm: water.et0?.mm ?? 0,
      shelterFactor: shelterFactorOn(input.waterSettings, date),
      evaporationShare: evaporationShare(surface?.state ?? 'bare', settings.surface),
      fraction,
    });
    const output = finish(
      { ...known, consumptionMm: bareDay.evaporationMm, startMm: start.mm, bareStart: start.bare, restart },
      shape,
      { mm: bareSoilGauge(shape.geometry, bareDay.state), bare: bareDay.state },
      bareDay.drainageMm,
    );
    return { output, carry: toCarry(output, shape, surface?.state ?? null), reason: { kind: 'not-started' } };
  }
  const capacity = shape.capacityMm ?? 0;
  const balance = start.mm + inflowMm - consumed;
  const output = finish(
    { ...known, startMm: start.mm, restart },
    shape,
    { mm: Math.min(capacity, Math.max(0, balance)), bare: null },
    Math.max(0, balance - capacity),
  );
  return { output, carry: toCarry(output, shape, surface?.state ?? null), reason: { kind: 'not-started' } };
}

type DayShape = { depthM: number | null; capacityMm: number | null; p: number | null; geometry: BareSoilGeometry | null };
type GaugeState = { mm: number; bare: BareSoilState | null };

/** La profondeur, la capacité et la part p du jour, selon le mode. */
function dayShape(input: {
  input: BedSoilInput;
  mode: GaugeMode;
  soil: ResolvedSoil;
  crops: readonly SoilCrop[];
  surface: { state: SurfaceState } | null;
  date: string;
}): DayShape {
  const { soil, mode } = input;
  const rfu = soil.soilRfuMmPerMeter;
  const ceiling = soil.record.soilDepthCeilingM;
  if (mode === 'crop') {
    if (input.crops.length === 0) return { depthM: null, capacityMm: null, p: null, geometry: null };
    // Plusieurs cultures : la moins profonde fixe la capacité, la plus sensible le seuil (D-053).
    const depthM = cappedDepth(Math.min(...input.crops.map((crop) => crop.depthM)), ceiling);
    return { depthM, capacityMm: rfu * depthM, p: Math.min(...input.crops.map((crop) => crop.p)), geometry: null };
  }
  if (mode === 'cover') {
    const depthM = cappedDepth(PROPOSED_DEPTH_M, ceiling);
    const p = input.surface && surfaceStateHasThreshold(input.surface.state) ? DEFAULT_P : null;
    return { depthM, capacityMm: rfu * depthM, p, geometry: null };
  }
  const depthM = cappedDepth(referenceDepth(input.input, input.date), ceiling);
  const geometry = bareSoilGeometry({
    soilRfuMmPerMeter: rfu,
    depthM,
    surfaceLayerCm: soil.record.surfaceLayerCm,
    tewMm: soil.record.tewMm,
    rewMm: soil.record.rewMm,
  });
  return { depthM, capacityMm: bareSoilCapacity(geometry), p: null, geometry };
}

/** La profondeur de référence d'une planche sans culture : le premier stade de sa prochaine culture connue, sinon 30 cm. */
function referenceDepth(input: BedSoilInput, date: string): number {
  const next = input.upcomingCrops
    .filter((crop) => crop.presenceStart > date)
    .sort((a, b) => a.presenceStart.localeCompare(b.presenceStart))[0];
  const crop = next?.referenceCropId ? input.referenceCrops.find((candidate) => candidate.id === next.referenceCropId) : undefined;
  if (!next || !crop) return PROPOSED_DEPTH_M;
  return firstStageDepth(rootingProfileOn(input.rootingProfiles, crop.id, date), crop).depthM;
}

/** Les cultures de la planche ce jour-là, avec leur profondeur au stade du jour et leur part p. */
function soilCrops(input: BedSoilInput, water: BedWaterDay): SoilCrop[] {
  return water.crops.flatMap((crop): SoilCrop[] => {
    if (crop.status !== 'computed' && crop.status !== 'unknown') return [];
    const profile = rootingProfileOn(input.rootingProfiles, crop.trace.referenceCropId, water.date);
    const rooting = cropRooting(profile, crop.trace.stage, water.date);
    return [{
      seriesName: crop.seriesName,
      plantName: crop.plantName,
      referenceCropName: crop.trace.referenceCropName,
      depthM: rooting.depthM,
      proposedDepth: rooting.proposedDepth,
      p: rooting.p,
      defaultP: rooting.defaultP,
    }];
  });
}

/**
 * L'état de surface d'une planche sans culture : la dernière déclaration
 * depuis la fin de sa dernière culture ; sans elle, l'engrais vert levé
 * quand une série d'engrais vert occupe la planche, sinon « nue » (D-053).
 */
function surfaceStateOf(
  input: BedSoilInput,
  water: BedWaterDay,
  date: string,
  lastCropDate: string | null,
): { state: SurfaceState; declared: boolean; since: string | null } {
  let chosen: SurfaceDeclaration | null = null;
  for (const declaration of input.surfaceDeclarations) {
    if (declaration.bedId !== input.bed.id || declaration.date > date) continue;
    if (lastCropDate !== null && declaration.date <= lastCropDate) continue;
    if (chosen === null || declaration.date > chosen.date || (declaration.date === chosen.date && declaration.recordedAt >= chosen.recordedAt)) {
      chosen = declaration;
    }
  }
  if (chosen) return { state: chosen.state, declared: true, since: chosen.date };
  const greenManure = water.crops.some((crop: CropWaterDay) => crop.status === 'surface-state');
  return { state: greenManure ? 'green-manure-emergence' : 'bare', declared: false, since: null };
}

/** L'état du début du jour quand la capacité ou le mode changent : la jauge garde son % du plein. */
function carried(carry: Carry, shape: DayShape, surfaceState: SurfaceState | null): GaugeState | null {
  if (shape.capacityMm === null) return null;
  if (shape.geometry !== null && carry.geometry !== null && carry.bare !== null) {
    if (sameGeometry(shape.geometry, carry.geometry)) {
      // À la dépose d'une bâche imperméable, une surface restée humide sous le plastique repart mouillée.
      if (carry.surfaceState === 'impermeable-tarp' && surfaceState !== 'impermeable-tarp' && carry.bare.depletionMm <= shape.geometry.rewMm) {
        const bare = { ...carry.bare, depletionMm: 0 };
        return { mm: bareSoilGauge(shape.geometry, bare), bare };
      }
      return { mm: carry.stateMm, bare: carry.bare };
    }
  }
  if (shape.geometry === null && carry.geometry === null && carry.capacityMm === shape.capacityMm) {
    return { mm: carry.stateMm, bare: null };
  }
  const fullness = carry.capacityMm > 0 ? carry.stateMm / carry.capacityMm : 0;
  return fromFullness(shape, fullness);
}

function fromFullness(shape: DayShape, fullness: number): GaugeState | null {
  if (shape.capacityMm === null) return null;
  if (shape.geometry !== null) {
    const bare = splitFullness(shape.geometry, fullness);
    return { mm: bareSoilGauge(shape.geometry, bare), bare };
  }
  return { mm: Math.min(1, Math.max(0, fullness)) * shape.capacityMm, bare: null };
}

function sameGeometry(a: BareSoilGeometry, b: BareSoilGeometry): boolean {
  return a.tewMm === b.tewMm && a.rewMm === b.rewMm && a.surfaceRfuMm === b.surfaceRfuMm && a.deepRfuMm === b.deepRfuMm;
}

function finish(day: SoilReserveDay, shape: DayShape, end: GaugeState, drainageMm: number): SoilReserveDay {
  const capacity = shape.capacityMm ?? 0;
  return {
    ...day,
    stateMm: end.mm,
    percent: capacity > 0 ? end.mm / capacity * PERCENT : null,
    bare: end.bare,
    drainageMm,
    unknown: null,
  };
}

function toCarry(day: SoilReserveDay, shape: DayShape, surfaceState: SurfaceState | null): Carry | null {
  if (day.mode === null || day.stateMm === null || shape.capacityMm === null) return null;
  return { mode: day.mode, capacityMm: shape.capacityMm, stateMm: day.stateMm, bare: day.bare, geometry: shape.geometry, surfaceState };
}

/** La pluie comptée du jour : 0 sous abri ou sous bâche imperméable ; la prévision réduite par R2 ; le paillage plastique par sa part. */
function rainOfDay(
  input: BedSoilInput,
  date: string,
  mode: GaugeMode,
  surfaceState: SurfaceState | null,
  mulchShare: number,
): { mm: number | null; nature: RainNature | null } {
  if (input.bed.sheltered) return { mm: 0, nature: null };
  const surfaceShare = mode === 'crop' || surfaceState === null ? 1 : surfaceRainShare(surfaceState);
  if (surfaceShare === 0) return { mm: 0, nature: null };
  const rain = input.rain.get(date);
  if (!rain) return { mm: null, nature: null };
  const forecastShare = rain.nature === 'forecast' ? input.forecastRainShare : 1;
  return { mm: rain.mm * forecastShare * mulchShare * surfaceShare, nature: rain.nature };
}

type Consumption = { mm: number | null; gap: UnknownReason | null };

/** La consommation du jour : l'ETM de la planche, celle d'un couvert, ou rien à lire pour le sol nu, dont l'évaporation suit De. */
function consumptionOfDay(
  water: BedWaterDay,
  mode: GaugeMode,
  surfaceState: SurfaceState | null,
  settings: SoilSettings,
  shelterFactor: number,
): Consumption {
  const date = water.date;
  if (mode === 'crop') {
    if (water.status === 'computed') return { mm: water.etmMm, gap: null };
    if (water.status === 'unknown') return { mm: null, gap: { kind: 'missing-et0', date } };
    if (water.status === 'blocked') return { mm: null, gap: { kind: 'blocked', date, problems: water.problems } };
    const crops = water.crops
      .filter((crop) => crop.status === 'no-etm' || crop.status === 'blocked')
      .map((crop) => ({ seriesName: crop.seriesName, plantName: crop.plantName }));
    return { mm: null, gap: { kind: 'crop-without-etm', date, crops } };
  }
  const evaporationOnly = mode === 'bare';
  if (evaporationOnly && surfaceState !== null && evaporationShare(surfaceState, settings.surface) === 0) return { mm: 0, gap: null };
  if (water.et0 === null) return { mm: null, gap: { kind: 'missing-et0', date } };
  if (evaporationOnly) return { mm: 0, gap: null };
  return { mm: water.et0.mm * shelterFactor * coverKc(surfaceState ?? 'bare', settings.surface), gap: null };
}

function dataGap(
  date: string,
  rain: { mm: number | null },
  consumption: Consumption,
  capacityMm: number | null,
): UnknownReason | null {
  if (consumption.gap !== null) return consumption.gap;
  if (rain.mm === null) return { kind: 'missing-rain', date };
  if (capacityMm === null) return { kind: 'crop-without-etm', date, crops: [] };
  return null;
}

/** La dernière observation du jour qui couvre la planche : celle de son jardin, ou de sa parcelle pour le plein champ. */
function latestObservation(input: BedSoilInput, date: string): SoilObservation | null {
  let chosen: SoilObservation | null = null;
  for (const observation of input.observations) {
    if (observation.zoneId !== input.bed.zoneId) continue;
    if (observation.plotId === null ? input.bed.sheltered : observation.plotId !== input.bed.plotId) continue;
    if (dateKeyInTimeZone(observation.observedAt, FARM_TIME_ZONE) !== date) continue;
    if (chosen === null || observation.observedAt > chosen.observedAt
      || (observation.observedAt === chosen.observedAt && observation.recordedAt >= chosen.recordedAt)) chosen = observation;
  }
  return chosen;
}

/** Les mm d'irrigation apportés entre deux instants, au prorata de la durée de chaque apport. */
export function irrigationBetween(intervals: readonly IrrigationInterval[], from: number, to: number): number {
  let total = 0;
  for (const interval of intervals) {
    const start = Date.parse(interval.startAt);
    const end = Date.parse(interval.endAt);
    if (!Number.isFinite(start) || !(interval.mm > 0)) continue;
    if (!Number.isFinite(end) || end <= start) {
      if (start >= from && start < to) total += interval.mm;
      continue;
    }
    const overlap = Math.min(end, to) - Math.max(start, from);
    if (overlap > 0) total += interval.mm * overlap / (end - start);
  }
  return total;
}

/** Le début et la fin d'un jour à la ferme, en millisecondes : 23 ou 25 heures aux changements d'heure. */
export function dayBounds(date: string): { from: number; to: number } {
  return {
    from: localDateStartUtc(date, FARM_TIME_ZONE).getTime(),
    to: localDateStartUtc(addDaysToDateKey(date, 1), FARM_TIME_ZONE).getTime(),
  };
}

function emptyDay(input: BedSoilInput, water: BedWaterDay, unknown: UnknownReason | null): SoilReserveDay {
  return {
    date: water.date,
    nature: water.date < input.today ? 'estimated' : 'forecast',
    mode: null,
    surfaceState: null,
    surfaceStateDeclared: false,
    surfaceStateSince: null,
    depthM: null,
    capacityMm: null,
    p: null,
    thresholdMm: null,
    cropThresholdPercent: null,
    crops: [],
    irrigationStop: false,
    startMm: null,
    bareStart: null,
    stateMm: null,
    percent: null,
    bare: null,
    geometry: null,
    drainageMm: 0,
    rainMm: null,
    rainNature: null,
    irrigationMm: 0,
    consumptionMm: null,
    observation: null,
    fraction: 1,
    restart: null,
    unknown,
    mentions: { stonesMissing: false, mulchRainShare: null, weeds: false },
  };
}
