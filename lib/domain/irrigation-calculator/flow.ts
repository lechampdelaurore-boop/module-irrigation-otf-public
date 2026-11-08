import type { CalculatorField, CalculatorInputs } from './inputs';

/**
 * Le débit d'un goutteur ou d'un asperseur selon la pression
 * (docs/irrigation-calculator-contract.md, section 7). Une mesure prime
 * toujours ; sinon `Q = Qref × (Pr ÷ Pref)^x` quand la pression réelle est
 * connue, et le débit de la fiche, à la pression de la fiche, quand elle ne
 * l'est pas. Une plage conseillée n'avertit que ; rien n'est refusé.
 */

type FlowSource =
  /** Débit mesuré par l'utilisateur, utilisé tel quel. */
  | 'measured'
  /** Débit de la fiche, à la pression de la fiche. */
  | 'datasheet'
  /** Débit de la fiche corrigé par la pression réelle. */
  | 'pressure';

export type ResolvedFlow = {
  litersPerHour: number;
  source: FlowSource;
};

export type FlowResolution =
  | { kind: 'resolved'; flow: ResolvedFlow; pressureOutOfRange: boolean }
  | { kind: 'missing'; missing: CalculatorField[] };

/** `Qref × (Pr ÷ Pref)^x`. */
export function pressureCorrectedFlow(
  referenceFlowLitersPerHour: number,
  referencePressureBar: number,
  actualPressureBar: number,
  exponent: number,
): number {
  return referenceFlowLitersPerHour * Math.pow(actualPressureBar / referencePressureBar, exponent);
}

/** La pression réelle est-elle hors de la plage conseillée (section 7, règle 4) ? Sans pression ou sans plage, non. */
function isPressureOutOfRange(inputs: CalculatorInputs): boolean {
  const pressure = inputs.actualPressureBar;
  if (pressure === null || !Number.isFinite(pressure)) return false;
  const { pressureRangeMinBar: min, pressureRangeMaxBar: max } = inputs;
  return (min !== null && Number.isFinite(min) && pressure < min) || (max !== null && Number.isFinite(max) && pressure > max);
}

/** Les entrées sont supposées valables (`inputErrors` vide) : un champ manquant est nommé, jamais compté zéro. */
export function resolveFlow(inputs: CalculatorInputs): FlowResolution {
  const pressureOutOfRange = isPressureOutOfRange(inputs);
  if (inputs.measuredFlowLitersPerHour !== null) {
    return { kind: 'resolved', flow: { litersPerHour: inputs.measuredFlowLitersPerHour, source: 'measured' }, pressureOutOfRange };
  }
  const reference = inputs.referenceFlowLitersPerHour;
  if (reference === null) return { kind: 'missing', missing: ['referenceFlowLitersPerHour'] };
  if (inputs.actualPressureBar === null) {
    return { kind: 'resolved', flow: { litersPerHour: reference, source: 'datasheet' }, pressureOutOfRange };
  }
  const missing: CalculatorField[] = [];
  if (inputs.referencePressureBar === null) missing.push('referencePressureBar');
  if (inputs.pressureExponent === null) missing.push('pressureExponent');
  if (missing.length > 0) return { kind: 'missing', missing };
  return {
    kind: 'resolved',
    flow: {
      litersPerHour: pressureCorrectedFlow(reference, inputs.referencePressureBar!, inputs.actualPressureBar, inputs.pressureExponent!),
      source: 'pressure',
    },
    pressureOutOfRange,
  };
}
