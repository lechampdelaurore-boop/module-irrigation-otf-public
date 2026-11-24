import { listAutomaticObjectiveRevisionsForUser, listWorkspacesWithAutomaticObjective } from '@/db/automatic-objective-repository';
import { listRecordedAutomaticObjectiveWeeks, saveAutomaticObjectiveWeekForWorkspace } from '@/db/automatic-objective-weeks';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import { automaticObjectiveClosedPeriod, automaticObjectiveRecordSeasons, automaticObjectiveWeekRecord } from '../domain/automatic-objective';
import { dateKeyInTimeZone, FARM_TIME_ZONE } from '../domain/water-management';
import { readAutomaticObjectiveSourceForUser } from './automatic-objective-source';
import { listFarmsWithFeature } from './feature-selection-service';
import { getIrrigationSnapshot } from './irrigation-service';

/**
 * Les semaines closes de l'objectif automatique, enregistrées chaque matin
 * (6 decies, O3, docs/objectif-automatique-contract.md, règle 6 et section
 * 6 ; D-318) : après la météo du matin, chaque semaine close où le réglage
 * de la ferme était allumé au moins un jour est enregistrée, une ligne par
 * planche de la saison, avec ses jours tels qu'`objectiveForBed` les lit ce
 * matin-là, et la nature de leur ET0. Une semaine enregistrée ne l'est plus
 * jamais : relire la météo, corriger un Kc ou un stade ne la change pas.
 *
 * Une semaine close que la tâche n'a pas encore enregistrée (le lundi avant
 * la tâche, un matin manqué) est rattrapée au matin suivant ; d'ici là elle
 * se relit et l'historique la dit provisoire. Au plus huit semaines par
 * ferme et par matin, les plus anciennes d'abord : le reste suit les matins
 * d'après (F785).
 */

const WEEKS_PER_MORNING = 8;

/**
 * Enregistre les semaines closes de la ferme qui ne le sont pas encore ; rend
 * leur nombre. Rien n'est lu d'Ouvre ta ferme quand aucune ne manque.
 */
export async function recordAutomaticObjectiveWeeksForUser(input: {
  ownerUserId: string;
  now: Date;
  /** L'instantané d'une saison ; par défaut, celui du matin. */
  readSnapshot?: (season: number) => Promise<IrrigationSnapshot>;
}): Promise<number> {
  const workspaceId = await findWorkspaceIdForUser(input.ownerUserId);
  if (workspaceId === null) return 0;
  const readSnapshot = input.readSnapshot
    ?? ((season: number) => getIrrigationSnapshot(input.ownerUserId, { season, context: 'morning' }));
  const today = dateKeyInTimeZone(input.now, FARM_TIME_ZONE);
  const settings = await listAutomaticObjectiveRevisionsForUser(input.ownerUserId);
  let budget = WEEKS_PER_MORNING;
  let recordedWeeks = 0;
  for (const season of automaticObjectiveRecordSeasons(today)) {
    const closed = automaticObjectiveClosedPeriod(settings, season, today);
    if (closed.length === 0 || budget === 0) continue;
    const recorded = await listRecordedAutomaticObjectiveWeeks(workspaceId, season);
    const missing = closed.filter((week) => !recorded.has(week.weekDates[0])).slice(0, budget);
    if (missing.length === 0) continue;
    budget -= missing.length;
    const snapshot = await readSnapshot(season);
    const beds = snapshot.beds.filter((bed) => bed.seasons.includes(season));
    const lastWeek = missing[missing.length - 1];
    const source = await readAutomaticObjectiveSourceForUser({
      ownerUserId: input.ownerUserId,
      season,
      snapshot,
      from: missing[0].days[0],
      to: lastWeek.days[lastWeek.days.length - 1],
      now: input.now,
    });
    if (source === null) continue;
    for (const week of missing) {
      const rows = beds.map((bed) => ({ bedId: bed.id, week: automaticObjectiveWeekRecord(source.inputFor(bed), bed, week) }));
      if (await saveAutomaticObjectiveWeekForWorkspace(workspaceId, season, week.weekDates[0], rows, input.now) > 0) recordedWeeks += 1;
    }
  }
  return recordedWeeks;
}

/**
 * Après la météo et l'ETM du matin, pour chaque ferme qui a coché
 * « Objectifs et besoins » et allumé un jour le réglage ; un échec d'une
 * ferme n'arrête pas les autres. Une seule lecture quand aucune ferme ne l'a
 * allumé.
 */
export async function recordAutomaticObjectiveWeeksForAllWorkspaces({
  now = new Date(),
  log = (line: string) => console.error(line),
  readSnapshot,
}: {
  now?: Date;
  log?: (line: string) => void;
  /** L'instantané d'une ferme pour une saison ; par défaut, celui du matin. */
  readSnapshot?: (ownerUserId: string, season: number) => Promise<IrrigationSnapshot>;
} = {}): Promise<{ recorded: number; failed: number }> {
  let recorded = 0;
  let failed = 0;
  const enabledOnce = await listWorkspacesWithAutomaticObjective();
  if (enabledOnce.size === 0) return { recorded, failed };
  // Seules les fermes qui ont coché « Objectifs et besoins » font tourner ce qui touche à l'objectif (3.8, R1).
  for (const { workspaceId, ownerUserId } of await listFarmsWithFeature('besoins')) {
    if (!enabledOnce.has(workspaceId)) continue;
    try {
      await recordAutomaticObjectiveWeeksForUser({ ownerUserId, now, readSnapshot: readSnapshot && ((season) => readSnapshot(ownerUserId, season)) });
      recorded += 1;
    } catch (error) {
      failed += 1;
      log(JSON.stringify({ event: 'automatic_objective_week_record_failed', error: error instanceof Error ? error.message : 'unknown', failedAt: now.toISOString() }));
    }
  }
  return { recorded, failed };
}
