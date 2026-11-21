import { env } from 'cloudflare:workers';
import { runEveningReminders } from '@/lib/services/evening-reminder';
import { verifyWeatherSyncToken } from '@/lib/services/weather/internal-auth';

/**
 * Le passage du rappel du soir (amélioration n° 2,
 * docs/ameliorations-6-2-3-7-contract.md, section 4.3, F705) : le
 * planificateur l'appelle chaque heure, avec le même jeton de service que la
 * météo du matin (aucun secret nouveau). La réponse ne porte que des nombres.
 * Le passage ne lève pas : il enregistre son échec comme toute tâche du
 * registre et répond 200, car une réponse 5xx ferait relancer la route par le
 * planificateur (comme la veille de l'exploitant).
 */
export async function POST(request: Request) {
  const providedToken = request.headers.get('x-irrigation-weather-sync-token');
  const expectedToken = (
    process.env.WEATHER_SYNC_SERVICE_TOKEN ?? env.WEATHER_SYNC_SERVICE_TOKEN
  )?.trim();
  if (!await verifyWeatherSyncToken(providedToken, expectedToken)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runEveningReminders();
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
