/**
 * Module unique de conversion d'unités (contrat Q3, docs/boundaries-contract.md).
 *
 * Toutes les conversions du module passent par ces fonctions ; les facteurs
 * 1000, 3600 et 60000 sont interdits ailleurs par le lint. Aucune fonction
 * n'arrondit, et l'ordre des opérations reproduit celui du code d'origine pour
 * que les résultats en virgule flottante restent strictement identiques.
 *
 * Repères : 1 mm d'eau sur 1 m² = 1 L ; 1 m³ = 1 000 L ; 1 h = 3 600 s ;
 * 1 s = 1 000 ms ; 1 min = 60 000 ms.
 */

export const LITERS_PER_CUBIC_METER = 1000;
/** 1 mm sur 1 m² vaut 1 L : 1 000 mm·m² font 1 m³. */
const MILLIMETER_SQUARE_METERS_PER_CUBIC_METER = 1000;
export const SECONDS_PER_HOUR = 3600;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = 60_000;
export const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
export const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
/** Une heure d'horloge en minutes depuis minuit : 21 h → 1 260. */
export const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;

// Volumes

export function cubicMetersFromLiters(liters: number): number {
  return liters / LITERS_PER_CUBIC_METER;
}

/** Volume apporté par une hauteur d'eau sur une surface : mm × m² / 1 000. */
export function cubicMetersFromMillimeters(millimeters: number, areaSquareMeters: number): number {
  return millimeters * areaSquareMeters / MILLIMETER_SQUARE_METERS_PER_CUBIC_METER;
}

/** Un cumul déjà exprimé en mm·m² (somme de hauteurs pondérées par la surface). */
export function cubicMetersFromMillimeterSquareMeters(millimeterSquareMeters: number): number {
  return millimeterSquareMeters / MILLIMETER_SQUARE_METERS_PER_CUBIC_METER;
}

/** Hauteur d'eau équivalente à un volume réparti sur une surface : m³ × 1 000 / m². */
export function millimetersFromCubicMeters(cubicMeters: number, areaSquareMeters: number): number {
  return cubicMeters * MILLIMETER_SQUARE_METERS_PER_CUBIC_METER / areaSquareMeters;
}

// Débits et durées

/** Hauteur apportée par un débit en mm/h pendant une durée en secondes. */
export function millimetersForRate(rateMmPerHour: number, durationSeconds: number): number {
  return rateMmPerHour * durationSeconds / SECONDS_PER_HOUR;
}

/** Durée en secondes pour atteindre une hauteur à un débit en mm/h. */
export function secondsForMillimeters(millimeters: number, rateMmPerHour: number): number {
  return (millimeters / rateMmPerHour) * SECONDS_PER_HOUR;
}

/** Volume débité en m³ par un débit en m³/h pendant une durée en secondes. */
export function cubicMetersForFlow(flowCubicMetersPerHour: number, durationSeconds: number): number {
  return flowCubicMetersPerHour * durationSeconds / SECONDS_PER_HOUR;
}

export function hoursFromSeconds(seconds: number): number {
  return seconds / SECONDS_PER_HOUR;
}

// Débits rapportés à une surface (calculateur d'irrigation, 3.8 bis)

/**
 * Un débit en litres par heure réparti sur une surface : 1 L sur 1 m² fait
 * 1 mm, donc des L/h par m² sont des mm/h (docs/irrigation-calculator-contract.md,
 * section 5).
 */
export function millimetersPerHourFromLitersPerHour(litersPerHour: number, areaSquareMeters: number): number {
  return litersPerHour / areaSquareMeters;
}

export function litersPerHourFromCubicMetersPerHour(cubicMetersPerHour: number): number {
  return cubicMetersPerHour * LITERS_PER_CUBIC_METER;
}

export function cubicMetersPerHourFromLitersPerHour(litersPerHour: number): number {
  return litersPerHour / LITERS_PER_CUBIC_METER;
}

// Pourcentages

const PERCENT = 100;

/** 80 % → 0,8. */
export function fractionFromPercent(percent: number): number {
  return percent / PERCENT;
}

/** 0,8 → 80 %. */
export function percentFromFraction(fraction: number): number {
  return fraction * PERCENT;
}

// Longueurs

const CENTIMETERS_PER_METER = 100;

/** Une profondeur saisie en centimètres, en mètres : la couche de surface du sol nu (5 ter). */
export function metersFromCentimeters(centimeters: number): number {
  return centimeters / CENTIMETERS_PER_METER;
}

// Temps

export function millisecondsFromSeconds(seconds: number): number {
  return seconds * MILLISECONDS_PER_SECOND;
}

export function secondsFromMilliseconds(milliseconds: number): number {
  return milliseconds / MILLISECONDS_PER_SECOND;
}

export function millisecondsFromMinutes(minutes: number): number {
  return minutes * MILLISECONDS_PER_MINUTE;
}

export function millisecondsFromHours(hours: number): number {
  return hours * MILLISECONDS_PER_HOUR;
}

export function millisecondsFromDays(days: number): number {
  return days * MILLISECONDS_PER_DAY;
}

/**
 * Découpe une durée en heures pleines et minutes restantes, pour les deux
 * champs de saisie que le maraîcher remplit — durée d'irrigation, durée
 * d'arrêt d'une pompe. C'est l'inverse de l'addition qui les recompose.
 */
export function hoursAndMinutesFromSeconds(seconds: number): { hours: number; minutes: number } {
  const total = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const hours = Math.floor(hoursFromSeconds(total));
  const remaining = total - hours * SECONDS_PER_HOUR;
  return { hours, minutes: Math.round(secondsToMinutes(remaining)) };
}

/** Une durée en minutes, sans arrondi : la frise de la page « Aujourd'hui » place les irrigations à la minute. */
export function minutesFromSeconds(seconds: number): number {
  return secondsToMinutes(seconds);
}

function secondsToMinutes(seconds: number): number {
  return millisecondsFromSeconds(seconds) / MILLISECONDS_PER_MINUTE;
}
