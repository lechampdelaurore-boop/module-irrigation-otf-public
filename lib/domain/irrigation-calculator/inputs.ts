/**
 * Les saisies du calculateur d'irrigation (3.8 bis,
 * docs/irrigation-calculator-contract.md, sections 5 à 7 et 12) : ce que
 * l'utilisateur connaît de son matériel, champ par champ. Un champ vide vaut
 * `null` : le résultat qui en dépend reste inconnu et l'écran dit lequel
 * manque (section 4, règle 4, D-003). Un champ illisible (`NaN`) ou hors de
 * ses bornes est refusé avec un message en français, sans bloquer le reste.
 */

/** Les quatre manières de calculer (section 10, colonne `method`). */
const CALCULATOR_METHODS = ['drip_per_bed', 'drip_per_valve', 'sprinkler_mean', 'sprinkler_cone'] as const;
export type CalculatorMethod = (typeof CALCULATOR_METHODS)[number];

/** La version des formules, enregistrée avec les entrées (section 10, `inputs_json`). */
export const CALCULATOR_FORMULA_VERSION = 1;

export type CalculatorInputs = {
  method: CalculatorMethod;
  /** Débit mesuré d'un goutteur ou d'un asperseur, l/h : il prime sur la fiche (section 7, règle 1). */
  measuredFlowLitersPerHour: number | null;
  /** Débit de la fiche, l/h, à la pression de la fiche. */
  referenceFlowLitersPerHour: number | null;
  referencePressureBar: number | null;
  /** Pression réelle au matériel, si l'utilisateur la connaît. */
  actualPressureBar: number | null;
  /** Exposant `x` de `Q = Qref × (Pr ÷ Pref)^x` : 0 autorégulant, 0,5 buse. */
  pressureExponent: number | null;
  pressureRangeMinBar: number | null;
  pressureRangeMaxBar: number | null;
  /** Goutte-à-goutte : lignes par planche (`n`) ou par vanne (`N`). Aspersion : asperseurs sur la rampe (`k`). */
  lineCount: number | null;
  sprinklerCount: number | null;
  /** Espacement des goutteurs `e` ou des asperseurs `s`, m. */
  spacingMeters: number | null;
  /** Goutte-à-goutte par planche : largeur d'une planche typique `w`, m. */
  bedWidthMeters: number | null;
  /** Goutte-à-goutte par vanne : longueur de chaque ligne `L`, m. */
  lineLengthMeters: number | null;
  /** Goutte-à-goutte par vanne : écartement entre lignes `g`, m. */
  lineGapMeters: number | null;
  /** Aspersion moyenne : largeur arrosée `w`, m. */
  wettedWidthMeters: number | null;
  /** Aspersion : portée `R`, rayon mouillé, m. */
  reachMeters: number | null;
  /** Profil en cône : largeur d'une planche et de son passe-pied, m (information seulement). */
  bedAndPathWidthMeters: number | null;
  /** Part d'eau sur la zone `η`, de 1 à 100 %. */
  efficiencyPercent: number | null;
};

export type CalculatorField = Exclude<keyof CalculatorInputs, 'method'>;

/** L'efficacité proposée en goutte-à-goutte : le tuyau ne mouille que la planche (D-022). */
export const DRIP_DEFAULT_EFFICIENCY_PERCENT = 100;
/** L'efficacité proposée en aspersion moyenne : la cible de Francis (Nutri-O), cahier des charges du 6 novembre 2026. */
const SPRINKLER_MEAN_DEFAULT_EFFICIENCY_PERCENT = 80;
/** L'exposant de pression d'une buse ; 0 pour un matériel autorégulant dans sa plage (section 7, règle 2). */
export const NOZZLE_PRESSURE_EXPONENT = 0.5;
export const SELF_REGULATING_PRESSURE_EXPONENT = 0;
const MIN_EFFICIENCY_PERCENT = 1;
const MAX_EFFICIENCY_PERCENT = 100;
const MAX_PRESSURE_EXPONENT = 1;

export const FIELD_LABELS: Readonly<Record<CalculatorField, string>> = {
  measuredFlowLitersPerHour: 'débit mesuré',
  referenceFlowLitersPerHour: 'débit de la fiche',
  referencePressureBar: 'pression de la fiche',
  actualPressureBar: 'pression réelle',
  pressureExponent: 'exposant de pression',
  pressureRangeMinBar: 'pression minimale conseillée',
  pressureRangeMaxBar: 'pression maximale conseillée',
  lineCount: 'nombre de lignes',
  sprinklerCount: 'nombre d’asperseurs',
  spacingMeters: 'espacement',
  bedWidthMeters: 'largeur de la planche',
  lineLengthMeters: 'longueur de chaque ligne',
  lineGapMeters: 'écartement entre lignes',
  wettedWidthMeters: 'largeur arrosée',
  reachMeters: 'portée',
  bedAndPathWidthMeters: 'largeur de la planche et du passe-pied',
  efficiencyPercent: 'part d’eau sur la zone',
};

