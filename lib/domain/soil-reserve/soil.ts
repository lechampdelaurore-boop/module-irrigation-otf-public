/**
 * Le sol de la réserve du sol (docs/soil-reserve-contract.md, « Le sol »,
 * D-041, D-046, D-047, D-053, D-056, D-059).
 *
 * La RFU se saisit par parcelle, en mm par mètre de sol ; un jardin ou un abri
 * peut porter sa valeur propre, qui prime sur celle de sa parcelle. La RFU du
 * sol est la RFU du laboratoire corrigée des cailloux, arrondie au mm/m
 * entier. Chaque saisie est une révision datée, conservée : la plus récente
 * vaut à partir de son jour (D-006). Les réglages de l'exploitation — le
 * seuil d'arrosage (D-059), les coefficients des états de surface et la part
 * de pluie qui traverse un paillage plastique — sont aussi des révisions
 * datées. Rien ici n'entre dans le besoin, le planning ni la dose (D-047).
 */

type SoilProvenance = 'analysis' | 'estimate' | 'default';

export type SoilRecord = {
  zoneId: string;
  /** `null` : la valeur de la parcelle ; sinon la valeur propre de ce jardin ou de cet abri. */
  plotId: string | null;
  labRfuMmPerMeter: number;
  /** Part de cailloux en % ; `null` : non renseignée, comptée pour 0 avec une mention. */
  stoneSharePercent: number | null;
  /** Part de la réserve utile que représente la RFU du laboratoire, strictement entre 0 et 1. */
  referenceShare: number;
  provenance: SoilProvenance;
  /** Profondeur de l'échantillon, une information qui ne change pas la RFU. */
  sampledDepthCm: number | null;
  source: string;
  /** Eau évaporable de la couche de surface (TEW), en mm. */
  tewMm: number;
  /** Eau facilement évaporable (REW), en mm, inférieure à TEW. */
  rewMm: number;
  /** Épaisseur de la couche de surface (Ze), en cm. */
  surfaceLayerCm: number;
  /** Profondeur de sol au-delà de laquelle les racines ne descendent pas (D-056) ; `null` : aucune limite. */
  soilDepthCeilingM: number | null;
  /** Le jour à partir duquel la révision vaut. */
  effectiveFrom: string;
  recordedAt: string;
};

/** Valeurs de départ d'une parcelle (D-053) : part de référence du CRIIAM, TEW, REW et Ze d'un limon sableux. */
export const SOIL_DEFAULTS = { referenceShare: 2 / 3, tewMm: 14, rewMm: 7, surfaceLayerCm: 10 } as const;

/** Au-delà de 200 mm/m (2 mm/cm), la RFU du laboratoire dépasse ce qu'un sol retient d'ordinaire. */
const PLAUSIBLE_LAB_RFU_MAX_MM_PER_METER = 200;
const MAX_STONE_SHARE_PERCENT = 99;
export const PERCENT = 100;

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** La RFU du sol : RFU du laboratoire × (1 − part de cailloux), arrondie au mm/m entier. */
export function soilRfuMmPerMeter(labRfuMmPerMeter: number, stoneSharePercent: number | null): number {
  return Math.round(labRfuMmPerMeter * (1 - (stoneSharePercent ?? 0) / PERCENT));
}

