import type { HistoryPeriodMode, HistoryScopeLevel } from './contract.ts';
import { DEFAULT_HISTORY_STATUS_FILTER, historyExportLabel, type HistoryStatusFilter } from './status-filter.ts';

/**
 * L'adresse de l'export CSV de l'historique (`/irrigation/historique.csv`,
 * route et format inchangés) : celle du bouton « Exporter » de « Les
 * cumuls », et celle d'« Exporter » au pied de « La semaine »
 * (simplification, lot S4, PR 3, docs/simplification-s4-contract.md,
 * section 4.6), qui l'appelle avec la période « semaine » de la semaine
 * affichée. Un seul constructeur : les deux liens ne peuvent pas diverger.
 */
export function historyCsvHref(input: {
  season: number;
  mode: HistoryPeriodMode;
  level: HistoryScopeLevel;
  startDate: string;
  endDate: string;
  zoneId?: string | null;
  plotId?: string | null;
  bedId?: string | null;
  status: HistoryStatusFilter;
}): string {
  const params = new URLSearchParams({
    season: String(input.season),
    mode: input.mode,
    level: input.level,
    anchor: input.startDate,
    start: input.startDate,
    end: input.endDate,
  });
  if (input.zoneId) params.set('zone', input.zoneId);
  if (input.plotId) params.set('plot', input.plotId);
  if (input.bedId) params.set('bed', input.bedId);
  params.set('status', input.status);
  return `/irrigation/historique.csv?${params.toString()}`;
}

/**
 * « Exporter » au pied de « La semaine » (section 4.6) : la semaine affichée,
 * période « semaine », toute la ferme, les irrigations réalisées (le filtre
 * par défaut de « Les cumuls »). Le libellé dit ce qu'il exporte, avec les
 * mots du bouton de « Les cumuls » (`historyExportLabel`).
 */
export function weekExportLink(input: { season: number; weekStart: string; weekEnd: string }): { href: string; label: string } {
  return {
    href: historyCsvHref({
      season: input.season,
      mode: 'week',
      level: 'farm',
      startDate: input.weekStart,
      endDate: input.weekEnd,
      status: DEFAULT_HISTORY_STATUS_FILTER,
    }),
    label: historyExportLabel(DEFAULT_HISTORY_STATUS_FILTER, `du ${slashDate(input.weekStart)} au ${slashDate(input.weekEnd)}`),
  };
}

/** « 2026-11-23 » s'écrit « 23/11/2026 », comme dans le bouton de « Les cumuls ». */
function slashDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}
