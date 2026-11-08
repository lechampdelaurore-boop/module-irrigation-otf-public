import type { IrrigationNeedPriority } from '../irrigation-needs.ts';
import { cubicMetersFromMillimeters, millimetersFromCubicMeters } from '../units.ts';
import type { UnplacedReason } from './contract.ts';
import { compareBedsForService } from './demand.ts';
import type { PlanningSettings } from './settings.ts';
import type { BedState } from './shortage.ts';

/**
 * La part réservée (docs/planning-contract.md, « Pénurie », « La part
 * réservée », D-037, point ouvert 36) : un registre par chaîne d'eau au budget
 * fini. Chaque planche y a sa part en m³ — sa cible au prix de la surface que
 * son propre matériel mouille — ; l'eau non attribuée est le budget moins les
 * parts. Un créneau est borné à ce que ses parts paient, imputé aux parts des
 * planches qu'il arrose utilement, son débordement à l'eau non attribuée puis
 * aux parts de ses propres planches. Ce qu'une planche ne peut pas recevoir
 * est libéré en fin de tour et redistribué par la conduite.
 */

const EPSILON = 1e-9;
/** Un centième de millimètre est un résidu d'arrondi des secondes : ni une part à libérer, ni une cible relevée. */
const NEGLIGIBLE_MM = 0.01;

type ShareEntry = {
  bed: BedState;
  /** La surface que le propre matériel de la planche mouille, en m² : le prix de ses millimètres. */
  wettedAreaSquareMeters: number;
  /** Ce qui reste de sa part, en m³. */
  remainingCubicMeters: number;
};

/** Un créneau tel que le registre le juge : ce que chaque planche arrosée reçoit, et son volume au prix du matériel. */
export type SharePlacement = {
  applications: readonly { otfBedId: string; appliedMm: number }[];
  volumeCubicMeters: number | null;
};

export class ShareLedger {
  /** Le motif de la coupe de la chaîne : « stock et ressources » ou « limite journalière » (point ouvert 35). */
  readonly shortfallReason: UnplacedReason;
  private readonly entries = new Map<string, ShareEntry>();
  private unreservedCubicMeters: number;
  private readonly strategy: PlanningSettings['shortageStrategy'];
  private readonly deferredFirst: ReadonlySet<string>;

  constructor(input: {
    beds: readonly BedState[];
    wettedAreaOf: (bed: BedState) => number | null;
    budgetCubicMeters: number;
    shortfallReason: UnplacedReason;
    strategy: PlanningSettings['shortageStrategy'];
    deferredFirst: ReadonlySet<string>;
  }) {
    this.shortfallReason = input.shortfallReason;
    this.strategy = input.strategy;
    this.deferredFirst = input.deferredFirst;
    let reserved = 0;
    for (const bed of input.beds) {
      const wetted = input.wettedAreaOf(bed);
      if (wetted === null || wetted <= 0) continue;
      const remainingCubicMeters = cubicMetersFromMillimeters(bed.targetMm, wetted);
      reserved += remainingCubicMeters;
      this.entries.set(bed.bedId, { bed, wettedAreaSquareMeters: wetted, remainingCubicMeters });
    }
    this.unreservedCubicMeters = Math.max(0, input.budgetCubicMeters - reserved);
  }

