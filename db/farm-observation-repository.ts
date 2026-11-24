import { db } from './binding';
import { OTF_CALL_OUTCOMES, type OtfCallCounts, type OtfCallOutcome } from '@/lib/domain/otf/call-outcome';
import { emptyFarmObservation, type FarmConnectionState, type FarmObservationRecord } from '@/lib/domain/operations/farm-observation';
import { EMPTY_FARM_ALERT_DELIVERIES, type FarmAlertDeliveries, type UndeliveredAlertCounts } from '@/lib/domain/operations/undelivered-alerts';

/**
 * Ce que la page d'état de l'exploitant lit de chaque ferme (4.5, PR 2 ;
 * docs/tranche-4-contract.md, F564, F614 à F616), en un seul lot de lectures :
 * des identifiants de ferme, des états, des heures et des nombres. Aucun nom
 * de ferme, aucune personne, aucun contenu d'une ferme.
 *
 * Une ferme, c'est un identifiant d'Ouvre ta ferme porté par au moins un
 * espace, un raccordement, ou le compteur de ses appels ; la clé du compteur
 * des appels faits avant que la ferme de la clé soit connue (`GET /me`) est
 * gardée telle quelle, à part.
 */

type CountRow = { pace_key: string; outcome: string; day_calls: number; week_calls: number };

function isOutcome(value: string): value is OtfCallOutcome {
  return (OTF_CALL_OUTCOMES as readonly string[]).includes(value);
}

export async function readFarmObservations({ parisDay, dayStartMs, weekStartMs, alerts }: {
  /** Le jour de Paris des appels du jour (« 2026-11-20 »). */
  parisDay: string;
  /** La première heure pleine comptée dans les 24 heures. */
  dayStartMs: number;
  /** La première heure pleine comptée dans les 7 jours. */
  weekStartMs: number;
  /**
   * Les alertes non délivrées (C2, D-304) : depuis quand on compte les
   * 24 heures et les 7 jours, et avant quand une alerte prise sans résultat
   * est interrompue (instants ISO, comme `sent_at`).
   */
  alerts: AlertWindows;
}): Promise<FarmObservationRecord[]> {
  const [spaces, connections, daily, outcomes, reads, weather, mornings, deliveries] = await db.batch([
    db.prepare('SELECT otf_farm_id AS farm, COUNT(*) AS spaces FROM irrigation_workspaces WHERE otf_farm_id IS NOT NULL GROUP BY otf_farm_id'),
    db.prepare('SELECT otf_farm_id AS farm, state FROM otf_farm_connections'),
    db.prepare('SELECT pace_key AS farm, calls FROM otf_daily_calls WHERE paris_day = ?').bind(parisDay),
    db.prepare(
      `SELECT pace_key, outcome,
              SUM(CASE WHEN hour_start_ms >= ? THEN calls ELSE 0 END) AS day_calls,
              SUM(calls) AS week_calls
       FROM otf_call_outcomes WHERE hour_start_ms >= ? GROUP BY pace_key, outcome`,
    ).bind(dayStartMs, weekStartMs),
    db.prepare('SELECT pace_key AS farm, last_complete_at AS at FROM otf_farm_reads WHERE last_complete_at IS NOT NULL'),
    db.prepare(
      `SELECT workspace.otf_farm_id AS farm, MAX(weather.last_automatic_refresh_success_at) AS at
       FROM irrigation_weather_preferences AS weather
       JOIN irrigation_workspaces AS workspace ON workspace.id = weather.workspace_id
       WHERE workspace.otf_farm_id IS NOT NULL GROUP BY workspace.otf_farm_id`,
    ),
    db.prepare(
      `SELECT workspace.otf_farm_id AS farm, MAX(calculation.computed_at) AS at
       FROM irrigation_plan_calculations AS calculation
       JOIN irrigation_workspaces AS workspace ON workspace.id = calculation.workspace_id
       WHERE calculation.trigger = 'daily' AND workspace.otf_farm_id IS NOT NULL GROUP BY workspace.otf_farm_id`,
    ),
    undeliveredAlertsStatement(alerts),
  ]);

  const records = new Map<string, FarmObservationRecord>();
  const recordOf = (farmKey: string): FarmObservationRecord => {
    const known = records.get(farmKey);
    if (known) return known;
    const created = emptyFarmObservation(farmKey);
    records.set(farmKey, created);
    return created;
  };

  for (const row of spaces.results as { farm: string; spaces: number }[]) recordOf(row.farm).spaces = Number(row.spaces);
  for (const row of connections.results as { farm: string; state: FarmConnectionState }[]) recordOf(row.farm).connection = row.state;
  for (const row of daily.results as { farm: string; calls: number }[]) recordOf(row.farm).callsToday = Number(row.calls);
  for (const row of outcomes.results as CountRow[]) {
    if (!isOutcome(row.outcome)) continue;
    const record = recordOf(row.pace_key);
    addCount(record.outcomes24h, row.outcome, Number(row.day_calls));
    addCount(record.outcomes7d, row.outcome, Number(row.week_calls));
  }
  for (const row of reads.results as { farm: string; at: string }[]) recordOf(row.farm).lastCompleteReadAt = row.at;
  for (const row of weather.results as { farm: string; at: string | null }[]) recordOf(row.farm).lastWeatherAt = row.at;
  for (const row of mornings.results as { farm: string; at: string | null }[]) recordOf(row.farm).lastMorningPlanAt = row.at;
  for (const [farm, alertDeliveries] of farmAlertDeliveries(deliveries.results as DeliveryRow[])) recordOf(farm).alertDeliveries = alertDeliveries;
  return [...records.values()];
}

