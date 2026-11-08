import type { StoredProposal } from './contract.ts';
import type { PlanDay } from './presentation.ts';

/**
 * La semaine en tableau, sur un grand écran (retour du porteur, 7 novembre
 * 2026, précision P46) : les jours en colonnes, une ligne par matériel
 * proposé, chaque créneau dans la case de son jour. Sur un téléphone, la
 * semaine reste une liste de jours.
 */

export type PlanWeekRow = { equipmentId: string; equipmentName: string };

/** Les lignes du tableau : chaque matériel proposé dans la semaine, une fois, dans l'ordre des noms. */
export function planWeekRows(days: readonly PlanDay[]): PlanWeekRow[] {
  const rows = new Map<string, PlanWeekRow>();
  for (const day of days) {
    for (const proposal of day.proposals) {
      if (!rows.has(proposal.equipmentId)) rows.set(proposal.equipmentId, { equipmentId: proposal.equipmentId, equipmentName: proposal.equipmentName });
    }
  }
  return [...rows.values()].sort((left, right) =>
    left.equipmentName.localeCompare(right.equipmentName, 'fr', { numeric: true }) || left.equipmentId.localeCompare(right.equipmentId));
}

export type PlanWeekCell = { row: number; proposals: StoredProposal[] };

/**
 * Les cases d'un jour : ses créneaux rangés par ligne de matériel, la ligne
 * comptée à partir de 0, chaque case dans l'ordre des débuts du jour.
 */
export function planDayCells(day: PlanDay, rows: readonly PlanWeekRow[]): PlanWeekCell[] {
  const rowOf = new Map(rows.map((row, index) => [row.equipmentId, index]));
  const cells = new Map<number, StoredProposal[]>();
  for (const proposal of day.proposals) {
    const row = rowOf.get(proposal.equipmentId);
    if (row === undefined) throw new Error(`Matériel ${proposal.equipmentId} absent des lignes de la semaine.`);
    cells.set(row, [...(cells.get(row) ?? []), proposal]);
  }
  return [...cells.entries()].sort(([left], [right]) => left - right).map(([row, proposals]) => ({ row, proposals }));
}
