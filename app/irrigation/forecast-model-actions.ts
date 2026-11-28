'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { forecastModelChoiceMessage } from '@/lib/domain/weather/forecast-model-choice';
import { AUTOMATIC_FORECAST_CHOICE } from '@/lib/domain/weather/forecast-model-setting';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { saveForecastModelChoiceForUser } from '@/lib/services/weather/forecast-model-choice';
import { loadWaterDashboardAction, type WaterActionResult } from './water-actions';

/**
 * Le geste « Enregistrer le modèle » de la carte « Lieu de la météo »
 * (docs/weather-models-contract.md, règles 1, 3, 8 et 13 ; D-346, D-347,
 * F1028) : « Automatique » (valeur vide) ou un modèle de la liste. Le service
 * vérifie le modèle par une lecture avant de le garder ; la phrase dit en
 * clair ce qui est arrivé. Rien n'est enregistré sur un refus ou une lecture
 * qui ne prouve pas le modèle. Enregistré, le tableau de l'eau est relu, sans
 * nouvelle lecture de la météo, comme après les autres gestes de la carte.
 */
export async function saveForecastModelAction(input: {
  season: number;
  weekStart: string;
  choice: string;
}): Promise<WaterActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(input.season) || input.season < 1900 || input.season > 9999) {
    return { ok: false, message: 'Saison invalide.' };
  }
  if (typeof input.choice !== 'string' || input.choice.length > 64) {
    return { ok: false, message: 'Le modèle choisi est invalide : rien n’est enregistré.' };
  }
  try {
    const outcome = await saveForecastModelChoiceForUser({
      ownerUserId: user.userId,
      snapshot: await getIrrigationSnapshot(user.userId, { season: input.season }),
      modelId: input.choice === AUTOMATIC_FORECAST_CHOICE ? null : input.choice,
    });
    const message = forecastModelChoiceMessage(outcome);
    if (outcome.kind !== 'saved' && outcome.kind !== 'unchanged') return { ok: false, message };
    const read = await loadWaterDashboardAction({ season: input.season, weekStart: input.weekStart, allowWeatherRefresh: false });
    return read.ok ? { ...read, message } : read;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'L’opération a échoué.' };
  }
}
