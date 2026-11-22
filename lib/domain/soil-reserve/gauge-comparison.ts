import type { SoilReserveDay } from './gauge.ts';
import type { GaugeEngine } from './gauge-switch.ts';

/**
 * La comparaison des deux calculs de la jauge (docs/shared-engine-adapter-contract.md,
 * « L'interrupteur et la preuve d'égalité ») : l'ancien calcul du module et le
 * moteur commun, jour par jour, grandeur par grandeur. Le bilan ne garde que
 * des nombres et des noms de grandeurs : planches et jours comparés, jours en
 * écart par grandeur, le plus grand écart ; aucune donnée de la ferme (ni nom,
 * ni identifiant, ni date).
 */

/** L'écart admis entre les deux calculs sur la ferme réelle, en mm (MC-30). */
const ENGINE_TOLERANCE_MM = 0.01;

/** Une raison d'échec tient en une ligne courte du journal. */
const FAILURE_LENGTH = 200;

/**
 * Les jours comparés au plus chaque matin, toutes fermes comprises : environ
 * trois secondes de calcul (une planche suivie trois mois compte une centaine
 * de jours). Au-delà, les planches suivantes ne sont plus comparées, et leur
 * nombre est dit : la mesure ne doit jamais mettre en péril le matin, dont le
 * temps de calcul est borné.
 */
export const COMPARED_DAYS_PER_MORNING = 50_000;

/** Une grandeur d'un jour qui s'écarte ; `field` suit le chemin dans le jour, comme `bare.depletionMm`. */
export type DayGap = { field: string; reference: unknown; other: unknown };

export type GaugeComparison = {
  beds: number;
  days: number;
  /** Les jours où au moins une grandeur s'écarte. */
  daysWithGap: number;
  /** Par grandeur du jour (premier niveau), les jours où elle s'écarte. */
  gapsByField: Record<string, number>;
  /** Le plus grand écart entre deux nombres, en mm (en % pour le % du plein, en part du jour pour la fraction). */
  maxGap: number;
  /** Les planches dont l'autre calcul a échoué, et la première raison, les dates masquées. */
  failures: number;
  firstFailure: string | null;
  /** Les planches laissées sans comparaison, la limite du matin atteinte. */
  skippedBeds: number;
};

/** L'autre calcul que celui de l'interrupteur : celui que la comparaison du matin rejoue. */
export function otherGaugeEngine(engine: GaugeEngine): GaugeEngine {
  return engine === 'module' ? 'commun' : 'module';
}

export function emptyGaugeComparison(): GaugeComparison {
  return { beds: 0, days: 0, daysWithGap: 0, gapsByField: {}, maxGap: 0, failures: 0, firstFailure: null, skippedBeds: 0 };
}

/** Les grandeurs d'un jour qui s'écartent de plus de `tolerance`, et le plus grand écart entre deux nombres. */
export function dayGaps(reference: SoilReserveDay, other: SoilReserveDay, tolerance: number): { gaps: DayGap[]; maxGap: number } {
  const result = { gaps: [] as DayGap[], maxGap: 0 };
  walk(reference, other, '', tolerance, result);
  return result;
}

/**
 * La comparaison du matin d'une planche : l'autre calcul, rejoué sur la même
 * entrée, s'ajoute au bilan. Son échec est compté, jamais levé ; la limite du
 * matin atteinte, la planche est comptée sans être calculée.
 */
export function compareBed(tally: GaugeComparison, reference: readonly SoilReserveDay[], other: () => readonly SoilReserveDay[]): void {
  if (tally.days >= COMPARED_DAYS_PER_MORNING) {
    tally.skippedBeds += 1;
    return;
  }
  try {
    addBedComparison(tally, reference, other());
  } catch (error) {
    addBedFailure(tally, error);
  }
}

/** Ajoute au bilan les jours d'une planche calculés par les deux calculs. */
function addBedComparison(tally: GaugeComparison, reference: readonly SoilReserveDay[], other: readonly SoilReserveDay[]): void {
  tally.beds += 1;
  const count = Math.max(reference.length, other.length);
  for (let index = 0; index < count; index += 1) {
    tally.days += 1;
    const [a, b] = [reference[index], other[index]];
    if (a === undefined || b === undefined) {
      tally.daysWithGap += 1;
      tally.gapsByField.days = (tally.gapsByField.days ?? 0) + 1;
      continue;
    }
    const { gaps, maxGap } = dayGaps(a, b, ENGINE_TOLERANCE_MM);
    tally.maxGap = Math.max(tally.maxGap, maxGap);
    if (gaps.length === 0) continue;
    tally.daysWithGap += 1;
    for (const field of new Set(gaps.map((gap) => gap.field.split('.')[0]))) tally.gapsByField[field] = (tally.gapsByField[field] ?? 0) + 1;
  }
}

/** Compte une planche dont l'autre calcul a échoué ; la raison garde sa forme, les dates et les instants masqués. */
function addBedFailure(tally: GaugeComparison, error: unknown): void {
  tally.failures += 1;
  if (tally.firstFailure !== null) return;
  const message = error instanceof Error ? `${error.name} : ${error.message}` : 'erreur inconnue';
  tally.firstFailure = message.replace(/\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?/g, 'AAAA-MM-JJ').slice(0, FAILURE_LENGTH);
}

/**
 * La ligne du journal du matin : le calcul de l'interrupteur, celui qui est
 * rejoué, la version du moteur commun et le bilan, rien de la ferme.
 */
export function engineComparisonEntry(comparison: GaugeComparison, engine: GaugeEngine, engineVersion: string): Record<string, unknown> {
  return {
    event: 'soil_reserve_engine_comparison',
    reference: engine,
    compared: otherGaugeEngine(engine),
    engineVersion,
    toleranceMm: ENGINE_TOLERANCE_MM,
    ...comparison,
  };
}

function walk(reference: unknown, other: unknown, field: string, tolerance: number, result: { gaps: DayGap[]; maxGap: number }): void {
  if (typeof reference === 'number' && typeof other === 'number') {
    if (Object.is(reference, other)) return;
    const gap = Math.abs(reference - other);
    if (Number.isFinite(gap)) result.maxGap = Math.max(result.maxGap, gap);
    if (!(gap <= tolerance)) result.gaps.push({ field, reference, other });
    return;
  }
  if (isRecord(reference) && isRecord(other) && Array.isArray(reference) === Array.isArray(other)) {
    for (const key of new Set([...Object.keys(reference), ...Object.keys(other)])) {
      walk(reference[key], other[key], field === '' ? key : `${field}.${key}`, tolerance, result);
    }
    return;
  }
  if (reference !== other) result.gaps.push({ field, reference, other });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
