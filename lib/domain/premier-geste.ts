/**
 * « Arrosages » et « Historique » : le premier geste plus haut (audit du
 * 19 novembre 2026, lot J, n° 15, docs/audit-ergonomie-2026-11-19-lot-j-contract.md,
 * section 10). Des règles d'affichage seulement : aucun chiffre n'est
 * recalculé ici.
 */

/**
 * « Résultat calculé » ne montre ses chiffres qu'une fois un matériel et une
 * quantité choisis : avant, une durée nulle et des tirets prenaient la place
 * du premier choix. Le bouton et la réponse du module restent, eux, toujours
 * à leur place (lot G, F404). Une durée nulle (`null`) n'existe que pour
 * une irrigation déjà réalisée aux dates illisibles : ses chiffres restent,
 * pour dire « Inconnu — vérifiez le début et la fin » (point ouvert 45).
 */
export function previewResultReady(equipmentChosen: boolean, durationSeconds: number | null): boolean {
  return equipmentChosen && durationSeconds !== 0;
}

export const PREVIEW_WAITING_TEXT = 'Choisissez un matériel et une quantité : la durée et le volume s’afficheront ici.';

/** Le résumé du pli « Filtrer » de l'historique : le périmètre choisi, ou toute la ferme. */
export function historyFilterSummary(level: 'farm' | 'zone' | 'plot' | 'bed', scopeLabel: string): string {
  return level === 'farm' ? 'toute la ferme' : scopeLabel;
}
