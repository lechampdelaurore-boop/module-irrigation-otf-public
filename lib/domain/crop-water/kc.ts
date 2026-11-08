import type { ReferenceCrop, TrapezoidCurve } from './reference.ts';
import { phaseStarts, type StagePosition } from './stage.ts';

/**
 * Le Kc d'un jour (docs/crop-water-need-contract.md, « Le calcul du jour ») :
 * celui du stade, de la source retenue pour la culture ; en escalier, une
 * valeur fixe par stade ; en trapèze, la droite de la FAO entre ses trois
 * points, abattue par son coefficient. Une surcharge de la ferme remplace la
 * valeur de la source à partir de son jour, sans réécrire les jours d'avant
 * (D-006) ; la valeur d'origine reste lisible.
 */

export type KcOverride = {
  referenceCropId: string;
  /** Le stade surchargé, par son rang ; pour la FAO, l'un de ses trois Kc. */
  target: { rank: number } | { fao: 'initial' | 'mid' | 'end' };
  /** La valeur de la ferme ; `null` : retour à la valeur de la source. */
  kc: number | null;
  /** Premier jour où la surcharge compte, `AAAA-MM-JJ`. */
  effectiveFrom: string;
  recordedAt: string;
};

export type DayKc = {
  /** Le Kc retenu ce jour-là : surcharge, abattement et lissage compris. */
  kc: number;
  /** La valeur de la source, avant surcharge, abattement et lissage. */
  referenceKc: number;
  /** Une surcharge de la ferme a remplacé une valeur de la source. */
  overridden: boolean;
  /** Le coefficient d'abattement des Kc de la FAO ; 1 pour les autres sources. */
  abatement: number;
  /** Le passage de stade est lissé ce jour-là (option). */
  smoothed: boolean;
};

/** Le lissage d'un passage de stade se fait sur cinq jours (option désactivée par défaut). */
export const KC_SMOOTHING_DAYS = 5;

type KcPoint = { value: number; reference: number; overridden: boolean };

/** Le Kc du stade du jour, sans lissage ; `null` quand le rang n'existe pas dans la table. */
export function stageKc(
  crop: ReferenceCrop,
  position: StagePosition,
  overrides: readonly KcOverride[],
  date: string,
): Omit<DayKc, 'smoothed'> | null {
  const curve = crop.curve;
  if (position.shape === 'trapezoid' && curve.shape === 'trapezoid') return trapezoidKc(crop.id, curve, position, overrides, date);
  if (curve.shape === 'trapezoid') return null;
  const stages = curve.shape === 'calendar' && curve.establishment ? [curve.establishment, ...curve.stages] : curve.stages;
  const stage = stages.find((candidate) => candidate.rank === position.rank);
  if (!stage) return null;
  const override = overrideValue(overrides, crop.id, (target) => 'rank' in target && target.rank === stage.rank, date);
  return { kc: override ?? stage.kc, referenceKc: stage.kc, overridden: override !== null, abatement: 1 };
}

/**
 * Le lissage, en ligne droite, du Kc d'avant vers celui du nouveau stade : le
 * jour du changement compte pour le premier des cinq jours, le cinquième
 * atteint le nouveau Kc. Jamais vers un Kc de 0, qui est un arrêt
 * d'irrigation avant récolte.
 */
export function smoothKc(current: number, previous: number, daysSinceChange: number): number {
  if (current === 0 || daysSinceChange < 0 || daysSinceChange >= KC_SMOOTHING_DAYS) return current;
  return previous + (current - previous) * (daysSinceChange + 1) / KC_SMOOTHING_DAYS;
}

/**
 * Le trapèze : Kc début pendant la phase de début, montée en ligne droite
 * pendant le développement, Kc pleine saison, descente vers Kc fin pendant la
 * dernière phase, puis Kc fin jusqu'à la récolte. Le coefficient d'abattement
 * s'applique aux valeurs de la FAO, pas aux surcharges de la ferme.
 */
function trapezoidKc(
  cropId: string,
  curve: TrapezoidCurve,
  position: Extract<StagePosition, { shape: 'trapezoid' }>,
  overrides: readonly KcOverride[],
  date: string,
): Omit<DayKc, 'smoothed'> {
  const point = (name: 'initial' | 'mid' | 'end', reference: number): KcPoint => {
    const override = overrideValue(overrides, cropId, (target) => 'fao' in target && target.fao === name, date);
    return { value: override ?? reference * curve.abatement, reference, overridden: override !== null };
  };
  const initial = point('initial', curve.kcInitial);
  const mid = point('mid', curve.kcMid);
  const end = point('end', curve.kcEnd);
  const [, development, midStart, late] = phaseStarts(position.lengths);
  const lateEnd = late + position.lengths.late;
  const days = position.daysSinceOrigin;
  const between = (from: KcPoint, to: KcPoint, fraction: number) => ({
    kc: from.value + (to.value - from.value) * fraction,
    referenceKc: from.reference + (to.reference - from.reference) * fraction,
    overridden: from.overridden || to.overridden,
    abatement: curve.abatement,
  });
  if (days < development) return between(initial, initial, 0);
  if (days < midStart) return between(initial, mid, (days - development) / position.lengths.development);
  if (days < late) return between(mid, mid, 0);
  if (days < lateEnd) return between(mid, end, (days - late) / position.lengths.late);
  return between(end, end, 0);
}

/** La surcharge en vigueur ce jour-là : la plus récente par son jour, puis par son enregistrement. */
function overrideValue(
  overrides: readonly KcOverride[],
  cropId: string,
  matches: (target: KcOverride['target']) => boolean,
  date: string,
): number | null {
  let chosen: KcOverride | null = null;
  for (const override of overrides) {
    if (override.referenceCropId !== cropId || !matches(override.target) || override.effectiveFrom > date) continue;
    if (chosen === null || override.effectiveFrom > chosen.effectiveFrom
      || (override.effectiveFrom === chosen.effectiveFrom && override.recordedAt >= chosen.recordedAt)) chosen = override;
  }
  return chosen?.kc ?? null;
}