/** Ce qui empêche d'enregistrer une saisie du sol, en phrases ; une liste vide : la saisie est valable. */
export function soilRecordProblems(record: Omit<SoilRecord, 'zoneId' | 'plotId' | 'effectiveFrom' | 'recordedAt'>): string[] {
  const problems: string[] = [];
  if (!isPositive(record.labRfuMmPerMeter)) problems.push('RFU du laboratoire invalide : elle est strictement positive, en mm par mètre de sol.');
  const stones = record.stoneSharePercent;
  if (stones !== null && !(Number.isFinite(stones) && stones >= 0 && stones <= MAX_STONE_SHARE_PERCENT)) {
    problems.push(`Part de cailloux invalide : de 0 à ${MAX_STONE_SHARE_PERCENT} %.`);
  }
  if (!(Number.isFinite(record.referenceShare) && record.referenceShare > 0 && record.referenceShare < 1)) {
    problems.push('Part de référence invalide : strictement entre 0 et 1.');
  }
  if (!isPositive(record.tewMm)) problems.push('Eau évaporable (TEW) invalide : strictement positive, en mm.');
  if (!isPositive(record.rewMm) || (isPositive(record.tewMm) && record.rewMm >= record.tewMm)) {
    problems.push('Eau facilement évaporable (REW) invalide : strictement positive et inférieure à TEW.');
  }
  if (!isPositive(record.surfaceLayerCm)) problems.push('Épaisseur de la couche de surface (Ze) invalide : strictement positive, en cm.');
  if (record.soilDepthCeilingM !== null && !isPositive(record.soilDepthCeilingM)) {
    problems.push('Profondeur de sol invalide : strictement positive, en m, ou vide.');
  }
  if (record.sampledDepthCm !== null && !isPositive(record.sampledDepthCm)) {
    problems.push('Profondeur prélevée invalide : strictement positive, en cm, ou vide.');
  }
  return problems;
}

/** L'avertissement de vraisemblance : il n'empêche pas l'enregistrement. */
export function labRfuWarning(labRfuMmPerMeter: number): string | null {
  if (!(labRfuMmPerMeter > PLAUSIBLE_LAB_RFU_MAX_MM_PER_METER)) return null;
  return `La RFU saisie, ${decimal.format(labRfuMmPerMeter)} mm/m, dépasse ce qu'un sol retient d'ordinaire (${PLAUSIBLE_LAB_RFU_MAX_MM_PER_METER} mm/m) : la RFU se saisit en mm par mètre de sol.`;
}

/** Le sol qui vaut pour une planche un jour donné, et d'où il vient. */
export type ResolvedSoil = {
  record: SoilRecord;
  /** `plot` : la valeur propre du jardin ou de l'abri ; `zone` : celle de la parcelle. */
  origin: 'plot' | 'zone';
  soilRfuMmPerMeter: number;
  stonesMissing: boolean;
};

/**
 * Le sol d'une planche un jour donné : la dernière révision en vigueur de son
 * jardin ou de son abri, sinon celle de sa parcelle, sans mention pour un abri
 * (D-053) ; `null` quand ni l'un ni l'autre n'a de saisie.
 */
export function resolveBedSoil(
  records: readonly SoilRecord[],
  bed: { zoneId: string; plotId: string },
  date: string,
): ResolvedSoil | null {
  const own = latestEffective(records.filter((record) => record.zoneId === bed.zoneId && record.plotId === bed.plotId), date);
  const record = own ?? latestEffective(records.filter((record) => record.zoneId === bed.zoneId && record.plotId === null), date);
  if (record === null) return null;
  return {
    record,
    origin: own ? 'plot' : 'zone',
    soilRfuMmPerMeter: soilRfuMmPerMeter(record.labRfuMmPerMeter, record.stoneSharePercent),
    stonesMissing: record.stoneSharePercent === null,
  };
}

/** Le seuil d'arrosage (D-059) : la formule par culture de D-053 par défaut, ou un % du plein réglé par l'exploitation. */
export type ThresholdSetting = { mode: 'crop' } | { mode: 'farm'; percent: number };

/** Les coefficients des états de surface d'une planche sans culture (D-053), réglables par l'exploitation. */
export type SurfaceCoefficients = {
  /** Part de l'évaporation du sol nu sous une bâche perméable. */
  permeableTarpEvaporation: number;
  /** Part de l'évaporation du sol nu sous un paillage (paille, foin, BRF) ou un engrais vert détruit. */
  mulchedEvaporation: number;
  greenManureEmergenceKc: number;
  greenManurePartialKc: number;
  greenManureFullKc: number;
  grassKc: number;
};

