import type { Bed, CropPlan } from '../domain.ts';
import { roundToDecimals } from '../irrigation-format.ts';
import type { GoalRevisionLike } from '../irrigation-history/contract.ts';
import { weekDateKeys } from '../water-management.ts';
import { cultivationDates, daysFromTo, isUnplacedCultivation, type CultivationDates, type UnplacedCultivation } from './crop-calendar.ts';
import {
  cropWaterDay,
  DEFAULT_CROP_WATER_OPTIONS,
  et0OfDay,
  type BedWaterSettings,
  type CropWaterDay,
  type CropWaterOptions,
  type DayEt0,
  type Et0Nature,
  type Et0Reading,
} from './etm.ts';
import type { KcOverride } from './kc.ts';
import type { ReferenceCrop } from './reference.ts';
import { resolveCorrespondence, type CorrespondenceEntry, type ResolvedCorrespondence } from './species.ts';
import type { StageDeclaration } from './stage.ts';

/**
 * L'ETM de la planche et l'objectif proposé de la semaine
 * (docs/crop-water-need-contract.md, « Plusieurs cultures sur une même
 * planche », « L'objectif proposé », « Les garde-fous »).
 *
 * La planche prend l'ETM la plus élevée de ses cultures ; une planche sans
 * culture compte 0 ce jour-là. La proposition est la somme des sept jours, du
 * lundi au dimanche. Elle reste une information : elle n'entre dans le besoin
 * que si l'utilisateur l'adopte, par une révision ordinaire de l'objectif de
 * la planche, valable à partir du jour de l'adoption (D-039, D-045). L'écart,
 * les cumuls, les priorités, la faisabilité et le planning ne lisent que
 * l'objectif ; l'ET0 n'entre dans aucun d'eux (D-010).
 */

export type BedWaterDay = {
  date: string;
  /**
   * `no-crop` : aucune culture à Kc, la planche compte 0 ; `computed` : chaque
   * culture a son ETM ; `partial` : une culture n'en a pas, l'ETM est celle
   * des autres ; `no-etm` : aucune culture n'en a ; `unknown` : l'ET0 manque ;
   * `blocked` : une valeur hors bornes.
   */
  status: 'no-crop' | 'computed' | 'partial' | 'no-etm' | 'unknown' | 'blocked';
  /** L'ETM la plus élevée des cultures ; 0 sans culture ; `null` quand elle n'est pas connue. */
  etmMm: number | null;
  et0: DayEt0 | null;
  /** Les cultures sur la planche ce jour-là, engrais vert compris. */
  crops: CropWaterDay[];
  /** Toutes les cultures sont à un Kc de 0 : « arrêt d'irrigation avant récolte ». */
  irrigationStop: boolean;
  problems: string[];
};

export type BedCropWaterInput = {
  bedId: string;
  /** Aujourd'hui à la ferme, `AAAA-MM-JJ` : il sépare l'ET0 du passé de l'ET0 prévue. */
  today: string;
  cropPlan: Pick<CropPlan, 'series' | 'places' | 'implantationTasks'>;
  referenceCrops: readonly ReferenceCrop[];
  correspondences: readonly CorrespondenceEntry[];
  overrides: readonly KcOverride[];
  declarations: readonly StageDeclaration[];
  et0Readings: readonly Et0Reading[];
  settings: BedWaterSettings;
  options?: CropWaterOptions;
};

type CoherenceAlert =
  | { kind: 'high-etm'; date: string; etmMm: number }
  | { kind: 'deviation'; proposedMm: number; objectiveMm: number };

export type WeekProposal = {
  weekStart: string;
  weekEnd: string;
  /**
   * `no-crop` : aucune culture à Kc de la semaine, rien à proposer ;
   * `complete` : chaque jour est connu ; `partial` : un jour ou une culture
   * manque, nommés, la somme ne compte que le connu et ne s'adopte pas ;
   * `unavailable` : aucun jour n'a d'ETM, l'objectif saisi reste seul.
   */
  status: 'no-crop' | 'complete' | 'partial' | 'unavailable';
  proposedMm: number | null;
  /** Les millimètres proposés selon la nature de l'ET0, jamais confondues (D-006). */
  byNature: Record<Et0Nature, number>;
  /** Les jours sans ET0 : jamais comptés pour zéro (D-003). */
  missingDays: string[];
  blockedDays: { date: string; problems: string[] }[];
  /** Les cultures sans ETM, nommées par l'écran. */
  cropsWithoutEtm: { seriesName: string; plantName: string; reason: Extract<CropWaterDay, { status: 'no-etm' }>['reason'] }[];
  irrigationStopDates: string[];
  objectiveMm: number | null;
  /** L'écart de la proposition à l'objectif applicable, quand la proposition est complète. */
  differenceMm: number | null;
  differencePercent: number | null;
  alerts: CoherenceAlert[];
  adoptable: boolean;
};

