import type { SprinklerProfilePoint } from '../irrigation-domain';
import { cubicMetersPerHourFromLitersPerHour } from '../units';
import { resolveFlow, type ResolvedFlow } from './flow';
import {
  coneRateAtDistance,
  coneSharePercent,
  dripPerBedFlowPerMeter,
  dripPerBedTheoreticalRate,
  dripPerValveTheoreticalRate,
  dripValveFlow,
  receivedRate,
  sprinklerMeanTheoreticalRate,
} from './formulas';
import {
  DRIP_DEFAULT_EFFICIENCY_PERCENT,
  FIELD_LABELS,
  inputErrors,
  type CalculatorField,
  type CalculatorInputs,
  type CalculatorMethod,
  type FieldError,
} from './inputs';

/**
 * Le calculateur d'irrigation (docs/irrigation-calculator-contract.md) : des
 * entrées au réglage qu'on enregistre, avec son étiquette (section 4), le
 * débit nominal (section 8), les avertissements (section 11) et le calcul
 * écrit avec les nombres de l'utilisateur. Le moteur ne change pas : le
 * calculateur ne fait que produire un mm/h ou un profil, que l'utilisateur
 * relit et enregistre par l'écran de réglage.
 */

export type CalculatedLevel = 'calculated' | 'estimated';

export type CalculatorWarning =
  /** Moyenne : la bande est plus étroite que le jet, l'eau tombe surtout à côté (section 6.1). */
  | 'jet-wider-than-band'
  /** Cône : asperseurs plus espacés que leur portée (section 6.2). */
  | 'spacing-beyond-reach'
  /** Pression réelle hors de la plage conseillée (section 7, règle 4). */
  | 'pressure-out-of-range'
  /** Plus de 100 mm/h : vraisemblablement une faute d'unité (section 11). */
  | 'rate-above-plausible';

/** Au-delà, un mm/h reçu est sans doute une faute d'unité (section 11) : on avertit, on ne refuse pas. */
export const PLAUSIBLE_RATE_LIMIT_MM_PER_HOUR = 100;
/** Le profil en cône : 11 points également espacés de 0 à la portée (section 6.2). */
const CONE_PROFILE_POINTS = 11;

/** À qui se rapporte le débit nominal affiché. */
export type NominalScope = 'per-meter-of-bed' | 'valve' | 'ramp' | 'per-sprinkler';

export type CalculatorResult = {
  method: CalculatorMethod;
  level: CalculatedLevel;
  /** Les champs qui manquent pour le résultat principal ; vide quand il est connu. */
  missing: CalculatorField[];
  errors: FieldError[];
  flow: ResolvedFlow | null;
  /** Ce que le matériel distribuerait, sans perte, sur la surface attribuée ; `null` en cône. */
  theoreticalRateMmPerHour: number | null;
  /** Le mm/h reçu, arrondi au centième : la valeur enregistrée en goutte-à-goutte, le palier en moyenne, la pointe sous la rampe en cône. */
  receivedRateMmPerHour: number | null;
  /** `η` quand elle s'applique ; `null` en cône (la forme contient déjà la perte). */
  zoneSharePercent: number | null;
  /** Le profil enregistré en aspersion, identique des deux côtés ; `null` en goutte-à-goutte. */
  profile: SprinklerProfilePoint[] | null;
  /** Cône : part d'eau sur la planche et son passe-pied, à titre d'information. */
  bedSharePercent: number | null;
  /** Par vanne : son débit, même sans écartement entre lignes. */
  valveFlowLitersPerHour: number | null;
  /** L'eau pompée, à côté du résultat, sans entrer dans le moteur (section 8). */
  nominalFlowLitersPerHour: number | null;
  nominalScope: NominalScope | null;
  warnings: CalculatorWarning[];
  /** « Voir le calcul » : chaque formule avec les nombres de l'utilisateur. */
  steps: string[];
};

const HUNDREDTHS = 100;
/** Les mm/h et les distances du profil s'arrondissent au centième (section 6.2). */
function roundToHundredth(value: number): number {
  return Math.round(value * HUNDREDTHS) / HUNDREDTHS;
}

export function formatCalculatorNumber(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits });
}

const n = formatCalculatorNumber;

const FIELDS_BY_METHOD: Readonly<Record<CalculatorMethod, readonly CalculatorField[]>> = {
  drip_per_bed: ['lineCount', 'spacingMeters', 'bedWidthMeters', 'efficiencyPercent'],
  drip_per_valve: ['lineCount', 'lineLengthMeters', 'spacingMeters'],
  sprinkler_mean: ['spacingMeters', 'wettedWidthMeters', 'efficiencyPercent'],
  sprinkler_cone: ['spacingMeters', 'reachMeters'],
};

/** L'étiquette d'un calcul : jamais plus fine que sa source (section 4, règle 1). */
function levelOf(method: CalculatorMethod, efficiencyPercent: number | null): CalculatedLevel {
  if (method === 'sprinkler_mean' || method === 'sprinkler_cone') return 'estimated';
  return efficiencyPercent === DRIP_DEFAULT_EFFICIENCY_PERCENT ? 'calculated' : 'estimated';
}

