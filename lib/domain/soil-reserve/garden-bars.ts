import { percentText } from '../figure-origin.ts';
import type { SoilGaugePlot, SoilGaugeZone } from './gauge-view.ts';
import { countsInGardenPercent } from './signals.ts';
import { PERCENT } from './soil.ts';

/**
 * Le graphique des réserves du sol, variante B (docs/soil-reserve-contract.md,
 * « La vue d'ensemble par jardin », S2, D-109) : une barre par jardin ou abri,
 * ses planches en points, le prévu de dimanche en pointillé. C'est un
 * affichage : ce module ne calcule rien de nouveau, il range ce que la jauge
 * a déjà calculé (`garden.percent`, `week`, le résumé de chaque planche) et
 * qui s'écrit déjà dans les plis (D-047).
 */

/** Un point du graphique : une planche comptée dans le % du plein de son jardin. */
type SoilBarBed = {
  bedId: string;
  name: string;
  /** Le % du plein de la planche maintenant, celui de son pli. */
  percent: number;
  /** Sous son seuil, dose conseillée affichée : le point est orange. Une planche en arrêt avant récolte ne l'est jamais. */
  low: boolean;
};

export type SoilGardenBar = {
  plotId: string;
  name: string;
  sheltered: boolean;
  /**
   * `known` : une barre remplie au % du plein ; `unknown` : des planches
   * cultivées, aucune connue, une barre vide « inconnue » (D-003) ;
   * `no-crop` : aucune planche cultivée, pas de barre.
   */
  kind: 'known' | 'unknown' | 'no-crop';
  /** Le % du plein du jardin maintenant, la valeur du titre de son pli ; `null` hors d'une barre connue. */
  percent: number | null;
  /** Le % prévu à la fin de dimanche ; `null` : inconnu, le trait ne se dessine pas. */
  sundayPercent: number | null;
  beds: SoilBarBed[];
  /** Le nombre de points orange. */
  lowCount: number;
  /** Le texte de la barre pour un lecteur d'écran, qui reprend tout ce qu'elle dessine. */
  label: string;
};

/**
 * Les repères sous les barres : les crans du curseur (D-053, P40), et les
 * deux bouts, « 0 % », « sec 25 », « frais 50 », « humide 75 », « 100 % ».
 * Au téléphone, le mot s'efface pour que les repères ne se chevauchent pas.
 */
export const SOIL_BAR_MARKS = [
  { percent: 0, word: null, value: '0 %' },
  { percent: 25, word: 'sec', value: '25' },
  { percent: 50, word: 'frais', value: '50' },
  { percent: 75, word: 'humide', value: '75' },
  { percent: 100, word: null, value: '100 %' },
] as const;

/** La place d'un pourcentage sur la barre, de 0 à 100 : un état hors de ces bornes reste au bord, son chiffre écrit tel quel. */
export function soilBarPosition(percent: number): number {
  return Math.min(PERCENT, Math.max(0, percent));
}

/** Les barres d'une parcelle, dans l'ordre de ses jardins sur la page. */
export function soilGardenBars(zone: Pick<SoilGaugeZone, 'plots'>): SoilGardenBar[] {
  return zone.plots.map(gardenBar);
}

function gardenBar(plot: SoilGaugePlot): SoilGardenBar {
  const { garden } = plot;
  const kind: SoilGardenBar['kind'] = garden.percent !== null
    ? 'known'
    : garden.countedBeds + garden.unknownBeds === 0 ? 'no-crop' : 'unknown';
  const beds: SoilBarBed[] = kind !== 'known' ? [] : plot.beds.flatMap((bed) => {
    const current = bed.summary.current;
    if (current === null || bed.today === null || !countsInGardenPercent(bed.today.mode, bed.today.surfaceState)) return [];
    return [{ bedId: bed.bedId, name: bed.name, percent: current.percent, low: bed.summary.advisedDoseMm !== null && !bed.summary.irrigationStop }];
  });
  const sundayPercent = kind === 'known' ? plot.week.at(-1)?.percent ?? null : null;
  const lowCount = beds.filter((bed) => bed.low).length;
  return {
    plotId: plot.plotId,
    name: plot.name,
    sheltered: plot.sheltered,
    kind,
    percent: kind === 'known' ? garden.percent : null,
    sundayPercent,
    beds,
    lowCount,
    label: barLabel(plot, kind, garden.percent, sundayPercent, lowCount),
  };
}

/** « Jardin 2 : 47 % du plein maintenant, 27 % prévu dimanche, 2 planches sous le seuil ». */
function barLabel(plot: SoilGaugePlot, kind: SoilGardenBar['kind'], percent: number | null, sundayPercent: number | null, lowCount: number): string {
  const name = `${plot.name}${plot.sheltered ? ', abri' : ''}`;
  if (kind === 'no-crop') return `${name} : aucune planche cultivée`;
  if (kind === 'unknown' || percent === null) return `${name} : réserve inconnue`;
  const parts = [`${percentText(percent)} du plein maintenant`];
  if (sundayPercent !== null) parts.push(`${percentText(sundayPercent)} prévu dimanche`);
  if (lowCount > 0) parts.push(`${lowCount} planche${lowCount > 1 ? 's' : ''} sous le seuil`);
  return `${name} : ${parts.join(', ')}`;
}
