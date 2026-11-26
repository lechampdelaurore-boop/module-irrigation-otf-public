import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MINUTES_PER_HOUR, megajoulesPerSquareMeterPerHourFromWattsPerSquareMeter } from '../units.ts';

/**
 * L'ET0 heure par heure calculée par le module (docs/et0-horaire-contract.md,
 * § 2 choix 3, source `computed-hourly` ; D-349) : FAO-56 Penman-Monteith au
 * pas horaire (équation 53), à partir des heures prévues du fournisseur de la
 * ferme (température, point de rosée, vent, rayonnement). Elle ne sert qu'à la
 * **forme** de la journée : le total du jour reste celui du fournisseur, ou
 * celui que le module calcule au jour (D-340, choix 1).
 *
 * Les équations et leurs numéros sont ceux de FAO-56 (Allen et al., 1998) :
 * 7 (pression), 8 (constante psychrométrique), 11 (pression de vapeur
 * saturante), 13 (pente), 23 et 24 (distance relative, déclinaison), 25
 * (angle horaire au coucher), 28 et 29 à 33 (rayonnement extraterrestre
 * horaire et heure solaire), 37 (ciel clair), 38 (rayonnement net de courte
 * longueur d'onde), 39 (rayonnement net de grande longueur d'onde, constante
 * de Stefan-Boltzmann à l'heure), 45 et 46 (flux de chaleur du sol), 47
 * (vent ramené à 2 m), 53 (ET0 horaire).
 */

/** Une heure prévue du fournisseur, telle que l'adaptateur la lit. Une valeur absente reste `null` (D-003). */
export type ForecastHourInput = {
  /** Le début de l'heure, en millisecondes depuis l'époque UNIX. */
  startsAtMs: number;
  temperatureCelsius: number | null;
  dewPointCelsius: number | null;
  /** Le vent moyen à 10 m, en km/h, comme le donne le fournisseur. */
  windSpeedAtTenMetersKilometersPerHour: number | null;
  /** Le rayonnement solaire moyen de l'heure, en W/m². */
  solarRadiationWattsPerSquareMeter: number | null;
};

const RADIANS_PER_DEGREE = Math.PI / 180;
const SOLAR_CONSTANT_MJ_PER_SQUARE_METER_PER_MINUTE = 0.0820;
const HOURS_PER_DAY_FAO = 24;
const DAYS_PER_YEAR_FAO = 365;
/** Stefan-Boltzmann à l'heure : 4,903 × 10⁻⁹ / 24 MJ K⁻⁴ m⁻² h⁻¹ (équation 39, note de l'équation 53). */
const STEFAN_BOLTZMANN_MJ_PER_HOUR = 2.043e-10;
const KELVIN_OFFSET = 273.16;
const ALBEDO = 0.23;
/** Le rapport Rs/Rso est borné à [0,3 ; 1] (équation 39), comme le calcul du jour du module. */
const MINIMUM_RELATIVE_SHORTWAVE = 0.3;
const MAXIMUM_RELATIVE_SHORTWAVE = 1;
/** Flux de chaleur du sol, fraction du rayonnement net : 0,1 le jour, 0,5 la nuit (équations 45 et 46). */
const SOIL_HEAT_FLUX_DAY = 0.1;
const SOIL_HEAT_FLUX_NIGHT = 0.5;
/** Vent mesuré à 10 m ramené à 2 m (équation 47). */
const WIND_MEASURED_AT_METERS = 10;
const METERS_PER_SECOND_PER_KILOMETER_PER_HOUR = 1 / 3.6;
/** Une heure : de ω − π/24 à ω + π/24 (équation 28). */
const HALF_HOUR_ANGLE = Math.PI / HOURS_PER_DAY_FAO;

/** e°(T), kPa (équation 11). */
export function saturationVaporPressureKpa(temperatureCelsius: number): number {
  return 0.6108 * Math.exp(17.27 * temperatureCelsius / (temperatureCelsius + 237.3));
}

