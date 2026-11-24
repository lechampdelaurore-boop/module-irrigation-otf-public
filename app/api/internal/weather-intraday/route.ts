import { env } from 'cloudflare:workers';
import { runIntradayWeatherAlerts } from '@/lib/services/intraday-weather-alerts';
import { verifyWeatherSyncToken } from '@/lib/services/weather/internal-auth';

/**
 * La relecture des prévisions de la journée, pour les alertes (C1, D-303,
 * docs/weather-scheduler-contract.md) : le planificateur l'appelle à 9 h 30,
 * 12 h 30, 15 h 30, 18 h 30 et 21 h 30, avec le même jeton de service que la
 * météo du matin (aucun secret nouveau). La réponse ne porte que des nombres.
 * Le passage ne lève pas : il enregistre son échec comme toute tâche du
 * registre et répond 200, car une réponse 5xx ferait relancer la route par le
 * planificateur (comme le rappel du soir).
 */
export async function POST(request: Request) {
  const providedToken = request.headers.get('x-irrigation-weather-sync-token');
  const expectedToken = (
    process.env.WEATHER_SYNC_SERVICE_TOKEN ?? env.WEATHER_SYNC_SERVICE_TOKEN
  )?.trim();
  if (!await verifyWeatherSyncToken(providedToken, expectedToken)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runIntradayWeatherAlerts();
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
