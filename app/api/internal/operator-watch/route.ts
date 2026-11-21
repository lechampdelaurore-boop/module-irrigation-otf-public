import { env } from 'cloudflare:workers';
import { runOperatorWatch } from '@/lib/services/operator-watch';
import { verifyWeatherSyncToken } from '@/lib/services/weather/internal-auth';

/**
 * La veille de l'exploitant (4.5, docs/tranche-4-contract.md, F566, F611) :
 * le planificateur l'appelle à 9 h, heure de Paris, avec le même jeton de
 * service que la météo du matin (aucun secret nouveau). La réponse ne porte
 * que des genres et des nombres. La veille ne lève pas : elle enregistre son
 * échec comme celui de toute tâche du registre et répond 200, car une
 * réponse 5xx ferait relancer la route par le planificateur, et trois
 * échecs du même matin compteraient pour trois matins (R2).
 */
export async function POST(request: Request) {
  const providedToken = request.headers.get('x-irrigation-weather-sync-token');
  const expectedToken = (
    process.env.WEATHER_SYNC_SERVICE_TOKEN ?? env.WEATHER_SYNC_SERVICE_TOKEN
  )?.trim();
  if (!await verifyWeatherSyncToken(providedToken, expectedToken)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runOperatorWatch();
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
