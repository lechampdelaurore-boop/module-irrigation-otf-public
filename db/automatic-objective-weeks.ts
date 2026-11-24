import { db } from './binding';
import type { Season } from '@/lib/domain/domain';
import type { RecordedAutomaticObjectiveWeek } from '@/lib/domain/automatic-objective';
import { aEcritUneLigne } from './write-result';

/**
 * Les semaines closes de l'objectif automatique (6 decies, O3,
 * docs/objectif-automatique-contract.md, règle 6 ; D-318, migration 0048) :
 * une ligne par planche et par semaine close, écrite par la tâche du matin,
 * jamais réécrite. Relire la météo, corriger un Kc ou un stade après coup ne
 * change pas une semaine close : ses lecteurs lisent cette ligne.
 */

type WeekRow = {
  week_start: string;
  otf_bed_id: string;
  no_crop_week: number;
  days: string;
};

/** Les semaines closes enregistrées d'une saison, par leur lundi : la tâche du matin n'enregistre que les autres. */
export async function listRecordedAutomaticObjectiveWeeks(workspaceId: string, season: Season): Promise<Set<string>> {
  const result = await db.prepare(
    `SELECT DISTINCT week_start FROM irrigation_automatic_objective_weeks WHERE workspace_id = ? AND season = ?`,
  ).bind(workspaceId, season).all<{ week_start: string }>();
  return new Set(result.results.map((row) => row.week_start));
}

/**
 * Les semaines closes enregistrées d'une saison dont le lundi va de
 * `fromWeek` à `toWeek` : par lundi, puis par planche.
 */
export async function listAutomaticObjectiveWeeksForWorkspace(
  workspaceId: string,
  season: Season,
  fromWeek: string,
  toWeek: string,
): Promise<Map<string, Map<string, RecordedAutomaticObjectiveWeek>>> {
  const result = await db.prepare(
    `SELECT week_start, otf_bed_id, no_crop_week, days
     FROM irrigation_automatic_objective_weeks
     WHERE workspace_id = ? AND season = ? AND week_start BETWEEN ? AND ?`,
  ).bind(workspaceId, season, fromWeek, toWeek).all<WeekRow>();
  const weeks = new Map<string, Map<string, RecordedAutomaticObjectiveWeek>>();
  for (const row of result.results) {
    const beds = weeks.get(row.week_start) ?? new Map<string, RecordedAutomaticObjectiveWeek>();
    beds.set(row.otf_bed_id, {
      noCropWeek: Number(row.no_crop_week) === 1,
      days: JSON.parse(row.days) as RecordedAutomaticObjectiveWeek['days'],
    });
    weeks.set(row.week_start, beds);
  }
  return weeks;
}

/**
 * Enregistre une semaine close d'une ferme, d'un seul lot : une ligne par
 * planche. Une ligne déjà là n'est jamais réécrite (règle 6). Rend le nombre
 * de lignes écrites.
 */
export async function saveAutomaticObjectiveWeekForWorkspace(
  workspaceId: string,
  season: Season,
  weekStart: string,
  beds: readonly { bedId: string; week: RecordedAutomaticObjectiveWeek }[],
  now: Date,
): Promise<number> {
  if (beds.length === 0) return 0;
  const recordedAt = now.toISOString();
  const results = await db.batch(beds.map(({ bedId, week }) => db.prepare(
    `INSERT INTO irrigation_automatic_objective_weeks (workspace_id, season, week_start, otf_bed_id, no_crop_week, days, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id, season, week_start, otf_bed_id) DO NOTHING`,
  ).bind(workspaceId, season, weekStart, bedId, week.noCropWeek ? 1 : 0, JSON.stringify(week.days), recordedAt)));
  return results.filter((result) => aEcritUneLigne(result.meta)).length;
}