function flowStep(flow: ResolvedFlow, inputs: CalculatorInputs): string {
  if (flow.source === 'measured') return `Débit mesuré : ${n(flow.litersPerHour)} l/h, utilisé tel quel.`;
  if (flow.source === 'datasheet') return `Débit de la fiche, à la pression de la fiche : ${n(flow.litersPerHour)} l/h.`;
  return `Débit à ${n(inputs.actualPressureBar!)} bar = ${n(inputs.referenceFlowLitersPerHour!)} × (${n(inputs.actualPressureBar!)} ÷ ${n(inputs.referencePressureBar!)})^${n(inputs.pressureExponent!)} = ${n(flow.litersPerHour, 1)} l/h.`;
}

function blank(inputs: CalculatorInputs): CalculatorResult {
  return {
    method: inputs.method,
    level: levelOf(inputs.method, inputs.efficiencyPercent),
    missing: [],
    errors: [],
    flow: null,
    theoreticalRateMmPerHour: null,
    receivedRateMmPerHour: null,
    zoneSharePercent: null,
    profile: null,
    bedSharePercent: null,
    valveFlowLitersPerHour: null,
    nominalFlowLitersPerHour: null,
    nominalScope: null,
    warnings: [],
    steps: [],
  };
}

export function calculateIrrigationSetting(inputs: CalculatorInputs): CalculatorResult {
  const result = blank(inputs);
  result.errors = inputErrors(inputs);
  if (result.errors.length > 0) return result;

  const resolution = resolveFlow(inputs);
  const missing = new Set<CalculatorField>(FIELDS_BY_METHOD[inputs.method].filter((field) => inputs[field] === null));
  if (resolution.kind === 'missing') resolution.missing.forEach((field) => missing.add(field));
  else {
    result.flow = resolution.flow;
    if (resolution.pressureOutOfRange) result.warnings.push('pressure-out-of-range');
    result.steps.push(flowStep(resolution.flow, inputs));
  }
  // Par vanne, l'écartement ne manque qu'au mm/h : le débit de la vanne s'affiche sans lui (section 5 b).
  if (inputs.method === 'drip_per_valve') {
    if (inputs.lineGapMeters === null) missing.add('lineGapMeters');
    if (inputs.efficiencyPercent === null) missing.add('efficiencyPercent');
  }
  result.missing = [...missing];

  const q = result.flow?.litersPerHour ?? null;
  switch (inputs.method) {
    case 'drip_per_bed':
      return withDripPerBed(result, inputs, q);
    case 'drip_per_valve':
      return withDripPerValve(result, inputs, q);
    case 'sprinkler_mean':
      return withSprinklerMean(result, inputs, q);
    case 'sprinkler_cone':
      return withSprinklerCone(result, inputs, q);
  }
}

function plausibility(result: CalculatorResult): CalculatorResult {
  if (result.receivedRateMmPerHour !== null && result.receivedRateMmPerHour > PLAUSIBLE_RATE_LIMIT_MM_PER_HOUR) {
    result.warnings.push('rate-above-plausible');
  }
  return result;
}

function withDripPerBed(result: CalculatorResult, inputs: CalculatorInputs, q: number | null): CalculatorResult {
  const { lineCount, spacingMeters: e, bedWidthMeters: w, efficiencyPercent: eta } = inputs;
  if (q !== null && lineCount !== null && e !== null) {
    result.nominalFlowLitersPerHour = dripPerBedFlowPerMeter(lineCount, q, e);
    result.nominalScope = 'per-meter-of-bed';
  }
  if (result.missing.length > 0 || q === null) return result;
  const theoretical = dripPerBedTheoreticalRate(lineCount!, q, e!, w!);
  result.theoreticalRateMmPerHour = roundToHundredth(theoretical);
  result.receivedRateMmPerHour = roundToHundredth(receivedRate(theoretical, eta!));
  result.zoneSharePercent = eta;
  result.steps.push(
    `mm/h théorique = ${n(lineCount!)} × (${n(q)} ÷ ${n(e!)}) ÷ ${n(w!)} = ${n(theoretical)} mm/h.`,
    `mm/h reçu = ${n(theoretical)} × ${n(eta!)} % = ${n(result.receivedRateMmPerHour)} mm/h.`,
  );
  return plausibility(result);
}

