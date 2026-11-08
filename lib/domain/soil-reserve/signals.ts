import { daysFromTo } from '../crop-water/crop-calendar.ts';
import { bareSoilRoomMm, type SurfaceState } from './bare-soil.ts';
import { dayBounds, irrigationBetween, type IrrigationInterval, type SoilReserveDay, type UnknownReason } from './gauge.ts';
import { PERCENT } from './soil.ts';

/**
 * Les signaux de la jauge (docs/soil-reserve-contract.md, « Les signaux »,
 * « Par jardin et par parcelle », « Confiance ») : tous sont des
 * informations ; aucun ne change une dose, un besoin ni un plan (D-028,
 * D-047). Aucun conseil d'arrosage avant une plantation (D-053).
 */

/** Trois jours connus donnent le rythme des « jours avant le seuil » (D-053). */
const PACE_DAYS = 3;
/** Au-delà de 30 jours sans réglage, l'écran propose un contrôle à la bêche ou au tensiomètre. */
const CHECK_AFTER_DAYS = 30;

type DaysBeforeThreshold =
  /** La jauge prévue atteint le seuil ce jour-là, d'ici dimanche. */
  | { kind: 'forecast'; date: string }
  /** Au rythme des trois derniers jours connus, sans pluie ni arrosage. */
  | { kind: 'pace'; days: number; paceMm: number };

export type SoilReserveSummary = {
  /** L'état au début d'aujourd'hui, ou à l'heure de l'observation du jour. */
  current: { mm: number; percent: number; capacityMm: number; thresholdMm: number | null; observedAt: string | null } | null;
  unknown: UnknownReason | null;
  /** Le jour où la jauge passe au seuil ou dessous, estimée ou prévue. */
  thresholdDay: string | null;
  daysBeforeThreshold: DaysBeforeThreshold | null;
  /** Sous le seuil : la dose qui refait le plein, capacité − état, jamais plus que la capacité. */
  advisedDoseMm: number | null;
  /** Le Kc vaut 0 avant la récolte : « arrêt avant récolte » au lieu du seuil et de la dose. */
  irrigationStop: boolean;
  /** Le jour où la jauge arrive à 0, estimée ou prévue. */
  exhaustedDay: string | null;
  drainage: { date: string; mm: number }[];
  confidence: { since: string | null; kind: 'observation' | 'inflow' | null; days: number | null; checkProposed: boolean };
  proposedDepthCrops: string[];
};

/** Le résumé d'une planche aujourd'hui, à partir de ses jours suivis. */
export function soilReserveSummary(days: readonly SoilReserveDay[], today: string): SoilReserveSummary {
  const index = days.findIndex((day) => day.date === today);
  const todayDay = index >= 0 ? days[index] : null;
  const known = todayDay !== null && todayDay.startMm !== null && todayDay.capacityMm !== null && todayDay.capacityMm > 0;
  const current = known
    ? {
        mm: todayDay.startMm!,
        percent: todayDay.startMm! / todayDay.capacityMm! * PERCENT,
        capacityMm: todayDay.capacityMm!,
        thresholdMm: todayDay.thresholdMm,
        observedAt: todayDay.observation?.observedAt ?? null,
      }
    : null;
  const window = index >= 0 ? days.slice(index) : [];
  const irrigationStop = todayDay?.irrigationStop ?? false;
  const thresholdDay = irrigationStop ? null : reachedDay(days, index, (day) => day.thresholdMm);
  const exhaustedDay = reachedDay(days, index, () => 0);
  const advisedDoseMm = current !== null && current.thresholdMm !== null && !irrigationStop && current.mm <= current.thresholdMm
    ? Math.min(current.capacityMm, current.capacityMm - current.mm)
    : null;
  return {
    current,
    unknown: todayDay?.unknown ?? null,
    thresholdDay,
    daysBeforeThreshold: irrigationStop || current === null || current.thresholdMm === null || current.mm <= current.thresholdMm
      ? null
      : daysBefore(days, index, today, thresholdDay, { mm: current.mm, thresholdMm: current.thresholdMm }),
    advisedDoseMm,
    irrigationStop,
    exhaustedDay,
    drainage: window.filter((day) => day.drainageMm > 0).map((day) => ({ date: day.date, mm: day.drainageMm })),
    confidence: confidence(days, index, today),
    proposedDepthCrops: [...new Set((todayDay?.crops ?? []).filter((crop) => crop.proposedDepth).map((crop) => crop.plantName))],
  };
}

/**
 * Le jour où la jauge atteint une limite : déjà dessous aujourd'hui, le
 * premier jour de cette série, en remontant les jours estimés ; sinon le
 * premier jour prévu qui finit à la limite ou dessous.
 */
function reachedDay(days: readonly SoilReserveDay[], index: number, limitOf: (day: SoilReserveDay) => number | null): string | null {
  if (index < 0) return null;
  const today = days[index];
  const limit = limitOf(today);
  if (today.startMm !== null && limit !== null && today.startMm <= limit) {
    let first = today.date;
    for (let back = index - 1; back >= 0; back -= 1) {
      const day = days[back];
      const dayLimit = limitOf(day);
      if (day.stateMm === null || dayLimit === null || day.stateMm > dayLimit) break;
      first = day.date;
    }
    return first;
  }
  for (const day of days.slice(index)) {
    const dayLimit = limitOf(day);
    if (day.stateMm === null || dayLimit === null) return null;
    if (day.stateMm <= dayLimit) return day.date;
  }
  return null;
}

