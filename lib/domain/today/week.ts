import { compareNamesNaturally } from '../bed-order.ts';
import { farmObjective, farmObjectivePartial, farmObjectiveScopeText } from '../farm-objective.ts';
import { mmText, waterText } from '../figure-origin.ts';
import type { BedIrrigationNeed } from '../irrigation-needs.ts';
import { groupObjectiveOriginText, type ObjectiveOriginReading } from '../objective-reading.ts';
import { percentFromFraction } from '../units.ts';
import type { WaterDashboardDay } from '../water-management.ts';
import { MEASURED_RAIN_ANCHOR } from './reliability.ts';
import { shortDayText } from './today-text.ts';

/**
 * « La semaine » et « Eau de la semaine » du tableau de bord « Aujourd'hui »
 * (docs/aujourdhui-tableau-de-bord-contract.md, section 3.2, précision T4) :
 * l'objectif, l'eau reçue (irrigation réelle et pluie comptée) et ce qui
 * reste à apporter, pour la ferme et par jardin, comme les lit « Objectifs
 * et besoins » pour la semaine en cours. Rien ne se calcule de nouveau : le
 * reste à apporter est celui du tableau des besoins (objectif − pluie réelle
 * − irrigation réelle, jamais négatif, D-010). Les millimètres ne
 * s'additionnent pas entre surfaces : ils se pondèrent par la surface,
 * Σ(mm × m²) / Σ(m²) ; une valeur inconnue d'une planche laisse le total
 * inconnu (D-003).
 *
 * Un objectif posé sur une partie des planches seulement (audit ergonomique
 * final, lot A, R2, F280) : l'objectif, l'eau reçue et le reste à apporter
 * se chiffrent sur les planches qui ont un objectif, et le disent (« sur
 * 7 planches sur 10 ») ; jamais un total qui mêle du connu et de l'inconnu,
 * jamais « non fixé » quand des planches en ont un.
 */

/**
 * La pluie extérieure des jours déjà écoulés de la semaine, par origine
 * (audit du 19 novembre 2026, lot H, n° 3, F429) : mesurée au pluviomètre,
 * estimée après coup (la réanalyse), ou prévue (la prévision reprise pour un
 * jour passé, D-019). Leur somme est la pluie déjà comptée : seul le mot
 * change, jamais le calcul.
 */
export type RainOrigins = { measuredMm: number; reanalysisMm: number; forecastMm: number };

/** Les jours écoulés jusqu'à aujourd'hui compris, comme les compte le tableau des besoins (D-019). */
export function pastRainOrigins(
  days: readonly Pick<WaterDashboardDay, 'date' | 'manualRainMm' | 'reanalysisRainMm' | 'forecastRainMm'>[],
  today: string,
): RainOrigins {
  const origins: RainOrigins = { measuredMm: 0, reanalysisMm: 0, forecastMm: 0 };
  for (const day of days) {
    if (day.date > today) continue;
    if (day.manualRainMm !== null) origins.measuredMm += Math.max(0, day.manualRainMm);
    else if (day.reanalysisRainMm !== null) origins.reanalysisMm += Math.max(0, day.reanalysisRainMm);
    else if (day.forecastRainMm !== null) origins.forecastMm += Math.max(0, day.forecastRainMm);
  }
  return origins;
}

/** Ce que la page lit d'une planche dans le tableau des besoins de la semaine. */
export type TodayWeekBed = Pick<BedIrrigationNeed,
  'plotId' | 'plotName' | 'sheltered' | 'areaSquareMeters' | 'objectiveMm' | 'actualRainMm' | 'actualIrrigationMm' | 'realRemainingMm'>
  /** L'origine de l'objectif (6 decies, O4, D-319) ; absente, l'objectif se lit comme avant. */
  & Partial<Pick<BedIrrigationNeed, 'objectiveOrigin' | 'automaticObjective'>>;

