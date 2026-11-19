import { compareNamesNaturally } from '../bed-order.ts';
import type { SoilGaugeZone } from '../soil-reserve/gauge-view.ts';
import { moreGardensLabel, shownFirst } from './week.ts';

/**
 * « Réserve du sol » sur le tableau de bord « Aujourd'hui »
 * (docs/aujourdhui-tableau-de-bord-contract.md, section 3.2) : une jauge par
 * jardin, la part de la réserve facilement utilisable estimée maintenant,
 * celle que montre déjà la page « Réserve du sol » (Σ état × m² / Σ capacité
 * × m² des planches cultivées). Une information, jamais un terme du besoin
 * ni du plan (D-041, D-047) : la jauge ne dit pas d'arroser. Un jardin
 * inconnu se dit inconnu, jamais plein (D-003).
 */

/** Les jardins montrés d'emblée ; les autres derrière « Voir les n autres ». */
const SOIL_GARDENS_SHOWN = 8;
const PERCENT_MAXIMUM = 100;

type TodaySoilGarden = {
  /** L'identifiant du jardin, pour le ranger (F431). */
  key: string;
  plotId: string;
  name: string;
  sheltered: boolean;
  /** La part estimée, en % ; `null` : inconnue ou sans planche cultivée. */
  percent: number | null;
  /** La longueur de la barre, de 0 à 100 % (une réserve peut dépasser sa capacité un jour de pluie). */
  barPercent: number | null;
  /** « 72 % », « inconnue », « aucune planche cultivée ». */
  text: string;
  /** « la plus sèche : B3, 32 % », ou `null`. */
  lowestText: string | null;
};

export type TodaySoil = {
  shown: TodaySoilGarden[];
  hidden: TodaySoilGarden[];
  moreLabel: string | null;
  /** La raison pour laquelle la jauge ne se calcule pas ; `null` quand elle se calcule. */
  unavailable: string | null;
};

const percentText = (value: number) => `${Math.round(value)} %`;

function garden(plot: SoilGaugeZone['plots'][number]): TodaySoilGarden {
  const percent = plot.garden.percent;
  const text = percent !== null
    ? percentText(percent)
    : plot.garden.countedBeds === 0 && plot.garden.unknownBeds === 0 ? 'aucune planche cultivée' : 'inconnue';
  const lowest = plot.garden.lowest;
  return {
    key: plot.plotId,
    plotId: plot.plotId,
    name: plot.name,
    sheltered: plot.sheltered,
    percent,
    barPercent: percent === null ? null : Math.min(PERCENT_MAXIMUM, Math.max(0, Math.round(percent))),
    text,
    lowestText: lowest && plot.garden.countedBeds > 1 ? `la plus sèche : ${lowest.bedName}, ${percentText(lowest.percent)}` : null,
  };
}

/**
 * Les jardins montrés d'emblée (audit du 19 novembre 2026, lot H, n° 4,
 * F431) : ceux qui ont une irrigation aujourd'hui, puis les plus secs, puis
 * les « inconnue », puis « aucune planche cultivée » ; à égalité, l'ordre
 * naturel. Les autres dans l'ordre naturel (F432).
 */
function bySoilPriority(irrigatedToday: ReadonlySet<string>) {
  const rank = (garden: TodaySoilGarden) => (garden.percent !== null ? 0 : garden.text === 'inconnue' ? 1 : 2);
  return (a: TodaySoilGarden, b: TodaySoilGarden) =>
    Number(irrigatedToday.has(b.plotId)) - Number(irrigatedToday.has(a.plotId))
    || rank(a) - rank(b)
    || (a.percent ?? 0) - (b.percent ?? 0)
    || compareNamesNaturally(a.name, b.name)
    || compareNamesNaturally(a.plotId, b.plotId);
}

export function todaySoil(
  input: { zones: readonly Pick<SoilGaugeZone, 'plots'>[] } | { unavailable: string },
  irrigatedToday: ReadonlySet<string> = new Set(),
): TodaySoil {
  if ('unavailable' in input) return { shown: [], hidden: [], moreLabel: null, unavailable: input.unavailable };
  const gardens = input.zones.flatMap((zone) => zone.plots.map(garden));
  const { shown, hidden } = shownFirst(gardens, bySoilPriority(irrigatedToday), SOIL_GARDENS_SHOWN);
  return { shown, hidden, moreLabel: moreGardensLabel(hidden.length), unavailable: null };
}