/**
 * Le jour du seuil d'ici dimanche ; sinon, depuis l'état de maintenant, le
 * nombre de jours au rythme de l'ETM moyenne des trois derniers jours connus,
 * sans pluie ni arrosage, arrondi vers le bas (D-053, scénario 13).
 */
function daysBefore(
  days: readonly SoilReserveDay[],
  index: number,
  today: string,
  thresholdDay: string | null,
  current: { mm: number; thresholdMm: number },
): DaysBeforeThreshold | null {
  if (thresholdDay !== null && thresholdDay >= today) return { kind: 'forecast', date: thresholdDay };
  const paced = days.slice(0, index)
    .filter((day) => day.nature === 'estimated' && day.consumptionMm !== null && day.fraction === 1 && day.mode !== 'bare')
    .slice(-PACE_DAYS);
  if (paced.length === 0) return null;
  const paceMm = paced.reduce((total, day) => total + (day.consumptionMm ?? 0), 0) / paced.length;
  if (!(paceMm > 0)) return null;
  return { kind: 'pace', days: Math.floor((current.mm - current.thresholdMm) / paceMm), paceMm };
}

function confidence(days: readonly SoilReserveDay[], index: number, today: string): SoilReserveSummary['confidence'] {
  const upTo = index >= 0 ? days.slice(0, index + 1) : days;
  const last = [...upTo].reverse().find((day) => day.restart !== null);
  if (!last || last.restart === null) return { since: null, kind: null, days: null, checkProposed: false };
  const elapsed = daysFromTo(last.date, today);
  return { since: last.date, kind: last.restart, days: elapsed, checkProposed: elapsed > CHECK_AFTER_DAYS };
}

/**
 * La dose au-delà de ce que le sol retient : un arrosage planifié ou proposé
 * qui apporte plus que ce qui peut encore entrer dans le sol à son début —
 * capacité moins état prévu sur une planche cultivée, `De + (RFU profonde −
 * réserve profonde)` sur une planche sans culture —, l'état du début de
 * l'arrosage suivant la pluie et la consommation du jour au prorata de
 * l'heure et les arrosages d'avant. Rien quand la jauge est inconnue.
 */
export function doseBeyondSoilMm(day: SoilReserveDay, interval: IrrigationInterval, intervals: readonly IrrigationInterval[]): number | null {
  if (day.startMm === null || day.capacityMm === null) return null;
  const bounds = dayBounds(day.date);
  const from = day.observation ? Date.parse(day.observation.observedAt) : bounds.from;
  const start = Date.parse(interval.startAt);
  if (!Number.isFinite(start) || start < from || start >= bounds.to) return null;
  const elapsed = (start - from) / Math.max(1, bounds.to - from);
  const before = irrigationBetween(intervals.filter((other) => other !== interval), from, start);
  const balance = ((day.rainMm ?? 0) - (day.consumptionMm ?? 0)) * elapsed + before;
  const room = day.geometry !== null && day.bareStart !== null
    ? bareSoilRoomMm(day.geometry, day.bareStart) - balance
    : day.capacityMm - Math.min(day.capacityMm, Math.max(0, day.startMm + balance));
  const beyond = interval.mm - Math.max(0, room);
  return beyond > 0 ? beyond : null;
}

export type GardenBed = {
  bedId: string;
  bedName: string;
  areaSquareMeters: number;
  mode: SoilReserveDay['mode'];
  surfaceState: SurfaceState | null;
  surfaceStateDeclared: boolean;
  stateMm: number | null;
  capacityMm: number | null;
};

export type GardenSoilSummary = {
  /** Σ(état × m²) / Σ(capacité × m²) des planches cultivées et des engrais verts, en % ; `null` : aucune n'est connue. */
  percent: number | null;
  lowest: { bedId: string; bedName: string; percent: number } | null;
  countedBeds: number;
  unknownBeds: number;
  /** Les planches sans culture, comptées à part avec leur état de surface. */
  withoutCrop: { bedId: string; bedName: string; surfaceState: SurfaceState; declared: boolean }[];
};

/** Le jardin : les mm ne s'additionnent pas entre surfaces, ils se pondèrent par la surface des planches. */
export function gardenSoilSummary(beds: readonly GardenBed[]): GardenSoilSummary {
  let water = 0;
  let capacity = 0;
  let countedBeds = 0;
  let unknownBeds = 0;
  let lowest: GardenSoilSummary['lowest'] = null;
  const withoutCrop: GardenSoilSummary['withoutCrop'] = [];
  for (const bed of beds) {
    const greenManure = bed.mode === 'cover' && bed.surfaceState !== 'grass';
    if (bed.mode !== 'crop' && !greenManure) {
      if (bed.surfaceState !== null) withoutCrop.push({ bedId: bed.bedId, bedName: bed.bedName, surfaceState: bed.surfaceState, declared: bed.surfaceStateDeclared });
      else unknownBeds += 1;
      continue;
    }
    if (bed.stateMm === null || bed.capacityMm === null || !(bed.capacityMm > 0)) {
      unknownBeds += 1;
      continue;
    }
    countedBeds += 1;
    water += bed.stateMm * bed.areaSquareMeters;
    capacity += bed.capacityMm * bed.areaSquareMeters;
    const percent = bed.stateMm / bed.capacityMm * PERCENT;
    if (lowest === null || percent < lowest.percent) lowest = { bedId: bed.bedId, bedName: bed.bedName, percent };
  }
  return {
    percent: capacity > 0 ? water / capacity * PERCENT : null,
    lowest,
    countedBeds,
    unknownBeds,
    withoutCrop: withoutCrop.sort((a, b) => a.bedName.localeCompare(b.bedName, 'fr')),
  };
}
