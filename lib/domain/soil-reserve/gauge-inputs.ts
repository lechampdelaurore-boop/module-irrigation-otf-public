import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { remainingPlannedApplications } from '../planned-irrigation.ts';
import { effectiveProposalStatus, type StoredWeeklyPlan } from '../planning/contract.ts';
import type { WeatherDailyValue } from '../weather/weather-provider.ts';
import { addDaysToDateKey, irrigationActiveIntervals } from '../water-management.ts';
import type { DayRain, IrrigationInterval, SoilObservation } from './gauge.ts';
import type { ActualIrrigation } from './water-surplus.ts';

/**
 * Ce que la jauge de la réserve du sol lit des autres modules
 * (docs/soil-reserve-contract.md, « Les apports et la consommation »,
 * « Estimé et prévu ») : la pluie du jour, les irrigations réalisées, les
 * irrigations planifiées comptées par la règle même du planning, les
 * propositions du plan de la semaine, et les jours à suivre.
 */

type WeatherRow = WeatherDailyValue & { dataKind: 'forecast' | 'reanalysis' | 'manual_precipitation'; fetchedAt: string };

/**
 * La pluie de chaque jour : le pluviomètre prime, 0 mm compris ; avant
 * aujourd'hui, la réanalyse, à défaut la prévision enregistrée (« estimée ») ;
 * aujourd'hui et ensuite, la prévision. Un jour sans valeur reste absent :
 * sa pluie est inconnue (D-003).
 */
export function dayRainFromWeather(rows: readonly WeatherRow[], today: string): Map<string, DayRain> {
  const latest = new Map<string, Partial<Record<WeatherRow['dataKind'], WeatherRow>>>();
  for (const row of rows) {
    if (row.precipitationMm === null) continue;
    const entry = latest.get(row.date) ?? {};
    const known = entry[row.dataKind];
    if (!known || row.fetchedAt >= known.fetchedAt) entry[row.dataKind] = row;
    latest.set(row.date, entry);
  }
  const rain = new Map<string, DayRain>();
  for (const [date, entry] of latest) {
    const day: DayRain | null = entry.manual_precipitation
      ? { mm: entry.manual_precipitation.precipitationMm!, nature: 'gauge' }
      : date < today
        ? entry.reanalysis
          ? { mm: entry.reanalysis.precipitationMm!, nature: 'reanalysis' }
          : entry.forecast ? { mm: entry.forecast.precipitationMm!, nature: 'estimated' } : null
        : entry.forecast ? { mm: entry.forecast.precipitationMm!, nature: 'forecast' } : null;
    if (day) rain.set(date, day);
  }
  return rain;
}

/**
 * Les apports d'irrigation de chaque planche : les irrigations réalisées,
 * leurs mm répartis sur leurs heures de fonctionnement réelles ; les
 * irrigations planifiées qui restent, de maintenant à la fin de l'horizon,
 * par la règle du planning (`remainingPlannedApplications`, D-044, D-051) ;
 * les propositions encore proposées du plan de la semaine.
 */
export function irrigationIntervalsByBed(input: {
  events: readonly IrrigationEventRecord[];
  plan: StoredWeeklyPlan | null;
  now: Date;
  horizonEnd: Date;
}): Map<string, IrrigationInterval[]> {
  const byBed = new Map<string, IrrigationInterval[]>();
  const add = (bedId: string, interval: IrrigationInterval) => {
    if (!(interval.mm > 0)) return;
    byBed.set(bedId, [...(byBed.get(bedId) ?? []), interval]);
  };
  for (const [bedId, intervals] of actualIrrigationsByBed(input.events, input.now)) {
    for (const { startAt, endAt, mm, nature } of intervals) add(bedId, { startAt, endAt, mm, nature });
  }
  for (const row of remainingPlannedApplications(input.events, input.now, input.horizonEnd)) {
    add(row.bedId, { startAt: row.startsAt.toISOString(), endAt: row.endsAt.toISOString(), mm: row.amountMm, nature: 'planned' });
  }
  for (const proposal of input.plan?.proposals ?? []) {
    if (effectiveProposalStatus(proposal, input.now) !== 'proposed') continue;
    for (const application of proposal.bedApplications) {
      add(application.bedId, { startAt: proposal.startAt, endAt: proposal.endAt, mm: application.appliedMm, nature: 'proposed' });
    }
  }
  return byBed;
}

/**
 * Les irrigations réalisées de chaque planche : leurs mm réels répartis sur
 * leurs heures de fonctionnement, avec la surface mouillée qui convertit ces
 * mm en volume (docs/wetted-surface-contract.md).
 */
export function actualIrrigationsByBed(events: readonly IrrigationEventRecord[], now: Date): Map<string, ActualIrrigation[]> {
  const byBed = new Map<string, ActualIrrigation[]>();
  for (const event of events) {
    if (event.status !== 'completed' && event.status !== 'partially_completed') continue;
    const intervals = irrigationActiveIntervals(event, now);
    const total = intervals.reduce((sum, interval) => sum + (interval.endAt.getTime() - interval.startAt.getTime()), 0);
    if (!(total > 0)) continue;
    for (const application of event.equipment.applications) {
      for (const interval of intervals) {
        const share = (interval.endAt.getTime() - interval.startAt.getTime()) / total;
        const mm = Math.max(0, application.actualAmountMm) * share;
        if (!(mm > 0)) continue;
        byBed.set(application.otfBedId, [...(byBed.get(application.otfBedId) ?? []), {
          startAt: interval.startAt.toISOString(),
          endAt: interval.endAt.toISOString(),
          mm,
          nature: 'actual',
          wettedAreaSquareMeters: application.wettedAreaSquareMeters,
        }]);
      }
    }
  }
  return byBed;
}

/** Au plus quatre-vingt-dix jours en arrière : une observation plus ancienne ne sert plus de départ. */
const OLDEST_START_DAYS = 90;
/** Sans observation, trente jours laissent à un jour d'apports le temps de remplir la planche. */
const START_WITHOUT_OBSERVATION_DAYS = 30;

/**
 * Le premier jour à suivre : le jour de la dernière observation qui couvre
 * chaque jardin, sinon trente jours en arrière, le plus ancien des jardins ;
 * jamais plus de quatre-vingt-dix jours en arrière, jamais avant le
 * 1er janvier de la saison, dont le plan de culture est seul lu.
 */
export function gaugeStartDate(input: {
  today: string;
  season: number;
  plots: readonly { id: string; zoneId: string; sheltered: boolean }[];
  observations: readonly SoilObservation[];
  observedDate: (observation: SoilObservation) => string;
}): string {
  const seasonStart = `${input.season}-01-01`;
  const oldest = maxDate(seasonStart, addDaysToDateKey(input.today, -OLDEST_START_DAYS));
  const fallback = maxDate(oldest, addDaysToDateKey(input.today, -START_WITHOUT_OBSERVATION_DAYS));
  let start = input.today;
  for (const plot of input.plots) {
    const covering = input.observations
      .filter((observation) => observation.zoneId === plot.zoneId && (observation.plotId === plot.id || (observation.plotId === null && !plot.sheltered)))
      .map(input.observedDate)
      .filter((date) => date >= oldest && date <= input.today)
      .sort();
    const plotStart = covering.at(-1) ?? fallback;
    if (plotStart < start) start = plotStart;
  }
  return maxDate(oldest, start);
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}
