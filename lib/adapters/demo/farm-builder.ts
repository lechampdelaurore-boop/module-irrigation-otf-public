import type { Bed, CropPlan, CropSeries, ImplantationTask, IrrigationSnapshot, Outline, OutlinePosition, Plot, PlotMode, Zone } from '../../domain/domain.ts';
import { compareWeekKeys, weekKeyFromDateKey } from '../../domain/week-keys.ts';

/**
 * Les briques des fermes fictives de la démonstration (docs/demo-guided-contract.md,
 * section 6) : un plan écrit en peu de lignes, dont les surfaces se calculent
 * comme Ouvre ta ferme les donne (longueur × largeur), et un plan de culture
 * lu « au jour du moment » : ce qui est prévu avant ce jour est fait, ce qui
 * vient après reste à faire. Rien n'est tiré au hasard ni lu de l'horloge.
 */

const DEMO_SEASON = 2026;
const SEASONS = [DEMO_SEASON];

export type DemoBedDefinition = { id: string; name: string; length: number; width: number; alleyWidth: number };
type DemoPlotDefinition = { id: string; name: string; mode: PlotMode; length: number; width: number; beds: readonly DemoBedDefinition[] };
/**
 * `drawnAt` : le coin sud-ouest de la parcelle, sur un lieu inventé, quand la
 * ferme fictive l'a dessinée dans Ouvre ta ferme (S3, F232) ; sans lui, la
 * parcelle n'est pas dessinée et la vue satellite le dit.
 */
type DemoZoneDefinition = { id: string; name: string; plots: readonly DemoPlotDefinition[]; drawnAt?: OutlinePosition };

/** Une série : une culture, ses planches, son implantation et ses semaines de récolte prévues. */
export type DemoSeriesDefinition = {
  id: string;
  name: string;
  plantId: string;
  plantName: string;
  kind: ImplantationTask['kind'];
  implantationWeek: string;
  harvestWeeks: readonly string[];
  places: readonly { bedId: string; lengthMeters: number }[];
};

