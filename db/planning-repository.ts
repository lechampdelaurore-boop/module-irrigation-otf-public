import { db } from './binding';
import type { EquipmentKind } from '@/lib/domain/irrigation-domain';
import type { PlannedIrrigationState } from '@/lib/domain/planned-irrigation';
import type { PlanChanges } from '@/lib/domain/planning/changes';
import type {
  PlanCalculationTrigger,
  PlanCalculationEvent,
  PlanProposal,
  ProposalStatus,
  StoredPlanCalculation,
  StoredProposal,
  StoredWeeklyPlan,
  ValidatedIrrigationStatus,
  WeeklyPlan,
} from '@/lib/domain/planning/contract';
import { DEFAULT_PLANNING_SETTINGS, validatePlanningSettings, type PlanningSettings } from '@/lib/domain/planning/settings';
import { markKeptSuggestions } from '@/lib/domain/planning/suggestions';
import { readPendingPlanEvent } from './planning-events-repository';
import { listKeptSuggestions } from './planning-suggestions-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import { aEcritUneLigne } from './write-result';

/**
 * Le registre du planning (docs/planning-contract.md, « L'objet planifié »,
 * « Les statuts ») : les réglages avec leur journal, et les propositions
 * versionnées par calcul, distinctes de l'historique réel. Un calcul remplace
 * les propositions non décidées du précédent, sauf celles qu'il reproduit à
 * l'identique, qui gardent leur identité (3.7, règle 10) ; une proposition
 * validée ou refusée reste telle quelle, avec son calcul d'origine.
 */

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------

export async function readPlanningSettingsForUser(ownerUserId: string): Promise<PlanningSettings> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return DEFAULT_PLANNING_SETTINGS;
  const row = await db.prepare('SELECT payload FROM irrigation_planning_settings WHERE workspace_id = ?')
    .bind(workspaceId).first<{ payload: string }>();
  if (!row) return DEFAULT_PLANNING_SETTINGS;
  const parsed = parseSettings(row.payload);
  return parsed ?? DEFAULT_PLANNING_SETTINGS;
}

export class PlanningSettingsInvalidError extends Error {
  readonly issues: { path: string; message: string }[];

  constructor(issues: { path: string; message: string }[]) {
    super(`Réglages du planning invalides : ${issues.map((issue) => issue.path).join(', ')}.`);
    this.name = 'PlanningSettingsInvalidError';
    this.issues = issues;
  }
}