function withDripPerValve(result: CalculatorResult, inputs: CalculatorInputs, q: number | null): CalculatorResult {
  const { lineCount: N, lineLengthMeters: L, spacingMeters: e, lineGapMeters: g, efficiencyPercent: eta } = inputs;
  if (q !== null && N !== null && L !== null && e !== null) {
    const valveFlow = dripValveFlow(N, L, q, e);
    result.valveFlowLitersPerHour = valveFlow;
    result.nominalFlowLitersPerHour = valveFlow;
    result.nominalScope = 'valve';
    result.steps.push(
      `Débit de la vanne = ${n(N)} × ${n(L)} × ${n(q)} ÷ ${n(e)} = ${n(valveFlow, 1)} l/h, soit ${n(cubicMetersPerHourFromLitersPerHour(valveFlow))} m³/h.`,
      `Le nombre de goutteurs est pris en continu (${n(L)} ÷ ${n(e)} = ${n(L / e, 1)} par ligne) : c'est une estimation.`,
    );
  }
  if (result.missing.length > 0 || q === null) return result;
  const theoretical = dripPerValveTheoreticalRate(q, e!, g!);
  result.theoreticalRateMmPerHour = roundToHundredth(theoretical);
  result.receivedRateMmPerHour = roundToHundredth(receivedRate(theoretical, eta!));
  result.zoneSharePercent = eta;
  result.steps.push(
    `mm/h théorique = ${n(q)} ÷ (${n(e!)} × ${n(g!)}) = ${n(theoretical)} mm/h.`,
    `mm/h reçu = ${n(theoretical)} × ${n(eta!)} % = ${n(result.receivedRateMmPerHour)} mm/h.`,
  );
  return plausibility(result);
}

function sprinklerNominal(result: CalculatorResult, inputs: CalculatorInputs, q: number | null) {
  if (q === null) return;
  if (inputs.sprinklerCount !== null) {
    result.nominalFlowLitersPerHour = inputs.sprinklerCount * q;
    result.nominalScope = 'ramp';
  } else {
    result.nominalFlowLitersPerHour = q;
    result.nominalScope = 'per-sprinkler';
  }
}

function withSprinklerMean(result: CalculatorResult, inputs: CalculatorInputs, q: number | null): CalculatorResult {
  const { spacingMeters: s, wettedWidthMeters: w, efficiencyPercent: eta, reachMeters: R } = inputs;
  sprinklerNominal(result, inputs, q);
  if (w !== null && R !== null && w < 2 * R) result.warnings.push('jet-wider-than-band');
  if (result.missing.length > 0 || q === null) return result;
  const theoretical = sprinklerMeanTheoreticalRate(q, s!, w!);
  const received = roundToHundredth(receivedRate(theoretical, eta!));
  const edge = roundToHundredth(w! / 2);
  result.theoreticalRateMmPerHour = roundToHundredth(theoretical);
  result.receivedRateMmPerHour = received;
  result.zoneSharePercent = eta;
  result.profile = [
    { distanceMeters: 0, rateMmPerHour: received },
    { distanceMeters: edge, rateMmPerHour: received },
  ];
  result.steps.push(
    `mm/h théorique = ${n(q)} ÷ (${n(s!)} × ${n(w!)}) = ${n(theoretical)} mm/h.`,
    `mm/h reçu = ${n(theoretical)} × ${n(eta!)} % = ${n(received)} mm/h.`,
    `Profil : ${n(received)} mm/h de 0 à ${n(edge)} m de chaque côté, rien au-delà.`,
  );
  return plausibility(result);
}

function withSprinklerCone(result: CalculatorResult, inputs: CalculatorInputs, q: number | null): CalculatorResult {
  const { spacingMeters: s, reachMeters: R, bedAndPathWidthMeters: band } = inputs;
  // Pas d'efficacité ici : la forme du cône contient déjà l'eau qui tombe hors des planches (section 6.2).
  result.level = 'estimated';
  sprinklerNominal(result, inputs, q);
  if (s !== null && R !== null && s > R) result.warnings.push('spacing-beyond-reach');
  if (result.missing.length > 0 || q === null) return result;
  const last = CONE_PROFILE_POINTS - 1;
  result.profile = Array.from({ length: CONE_PROFILE_POINTS }, (_, index) => {
    const distance = index === last ? R! : (R! * index) / last;
    return {
      distanceMeters: roundToHundredth(distance),
      rateMmPerHour: roundToHundredth(coneRateAtDistance(q, R!, s!, distance)),
    };
  });
  result.receivedRateMmPerHour = result.profile[0]!.rateMmPerHour;
  result.steps.push(
    `Chaque asperseur répartit ${n(q)} l/h en cône jusqu'à ${n(R!)} m ; sous la rampe, ${n(result.receivedRateMmPerHour)} mm/h = 3 × ${n(q)} ÷ (π × ${n(R!)} × ${n(s!)}).`,
    `Le profil donne ${CONE_PROFILE_POINTS} points de 0 à ${n(R!)} m, identiques à gauche et à droite ; rien au-delà de la portée.`,
  );
  if (band !== null) {
    result.bedSharePercent = roundToHundredth(coneSharePercent(q, R!, s!, band));
    result.steps.push(`Sur ${n(band)} m centrés sur la rampe tombent ${n(result.bedSharePercent, 1)} % de l'eau de la rampe (information seulement, le profil n'en dépend pas).`);
  }
  return plausibility(result);
}

/** Les noms des champs manquants, pour la ligne « Il manque : … ». */
export function missingFieldsText(missing: readonly CalculatorField[]): string | null {
  if (missing.length === 0) return null;
  return `Il manque : ${missing.map((field) => FIELD_LABELS[field]).join(', ')}.`;
}
