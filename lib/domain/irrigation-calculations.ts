import { LITERS_PER_CUBIC_METER, cubicMetersFromLiters } from './units.ts';
import type { Bed } from './domain.ts';
import type { EquipmentKind, SprinklerProfilePoint } from './irrigation-domain';

export type FlowRateDisplay = {
  value: number;
  unit: 'L/h' | 'm³/h';
};

/**
 * D'où vient la surface qui convertit les millimètres d'une planche en volume
 * (docs/wetted-surface-contract.md) : le matériel positionné, la planche seule
 * quand rien n'y est posé, ou inconnue quand une aspersion n'a pas de
 * passe-pied renseigné.
 */
export type WettedAreaSource = 'drip' | 'sprinkler' | 'bed-only' | 'unknown-alley';

export type BedWettedArea = {
  squareMeters: number | null;
  source: WettedAreaSource;
};

type WettedBed = Pick<Bed, 'area' | 'length' | 'alleyWidth'>;

/**
 * Surface mouillée d'une planche selon la nature du matériel (D-022) : la
 * planche seule en goutte-à-goutte, la planche et son passe-pied en aspersion,
 * parce que l'arroseur mouille aussi le passe-pied. Un passe-pied inconnu rend
 * la surface inconnue : jamais zéro, jamais la planche seule (D-003). La
 * surface de la planche (`Bed.area`) reste celle qui pondère les millimètres.
 */
export function wettedAreaSquareMeters(
  bed: WettedBed,
  kind: EquipmentKind,
): number | null {
  if (kind === 'drip') return bed.area;
  if (
    bed.alleyWidth === null ||
    !Number.isFinite(bed.alleyWidth) ||
    bed.alleyWidth < 0
  ) {
    return null;
  }
  const length = Number.isFinite(bed.length) && bed.length > 0 ? bed.length : 0;
  return bed.area + length * bed.alleyWidth;
}

/**
 * Surface qui convertit le besoin d'une planche en volume : celle du matériel
 * positionné, la plus grande — l'aspersion — quand les deux natures y sont,
 * la planche seule quand rien n'y est posé.
 */
/**
 * Ce que l'écran dit de la surface mouillée d'une irrigation enregistrée :
 * la nature du matériel qui l'a fixée, ou la raison pour laquelle elle manque.
 */
export function describeWettedArea(
  kind: EquipmentKind,
  squareMeters: number | null,
): string {
  if (squareMeters === null) return 'inconnue — passe-pied non renseigné dans Ouvre ta ferme';
  return kind === 'sprinkler' ? 'aspersion, planche et passe-pied' : 'goutte-à-goutte, planche seule';
}

export function resolveBedWettedArea(
  bed: WettedBed,
  positionedKinds: readonly EquipmentKind[],
): BedWettedArea {
  if (positionedKinds.length === 0) {
    return { squareMeters: bed.area, source: 'bed-only' };
  }
  if (!positionedKinds.includes('sprinkler')) {
    return { squareMeters: bed.area, source: 'drip' };
  }
  const sprinkler = wettedAreaSquareMeters(bed, 'sprinkler');
  return sprinkler === null
    ? { squareMeters: null, source: 'unknown-alley' }
    : { squareMeters: sprinkler, source: 'sprinkler' };
}

export function interpolateSprinklerRate(
  points: readonly SprinklerProfilePoint[],
  distanceMeters: number,
): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return 0;

  const sortedPoints = [...points]
    .filter(
      (point) =>
        Number.isFinite(point.distanceMeters) &&
        point.distanceMeters >= 0 &&
        Number.isFinite(point.rateMmPerHour) &&
        point.rateMmPerHour >= 0,
    )
    .sort((left, right) => left.distanceMeters - right.distanceMeters);

  if (sortedPoints.length === 0) return 0;
  if (distanceMeters > sortedPoints.at(-1)!.distanceMeters) return 0;

  const exactPoint = sortedPoints.find(
    (point) => point.distanceMeters === distanceMeters,
  );
  if (exactPoint) return exactPoint.rateMmPerHour;

  for (let index = 1; index < sortedPoints.length; index += 1) {
    const before = sortedPoints[index - 1];
    const after = sortedPoints[index];
    if (distanceMeters < before.distanceMeters || distanceMeters > after.distanceMeters) {
      continue;
    }

    const progress =
      (distanceMeters - before.distanceMeters) /
      (after.distanceMeters - before.distanceMeters);
    return (
      before.rateMmPerHour +
      progress * (after.rateMmPerHour - before.rateMmPerHour)
    );
  }

  return 0;
}

export function bedCenterMeters(
  startDistanceMeters: number,
  endDistanceMeters: number,
): number {
  if (
    !Number.isFinite(startDistanceMeters) ||
    !Number.isFinite(endDistanceMeters) ||
    startDistanceMeters < 0 ||
    endDistanceMeters < startDistanceMeters
  ) {
    return 0;
  }
  return (startDistanceMeters + endDistanceMeters) / 2;
}

export function sprinklerRateForBed(
  points: readonly SprinklerProfilePoint[],
  startDistanceMeters: number,
  endDistanceMeters: number,
): number {
  return interpolateSprinklerRate(
    points,
    bedCenterMeters(startDistanceMeters, endDistanceMeters),
  );
}

export function appliedMillimeters(
  rateMmPerHour: number,
  durationMinutes: number,
): number {
  if (
    !Number.isFinite(rateMmPerHour) ||
    rateMmPerHour < 0 ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 0
  ) {
    return 0;
  }
  return rateMmPerHour * (durationMinutes / 60);
}

export function litersPerHourForBed(
  rateMmPerHour: number,
  bedAreaSquareMeters: number,
): number {
  if (
    !Number.isFinite(rateMmPerHour) ||
    rateMmPerHour < 0 ||
    !Number.isFinite(bedAreaSquareMeters) ||
    bedAreaSquareMeters <= 0
  ) {
    return 0;
  }
  return rateMmPerHour * bedAreaSquareMeters;
}

export function totalLitersPerHour(
  beds: readonly { rateMmPerHour: number; areaSquareMeters: number }[],
): number {
  return beds.reduce(
    (total, bed) =>
      total + litersPerHourForBed(bed.rateMmPerHour, bed.areaSquareMeters),
    0,
  );
}

export function displayFlowRate(litersPerHour: number): FlowRateDisplay {
  const safeLiters =
    Number.isFinite(litersPerHour) && litersPerHour >= 0 ? litersPerHour : 0;
  if (safeLiters > LITERS_PER_CUBIC_METER) {
    return { value: cubicMetersFromLiters(safeLiters), unit: 'm³/h' };
  }
  return { value: safeLiters, unit: 'L/h' };
}
