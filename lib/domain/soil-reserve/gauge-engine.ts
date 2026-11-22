import {
  JEU_OTF,
  suivre,
  type JeuDeReglages,
  type JourDonnees,
  type JourSortie,
  type Observation,
  type RaisonInconnu,
} from './shared-engine/moteur-hydrique.mjs';
import type { SurfaceState } from './bare-soil.ts';
import type { DayRain, IrrigationInterval, SoilObservation, SoilReserveDay, UnknownReason } from './gauge.ts';
import { PERCENT } from './soil.ts';

/**
 * L'adaptateur du moteur hydrique commun (docs/shared-engine-adapter-contract.md,
 * « La traduction ») : un tronçon de jours à un compartiment — planche
 * cultivée, engrais vert ou enherbée — passe au moteur, jeu OTF, en un seul
 * appel ; ses sorties redeviennent des jours de la jauge. L'adaptateur ne
 * calcule rien du bilan : la consommation, la capacité, la profondeur, p, la
 * pluie et les observations de la planche viennent du module (hors moteur,
 * MC-18) ; le départ, le recalage, les apports, les bornes, le drainage, le
 * départ par un apport et le jour inconnu viennent du moteur.
 */

/** La version du moteur commun figée dans le module, pour le journal de la comparaison du matin. */
export { VERSION_MOTEUR as SHARED_ENGINE_VERSION } from './shared-engine/moteur-hydrique.mjs';

/** Un jour d'un tronçon, tel que le module le voit, sans le bilan. */
export type EngineDay = {
  /** Le jour de la jauge sans le bilan : mode, profondeur, capacité, p, seuil, cultures, mentions. */
  base: SoilReserveDay;
  /** La part de la réserve utile que représente la RFU (θu = capacité ÷ profondeur ÷ part). */
  referenceShare: number;
  /** La consommation du jour, ETM ou couvert, ou la raison du module quand elle manque. */
  consumption: { mm: number; gap: null } | { mm: null; gap: UnknownReason };
  /** La pluie extérieure du jour ; `null` : inconnue. Sous abri, elle n'est pas lue. */
  rain: DayRain | null;
  /** La part de la pluie comptée sous paillage plastique, 1 sans paillage. */
  mulchShare: number;
  surfaceState: SurfaceState | null;
};

export type EngineRun = {
  today: string;
  sheltered: boolean;
  /** R2 du planning : la part de la pluie prévue retenue. */
  forecastRainShare: number;
  days: readonly EngineDay[];
  irrigations: readonly IrrigationInterval[];
  /** Les observations qui couvrent la planche, chacune avec le jour de la ferme où elle tombe. */
  observations: readonly { observation: SoilObservation; date: string }[];
  /** L'état du soir de la veille, d'un jour de sol nu ; `null` : inconnu. */
  start: { stateMm: number; capacityMm: number } | null;
  /** La raison de la jauge inconnue avant le tronçon, que garde un jour sans départ. */
  reason: UnknownReason;
};

/** Le jeu OTF du moteur, avec R2 du planning pour la pluie prévue. */
function otfSettings(forecastRainShare: number): JeuDeReglages {
  return { ...JEU_OTF, pluie: { ...JEU_OTF.pluie, part_prevue: forecastRainShare } };
}

/** Les jours d'un tronçon de la jauge, calculés par le moteur commun. */
export function engineRun(run: EngineRun): SoilReserveDay[] {
  const outputs = suivre({
    aujourdhui: run.today,
    jours: run.days.map((day) => engineDayInput(day, run.sheltered)),
    arrosages: engineIrrigations(run.irrigations),
    observations: engineObservations(run),
    etat_initial: run.start === null
      ? null
      : { dr_mm: Math.max(0, run.start.capacityMm - run.start.stateMm), dmax_mm: run.start.capacityMm },
  }, otfSettings(run.forecastRainShare));
  const gaps = new Map(run.days.flatMap((day) => (day.consumption.gap === null ? [] : [[day.base.date, day.consumption.gap] as const])));
  return outputs.map((output, index) => gaugeDay(run.days[index], output, gaps, run.reason));
}

function engineDayInput(day: EngineDay, sheltered: boolean): JourDonnees {
  const { capacityMm, depthM, p } = day.base;
  return {
    date: day.base.date,
    etc_mm: day.consumption.mm,
    etc_raison: day.consumption.gap?.kind ?? null,
    // Dmax = min(RU ; plancher) = la capacité suivie, le plein d'OTF (MC-02, MC-22).
    sol: capacityMm === null || depthM === null
      ? null
      : { theta_u_mm_m: capacityMm / depthM / day.referenceShare, zr_m: depthM, p_tableau: p, plancher_mm: capacityMm },
    abri: sheltered,
    pluie: sheltered || day.rain === null
      ? null
      : day.rain.nature === 'forecast' ? { type: 'prevue', mm: day.rain.mm } : { type: 'jour', mm: day.rain.mm },
    part_paillage: day.mulchShare,
  };
}

