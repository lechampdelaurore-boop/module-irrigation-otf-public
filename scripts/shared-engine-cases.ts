import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cropWaterDay, type BedWaterSettings, type CropWaterDay } from '../lib/domain/crop-water/etm.ts';
import type { CultivationDates } from '../lib/domain/crop-water/crop-calendar.ts';
import type { BedWaterDay } from '../lib/domain/crop-water/proposal.ts';
import type { ReferenceCrop } from '../lib/domain/crop-water/reference.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import type { PlanningInputs } from '../lib/domain/planning/contract.ts';
import { bareSoilDay } from '../lib/domain/soil-reserve/bare-soil.ts';
import { bedSoilReserve, dayBounds, type BedSoilInput, type SoilReserveDay } from '../lib/domain/soil-reserve/gauge.ts';
import { soilRfuMmPerMeter, type SoilRecord } from '../lib/domain/soil-reserve/soil.ts';
import { waterSurplus } from '../lib/domain/soil-reserve/water-surplus.ts';
import { millisecondsFromHours } from '../lib/domain/units.ts';
import { addDaysToDateKey } from '../lib/domain/water-management.ts';
import { farm, settings as planningSettings } from '../tests/support/planning-fixtures.ts';
import {
  BED,
  crop,
  cropDay,
  farmThreshold,
  fixed,
  irrigation,
  observation,
  profile,
  rain,
  SHELTER_BED,
  soilInput,
  soilRecord,
} from '../tests/support/soil-reserve-fixtures.ts';

/**
 * Le script des cas de test du moteur commun (docs/shared-engine-cases-contract.md,
 * fusion des moteurs, étape 1, D-114) : il fait calculer par le code actuel
 * du module les cas O01 à O10 du dépôt commun, écrits à la main, et les cas
 * limites du contrat de fusion, et compare aux valeurs écrites. Il mesure :
 * il ne modifie rien, ne lit ni la ferme ni la base, n'appelle aucun réseau.
 * Une valeur fausse se corrige dans le contrat, jamais dans le code.
 *
 *   node --experimental-strip-types --import ./tests/support/register.mjs scripts/shared-engine-cases.ts [--cas <chemin>] [--json]
 */

type Scalar = number | string | boolean | null;
export type Verdict = 'conforme' | 'conforme, déduit' | 'écart' | 'non joué';
type ValueResult = { key: string; expected: Scalar; actual: Scalar | undefined; verdict: Verdict; reason?: string };
type CaseResult = { id: string; title: string; origin: 'dépôt commun' | 'cas limite'; values: ValueResult[] };
export type Report = { casesFile: string; version: string; tolerance: number; cases: CaseResult[] };

/** Ce qu'un cas mesure pour une valeur : la sortie du code, une grandeur déduite, une vérification qualitative, ou rien. */
type Measure =
  | { kind: 'value'; value: Scalar }
  | { kind: 'deduced'; value: number; how: string }
  | { kind: 'check'; ok: boolean; observed: string }
  | { kind: 'not-played'; reason: string };

type SharedCase = { id: string; titre: string; entrees: Record<string, unknown>; attendu: Record<string, Scalar> } & Record<string, unknown>;
type CasesFile = { version: string; tolerance: number; cas: SharedCase[] };

const SCRIPT_FOLDER = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CASES_PATH = path.join(SCRIPT_FOLDER, 'shared-engine', 'cas-otf.json');
const REQUIRED_IDS = Array.from({ length: 10 }, (_, index) => `O${String(index + 1).padStart(2, '0')}`);
export const EDGE_CASE_IDS = ['L1', 'L2', 'L3', 'L3 bis', 'L4', 'L5', 'L6', 'L7'] as const;
/** La tolérance des cas limites, celle du fichier commun. */
const EDGE_TOLERANCE = 0.01;
const PERCENT = 100;

// ---------------------------------------------------------------------------
// Les verdicts
// ---------------------------------------------------------------------------

/** Un nombre à la tolérance près, `null` pour `null`, un texte ou un booléen égal. */
export function compareValue(expected: Scalar, actual: Scalar | undefined, tolerance: number): { verdict: 'conforme' | 'écart' } {
  if (expected === null || actual === null || actual === undefined) return { verdict: expected === actual ? 'conforme' : 'écart' };
  if (typeof expected === 'number' && typeof actual === 'number') {
    return { verdict: Math.abs(expected - actual) <= tolerance + Number.EPSILON * PERCENT ? 'conforme' : 'écart' };
  }
  return { verdict: expected === actual ? 'conforme' : 'écart' };
}

