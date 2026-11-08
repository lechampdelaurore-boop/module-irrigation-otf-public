/**
 * Les seuils des alertes par culture (docs/weather-crop-alerts-contract.md,
 * D-058) : le seuil de gel d'une espèce, sa marge, le décalage du curseur de
 * microclimat, le délai de séchage, et le rattachement d'une espèce d'Ouvre ta
 * ferme au jeu commun, par espèce avec exception par série, comme la
 * correspondance de la 5 quater.
 *
 * Ce module ne lit ni n'écrit rien : le jeu commun et les révisions de la
 * ferme sont des données que la persistance apporte. Rien n'est deviné : une
 * espèce sans rattachement n'a pas de seuil (D-003).
 */

/** Une entrée du jeu commun : une culture, son seuil de dégâts et son délai de séchage, l'un et l'autre facultatifs. */
export type CropAlertCommonEntry = {
  key: string;
  name: string;
  /** La température prévue sous laquelle la source situe les premiers dégâts ; `null` : aucune valeur trouvée. */
  damageCelsius: number | null;
  /** Les jours sans arrosage avant la récolte ; `null` : pas de séchage pour cette culture. */
  dryingDays: number | null;
};

/**
 * Une révision de la ferme pour une espèce, ou pour une seule série de cette
 * espèce : son rattachement au jeu commun, et le seuil de dégâts propre à la
 * ferme qui le remplace. Elle ne se modifie pas ; la plus récente fait foi.
 */
export type FrostLinkRevision = {
  id: string;
  plantId: string;
  /** `null` : la révision de l'espèce ; sinon l'exception de cette série. */
  seriesId: string | null;
  /** L'entrée du jeu commun à laquelle l'espèce est rattachée ; `null` : aucune. */
  commonKey: string | null;
  /** Le seuil de dégâts de la ferme ; `null` : celui du jeu commun. */
  damageCelsius: number | null;
  /** L'instant de l'enregistrement, qui ordonne les révisions. */
  recordedAt: string;
};

/** Le délai de séchage d'une espèce corrigé par la ferme ; `null` : délai retiré. */
export type DryingRevision = {
  id: string;
  plantId: string;
  dryingDays: number | null;
  recordedAt: string;
};

/** Le seuil de gel retenu pour une culture d'une série. */
export type ResolvedFrostThreshold = {
  /**
   * Ce que l'alerte nomme et ne répète pas : l'espèce, ou l'exception d'une
   * série. Une révision nouvelle change la version : les jours visés repartent
   * de zéro (« La répétition et le regroupement »).
   */
  subjectKey: string;
  subjectVersion: string;
  /** `missing` : aucun rattachement saisi ; `none` : rattachée sans seuil ; sinon le seuil de dégâts. */
  status: 'missing' | 'none' | 'threshold';
  damageCelsius: number | null;
  source: 'common' | 'farm' | null;
  commonKey: string | null;
};

/** Sous ce seuil de dégâts, une culture est rustique ; à partir de lui, elle est sensible. */
const SENSITIVE_FROM_CELSIUS = -2;

/**
 * Les deux marges entre la prévision à 2 m et le ras du sol : 3 °C pour une
 * culture sensible, 2 °C pour une rustique, réglables par la ferme depuis le
 * 7 novembre 2026 (retour du porteur, précision P44), de 0 à 5 °C par pas de
 * 0,5 °C.
 */
export type FrostMargins = { sensitiveCelsius: number; hardyCelsius: number };
export const FROST_MARGIN_CELSIUS = { minimum: 0, maximum: 5, step: 0.5 } as const;
export const DEFAULT_FROST_MARGINS: Readonly<FrostMargins> = { sensitiveCelsius: 3, hardyCelsius: 2 };

/** Le curseur de microclimat : de −5 à +5 °C par pas de 0,5 °C, 0 par défaut. */
export const FROST_OFFSET_CELSIUS = { minimum: -5, maximum: 5, step: 0.5, default: 0 } as const;
/** Un seuil de dégâts saisi par la ferme. */
export const FROST_DAMAGE_CELSIUS = { minimum: -30, maximum: 10, step: 0.5 } as const;
/** Un délai de séchage saisi par la ferme, en jours entiers. */
export const DRYING_DAYS = { minimum: 1, maximum: 60 } as const;

