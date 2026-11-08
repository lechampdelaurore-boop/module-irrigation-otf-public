import { addDaysToDateKey } from '../water-management.ts';
import { dayBounds, irrigationBetween, type IrrigationInterval, type SoilReserveDay } from './gauge.ts';

/**
 * La pastille « eau arrosée en trop » (docs/soil-reserve-contract.md, « La
 * pastille de l'eau arrosée en trop », D-060) : sur les sept derniers jours
 * passés, l'eau d'irrigation que le sol n'a pas pu retenir, perdue sous les
 * racines, planche par planche et en tout, en mm et en m³. Elle lit la jauge
 * de la 5 ter, qui compte la consommation de la 5 quater : le drainage d'un
 * jour se partage entre la pluie et l'irrigation au prorata de leurs mm. Une
 * planche arrosée un jour où sa jauge est inconnue est dite à part, jamais
 * comptée pour 0 (D-003). Une information : rien ne change un besoin, un
 * plan ni une dose (D-028).
 */

type BedWaterSurplus = {
  bedId: string;
  bedName: string;
  /** Les mm d'irrigation perdus en drainage sur la période. */
  drainedMm: number;
  /** Leur volume ; `null` quand la surface mouillée d'une irrigation est inconnue. */
  cubicMeters: number | null;
  days: string[];
};

export type WaterSurplus = {
  from: string;
  to: string;
  /** Le volume des planches dont il est connu ; `null` quand aucune n'a d'eau en trop au volume connu. */
  cubicMeters: number | null;
  /** Des planches ont de l'eau en trop au volume inconnu : le total est un minimum. */
  volumeIncomplete: boolean;
  beds: BedWaterSurplus[];
  /** Les planches arrosées un jour où leur jauge est inconnue. */
  unknownBeds: { bedId: string; bedName: string }[];
};

/** Sept jours passés : la semaine qui vient de s'écouler, jusqu'à hier. */
export const SURPLUS_DAYS = 7;
/** Sous un dixième de mm, l'écart tient de l'arrondi : la planche n'est pas citée. */
const NEGLIGIBLE_MM = 0.1;
const LITERS_PER_CUBIC_METER = 1000;

/** Une irrigation réalisée et la surface qui convertit ses mm en volume. */
export type ActualIrrigation = IrrigationInterval & { wettedAreaSquareMeters: number | null };

export function waterSurplus(input: {
  today: string;
  beds: readonly { id: string; name: string }[];
  daysByBed: ReadonlyMap<string, readonly SoilReserveDay[]>;
  actualByBed: ReadonlyMap<string, readonly ActualIrrigation[]>;
}): WaterSurplus {
  const from = addDaysToDateKey(input.today, -SURPLUS_DAYS);
  const to = addDaysToDateKey(input.today, -1);
  const beds: BedWaterSurplus[] = [];
  const unknownBeds: WaterSurplus['unknownBeds'] = [];
  for (const bed of input.beds) {
    const actual = input.actualByBed.get(bed.id) ?? [];
    if (actual.length === 0) continue;
    const days = input.daysByBed.get(bed.id) ?? [];
    let drainedMm = 0;
    let cubicMeters: number | null = 0;
    let unknown = false;
    const drainedDays: string[] = [];
    for (let date = from; date <= to; date = addDaysToDateKey(date, 1)) {
      const bounds = dayBounds(date);
      const irrigatedMm = irrigationBetween(actual, bounds.from, bounds.to);
      if (!(irrigatedMm > 0)) continue;
      const day = days.find((candidate) => candidate.date === date);
      if (!day || day.stateMm === null || day.rainMm === null) {
        unknown = true;
        continue;
      }
      const inflow = day.rainMm + day.irrigationMm;
      if (!(day.drainageMm > 0) || !(day.irrigationMm > 0) || !(inflow > 0)) continue;
      const dayDrained = day.drainageMm * day.irrigationMm / inflow;
      drainedMm += dayDrained;
      drainedDays.push(date);
      const volumeUnknown = actual.some((interval) => interval.wettedAreaSquareMeters === null && irrigationBetween([interval], bounds.from, bounds.to) > 0);
      const volume = volumeUnknown
        ? null
        : irrigationBetween(actual.map((interval) => ({ ...interval, mm: interval.mm * (interval.wettedAreaSquareMeters ?? 0) / LITERS_PER_CUBIC_METER })), bounds.from, bounds.to);
      cubicMeters = cubicMeters === null || volume === null ? null : cubicMeters + volume * dayDrained / irrigatedMm;
    }
    if (drainedMm >= NEGLIGIBLE_MM) beds.push({ bedId: bed.id, bedName: bed.name, drainedMm, cubicMeters, days: drainedDays });
    else if (unknown) unknownBeds.push({ bedId: bed.id, bedName: bed.name });
  }
  const known = beds.filter((bed) => bed.cubicMeters !== null);
  return {
    from,
    to,
    cubicMeters: known.length === 0 ? null : known.reduce((total, bed) => total + bed.cubicMeters!, 0),
    volumeIncomplete: known.length < beds.length,
    beds: beds.sort((a, b) => b.drainedMm - a.drainedMm || a.bedName.localeCompare(b.bedName, 'fr', { numeric: true })),
    unknownBeds,
  };
}
