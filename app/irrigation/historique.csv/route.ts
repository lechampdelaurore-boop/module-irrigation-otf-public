import { getAuthenticatedUser } from '@/app/access-auth';
import {
  HISTORY_PERIOD_MODES,
  HISTORY_SCOPE_LEVELS,
  type HistoryPeriodMode,
  type HistoryScopeLevel,
  IrrigationHistoryInputError,
} from '@/lib/domain/irrigation-history/contract';
import { isHistoryStatusFilter } from '@/lib/domain/irrigation-history/status-filter';
import {
  buildIrrigationHistoryCsv,
  irrigationHistoryCsvFileName,
} from '@/lib/domain/irrigation-history-csv';
import { getIrrigationHistoryExportForUser } from '@/lib/services/irrigation-history-service';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response('Session expirée.', { status: 401 });
  const url = new URL(request.url);
  const season = Number(url.searchParams.get('season'));
  const mode = url.searchParams.get('mode');
  const level = url.searchParams.get('level');
  // Le filtre de la liste (audit ergonomique, point 11) ; un lien d'avant, sans filtre, exporte tout.
  const status = url.searchParams.get('status');
  if ((status !== null && !isHistoryStatusFilter(status)) || !Number.isInteger(season) || season < 1900 || season > 9999
    || !HISTORY_PERIOD_MODES.includes(mode as HistoryPeriodMode)
    || !HISTORY_SCOPE_LEVELS.includes(level as HistoryScopeLevel)) {
    return new Response('Paramètres d’export invalides.', { status: 400 });
  }

  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season });
    const data = await getIrrigationHistoryExportForUser({
      ownerUserId: user.userId,
      season,
      snapshot,
      selection: {
        period: {
          mode: mode as HistoryPeriodMode,
          anchorDate: url.searchParams.get('anchor'),
          customStartDate: url.searchParams.get('start'),
          customEndDate: url.searchParams.get('end'),
        },
        scope: {
          level: level as HistoryScopeLevel,
          zoneId: url.searchParams.get('zone'),
          plotId: url.searchParams.get('plot'),
          bedId: url.searchParams.get('bed'),
        },
        status: status ?? 'all',
      },
    });
    return new Response(buildIrrigationHistoryCsv(data), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${irrigationHistoryCsvFileName(data)}"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error) {
    const message = error instanceof IrrigationHistoryInputError
      ? error.message
      : 'Export momentanément indisponible.';
    return new Response(message, { status: error instanceof IrrigationHistoryInputError ? 400 : 500 });
  }
}
