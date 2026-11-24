import { env } from 'cloudflare:workers';
import { automaticWeatherRepository } from '@/db/automatic-weather-repository';
import { recordAutomaticObjectiveWeeksForAllWorkspaces } from '@/lib/services/automatic-objective-record';
import { evaluateCropAlertsAfterForecastWrite, evaluateCropDryingForAllWorkspaces } from '@/lib/services/crop-alerts-service';
import { recordEtmDaysForAllWorkspaces } from '@/lib/services/crop-water-etm-record';
import { runDueFarmErasures } from '@/lib/services/farm-erasure';
import { resealOtfVaultAtMorning } from '@/lib/services/otf-token-vault';
import { runRetentionPurges } from '@/lib/services/retention-purge';
import { recalculateWeeklyPlansForAllWorkspaces } from '@/lib/services/planning-service';
import { recordSoilDaysForAllWorkspaces } from '@/lib/services/soil-reserve-record';
import { recordMorningTaskRuns } from '@/lib/services/task-runs';
import { runAutomaticWeatherSync } from '@/lib/services/weather/automatic-sync';
import { getConfiguredWeatherProvider } from '@/lib/services/weather/configured-provider';
import { evaluateWeatherAlertsAfterForecastWrite } from '@/lib/services/weather-alerts-service';
import { verifyWeatherSyncToken } from '@/lib/services/weather/internal-auth';
import type { MorningRunReport } from '@/lib/domain/operations/morning-task-outcomes';

export async function POST(request: Request) {
  const providedToken = request.headers.get('x-irrigation-weather-sync-token');
  const expectedToken = (
    process.env.WEATHER_SYNC_SERVICE_TOKEN ?? env.WEATHER_SYNC_SERVICE_TOKEN
  )?.trim();
  if (!await verifyWeatherSyncToken(providedToken, expectedToken)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Ce que le matin fait de chacune de ses tâches (4.5, docs/tranche-4-contract.md, F560, F602) :
  // enregistré à la fin, même quand la route s'interrompt en route.
  const report: MorningRunReport = {};
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
    report.weather = result;
    // Le planning se recalcule après la météo du matin (docs/planning-contract.md, « Le cycle ») :
    // un échec du planning n'est pas un échec de la météo, il est compté à part.
    const planning = report.planning = result.status === 'completed' ? await recalculateWeeklyPlansForAllWorkspaces() : null;
    // L'ETM de chaque planche s'enregistre après la météo du matin (docs/crop-water-need-contract.md,
    // « La traçabilité ») ; comme le planning, un échec est compté à part.
    const cropWater = report.cropWater = result.status === 'completed' ? await recordEtmDaysForAllWorkspaces() : null;
    // Puis les semaines closes de l'objectif automatique (docs/objectif-automatique-contract.md, règle 6) :
    // enregistrées une fois, jamais réécrites ; une semaine manquée est rattrapée le matin suivant.
    const automaticObjective = report.automaticObjective = result.status === 'completed' ? await recordAutomaticObjectiveWeeksForAllWorkspaces() : null;
    // Puis l'état du jour de la jauge de la réserve du sol (docs/soil-reserve-contract.md, 5 ter, PR 3d).
    const soilReserve = report.soilReserve = result.status === 'completed' ? await recordSoilDaysForAllWorkspaces() : null;
    // Le séchage est une échéance du plan de culture : il s'évalue chaque matin, même si la météo est en panne.
    const cropDrying = report.cropDrying = result.status === 'already-running' ? null : await evaluateCropDryingForAllWorkspaces();
    // Enfin la rotation de la clé du coffre pour les fermes que la journée n'a pas lues (docs/tranche-4-contract.md,
    // F356, F401) : endormie sans clé maîtresse ; son échec ne fait pas échouer le matin, et sa réponse n'a que des nombres.
    const otfVault = report.otfVault = result.status === 'already-running' ? null : await resealOtfVaultAtMorning();
    // Puis l'effacement des fermes qui l'ont demandé, sept jours avant (docs/tranche-4-contract.md, F563, F645) :
    // par lots bornés ; ce qui reste reprend au passage suivant, et un échec ne fait pas échouer le matin.
    const farmErasure = report.farmErasure = result.status === 'already-running' ? null : await runDueFarmErasures();
    // Enfin les purges des données à durée limitée (docs/tranche-4-contract.md, F562, F650) : par lots bornés,
    // même quand rien ne lit Ouvre ta ferme ; un échec ne fait pas échouer le matin.
    const retentionPurge = report.retentionPurge = result.status === 'already-running' ? null : await runRetentionPurges();
    await recordMorningTaskRuns(report);
    return Response.json({ ...result, planning, cropWater, automaticObjective, soilReserve, cropDrying, otfVault, farmErasure, retentionPurge }, {
      status: result.status === 'already-running' ? 409 : 200,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    report.interruptedBy = error instanceof Error ? error.name : undefined;
    await recordMorningTaskRuns(report);
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
