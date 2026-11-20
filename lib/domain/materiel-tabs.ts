/**
 * « Matériel » en trois onglets (audit du 19 novembre 2026, lot J, n° 15,
 * docs/audit-ergonomie-2026-11-19-lot-j-contract.md, section 9) : le plan,
 * le matériel, les groupes. L'onglet est gardé dans l'adresse, `?onglet=` ;
 * le plan d'abord, sans paramètre.
 */
export const MATERIEL_TABS = [
  { id: 'plan', label: 'Plan' },
  { id: 'materiel', label: 'Matériel' },
  { id: 'groupes', label: 'Groupes' },
] as const;

export type MaterielTab = (typeof MATERIEL_TABS)[number]['id'];

/** Le nom du paramètre de l'adresse qui garde l'onglet. */
export const MATERIEL_TAB_PARAM = 'onglet';

/** L'onglet que l'adresse demande ; le plan pour une valeur absente ou inconnue. */
export function parseMaterielTab(value: string | string[] | null | undefined): MaterielTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return MATERIEL_TABS.find((tab) => tab.id === raw)?.id ?? 'plan';
}

/**
 * Un nom coupé au milieu, jamais à la fin (section 9, point 3) : la fin du
 * nom, ses `tailLength` derniers caractères, reste toujours entière, et la
 * coupure, s'il en faut une, tombe dans le début. Deux noms qui ne diffèrent
 * qu'à la fin restent distincts. Les deux parties, mises bout à bout, rendent
 * le nom entier.
 */
export function middleCutParts(text: string, tailLength = 8): { head: string; tail: string } {
  const characters = Array.from(text);
  if (characters.length <= tailLength * 2) return { head: text, tail: '' };
  return {
    head: characters.slice(0, characters.length - tailLength).join(''),
    tail: characters.slice(characters.length - tailLength).join(''),
  };
}

/** Le résumé d'un jardin replié au téléphone : ses planches et le matériel posé. */
export function plotFoldSummary(bedCount: number, equipmentCount: number): string {
  const beds = `${bedCount} planche${bedCount > 1 ? 's' : ''}`;
  const equipment = equipmentCount === 0 ? 'aucun matériel' : `${equipmentCount} matériel${equipmentCount > 1 ? 's' : ''}`;
  return `${beds} · ${equipment}`;
}
