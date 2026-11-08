import { db } from '../binding';
import type { SprinklerProfilePoint } from '@/lib/domain/irrigation-domain';
import {
  MEASURED_PROVENANCE,
  deserializeCalculatorInputs,
  serializeCalculatorInputs,
  type ProvenanceDecision,
  type SettingProvenance,
  type SettingValues,
} from '@/lib/domain/irrigation-calculator/provenance';
import { findWorkspaceId } from './ownership';

/**
 * La provenance des réglages de matériel (3.8 bis,
 * docs/irrigation-calculator-contract.md, section 10, migration 0029) : une
 * ligne au plus par réglage, à côté de ses valeurs, que le moteur ne lit pas.
 * Pas de ligne : « saisi ». La règle qui décide d'écrire, de garder ou
 * d'effacer vit dans le domaine (`decideProvenance`) ; ici, la lecture et
 * l'écriture seulement, dans l'espace de travail de l'utilisateur.
 */

type ProvenanceRow = {
  setting_id: string;
  level: string;
  method: string | null;
  inputs_json: string | null;
  theoretical_rate_mm_per_hour: number | null;
  zone_share_percent: number | null;
  nominal_flow_liters_per_hour: number | null;
};

const PROVENANCE_COLUMNS = `setting_id, level, method, inputs_json, theoretical_rate_mm_per_hour,
  zone_share_percent, nominal_flow_liters_per_hour`;

/** Une ligne illisible (entrées perdues, étiquette inconnue) ne vaut rien : le réglage reste « saisi », on ne devine pas. */
function provenanceOf(row: ProvenanceRow): SettingProvenance | null {
  if (row.level === 'measured') return MEASURED_PROVENANCE;
  if (row.level !== 'calculated' && row.level !== 'estimated') return null;
  const inputs = deserializeCalculatorInputs(row.inputs_json);
  if (!inputs || inputs.method !== row.method) return null;
  const nullable = (value: number | null) => (value === null ? null : Number(value));
  return {
    level: row.level,
    method: inputs.method,
    inputs,
    theoreticalRateMmPerHour: nullable(row.theoretical_rate_mm_per_hour),
    zoneSharePercent: nullable(row.zone_share_percent),
    nominalFlowLitersPerHour: nullable(row.nominal_flow_liters_per_hour),
  };
}

/** Les provenances des réglages de l'utilisateur, par identifiant de réglage ; un réglage absent est « saisi ». */
export async function listSettingProvenancesForUser(ownerUserId: string): Promise<Record<string, SettingProvenance>> {
  const workspaceId = await findWorkspaceId(ownerUserId);
  if (!workspaceId) return {};
  const rows = await db.prepare(
    `SELECT ${PROVENANCE_COLUMNS} FROM irrigation_equipment_setting_calculations WHERE workspace_id = ?`,
  ).bind(workspaceId).all<ProvenanceRow>();
  const provenances: Record<string, SettingProvenance> = {};
  for (const row of rows.results) {
    const provenance = provenanceOf(row);
    if (provenance) provenances[row.setting_id] = provenance;
  }
  return provenances;
}

/** La provenance et les valeurs enregistrées d'un réglage, avant qu'on l'enregistre de nouveau. */
export async function readSettingStateForWorkspace(
  workspaceId: string,
  settingId: string,
  kind: 'drip' | 'sprinkler',
): Promise<{ provenance: SettingProvenance | null; values: SettingValues }> {
  const [row, values] = await Promise.all([
    db.prepare(
      `SELECT ${PROVENANCE_COLUMNS} FROM irrigation_equipment_setting_calculations WHERE setting_id = ? AND workspace_id = ?`,
    ).bind(settingId, workspaceId).first<ProvenanceRow>(),
    readSettingValues(settingId, kind),
  ]);
  return { provenance: row ? provenanceOf(row) : null, values };
}

async function readSettingValues(settingId: string, kind: 'drip' | 'sprinkler'): Promise<SettingValues> {
  if (kind === 'drip') {
    const rate = await db.prepare('SELECT rate_mm_per_hour FROM drip_setting_rates WHERE setting_id = ?')
      .bind(settingId).first<{ rate_mm_per_hour: number }>();
    return { kind: 'drip', rateMmPerHour: rate ? Number(rate.rate_mm_per_hour) : Number.NaN };
  }
  const points = await db.prepare(
    `SELECT side, distance_meters, rate_mm_per_hour FROM sprinkler_profile_points
     WHERE setting_id = ? ORDER BY side, distance_meters`,
  ).bind(settingId).all<{ side: 'left' | 'right'; distance_meters: number; rate_mm_per_hour: number }>();
  const side = (wanted: 'left' | 'right'): SprinklerProfilePoint[] => points.results
    .filter((point) => point.side === wanted)
    .map((point) => ({ distanceMeters: Number(point.distance_meters), rateMmPerHour: Number(point.rate_mm_per_hour) }));
  return { kind: 'sprinkler', leftProfile: side('left'), rightProfile: side('right') };
}

/** Les instructions qui appliquent une décision, à joindre au lot qui enregistre le réglage. */
export function provenanceStatements(
  decision: ProvenanceDecision,
  workspaceId: string,
  settingId: string,
  now: string,
): D1PreparedStatement[] {
  if (decision.kind === 'keep') return [];
  const remove = db.prepare(
    'DELETE FROM irrigation_equipment_setting_calculations WHERE setting_id = ? AND workspace_id = ?',
  ).bind(settingId, workspaceId);
  if (decision.kind === 'delete') return [remove];
  const provenance = decision.provenance;
  return [
    remove,
    db.prepare(
      `INSERT INTO irrigation_equipment_setting_calculations (
         setting_id, workspace_id, level, method, inputs_json, theoretical_rate_mm_per_hour,
         zone_share_percent, nominal_flow_liters_per_hour, calculated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      settingId,
      workspaceId,
      provenance.level,
      provenance.method,
      provenance.inputs ? serializeCalculatorInputs(provenance.inputs) : null,
      provenance.theoreticalRateMmPerHour,
      provenance.zoneSharePercent,
      provenance.nominalFlowLitersPerHour,
      now,
    ),
  ];
}
