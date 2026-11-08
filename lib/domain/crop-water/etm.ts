import { addDaysToDateKey } from '../water-management.ts';
import { daysFromTo, type CultivationDates } from './crop-calendar.ts';
import { KC_SMOOTHING_DAYS, smoothKc, stageKc, type DayKc, type KcOverride } from './kc.ts';
import { curveStages, kcBoundsProblem, type KcSource, type ReferenceCrop } from './reference.ts';
import type { ResolvedCorrespondence } from './species.ts';
import { stageOfDay, type StageDeclaration, type StagedDay } from './stage.ts';

/**
 * L'ETM d'un jour, culture par culture puis pour la planche
 * (docs/crop-water-need-contract.md, « Le calcul du jour ») :
 *
 *   ETM = ET0 × K_abri × Kc × K_paillage × K_ombrage
 *
 * L'ET0 d'un jour passé est la réanalyse, sinon la prévision enregistrée,
 * marquée estimée ; celle d'aujourd'hui ou d'un jour à venir est la
 * prévision ; sans l'une ni l'autre, l'ETM est inconnue, jamais nulle (D-003).
 * Observé, estimé et prévu ne sont jamais confondus (D-006). Une valeur hors
 * bornes bloque le calcul du jour avec un message qui la nomme ; la valeur
 * enregistrée avant n'est pas écrasée, ce que la persistance respecte.
 */

export type Et0Nature = 'reanalysis' | 'estimated' | 'forecast';

/** Ce que la météo enregistrée donne pour un jour : la réanalyse et la prévision, chacune absente possible. */
export type Et0Reading = { date: string; reanalysisMm: number | null; forecastMm: number | null };

export type DayEt0 = { mm: number; nature: Et0Nature };

/** K_abri : 0,8 sous abri par défaut (CRIIAM), réglable de 0,6 à 1 ; le calcul refuse hors de 0,5 à 1. */
const SHELTER_FACTOR = {
  default: 0.8,
  setting: { minimum: 0.6, maximum: 1 },
  bounds: { minimum: 0.5, maximum: 1 },
} as const;

/** Paillage plastique : Kc × 0,9, plutôt que « retirer 0,10 », pour ne jamais donner un Kc négatif. */
const PLASTIC_MULCH_FACTOR = 0.9;

/** Bornes de l'ET0 du jour, comprises, en mm/j. */
const ET0_BOUNDS = { minimum: 0, maximum: 12 } as const;

/** Une valeur de K_abri pour un abri, à partir d'un jour (révisions datées). */
type ShelterFactorRevision = { shelterId: string; value: number; effectiveFrom: string; recordedAt: string };

/** Le paillage plastique d'une planche pour une saison, l'année civile du jour. */
type MulchSetting = { bedId: string; season: number; plasticMulch: boolean };

/** Un filet d'ombrage posé sur une planche, de `from` à `to` compris ; `to` nul : toujours posé. */
export type ShadeNet = { bedId: string; rate: number; from: string; to: string | null };

export type BedWaterSettings = {
  bedId: string;
  /** L'abri qui couvre la planche, son jardin sous abri ; `null` en plein champ, K_abri vaut 1. */
  shelterId: string | null;
  shelterFactors: readonly ShelterFactorRevision[];
  mulch: readonly MulchSetting[];
  shadeNets: readonly ShadeNet[];
};

/** Les options de la ferme : le lissage des passages de stade et l'ombrage, désactivés par défaut (D-054). */
export type CropWaterOptions = { smoothing: boolean; shading: boolean };

export const DEFAULT_CROP_WATER_OPTIONS: CropWaterOptions = { smoothing: false, shading: false };

type CropIdentity = Pick<CultivationDates, 'seriesId' | 'seriesName' | 'cultivationId' | 'plantId' | 'plantName'>;

/** Ce qui a produit une ETM : la source du Kc, le stade et sa provenance, chaque facteur. */
type EtmTrace = {
  referenceCropId: string;
  referenceCropName: string;
  source: KcSource;
  /** L'espèce est rattachée à cette culture par analogie. */
  analogy: boolean;
  /** Le rattachement vient d'une exception de la série. */
  exception: boolean;
  stage: StagedDay;
  /** Le stade du jour est le premier de sa table : le début du cycle. */
  firstStage: boolean;
  kc: DayKc;
  shelterFactor: number;
  mulchFactor: number;
  shadeFactor: number;
  /** Le taux du filet quand l'option d'ombrage joue : une hypothèse, affichée comme telle. */
  shadeNetRate: number | null;
};

export type CropWaterDay = CropIdentity & (
  | { status: 'absent' }
  /** Engrais vert : l'état de la surface d'une planche nue, sans Kc (5 ter). */
  | { status: 'surface-state' }
  | { status: 'no-etm'; reason: 'missing-correspondence' | 'without-reference' | 'off-calendar' }
  | { status: 'blocked'; problems: string[] }
  /** Le stade et le Kc sont connus, l'ET0 du jour manque. */
  | { status: 'unknown'; trace: EtmTrace }
  | { status: 'computed'; etmMm: number; et0: DayEt0; irrigationStop: boolean; trace: EtmTrace }
);