export type TodayWeekInputs = {
  weekStart: string;
  weekEnd: string;
  /** Les planches de la saison, dans l'ordre du tableau des besoins (parcelle, puis jardin). */
  beds: readonly TodayWeekBed[];
  /** L'eau d'irrigation réalisée de la semaine et du jour, en m³ ; `incomplete` quand une surface mouillée manque. */
  water: { weekCubicMeters: number; todayCubicMeters: number; incomplete: boolean } | null;
  /** La pluie des jours écoulés par origine ; absente, la pluie se dit sans origine, jamais « mesurée » (F429). */
  rainOrigins?: RainOrigins | null;
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
  /** Les planches qui ont un objectif cette semaine, sur toutes celles du jardin ou de la ferme (F280). */
  objectiveBeds: { withObjective: number; total: number };
  /** « 8 / 20 mm », « 8 / 20 mm sur 7 planches sur 10 », « 8 mm reçus, aucun objectif posé », « pluie inconnue ». */
  text: string;
  /** L'origine de l'objectif quand l'objectif automatique y compte : « automatique, d’après l’ET0 » ; `null` sinon. */
  objectiveOrigin: string | null;
  /** Les barres empilées et le trait de l'objectif, en % de l'échelle. */
  bars: { irrigationPercent: number; rainPercent: number; objectivePercent: number | null };
  /** La phrase lue de la ligne, nom de son lien : « Jardin Nord : 7 / 20 mm ». */
  label: string;
  /** Où mène la ligne (L2) : la ferme au tableau des besoins, un jardin à son pli dans ce tableau. */
  anchor: string;
};

/**
 * Ce qu'une tuile de la semaine ouvre (6 nonies, L1,
 * docs/aujourdhui-liens-contract.md, section 3) : un endroit de la page
 * « Objectifs et besoins », qui existe dès que la semaine se lit (elle n'est
 * lue que cette case cochée). Le mot d'action est écrit sur la tuile : au
 * téléphone, rien d'autre ne dit qu'elle est un lien. Un lien mène, il
 * n'enregistre rien (D-028).
 */
/**
 * Le lien d'une tuile. `rain` : la tuile ouvre la fenêtre « Noter la pluie »
 * (simplification S2, PR 4 ; L1 réécrite), le lien vers « Objectifs et
 * besoins » restant dans la fenêtre, pour retirer ou voir jour par jour.
 */
export type TodayTileLink = { label: string; page: 'besoins'; anchor: string; rain?: true };

/** Les volets et tableaux d'« Objectifs et besoins » que les tuiles visent (water-management-dashboard.tsx, irrigation-needs-dashboard.tsx). */
const WEEK_OBJECTIVES_ANCHOR = 'objectifs-de-la-semaine';
const WEEK_DAYS_ANCHOR = 'weather';
const NEEDS_TABLE_ANCHOR = 'irrigation-needs-title';

/**
 * L'ancre d'un jardin dans le tableau des besoins d'« Objectifs et besoins »
 * (6 nonies, L2) : son pli s'ouvre quand l'adresse le vise.
 */
export function needsGardenAnchor(plotId: string): string {
  return `besoin-jardin-${plotId}`;
}