export type DemoFarmDefinition = {
  id: string;
  name: string;
  city: string;
  postcode: string;
  zones: readonly DemoZoneDefinition[];
  series: readonly DemoSeriesDefinition[];
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Le bord laissé autour des jardins, et l'écart entre deux jardins, en mètres (F233). */
const DRAWN_MARGIN_METERS = 4;
const DRAWN_GAP_METERS = 3;
const METERS_PER_DEGREE_OF_LATITUDE = 111_320;

/** Un rectangle nord en haut, en mètres depuis le coin sud-ouest de la parcelle. */
function drawnRectangle(origin: OutlinePosition, west: number, south: number, east: number, north: number): Outline {
  const [longitude, latitude] = origin;
  const metersPerDegreeOfLongitude = METERS_PER_DEGREE_OF_LATITUDE * Math.cos((latitude * Math.PI) / 180);
  const at = (x: number, y: number): OutlinePosition => [
    Math.round((longitude + x / metersPerDegreeOfLongitude) * 1e7) / 1e7,
    Math.round((latitude + y / METERS_PER_DEGREE_OF_LATITUDE) * 1e7) / 1e7,
  ];
  return [{ exterior: [at(west, south), at(east, south), at(east, north), at(west, north), at(west, south)], holes: [] }];
}

/**
 * Les contours d'une parcelle dessinée (F233) : ses jardins côte à côte d'ouest
 * en est, chacun à ses dimensions d'Ouvre ta ferme (longueur d'ouest en est,
 * largeur du sud au nord), et la parcelle autour, avec un bord.
 */
function drawnOutlines(zone: DemoZoneDefinition, origin: OutlinePosition): { zone: Outline; plots: Map<string, Outline> } {
  const plots = new Map<string, Outline>();
  let east = DRAWN_MARGIN_METERS;
  let widest = 0;
  for (const plot of zone.plots) {
    plots.set(plot.id, drawnRectangle(origin, east, DRAWN_MARGIN_METERS, east + plot.length, DRAWN_MARGIN_METERS + plot.width));
    east += plot.length + DRAWN_GAP_METERS;
    widest = Math.max(widest, plot.width);
  }
  const zoneEast = east - DRAWN_GAP_METERS + DRAWN_MARGIN_METERS;
  return { zone: drawnRectangle(origin, 0, 0, zoneEast, widest + 2 * DRAWN_MARGIN_METERS), plots };
}

function cropPlanAt(series: readonly DemoSeriesDefinition[], momentDateKey: string): CropPlan {
  const momentWeek = weekKeyFromDateKey(momentDateKey);
  const done = (week: string) => compareWeekKeys(week, momentWeek) <= 0;
  const cropSeries: CropSeries[] = series.map((item) => ({
    id: item.id,
    name: item.name,
    season: DEMO_SEASON,
    use: 'bed',
    cycle: 'annual',
    cultivations: [{
      id: `${item.id}-culture`,
      plantId: item.plantId,
      plantName: item.plantName,
      harvestWeeks: item.harvestWeeks.filter(done),
      harvestWeeksExpected: [...item.harvestWeeks],
    }],
  }));
  const places = series.flatMap((item) => item.places.map((place) => ({
    id: `${item.id}-${place.bedId}`,
    seriesId: item.id,
    bedId: place.bedId,
    lengthMeters: place.lengthMeters,
  })));
  const implantationTasks: ImplantationTask[] = series.map((item) => ({
    id: `${item.id}-implantation`,
    seriesId: item.id,
    cultivationId: `${item.id}-culture`,
    kind: item.kind,
    plannedWeek: item.implantationWeek,
    doneWeek: done(item.implantationWeek) ? item.implantationWeek : null,
    status: done(item.implantationWeek) ? 'done' : 'todo',
  }));
  return {
    series: cropSeries,
    places,
    implantationTasks,
    readSummary: {
      seriesRead: cropSeries.length,
      placesRead: places.length,
      tasksRead: implantationTasks.length,
      tasksRetained: implantationTasks.length,
      placesWithoutSeries: 0,
      placesOfUnknownSeries: 0,
      placesWithUnknownBed: 0,
    },
  };
}

/** L'instantané d'une ferme fictive au jour d'un moment, lu comme une lecture réussie ce jour-là à 7 h. */
export function buildDemoSnapshot(definition: DemoFarmDefinition, momentDateKey: string): IrrigationSnapshot {
  const zones: Zone[] = [];
  const plots: Plot[] = [];
  const beds: Bed[] = [];
  for (const zone of definition.zones) {
    let zoneArea = 0;
    const drawn = zone.drawnAt ? drawnOutlines(zone, zone.drawnAt) : null;
    for (const plot of zone.plots) {
      const plotArea = round(plot.length * plot.width);
      zoneArea += plotArea;
      const outline = drawn?.plots.get(plot.id);
      plots.push({
        id: plot.id, zoneId: zone.id, name: plot.name, mode: plot.mode, length: plot.length, width: plot.width, area: plotArea, seasons: SEASONS,
        ...(outline ? { outline } : {}),
      });
      for (const bed of plot.beds) {
        beds.push({ id: bed.id, zoneId: zone.id, plotId: plot.id, name: bed.name, length: bed.length, width: bed.width, alleyWidth: bed.alleyWidth, area: round(bed.length * bed.width), seasons: SEASONS });
      }
    }
    zones.push({ id: zone.id, name: zone.name, area: round(zoneArea), seasons: SEASONS, ...(drawn ? { outline: drawn.zone } : {}) });
  }
  return {
    configuration: { seasonFirst: DEMO_SEASON, seasonLast: DEMO_SEASON },
    structure: { id: definition.id, name: definition.name, legalCity: definition.city, legalPostcode: definition.postcode, legalCountry: 'FR' },
    zones,
    plots,
    beds,
    cropPlan: cropPlanAt(definition.series, momentDateKey),
    source: 'mock',
    lastSuccessfulReadAt: `${momentDateKey}T05:00:00.000Z`,
  };
}

/** Des planches identiques, numérotées : `prefix` + 01, 02… */
export function bedRow(prefix: string, count: number, size: Omit<DemoBedDefinition, 'id' | 'name'>): DemoBedDefinition[] {
  return Array.from({ length: count }, (_, index) => {
    const name = `${prefix}${String(index + 1).padStart(2, '0')}`;
    return { id: `bed-${name.toLowerCase()}`, name, ...size };
  });
}
