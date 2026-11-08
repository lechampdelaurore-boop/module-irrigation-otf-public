import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, isValidDateKey } from '../water-management.ts';
import type { SurfaceState } from './bare-soil.ts';
import type { SoilObservation, SoilReserveDay } from './gauge.ts';
import { millisecondsFromMinutes } from '../units.ts';
import { PERCENT } from './soil.ts';

/**
 * Ce que la persistance enregistre de la réserve du sol
 * (docs/soil-reserve-contract.md, « Découpage et preuve de fin », PR 2) : ce
 * qui empêche d'enregistrer une observation ou un état de surface, et la
 * ligne de l'état du jour d'une planche. Les dépôts de `db/` appellent ces
 * règles ; ils n'en ajoutent pas.
 */

/**
 * L'avance tolérée d'une heure d'observation sur l'heure du serveur :
 * « maintenant » est l'heure de l'appareil, qui peut avancer de quelques
 * secondes sur celle du serveur, comme pour la date d'une pose (point ouvert
 * 47 ; recette réelle de la 5 ter, 6 novembre 2026).
 */
const OBSERVATION_CLOCK_TOLERANCE_MS = millisecondsFromMinutes(2);

/**
 * L'heure d'observation à contrôler puis à enregistrer : une heure qui ne
 * dépasse l'heure du serveur que de deux minutes au plus vaut maintenant, à
 * l'heure du serveur ; toute autre reste telle quelle, et
 * `soilObservationProblems` la juge.
 */
export function soilObservationTimeAt(value: string, now: Date): string {
  const ahead = Date.parse(value) - now.getTime();
  return ahead > 0 && ahead <= OBSERVATION_CLOCK_TOLERANCE_MS ? now.toISOString() : value;
}

/**
 * Ce qui empêche d'enregistrer un réglage du curseur : un % hors de 0 à 100,
 * une heure illisible, dans le futur, ou plus tôt que la veille (« L'heure est
 * celle du geste par défaut ; elle peut être reportée au jour même ou à la
 * veille, jamais plus tôt, jamais dans le futur »).
 */
export function soilObservationProblems(observation: Pick<SoilObservation, 'percent' | 'observedAt'>, now: Date): string[] {
  const problems: string[] = [];
  if (!(Number.isFinite(observation.percent) && observation.percent >= 0 && observation.percent <= PERCENT)) {
    problems.push(`État observé invalide : de 0 à ${PERCENT} % du plein.`);
  }
  const observedAt = Date.parse(observation.observedAt);
  if (!Number.isFinite(observedAt)) {
    problems.push("Heure de l'observation illisible.");
    return problems;
  }
  if (observedAt > now.getTime()) problems.push("L'heure de l'observation est dans le futur.");
  const yesterday = addDaysToDateKey(dateKeyInTimeZone(now, FARM_TIME_ZONE), -1);
  if (dateKeyInTimeZone(new Date(observedAt), FARM_TIME_ZONE) < yesterday) {
    problems.push("Une observation se reporte au jour même ou à la veille, jamais plus tôt.");
  }
  return problems;
}

const SURFACE_STATES: ReadonlySet<string> = new Set<SurfaceState>([
  'bare',
  'impermeable-tarp',
  'permeable-tarp',
  'mulched',
  'green-manure-emergence',
  'green-manure-partial',
  'green-manure-full',
  'green-manure-destroyed',
  'grass',
]);

/** Ce qui empêche d'enregistrer l'état de surface déclaré d'une planche. */
export function surfaceDeclarationProblems(declaration: { bedId: string; date: string; state: string }): string[] {
  const problems: string[] = [];
  if (declaration.bedId.trim() === '') problems.push('Planche manquante.');
  if (!isValidDateKey(declaration.date)) problems.push(`Jour de l'état de surface invalide : ${declaration.date}.`);
  if (!SURFACE_STATES.has(declaration.state)) problems.push(`État de surface inconnu : ${declaration.state}.`);
  return problems;
}

/**
 * La ligne enregistrée de l'état du jour d'une planche : le mode, l'état de
 * surface, la profondeur de référence, la capacité et le seuil, l'état au
 * début et à la fin du jour, l'épuisement de surface De et la réserve
 * profonde du sol nu, les apports, la consommation (l'évaporation sur une
 * planche sans culture), le drainage, le départ et la raison d'une jauge
 * inconnue.
 */
export type SoilDayRecord = {
  bedId: string;
  date: string;
  mode: SoilReserveDay['mode'];
  surfaceState: SurfaceState | null;
  depthM: number | null;
  capacityMm: number | null;
  thresholdMm: number | null;
  startMm: number | null;
  stateMm: number | null;
  depletionMm: number | null;
  deepMm: number | null;
  rainMm: number | null;
  irrigationMm: number;
  consumptionMm: number | null;
  drainageMm: number;
  restart: SoilReserveDay['restart'];
  unknownKind: NonNullable<SoilReserveDay['unknown']>['kind'] | null;
  /** Le jour où la donnée a manqué, pour une jauge inconnue sur un trou de données. */
  unknownDate: string | null;
};

/** La ligne d'un jour passé ; `null` pour un jour prévu, qui ne s'enregistre pas. */
export function soilDayRecord(bedId: string, day: SoilReserveDay): SoilDayRecord | null {
  if (day.nature !== 'estimated') return null;
  const unknown = day.unknown;
  return {
    bedId,
    date: day.date,
    mode: day.mode,
    surfaceState: day.surfaceState,
    depthM: day.depthM,
    capacityMm: day.capacityMm,
    thresholdMm: day.thresholdMm,
    startMm: day.startMm,
    stateMm: day.stateMm,
    depletionMm: day.bare?.depletionMm ?? null,
    deepMm: day.bare?.deepMm ?? null,
    rainMm: day.rainMm,
    irrigationMm: day.irrigationMm,
    consumptionMm: day.consumptionMm,
    drainageMm: day.drainageMm,
    restart: day.restart,
    unknownKind: unknown?.kind ?? null,
    unknownDate: unknown !== null && 'date' in unknown ? unknown.date : null,
  };
}