type AlertWindows = { dayStart: string; weekStart: string; interruptedBefore: string };
type DeliveryRow = { farm: string; status: string; day_count: number; week_count: number };

/**
 * Les alertes non délivrées de chaque ferme, seules (C3, D-305) : ce que la
 * veille de 9 h compte, sans lire le reste de la page d'état. La même
 * requête que la carte de la ferme (C2, D-304).
 */
export async function readUndeliveredAlertsByFarm(alerts: AlertWindows): Promise<Map<string, FarmAlertDeliveries>> {
  const { results } = await undeliveredAlertsStatement(alerts).all<DeliveryRow>();
  return farmAlertDeliveries(results);
}

/** Les alertes météo et par culture des 7 derniers jours qui n'ont atteint aucun appareil, par ferme et par état. */
function undeliveredAlertsStatement(alerts: AlertWindows): D1PreparedStatement {
  return db.prepare(
    `SELECT workspace.otf_farm_id AS farm, alert.delivery_status AS status,
            SUM(CASE WHEN alert.sent_at >= ? THEN 1 ELSE 0 END) AS day_count,
            COUNT(*) AS week_count
     FROM (
       SELECT workspace_id, sent_at, delivery_status FROM irrigation_weather_alerts
       UNION ALL
       SELECT workspace_id, sent_at, delivery_status FROM irrigation_crop_alerts
     ) AS alert
     JOIN irrigation_workspaces AS workspace ON workspace.id = alert.workspace_id
     WHERE workspace.otf_farm_id IS NOT NULL AND alert.sent_at >= ?
       AND (alert.delivery_status IN ('no-subscriber', 'failed', 'retrying')
            OR (alert.delivery_status = 'pending' AND alert.sent_at < ?))
     GROUP BY workspace.otf_farm_id, alert.delivery_status`,
  ).bind(alerts.dayStart, alerts.weekStart, alerts.interruptedBefore);
}

function farmAlertDeliveries(rows: readonly DeliveryRow[]): Map<string, FarmAlertDeliveries> {
  const farms = new Map<string, FarmAlertDeliveries>();
  for (const row of rows) {
    const deliveries = farms.get(row.farm) ?? EMPTY_FARM_ALERT_DELIVERIES;
    if (row.status === 'retrying') {
      farms.set(row.farm, { ...deliveries, retrying7d: deliveries.retrying7d + Number(row.week_count) });
      continue;
    }
    const key = UNDELIVERED_KEYS[row.status];
    if (!key) continue;
    farms.set(row.farm, {
      ...deliveries,
      undelivered24h: added(deliveries.undelivered24h, key, Number(row.day_count)),
      undelivered7d: added(deliveries.undelivered7d, key, Number(row.week_count)),
    });
  }
  return farms;
}

const UNDELIVERED_KEYS: Record<string, keyof UndeliveredAlertCounts | undefined> = {
  'no-subscriber': 'noDevice',
  failed: 'failed',
  pending: 'interrupted',
};

function added(counts: UndeliveredAlertCounts, key: keyof UndeliveredAlertCounts, count: number): UndeliveredAlertCounts {
  return { ...counts, [key]: counts[key] + count };
}

function addCount(counts: OtfCallCounts, outcome: OtfCallOutcome, calls: number) {
  if (calls > 0) counts[outcome] = (counts[outcome] ?? 0) + calls;
}