export async function savePlanningSettingsForUser(ownerUserId: string, actorUserId: string, settings: unknown): Promise<PlanningSettings> {
  const validation = validatePlanningSettings(settings);
  if (validation.settings === null) throw new PlanningSettingsInvalidError(validation.issues);
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const now = new Date().toISOString();
  const payload = JSON.stringify(validation.settings);
  await db.batch([
    db.prepare(`INSERT INTO irrigation_planning_settings (workspace_id, payload, actor_user_id, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(workspace_id) DO UPDATE SET payload = excluded.payload, actor_user_id = excluded.actor_user_id, updated_at = excluded.updated_at`)
      .bind(workspaceId, payload, actorUserId, now),
    db.prepare('INSERT INTO irrigation_planning_settings_log (id, workspace_id, payload, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), workspaceId, payload, actorUserId, now),
  ]);
  return validation.settings;
}

export async function listPlanningSettingsHistoryForUser(ownerUserId: string): Promise<{ settings: PlanningSettings; actorUserId: string; createdAt: string }[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  // Départage par rowid, l'ordre d'insertion : l'identifiant est tiré au sort (docs/revision-order-contract.md).
  const result = await db.prepare('SELECT payload, actor_user_id, created_at FROM irrigation_planning_settings_log WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC')
    .bind(workspaceId).all<{ payload: string; actor_user_id: string; created_at: string }>();
  return result.results.flatMap((row) => {
    const settings = parseSettings(row.payload);
    return settings ? [{ settings, actorUserId: row.actor_user_id, createdAt: row.created_at }] : [];
  });
}

function parseSettings(payload: string): PlanningSettings | null {
  try {
    const raw = JSON.parse(payload) as Record<string, unknown> | null;
    // R13 est arrivé le 29 septembre 2026 (D-025) : un réglage enregistré avant ne le connaît pas et prend sa valeur de départ, sans réécriture.
    if (raw && typeof raw === 'object' && raw.commandingRateShare === undefined) raw.commandingRateShare = DEFAULT_PLANNING_SETTINGS.commandingRateShare;
    // R14 est arrivé le 31 octobre 2026 (3.7, règle 18) : même lecture, 30 minutes de tolérance au départ.
    if (raw && typeof raw === 'object' && raw.lateToleranceMinutes === undefined) raw.lateToleranceMinutes = DEFAULT_PLANNING_SETTINGS.lateToleranceMinutes;
    const validation = validatePlanningSettings(raw);
    return validation.settings;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Calculs et propositions
// ---------------------------------------------------------------------------

type CalculationRow = {
  id: string;
  season: number;
  week_start: string;
  trigger: PlanCalculationTrigger;
  trigger_event: PlanCalculationEvent | null;
  computed_at: string;
  horizon_start_at: string;
  horizon_end_at: string;
  settings: string;
  summary: string;
};

type ProposalRow = {
  id: string;
  calculation_id: string;
  calculated_at: string;
  local_id: string;
  equipment_id: string;
  equipment_name: string;
  kind: EquipmentKind;
  setting_id: string;
  setting_name: string;
  placement_id: string;
  start_at: string;
  end_at: string;
  duration_seconds: number;
  dose_mm: number;
  volume_cubic_meters: number | null;
  flow_cubic_meters_per_hour: number | null;
  pump_id: string | null;
  pump_origin_id: string | null;
  status: ProposalStatus;
  payload: string;
  validated_event_id: string | null;
  /** Le statut de l'irrigation planifiée qu'une validée est devenue, lu par jointure ; nul sans irrigation retrouvée. */
  irrigation_status: string | null;
  /** L'irrigation par son matériel, lue par jointure pour la règle du retard ; nuls sans irrigation retrouvée. */
  irrigation_equipment_status: string | null;
  irrigation_planned_start_at: string | null;
  irrigation_planned_end_at: string | null;
  irrigation_timer_state: string | null;
  irrigation_timer_started_at: string | null;
  irrigation_remaining_canceled_at: string | null;
  irrigation_canceled_at: string | null;
  replaced_by_calculation_id: string | null;
  decided_at: string | null;
  actor_user_id: string | null;
};

type PreviousProposalRow = { id: string; equipment_id: string; setting_id: string; start_at: string; end_at: string; dose_mm: number };

/** Deux doses qui ne diffèrent que par l'arrondi du nombre à virgule sont la même dose. */
const SAME_DOSE_TOLERANCE_MM = 1e-6;

/**
 * Enregistre un calcul et ses propositions — en un seul lot : soit tout, soit
 * rien. Les propositions encore proposées du calcul précédent de la même
 * semaine sont marquées « remplacées », sauf celles que ce calcul reproduit à
 * l'identique — même matériel, même réglage, même début, même fin, même
 * dose —, qui gardent leur identifiant, restent proposées et passent au
 * nouveau calcul avec sa justification (3.7, règle 10) : une carte restée
 * ouverte pendant un recalcul se valide tant que sa proposition n'a pas
 * changé.
 *
 * Deux calculs croisés — un événement pendant le calcul du matin — ne se
 * détruisent pas (règle 8) : chaque écriture est conditionnée à l'absence
 * d'un calcul plus récent déjà enregistré pour la semaine. Le plus récent
 * fait foi ; l'autre ne laisse rien, et sa relecture rend le plan en vigueur.
 */
export async function savePlanCalculationForUser(
  ownerUserId: string,
  input: {
    season: number; weekStart: string; trigger: PlanCalculationTrigger; triggerEvent?: PlanCalculationEvent | null; actorUserId: string | null; plan: WeeklyPlan;
    /** « Ce qui a changé » depuis le calcul précédent (3.7, règle 25) ; nul au premier calcul de la semaine. */
    changes?: PlanChanges | null;
  },
): Promise<string> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const calculationId = crypto.randomUUID();
  const { plan } = input;
  const summary: StoredPlanCalculation['summary'] = {
    weekEnd: plan.weekEnd, beds: plan.beds, deficit: plan.deficit, budgets: plan.budgets, assumptions: plan.assumptions,
    suggestions: plan.suggestions, overcommittedDays: plan.overcommittedDays, changes: input.changes ?? null,
  };
  const previous = await db.prepare(`SELECT id, equipment_id, setting_id, start_at, end_at, dose_mm FROM irrigation_plan_proposals
    WHERE workspace_id = ? AND season = ? AND week_start = ? AND status = 'proposed'`)
    .bind(workspaceId, input.season, input.weekStart).all<PreviousProposalRow>();
  const kept = reproducedProposals(previous.results, plan.proposals);
  const noNewerCalculation = `NOT EXISTS (SELECT 1 FROM irrigation_plan_calculations newer
    WHERE newer.workspace_id = ? AND newer.season = ? AND newer.week_start = ? AND newer.computed_at > ?)`;
  const guard = [workspaceId, input.season, input.weekStart, plan.computedAt];
  const statements = [
    db.prepare(`INSERT INTO irrigation_plan_calculations
      (id, workspace_id, season, week_start, trigger, trigger_event, computed_at, horizon_start_at, horizon_end_at, settings, summary, actor_user_id)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${noNewerCalculation}`)
      .bind(calculationId, workspaceId, input.season, input.weekStart, input.trigger, input.triggerEvent ?? null, plan.computedAt, plan.horizonStartAt,
        plan.horizonEndAt, JSON.stringify(plan.settings), JSON.stringify(summary), input.actorUserId, ...guard),
    // Toutes les proposées sont d'abord remplacées ; celles que le calcul reproduit sont reprises juste après, dans le même lot.
    db.prepare(`UPDATE irrigation_plan_proposals SET status = 'replaced', replaced_by_calculation_id = ?
      WHERE workspace_id = ? AND season = ? AND week_start = ? AND status = 'proposed' AND ${noNewerCalculation}`)
      .bind(calculationId, workspaceId, input.season, input.weekStart, ...guard),
    ...plan.proposals.map((proposal) => {
      const storedId = kept.get(proposal.id);
      if (storedId) {
        return db.prepare(`UPDATE irrigation_plan_proposals SET status = 'proposed', replaced_by_calculation_id = NULL, calculation_id = ?, local_id = ?,
            equipment_name = ?, setting_name = ?, placement_id = ?, duration_seconds = ?, volume_cubic_meters = ?, flow_cubic_meters_per_hour = ?,
            pump_id = ?, pump_origin_id = ?, payload = ?
          WHERE id = ? AND replaced_by_calculation_id = ?`)
          .bind(calculationId, proposal.id, proposal.equipmentName, proposal.settingName, proposal.placementId, proposal.durationSeconds,
            proposal.volumeCubicMeters, proposal.flowCubicMetersPerHour, proposal.pumpId, proposal.pumpOriginId, JSON.stringify(proposalPayload(proposal)),
            storedId, calculationId);
      }
      return db.prepare(`INSERT INTO irrigation_plan_proposals
        (id, calculation_id, workspace_id, season, week_start, local_id, equipment_id, equipment_name, kind, setting_id, setting_name, placement_id,
         start_at, end_at, duration_seconds, dose_mm, volume_cubic_meters, flow_cubic_meters_per_hour, pump_id, pump_origin_id, status, payload)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ? WHERE ${noNewerCalculation}`)
        .bind(crypto.randomUUID(), calculationId, workspaceId, input.season, input.weekStart, proposal.id, proposal.equipmentId, proposal.equipmentName,
          proposal.kind, proposal.settingId, proposal.settingName, proposal.placementId, proposal.startAt, proposal.endAt, proposal.durationSeconds,
          proposal.doseMm, proposal.volumeCubicMeters, proposal.flowCubicMetersPerHour, proposal.pumpId, proposal.pumpOriginId,
          JSON.stringify(proposalPayload(proposal)), ...guard);
    }),
  ];
  await db.batch(statements);
  return calculationId;
}

/**
 * Les propositions du nouveau calcul qui reproduisent une proposition encore
 * proposée : numéro local du calcul → identifiant du registre à garder.
 * Chaque ancienne ne sert qu'une fois.
 */
function reproducedProposals(previous: readonly PreviousProposalRow[], proposals: readonly PlanProposal[]): Map<string, string> {
  const slotKey = (equipmentId: string, settingId: string, startAt: string, endAt: string) => `${equipmentId}|${settingId}|${startAt}|${endAt}`;
  const available = new Map<string, PreviousProposalRow[]>();
  for (const row of previous) {
    const key = slotKey(row.equipment_id, row.setting_id, row.start_at, row.end_at);
    available.set(key, [...(available.get(key) ?? []), row]);
  }
  const kept = new Map<string, string>();
  for (const proposal of proposals) {
    const candidates = available.get(slotKey(proposal.equipmentId, proposal.settingId, proposal.startAt, proposal.endAt)) ?? [];
    const index = candidates.findIndex((row) => Math.abs(Number(row.dose_mm) - proposal.doseMm) < SAME_DOSE_TOLERANCE_MM);
    if (index === -1) continue;
    kept.set(proposal.id, candidates[index].id);
    candidates.splice(index, 1);
  }
  return kept;
}

const VALIDATED_IRRIGATION_STATUSES: readonly ValidatedIrrigationStatus[] = ['planned', 'partially_completed', 'completed', 'canceled'];

function irrigationStatusOf(value: string | null): ValidatedIrrigationStatus | null {
  return VALIDATED_IRRIGATION_STATUSES.find((status) => status === value) ?? null;
}

function proposalPayload(proposal: PlanProposal) {
  return { applications: proposal.applications, bedApplications: proposal.bedApplications, justification: proposal.justification };
}

/**
 * Le dernier calcul d'une semaine avec ses propositions, les propositions
 * validées ou refusées des calculs antérieurs, et l'événement postérieur dont
 * le recalcul n'a pas abouti, s'il y en a un. Deux calculs à la même
 * milliseconde se départagent par l'ordre d'insertion
 * (docs/revision-order-contract.md) : le dernier enregistré a remplacé les
 * propositions de l'autre.
 */
export async function readLatestPlanForUser(ownerUserId: string, season: number, weekStart: string): Promise<StoredWeeklyPlan | null> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return null;
  const row = await db.prepare(`SELECT id, season, week_start, trigger, trigger_event, computed_at, horizon_start_at, horizon_end_at, settings, summary
    FROM irrigation_plan_calculations WHERE workspace_id = ? AND season = ? AND week_start = ? ORDER BY computed_at DESC, rowid DESC LIMIT 1`)
    .bind(workspaceId, season, weekStart).first<CalculationRow>();
  if (!row) return null;
  const calculation = mapCalculation(row);
  // Jointe à son calcul pour sa date : une proposition décidée se relit avec un calcul plus récent.
  // Jointe à son irrigation pour son état réel : une validée dont l'irrigation est annulée se lit « Annulée »
  // (docs/planning-contract.md, statuts ; recette réelle du 31 octobre 2026).
  const proposals = await db.prepare(`SELECT p.id, p.calculation_id, c.computed_at AS calculated_at, p.local_id, p.equipment_id, p.equipment_name, p.kind,
      p.setting_id, p.setting_name, p.placement_id, p.start_at, p.end_at, p.duration_seconds, p.dose_mm, p.volume_cubic_meters,
      p.flow_cubic_meters_per_hour, p.pump_id, p.pump_origin_id, p.status, p.payload, p.validated_event_id, p.replaced_by_calculation_id,
      p.decided_at, p.actor_user_id, e.status AS irrigation_status,
      ee.status AS irrigation_equipment_status, ee.planned_start_at AS irrigation_planned_start_at, ee.planned_end_at AS irrigation_planned_end_at,
      ee.timer_state AS irrigation_timer_state, ee.timer_started_at AS irrigation_timer_started_at,
      ee.remaining_canceled_at AS irrigation_remaining_canceled_at, ee.canceled_at AS irrigation_canceled_at
    FROM irrigation_plan_proposals p
    JOIN irrigation_plan_calculations c ON c.id = p.calculation_id
    LEFT JOIN irrigation_events e ON e.id = p.validated_event_id
    LEFT JOIN irrigation_event_equipment ee ON ee.id = (SELECT x.id FROM irrigation_event_equipment x WHERE x.event_id = e.id ORDER BY x.rowid LIMIT 1)
    WHERE p.workspace_id = ? AND p.season = ? AND p.week_start = ? AND (p.calculation_id = ? OR p.status IN ('validated', 'refused'))
    ORDER BY p.start_at, p.local_id`)
    .bind(workspaceId, season, weekStart, calculation.id).all<ProposalRow>();
  const [pendingEvent, kept] = await Promise.all([readPendingPlanEvent(workspaceId, season, weekStart, calculation.computedAt), listKeptSuggestions(workspaceId, season)]);
  return { calculation, proposals: proposals.results.map(mapProposal), suggestions: markKeptSuggestions(calculation.summary.suggestions, kept), pendingEvent };
}

/**
 * Décide d'une proposition encore proposée : validée, avec l'irrigation
 * planifiée qu'elle est devenue, ou refusée. Rend `false` si elle n'était
 * plus à décider — déjà décidée, remplacée par un calcul plus récent, ou
 * d'un autre propriétaire.
 */
export async function decidePlanProposalForUser(
  ownerUserId: string,
  input: { proposalId: string; status: 'validated' | 'refused'; validatedEventId: string | null; actorUserId: string },
): Promise<boolean> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return false;
  const result = await db.prepare(`UPDATE irrigation_plan_proposals
    SET status = ?, validated_event_id = ?, decided_at = ?, actor_user_id = ?
    WHERE id = ? AND workspace_id = ? AND status = 'proposed'`)
    .bind(input.status, input.status === 'validated' ? input.validatedEventId : null, new Date().toISOString(), input.actorUserId, input.proposalId, workspaceId)
    .run();
  return aEcritUneLigne(result.meta);
}