function judge(key: string, expected: Scalar, measure: Measure | undefined, tolerance: number): ValueResult {
  if (measure === undefined) return { key, expected, actual: undefined, verdict: 'non joué', reason: 'le script ne sait pas traduire cette valeur en sortie du code' };
  if (measure.kind === 'not-played') return { key, expected, actual: undefined, verdict: 'non joué', reason: measure.reason };
  if (measure.kind === 'check') return { key, expected, actual: measure.observed, verdict: measure.ok ? 'conforme' : 'écart' };
  const { verdict } = compareValue(expected, measure.value, tolerance);
  if (measure.kind === 'deduced') return { key, expected, actual: measure.value, verdict: verdict === 'conforme' ? 'conforme, déduit' : 'écart', reason: measure.how };
  return { key, expected, actual: measure.value, verdict };
}

// ---------------------------------------------------------------------------
// La lecture des cas
// ---------------------------------------------------------------------------

export function readCases(file: string): CasesFile {
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<CasesFile>;
  if (!Array.isArray(parsed.cas) || typeof parsed.tolerance !== 'number') throw new Error(`${file} : ni « cas » ni « tolerance ».`);
  const ids = new Set(parsed.cas.map((item) => item.id));
  const missing = REQUIRED_IDS.filter((id) => !ids.has(id));
  if (missing.length > 0) throw new Error(`${file} : cas manquants ${missing.join(', ')}.`);
  return { version: String(parsed.version ?? 'inconnue'), tolerance: parsed.tolerance, cas: parsed.cas };
}

