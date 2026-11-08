import { mmText, waterText } from '../figure-origin.ts';
import type { BedIrrigationNeed } from '../irrigation-needs.ts';
import { percentFromFraction } from '../units.ts';
import { shortDayText } from './today-text.ts';

/**
 * « La semaine » et « Eau de la semaine » du tableau de bord « Aujourd'hui »
 * (docs/aujourdhui-tableau-de-bord-contract.md, section 3.2, précision T4) :
 * l'objectif, l'eau reçue (irrigation réelle et pluie mesurée) et ce qui
 * reste à apporter, pour la ferme et par jardin, comme les lit « Objectifs
 * et besoins » pour la semaine en cours. Rien ne se calcule de nouveau : le
 * reste à apporter est celui du tableau des besoins (objectif − pluie réelle
 * − irrigation réelle, jamais négatif, D-010). Les millimètres ne
 * s'additionnent pas entre surfaces : ils se pondèrent par la surface,
 * Σ(mm × m²) / Σ(m²) ; une valeur inconnue d'une planche laisse le total
 * inconnu (D-003).
 */

/** Ce que la page lit d'une planche dans le tableau des besoins de la semaine. */
export type TodayWeekBed = Pick<BedIrrigationNeed,
  'plotId' | 'plotName' | 'sheltered' | 'areaSquareMeters' | 'objectiveMm' | 'actualRainMm' | 'actualIrrigationMm' | 'realRemainingMm'>;

export type TodayWeekInputs = {
  weekStart: string;
  weekEnd: string;
  /** Les planches de la saison, dans l'ordre du tableau des besoins (parcelle, puis jardin). */
  beds: readonly TodayWeekBed[];
  /** L'eau d'irrigation réalisée de la semaine et du jour, en m³ ; `incomplete` quand une surface mouillée manque. */
  water: { weekCubicMeters: number; todayCubicMeters: number; incomplete: boolean } | null;
};

/** L'échelle des barres va au moins jusqu'à 10 mm, arrondie aux 5 mm au-dessus de la plus haute valeur. */
const WEEK_SCALE_MINIMUM_MM = 10;
const WEEK_SCALE_STEP_MM = 5;
/** Les jardins montrés d'emblée ; les autres derrière « Voir les n autres ». */
export const WEEK_GARDENS_SHOWN = 8;
const PERCENT_DECIMALS = 10;
const millimeters = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

type WeekRow = {
  /** `farm` pour la ligne de la ferme, sinon l'identifiant du jardin. */
  key: string;
  name: string;
  sheltered: boolean;
  objectiveMm: number | null;
  irrigationMm: number;
  rainMm: number | null;
  /** Irrigation + pluie ; `null` quand la pluie est inconnue. */
  receivedMm: number | null;
  remainingMm: number | null;
  /** « 8 / 20 mm », « 8 mm reçus, objectif non fixé », « pluie inconnue ». */
  text: string;
  /** Les barres empilées et le trait de l'objectif, en % de l'échelle. */
  bars: { irrigationPercent: number; rainPercent: number; objectivePercent: number | null };
};

export type TodayWeek = {
  /** « du lun. 2 nov. au dim. 8 nov. ». */
  label: string;
  scaleMaxMm: number;
  farm: WeekRow;
  shown: WeekRow[];
  hidden: WeekRow[];
  moreLabel: string | null;
  /** Les tuiles de la semaine. */
  tiles: {
    objective: string | null;
    received: string | null;
    receivedDetail: string | null;
    remaining: string | null;
    /** « 18 m³ », « au moins 18 m³ » quand une surface mouillée manque ; `null` sans « Ressources » ni tableau de l'eau. */
    water: string | null;
    waterToday: string | null;
  };
};

function weighted(beds: readonly TodayWeekBed[], pick: (bed: TodayWeekBed) => number | null): number | null {
  const area = beds.reduce((sum, bed) => sum + bed.areaSquareMeters, 0);
  if (!(area > 0)) return null;
  let total = 0;
  for (const bed of beds) {
    const value = pick(bed);
    if (value === null || !Number.isFinite(value)) return null;
    total += value * bed.areaSquareMeters;
  }
  return total / area;
}

function rounded(value: number): number {
  return Math.round(value * PERCENT_DECIMALS) / PERCENT_DECIMALS;
}

