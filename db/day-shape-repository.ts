import { db } from './binding';
import { HOURLY_ET0_NATURES, type RecordedDayShape } from '@/lib/domain/weather/hourly-et0';

/**
 * La forme de la journée de l'ET0 horaire (docs/et0-horaire-contract.md, § 5 ;
 * D-349 ; migration 0054) : par lieu, jour et source, J0 à J+2.
 *
 * Une lecture plus récente remplace la forme d'un jour et d'une source
 * (`ON CONFLICT … DO UPDATE`) ; un jour qu'une lecture ne donne pas garde
 * sa forme d'avant, dite « ancienne » par son heure de lecture. Rien ici
 * n'efface : la purge des 8 jours passe par le plan de conservation
 * (`db/retention-plan.ts`). Aucune ligne n'est d'une ferme : le lieu est
 * celui de la lecture partagée.
 */

export type DayShapeWrite = {
  placeKey: string;
  rows: readonly RecordedDayShape[];
  source: string;
  fetchedAt: string;
};

export type DayShapeRecord = RecordedDayShape & { source: string; fetchedAt: string };

/** Écrit les formes d'une lecture ; rend le nombre de lignes écrites. */
export async function writeDayShapes(input: DayShapeWrite): Promise<number> {
  if (input.rows.length === 0) return 0;
  const results = await db.batch(input.rows.map((row) => db.prepare(
    `INSERT INTO irrigation_weather_day_shapes (place_key, day, source, nature, hour_count, shares, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(place_key, day, source) DO UPDATE SET
       nature = excluded.nature, hour_count = excluded.hour_count,
       shares = excluded.shares, fetched_at = excluded.fetched_at`,
  ).bind(input.placeKey, row.date, input.source, row.nature, row.shares.length, JSON.stringify(row.shares), input.fetchedAt)));
  return results.reduce((written, result) => written + Number(result.meta.changes ?? 0), 0);
}

/**
 * Les formes écrites d'un lieu pour des jours et une source : celle de la
 * ligne du jour de la ferme, jamais une autre (contrat, § 9). Une ligne
 * illisible est ignorée : l'écran prendra la forme théorique.
 */
export async function listDayShapes(placeKey: string, source: string, days: readonly string[]): Promise<DayShapeRecord[]> {
  if (days.length === 0) return [];
  const result = await db.prepare(
    `SELECT day, source, nature, shares, fetched_at
     FROM irrigation_weather_day_shapes
     WHERE place_key = ? AND source = ? AND day IN (${days.map(() => '?').join(', ')})
     ORDER BY day`,
  ).bind(placeKey, source, ...days).all<DayShapeRow>();
  return result.results.flatMap(readableDayShape);
}

/**
 * Les formes écrites d'un lieu pour un jour, toutes sources (HR3, D-350) :
 * « Aujourd'hui » les lit en même temps que l'ET0 du jour, puis garde celle
 * de la source de cette ET0 (`lib/domain/today/day-curve.ts`), sans attendre
 * l'une pour lire l'autre.
 */
export async function listDayShapesOfDay(placeKey: string, day: string): Promise<DayShapeRecord[]> {
  const result = await db.prepare(
    `SELECT day, source, nature, shares, fetched_at
     FROM irrigation_weather_day_shapes
     WHERE place_key = ? AND day = ?
     ORDER BY source`,
  ).bind(placeKey, day).all<DayShapeRow>();
  return result.results.flatMap(readableDayShape);
}

type DayShapeRow = { day: string; source: string; nature: string; shares: string; fetched_at: string };

function readableDayShape(row: DayShapeRow): DayShapeRecord[] {
  const nature = HOURLY_ET0_NATURES.find((known) => known === row.nature);
  let shares: unknown;
  try {
    shares = JSON.parse(row.shares);
  } catch {
    return [];
  }
  if (!nature || nature === 'theoretical' || !Array.isArray(shares) || !shares.every((share) => typeof share === 'number')) return [];
  return [{ date: row.day, nature, shares: shares as number[], source: row.source, fetchedAt: row.fetched_at }];
}
