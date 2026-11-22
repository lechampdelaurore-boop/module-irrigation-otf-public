import { db } from './binding';
import { findWorkspaceIdForUser } from './workspace-repository';
import type { ForecastArchiveRow } from '@/lib/domain/weather/forecast-archive';

/**
 * L'archive des prévisions J+1 à J+7 (docs/forecast-archive-contract.md,
 * D-297 ; migration 0046).
 *
 * Elle ne s'écrase jamais : chaque écriture est un `INSERT … ON CONFLICT DO
 * NOTHING` sur la clé (exploitation, lieu, jour d'émission, jour visé), et la
 * première ligne reste. Rien ici ne met à jour ni n'efface : la purge des
 * 24 mois passe par le plan de conservation (`db/retention-plan.ts`),
 * l'effacement d'une ferme par son plan (`db/farm-erasure-plan.ts`). Chaque
 * requête porte l'exploitation : aucune ne lit ni n'écrit la ligne d'une
 * autre, même quand deux exploitations partagent un lieu.
 */

export type ForecastArchiveSnapshot = {
  workspaceId: string;
  locationKey: string;
  /** Le jour civil de Paris de la lecture. */
  issuedOn: string;
  rows: readonly ForecastArchiveRow[];
  source: string;
  fetchedAt: string;
};

export type ForecastArchiveRecord = ForecastArchiveRow & {
  locationKey: string;
  issuedOn: string;
  source: string;
  fetchedAt: string;
};

/** Écrit la photographie d'un jour, sans rien écraser ; rend le nombre de lignes nouvelles. */
export async function writeForecastArchive(snapshot: ForecastArchiveSnapshot): Promise<number> {
  if (snapshot.rows.length === 0) return 0;
  const results = await db.batch(snapshot.rows.map((row) => db.prepare(
    `INSERT INTO irrigation_weather_forecast_archive
       (workspace_id, location_key, issued_on, target_date, horizon_days, precipitation_mm, et0_mm,
        minimum_temperature_celsius, maximum_temperature_celsius, solar_energy_mj_per_square_meter,
        source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id, location_key, issued_on, target_date) DO NOTHING`,
  ).bind(
    snapshot.workspaceId,
    snapshot.locationKey,
    snapshot.issuedOn,
    row.targetDate,
    row.horizonDays,
    row.precipitationMm,
    row.et0Mm,
    row.minimumTemperatureCelsius,
    row.maximumTemperatureCelsius,
    row.solarEnergyMegajoulesPerSquareMeter,
    snapshot.source,
    snapshot.fetchedAt,
  )));
  return results.reduce((written, result) => written + Number(result.meta.changes ?? 0), 0);
}

/** La même écriture pour l'exploitation d'une personne, lue par une actualisation à l'écran ; sans exploitation, rien. */
export async function writeForecastArchiveForUser(
  ownerUserId: string,
  snapshot: Omit<ForecastArchiveSnapshot, 'workspaceId'>,
): Promise<number> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return 0;
  return writeForecastArchive({ ...snapshot, workspaceId });
}

/**
 * La lecture de domaine (règle 9) : les prévisions archivées d'une
 * exploitation et d'un lieu dont le jour visé tombe dans la période, bornes
 * comprises, tous horizons, par jour visé puis jour d'émission. Aucun écran
 * ne la lit encore ; elle sert les chantiers futurs (comparaison prévu et
 * réalisé, banc commun).
 */
export async function listForecastArchive(
  workspaceId: string,
  locationKey: string,
  period: { startDate: string; endDate: string },
): Promise<ForecastArchiveRecord[]> {
  const result = await db.prepare(
    `SELECT location_key, issued_on, target_date, horizon_days, precipitation_mm, et0_mm,
            minimum_temperature_celsius, maximum_temperature_celsius, solar_energy_mj_per_square_meter,
            source, fetched_at
     FROM irrigation_weather_forecast_archive
     WHERE workspace_id = ? AND location_key = ? AND target_date BETWEEN ? AND ?
     ORDER BY target_date, issued_on`,
  ).bind(workspaceId, locationKey, period.startDate, period.endDate).all<{
    location_key: string;
    issued_on: string;
    target_date: string;
    horizon_days: number;
    precipitation_mm: number | null;
    et0_mm: number | null;
    minimum_temperature_celsius: number | null;
    maximum_temperature_celsius: number | null;
    solar_energy_mj_per_square_meter: number | null;
    source: string;
    fetched_at: string;
  }>();
  return result.results.map((row) => ({
    locationKey: row.location_key,
    issuedOn: row.issued_on,
    targetDate: row.target_date,
    horizonDays: Number(row.horizon_days),
    precipitationMm: nullableNumber(row.precipitation_mm),
    et0Mm: nullableNumber(row.et0_mm),
    minimumTemperatureCelsius: nullableNumber(row.minimum_temperature_celsius),
    maximumTemperatureCelsius: nullableNumber(row.maximum_temperature_celsius),
    solarEnergyMegajoulesPerSquareMeter: nullableNumber(row.solar_energy_mj_per_square_meter),
    source: row.source,
    fetchedAt: row.fetched_at,
  }));
}

function nullableNumber(value: number | null): number | null {
  return value === null ? null : Number(value);
}
