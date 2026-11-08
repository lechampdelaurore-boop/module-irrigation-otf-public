import { decimalFromInput, DEFAULT_FROST_MARGINS, DRYING_DAYS, FROST_DAMAGE_CELSIUS, FROST_MARGIN_CELSIUS, FROST_OFFSET_CELSIUS, onStep, type FrostMargins } from './thresholds.ts';

/**
 * Les réglages des alertes par culture d'une exploitation
 * (docs/weather-crop-alerts-contract.md, « Les données ») et les saisies de
 * la ferme, validés avant tout enregistrement : un refus dit pourquoi.
 */

export type CropAlertSettings = {
  frostActive: boolean;
  dryingActive: boolean;
  sprinklerActive: boolean;
  /** L'horizon du gel, aujourd'hui compris. */
  horizonDays: number;
  /** Le curseur de microclimat, ajouté à chaque seuil d'alerte de gel. */
  frostOffsetCelsius: number;
  /** La marge d'une culture sensible au gel, de 0 à 5 °C (précision P44). */
  frostMarginSensitiveCelsius: number;
  /** La marge d'une culture rustique, de 0 à 5 °C (précision P44). */
  frostMarginHardyCelsius: number;
  /** Une aspersion est signalée sous cette maximale prévue. */
  sprinklerMaxTemperatureCelsius: number;
  /** Une aspersion est signalée sous ce rayonnement moyen du jour. */
  sprinklerRadiationWattsPerSquareMeter: number;
};

const HORIZON_DAYS = { minimum: 1, maximum: 7 } as const;
const SPRINKLER_TEMPERATURE_CELSIUS = { minimum: 0, maximum: 40 } as const;
const SPRINKLER_RADIATION = { minimum: 50, maximum: 1000 } as const;

/** Les réglages d'une exploitation qui n'a rien réglé : les trois alertes actives, les valeurs du contrat. */
export const DEFAULT_CROP_ALERT_SETTINGS: Readonly<CropAlertSettings> = {
  frostActive: true,
  dryingActive: true,
  sprinklerActive: true,
  horizonDays: 3,
  frostOffsetCelsius: FROST_OFFSET_CELSIUS.default,
  frostMarginSensitiveCelsius: DEFAULT_FROST_MARGINS.sensitiveCelsius,
  frostMarginHardyCelsius: DEFAULT_FROST_MARGINS.hardyCelsius,
  sprinklerMaxTemperatureCelsius: 24,
  sprinklerRadiationWattsPerSquareMeter: 400,
};

type Refusal<K extends string> = { input: K; message: string };

export type CropAlertSettingsValidation =
  | { ok: true; settings: CropAlertSettings }
  | { ok: false; refusals: Refusal<keyof CropAlertSettings>[] };

/** Valide des réglages saisis ; un champ absent garde la valeur par défaut. */
export function validateCropAlertSettings(input: Partial<Record<keyof CropAlertSettings, unknown>>): CropAlertSettingsValidation {
  const refusals: Refusal<keyof CropAlertSettings>[] = [];
  const settings = { ...DEFAULT_CROP_ALERT_SETTINGS };

  for (const key of ['frostActive', 'dryingActive', 'sprinklerActive'] as const) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'boolean') settings[key] = value;
    else refusals.push({ input: key, message: 'Une alerte est active ou non.' });
  }

  const horizon = read(input.horizonDays);
  if (horizon !== undefined) {
    if (Number.isInteger(horizon) && horizon >= HORIZON_DAYS.minimum && horizon <= HORIZON_DAYS.maximum) settings.horizonDays = horizon;
    else refusals.push({ input: 'horizonDays', message: `L’horizon est un nombre entier de jours, de ${HORIZON_DAYS.minimum} à ${HORIZON_DAYS.maximum}, aujourd’hui compris.` });
  }

  const offset = read(input.frostOffsetCelsius);
  if (offset !== undefined) {
    if (Number.isFinite(offset) && offset >= FROST_OFFSET_CELSIUS.minimum && offset <= FROST_OFFSET_CELSIUS.maximum && onStep(offset, FROST_OFFSET_CELSIUS.step)) {
      settings.frostOffsetCelsius = offset === 0 ? 0 : offset;
    } else {
      refusals.push({ input: 'frostOffsetCelsius', message: 'Le décalage des seuils de gel va de −5 à +5 °C, par pas de 0,5 °C.' });
    }
  }

  for (const [key, label] of [['frostMarginSensitiveCelsius', 'sensible'], ['frostMarginHardyCelsius', 'rustique']] as const) {
    const margin = read(input[key]);
    if (margin === undefined) continue;
    if (Number.isFinite(margin) && margin >= FROST_MARGIN_CELSIUS.minimum && margin <= FROST_MARGIN_CELSIUS.maximum && onStep(margin, FROST_MARGIN_CELSIUS.step)) {
      settings[key] = margin;
    } else {
      refusals.push({ input: key, message: `La marge d’une culture ${label} va de ${FROST_MARGIN_CELSIUS.minimum} à ${FROST_MARGIN_CELSIUS.maximum} °C, par pas de 0,5 °C.` });
    }
  }

  const temperature = read(input.sprinklerMaxTemperatureCelsius);
  if (temperature !== undefined) {
    if (Number.isFinite(temperature) && temperature >= SPRINKLER_TEMPERATURE_CELSIUS.minimum && temperature <= SPRINKLER_TEMPERATURE_CELSIUS.maximum && onStep(temperature, 0.5)) {
      settings.sprinklerMaxTemperatureCelsius = temperature;
    } else {
      refusals.push({ input: 'sprinklerMaxTemperatureCelsius', message: `La maximale de l’aspersion va de ${SPRINKLER_TEMPERATURE_CELSIUS.minimum} à ${SPRINKLER_TEMPERATURE_CELSIUS.maximum} °C, par pas de 0,5 °C.` });
    }
  }

  const radiation = read(input.sprinklerRadiationWattsPerSquareMeter);
  if (radiation !== undefined) {
    if (Number.isInteger(radiation) && radiation >= SPRINKLER_RADIATION.minimum && radiation <= SPRINKLER_RADIATION.maximum) {
      settings.sprinklerRadiationWattsPerSquareMeter = radiation;
    } else {
      refusals.push({ input: 'sprinklerRadiationWattsPerSquareMeter', message: `Le rayonnement de l’aspersion est un nombre entier de ${SPRINKLER_RADIATION.minimum} à ${SPRINKLER_RADIATION.maximum} W/m².` });
    }
  }

  return refusals.length > 0 ? { ok: false, refusals } : { ok: true, settings };
}