/** Une ETM au-delà de 8 mm/j est signalée (« Alerte de cohérence »). */
const HIGH_ETM_MM = 8;
/** Une proposition qui s'écarte de plus de 50 % de l'objectif applicable est signalée. */
const DEVIATION_RATIO = 0.5;
const PERCENT = 100;
/** L'adoption enregistre la proposition au dixième de millimètre. */
const ADOPTION_DECIMALS = 1;
/** Des arrosages espacés de trois jours ou moins sont « rapprochés ». */
const CLOSE_IRRIGATION_DAYS = 3;

const ADOPTED_PROPOSAL_ORIGIN = 'adopted-proposal';

export const EARLY_SPRINKLER_WARNING = 'Besoin probablement sous-estimé en début de cycle : les Kc du CRIIAM du premier stade supposent un sol peu mouillé, et la planche est arrosée par aspersion tous les trois jours ou moins.';

/** L'ETM de la planche un jour : celle de la culture qui a le plus soif. */
function bedWaterDay(date: string, et0: DayEt0 | null, cropDays: readonly CropWaterDay[]): BedWaterDay {
  const crops = cropDays.filter((crop) => crop.status !== 'absent');
  const withKc = crops.filter((crop) => crop.status !== 'surface-state');
  const base = { date, et0, crops, irrigationStop: false, problems: [] as string[] };
  if (withKc.length === 0) return { ...base, status: 'no-crop', etmMm: 0 };
  const problems = [...new Set(withKc.flatMap((crop) => (crop.status === 'blocked' ? crop.problems : [])))];
  if (problems.length > 0) return { ...base, status: 'blocked', etmMm: null, problems };
  if (withKc.some((crop) => crop.status === 'unknown')) return { ...base, status: 'unknown', etmMm: null };
  const computed = withKc.flatMap((crop) => (crop.status === 'computed' ? [crop] : []));
  if (computed.length === 0) return { ...base, status: 'no-etm', etmMm: null };
  const complete = computed.length === withKc.length;
  return {
    ...base,
    status: complete ? 'computed' : 'partial',
    etmMm: Math.max(...computed.map((crop) => crop.etmMm)),
    irrigationStop: complete && computed.every((crop) => crop.irrigationStop),
  };
}

/**
 * L'ETM de la planche pour des jours donnés, passés ou à venir : la
 * proposition de la semaine les somme, la jauge de la réserve du sol (5 ter)
 * les consomme. Les séries posées sur la planche sans semaine d'implantation
 * n'ont pas de stade : elles sont rendues à part, pour que l'écran le dise.
 */
export function bedWaterDays(input: BedCropWaterInput, dates: readonly string[]): { days: BedWaterDay[]; unplaced: UnplacedCultivation[] } {
  const { placed, unplaced } = bedCultivations(input);
  const readings = new Map(input.et0Readings.map((reading) => [reading.date, reading]));
  const options = input.options ?? DEFAULT_CROP_WATER_OPTIONS;
  const days = dates.map((date) => {
    const et0 = et0OfDay(readings.get(date), date, input.today);
    const crops = placed.map(({ dates: cultivation, correspondence }) => cropWaterDay({
      bedId: input.bedId,
      date,
      dates: cultivation,
      correspondence,
      referenceCrops: input.referenceCrops,
      overrides: input.overrides,
      declarations: input.declarations,
      et0,
      settings: input.settings,
      options,
    }));
    return bedWaterDay(date, et0, crops);
  });
  return { days, unplaced };
}