/** Le vent à 2 m, en m/s, à partir du vent à 10 m en km/h (équation 47). */
function windAtTwoMetersFromTenMetersKilometersPerHour(kilometersPerHour: number): number {
  return kilometersPerHour * METERS_PER_SECOND_PER_KILOMETER_PER_HOUR * 4.87 / Math.log(67.8 * WIND_MEASURED_AT_METERS - 5.42);
}

/** Le rang du jour dans l'année, au jour UTC de l'instant (1 au 1er janvier). */
function utcDayOfYear(instantMs: number): number {
  const date = new Date(instantMs);
  return Math.round((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0))
    / MILLISECONDS_PER_DAY);
}

/**
 * Le rayonnement extraterrestre d'une heure, en MJ/m² (équations 28 à 33) :
 * l'heure solaire au milieu de l'heure vient de l'instant UTC, de la
 * longitude (positive à l'est) et de la correction saisonnière ; les bornes
 * sont ramenées au lever et au coucher ; 0 quand le soleil est couché.
 */
export function hourlyExtraterrestrialRadiationMj(startsAtMs: number, location: { latitude: number; longitude: number }): number {
  const latitude = location.latitude * RADIANS_PER_DEGREE;
  const day = utcDayOfYear(startsAtMs);
  const inverseRelativeDistance = 1 + 0.033 * Math.cos(2 * Math.PI * day / DAYS_PER_YEAR_FAO);
  const declination = 0.409 * Math.sin(2 * Math.PI * day / DAYS_PER_YEAR_FAO - 1.39);
  const sunsetHourAngle = Math.acos(Math.min(1, Math.max(-1, -Math.tan(latitude) * Math.tan(declination))));
  const b = 2 * Math.PI * (day - 81) / 364;
  const seasonalCorrectionHours = 0.1645 * Math.sin(2 * b) - 0.1255 * Math.cos(b) - 0.025 * Math.sin(b);
  const middle = new Date(startsAtMs + MILLISECONDS_PER_HOUR / 2);
  const utcHours = middle.getUTCHours() + middle.getUTCMinutes() / MINUTES_PER_HOUR;
  const solarHours = utcHours + location.longitude / 15 + seasonalCorrectionHours;
  let hourAngle = Math.PI / 12 * (solarHours - 12);
  if (hourAngle > Math.PI) hourAngle -= 2 * Math.PI;
  if (hourAngle < -Math.PI) hourAngle += 2 * Math.PI;
  const start = Math.max(-sunsetHourAngle, hourAngle - HALF_HOUR_ANGLE);
  const end = Math.min(sunsetHourAngle, hourAngle + HALF_HOUR_ANGLE);
  if (end <= start) return 0;
  return 12 * MINUTES_PER_HOUR / Math.PI * SOLAR_CONSTANT_MJ_PER_SQUARE_METER_PER_MINUTE * inverseRelativeDistance
    * ((end - start) * Math.sin(latitude) * Math.sin(declination)
      + Math.cos(latitude) * Math.cos(declination) * (Math.sin(end) - Math.sin(start)));
}

/**
 * L'ET0 d'une heure, en mm (équation 53), à partir du rayonnement net de
 * l'heure déjà calculé. Le flux de chaleur du sol vaut 0,1 Rn le jour et
 * 0,5 Rn la nuit. Le résultat peut être légèrement négatif la nuit : la
 * forme de la journée le ramène à 0 (D-348, F1031).
 */