export type CropDayContext = {
  bedId: string;
  date: string;
  dates: CultivationDates;
  correspondence: ResolvedCorrespondence;
  referenceCrops: readonly ReferenceCrop[];
  overrides: readonly KcOverride[];
  declarations: readonly StageDeclaration[];
  et0: DayEt0 | null;
  settings: BedWaterSettings;
  options: CropWaterOptions;
};

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });
const dayLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** L'ET0 d'un jour et sa nature, ou `null` quand elle manque : jamais 0 à la place (D-003). */
export function et0OfDay(
  reading: Pick<Et0Reading, 'reanalysisMm' | 'forecastMm'> | undefined,
  date: string,
  today: string,
): DayEt0 | null {
  if (!reading) return null;
  if (date < today) {
    if (reading.reanalysisMm !== null) return { mm: reading.reanalysisMm, nature: 'reanalysis' };
    return reading.forecastMm === null ? null : { mm: reading.forecastMm, nature: 'estimated' };
  }
  return reading.forecastMm === null ? null : { mm: reading.forecastMm, nature: 'forecast' };
}

/** Le K_abri du jour : 1 en plein champ ; sous abri, la dernière révision de l'abri, sinon 0,8. */
export function shelterFactorOn(settings: Pick<BedWaterSettings, 'shelterId' | 'shelterFactors'>, date: string): number {
  if (settings.shelterId === null) return 1;
  let chosen: ShelterFactorRevision | null = null;
  for (const revision of settings.shelterFactors) {
    if (revision.shelterId !== settings.shelterId || revision.effectiveFrom > date) continue;
    if (chosen === null || revision.effectiveFrom > chosen.effectiveFrom
      || (revision.effectiveFrom === chosen.effectiveFrom && revision.recordedAt >= chosen.recordedAt)) chosen = revision;
  }
  return chosen?.value ?? SHELTER_FACTOR.default;
}

/** Ce qui empêche d'enregistrer un K_abri : il se règle de 0,6 à 1. */
export function shelterFactorSettingProblem(value: number): string | null {
  const { minimum, maximum } = SHELTER_FACTOR.setting;
  if (Number.isFinite(value) && value >= minimum && value <= maximum) return null;
  return `K_abri invalide : il se règle de ${decimal.format(minimum)} à ${decimal.format(maximum)}.`;
}

/** Ce qui empêche d'enregistrer un filet d'ombrage : un taux de 0 à moins de 1, des jours dans l'ordre. */
export function shadeNetProblem(net: Pick<ShadeNet, 'rate' | 'from' | 'to'>): string | null {
  if (!(Number.isFinite(net.rate) && net.rate >= 0 && net.rate < 1)) return "Taux d'ombrage invalide : de 0 à moins de 100 %.";
  if (net.to !== null && net.to < net.from) return "Le filet d'ombrage est retiré avant d'être posé.";
  return null;
}

/** K_paillage : 0,9 quand la planche porte un paillage plastique pour la saison du jour. */
export function mulchFactorOn(settings: Pick<BedWaterSettings, 'bedId' | 'mulch'>, date: string): number {
  return plasticMulchOn(settings, date) ? PLASTIC_MULCH_FACTOR : 1;
}

/** La planche porte un paillage plastique pour la saison du jour (la réserve du sol en lit aussi la pluie, 5 ter). */
export function plasticMulchOn(settings: Pick<BedWaterSettings, 'bedId' | 'mulch'>, date: string): boolean {
  const season = Number(date.slice(0, 4));
  const setting = settings.mulch.find((candidate) => candidate.bedId === settings.bedId && candidate.season === season);
  return setting?.plasticMulch === true;
}

/** K_ombrage : √(1 − o) avec le filet posé ce jour-là, quand l'option est activée ; 1 sinon. */
export function shadeOn(
  settings: Pick<BedWaterSettings, 'bedId' | 'shadeNets'>,
  date: string,
  enabled: boolean,
): { factor: number; netRate: number | null } {
  if (!enabled) return { factor: 1, netRate: null };
  let net: ShadeNet | null = null;
  for (const candidate of settings.shadeNets) {
    if (candidate.bedId !== settings.bedId || candidate.from > date || (candidate.to !== null && candidate.to < date)) continue;
    if (net === null || candidate.from >= net.from) net = candidate;
  }
  return net === null ? { factor: 1, netRate: null } : { factor: Math.sqrt(1 - net.rate), netRate: net.rate };
}

