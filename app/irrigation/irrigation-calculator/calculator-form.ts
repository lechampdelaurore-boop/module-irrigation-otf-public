import {
  CALCULATOR_FIELDS,
  emptyCalculatorInputs,
  type CalculatorField,
  type CalculatorInputs,
  type CalculatorMethod,
} from '@/lib/domain/irrigation-calculator/inputs';
import { cubicMetersPerHourFromLitersPerHour, litersPerHourFromCubicMetersPerHour } from '@/lib/domain/units';

/**
 * Le formulaire du calculateur (3.8 bis) : ce que l'utilisateur tape, champ
 * par champ, en texte (la virgule française est acceptée), et sa lecture en
 * entrées du domaine. Vide : `null` ; illisible : `NaN`, que le domaine
 * refuse avec son message. Les règles et les formules restent au domaine.
 */

export type FlowUnit = 'l/h' | 'm³/h';

export type CalculatorFormState = {
  method: CalculatorMethod;
  fields: Record<CalculatorField, string>;
  /** L'unité des deux débits d'un asperseur (section 6 : l/h ou m³/h). */
  flowUnit: FlowUnit;
  exampleId: string | null;
};

const FLOW_FIELDS: readonly CalculatorField[] = ['measuredFlowLitersPerHour', 'referenceFlowLitersPerHour'];

export function formatFieldValue(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '' : String(value).replace('.', ',');
}

export function formStateFromInputs(inputs: CalculatorInputs, exampleId: string | null = null): CalculatorFormState {
  const fields = Object.fromEntries(CALCULATOR_FIELDS.map((field) => [field, formatFieldValue(inputs[field])])) as Record<CalculatorField, string>;
  return { method: inputs.method, fields, flowUnit: 'l/h', exampleId };
}

export function emptyFormState(method: CalculatorMethod): CalculatorFormState {
  return formStateFromInputs(emptyCalculatorInputs(method));
}

function parseField(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export function inputsFromFormState(state: CalculatorFormState): CalculatorInputs {
  const inputs = emptyCalculatorInputs(state.method);
  for (const field of CALCULATOR_FIELDS) {
    const value = parseField(state.fields[field]);
    inputs[field] = value !== null && state.flowUnit === 'm³/h' && FLOW_FIELDS.includes(field)
      ? litersPerHourFromCubicMetersPerHour(value)
      : value;
  }
  return inputs;
}

/**
 * Changer de manière garde ce qui est saisi ; seule l'efficacité proposée
 * suit la manière (100 % en goutte-à-goutte, 80 % en moyenne, rien en cône)
 * quand l'utilisateur ne l'avait pas changée.
 */
export function switchMethod(state: CalculatorFormState, method: CalculatorMethod): CalculatorFormState {
  const previousDefault = formatFieldValue(emptyCalculatorInputs(state.method).efficiencyPercent);
  const nextDefault = formatFieldValue(emptyCalculatorInputs(method).efficiencyPercent);
  const efficiency = state.fields.efficiencyPercent === previousDefault ? nextDefault : state.fields.efficiencyPercent;
  return { ...state, method, fields: { ...state.fields, efficiencyPercent: efficiency } };
}

/** Changer l'unité des débits convertit ce qui est saisi : le même débit, autrement écrit. */
export function switchFlowUnit(state: CalculatorFormState, flowUnit: FlowUnit): CalculatorFormState {
  if (flowUnit === state.flowUnit) return state;
  const inputs = inputsFromFormState(state);
  const fields = { ...state.fields };
  for (const field of FLOW_FIELDS) {
    const liters = inputs[field];
    fields[field] = liters === null || !Number.isFinite(liters)
      ? state.fields[field]
      : formatFieldValue(flowUnit === 'l/h' ? liters : cubicMetersPerHourFromLitersPerHour(liters));
  }
  return { ...state, fields, flowUnit };
}
