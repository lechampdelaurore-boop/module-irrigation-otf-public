import type { SprinklerProfilePoint, ValidEquipmentSettingInput } from '../irrigation-domain';
import { calculateIrrigationSetting, type CalculatedLevel } from './calculate';
import { CALCULATOR_FORMULA_VERSION, parseCalculatorInputs, type CalculatorInputs, type CalculatorMethod } from './inputs';

/**
 * D'où vient un réglage (docs/irrigation-calculator-contract.md, sections 4
 * et 10) : « calculé », « estimé », « mesuré » ou « saisi ». « Saisi » est
 * l'absence de provenance : tout réglage d'avant ce lot, et tout réglage
 * retouché à la main après un calcul (D-003, on ne devine pas). « Mesuré » ne
 * vient que du geste de l'utilisateur, jamais du logiciel.
 */

type ProvenanceLevel = CalculatedLevel | 'measured';
export type SettingLabel = ProvenanceLevel | 'entered';

export type SettingProvenance =
  | {
      level: CalculatedLevel;
      method: CalculatorMethod;
      inputs: CalculatorInputs;
      theoreticalRateMmPerHour: number | null;
      zoneSharePercent: number | null;
      nominalFlowLitersPerHour: number | null;
    }
  | {
      level: 'measured';
      method: null;
      inputs: null;
      theoreticalRateMmPerHour: null;
      zoneSharePercent: null;
      nominalFlowLitersPerHour: null;
    };

export const MEASURED_PROVENANCE: SettingProvenance = {
  level: 'measured',
  method: null,
  inputs: null,
  theoreticalRateMmPerHour: null,
  zoneSharePercent: null,
  nominalFlowLitersPerHour: null,
};

export const SETTING_LABELS: Readonly<Record<SettingLabel, string>> = {
  calculated: 'calculé',
  estimated: 'estimé',
  measured: 'mesuré',
  entered: 'saisi',
};

export function settingLabelOf(provenance: SettingProvenance | null): SettingLabel {
  return provenance?.level ?? 'entered';
}

/** Les valeurs d'un réglage telles que le moteur les lit. */
export type SettingValues =
  | { kind: 'drip'; rateMmPerHour: number }
  | { kind: 'sprinkler'; leftProfile: readonly SprinklerProfilePoint[]; rightProfile: readonly SprinklerProfilePoint[] };

export function settingValuesOf(setting: ValidEquipmentSettingInput): SettingValues {
  return setting.kind === 'drip'
    ? { kind: 'drip', rateMmPerHour: setting.rateMmPerHour }
    : { kind: 'sprinkler', leftProfile: setting.leftProfile, rightProfile: setting.rightProfile };
}

function sortedProfile(points: readonly SprinklerProfilePoint[]) {
  return [...points].sort((left, right) => left.distanceMeters - right.distanceMeters);
}

function profilesEqual(left: readonly SprinklerProfilePoint[], right: readonly SprinklerProfilePoint[]) {
  const a = sortedProfile(left);
  const b = sortedProfile(right);
  return a.length === b.length && a.every((point, index) =>
    point.distanceMeters === b[index]!.distanceMeters && point.rateMmPerHour === b[index]!.rateMmPerHour);
}

export function settingValuesEqual(left: SettingValues, right: SettingValues): boolean {
  if (left.kind === 'drip' || right.kind === 'drip') {
    return left.kind === 'drip' && right.kind === 'drip' && left.rateMmPerHour === right.rateMmPerHour;
  }
  return profilesEqual(left.leftProfile, right.leftProfile) && profilesEqual(left.rightProfile, right.rightProfile);
}

/** Ce que « Utiliser ce résultat » met dans le formulaire, ou `null` tant que le résultat n'est pas connu. */
export function calculatorSettingValues(inputs: CalculatorInputs): SettingValues | null {
  const result = calculateIrrigationSetting(inputs);
  if (result.errors.length > 0 || result.missing.length > 0) return null;
  if (result.profile) return { kind: 'sprinkler', leftProfile: result.profile, rightProfile: result.profile };
  if (result.receivedRateMmPerHour === null) return null;
  return { kind: 'drip', rateMmPerHour: result.receivedRateMmPerHour };
}

/** La provenance d'un calcul complet, recalculée ici : le navigateur n'en dit que les entrées. */
export function provenanceFromCalculation(inputs: CalculatorInputs): SettingProvenance | null {
  const result = calculateIrrigationSetting(inputs);
  if (calculatorSettingValues(inputs) === null) return null;
  return {
    level: result.level,
    method: inputs.method,
    inputs,
    theoreticalRateMmPerHour: result.theoreticalRateMmPerHour,
    zoneSharePercent: result.zoneSharePercent,
    nominalFlowLitersPerHour: result.nominalFlowLitersPerHour,
  };
}

/** Ce que le formulaire de réglage dit de la provenance, à l'enregistrement. */
export type SubmittedProvenance = {
  /** Les entrées du calculateur dont l'utilisateur a utilisé le résultat, ou `null`. */
  calculation: unknown;
  /**
   * La case « Ces valeurs viennent de mes mesures au pluviomètre » (section 4,
   * règle 2) ; `null` quand le formulaire ne la montre pas (calculateur
   * décoché) : sa provenance ne change alors que si les valeurs changent.
   */
  measured: boolean | null;
};

export type ProvenanceDecision =
  | { kind: 'write'; provenance: SettingProvenance }
  | { kind: 'delete' }
  | { kind: 'keep' };

/**
 * La règle de la section 10, à l'enregistrement d'un réglage :
 * - la case « mesuré » cochée l'emporte : c'est le geste de l'utilisateur ;
 *   décochée, elle efface un « mesuré » ;
 * - un calcul dont le résultat est exactement la valeur enregistrée s'écrit
 *   avec son étiquette ; recalculé ici, il ne dépend pas du navigateur ;
 * - sinon, des valeurs retouchées à la main effacent la provenance (« saisi »),
 *   et des valeurs inchangées gardent la provenance déjà enregistrée (un nom
 *   changé ne rend pas le calcul faux).
 */
export function decideProvenance(input: {
  submitted: SubmittedProvenance;
  values: SettingValues;
  previous: { provenance: SettingProvenance | null; values: SettingValues } | null;
}): ProvenanceDecision {
  if (input.submitted.measured === true) return { kind: 'write', provenance: MEASURED_PROVENANCE };
  const inputs = parseCalculatorInputs(input.submitted.calculation);
  if (inputs) {
    const computed = calculatorSettingValues(inputs);
    const provenance = provenanceFromCalculation(inputs);
    if (computed && provenance && settingValuesEqual(computed, input.values)) return { kind: 'write', provenance };
  }
  const previous = input.previous;
  if (!previous?.provenance) return { kind: 'keep' };
  if (previous.provenance.level === 'measured' && input.submitted.measured === false) return { kind: 'delete' };
  return settingValuesEqual(previous.values, input.values) ? { kind: 'keep' } : { kind: 'delete' };
}

/** `inputs_json` : les entrées et la version des formules, pour rouvrir le calculateur prérempli. */
export function serializeCalculatorInputs(inputs: CalculatorInputs): string {
  return JSON.stringify({ formulaVersion: CALCULATOR_FORMULA_VERSION, ...inputs });
}

export function deserializeCalculatorInputs(json: string | null): CalculatorInputs | null {
  if (json === null) return null;
  try {
    return parseCalculatorInputs(JSON.parse(json));
  } catch {
    return null;
  }
}
