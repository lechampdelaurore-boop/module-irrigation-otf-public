import type { IrrigationEventStatus } from '../irrigation-domain.ts';

/**
 * Ce que montre la liste de l'historique (audit ergonomique, point 11,
 * 3.8 quater) : la page s'appelle « Historique », elle s'ouvre donc sur les
 * irrigations réalisées — faites en entier ou en partie —, pas sur ce qui
 * est seulement prévu. « Planifiées » montre ce qui reste à faire ; « Toutes »
 * garde la liste d'avant, irrigations annulées comprises.
 *
 * Le filtre ne touche que la liste et l'export : les cumuls ne comptaient déjà
 * que l'eau réellement apportée (D-006).
 */
export const HISTORY_STATUS_FILTERS = ['done', 'planned', 'all'] as const;
export type HistoryStatusFilter = (typeof HISTORY_STATUS_FILTERS)[number];
export const DEFAULT_HISTORY_STATUS_FILTER: HistoryStatusFilter = 'done';

export const HISTORY_STATUS_FILTER_LABELS: Record<HistoryStatusFilter, string> = {
  done: 'Réalisées',
  planned: 'Planifiées',
  all: 'Toutes',
};

export function isHistoryStatusFilter(value: unknown): value is HistoryStatusFilter {
  return typeof value === 'string' && (HISTORY_STATUS_FILTERS as readonly string[]).includes(value);
}

export function matchesHistoryStatusFilter(status: IrrigationEventStatus, filter: HistoryStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'planned') return status === 'planned';
  return status === 'completed' || status === 'partially_completed';
}

export type HistoryStatusCounts = Record<HistoryStatusFilter, number>;

/** Le nombre d'irrigations de la période et du périmètre derrière chaque filtre, affiché sur son onglet. */
export function countHistoryStatuses(statuses: readonly IrrigationEventStatus[]): HistoryStatusCounts {
  return {
    done: statuses.filter((status) => matchesHistoryStatusFilter(status, 'done')).length,
    planned: statuses.filter((status) => matchesHistoryStatusFilter(status, 'planned')).length,
    all: statuses.length,
  };
}

const LIST_ADJECTIVES: Record<HistoryStatusFilter, { one: string; many: string }> = {
  done: { one: ' réalisée', many: ' réalisées' },
  planned: { one: ' planifiée', many: ' planifiées' },
  all: { one: '', many: '' },
};

/** « 3 irrigations réalisées dans la sélection. » */
export function historyListCountText(total: number, filter: HistoryStatusFilter): string {
  const many = total > 1;
  return `${total} irrigation${many ? 's' : ''}${many ? LIST_ADJECTIVES[filter].many : LIST_ADJECTIVES[filter].one} dans la sélection.`;
}

/** La liste vide dit ce qu'elle ne trouve pas, et où regarder sinon. */
export function historyEmptyText(filter: HistoryStatusFilter, counts: HistoryStatusCounts): string {
  const others = filter === 'done' && counts.planned > 0
    ? ` ${counts.planned} irrigation${counts.planned > 1 ? 's sont planifiées' : ' est planifiée'} : voir « Planifiées ».`
    : '';
  return `Aucune irrigation${LIST_ADJECTIVES[filter].one} dans cette période et ce périmètre.${others} Les cumuls météo et l’objectif restent disponibles ci-dessus.`;
}

/** Le bouton d'export dit ce qu'il exporte : « Exporter CSV · réalisées, du 02/11/2026 au 08/11/2026 ». */
export function historyExportLabel(filter: HistoryStatusFilter, periodText: string): string {
  const what = filter === 'all' ? 'toutes' : LIST_ADJECTIVES[filter].many.trim();
  return `Exporter CSV · ${what}, ${periodText}`;
}
