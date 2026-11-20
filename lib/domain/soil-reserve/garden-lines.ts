import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE } from '../water-management.ts';
import { gaugeDayLabel, unknownReasonText, type SoilGaugeBed, type SoilGaugePlot, type SoilGaugeZone } from './gauge-view.ts';

/**
 * Les lignes des jardins d'une parcelle sur la page « Réserve du sol »
 * (audit ergonomique, lot 3, point 13, docs/audit-ergonomie-lot3-contract.md,
 * section 4, cas 10) : une ligne « inconnue » porte « Observer » ; les
 * jardins de plein champ au même pourcentage, observés le même jour, se
 * rangent en une phrase dépliable. Rien ne change dans la jauge : ce module
 * ne lit que ce qu'elle a déjà calculé.
 *
 * Lot D, J4 (docs/audit-ergonomie-final-lot-d-contract.md, section 6, D-150) :
 * une ligne inconnue faute de réserve utile (RFU) pour la parcelle porte
 * « Renseigner la réserve de la parcelle », pas « Observer » : sans RFU, la
 * capacité d'une planche ne se calcule pas, et une observation ne remplit rien.
 */

export type SoilGardenLine =
  | {
      kind: 'group';
      key: string;
      /** « Tous les jardins de plein champ » ou « 3 jardins de plein champ ». */
      title: string;
      /** « 50 % du plein estimé aujourd’hui · dernière observation hier ». */
      detail: string;
      plotIds: string[];
    }
  | {
      kind: 'plot';
      plot: SoilGaugePlot;
      /** Le pli qui range ce jardin, ou `null`. */
      groupKey: string | null;
      /**
       * Le geste de la ligne : « observe » pour une ligne « inconnue » dont la
       * parcelle a sa RFU, « soil » quand elle n'en a pas (J4), `null` sinon.
       */
      action: SoilGardenAction;
    };

export type SoilGardenAction = 'observe' | 'soil' | null;

/**
 * Le jardin n'a pas de réserve utile (RFU) : chacune de ses planches est
 * inconnue pour la raison « no-soil ». La RFU vaut pour une parcelle ou un
 * jardin (D-041, D-046) ; elle manque donc à toutes ses planches à la fois.
 */
export function plotWithoutSoil(plot: Pick<SoilGaugePlot, 'beds'>): boolean {
  return plot.beds.length > 0 && plot.beds.every((bed) => bed.summary.unknown?.kind === 'no-soil');
}

/** La parcelle n'a de RFU pour aucun de ses jardins de plein champ : l'observer ne réglerait rien. */
export function zoneFieldWithoutSoil(zone: Pick<SoilGaugeZone, 'plots'>): boolean {
  const field = zone.plots.filter((plot) => !plot.sheltered && plot.beds.length > 0);
  return field.length > 0 && field.every(plotWithoutSoil);
}

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
 * La clé qui range un jardin avec ses pareils : plein champ, connu, même
 * pourcentage arrondi (celui que l'écran montre), même jour d'observation ;
 * `null` pour un abri ou un jardin inconnu, qui gardent leur ligne.
 */
export function soilGardenGroupKey(plot: SoilGaugePlot): string | null {
  if (plot.sheltered || plot.garden.percent === null) return null;
  return `${Math.round(plot.garden.percent)}|${observationDay(plot) ?? 'aucune'}`;
}

/** « Tous les jardins de plein champ » ou « 3 jardins de plein champ ». */
export function soilGardenGroupTitle(count: number, fieldPlotCount: number): string {
  return count === fieldPlotCount ? 'Tous les jardins de plein champ' : `${count} jardins de plein champ`;
}

/**
 * « 100 % du plein estimé aujourd'hui · dernière observation le vendredi
 * 6 novembre » : l'estimation du jour et l'observation, sans les mêler dans
 * une même phrase (audit du 19 novembre 2026, lot J, n° 15, F458) ; avant,
 * « 100 % du plein, observé le vendredi 6 novembre » se lisait comme une
 * observation à 100 %.
 */
function soilGardenGroupDetail(plot: SoilGaugePlot, today: string): string {
  const day = observationDay(plot);
  const observed = day === null ? 'sans observation' : `dernière ${observationDayText(day, today).replace(/^observé/, 'observation')}`;
  return `${Math.round(plot.garden.percent ?? 0)} % du plein estimé aujourd’hui · ${observed}`;
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
  const keyOf = soilGardenGroupKey;
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
        title: soilGardenGroupTitle(group.length, zone.fieldPlotCount),
        detail: soilGardenGroupDetail(plot, today),
        plotIds: group.map((member) => member.plotId),
      });
    }
    lines.push({ kind: 'plot', plot, groupKey: grouped ? key : null, action: gardenAction(plot) });
  }
  return lines;
}

function gardenAction(plot: SoilGaugePlot): SoilGardenAction {
  if (!soilGardenUnknown(plot)) return null;
  return plotWithoutSoil(plot) ? 'soil' : 'observe';
}

/**
 * Les planches d'un jardin (J4, F310) : celles qui sont inconnues pour la
 * même raison, à au moins deux, se disent en une phrase (« 12 planches :
 * inconnue, aucune RFU saisie ») et se rangent dans un pli ; les autres
 * restent chacune sur sa ligne, dans l'ordre du jardin.
 */
export type SoilBedRows = {
  single: SoilGaugeBed[];
  groups: { key: string; text: string; beds: SoilGaugeBed[] }[];
};

export function soilBedRows(beds: readonly SoilGaugeBed[]): SoilBedRows {
  const byReason = new Map<string, SoilGaugeBed[]>();
  for (const bed of beds) {
    const reason = sameUnknownKey(bed);
    if (reason !== null) byReason.set(reason, [...(byReason.get(reason) ?? []), bed]);
  }
  const grouped = new Set([...byReason.values()].filter((members) => members.length > 1).flat().map((bed) => bed.bedId));
  return {
    single: beds.filter((bed) => !grouped.has(bed.bedId)),
    groups: [...byReason.entries()]
      .filter(([, members]) => members.length > 1)
      .map(([key, members]) => ({ key, text: `${members.length} planches : ${unknownGroupText(members[0])}`, beds: members })),
  };
}

/** La raison d'une planche inconnue, telle que l'écran la dit ; `null` pour une planche connue. */
function sameUnknownKey(bed: SoilGaugeBed): string | null {
  if (bed.summary.current !== null || bed.summary.unknown === null) return null;
  return unknownReasonText(bed.summary.unknown);
}

/** « inconnue, aucune RFU saisie » ; « inconnue depuis le mardi 3 novembre, la pluie de ce jour manque ». */
function unknownGroupText(bed: SoilGaugeBed): string {
  const reason = bed.summary.unknown;
  if (reason?.kind === 'no-soil') return 'inconnue, aucune RFU saisie';
  const text = reason === null ? 'Inconnue.' : unknownReasonText(reason);
  return text.replace(/^Inconnue/, 'inconnue').replace(' : ', ', ').replace(/\.$/, '');
}