/** La semaine de la planche et son objectif proposé, face à l'objectif applicable. */
export function bedWeekProposal(
  input: BedCropWaterInput & { weekStart: string; objectiveMm: number | null },
): WeekProposal & { days: BedWaterDay[]; unplaced: UnplacedCultivation[] } {
  const { days, unplaced } = bedWaterDays(input, weekDateKeys(input.weekStart));
  return { ...weekProposal({ days, objectiveMm: input.objectiveMm }), days, unplaced };
}

/** L'objectif proposé d'une semaine de sept jours, son état, ses écarts et ses alertes. */
export function weekProposal(input: { days: readonly BedWaterDay[]; objectiveMm: number | null }): WeekProposal {
  const { days, objectiveMm } = input;
  const valued = days.filter((day) => day.status === 'computed' || day.status === 'partial');
  const byNature: Record<Et0Nature, number> = { reanalysis: 0, estimated: 0, forecast: 0 };
  for (const day of valued) if (day.et0 !== null && day.etmMm !== null) byNature[day.et0.nature] += day.etmMm;
  const status: WeekProposal['status'] = days.every((day) => day.status === 'no-crop')
    ? 'no-crop'
    : valued.length === 0
      ? 'unavailable'
      : days.every((day) => day.status === 'no-crop' || day.status === 'computed') ? 'complete' : 'partial';
  const proposedMm = status === 'complete' || status === 'partial'
    ? days.reduce((total, day) => total + (day.status === 'computed' || day.status === 'partial' ? day.etmMm ?? 0 : 0), 0)
    : null;
  const comparable = status === 'complete' && proposedMm !== null && objectiveMm !== null;
  const differenceMm = comparable ? proposedMm - objectiveMm : null;
  const alerts: CoherenceAlert[] = days.flatMap((day): CoherenceAlert[] => (
    day.etmMm !== null && day.etmMm > HIGH_ETM_MM ? [{ kind: 'high-etm', date: day.date, etmMm: day.etmMm }] : []
  ));
  if (comparable && (objectiveMm === 0 ? proposedMm > 0 : Math.abs(proposedMm - objectiveMm) / objectiveMm > DEVIATION_RATIO)) {
    alerts.push({ kind: 'deviation', proposedMm, objectiveMm });
  }
  return {
    weekStart: days[0]?.date ?? '',
    weekEnd: days.at(-1)?.date ?? '',
    status,
    proposedMm,
    byNature,
    missingDays: days.filter((day) => day.status === 'unknown').map((day) => day.date),
    blockedDays: days.filter((day) => day.status === 'blocked').map((day) => ({ date: day.date, problems: day.problems })),
    cropsWithoutEtm: cropsWithoutEtm(days),
    irrigationStopDates: days.filter((day) => day.irrigationStop).map((day) => day.date),
    objectiveMm,
    differenceMm,
    differencePercent: differenceMm !== null && objectiveMm !== null && objectiveMm > 0 ? differenceMm / objectiveMm * PERCENT : null,
    alerts,
    adoptable: status === 'complete',
  };
}

/** Ce que la carte du besoin d'une planche montre de la proposition, à côté de l'objectif (5 quater, PR 3b). */
export type ProposalSummary = Pick<WeekProposal, 'status' | 'proposedMm' | 'byNature' | 'differenceMm' | 'differencePercent' | 'missingDays' | 'adoptable'> & {
  alertCount: number;
  cropsWithoutEtm: number;
};

export function proposalSummary(proposal: WeekProposal): ProposalSummary {
  return {
    status: proposal.status,
    proposedMm: proposal.proposedMm,
    byNature: proposal.byNature,
    differenceMm: proposal.differenceMm,
    differencePercent: proposal.differencePercent,
    missingDays: proposal.missingDays,
    adoptable: proposal.adoptable,
    alertCount: proposal.alerts.length,
    cropsWithoutEtm: proposal.cropsWithoutEtm.length,
  };
}

/** Une révision d'objectif née d'une proposition adoptée : son origine est conservée. */
export type AdoptedGoalRevision = Omit<GoalRevisionLike, 'id' | 'amountMm'> & { amountMm: number; origin: typeof ADOPTED_PROPOSAL_ORIGIN };