type FieldRule = 'positive' | 'count' | 'percent' | 'exponent';

const FIELD_RULES: Readonly<Record<CalculatorField, FieldRule>> = {
  measuredFlowLitersPerHour: 'positive',
  referenceFlowLitersPerHour: 'positive',
  referencePressureBar: 'positive',
  actualPressureBar: 'positive',
  pressureExponent: 'exponent',
  pressureRangeMinBar: 'positive',
  pressureRangeMaxBar: 'positive',
  lineCount: 'count',
  sprinklerCount: 'count',
  spacingMeters: 'positive',
  bedWidthMeters: 'positive',
  lineLengthMeters: 'positive',
  lineGapMeters: 'positive',
  wettedWidthMeters: 'positive',
  reachMeters: 'positive',
  bedAndPathWidthMeters: 'positive',
  efficiencyPercent: 'percent',
};

export const CALCULATOR_FIELDS = Object.keys(FIELD_RULES) as CalculatorField[];

export type FieldError = { field: CalculatorField; message: string };

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Le message d'un champ refusé, ou `null` s'il est vide ou valable (section 12). */
export function fieldError(field: CalculatorField, value: number | null): string | null {
  if (value === null) return null;
  const label = capitalized(FIELD_LABELS[field]);
  if (!Number.isFinite(value)) return `${label} : saisissez un nombre.`;
  switch (FIELD_RULES[field]) {
    case 'positive':
      return value > 0 ? null : `${label} : saisissez un nombre plus grand que zéro.`;
    case 'count':
      return Number.isInteger(value) && value >= 1 ? null : `${label} : saisissez un nombre entier, au moins 1.`;
    case 'percent':
      return value >= MIN_EFFICIENCY_PERCENT && value <= MAX_EFFICIENCY_PERCENT
        ? null
        : `${label} : saisissez un pourcentage de ${MIN_EFFICIENCY_PERCENT} à ${MAX_EFFICIENCY_PERCENT}.`;
    case 'exponent':
      return value >= 0 && value <= MAX_PRESSURE_EXPONENT ? null : `${label} : saisissez un nombre de 0 à ${MAX_PRESSURE_EXPONENT}.`;
  }
}

/** Les champs refusés, dans l'ordre de la liste. */
export function inputErrors(inputs: CalculatorInputs): FieldError[] {
  return CALCULATOR_FIELDS.flatMap((field) => {
    const message = fieldError(field, inputs[field]);
    return message ? [{ field, message }] : [];
  });
}

/** Des entrées vides pour une manière, avec les valeurs proposées par défaut (section 4, niveau 2 ; section 7). */
export function emptyCalculatorInputs(method: CalculatorMethod): CalculatorInputs {
  const empty = Object.fromEntries(CALCULATOR_FIELDS.map((field) => [field, null])) as Record<CalculatorField, null>;
  const efficiencyPercent = method === 'sprinkler_mean'
    ? SPRINKLER_MEAN_DEFAULT_EFFICIENCY_PERCENT
    : method === 'sprinkler_cone'
      ? null
      : DRIP_DEFAULT_EFFICIENCY_PERCENT;
  return { ...empty, method, pressureExponent: NOZZLE_PRESSURE_EXPONENT, efficiencyPercent };
}

function isCalculatorMethod(value: unknown): value is CalculatorMethod {
  return typeof value === 'string' && (CALCULATOR_METHODS as readonly string[]).includes(value);
}

/**
 * Relit des entrées venues du navigateur ou de la base (`inputs_json`) : une
 * manière inconnue ne vaut rien ; un champ absent ou qui n'est pas un nombre
 * devient vide ou illisible, jamais zéro.
 */
export function parseCalculatorInputs(value: unknown): CalculatorInputs | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!isCalculatorMethod(record.method)) return null;
  const inputs = emptyCalculatorInputs(record.method);
  for (const field of CALCULATOR_FIELDS) {
    const raw = record[field];
    inputs[field] = raw === null || raw === undefined ? null : typeof raw === 'number' ? raw : Number.NaN;
  }
  return inputs;
}

/** Les manières qui conviennent à un matériel (section 11). */
export function methodsForKind(kind: 'drip' | 'sprinkler'): CalculatorMethod[] {
  return kind === 'drip' ? ['drip_per_bed', 'drip_per_valve'] : ['sprinkler_mean', 'sprinkler_cone'];
}

export const METHOD_LABELS: Readonly<Record<CalculatorMethod, string>> = {
  drip_per_bed: 'Par planche',
  drip_per_valve: 'Par vanne',
  sprinkler_mean: 'Pluviométrie moyenne',
  sprinkler_cone: 'Profil en cône',
};