/** Les valeurs attendues d'un cas : `attendu`, et les blocs `attendu_…` d'une variante, préfixés. */
function expectedValues(item: SharedCase): [string, Scalar][] {
  const entries: [string, Scalar][] = Object.entries(item.attendu ?? {});
  for (const [block, values] of Object.entries(item)) {
    if (!block.startsWith('attendu_') || typeof values !== 'object' || values === null) continue;
    for (const [key, value] of Object.entries(values as Record<string, Scalar>)) entries.push([`${block}.${key}`, value]);
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Les entrées du code
// ---------------------------------------------------------------------------

/** Lundi 1er juin 2026, des jours de 24 heures (heure d'été, UTC+2). */
const D1 = '2026-06-01';
const day = (offset: number) => addDaysToDateKey(D1, offset);
/** Un instant à la ferme : le jour et l'heure locale. */
const at = (date: string, hours: number) => new Date(dayBounds(date).from + millisecondsFromHours(hours)).toISOString();
const midnight = (date: string) => at(date, 0);

/** Le sol et la profondeur qui donnent une capacité : 30 cm quand la RFU tombe juste, sinon 51 mm/m. */
function capacitySoil(capacityMm: number, overrides: Partial<SoilRecord> = {}): { soil: SoilRecord; depthM: number } {
  const defaultDepthM = 0.3;
  const rfu = capacityMm / defaultDepthM;
  if (Math.abs(rfu - Math.round(rfu)) < 1e-9) return { soil: soilRecord({ labRfuMmPerMeter: Math.round(rfu), stoneSharePercent: 0, ...overrides }), depthM: defaultDepthM };
  const farmRfu = 51;
  return { soil: soilRecord({ labRfuMmPerMeter: farmRfu, stoneSharePercent: 0, ...overrides }), depthM: capacityMm / farmRfu };
}

/** Une planche cultivée suivie jour par jour : ETM et pluie de chaque jour, la culture d'essai à `depthM`, p `p`. */
function gauge(options: {
  capacityMm: number;
  days: { etm: number | null; rain?: number | null; rank?: number; blocked?: string[] }[];
  overrides?: Partial<BedSoilInput>;
  p?: number;
  depths?: [number | null, number][];
  soil?: Partial<SoilRecord>;
}): SoilReserveDay[] {
  const { soil, depthM } = capacitySoil(options.capacityMm, options.soil);
  const dates = options.days.map((_, index) => day(index));
  const waterDays = options.days.map((item, index): BedWaterDay => {
    if (item.blocked) return { date: dates[index], status: 'blocked', etmMm: null, et0: null, crops: [], irrigationStop: false, problems: item.blocked };
    const plant = crop({ referenceCropId: 'essai', rank: item.rank ?? 1, etmMm: item.etm });
    return cropDay(dates[index], [plant], item.etm === null ? null : { mm: item.etm, nature: 'reanalysis' });
  });
  const rainEntries = Object.fromEntries(options.days.flatMap((item, index) => (item.rain === null ? [] : [[dates[index], item.rain ?? 0]])));
  const stages = (options.depths ?? [[null, depthM]]).map(([rank, depth]) => fixed(rank, depth));
  return bedSoilReserve(soilInput({
    waterDays,
    soilRecords: [soil],
    rootingProfiles: [profile('essai', options.p ?? 0.5, stages)],
    rain: rain(rainEntries),
    ...options.overrides,
  }));
}

const value = (measured: Scalar | undefined): Measure => ({ kind: 'value', value: measured ?? null });
const num = (input: Record<string, unknown>, key: string): number => {
  const found = input[key];
  if (typeof found !== 'number') throw new Error(`entrée « ${key} » absente ou non numérique`);
  return found;
};

// ---------------------------------------------------------------------------
// O01 à O10
// ---------------------------------------------------------------------------

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** O01 : l'ETM d'une culture d'essai au Kc du cas, par `cropWaterDay`, facteur par facteur. */
function etmCase(input: Record<string, unknown>): Record<string, Measure> {
  const kc = num(input, 'kc');
  const reference: ReferenceCrop = {
    id: 'essai-kc', name: 'Culture d’essai', source: 'criiam', emergenceDelayDays: { 'direct-sowing': 0, planting: 0 },
    curve: { shape: 'steps', stages: [{ rank: 1, label: 'Stade unique', kc }], sets: [{ months: ALL_MONTHS, value: [{ anchor: { from: 'implantation', days: 0 }, estimated: false }] }] },
  };
  const dates: CultivationDates = {
    seriesId: 's', seriesName: 'Série d’essai', cultivationId: 'c', plantId: 'p', plantName: 'Essai', implantationKind: 'planting',
    dayZero: D1, presenceStart: D1, firstHarvest: '2026-08-03', lastHarvest: '2026-08-30', midHarvest: '2026-08-17',
  };
  const open: BedWaterSettings = { bedId: BED.id, shelterId: null, shelterFactors: [], mulch: [], shadeNets: [] };
  const sheltered: BedWaterSettings = { ...open, shelterId: 'abri', shelterFactors: [{ shelterId: 'abri', value: num(input, 'k_abri'), effectiveFrom: D1, recordedAt: midnight(D1) }] };
  const mulched: BedWaterSettings = { ...sheltered, mulch: [{ bedId: BED.id, season: 2026, plasticMulch: true }] };
  const shaded: BedWaterSettings = { ...mulched, shadeNets: [{ bedId: BED.id, rate: num(input, 'ombrage_taux'), from: D1, to: null }] };
  const etm = (settings: BedWaterSettings): Measure => {
    const result: CropWaterDay = cropWaterDay({
      bedId: BED.id, date: day(30), dates, correspondence: { kind: 'reference', referenceCropId: reference.id, analogy: false, exception: false },
      referenceCrops: [reference], overrides: [], declarations: [], et0: { mm: num(input, 'et0'), nature: 'reanalysis' }, settings, options: { smoothing: false, shading: true },
    });
    return result.status === 'computed' ? value(result.etmMm) : { kind: 'check', ok: false, observed: `ETM non calculée (${result.status})` };
  };
  return { plein_champ: etm(open), sous_abri: etm(sheltered), sous_abri_paillage: etm(mulched), sous_abri_paillage_ombrage: etm(shaded) };
}

function soilCase(input: Record<string, unknown>): Record<string, Measure> {
  return { rfu_sol_mm_par_m: value(soilRfuMmPerMeter(num(input, 'rfu_labo_mm_par_m'), num(input, 'cailloux_pct'))) };
}

/** O03 : la capacité et les deux seuils de la jauge ; la RU et la RAW, que le code ne nomme pas, en sont déduites. */
function thresholdCase(input: Record<string, unknown>): Record<string, Measure> {
  const rfu = num(input, 'rfu_sol');
  const share = num(input, 'part_reference');
  const run = (farmPercent: number | null) => gauge({
    capacityMm: rfu * num(input, 'profondeur_m'),
    p: num(input, 'p'),
    soil: { labRfuMmPerMeter: rfu, stoneSharePercent: 0, referenceShare: share },
    depths: [[null, num(input, 'profondeur_m')]],
    days: [{ etm: 0 }],
    overrides: { settings: farmPercent === null ? [] : [farmThreshold(farmPercent)] },
  })[0];
  const crop = run(null);
  const farmDay = run(num(input, 'seuil_ferme_pct'));
  const capacity = crop.capacityMm ?? Number.NaN;
  const threshold = crop.thresholdMm ?? Number.NaN;
  return {
    capacite_mm: value(crop.capacityMm),
    seuil_selon_culture_mm: value(crop.thresholdMm),
    seuil_ferme_mm: value(farmDay.thresholdMm),
    RU_mm: { kind: 'deduced', value: capacity / share, how: 'capacité du code ÷ part de référence (le code ne nomme pas la RU)' },
    RAW_mm: { kind: 'deduced', value: capacity - threshold, how: 'capacité − seuil selon la culture, sorties du code (le code ne nomme pas la RAW)' },
  };
}

/** O04 : la veille à l'état du cas, puis deux jours ; le manque Dr, que le code ne tient pas, en est déduit. */
function floorCase(input: Record<string, unknown>): Record<string, Measure> {
  const capacity = num(input, 'capacite');
  const first = input.jour1 as Record<string, unknown>;
  const second = input.jour2 as Record<string, unknown>;
  const days = gauge({
    capacityMm: capacity,
    days: [{ etm: 0, rain: 0 }, { etm: num(first, 'conso'), rain: num(first, 'pluie') }, { etm: num(second, 'conso'), rain: num(second, 'pluie') }],
    overrides: { observations: [observation(num(first, 'etat_veille') / capacity * PERCENT, midnight(day(0)))] },
  });
  const dr = (state: number | null): Measure => ({ kind: 'deduced', value: capacity - (state ?? Number.NaN), how: 'capacité − état du code (le code tient l’état, pas le manque Dr)' });
  return {
    etat_fin_jour1: value(days[1].stateMm),
    etat_fin_jour2: value(days[2].stateMm),
    'attendu_en_manque_Dr.Dr_veille': dr(days[0].stateMm),
    'attendu_en_manque_Dr.Dr_fin_jour1': dr(days[1].stateMm),
    'attendu_en_manque_Dr.Dr_fin_jour2': dr(days[2].stateMm),
  };
}

function observationCase(input: Record<string, unknown>): Record<string, Measure> {
  const [hours, minutes] = String(input.heure).split(':').map(Number);
  const { from, to } = dayBounds(D1);
  const length = (to - from) / millisecondsFromHours(1);
  const [result] = gauge({
    capacityMm: num(input, 'capacite'),
    days: [{ etm: num(input, 'conso'), rain: num(input, 'pluie') }],
    overrides: { observations: [observation(num(input, 'observation_pct'), at(D1, hours + minutes / 60))] },
  });
  if (length !== num(input, 'duree_jour_h')) throw new Error(`O05 : le jour d'essai dure ${length} h`);
  return { etat_apres_observation: value(result.startMm), fraction: value(result.fraction), etat_fin: value(result.stateMm) };
}

/** O06 : une révision du sol le jour 2 fait passer la capacité de l'une à l'autre valeur. */
function capacityCase(input: Record<string, unknown>): Record<string, Measure> {
  const before = num(input, 'capacite_avant');
  const after = capacitySoil(num(input, 'capacite_apres'), { effectiveFrom: day(1) });
  const initial = capacitySoil(before);
  if (initial.depthM !== after.depthM) throw new Error('O06 : les deux capacités demandent deux profondeurs');
  const days = gauge({
    capacityMm: before,
    days: [{ etm: 0 }, { etm: 0 }],
    overrides: { soilRecords: [initial.soil, after.soil], observations: [observation(num(input, 'etat') / before * PERCENT, midnight(day(0)))] },
  });
  const tlaloc = 'variante du jeu Tlaloc (conservation « manque », MC-11) : le code OTF ne l’a pas';
  return {
    etat_apres: value(days[1].startMm),
    etat_apres_conservation_pourcent: value(days[1].startMm),
    etat_apres_conservation_manque: { kind: 'not-played', reason: tlaloc },
    pourcent_du_plein_apres_conservation_manque: { kind: 'not-played', reason: tlaloc },
  };
}

function unknownDayCase(input: Record<string, unknown>): Record<string, Measure> {
  const inflow = num(input.jour2 as Record<string, unknown>, 'apports');
  const days = gauge({ capacityMm: num(input, 'capacite'), days: [{ etm: null, rain: 0 }, { etm: 0, rain: inflow }] });
  return { etat_jour1: value(days[0].stateMm), etat_jour2: value(days[1].stateMm), drainage_jour2: value(days[1].drainageMm) };
}

/**
 * O08 : la ferme des tests (quatre tunnels de huit planches, 16 m² mouillés
 * chacune, 20 mm de besoin), le passe-pied de T1-1 effacé : sa surface
 * mouillée sous la rampe du tunnel 1 est inconnue (D-097). Le cas ne donne ni
 * les besoins ni les surfaces : il est joué au budget du cas, puis au budget
 * des tests de D-097, 5 m³, où la pénurie existe ; les vérifications A et B
 * portent sur ce second jeu, le premier est rapporté.
 */
const SHORTAGE_BUDGET_CUBIC_METERS = 5;

/** Les 32 planches des tunnels ont le même besoin, 20 mm, et la même surface sous leur rampe : la demande sans B en est les 31/32. */
const TUNNEL_BED_COUNT = 32;
const cubic = (cubicMeters: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(cubicMeters);

function unknownAreaPlan(budgetCubicMeters: number, unknownAlley: boolean) {
  const zero = { rawPlanningNeedMm: 0, effectiveNeedMm: 0 };
  const { inputs: base } = farm({ extraTunnels: true, forageFlow: 0, reservoirCubicMeters: budgetCubicMeters, plotNeeds: { 'bloc-1': zero, 'bloc-2': zero } });
  const unknownBed = 'T1-1';
  const inputs: PlanningInputs = !unknownAlley ? base : {
    ...base,
    beds: base.beds.map((bed) => (bed.id === unknownBed ? { ...bed, alleyWidth: null } : bed)),
    needs: base.needs.map((need) => (need.bedId === unknownBed ? { ...need, wettedAreaSquareMeters: null, wettedAreaSource: 'unknown-alley', effectiveVolumeCubicMeters: null } : need)),
  };
  const plan = buildWeeklyPlan(inputs, planningSettings);
  const [budget] = plan.budgets;
  return {
    unknownBed,
    bedB: plan.beds.find((bed) => bed.bedId === unknownBed),
    others: plan.beds.filter((bed) => bed.bedId.startsWith('T') && bed.bedId !== unknownBed),
    budget,
    shortage: Object.values(budget.fractions).some((fraction) => fraction < 1),
    placed: plan.proposals.reduce((sum, proposal) => sum + (proposal.volumeCubicMeters ?? 0), 0),
    noUnknownProposal: plan.proposals.every((proposal) => proposal.volumeCubicMeters !== null),
  };
}

function unknownAreaCase(input: Record<string, unknown>): Record<string, Measure> {
  const asWritten = unknownAreaPlan(num(input, 'budget_m3'), true);
  const played = unknownAreaPlan(SHORTAGE_BUDGET_CUBIC_METERS, true);
  const allKnown = unknownAreaPlan(SHORTAGE_BUDGET_CUBIC_METERS, false);
  const knownDemand = allKnown.budget.demandCubicMeters * (TUNNEL_BED_COUNT - 1) / TUNNEL_BED_COUNT;
  const { bedB, budget } = played;
  const okB = Boolean(bedB?.reasons.includes('volume-unknown-under-budget')) && budget.unknownVolumeBedCount === 1 && bedB?.targetMm === 0;
  const othersShared = played.others.some((bed) => bed.targetMm > 0);
  const okA = played.shortage && Math.abs(budget.demandCubicMeters - knownDemand) < 1e-9 && othersShared && played.noUnknownProposal && played.placed <= SHORTAGE_BUDGET_CUBIC_METERS + 1e-9;
  const written = `au budget du cas, ${num(input, 'budget_m3')} m³ : pénurie ${asWritten.shortage ? 'oui' : 'non'} (demande connue ${cubic(asWritten.budget.demandCubicMeters)} m³)`;
  return {
    B: { kind: 'check', ok: okB, observed: `à ${SHORTAGE_BUDGET_CUBIC_METERS} m³, ${played.unknownBed} : motif ${bedB?.reasons.join(', ') || 'aucun'}, cible ${bedB?.targetMm} mm, ${budget.unknownVolumeBedCount ?? 0} planche comptée à part ; ${written}` },
    A: { kind: 'check', ok: okA, observed: `à ${SHORTAGE_BUDGET_CUBIC_METERS} m³ : pénurie ${played.shortage ? 'oui' : 'non'}, demande ${cubic(budget.demandCubicMeters)} m³ (sans B ; ${cubic(allKnown.budget.demandCubicMeters)} m³ avec B connue), les autres planches servies : ${othersShared ? 'oui' : 'non'}, ${cubic(played.placed)} m³ placés, aucun volume inconnu proposé : ${played.noUnknownProposal ? 'oui' : 'non'}` },
  };
}

function bareSoilCase(input: Record<string, unknown>): Record<string, Measure> {
  const tew = num(input, 'TEW');
  const result = bareSoilDay({
    geometry: { tewMm: tew, rewMm: num(input, 'REW'), surfaceRfuMm: 5.1, deepRfuMm: 10.2 },
    previous: { depletionMm: num(input, 'De_veille'), deepMm: 0 },
    inflowMm: 0,
    et0Mm: num(input, 'et0'),
    shelterFactor: num(input, 'k_abri'),
    evaporationShare: num(input, 'part_etat'),
    fraction: num(input, 'fraction'),
  });
  const bareSoilKcMax = 1.2;
  const potential = num(input, 'part_etat') * bareSoilKcMax * num(input, 'et0') * num(input, 'k_abri') * num(input, 'fraction');
  return {
    Kr: { kind: 'deduced', value: result.evaporationMm / potential, how: 'E du code ÷ (part × 1,2 × ET0 × K_abri × fraction), E n’étant pas bornée par TEW − De (le code ne rend pas Kr)' },
    E_mm: value(result.evaporationMm),
  };
}

/** O10 : un jour plein à minuit, la pluie et l'arrosage du cas, l'ETM qui donne le drainage du cas ; puis la pastille. */
function surplusCase(input: Record<string, unknown>): Record<string, Measure> {
  const drainage = num(input, 'drainage');
  const rainMm = num(input, 'pluie');
  const irrigationMm = num(input, 'irrigation');
  const actual = { ...irrigation(at(D1, 6), at(D1, 7), irrigationMm), wettedAreaSquareMeters: 10 };
  const days = gauge({
    capacityMm: 15.3,
    days: [{ etm: rainMm + irrigationMm - drainage, rain: rainMm }],
    overrides: { observations: [observation(PERCENT, midnight(D1))], irrigations: [actual] },
  });
  if (Math.abs(days[0].drainageMm - drainage) > 1e-9) throw new Error(`O10 : le jour d'essai draine ${days[0].drainageMm} mm`);
  const surplus = waterSurplus({ today: day(1), beds: [{ id: BED.id, name: 'Planche A' }], daysByBed: new Map([[BED.id, days]]), actualByBed: new Map([[BED.id, [actual]]]) });
  return { eau_perdue: value(surplus.beds[0]?.drainedMm ?? null) };
}

const SHARED_RUNNERS: Record<string, (input: Record<string, unknown>) => Record<string, Measure>> = {
  O01: etmCase, O02: soilCase, O03: thresholdCase, O04: floorCase, O05: observationCase,
  O06: capacityCase, O07: unknownDayCase, O08: unknownAreaCase, O09: bareSoilCase, O10: surplusCase,
};

// ---------------------------------------------------------------------------
// Les cas limites (contrat de fusion § 5), écrits au contrat du script
// ---------------------------------------------------------------------------

type EdgeCase = { id: (typeof EDGE_CASE_IDS)[number]; title: string; run: () => [string, Scalar, Measure][] };

const FARM_CAPACITY = 15.3;
const kind = (found: SoilReserveDay) => found.unknown?.kind ?? null;

const EDGE_CASES: EdgeCase[] = [
  {
    id: 'L1', title: 'Jour inconnu puis remplissage',
    run: () => {
      const days = gauge({ capacityMm: FARM_CAPACITY, days: [{ etm: 3, rain: 0 }, { etm: 3, rain: null }, { etm: 3, rain: 10 }, { etm: 3, rain: 20 }], overrides: { observations: [observation(PERCENT, midnight(D1))] } });
      return [
        ['jour1_etat', 12.3, value(days[0].stateMm)],
        ['jour2_etat', null, value(days[1].stateMm)], ['jour2_raison', 'missing-rain', value(kind(days[1]))],
        ['jour3_etat', null, value(days[2].stateMm)], ['jour3_raison', 'missing-rain', value(kind(days[2]))],
        ['jour4_etat', 15.3, value(days[3].stateMm)], ['jour4_depart', 'inflow', value(days[3].restart)],
      ];
    },
  },
  {
    id: 'L2', title: 'Observation à midi, arrosages avant et après',
    run: () => {
      const [result] = gauge({
        capacityMm: FARM_CAPACITY, days: [{ etm: 4, rain: 0 }],
        overrides: { observations: [observation(50, at(D1, 12))], irrigations: [irrigation(at(D1, 8), at(D1, 9), 10), irrigation(at(D1, 18), at(D1, 19), 5)] },
      });
      return [['fraction', 0.5, value(result.fraction)], ['depart', 7.65, value(result.startMm)], ['irrigation_comptee', 5, value(result.irrigationMm)], ['etat_fin', 10.65, value(result.stateMm)]];
    },
  },
  {
    id: 'L3', title: 'Changement de capacité par le stade, % du plein conservé',
    run: () => {
      const days = gauge({ capacityMm: FARM_CAPACITY, depths: [[1, 0.3], [2, 0.6]], days: [{ etm: 0, rank: 1 }, { etm: 0, rank: 2 }], overrides: { soilRecords: [soilRecord({ labRfuMmPerMeter: 51, stoneSharePercent: 0 })], observations: [observation(60, midnight(D1))] } });
      return [['jour1_etat', 9.18, value(days[0].stateMm)], ['jour2_capacite', 30.6, value(days[1].capacityMm)], ['jour2_depart', 18.36, value(days[1].startMm)], ['jour2_etat', 18.36, value(days[1].stateMm)]];
    },
  },
  {
    id: 'L3 bis', title: 'Capacité qui baisse, % du plein conservé',
    run: () => {
      const days = gauge({ capacityMm: FARM_CAPACITY, depths: [[1, 0.6], [2, 0.3]], days: [{ etm: 0, rank: 1 }, { etm: 0, rank: 2 }], overrides: { soilRecords: [soilRecord({ labRfuMmPerMeter: 51, stoneSharePercent: 0 })], observations: [observation(60, midnight(D1))] } });
      return [['jour1_etat', 18.36, value(days[0].stateMm)], ['jour2_depart', 9.18, value(days[1].startMm)]];
    },
  },
  {
    id: 'L4', title: 'Arrosage proposé un jour prévu',
    run: () => {
      const [result] = gauge({
        capacityMm: FARM_CAPACITY, days: [{ etm: 4, rain: 0 }],
        overrides: { today: D1, observations: [observation(PERCENT, midnight(D1))], irrigations: [irrigation(at(D1, 6), at(D1, 7), 3, 'proposed'), irrigation(at(D1, 20), at(D1, 21), 2, 'planned')] },
      });
      return [['nature', 'forecast', value(result.nature)], ['irrigation', 5, value(result.irrigationMm)], ['etat_fin', 15.3, value(result.stateMm)], ['drainage', 1, value(result.drainageMm)]];
    },
  },
  {
    id: 'L5', title: 'Abri sans pluie',
    run: () => {
      const days = gauge({
        capacityMm: FARM_CAPACITY, days: [{ etm: 2, rain: 20 }, { etm: 2, rain: null }],
        overrides: { bed: SHELTER_BED, soilRecords: [soilRecord({ plotId: SHELTER_BED.plotId, labRfuMmPerMeter: 51, stoneSharePercent: 0 })], observations: [observation(PERCENT, midnight(D1), SHELTER_BED.plotId)] },
      });
      return [['jour1_pluie_comptee', 0, value(days[0].rainMm)], ['jour1_etat', 13.3, value(days[0].stateMm)], ['jour2_etat', 11.3, value(days[1].stateMm)], ['jour2_raison', null, value(kind(days[1]))]];
    },
  },
  {
    id: 'L6', title: 'ET0 hors bornes',
    run: () => {
      const status = (et0: number) => {
        const reference: ReferenceCrop = { id: 'essai-kc', name: 'Culture d’essai', source: 'criiam', emergenceDelayDays: { 'direct-sowing': 0, planting: 0 }, curve: { shape: 'steps', stages: [{ rank: 1, label: 'Stade unique', kc: 1 }], sets: [{ months: ALL_MONTHS, value: [{ anchor: { from: 'implantation', days: 0 }, estimated: false }] }] } };
        const dates: CultivationDates = { seriesId: 's', seriesName: 'Série', cultivationId: 'c', plantId: 'p', plantName: 'Essai', implantationKind: 'planting', dayZero: D1, presenceStart: D1, firstHarvest: '2026-08-03', lastHarvest: '2026-08-30', midHarvest: '2026-08-17' };
        const result = cropWaterDay({ bedId: BED.id, date: day(30), dates, correspondence: { kind: 'reference', referenceCropId: reference.id, analogy: false, exception: false }, referenceCrops: [reference], overrides: [], declarations: [], et0: { mm: et0, nature: 'reanalysis' }, settings: { bedId: BED.id, shelterId: null, shelterFactors: [], mulch: [], shadeNets: [] }, options: { smoothing: false, shading: false } });
        return result.status === 'blocked' ? `blocked : ${result.problems.join(' ; ')}` : result.status;
      };
      const blockedMessage = (text: string): Measure => ({ kind: 'check', ok: text.startsWith('blocked') && text.includes('ET0 hors bornes'), observed: text });
      const [blockedDay] = gauge({ capacityMm: FARM_CAPACITY, days: [{ etm: null, blocked: ['ET0 hors bornes (essai)'] }], overrides: { observations: [observation(PERCENT, midnight(D1))] } });
      return [
        // Bornes 0 à 15 mm/j depuis MC-37 (D-232) : 11,9, 12,1 et 14,9 calculées, 15,1 et −0,1 bloquées.
        ['et0_11_9', 'computed', value(status(11.9))],
        ['et0_12_1', 'computed', value(status(12.1))],
        ['et0_14_9', 'computed', value(status(14.9))],
        ['et0_15_1', 'bloqué, ET0 nommée', blockedMessage(status(15.1))],
        ['et0_moins_0_1', 'bloqué, ET0 nommée', blockedMessage(status(-0.1))],
        ['jauge_etat', null, value(blockedDay.stateMm)], ['jauge_raison', 'blocked', value(kind(blockedDay))],
      ];
    },
  },
  {
    id: 'L7', title: 'Plancher atteint puis pluie',
    run: () => {
      const days = gauge({ capacityMm: FARM_CAPACITY, days: [{ etm: 0, rain: 0 }, { etm: 5, rain: 0 }, { etm: 5, rain: 0 }, { etm: 1, rain: 3 }], overrides: { observations: [observation(2 / FARM_CAPACITY * PERCENT, midnight(D1))] } });
      return [['jour0_etat', 2, value(days[0].stateMm)], ['jour1_etat', 0, value(days[1].stateMm)], ['jour2_etat', 0, value(days[2].stateMm)], ['jour3_etat', 2, value(days[3].stateMm)]];
    },
  },
];

// ---------------------------------------------------------------------------
// La mesure et le compte rendu
// ---------------------------------------------------------------------------

export function measureCases(file: CasesFile, casesFile = DEFAULT_CASES_PATH): Report {
  const cases: CaseResult[] = file.cas.map((item) => {
    const runner = SHARED_RUNNERS[item.id];
    const measures = runner ? runner(item.entrees ?? {}) : {};
    const values = expectedValues(item).map(([key, expected]) => judge(key, expected, measures[key], file.tolerance));
    return { id: item.id, title: item.titre, origin: 'dépôt commun' as const, values };
  });
  for (const edge of EDGE_CASES) {
    cases.push({ id: edge.id, title: edge.title, origin: 'cas limite', values: edge.run().map(([key, expected, measure]) => judge(key, expected, measure, EDGE_TOLERANCE)) });
  }
  return { casesFile, version: file.version, tolerance: file.tolerance, cases };
}

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });
const show = (scalar: Scalar | undefined) => (scalar === undefined ? '—' : scalar === null ? 'inconnu (null)' : typeof scalar === 'number' ? decimal.format(scalar) : String(scalar));
const caseVerdict = (item: CaseResult) => (item.values.some((entry) => entry.verdict === 'écart') ? 'écart' : item.values.every((entry) => entry.verdict === 'non joué') ? 'non joué' : 'conforme');

export function formatReport(report: Report, commit: string | null): string {
  const lines = [
    'Cas de test du moteur commun, jeu OTF : le code du module comparé aux valeurs écrites',
    `Code du module : ${commit ?? 'commit inconnu'} ; cas : ${path.relative(process.cwd(), report.casesFile)} (version ${report.version}), tolérance ${decimal.format(report.tolerance)}`,
    '',
  ];
  for (const item of report.cases) {
    lines.push(`${item.id} (${item.origin}) — ${item.title} : ${caseVerdict(item)}`);
    for (const entry of item.values) {
      const reason = entry.reason ? ` (${entry.reason})` : '';
      lines.push(`  ${entry.key} : attendu ${show(entry.expected)} ; code ${show(entry.actual)} ; ${entry.verdict}${reason}`);
    }
  }
  const byVerdict = (verdict: string) => report.cases.filter((item) => caseVerdict(item) === verdict).map((item) => item.id);
  const notPlayed = report.cases.flatMap((item) => item.values.filter((entry) => entry.verdict === 'non joué').map((entry) => `${item.id}.${entry.key}`));
  lines.push('', 'Bilan', `- Cas conformes (${byVerdict('conforme').length}) : ${byVerdict('conforme').join(', ') || 'aucun'}`);
  lines.push(`- Cas en écart (${byVerdict('écart').length}) : ${byVerdict('écart').join(', ') || 'aucun'}`);
  lines.push(`- Valeurs non jouées (${notPlayed.length}) : ${notPlayed.join(', ') || 'aucune'}`);
  return lines.join('\n');
}

function main(argv: readonly string[]): void {
  const casIndex = argv.indexOf('--cas');
  const casesFile = casIndex >= 0 ? path.resolve(argv[casIndex + 1] ?? '') : DEFAULT_CASES_PATH;
  const report = measureCases(readCases(casesFile), casesFile);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  let commit: string | null = null;
  try {
    commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    commit = null;
  }
  console.log(formatReport(report, commit));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