function mapCalculation(row: CalculationRow): StoredPlanCalculation {
  const settings = parseSettings(row.settings) ?? DEFAULT_PLANNING_SETTINGS;
  return {
    id: row.id,
    season: Number(row.season),
    weekStart: row.week_start,
    trigger: row.trigger,
    triggerEvent: row.trigger_event ?? null,
    computedAt: row.computed_at,
    horizonStartAt: row.horizon_start_at,
    horizonEndAt: row.horizon_end_at,
    settings,
    // Les calculs antérieurs à la 3.7 n'ont ni suggestion, ni jour dépassé, ni comparaison : des listes vides et rien, sans réécriture.
    summary: { suggestions: [], overcommittedDays: [], changes: null, ...(JSON.parse(row.summary) as Partial<StoredPlanCalculation['summary']>) } as StoredPlanCalculation['summary'],
  };
}

/**
 * L'irrigation d'une validée telle que la règle du retard la lit (audit
 * ergonomique, lot 3, point 5) : ses heures prévues, peut-être modifiées
 * depuis la validation, son minuteur et ses annulations ; nulle sans
 * irrigation retrouvée.
 */
function plannedIrrigationStateOf(row: ProposalRow): PlannedIrrigationState | null {
  const status = irrigationStatusOf(row.irrigation_status);
  const equipmentStatus = irrigationStatusOf(row.irrigation_equipment_status);
  if (!status || !equipmentStatus) return null;
  const timerState = row.irrigation_timer_state === 'running' || row.irrigation_timer_state === 'paused' ? row.irrigation_timer_state : null;
  return {
    status,
    equipment: {
      status: equipmentStatus,
      plannedStartAt: row.irrigation_planned_start_at,
      plannedEndAt: row.irrigation_planned_end_at,
      timerState,
      timerStartedAt: row.irrigation_timer_started_at,
      remainingCanceledAt: row.irrigation_remaining_canceled_at,
      canceledAt: row.irrigation_canceled_at,
    },
  };
}