/**
 * « Adopter la proposition » : une révision ordinaire de l'objectif de la
 * planche, qui prime sur les objectifs de jardin, de parcelle et de ferme
 * sans les effacer, et compte à partir du jour de l'adoption (D-034, D-039).
 * Seule une proposition complète s'adopte : une somme partielle compterait
 * pour zéro les jours qui manquent (D-003).
 */
export function adoptionRevision(
  proposal: Pick<WeekProposal, 'weekStart' | 'proposedMm' | 'adoptable'>,
  bed: Pick<Bed, 'id' | 'zoneId' | 'plotId'>,
  adoptedAt: string,
): AdoptedGoalRevision | null {
  if (!proposal.adoptable || proposal.proposedMm === null) return null;
  return {
    weekStart: proposal.weekStart,
    scopeType: 'bed',
    otfZoneId: bed.zoneId,
    otfPlotId: bed.plotId,
    otfBedId: bed.id,
    amountMm: roundToDecimals(proposal.proposedMm, ADOPTION_DECIMALS),
    action: 'set',
    createdAt: adoptedAt,
    copiedFromGoalId: null,
    origin: ADOPTED_PROPOSAL_ORIGIN,
  };
}

/**
 * L'avertissement d'aspersion en début de cycle : une culture au premier
 * stade d'une table du CRIIAM, une aspersion posée sur la planche et deux
 * arrosages à trois jours ou moins l'un de l'autre. Le Kc n'est pas modifié.
 */
export function earlySprinklerWarning(input: {
  days: readonly BedWaterDay[];
  sprinklerOnBed: boolean;
  irrigationDates: readonly string[];
}): string | null {
  if (!input.sprinklerOnBed) return null;
  const earlyCycle = input.days.some((day) => day.crops.some((crop) => (
    (crop.status === 'computed' || crop.status === 'unknown') && crop.trace.source === 'criiam' && crop.trace.firstStage
  )));
  if (!earlyCycle) return null;
  const dates = [...new Set(input.irrigationDates)].sort();
  const close = dates.some((date, index) => index > 0 && daysFromTo(dates[index - 1], date) <= CLOSE_IRRIGATION_DAYS);
  return close ? EARLY_SPRINKLER_WARNING : null;
}

/**
 * Les cultures placées de la planche et leur premier jour, avec leur culture
 * de référence quand elles en ont une : la jauge de la 5 ter y lit la
 * profondeur de référence d'une planche sans culture (« Par planche sans
 * culture », D-053). Un engrais vert ou une culture sans référence n'en a pas.
 */
export function bedUpcomingCrops(input: BedCropWaterInput): { presenceStart: string; referenceCropId: string | null }[] {
  return bedCultivations(input).placed.map(({ dates, correspondence }) => ({
    presenceStart: dates.presenceStart,
    referenceCropId: correspondence.kind === 'reference' ? correspondence.referenceCropId : null,
  }));
}

function bedCultivations(input: BedCropWaterInput): {
  placed: { dates: CultivationDates; correspondence: ResolvedCorrespondence }[];
  unplaced: UnplacedCultivation[];
} {
  const seriesOnBed = new Set(input.cropPlan.places.filter((place) => place.bedId === input.bedId).map((place) => place.seriesId));
  const placed: { dates: CultivationDates; correspondence: ResolvedCorrespondence }[] = [];
  const unplaced: UnplacedCultivation[] = [];
  for (const series of input.cropPlan.series) {
    if (!seriesOnBed.has(series.id)) continue;
    for (const cultivation of series.cultivations) {
      const dates = cultivationDates(series, cultivation, input.cropPlan.implantationTasks, input.today);
      if (isUnplacedCultivation(dates)) unplaced.push(dates);
      else placed.push({ dates, correspondence: resolveCorrespondence(input.correspondences, series.id, cultivation.plantId) });
    }
  }
  return { placed, unplaced };
}

function cropsWithoutEtm(days: readonly BedWaterDay[]): WeekProposal['cropsWithoutEtm'] {
  const named = new Map<string, WeekProposal['cropsWithoutEtm'][number]>();
  for (const day of days) {
    for (const crop of day.crops) {
      if (crop.status !== 'no-etm') continue;
      named.set(`${crop.cultivationId}|${crop.reason}`, { seriesName: crop.seriesName, plantName: crop.plantName, reason: crop.reason });
    }
  }
  return [...named.values()];
}
