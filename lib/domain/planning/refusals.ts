import type { RefusedSlot } from './contract.ts';
import type { WindowInterval } from './windows.ts';

/**
 * Les créneaux refusés (docs/planning-contract.md, « Les statuts » et « Les
 * refus », D-030 ; docs/replanning-contract.md, règles 1 à 3) : quand le
 * maraîcher refuse une proposition, c'est ce matériel à ces heures que le
 * moteur ne propose plus de la semaine, même en partie, quelle que soit la
 * dose. Le placement les évite comme il respecte une plage horaire (R8) : la
 * plage est découpée autour d'eux et le besoin se place dans ce qui reste, à
 * une autre heure ou un autre jour, ou se lit « non placé ».
 */

/** Un créneau refusé en instants. */
export type RefusedInterval = { startMs: number; endMs: number };

/**
 * Les créneaux refusés lisibles, par matériel, dans l'ordre du temps. Un
 * créneau sans date lisible ou qui finit avant de commencer est ignoré : il
 * n'exclut rien et ne bloque pas le calcul.
 */
export function refusedIntervalsByEquipment(slots: readonly RefusedSlot[] | undefined): ReadonlyMap<string, readonly RefusedInterval[]> {
  const byEquipment = new Map<string, RefusedInterval[]>();
  for (const slot of slots ?? []) {
    const startMs = Date.parse(slot.startAt);
    const endMs = Date.parse(slot.endAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    const intervals = byEquipment.get(slot.equipmentId) ?? [];
    intervals.push({ startMs, endMs });
    byEquipment.set(slot.equipmentId, intervals);
  }
  for (const intervals of byEquipment.values()) intervals.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  return byEquipment;
}

/**
 * Un morceau de plage où un créneau peut se placer, une fois les refus
 * retirés : il garde le jour de planning de sa plage, ce que les créneaux
 * protégés lui ont déjà fait (`protected-slots.ts`, D-062) et dit ce qu'un
 * refus lui a fait, pour que la justification le nomme.
 */
export type PlacementInterval<T extends WindowInterval = WindowInterval> = T & {
  /** Le morceau commence là où un créneau refusé finit. */
  startsAfterRefusal: boolean;
  /** Le morceau finit là où un créneau refusé commence. */
  endsBeforeRefusal: boolean;
  /** La fin du morceau de plage dont il vient, avant les refus : dit si, sans le refus, la place aurait suffi. */
  windowEndAt: Date;
};

/**
 * Les plages moins les créneaux refusés : chaque plage est découpée autour de
 * chaque refus qui la recouvre, même en partie ; les morceaux vides sont
 * écartés et l'ordre du temps est gardé. Un refus qui touche une plage sans
 * la recouvrir — il finit quand elle commence, ou commence quand elle finit —
 * ne l'entame pas. Les plages peuvent être déjà découpées autour des créneaux
 * protégés : chaque morceau garde ce qu'il portait.
 */
export function withoutRefusedIntervals<T extends WindowInterval>(intervals: readonly T[], refused: readonly RefusedInterval[]): PlacementInterval<T>[] {
  const result: PlacementInterval<T>[] = [];
  for (const interval of intervals) {
    let pieces: PlacementInterval<T>[] = [{ ...interval, startsAfterRefusal: false, endsBeforeRefusal: false, windowEndAt: interval.endAt }];
    for (const slot of refused) {
      const next: PlacementInterval<T>[] = [];
      for (const piece of pieces) {
        const startMs = piece.startAt.getTime();
        const endMs = piece.endAt.getTime();
        if (slot.endMs <= startMs || slot.startMs >= endMs) {
          next.push(piece);
          continue;
        }
        if (slot.startMs > startMs) next.push({ ...piece, endAt: new Date(slot.startMs), endsBeforeRefusal: true });
        if (slot.endMs < endMs) next.push({ ...piece, startAt: new Date(slot.endMs), startsAfterRefusal: true });
      }
      pieces = next;
    }
    result.push(...pieces);
  }
  return result;
}