function mapProposal(row: ProposalRow): StoredProposal {
  const payload = JSON.parse(row.payload) as ReturnType<typeof proposalPayload>;
  return {
    id: row.local_id,
    calculationId: row.calculation_id,
    calculatedAt: row.calculated_at,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    kind: row.kind,
    settingId: row.setting_id,
    settingName: row.setting_name,
    placementId: row.placement_id,
    startAt: row.start_at,
    endAt: row.end_at,
    durationSeconds: Number(row.duration_seconds),
    doseMm: Number(row.dose_mm),
    applications: payload.applications,
    bedApplications: payload.bedApplications,
    volumeCubicMeters: row.volume_cubic_meters === null ? null : Number(row.volume_cubic_meters),
    flowCubicMetersPerHour: row.flow_cubic_meters_per_hour === null ? null : Number(row.flow_cubic_meters_per_hour),
    pumpId: row.pump_id,
    pumpOriginId: row.pump_origin_id,
    justification: payload.justification,
    status: row.status,
    validatedEventId: row.validated_event_id,
    irrigationStatus: row.status === 'validated' ? irrigationStatusOf(row.irrigation_status) : null,
    irrigation: row.status === 'validated' ? plannedIrrigationStateOf(row) : null,
    replacedByCalculationId: row.replaced_by_calculation_id,
    decidedAt: row.decided_at,
    actorUserId: row.actor_user_id,
    storedId: row.id,
  };
}
