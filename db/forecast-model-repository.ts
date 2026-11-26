import { db } from './binding';
import { forecastModelJournal } from './change-journal/places';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import { aEcritUneLigne } from './write-result';
import { MODULE_ACTOR_ID } from '@/lib/domain/change-journal/entry';

/**
 * Le modèle de prévision d'une ferme (docs/weather-models-contract.md, § 3
 * règles 1 à 3, 8 et 9, § 6 ; D-346 ; migration 0051) : la colonne
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
