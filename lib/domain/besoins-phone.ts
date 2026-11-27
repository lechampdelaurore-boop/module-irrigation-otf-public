/**
 * « Objectifs et besoins » court au téléphone (audit du 19 novembre 2026,
 * lot J, n° 15, docs/audit-ergonomie-2026-11-19-lot-j-contract.md,
 * section 8) : les lignes de résumé des plis et la ligne compacte d'un
 * jardin. Des textes seulement : aucun chiffre n'est recalculé ici, chacun
 * vient du tableau de la semaine ou des besoins, tel qu'il s'affiche déplié.
 */

import { farmObjectiveText, type FarmObjective } from './farm-objective.ts';

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function mmText(value: number | null): string {
  return value === null ? 'non disponible' : `${mm.format(value)} mm`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`;
}

/** Les totaux de la semaine que la ligne de résumé reprend, dans l'ordre des tuiles. */
export interface WeekTotalsLine {
  /**
   * L'objectif de la ferme de la semaine, le calcul unique (S1, PR 3) ;
   * `null` le temps que les besoins de la semaine affichée soient relus.
   */
  objective: FarmObjective | null;
  realizedIrrigationMm: number;
  actualRainMm: number | null;
  remainingForecastRainMm: number | null;
  et0Mm: number | null;
  /** Un total de pluie ou d'ET0 incomplet : la ligne le dit, comme la tuile (« · partielle »). */
  partial: boolean;
}

/**
 * Les tuiles en une ligne, comme au planning (F11) : « 25 mm visés, ferme
 * entière · irrigué 12 mm · pluie 3 mm · prévue 5 mm · soif de la semaine
 * 18 mm ». Un total incomplet se dit ; le détail reste dans les tuiles, qui
 * se déplient.
 */
export function weekTotalsLine(totals: WeekTotalsLine): string {
  const parts = [
    totals.objective === null ? 'eau visée en cours de lecture' : farmObjectiveText(totals.objective),
    `irrigué ${mmText(totals.realizedIrrigationMm)}`,
    `pluie ${mmText(totals.actualRainMm)}`,
    `prévue ${mmText(totals.remainingForecastRainMm)}`,
    `soif de la semaine ${mmText(totals.et0Mm)}`,
  ];
  if (totals.partial) parts.push('totaux incomplets');
  return parts.join(' · ');
}

/** Le résumé du pli des objectifs : celui de la ferme d'abord, puis leur nombre. */
export function goalsFoldLine(goalCount: number, farmGoalMm: number | null, automaticOn = false): string {
  // L'objectif automatique allumé se lit dès le résumé du pli (6 decies, O4, D-319).
  if (goalCount === 0) return automaticOn ? 'Objectif automatique allumé, aucun objectif saisi.' : 'Aucun objectif pour cette semaine.';
  const count = plural(goalCount, 'objectif', 'objectifs');
  const line = farmGoalMm === null ? count : `Toute la ferme : ${mmText(farmGoalMm)} · ${count}`;
  return automaticOn ? `Objectif automatique allumé · ${line}` : line;
}

/** Le résumé du pli « Pluie mesurée » : les jours de la semaine déjà mesurés à la ferme. */
export function manualRainFoldLine(days: readonly { manualRainMm: number | null }[]): string {
  const measured = days.filter((day) => day.manualRainMm !== null);
  if (measured.length === 0) return 'Aucune mesure cette semaine.';
  const total = measured.reduce((sum, day) => sum + (day.manualRainMm ?? 0), 0);
  return `${plural(measured.length, 'jour mesuré', 'jours mesurés')} cette semaine, ${mmText(total)}.`;
}

/** Le résumé du pli de la météo : la commune et la fraîcheur, en une ligne. */
export function weatherFoldLine(place: string, refreshedAt: string | null, stale: boolean, formatDateTime: (value: Date) => string): string {
  if (refreshedAt === null) return `${place} · jamais actualisée`;
  return `${place} · mise à jour le ${formatDateTime(new Date(refreshedAt))}${stale ? ' · données anciennes' : ''}`;
}

/** Ce qu'il faut d'un jardin pour sa ligne compacte. */
export interface GardenStateInput {
  effectiveNeedMm: number | null;
  priorityCounts: { high: number };
  /** Ses planches : toutes hors saison, le jardin le dit (6 quaterdecies, B3). */
  beds?: readonly { offSeason?: true }[];
}

/**
 * L'état d'un jardin sur sa ligne compacte, après le reste à apporter :
 * « à compléter » quand le besoin n'est pas calculable, « couvert » quand il
 * ne reste rien, sinon le nombre de planches en priorité haute s'il y en a.
 */
export function gardenState(garden: GardenStateInput): { text: string; tone: 'unknown' | 'covered' | 'high' | 'normal' } {
  if (garden.beds !== undefined && garden.beds.length > 0 && garden.beds.every((bed) => bed.offSeason === true)) return { text: 'hors saison', tone: 'unknown' };
  if (garden.effectiveNeedMm === null) return { text: 'à compléter', tone: 'unknown' };
  if (garden.effectiveNeedMm <= 0) return { text: 'couvert', tone: 'covered' };
  if (garden.priorityCounts.high > 0) return { text: plural(garden.priorityCounts.high, 'haute', 'hautes'), tone: 'high' };
  return { text: '', tone: 'normal' };
}
