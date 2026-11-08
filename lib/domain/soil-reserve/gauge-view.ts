import type { Bed, Plot, Zone } from '../domain.ts';
import { addDaysToDateKey } from '../water-management.ts';
import type { SurfaceState } from './bare-soil.ts';
import type { SoilObservation, SoilReserveDay, UnknownReason } from './gauge.ts';
import { gardenSoilSummary, soilReserveSummary, type GardenSoilSummary, type SoilReserveSummary } from './signals.ts';
import { PERCENT } from './soil.ts';
import { decimalText, fixedTwoText, mmText, percentText } from '../figure-origin.ts';

/**
 * Le bloc « Réserve du sol » tel que l'écran le montre
 * (docs/soil-reserve-contract.md, « L'écran », 5 ter, PR 3b) : par parcelle,
 * son curseur de plein champ et sa dernière observation ; par jardin ou abri,
 * le % du plein de maintenant, le prévu jusqu'à dimanche, la plus basse de
 * ses planches, les planches sans culture à part ; par planche, le détail.
 * C'est une information : rien ici ne change un besoin, un plan ni une dose
 * (D-028, D-047).
 */

type SoilGaugeDay = { date: string; percent: number | null; nature: SoilReserveDay['nature'] };

export type SoilGaugeBed = {
  bedId: string;
  name: string;
  summary: SoilReserveSummary;
  /** Le jour d'aujourd'hui de la jauge : mode, état de surface, profondeur, capacité, seuil, cultures. */
  today: SoilReserveDay | null;
  /** La fin de chaque jour, d'aujourd'hui à dimanche, prévue. */
  week: SoilGaugeDay[];
};

export type SoilGaugePlot = {
  plotId: string;
  name: string;
  sheltered: boolean;
  /** Maintenant, au début du jour ou à l'heure de l'observation du jour. */
  garden: GardenSoilSummary;
  week: { date: string; percent: number | null }[];
  /** L'observation qui vaut pour le jardin : la sienne, ou celle de sa parcelle en plein champ. */
  observation: SoilObservation | null;
  beds: SoilGaugeBed[];
};

export type SoilGaugeZone = {
  zoneId: string;
  name: string;
  /** La dernière observation de la parcelle entière, qui ne règle que ses jardins de plein champ (D-053). */
  observation: SoilObservation | null;
  fieldPlotCount: number;
  plots: SoilGaugePlot[];
};

export type SoilGaugeView = { today: string; weekEnd: string; zones: SoilGaugeZone[] };

export function soilGaugeView(input: {
  today: string;
  weekEnd: string;
  zones: readonly Zone[];
  plots: readonly Plot[];
  beds: readonly Bed[];
  daysByBed: ReadonlyMap<string, readonly SoilReserveDay[]>;
  observations: readonly SoilObservation[];
}): SoilGaugeView {
  const dates = datesFromTo(input.today, input.weekEnd);
  const latest = (matches: (observation: SoilObservation) => boolean) => input.observations
    .filter(matches)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.recordedAt.localeCompare(b.recordedAt))
    .at(-1) ?? null;
  return {
    today: input.today,
    weekEnd: input.weekEnd,
    zones: input.zones.map((zone) => {
      const plots = input.plots.filter((plot) => plot.zoneId === zone.id).map((plot): SoilGaugePlot => {
        const sheltered = plot.mode === 'greenhouse';
        const beds = input.beds
          .filter((bed) => bed.plotId === plot.id)
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
          .map((bed) => bedView(bed, input.daysByBed.get(bed.id) ?? [], input.today, dates));
        return {
          plotId: plot.id,
          name: plot.name,
          sheltered,
          garden: gardenSoilSummary(beds.map((bed) => gardenBed(bed, input.beds, bed.today, 'start'))),
          week: dates.map((date) => ({
            date,
            percent: gardenSoilSummary(beds.map((bed) => gardenBed(bed, input.beds, dayOf(input.daysByBed.get(bed.bedId) ?? [], date), 'end'))).percent,
          })),
          observation: latest((observation) => observation.zoneId === zone.id
            && (observation.plotId === plot.id || (observation.plotId === null && !sheltered))),
          beds,
        };
      });
      return {
        zoneId: zone.id,
        name: zone.name,
        observation: latest((observation) => observation.zoneId === zone.id && observation.plotId === null),
        fieldPlotCount: plots.filter((plot) => !plot.sheltered).length,
        plots,
      };
    }),
  };
}

function bedView(bed: Bed, days: readonly SoilReserveDay[], today: string, dates: readonly string[]): SoilGaugeBed {
  return {
    bedId: bed.id,
    name: bed.name,
    summary: soilReserveSummary(days, today),
    today: dayOf(days, today),
    week: dates.map((date) => {
      const day = dayOf(days, date);
      return { date, percent: day ? percentOf(day.stateMm, day.capacityMm) : null, nature: day?.nature ?? 'forecast' };
    }),
  };
}