/** L'ETM d'une culture sur une planche, un jour, avec ce qui l'a produite. */
export function cropWaterDay(context: CropDayContext): CropWaterDay {
  const { dates, date, correspondence } = context;
  const identity: CropIdentity = {
    seriesId: dates.seriesId,
    seriesName: dates.seriesName,
    cultivationId: dates.cultivationId,
    plantId: dates.plantId,
    plantName: dates.plantName,
  };
  const crop = correspondence.kind === 'reference'
    ? context.referenceCrops.find((candidate) => candidate.id === correspondence.referenceCropId)
    : undefined;
  if (crop === undefined) {
    if (!presentWithoutReference(dates, date)) return { ...identity, status: 'absent' };
    if (correspondence.kind === 'surface-state') return { ...identity, status: 'surface-state' };
    if (correspondence.kind === 'reference') {
      return { ...identity, status: 'blocked', problems: [`${dates.plantName} : culture de référence introuvable.`] };
    }
    return { ...identity, status: 'no-etm', reason: correspondence.kind === 'missing' ? 'missing-correspondence' : 'without-reference' };
  }

  const stage = stageOfDay({ crop, dates, declarations: context.declarations, bedId: context.bedId, date });
  if (stage.status === 'absent') return { ...identity, status: 'absent' };
  if (stage.status === 'off-calendar') return { ...identity, status: 'no-etm', reason: 'off-calendar' };
  if (stage.status === 'no-season-set') {
    const month = monthName.format(new Date(`${dates.dayZero}T12:00:00.000Z`));
    return { ...identity, status: 'blocked', problems: [`${crop.name} : aucun jeu de dates pour une implantation en ${month}.`] };
  }
  const kc = dayKc(context, crop, stage);
  if (kc === null) return { ...identity, status: 'blocked', problems: [`${crop.name} : le stade ${stage.rank} manque dans la table.`] };

  const shelterFactor = shelterFactorOn(context.settings, date);
  const mulchFactor = mulchFactorOn(context.settings, date);
  const shade = shadeOn(context.settings, date, context.options.shading);
  const problems = [
    kcBoundsProblem(kc.kc, `${crop.name}, ${stage.label}`),
    shelterFactorProblem(shelterFactor),
    context.et0 === null ? null : et0Problem(context.et0, date),
  ].filter((problem): problem is string => problem !== null);
  if (problems.length > 0) return { ...identity, status: 'blocked', problems };

  const trace: EtmTrace = {
    referenceCropId: crop.id,
    referenceCropName: crop.name,
    source: crop.source,
    analogy: correspondence.kind === 'reference' && correspondence.analogy,
    exception: correspondence.kind === 'reference' && correspondence.exception,
    stage,
    firstStage: curveStages(crop.curve)[0]?.rank === stage.rank,
    kc,
    shelterFactor,
    mulchFactor,
    shadeFactor: shade.factor,
    shadeNetRate: shade.netRate,
  };
  if (context.et0 === null) return { ...identity, status: 'unknown', trace };
  const etmMm = context.et0.mm * shelterFactor * kc.kc * mulchFactor * shade.factor;
  // Un Kc de 0 n'est pas une anomalie : c'est l'arrêt de l'irrigation avant la récolte.
  return { ...identity, status: 'computed', etmMm, et0: context.et0, irrigationStop: kc.kc === 0, trace };
}

/** Le Kc du jour ; avec l'option de lissage, les cinq premiers jours d'un stade vont du Kc d'avant au sien. */
function dayKc(context: CropDayContext, crop: ReferenceCrop, stage: StagedDay): DayKc | null {
  const base = stageKc(crop, stage.position, context.overrides, context.date);
  if (base === null) return null;
  const unchanged = { ...base, smoothed: false };
  if (!context.options.smoothing || stage.position.shape === 'trapezoid') return unchanged;
  const daysSinceChange = daysFromTo(stage.startedOn, context.date);
  if (daysSinceChange >= KC_SMOOTHING_DAYS) return unchanged;
  const dayBefore = addDaysToDateKey(stage.startedOn, -1);
  const previous = stageOfDay({ crop, dates: context.dates, declarations: context.declarations, bedId: context.bedId, date: dayBefore });
  if (previous.status !== 'staged' || previous.rank === stage.rank) return unchanged;
  const previousKc = stageKc(crop, previous.position, context.overrides, dayBefore);
  if (previousKc === null) return unchanged;
  const kc = smoothKc(base.kc, previousKc.kc, daysSinceChange);
  return { ...base, kc, smoothed: kc !== base.kc };
}

/** Une culture sans culture de référence est sur sa planche de son premier jour à sa dernière récolte (D-057). */
function presentWithoutReference(dates: CultivationDates, date: string): boolean {
  return date >= dates.presenceStart && (dates.lastHarvest === null || date <= dates.lastHarvest);
}

function shelterFactorProblem(value: number): string | null {
  const { minimum, maximum } = SHELTER_FACTOR.bounds;
  if (Number.isFinite(value) && value >= minimum && value <= maximum) return null;
  return `K_abri hors bornes : ${decimal.format(value)} (entre ${decimal.format(minimum)} et ${decimal.format(maximum)}).`;
}

function et0Problem(et0: DayEt0, date: string): string | null {
  const { minimum, maximum } = ET0_BOUNDS;
  if (Number.isFinite(et0.mm) && et0.mm >= minimum && et0.mm <= maximum) return null;
  const day = dayLabel.format(new Date(`${date}T12:00:00.000Z`));
  return `ET0 hors bornes le ${day} : ${decimal.format(et0.mm)} mm/j (entre ${decimal.format(minimum)} et ${decimal.format(maximum)}).`;
}