export type SoilSettings = {
  threshold: ThresholdSetting;
  surface: SurfaceCoefficients;
  /** Part de la pluie comptée sur une planche cultivée sous paillage plastique, de 0 à 1 ; 1 au départ. */
  plasticMulchRainShare: number;
};

export type SoilSettingsRevision = SoilSettings & { effectiveFrom: string; recordedAt: string };

export const DEFAULT_SOIL_SETTINGS: SoilSettings = {
  threshold: { mode: 'crop' },
  surface: {
    permeableTarpEvaporation: 0.1,
    mulchedEvaporation: 0.5,
    greenManureEmergenceKc: 0.3,
    greenManurePartialKc: 0.6,
    greenManureFullKc: 1,
    grassKc: 0.6,
  },
  plasticMulchRainShare: 1,
};

/** Le seuil réglé par l'exploitation se choisit de 20 à 80 % du plein, par pas de 5 % ; 50 % proposés (D-059). */
export const FARM_THRESHOLD = { minimumPercent: 20, maximumPercent: 80, stepPercent: 5, proposedPercent: 50 } as const;
/** Bornes des Kc d'un engrais vert ou d'une planche enherbée, comme celles des cultures. */
const COVER_KC_MAX = 1.3;

/** Les réglages qui valent un jour donné : la dernière révision en vigueur, sinon les valeurs de départ. */
export function soilSettingsOn(revisions: readonly SoilSettingsRevision[], date: string): SoilSettings {
  return latestEffective(revisions, date) ?? DEFAULT_SOIL_SETTINGS;
}

/** Ce qui empêche d'enregistrer les réglages, en phrases. */
export function soilSettingsProblems(settings: SoilSettings): string[] {
  const problems: string[] = [];
  const threshold = settings.threshold;
  if (threshold.mode === 'farm') {
    const { minimumPercent, maximumPercent, stepPercent } = FARM_THRESHOLD;
    const onStep = Number.isInteger(threshold.percent) && threshold.percent % stepPercent === 0;
    if (!(onStep && threshold.percent >= minimumPercent && threshold.percent <= maximumPercent)) {
      problems.push(`Seuil d'arrosage invalide : de ${minimumPercent} à ${maximumPercent} % du plein, par pas de ${stepPercent} %.`);
    }
  }
  const { surface } = settings;
  for (const [label, value] of [
    ['bâche perméable', surface.permeableTarpEvaporation],
    ['paillage', surface.mulchedEvaporation],
  ] as const) {
    if (!isShare(value)) problems.push(`Part d'évaporation invalide (${label}) : de 0 à 100 %.`);
  }
  for (const [label, value] of [
    ['engrais vert, levée', surface.greenManureEmergenceKc],
    ['engrais vert, couverture partielle', surface.greenManurePartialKc],
    ['engrais vert, couverture totale', surface.greenManureFullKc],
    ['enherbée', surface.grassKc],
  ] as const) {
    if (!(Number.isFinite(value) && value >= 0 && value <= COVER_KC_MAX)) {
      problems.push(`Kc invalide (${label}) : de 0 à ${decimal.format(COVER_KC_MAX)}.`);
    }
  }
  if (!isShare(settings.plasticMulchRainShare)) problems.push('Part de pluie sous paillage plastique invalide : de 0 à 100 %.');
  return problems;
}

/** La dernière révision en vigueur un jour donné ; à jour égal, la dernière enregistrée. */
export function latestEffective<T extends { effectiveFrom: string; recordedAt: string }>(revisions: readonly T[], date: string): T | null {
  let chosen: T | null = null;
  for (const revision of revisions) {
    if (revision.effectiveFrom > date) continue;
    if (chosen === null || revision.effectiveFrom > chosen.effectiveFrom
      || (revision.effectiveFrom === chosen.effectiveFrom && revision.recordedAt >= chosen.recordedAt)) chosen = revision;
  }
  return chosen;
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isShare(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