function row(key: string, name: string, beds: readonly TodayWeekBed[], scaleMaxMm: number): WeekRow {
  const objectiveMm = weighted(beds, (bed) => bed.objectiveMm);
  const irrigationMm = weighted(beds, (bed) => Math.max(0, bed.actualIrrigationMm)) ?? 0;
  const rainMm = weighted(beds, (bed) => bed.actualRainMm);
  const receivedMm = rainMm === null ? null : irrigationMm + rainMm;
  const remainingMm = weighted(beds, (bed) => bed.realRemainingMm);
  const percent = (mm: number) => rounded(percentFromFraction(Math.min(1, Math.max(0, mm / scaleMaxMm))));
  const irrigationPercent = percent(irrigationMm);
  const text = objectiveMm === null
    ? `${mmText(rounded(receivedMm ?? irrigationMm))} reçus, objectif non fixé`
    : receivedMm === null
      ? `${mmText(rounded(irrigationMm))} irrigués / ${mmText(rounded(objectiveMm))}, pluie inconnue`
      : `${millimeters.format(receivedMm)} / ${mmText(rounded(objectiveMm))}`;
  return {
    key,
    name,
    sheltered: beds.every((bed) => bed.sheltered),
    objectiveMm,
    irrigationMm,
    rainMm,
    receivedMm,
    remainingMm,
    text,
    bars: {
      irrigationPercent,
      rainPercent: rainMm === null ? 0 : Math.max(0, rounded(Math.min(100, percent(irrigationMm + rainMm)) - irrigationPercent)),
      objectivePercent: objectiveMm === null ? null : percent(objectiveMm),
    },
  };
}

function scaleMax(values: readonly (number | null)[]): number {
  const highest = Math.max(WEEK_SCALE_MINIMUM_MM, ...values.filter((value): value is number => value !== null && Number.isFinite(value)));
  return Math.ceil(highest / WEEK_SCALE_STEP_MM) * WEEK_SCALE_STEP_MM;
}

/** La semaine de la ferme et de chaque jardin ; `null` sans planche de la saison. */
export function todayWeek(input: TodayWeekInputs): TodayWeek | null {
  if (input.beds.length === 0) return null;
  const gardens = new Map<string, { name: string; beds: TodayWeekBed[] }>();
  for (const bed of input.beds) {
    const garden = gardens.get(bed.plotId) ?? { name: bed.plotName, beds: [] };
    garden.beds.push(bed);
    gardens.set(bed.plotId, garden);
  }
  const groups = [{ key: 'farm', name: 'Ferme', beds: [...input.beds] }, ...[...gardens.entries()].map(([key, garden]) => ({ key, ...garden }))];
  const max = scaleMax(groups.flatMap((group) => {
    const probe = row(group.key, group.name, group.beds, Number.POSITIVE_INFINITY);
    return [probe.objectiveMm, probe.receivedMm ?? probe.irrigationMm];
  }));
  const [farm, ...rows] = groups.map((group) => row(group.key, group.name, group.beds, max));
  const hidden = rows.slice(WEEK_GARDENS_SHOWN);
  const mm = (value: number | null) => (value === null ? null : mmText(rounded(value)));
  const water = input.water;
  const volume = (value: number) => `${water?.incomplete ? 'au moins ' : ''}${waterText(value, 'm³')}`;
  return {
    label: `du ${shortDayText(input.weekStart)} au ${shortDayText(input.weekEnd)}`,
    scaleMaxMm: max,
    farm,
    shown: rows.slice(0, WEEK_GARDENS_SHOWN),
    hidden,
    moreLabel: hidden.length === 0 ? null : hidden.length === 1 ? 'Voir l’autre jardin' : `Voir les ${hidden.length} autres jardins`,
    tiles: {
      objective: mm(farm.objectiveMm),
      received: mm(farm.receivedMm),
      receivedDetail: farm.rainMm === null
        ? `${mmText(rounded(farm.irrigationMm))} d’irrigation, pluie inconnue`
        : `${mmText(rounded(farm.irrigationMm))} d’irrigation, ${mmText(rounded(farm.rainMm))} de pluie mesurée`,
      remaining: mm(farm.remainingMm),
      water: water ? volume(water.weekCubicMeters) : null,
      waterToday: water ? `dont ${volume(water.todayCubicMeters)} aujourd’hui` : null,
    },
  };
}