  /**
   * La plus longue durée, en secondes entières, que les parts paient : le
   * volume du créneau ne dépasse pas les parts restantes des planches qu'il
   * sert, plus l'eau non attribuée, plus ce que les autres planches arrosées
   * paient de leur part pour l'eau utile reçue. Le reste à payer grandit avec
   * la durée : une bissection suffit.
   */
  longestDurationWithinShares(placementAt: (seconds: number) => SharePlacement, durationSeconds: number, servedBedIds: ReadonlySet<string>): number {
    if (this.accepts(placementAt(durationSeconds), servedBedIds)) return durationSeconds;
    let low = 0;
    let high = durationSeconds;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (this.accepts(placementAt(middle), servedBedIds)) low = middle;
      else high = middle;
    }
    return low;
  }

  private accepts(placement: SharePlacement, servedBedIds: ReadonlySet<string>): boolean {
    if (placement.volumeCubicMeters === null) return true;
    let paid = 0;
    for (const application of placement.applications) {
      const entry = this.entries.get(application.otfBedId);
      if (!entry) continue;
      paid += servedBedIds.has(application.otfBedId) ? Math.max(0, entry.remainingCubicMeters) : this.priceOfUsefulWater(entry, application.appliedMm);
    }
    return placement.volumeCubicMeters <= paid + this.unreservedCubicMeters + EPSILON;
  }

  /** Ce qu'une planche paie de sa part pour l'eau qu'elle reçoit utilement, au prix de son propre matériel. */
  private priceOfUsefulWater(entry: ShareEntry, appliedMm: number): number {
    const usefulMm = Math.max(0, Math.min(appliedMm, entry.bed.remainingMm));
    return Math.min(cubicMetersFromMillimeters(usefulMm, entry.wettedAreaSquareMeters), entry.remainingCubicMeters);
  }

  /**
   * L'imputation d'un créneau placé, avant qu'il n'entame les besoins :
   * chaque planche arrosée paie l'eau utile reçue au prix de son matériel,
   * jusqu'à sa part ; le reste est pris sur l'eau non attribuée, puis réparti
   * entre les planches servies au prorata de l'eau reçue, chacune jusqu'à sa
   * part.
   */
  charge(placement: SharePlacement, servedBedIds: ReadonlySet<string>): void {
    if (placement.volumeCubicMeters === null) return;
    let rest = placement.volumeCubicMeters;
    const served: { entry: ShareEntry; appliedMm: number }[] = [];
    for (const application of placement.applications) {
      const entry = this.entries.get(application.otfBedId);
      if (!entry) continue;
      const paid = this.priceOfUsefulWater(entry, application.appliedMm);
      entry.remainingCubicMeters -= paid;
      rest -= paid;
      if (servedBedIds.has(application.otfBedId) && application.appliedMm > 0) served.push({ entry, appliedMm: application.appliedMm });
    }
    const fromUnreserved = Math.min(Math.max(0, rest), this.unreservedCubicMeters);
    this.unreservedCubicMeters -= fromUnreserved;
    rest -= fromUnreserved;
    for (let guard = 0; guard < served.length && rest > EPSILON; guard += 1) {
      const open = served.filter(({ entry }) => entry.remainingCubicMeters > EPSILON);
      const weight = open.reduce((sum, { appliedMm }) => sum + appliedMm, 0);
      if (open.length === 0 || weight <= 0) break;
      const toSplit = rest;
      for (const { entry, appliedMm } of open) {
        const taken = Math.min(entry.remainingCubicMeters, toSplit * appliedMm / weight);
        entry.remainingCubicMeters -= taken;
        rest -= taken;
      }
    }
  }

  /**
   * La fin d'un tour : ce que les planches n'ont pas reçu est libéré et
   * redistribué par la conduite aux planches encore sous leur besoin que leur
   * matériel peut encore servir ; leur cible et leur part montent, le motif
   * de la coupe tombe quand la cible rejoint le besoin. Vrai quand une cible
   * a monté au-delà de ce qu'elle était.
   */
  redistribute(canStillServe: (bed: BedState) => boolean): boolean {
    const entries = [...this.entries.values()];
    // Un reste sous un centième de millimètre de sa surface est un résidu d'arrondi des secondes, pas une part à libérer.
    const releasing = entries.filter((entry) => entry.remainingCubicMeters > cubicMetersFromMillimeters(NEGLIGIBLE_MM, entry.wettedAreaSquareMeters));
    const pool = releasing.reduce((sum, entry) => sum + entry.remainingCubicMeters, 0);
    const eligible = entries.filter(({ bed }) => bed.unplannable === null && bed.needMm - bed.targetMm > EPSILON && canStillServe(bed));
    const gifts = this.allocate(pool, eligible);
    const given = [...gifts.values()].reduce((sum, gift) => sum + gift, 0);
    if (given <= EPSILON) return false;
    const targetsBefore = new Map(eligible.map((entry) => [entry, entry.bed.targetMm]));
    for (const entry of releasing) {
      const taken = entry.remainingCubicMeters * given / pool;
      const takenMm = millimetersFromCubicMeters(taken, entry.wettedAreaSquareMeters);
      entry.remainingCubicMeters -= taken;
      entry.bed.targetMm = Math.max(entry.bed.placedMm, entry.bed.targetMm - takenMm);
      entry.bed.remainingMm = Math.max(0, entry.bed.remainingMm - takenMm);
    }
    let raised = false;
    for (const [entry, gift] of gifts) {
      const giftMm = millimetersFromCubicMeters(gift, entry.wettedAreaSquareMeters);
      entry.remainingCubicMeters += gift;
      entry.bed.targetMm = Math.min(entry.bed.needMm, entry.bed.targetMm + giftMm);
      entry.bed.remainingMm += giftMm;
      if (entry.bed.targetMm >= entry.bed.needMm - EPSILON) {
        entry.bed.reasons.delete(this.shortfallReason);
        entry.bed.reasons.delete('deferred');
      }
      if (entry.bed.targetMm > (targetsBefore.get(entry) ?? entry.bed.targetMm) + NEGLIGIBLE_MM) raised = true;
    }
    return raised;
  }

  /** La conduite en pénurie (R9) appliquée à l'eau libérée : niveau par niveau, part égale, ou dans l'ordre du report. */
  private allocate(pool: number, eligible: readonly ShareEntry[]): Map<ShareEntry, number> {
    const gifts = new Map<ShareEntry, number>();
    const deficitOf = (entry: ShareEntry) => cubicMetersFromMillimeters(entry.bed.needMm - entry.bed.targetMm, entry.wettedAreaSquareMeters);
    let remaining = pool;
    if (this.strategy === 'defer') {
      const ordered = [...eligible].sort((left, right) =>
        Number(this.deferredFirst.has(right.bed.bedId)) - Number(this.deferredFirst.has(left.bed.bedId)) || compareBedsForService(left.bed, right.bed));
      for (const entry of ordered) {
        const deficit = deficitOf(entry);
        if (deficit <= remaining + EPSILON) {
          gifts.set(entry, deficit);
          remaining -= deficit;
        }
      }
      return gifts;
    }
    const levels: IrrigationNeedPriority[][] = this.strategy === 'equal-share' ? [['high', 'normal', 'low']] : [['high'], ['normal'], ['low']];
    for (const level of levels) {
      const atLevel = eligible.filter((entry) => level.includes(entry.bed.priority));
      const demand = atLevel.reduce((sum, entry) => sum + deficitOf(entry), 0);
      if (demand <= EPSILON) continue;
      const fraction = Math.min(1, Math.max(0, remaining) / demand);
      for (const entry of atLevel) gifts.set(entry, deficitOf(entry) * fraction);
      remaining -= demand;
    }
    return gifts;
  }
}

/** La fin d'un tour de placement pour toutes les chaînes : vrai si une cible a monté quelque part. */
export function redistributeShares(ledgers: Iterable<ShareLedger>, canStillServe: (bed: BedState) => boolean): boolean {
  let raised = false;
  for (const ledger of ledgers) {
    if (ledger.redistribute(canStillServe)) raised = true;
  }
  return raised;
}
