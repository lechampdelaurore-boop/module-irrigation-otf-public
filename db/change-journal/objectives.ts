import type { HydricGoalScope } from '@/lib/domain/water-management';
import { journalDeletion, journalUpdate, latestRevision, type JournalGesture, type JournalLine, type JournalTarget } from './statements';

/**
 * Les lignes du journal des modifications pour les objectifs (amélioration
 * n° 7, PR 5 ; docs/ameliorations-6-2-3-7-contract.md, §5.1 ; D-286) :
 * l'objectif hydrique d'une semaine, posé à la main ou adopté d'une
 * proposition, son retrait, le seuil minimal de besoin et la décision sur le
 * besoin d'une planche.
 *
 * Chaque fonction rend l'instruction que l'écrivain place dans son lot,
 * **avant** son écriture : l'avant se lit sur la ligne d'avant (F715).
 * L'écrivain nomme son sujet en premier argument ; le test de l'inventaire
 * le relit dans son code.
 */

/** La portée d'un objectif hydrique : sa semaine, et la ferme, une parcelle, un jardin ou une planche. */
export type GoalScope = {
  season: number;
  weekStart: string;
  scopeType: HydricGoalScope;
  otfZoneId: string | null;
  otfPlotId: string | null;
  otfBedId: string | null;
};

/**
 * L'objectif en vigueur de cette portée, tel que le module le lit : la
 * révision la plus récente de la semaine, si elle pose un objectif.
 */
function goalTarget(workspaceId: string, scope: GoalScope): JournalTarget {
  const latest = latestRevision(
    'irrigation_hydric_goal_revisions',
    'workspace_id = ? AND season = ? AND week_start = ? AND scope_type = ? AND otf_zone_id IS ? AND otf_plot_id IS ? AND otf_bed_id IS ?',
    [workspaceId, scope.season, scope.weekStart, scope.scopeType, scope.otfZoneId, scope.otfPlotId, scope.otfBedId],
  );
  return { ...latest, where: `${latest.where} AND current.action = 'set' AND current.amount_mm IS NOT NULL` };
}

function goalLine(subject: 'objectif-hydrique' | 'objectif-adopte', gesture: JournalGesture, scope: GoalScope): JournalLine {
  return {
    ...gesture,
    subject,
    objectId: scope.otfBedId ?? scope.otfPlotId ?? scope.otfZoneId,
    context: {
      season: { value: scope.season },
      weekStart: { value: scope.weekStart },
      scopeType: { value: scope.scopeType },
      zoneId: { value: scope.otfZoneId },
      plotId: { value: scope.otfPlotId },
      bedId: { value: scope.otfBedId },
    },
  };
}

/** Un objectif posé ou adopté : « créé » s'il n'y en avait pas, sinon l'ancienne et la nouvelle hauteur ; rien si elle ne change pas. */
export function goalJournal(subject: 'objectif-hydrique' | 'objectif-adopte', gesture: JournalGesture, scope: GoalScope, amountMm: number): D1PreparedStatement {
  return journalUpdate(goalLine(subject, gesture, scope), goalTarget(gesture.workspaceId, scope), [
    { key: 'amountMm', current: 'current.amount_mm', next: amountMm },
  ], 'create');
}

/** Un objectif retiré : « supprimé », avec la hauteur qu'il avait. */
export function clearedGoalJournal(subject: 'objectif-hydrique', gesture: JournalGesture, scope: GoalScope): D1PreparedStatement {
  return journalDeletion(goalLine(subject, gesture, scope), goalTarget(gesture.workspaceId, scope), [
    { key: 'amountMm', current: 'current.amount_mm' },
  ]);
}

/** Le seuil minimal de besoin de la ferme ; sans réglage, il vaut 0 mm. */
export function needThresholdJournal(subject: 'seuil-de-besoin', gesture: JournalGesture, thresholdMm: number): D1PreparedStatement {
  return journalUpdate(
    { ...gesture, subject, objectId: null },
    { table: 'irrigation_need_preferences', where: 'current.workspace_id = ?', params: [gesture.workspaceId] },
    [{ key: 'thresholdMm', current: 'COALESCE(current.minimum_need_threshold_mm, 0)', next: thresholdMm }],
    'defaults',
  );
}

export type BedDecisionJournal = {
  season: number;
  weekStart: string;
  otfZoneId: string;
  otfPlotId: string;
  otfBedId: string;
  priority: string;
  manualOverrideMm: number | null;
  overrideReason: string | null;
};

/** La décision sur le besoin d'une planche pour une semaine ; sans décision, la priorité est normale et rien n'est forcé. */
export function bedDecisionJournal(subject: 'decision-de-planche', gesture: JournalGesture, decision: BedDecisionJournal): D1PreparedStatement {
  return journalUpdate(
    {
      ...gesture,
      subject,
      objectId: decision.otfBedId,
      context: {
        season: { value: decision.season },
        weekStart: { value: decision.weekStart },
        zoneId: { value: decision.otfZoneId },
        plotId: { value: decision.otfPlotId },
      },
    },
    {
      table: 'irrigation_bed_need_decisions',
      where: 'current.workspace_id = ? AND current.season = ? AND current.week_start = ? AND current.otf_bed_id = ?',
      params: [gesture.workspaceId, decision.season, decision.weekStart, decision.otfBedId],
    },
    [
      { key: 'priority', current: "COALESCE(current.priority, 'normal')", next: decision.priority },
      { key: 'manualOverrideMm', current: 'current.manual_override_mm', next: decision.manualOverrideMm },
      { key: 'overrideReason', current: 'current.override_reason', next: decision.overrideReason },
    ],
    'defaults',
  );
}
