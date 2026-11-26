/**
 * « Arrosages » et « Historique » : le premier geste plus haut (audit du
 * 19 novembre 2026, lot J, n° 15, docs/audit-ergonomie-2026-11-19-lot-j-contract.md,
 * section 10). Des règles d'affichage seulement : aucun chiffre n'est
 * recalculé ici.
 */

/** Le résumé du pli « Filtrer » de l'historique : le périmètre choisi, ou toute la ferme. */
export function historyFilterSummary(level: 'farm' | 'zone' | 'plot' | 'bed', scopeLabel: string): string {
  return level === 'farm' ? 'toute la ferme' : scopeLabel;
}
