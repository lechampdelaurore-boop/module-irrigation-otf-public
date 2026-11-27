import { db } from './binding';
import { listForecastArchive } from './forecast-archive-repository';
import { findWorkspaceIdForUser } from './workspace-repository';
import type { ReliabilityArchiveRow, ReliabilityRealisedRow } from '@/lib/domain/weather/forecast-reliability';

/**
 * La lecture de la météo prévue contre la météo réalisée
 * (docs/forecast-reliability-contract.md, §7, D-338) : en lecture seule,
 * pour une exploitation et son lieu de météo, les prévisions archivées dont
 * le jour visé tombe dans la période (par `listForecastArchive`, F752) et le
 * réalisé des mêmes jours : la réanalyse de ce lieu et la pluie notée au
 * pluviomètre par la ferme.
 *
 * Chaque requête porte l'exploitation : jamais une donnée d'une autre ferme,
 * même quand deux fermes partagent un lieu. Rien n'est écrit ; aucun appel
 * externe.
 */

export type ForecastReliabilityInputs = {
  archive: ReliabilityArchiveRow[];
  realised: ReliabilityRealisedRow[];
};

/** Sans exploitation, rien à lire : deux listes vides. */
export async function readForecastReliabilityInputsForUser(
  ownerUserId: string,
  locationKey: string,
  period: { startDate: string; endDate: string },
): Promise<ForecastReliabilityInputs> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return { archive: [], realised: [] };
  const [archive, realised] = await Promise.all([
    listForecastArchive(workspaceId, locationKey, period),
    listRealisedWeather(workspaceId, locationKey, period),
  ]);
  return {
    archive: archive.map((row) => ({
      locationKey: row.locationKey,
      issuedOn: row.issuedOn,
      targetDate: row.targetDate,
      horizonDays: row.horizonDays,
      precipitationMm: row.precipitationMm,
      et0Mm: row.et0Mm,
    })),
    realised,
  };
}

async function listRealisedWeather(
  workspaceId: string,
  locationKey: string,
  period: { startDate: string; endDate: string },
): Promise<ReliabilityRealisedRow[]> {
  const result = await db.prepare(
    `SELECT location_key, date, data_kind, precipitation_mm, et0_mm
     FROM irrigation_weather_daily_values
     WHERE workspace_id = ?
       AND ((data_kind = 'reanalysis' AND location_key = ?) OR data_kind = 'manual_precipitation')
       AND date BETWEEN ? AND ?
     ORDER BY date, data_kind`,
  ).bind(workspaceId, locationKey, period.startDate, period.endDate).all<{
    location_key: string;
    date: string;
    data_kind: 'reanalysis' | 'manual_precipitation';
    precipitation_mm: number | null;
    et0_mm: number | null;
  }>();
  return result.results.map((row) => ({
    locationKey: row.location_key,
    date: row.date,
    dataKind: row.data_kind,
    precipitationMm: row.precipitation_mm === null ? null : Number(row.precipitation_mm),
    et0Mm: row.et0_mm === null ? null : Number(row.et0_mm),
  }));
}