export function fao56HourlyEt0Mm(input: {
  temperatureCelsius: number;
  actualVaporPressureKpa: number;
  windAtTwoMetersMetersPerSecond: number;
  netRadiationMj: number;
  elevationMeters: number;
  daytime: boolean;
}): number {
  const temperature = input.temperatureCelsius;
  const saturation = saturationVaporPressureKpa(temperature);
  const slope = 4098 * saturation / (temperature + 237.3) ** 2;
  const pressure = 101.3 * ((293 - 0.0065 * input.elevationMeters) / 293) ** 5.26;
  const psychrometric = 0.000665 * pressure;
  const soilHeatFlux = (input.daytime ? SOIL_HEAT_FLUX_DAY : SOIL_HEAT_FLUX_NIGHT) * input.netRadiationMj;
  const wind = input.windAtTwoMetersMetersPerSecond;
  const numerator = 0.408 * slope * (input.netRadiationMj - soilHeatFlux)
    + psychrometric * 37 / (temperature + 273) * wind * Math.max(0, saturation - input.actualVaporPressureKpa);
  return numerator / (slope + psychrometric * (1 + 0.34 * wind));
}

function clampRelativeShortwave(ratio: number): number {
  return Math.min(MAXIMUM_RELATIVE_SHORTWAVE, Math.max(MINIMUM_RELATIVE_SHORTWAVE, ratio));
}

/**
 * L'ET0 de chaque heure prévue d'une journée, dans l'ordre donné, en mm ;
 * `null` pour une heure dont une valeur manque (D-003), jamais 0.
 *
 * Le rapport Rs/Rso d'une heure de nuit, où Rso est nul, prend le rapport
 * des heures de jour de la même journée (somme de Rs sur somme de Rso) :
 * FAO-56 conseille le rapport de la fin d'après-midi ; une journée n'en a
 * qu'un (D-349, F1038). Sans heure de jour lisible, les heures de nuit sont
 * absentes.
 */
export function computedHourlyEt0Mm(
  hours: readonly ForecastHourInput[],
  location: { latitude: number; longitude: number; elevationMeters: number },
): (number | null)[] {
  const clearSkyFactor = 0.75 + 0.00002 * location.elevationMeters;
  const prepared = hours.map((hour) => {
    const clearSky = clearSkyFactor * hourlyExtraterrestrialRadiationMj(hour.startsAtMs, location);
    const solar = hour.solarRadiationWattsPerSquareMeter === null || hour.solarRadiationWattsPerSquareMeter < 0
      ? null
      : megajoulesPerSquareMeterPerHourFromWattsPerSquareMeter(hour.solarRadiationWattsPerSquareMeter);
    return { hour, clearSky, solar };
  });
  const daytime = prepared.filter((item) => item.clearSky > 0);
  const dayRatio = daytime.length > 0 && daytime.every((item) => item.solar !== null)
    ? clampRelativeShortwave(daytime.reduce((total, item) => total + (item.solar ?? 0), 0)
      / daytime.reduce((total, item) => total + item.clearSky, 0))
    : null;
  return prepared.map(({ hour, clearSky, solar }) => {
    const { temperatureCelsius: temperature, dewPointCelsius: dewPoint, windSpeedAtTenMetersKilometersPerHour: wind } = hour;
    if (temperature === null || dewPoint === null || wind === null || wind < 0 || solar === null) return null;
    const isDay = clearSky > 0;
    const ratio = isDay ? clampRelativeShortwave(solar / clearSky) : dayRatio;
    if (ratio === null) return null;
    const actualVaporPressure = saturationVaporPressureKpa(dewPoint);
    const netShortwave = (1 - ALBEDO) * solar;
    const netLongwave = STEFAN_BOLTZMANN_MJ_PER_HOUR * (temperature + KELVIN_OFFSET) ** 4
      * (0.34 - 0.14 * Math.sqrt(Math.max(0, actualVaporPressure)))
      * (1.35 * ratio - 0.35);
    const value = fao56HourlyEt0Mm({
      temperatureCelsius: temperature,
      actualVaporPressureKpa: actualVaporPressure,
      windAtTwoMetersMetersPerSecond: windAtTwoMetersFromTenMetersKilometersPerHour(wind),
      netRadiationMj: netShortwave - netLongwave,
      elevationMeters: location.elevationMeters,
      daytime: isDay,
    });
    return Number.isFinite(value) ? value : null;
  });
}
