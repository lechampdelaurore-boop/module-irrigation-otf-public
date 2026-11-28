import { db } from './binding';
import { forecastModelJournal } from './change-journal/places';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import { aEcritUneLigne } from './write-result';
import { MODULE_ACTOR_ID, parseChangeValues } from '@/lib/domain/change-journal/entry';

/**
 * Le modèle de prévision d'une ferme (docs/weather-models-contract.md, § 3
 * règles 1 à 3, 8 et 9, § 6 ; D-346 ; migration 0053) : la colonne
 * `forecast_model` de sa ligne de préférences météo, vide pour
 * « Automatique ». Chaque écriture porte l'exploitation et sa ligne du
 * journal des modifications, dans le même lot (F709) ; la lecture du réglage
 * passe par celle des préférences (`readWeatherPreferenceForUser`), et la
 * liste des modèles vit dans le code, jamais ici (§ 4).
 */

/**
 * Enregistre le modèle d'une ferme (`null` : « Automatique »), après la
 * lecture qui l'a vérifié (règle 8) ; la personne qui le choisit signe la
 * ligne du journal. Rend `true` si le réglage a changé ; un modèle identique
 * n'écrit rien, au journal non plus.
 */
export async function saveForecastModelForUser(ownerUserId: string, modelId: string | null, at: string): Promise<boolean> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const [, written] = await db.batch([
    forecastModelJournal('modele-meteo', { workspaceId, actorUserId: ownerUserId, at }, modelId),
    db.prepare(
      `INSERT INTO irrigation_weather_preferences (workspace_id, location_mode, forecast_model, updated_at)
       VALUES (?, 'otf', ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET
         forecast_model = excluded.forecast_model,
         updated_at = excluded.updated_at
       WHERE irrigation_weather_preferences.forecast_model IS NOT excluded.forecast_model`,
    ).bind(workspaceId, modelId, at),
  ]);
  return aEcritUneLigne(written.meta);
}

/**
 * Règle 9 : ramène une exploitation à « Automatique » parce que son modèle
 * n'est plus proposé ou ne couvre plus son lieu, **seulement si elle l'a
 * encore** (un modèle enregistré entre-temps par la personne reste) ; la
 * ligne du journal dit « Le module ». Rend `true` si la ferme a changé.
 */
export async function returnForecastModelToAutomatic(input: { workspaceId: string; savedModelId: string; at: string }): Promise<boolean> {
  const [, written] = await db.batch([
    forecastModelJournal('modele-meteo', { workspaceId: input.workspaceId, actorUserId: MODULE_ACTOR_ID, at: input.at }, null, input.savedModelId),
    db.prepare(
      `UPDATE irrigation_weather_preferences
       SET forecast_model = NULL, updated_at = ?
       WHERE workspace_id = ? AND forecast_model = ?`,
    ).bind(input.at, input.workspaceId, input.savedModelId),
  ]);
  return aEcritUneLigne(written.meta);
}

/** Le même retour pour l'exploitation d'une personne, à la lecture de la météo à l'écran ; sans exploitation, rien. */
export async function returnForecastModelToAutomaticForUser(ownerUserId: string, savedModelId: string, at: string): Promise<boolean> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return false;
  return returnForecastModelToAutomatic({ workspaceId, savedModelId, at });
}

/** Ce que la carte « Modèle de prévision » lit (D-347) : les sources des prévisions à venir, le dernier changement du modèle. */
export type ForecastModelSettingRecords = {
  /** Les prévisions gardées à ce lieu, d'aujourd'hui aux jours suivants, avec la source de chaque jour. */
  forecastDays: { date: string; source: string }[];
  /** Le dernier changement du modèle de la ferme au journal ; `null` s'il n'y en a aucun. */
  lastChange: { byModule: boolean; previousModelId: string | null; at: string } | null;
};

/**
 * Lit, pour l'écran, les prévisions à venir de la ferme (le dernier jour de
 * son modèle, règle 6) et la dernière ligne « Modèle de prévision » du
 * journal (le retour du module, règle 9). Toute lecture porte l'espace de
 * la personne ; sans espace, rien.
 */
export async function readForecastModelSettingForUser(
  ownerUserId: string,
  locationKey: string | null,
  fromDate: string,
): Promise<ForecastModelSettingRecords> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return { forecastDays: [], lastChange: null };
  const [days, change] = await db.batch([
    db.prepare(
      `SELECT date, source FROM irrigation_weather_daily_values
       WHERE workspace_id = ? AND location_key = ? AND data_kind = 'forecast' AND date >= ?
       ORDER BY date`,
    ).bind(workspaceId, locationKey ?? '', fromDate),
    db.prepare(
      `SELECT actor_user_id, before_values, created_at FROM irrigation_change_journal
       WHERE workspace_id = ? AND subject = 'modele-meteo'
       ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    ).bind(workspaceId),
  ]);
  const last = (change.results as { actor_user_id: string; before_values: string | null; created_at: string }[])[0];
  return {
    forecastDays: (days.results as { date: string; source: string }[]).map((row) => ({ date: row.date, source: row.source })),
    lastChange: last === undefined ? null : {
      byModule: last.actor_user_id === MODULE_ACTOR_ID,
      previousModelId: previousModel(last.before_values),
      at: last.created_at,
    },
  };
}

function previousModel(json: string | null): string | null {
  const before = parseChangeValues(json);
  const value = before?.forecastModel;
  return typeof value === 'string' && value !== '' ? value : null;
}
