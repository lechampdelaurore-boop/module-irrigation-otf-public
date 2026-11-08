import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../water-management.ts';
import { gaugeDayLabel, type SoilGaugePlot, type SoilGaugeZone } from './gauge-view.ts';

/**
 * Les lignes des jardins d'une parcelle sur la page « Réserve du sol »
 * (audit ergonomique, lot 3, point 13, docs/audit-ergonomie-lot3-contract.md,
 * section 4, cas 10) : une ligne « inconnue » porte « Observer » ; les
 * jardins de plein champ au même pourcentage, observés le même jour, se
 * rangent en une phrase dépliable. Rien ne change dans la jauge : ce module
 * ne lit que ce qu'elle a déjà calculé.
 */

export type SoilGardenLine =
  | {
      kind: 'group';
      key: string;
      /** « Tous les jardins de plein champ » ou « 3 jardins de plein champ ». */
      title: string;
      /** « 50 % du plein, observé hier ». */
      detail: string;
      plotIds: string[];
    }
  | {
      kind: 'plot';
      plot: SoilGaugePlot;
      /** Le pli qui range ce jardin, ou `null`. */
      groupKey: string | null;
      /** Vrai pour une ligne « inconnue » : le bouton « Observer » y paraît. */
      observe: boolean;
    };

/** Une ligne « inconnue » : des planches cultivées, aucune connue (la ligne qui dit « aucune planche cultivée » n'en est pas une). */
function soilGardenUnknown(plot: SoilGaugePlot): boolean {
  return plot.garden.percent === null && plot.garden.countedBeds + plot.garden.unknownBeds > 0;
}

/** Le jour de l'observation qui vaut pour le jardin, à la ferme ; `null` sans observation. */
function observationDay(plot: SoilGaugePlot): string | null {
  return plot.observation ? dateKeyInTimeZone(new Date(plot.observation.observedAt), FARM_TIME_ZONE) : null;
}

/** « observé aujourd'hui », « observé hier », « observé le mardi 3 novembre » ou « sans observation ». */
export function observationDayText(day: string | null, today: string): string {
  if (day === null) return 'sans observation';
  if (day === today) return 'observé aujourd’hui';
  if (day === addDaysToDateKey(today, -1)) return 'observé hier';
  return `observé le ${gaugeDayLabel(day)}`;
}

/**
 * Les lignes d'une parcelle, dans l'ordre de ses jardins. Un pli range au
 * moins deux jardins de plein champ dont le pourcentage arrondi (celui que
 * l'écran montre) et le jour d'observation sont les mêmes ; il se place à la
 * hauteur de son premier jardin. Les abris gardent chacun leur ligne (leur
 * observation est la leur), comme les jardins inconnus, qui portent
 * « Observer ».
 */
export function soilGardenLines(zone: Pick<SoilGaugeZone, 'plots' | 'fieldPlotCount'>, today: string): SoilGardenLine[] {
  const keyOf = (plot: SoilGaugePlot): string | null => {
    if (plot.sheltered || plot.garden.percent === null) return null;
    return `${Math.round(plot.garden.percent)}|${observationDay(plot) ?? 'aucune'}`;
  };
  const members = new Map<string, SoilGaugePlot[]>();
  for (const plot of zone.plots) {
    const key = keyOf(plot);
    if (key !== null) members.set(key, [...(members.get(key) ?? []), plot]);
  }
  const lines: SoilGardenLine[] = [];
  const placed = new Set<string>();
  for (const plot of zone.plots) {
    const key = keyOf(plot);
    const group = key === null ? null : members.get(key) ?? null;
    const grouped = key !== null && group !== null && group.length > 1;
    if (grouped && !placed.has(key)) {
      placed.add(key);
      lines.push({
        kind: 'group',
        key,
        title: group.length === zone.fieldPlotCount ? 'Tous les jardins de plein champ' : `${group.length} jardins de plein champ`,
        detail: `${Math.round(plot.garden.percent ?? 0)} % du plein, ${observationDayText(observationDay(plot), today)}`,
        plotIds: group.map((member) => member.plotId),
      });
    }
    lines.push({ kind: 'plot', plot, groupKey: grouped ? key : null, observe: soilGardenUnknown(plot) });
  }
  return lines;
}
