'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import type { ForecastReliability } from '@/lib/domain/weather/forecast-reliability';
import { isDemoDeployment } from '@/lib/services/deployment-mode';
import { getForecastReliabilityForSpace } from '@/lib/services/forecast-reliability';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { logJsonLine } from '@/lib/adapters/log';

/**
 * « La météo s'est-elle vérifiée ? » (docs/forecast-reliability-contract.md,
 * §6 et §7, D-338) : lu à l'ouverture du pli, jamais au chargement de la
 * page. En lecture seule. Sur la démonstration, les chiffres viennent de
 * l'archive semée : le pli les dit « exemple ».
 */
export type ForecastReliabilityActionResult =
  | { ok: true; reliability: ForecastReliability; example: boolean }
  | { ok: false; message: string };

const UNAVAILABLE = 'La comparaison ne peut pas se calculer pour le moment. Le reste de la page n’est pas touché.';

export async function readForecastReliabilityAction(input: { season: number }): Promise<ForecastReliabilityActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(input.season) || input.season < 1900 || input.season > 9999) return { ok: false, message: 'Saison invalide.' };
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season: input.season });
    const reliability = await getForecastReliabilityForSpace({ ownerUserId: user.userId, snapshot, now: new Date() });
    return { ok: true, reliability, example: isDemoDeployment() };
  } catch {
    // Le statut et la date seulement, comme les autres journaux météo (D-164).
    logJsonLine('warn', { event: 'forecast_reliability_failed', service: 'forecast-reliability', status: 'failed', failedAt: new Date().toISOString() });
    return { ok: false, message: UNAVAILABLE };
  }
}
