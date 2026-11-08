import { env } from 'cloudflare:workers';
import { automaticWeatherRepository } from '@/db/automatic-weather-repository';
import { evaluateCropAlertsAfterForecastWrite, evaluateCropDryingForAllWorkspaces } from '@/lib/services/crop-alerts-service';
import { recordEtmDaysForAllWorkspaces } from '@/lib/services/crop-water-etm-record';
import { recalculateWeeklyPlansForAllWorkspaces } from '@/lib/services/planning-service';
import { recordSoilDaysForAllWorkspaces } from '@/lib/services/soil-reserve-record';
import { runAutomaticWeatherSync } from '@/lib/services/weather/automatic-sync';
import { getConfiguredWeatherProvider } from '@/lib/services/weather/configured-provider';
import { evaluateWeatherAlertsAfterForecastWrite } from '@/lib/services/weather-alerts-service';
import { verifyWeatherSyncToken } from '@/lib/services/weather/internal-auth';

export async function POST(request: Request) {
  const providedToken = request.headers.get('x-irrigation-weather-sync-token');
  const expectedToken = (
    process.env.WEATHER_SYNC_SERVICE_TOKEN ?? env.WEATHER_SYNC_SERVICE_TOKEN
  )?.trim();
  if (!await verifyWeatherSyncToken(providedToken, expectedToken)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runAutomaticWeatherSync({
      repository: automaticWeatherRepository,
      provider: getConfiguredWeatherProvider(),
      // Les alertes météo (docs/weather-alerts-contract.md), puis le gel par culture et les aspersions
      // (docs/weather-crop-alerts-contract.md), après chaque écriture de prévisions.
      onForecastWritten: async (input) => {
        await evaluateWeatherAlertsAfterForecastWrite(input);
        await evaluateCropAlertsAfterForecastWrite(input);
      },
    });
    // Le planning se recalcule après la météo du matin (docs/planning-contract.md, « Le cycle ») :
    // un échec du planning n'est pas un échec de la météo, il est compté à part.
    const planning = result.status === 'completed' ? await recalculateWeeklyPlansForAllWorkspaces() : null;
    // L'ETM de chaque planche s'enregistre après la météo du matin (docs/crop-water-need-contract.md,
    // « La traçabilité ») ; comme le planning, un échec est compté à part.
    const cropWater = result.status === 'completed' ? await recordEtmDaysForAllWorkspaces() : null;
    // Puis l'état du jour de la jauge de la réserve du sol (docs/soil-reserve-contract.md, 5 ter, PR 3d).
    const soilReserve = result.status === 'completed' ? await recordSoilDaysForAllWorkspaces() : null;
    // Le séchage est une échéance du plan de culture : il s'évalue chaque matin, même si la météo est en panne.
    const cropDrying = result.status === 'already-running' ? null : await evaluateCropDryingForAllWorkspaces();
    return Response.json({ ...result, planning, cropWater, soilReserve, cropDrying }, {
      status: result.status === 'already-running' ? 409 : 200,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'weather_automatic_sync_route_failed',
      error: error instanceof Error ? error.message : 'unknown',
      failedAt: new Date().toISOString(),
    }));
    return Response.json(
      { error: 'Automatic weather synchronization failed' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}
