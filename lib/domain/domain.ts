export type Season = number;

export type OtfConfiguration = {
  seasonFirst: number;
  seasonLast: number;
};

export type OtfStructure = {
  id: string;
  name: string;
  legalCity: string | null;
  legalPostcode: string | null;
  legalCountry: string | null;
};

/** Un point d'un contour : longitude puis latitude, en degrés WGS 84, six décimales. */
export type OutlinePosition = [longitude: number, latitude: number];

/** Un anneau fermé : son premier point répété à la fin, au moins trois points distincts. */
export type OutlineRing = OutlinePosition[];

/** Un polygone : un anneau extérieur et, dedans, des trous. */
export type OutlinePolygon = {
  exterior: OutlineRing;
  holes: OutlineRing[];
};

/**
 * Le contour d'une parcelle ou d'un jardin tel qu'Ouvre ta ferme le dessine
 * (`coordinates`), rangé par `lib/domain/otf/outline.ts` : un ou plusieurs
 * polygones. Cache technique de l'instantané, comme les noms
 * (docs/satellite-view-contract.md, F201, F202).
 */
export type Outline = OutlinePolygon[];

export type Zone = {
  id: string;
  name: string;
  area: number | null;
  seasons: Season[];
  /** Absent : parcelle non dessinée dans OTF, ou cache antérieur à S3 (« contour absent »). */
  outline?: Outline;
};

export type PlotMode = 'garden' | 'greenhouse';

export type Plot = {
  id: string;
  zoneId: string;
  name: string;
  mode: PlotMode;
  length: number;
  width: number;
  area: number;
  seasons: Season[];
  /** Absent : jardin non dessiné dans OTF, ou cache antérieur à S3 (« contour absent »). */
  outline?: Outline;
};

export type Bed = {
  id: string;
  zoneId: string;
  plotId: string;
  name: string;
  length: number;
  width: number;
  alleyWidth: number | null;
  area: number;
  seasons: Season[];
};

/** Semaine ISO d'Ouvre ta ferme, `AAAA-Wss`, du lundi au dimanche (D-004). */
export type WeekKey = string;

/** Une espèce dans une série (docs/series-contract.md, « Vocabulaire »). */
export type CropCultivation = {
  id: string;
  plantId: string;
  plantName: string;
  /** Semaines de récolte réalisées, telles qu'OTF les tient. */
  harvestWeeks: WeekKey[];
  /** Semaines de récolte attendues. */
  harvestWeeksExpected: WeekKey[];
};

export type CropSeries = {
  id: string;
  name: string;
  season: Season;
  /** `block` : série posée sur un jardin entier, ignorée (D-022, règle 3). */
  use: 'bed' | 'block';
  cycle: 'annual' | 'perennial';
  cultivations: CropCultivation[];
};

/** Une planche occupée par une série, sur un certain linéaire. */
export type CropPlace = {
  id: string;
  seriesId: string;
  bedId: string;
  /** Linéaire occupé en mètres ; `null` quand OTF ne le donne pas. */
  lengthMeters: number | null;
};

/**
 * Une tâche de semis direct ou de plantation : la seule chose que le module
 * retient des tâches d'Ouvre ta ferme, pour calculer la semaine d'implantation.
 */
export type ImplantationTask = {
  id: string;
  seriesId: string;
  /** `null` : tâche posée sur la série entière, qui vaut pour toutes ses cultures. */
  cultivationId: string | null;
  kind: 'direct-sowing' | 'planting';
  plannedWeek: WeekKey | null;
  doneWeek: WeekKey | null;
  status: 'todo' | 'done';
};

/** Ce que la lecture a vu et écarté, pour le journal et les tests. */
type CropPlanReadSummary = {
  seriesRead: number;
  placesRead: number;
  tasksRead: number;
  tasksRetained: number;
  placesWithoutSeries: number;
  placesOfUnknownSeries: number;
  placesWithUnknownBed: number;
};

export type CropPlan = {
  series: CropSeries[];
  places: CropPlace[];
  implantationTasks: ImplantationTask[];
  readSummary: CropPlanReadSummary;
};

export type IrrigationSnapshot = {
  configuration: OtfConfiguration;
  structure: OtfStructure;
  zones: Zone[];
  plots: Plot[];
  beds: Bed[];
  /** Absent d'un cache antérieur à l'extension séries : « plan de culture non lu ». */
  cropPlan?: CropPlan;
  source: 'mock' | 'live' | 'cache';
  lastSuccessfulReadAt: string;
  warning?: string;
};