/** Une culture sensible au gel : ses dégâts commencent à −2 °C ou au-dessus. */
function isFrostSensitive(damageCelsius: number): boolean {
  return damageCelsius >= SENSITIVE_FROM_CELSIUS;
}

/** L'écart entre la prévision à 2 m et le ras du sol, selon le seuil de dégâts et les marges de la ferme. */
export function frostMarginCelsius(damageCelsius: number, margins: FrostMargins = DEFAULT_FROST_MARGINS): number {
  return isFrostSensitive(damageCelsius) ? margins.sensitiveCelsius : margins.hardyCelsius;
}

/** Le seuil appliqué : dégâts + marge + décalage du curseur de microclimat. */
export function frostAlertThresholdCelsius(damageCelsius: number, offsetCelsius: number, margins: FrostMargins = DEFAULT_FROST_MARGINS): number {
  return damageCelsius + frostMarginCelsius(damageCelsius, margins) + offsetCelsius;
}

/**
 * Le seuil de gel d'une culture d'une série : l'exception de la série prime
 * sur la révision de l'espèce ; le seuil de la ferme prime sur celui du jeu
 * commun. Sans révision, la culture est à rattacher.
 */
export function resolveFrostThreshold(input: {
  plantId: string;
  seriesId: string;
  revisions: readonly FrostLinkRevision[];
  common: ReadonlyMap<string, CropAlertCommonEntry>;
}): ResolvedFrostThreshold {
  const exception = latest(input.revisions.filter((revision) => revision.plantId === input.plantId && revision.seriesId === input.seriesId));
  const species = latest(input.revisions.filter((revision) => revision.plantId === input.plantId && revision.seriesId === null));
  const revision = exception ?? species;
  if (revision === null) {
    return { subjectKey: input.plantId, subjectVersion: 'missing', status: 'missing', damageCelsius: null, source: null, commonKey: null };
  }
  const subjectKey = exception ? `${input.plantId}:${input.seriesId}` : input.plantId;
  const commonDamage = revision.commonKey === null ? null : input.common.get(revision.commonKey)?.damageCelsius ?? null;
  const damageCelsius = revision.damageCelsius ?? commonDamage;
  return {
    subjectKey,
    subjectVersion: revision.id,
    status: damageCelsius === null ? 'none' : 'threshold',
    damageCelsius,
    source: damageCelsius === null ? null : revision.damageCelsius === null ? 'common' : 'farm',
    commonKey: revision.commonKey,
  };
}

/**
 * Le délai de séchage d'une culture : la correction de la ferme pour
 * l'espèce, sinon celui de l'entrée du jeu commun à laquelle la culture est
 * rattachée pour le gel ; `null` : pas de séchage.
 */
export function resolveDryingDays(input: {
  plantId: string;
  seriesId: string;
  frostRevisions: readonly FrostLinkRevision[];
  dryingRevisions: readonly DryingRevision[];
  common: ReadonlyMap<string, CropAlertCommonEntry>;
}): number | null {
  const correction = latest(input.dryingRevisions.filter((revision) => revision.plantId === input.plantId));
  if (correction) return correction.dryingDays;
  const link = resolveFrostThreshold({ plantId: input.plantId, seriesId: input.seriesId, revisions: input.frostRevisions, common: input.common });
  return link.commonKey === null ? null : input.common.get(link.commonKey)?.dryingDays ?? null;
}

/** Un nombre saisi avec une virgule ou un point décimal, signe compris ; `NaN` sinon. */
export function decimalFromInput(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  const text = value.trim().replace(',', '.').replace('−', '-');
  return /^[-+]?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
}

/** Vrai quand `value` est un multiple de `step` à l'arrondi près. */
export function onStep(value: number, step: number): boolean {
  return Math.abs(Math.round(value / step) * step - value) < 1e-9;
}

function latest<T extends { recordedAt: string; id: string }>(revisions: readonly T[]): T | null {
  return revisions.reduce<T | null>((found, revision) => (
    found === null || revision.recordedAt > found.recordedAt || (revision.recordedAt === found.recordedAt && revision.id > found.id)
      ? revision
      : found
  ), null);
}