export type TodayWeek = {
  /** « du lun. 2 nov. au dim. 8 nov. ». */
  label: string;
  /** « Pluie mesurée », « Pluie prévue, non mesurée », « Pluie mesurée et prévue »… : la légende des barres (F429). */
  rainLegend: string;
  scaleMaxMm: number;
  farm: WeekRow;
  shown: WeekRow[];
  hidden: WeekRow[];
  moreLabel: string | null;
  /** Les tuiles de la semaine. */
  tiles: {
    objective: string | null;
    /** « ferme entière, du … », ou « sur les 7 planches sur 10 qui ont un objectif, du … » (F280). */
    objectiveDetail: string;
    received: string | null;
    receivedDetail: string | null;
    remaining: string | null;
    remainingDetail: string;
    /** « 18 m³ », « au moins 18 m³ » quand une surface mouillée manque ; `null` sans « Ressources » ni tableau de l'eau. */
    water: string | null;
    waterToday: string | null;
  };
  /** Où mène chaque tuile, et le mot qui le dit (L1). */
  links: {
    objective: TodayTileLink;
    received: TodayTileLink;
    remaining: TodayTileLink;
    water: TodayTileLink;
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

/** « 1 planche de 2 a un objectif », « 5 planches de 10 ont un objectif ». */
function bedsOf(count: number, total: number): string {
  return `${count} planche${count > 1 ? 's' : ''} de ${total} ${count > 1 ? 'ont' : 'a'} un objectif`;
}

/**
 * Les planches sur lesquelles se chiffre la ligne (F280) : celles qui ont un
 * objectif quand une partie seulement en a un ; sinon toutes.
 */
function counted(beds: readonly TodayWeekBed[]): { scope: readonly TodayWeekBed[]; objectiveBeds: WeekRow['objectiveBeds'] } {
  const withObjective = beds.filter((bed) => bed.objectiveMm !== null);
  const partial = withObjective.length > 0 && withObjective.length < beds.length;
  return { scope: partial ? withObjective : beds, objectiveBeds: { withObjective: withObjective.length, total: beds.length } };
}

/** L'origine lue d'une planche ; sans elle, l'objectif est dit comme avant. */
function originReading(bed: TodayWeekBed): ObjectiveOriginReading {
  return { objectiveOrigin: bed.objectiveOrigin ?? null, automaticObjective: bed.automaticObjective ?? null };
}

function row(key: string, name: string, beds: readonly TodayWeekBed[], scaleMaxMm: number): WeekRow {
  const { scope, objectiveBeds } = counted(beds);
  // L'objectif de la ferme et de chaque jardin : le calcul unique (S1, PR 3), sur les planches qui en ont un.
  const objective = farmObjective(beds);
  const partial = farmObjectivePartial(objective);
  const objectiveMm = objective.objectiveMm;
  const irrigationMm = weighted(scope, (bed) => Math.max(0, bed.actualIrrigationMm)) ?? 0;
  const rainMm = weighted(scope, (bed) => bed.actualRainMm);
  const receivedMm = rainMm === null ? null : irrigationMm + rainMm;
  const remainingMm = weighted(scope, (bed) => bed.realRemainingMm);
  const percent = (mm: number) => rounded(percentFromFraction(Math.min(1, Math.max(0, mm / scaleMaxMm))));
  const irrigationPercent = percent(irrigationMm);
  // Un seul « sur » par phrase (lot H, n° 13, F443) : « 15 / 26,7 mm (5 planches de 10 ont un objectif) ».
  const on = partial ? ` (${bedsOf(objectiveBeds.withObjective, objectiveBeds.total)})` : '';
  const origin = objectiveMm === null ? null : groupObjectiveOriginText(scope.map(originReading));
  // L'objectif automatique se dit sur la ligne, en un mot (D-319, section 5, point 3).
  const automatic = origin === null ? '' : `, objectif ${groupObjectiveOriginText(scope.map(originReading), false)}`;
  const text = objectiveMm === null
    ? `${mmText(rounded(receivedMm ?? irrigationMm))} reçus, aucun objectif posé`
    : receivedMm === null
      ? `${mmText(rounded(irrigationMm))} irrigués / ${mmText(rounded(objectiveMm))}${on}${automatic}, pluie inconnue`
      : `${millimeters.format(receivedMm)} / ${mmText(rounded(objectiveMm))}${on}${automatic}`;
  return {
    key,
    name,
    sheltered: beds.every((bed) => bed.sheltered),
    objectiveMm,
    irrigationMm,
    rainMm,
    receivedMm,
    remainingMm,
    objectiveBeds,
    text,
    objectiveOrigin: origin,
    bars: {
      irrigationPercent,
      rainPercent: rainMm === null ? 0 : Math.max(0, rounded(Math.min(100, percent(irrigationMm + rainMm)) - irrigationPercent)),
      objectivePercent: objectiveMm === null ? null : percent(objectiveMm),
    },
    label: `${name} : ${text}`,
    anchor: key === 'farm' ? NEEDS_TABLE_ANCHOR : needsGardenAnchor(key),
  };
}

const RAIN_SHARE_EPSILON = 0.05;
const REMAINING_NAMES_SHOWN = 3;

/**
 * « pour les jardins encore sous leur objectif : T1, T2, T3 et 1 autre »
 * (lot H, n° 13, F439) : quand une partie seulement des jardins qui ont un
 * objectif reste en dessous, la tuile dit lesquels, pour que « Reste à
 * apporter » ne contredise pas « Eau reçue ». Nulle sinon.
 */
function remainingFor(rows: readonly WeekRow[]): string | null {
  const withObjective = rows.filter((row) => row.objectiveMm !== null && row.remainingMm !== null);
  const under = withObjective.filter((row) => (row.remainingMm ?? 0) > RAIN_SHARE_EPSILON)
    .map((row) => row.name).sort(compareNamesNaturally);
  if (under.length === 0 || under.length === withObjective.length) return null;
  const shown = under.slice(0, REMAINING_NAMES_SHOWN);
  const others = under.length - shown.length;
  const names = others > 0 ? [...shown, `${others} autre${others > 1 ? 's' : ''}`] : shown;
  return `pour ${under.length === 1 ? 'le jardin encore sous son objectif' : 'les jardins encore sous leur objectif'} : ${listed(names)}`;
}

type RainOrigin = { key: keyof RainOrigins; alone: string; part: string; legend: string };
const RAIN_ORIGIN_WORDS: readonly RainOrigin[] = [
  { key: 'measuredMm', alone: 'de pluie mesurée', part: 'mesurés', legend: 'mesurée' },
  { key: 'reanalysisMm', alone: 'de pluie estimée après coup', part: 'estimés après coup', legend: 'estimée' },
  { key: 'forecastMm', alone: 'de pluie prévue, non mesurée', part: 'prévus', legend: 'prévue' },
];

function presentOrigins(origins: RainOrigins | null | undefined): RainOrigin[] {
  if (!origins) return [];
  return RAIN_ORIGIN_WORDS.filter((origin) => origins[origin.key] > RAIN_SHARE_EPSILON);
}

function listed(parts: readonly string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}

/**
 * « 30,7 mm de pluie prévue, non mesurée », « 12 mm de pluie mesurée »,
 * « 30,7 mm de pluie, dont 12 mm mesurés et 18,7 mm prévus » : la part de
 * chaque origine se lit sur la pluie de la ligne, au prorata de la pluie
 * extérieure (une planche sous abri n'en reçoit pas). Sans origine connue,
 * « de pluie », jamais « mesurée » (F429).
 */
function rainText(rainMm: number, origins: RainOrigins | null | undefined, sheltered: boolean): string {
  const total = `${mmText(rounded(rainMm))} de pluie`;
  if (sheltered) return `${total}, sous abri`;
  const present = presentOrigins(origins);
  if (rainMm <= RAIN_SHARE_EPSILON || present.length === 0 || !origins) return total;
  if (present.length === 1) return `${mmText(rounded(rainMm))} ${present[0].alone}`;
  const exterior = present.reduce((sum, origin) => sum + origins[origin.key], 0);
  const parts = present.map((origin) => `${mmText(rounded(rainMm * origins[origin.key] / exterior))} ${origin.part}`);
  return `${total}, dont ${listed(parts)}`;
}

/** La légende des barres : « Pluie mesurée », « Pluie prévue, non mesurée », « Pluie mesurée et prévue ». */
function rainLegend(origins: RainOrigins | null | undefined): string {
  const present = presentOrigins(origins);
  if (present.length === 0) return 'Pluie';
  if (present.length === 1 && present[0].key === 'forecastMm') return 'Pluie prévue, non mesurée';
  if (present.length === 1 && present[0].key === 'reanalysisMm') return 'Pluie estimée après coup';
  return `Pluie ${listed(present.map((origin) => origin.legend))}`;
}

function scaleMax(values: readonly (number | null)[]): number {
  const highest = Math.max(WEEK_SCALE_MINIMUM_MM, ...values.filter((value): value is number => value !== null && Number.isFinite(value)));
  return Math.ceil(highest / WEEK_SCALE_STEP_MM) * WEEK_SCALE_STEP_MM;
}

/**
 * Les jardins montrés d'emblée (audit du 19 novembre 2026, lot H, n° 4,
 * F430 et F432) : ceux qui ont une irrigation aujourd'hui, puis ceux qui
 * ont un objectif, du plus loin au plus près (le reste rapporté à
 * l'objectif, puis le reste en mm ; un reste inconnu après les connus),
 * puis ceux sans objectif ; à égalité, l'ordre naturel. Les autres, derrière
 * « Voir les n autres jardins », dans l'ordre naturel.
 */
function byWeekPriority(irrigatedToday: ReadonlySet<string>) {
  const gap = (row: WeekRow) => (row.objectiveMm === null || row.remainingMm === null ? null
    : row.objectiveMm > 0 ? row.remainingMm / row.objectiveMm : row.remainingMm > 0 ? Number.POSITIVE_INFINITY : 0);
  const rank = (row: WeekRow) => (row.objectiveMm === null ? 2 : row.remainingMm === null ? 1 : 0);
  return (a: WeekRow, b: WeekRow) =>
    Number(irrigatedToday.has(b.key)) - Number(irrigatedToday.has(a.key))
    || rank(a) - rank(b)
    || (gap(b) ?? 0) - (gap(a) ?? 0)
    || (b.remainingMm ?? 0) - (a.remainingMm ?? 0)
    || compareNamesNaturally(a.name, b.name)
    || compareNamesNaturally(a.key, b.key);
}

/** Les montrés selon une priorité, les autres dans l'ordre naturel (F432). */
export function shownFirst<T extends { key: string; name: string }>(rows: readonly T[], priority: (a: T, b: T) => number, shown: number) {
  const ordered = [...rows].sort(priority);
  return {
    shown: ordered.slice(0, shown),
    hidden: ordered.slice(shown).sort((a, b) => compareNamesNaturally(a.name, b.name) || compareNamesNaturally(a.key, b.key)),
  };
}

/** « Voir l'autre jardin », « Voir les 4 autres jardins ». */
export function moreGardensLabel(hidden: number): string | null {
  return hidden === 0 ? null : hidden === 1 ? 'Voir l’autre jardin' : `Voir les ${hidden} autres jardins`;
}

/**
 * Ce que « Eau de la semaine » lit des deux tableaux de la semaine, l'eau et
 * les besoins par planche : la même lecture pour « Aujourd'hui » et pour la
 * page « Semaine » (S4, section 6 : une seule fonction pour les deux pages).
 */
export function todayWeekInputs(
  water: { days: readonly Pick<WaterDashboardDay, 'date' | 'manualRainMm' | 'reanalysisRainMm' | 'forecastRainMm' | 'volumeIncomplete'>[]; totals: { realizedIrrigationCubicMeters: number }; todayWater: { realizedIrrigationCubicMeters: number } },
  needs: { weekStart: string; weekEnd: string; gardens: readonly { beds: readonly TodayWeekBed[] }[] },
  today: string,
): TodayWeekInputs {
  return {
    weekStart: needs.weekStart,
    weekEnd: needs.weekEnd,
    beds: needs.gardens.flatMap((garden) => garden.beds),
    water: {
      weekCubicMeters: water.totals.realizedIrrigationCubicMeters,
      todayCubicMeters: water.todayWater.realizedIrrigationCubicMeters,
      incomplete: water.days.some((day) => day.volumeIncomplete),
    },
    rainOrigins: pastRainOrigins(water.days, today),
  };
}

/**
 * La semaine de la ferme et de chaque jardin ; `null` sans planche de la
 * saison. `irrigatedToday` : les jardins qui ont une irrigation aujourd'hui,
 * montrés d'abord (F430). `gardensShown` : les jardins montrés d'emblée, huit
 * sur « Aujourd'hui », dix sur la page « Semaine » (S4-j).
 */
export function todayWeek(input: TodayWeekInputs, irrigatedToday: ReadonlySet<string> = new Set(), gardensShown = WEEK_GARDENS_SHOWN): TodayWeek | null {
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
  const { shown, hidden } = shownFirst(rows, byWeekPriority(irrigatedToday), gardensShown);
  const mm = (value: number | null) => (value === null ? null : mmText(rounded(value)));
  const water = input.water;
  const volume = (value: number) => `${water?.incomplete ? 'au moins ' : ''}${waterText(value, 'm³')}`;
  const label = `du ${shortDayText(input.weekStart)} au ${shortDayText(input.weekEnd)}`;
  const { withObjective, total } = farm.objectiveBeds;
  const objective = { objectiveMm: farm.objectiveMm, withObjective, total };
  const partial = farmObjectivePartial(objective);
  // Sur une partie des planches, chaque tuile le dit : jamais un chiffre lu pour la ferme entière (F280).
  const scoped = (detail: string) => (partial ? `${detail}, ${withObjective === 1 ? 'sur cette planche' : `sur ces ${withObjective} planches`}` : detail);
  return {
    label,
    rainLegend: rainLegend(input.rainOrigins),
    scaleMaxMm: max,
    farm,
    shown,
    hidden,
    moreLabel: moreGardensLabel(hidden.length),
    tiles: {
      objective: mm(farm.objectiveMm),
      objectiveDetail: `${farmObjectiveScopeText(objective)}, ${label}${farm.objectiveOrigin === null ? '' : ` · objectif ${farm.objectiveOrigin}`}`,
      received: mm(farm.receivedMm),
      receivedDetail: scoped(farm.rainMm === null
        ? `${mmText(rounded(farm.irrigationMm))} d’irrigation, pluie inconnue`
        : `${mmText(rounded(farm.irrigationMm))} d’irrigation, ${rainText(farm.rainMm, input.rainOrigins, farm.sheltered)}`),
      remaining: mm(farm.remainingMm),
      remainingDetail: farm.remainingMm === null
        ? 'une valeur manque : voir « Objectifs et besoins »'
        : remainingFor(rows) ?? scoped('objectif moins l’eau reçue, jamais négatif'),
      water: water ? volume(water.weekCubicMeters) : null,
      waterToday: water ? waterTodayText(water, volume) : null,
    },
    links: weekLinks(farm),
  };
}

/**
 * « dont 4 m³ aujourd'hui » ; « rien aujourd'hui » quand le volume du jour
 * est nul et sûr (L1) : jamais « dont 0 m³ ». Quand une surface mouillée
 * manque dans la semaine, un zéro peut cacher une irrigation sans volume :
 * la tuile garde « dont au moins 0 m³ aujourd'hui » plutôt que d'affirmer
 * « rien » (D-003, F757).
 */
function waterTodayText(water: NonNullable<TodayWeekInputs['water']>, volume: (value: number) => string): string {
  if (water.todayCubicMeters <= 0 && !water.incomplete) return 'rien aujourd’hui';
  return `dont ${volume(water.todayCubicMeters)} aujourd’hui`;
}

/**
 * Les quatre tuiles mènent à leur menu (L1, section 3, règle 1) : l'objectif
 * au volet des objectifs de la semaine ; l'eau reçue au volet « Pluie
 * mesurée », sauf pour une ferme toute sous abri, où la pluie ne compte pas
 * (D-032) et où elle mène aux jours de la semaine ; le reste à apporter au
 * tableau des besoins par planche ; l'eau utilisée aux jours de la semaine.
 */
function weekLinks(farm: WeekRow): TodayWeek['links'] {
  const besoins = (label: string, anchor: string): TodayTileLink => ({ label, page: 'besoins', anchor });
  return {
    objective: besoins(farm.objectiveMm === null ? 'Poser un objectif' : 'Modifier les objectifs', WEEK_OBJECTIVES_ANCHOR),
    received: farm.sheltered ? besoins('Voir jour par jour', WEEK_DAYS_ANCHOR) : { ...besoins('Noter la pluie', MEASURED_RAIN_ANCHOR), rain: true },
    remaining: besoins(farm.remainingMm === null ? 'Voir ce qui manque' : 'Voir par planche', NEEDS_TABLE_ANCHOR),
    water: besoins('Voir jour par jour', WEEK_DAYS_ANCHOR),
  };
}