/** Les apports comme le module les compte : sans mm positif ou sans début lisible, ils ne comptent pas ; sans fin après le début, ils sont ponctuels. */
function engineIrrigations(intervals: readonly IrrigationInterval[]) {
  return intervals.flatMap((interval) => {
    const start = Date.parse(interval.startAt);
    const end = Date.parse(interval.endAt);
    if (!Number.isFinite(start) || !(interval.mm > 0)) return [];
    return [{
      debut: interval.startAt,
      fin: Number.isFinite(end) && end > start ? interval.endAt : null,
      mm: interval.mm,
      nature: interval.nature,
    }];
  });
}

/**
 * Les observations des jours du tronçon, en manque : capacité du jour × (1 − %),
 * triées par heure puis par enregistrement (à instant égal, la dernière
 * enregistrée l'emporte, comme `latestObservation`). Un jour sans capacité,
 * l'observation ne recale rien mais nomme un trou de données.
 */
function engineObservations(run: EngineRun): Observation[] {
  const capacities = new Map(run.days.map((day) => [day.base.date, day.base.capacityMm]));
  return run.observations
    .filter(({ date }) => capacities.has(date))
    .map(({ observation, date }, rank) => ({ observation, capacity: capacities.get(date) ?? null, rank }))
    .sort((a, b) => compareText(a.observation.observedAt, b.observation.observedAt)
      || compareText(a.observation.recordedAt, b.observation.recordedAt)
      || a.rank - b.rank)
    .map(({ observation, capacity }) => ({
      instant: observation.observedAt,
      type: 'manque' as const,
      dr_mm: capacity === null ? 0 : capacity * (1 - Math.min(1, Math.max(0, observation.percent / PERCENT))),
    }));
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Un jour du moteur redevenu un jour de la jauge. */
function gaugeDay(day: EngineDay, output: JourSortie, gaps: ReadonlyMap<string, UnknownReason>, before: UnknownReason): SoilReserveDay {
  if (output.date !== day.base.date) throw new RangeError(`moteur commun : jour ${output.date} rendu pour ${day.base.date}`);
  const dmax = output.dmax_mm;
  const known = output.connu;
  if (known && (dmax === null || output.dr_mm === null || output.drainage_mm === null)) {
    throw new RangeError(`moteur commun : jour ${output.date} connu sans état ni drainage`);
  }
  return {
    ...day.base,
    nature: output.nature === 'estime' ? 'estimated' : 'forecast',
    startMm: output.dr_depart_mm === null || dmax === null ? null : dmax - output.dr_depart_mm,
    stateMm: known ? (dmax as number) - (output.dr_mm as number) : null,
    percent: known ? output.pct_plein : null,
    // Un jour inconnu, le moteur dit le drainage inconnu (MC-09) ; la jauge l'affiche 0, comme avant.
    drainageMm: known ? output.drainage_mm as number : 0,
    rainMm: output.pluie_mm,
    irrigationMm: output.arrosage_mm,
    consumptionMm: output.etc_mm,
    fraction: output.fraction,
    restart: output.redemarrage === 'remplissage' ? 'inflow' : output.redemarrage,
    unknown: known ? null : unknownReason(output.raison_inconnu, gaps, before),
  };
}

/** La raison d'une jauge inconnue, dans les mots du module. */
function unknownReason(reason: RaisonInconnu | null, gaps: ReadonlyMap<string, UnknownReason>, before: UnknownReason): UnknownReason {
  if (reason === null) throw new RangeError('moteur commun : jour inconnu sans raison');
  if (reason.code === 'pas_commence') return before;
  if (reason.date === null) throw new RangeError(`moteur commun : raison ${reason.code} sans date`);
  if (reason.code === 'pluie_inconnue') return { kind: 'missing-rain', date: reason.date };
  // Une capacité inconnue : une culture sans profondeur, comme avant.
  if (reason.code === 'sol_inconnu') return { kind: 'crop-without-etm', date: reason.date, crops: [] };
  const gap = reason.code === 'etc_inconnue' ? gaps.get(reason.date) : undefined;
  if (gap === undefined) throw new RangeError(`moteur commun : raison ${reason.code} du ${reason.date} sans équivalent dans le module`);
  return gap;
}