/** Les marges de gel d'une exploitation, telles que le calcul les prend. */
export function frostMarginsOf(settings: Pick<CropAlertSettings, 'frostMarginSensitiveCelsius' | 'frostMarginHardyCelsius'>): FrostMargins {
  return { sensitiveCelsius: settings.frostMarginSensitiveCelsius, hardyCelsius: settings.frostMarginHardyCelsius };
}

export type FrostLinkInput = { commonKey?: unknown; damageCelsius?: unknown };

export type FrostLinkValidation =
  | { ok: true; commonKey: string | null; damageCelsius: number | null }
  | { ok: false; message: string };

/**
 * Valide le rattachement d'une espèce ou d'une série : une entrée du jeu
 * commun, un seuil de dégâts propre à la ferme, ou les deux ; ni l'un ni
 * l'autre dit « sans seuil ».
 */
export function validateFrostLink(input: FrostLinkInput, commonKeys: ReadonlySet<string>): FrostLinkValidation {
  const commonKey = typeof input.commonKey === 'string' && input.commonKey.trim() !== '' ? input.commonKey.trim() : null;
  if (commonKey !== null && !commonKeys.has(commonKey)) return { ok: false, message: 'Cette culture n’est pas dans le jeu commun.' };
  const damage = read(input.damageCelsius);
  if (damage === undefined) return { ok: true, commonKey, damageCelsius: null };
  if (!Number.isFinite(damage) || damage < FROST_DAMAGE_CELSIUS.minimum || damage > FROST_DAMAGE_CELSIUS.maximum || !onStep(damage, FROST_DAMAGE_CELSIUS.step)) {
    return { ok: false, message: `Le seuil de dégâts va de ${FROST_DAMAGE_CELSIUS.minimum} à +${FROST_DAMAGE_CELSIUS.maximum} °C, par pas de 0,5 °C.` };
  }
  return { ok: true, commonKey, damageCelsius: damage };
}

export type DryingDaysValidation = { ok: true; dryingDays: number | null } | { ok: false; message: string };

/** Valide un délai de séchage saisi ; vide, il retire le délai de l'espèce. */
export function validateDryingDays(value: unknown): DryingDaysValidation {
  const days = read(value);
  if (days === undefined) return { ok: true, dryingDays: null };
  if (!Number.isInteger(days) || days < DRYING_DAYS.minimum || days > DRYING_DAYS.maximum) {
    return { ok: false, message: `Le délai de séchage est un nombre entier de jours, de ${DRYING_DAYS.minimum} à ${DRYING_DAYS.maximum}.` };
  }
  return { ok: true, dryingDays: days };
}

/** `undefined` : rien de saisi ; `NaN` : une saisie qui n'est pas un nombre. */
function read(value: unknown): number | undefined {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return undefined;
  return decimalFromInput(value);
}