/** Une planche dans la moyenne du jardin : au début du jour pour maintenant, à la fin du jour pour le prévu. */
function gardenBed(view: SoilGaugeBed, beds: readonly Bed[], day: SoilReserveDay | null, moment: 'start' | 'end') {
  return {
    bedId: view.bedId,
    bedName: view.name,
    areaSquareMeters: beds.find((bed) => bed.id === view.bedId)?.area ?? 0,
    mode: day?.mode ?? null,
    surfaceState: day?.surfaceState ?? null,
    surfaceStateDeclared: day?.surfaceStateDeclared ?? false,
    stateMm: day ? (moment === 'start' ? day.startMm : day.stateMm) : null,
    capacityMm: day?.capacityMm ?? null,
  };
}

function dayOf(days: readonly SoilReserveDay[], date: string): SoilReserveDay | null {
  return days.find((day) => day.date === date) ?? null;
}

function percentOf(stateMm: number | null, capacityMm: number | null): number | null {
  return stateMm === null || capacityMm === null || !(capacityMm > 0) ? null : stateMm / capacityMm * PERCENT;
}

function datesFromTo(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDaysToDateKey(date, 1)) dates.push(date);
  return dates;
}

/** Les états de surface d'une planche sans culture, tels qu'ils se lisent et se déclarent. */
export const SURFACE_STATE_LABELS: Record<SurfaceState, string> = {
  bare: 'sol nu',
  'impermeable-tarp': 'bâche imperméable',
  'permeable-tarp': 'bâche perméable',
  mulched: 'paillée',
  'green-manure-emergence': 'engrais vert, levée',
  'green-manure-partial': 'engrais vert, couverture partielle',
  'green-manure-full': 'engrais vert, couverture totale',
  'green-manure-destroyed': 'engrais vert détruit',
  grass: 'enherbée',
};

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Un jour à la française, « mardi 3 novembre ». */
export function gaugeDayLabel(date: string): string {
  return dayFormat.format(new Date(`${date}T12:00:00Z`));
}

const shortDayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

/** Un jour de la semaine en cours, court, « mar. 3 ». */
export function gaugeShortDayLabel(date: string): string {
  return shortDayFormat.format(new Date(`${date}T12:00:00Z`));
}

/** Pourquoi la jauge est inconnue, en une phrase qui nomme le jour et la donnée qui manquent (D-003). */
export function unknownReasonText(reason: UnknownReason): string {
  switch (reason.kind) {
    case 'no-soil':
      return 'Inconnue : aucune RFU saisie pour sa parcelle.';
    case 'not-started':
      return 'Inconnue : pas encore de départ. Réglez le curseur sur ce que vous observez, ou attendez un jour d’apports qui remplit la planche.';
    case 'missing-rain':
      return `Inconnue depuis le ${gaugeDayLabel(reason.date)} : la pluie de ce jour manque.`;
    case 'missing-et0':
      return `Inconnue depuis le ${gaugeDayLabel(reason.date)} : l’ET0 de ce jour manque.`;
    case 'crop-without-etm':
      return `Inconnue depuis le ${gaugeDayLabel(reason.date)} : pas d’ETM pour ${reason.crops.map((crop) => `${crop.plantName} (${crop.seriesName})`).join(', ')}, culture sans Kc ou sans stade.`;
    case 'blocked':
      return `Inconnue depuis le ${gaugeDayLabel(reason.date)} : ${reason.problems.join(' ')}`;
  }
}

type GaugeCurrent = NonNullable<SoilReserveSummary['current']>;

/**
 * La bulle « d'où vient ce chiffre » du % du plein d'une planche (3.8,
 * docs/feature-selection-contract.md, section 6) : l'état et le plein que la
 * jauge a déjà calculés, mis en mots.
 */
export function gaugePercentOrigin(current: GaugeCurrent | null, depthM: number | null): string | null {
  if (current === null) return null;
  const moment = current.observedAt ? 'à l’heure de l’observation du jour' : 'au début du jour';
  const roots = depthM === null ? '' : `, racines à ${fixedTwoText(depthM)} m`;
  return `${mmText(current.mm)} d’eau utilisable dans le sol ${moment}, sur un plein de ${mmText(current.capacityMm)} : ${percentText(current.percent)} du plein. Le plein est l’eau que le sol retient à portée des racines${roots}.`;
}

/** La bulle du seuil d'arrosage d'une planche : réglé par l'exploitation, ou selon sa culture. */
export function thresholdOrigin(current: GaugeCurrent | null, day: Pick<SoilReserveDay, 'p' | 'cropThresholdPercent'> | null): string | null {
  if (current === null || current.thresholdMm === null) return null;
  const head = `Seuil ${mmText(current.thresholdMm)} sur un plein de ${mmText(current.capacityMm)} : sous ce niveau, la culture puise l’eau avec peine.`;
  if (day?.cropThresholdPercent !== null && day?.cropThresholdPercent !== undefined) {
    return `${head} Il suit le seuil réglé par l’exploitation ; la culture seule conseillerait ${percentText(day.cropThresholdPercent)} du plein.`;
  }
  if (day?.p !== null && day?.p !== undefined) {
    return `${head} Il vient de la part de la réserve que la culture prend sans souffrir (p = ${decimalText(day.p)}), lue dans la fiche de sa culture de référence.`;
  }
  return head;
}
