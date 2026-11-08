'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { IrrigationHistoryInputError } from '@/lib/domain/irrigation-history/contract';
import { isHistoryStatusFilter } from '@/lib/domain/irrigation-history/status-filter';
import {
  getIrrigationHistoryDashboardForUser,
  type IrrigationHistoryDashboard,
  type IrrigationHistorySelection,
} from '@/lib/services/irrigation-history-service';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { getSeriesWaterDashboardForUser, type SeriesWaterDashboard } from '@/lib/services/series-water-service';

export type IrrigationHistoryActionResult =
  | { ok: true; dashboard: IrrigationHistoryDashboard }
  | { ok: false; message: string };

export type SeriesWaterActionResult =
  | { ok: true; dashboard: SeriesWaterDashboard }
  | { ok: false; message: string };

/** La vue « Séries » des cumuls : chargée à la demande, recalculée à chaque lecture. */
export async function loadSeriesWaterAction(input: { season: number }): Promise<SeriesWaterActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(input.season) || input.season < 1900 || input.season > 9999) {
    return { ok: false, message: 'La saison sélectionnée est invalide.' };
  }
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season: input.season });
    return {
      ok: true,
      dashboard: await getSeriesWaterDashboardForUser({ ownerUserId: user.userId, season: input.season, snapshot }),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Le suivi par série est momentanément indisponible.',
    };
  }
}

export async function loadIrrigationHistoryAction(input: {
  season: number;
  selection: IrrigationHistorySelection;
}): Promise<IrrigationHistoryActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(input.season) || input.season < 1900 || input.season > 9999) {
    return { ok: false, message: 'La saison sélectionnée est invalide.' };
  }
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, {
      season: input.season,
    });
    return {
      ok: true,
      dashboard: await getIrrigationHistoryDashboardForUser({
        ownerUserId: user.userId,
        season: input.season,
        snapshot,
        // Un filtre inconnu retombe sur le filtre par défaut, les irrigations réalisées.
        selection: { ...input.selection, status: isHistoryStatusFilter(input.selection.status) ? input.selection.status : undefined },
      }),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof IrrigationHistoryInputError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Les cumuls et l’historique sont momentanément indisponibles.',
    };
  }
}
