import { cultivationPresence, isPresentOn } from '../crop-alerts/presence.ts';
import type { BedWaterDay } from '../crop-water/proposal.ts';
import type { IrrigationSnapshot } from '../domain.ts';
import type { FeatureId } from '../features/catalogue.ts';
import type { FeatureSelection } from '../features/selection.ts';
import type { SoilGaugeZone } from '../soil-reserve/gauge-view.ts';
import { gardenBedUnknown } from '../soil-reserve/signals.ts';
import { addDaysToDateKey } from '../water-management.ts';
import { compareNamesNaturally } from '../bed-order.ts';
import { ofName } from '../display-words.ts';
import {
  MEASURED_RAIN_ANCHOR,
  neverObservedSoilGardens,
  RAIN_GAUGE_MAX_AGE_DAYS,
  RELIABILITY_LINES_SHOWN,
  soilGardenAnchor,
  soilParcelAnchor,
  type ReliabilityAction,
} from './reliability.ts';
import { countText, dateWithYearText, daysBetween, sortedNames } from './today-text.ts';

/**
 * Le panneau « données manquantes », planche par planche (amélioration
 * n° 6, docs/ameliorations-6-2-3-7-contract.md, section 3, précisions F700,
 * F701, F710 et F711) : la liste fermée de la zone « Fiabilité du calcul » s'allonge de
 * trois données par planche — la réserve du sol non saisie, le stade deviné,
 * le pluviomètre absent —, calculées ici et nulle part ailleurs. Chaque ligne
 * a sa phrase, sa conséquence en clair et le geste qui la corrige, comme une
 * ligne de la zone. Une donnée dont la case n'est pas cochée ne compte pas.
 *
 * Le panneau informe : il n'écrit rien, ne change aucun calcul et n'entre
 * jamais dans le besoin, le planning, les priorités ni la dose (D-010,
 * D-041) ; il ne compte pas non plus dans la pastille du menu ni dans
 * l'anneau de la zone, qui gardent leurs cinq données (F710).
 */

/** Les trois données, dans l'ordre de leur effet sur le plan (section 3, règle 5). */
export const MISSING_BY_BED_KINDS = ['soil', 'stage', 'rain-gauge'] as const;
type MissingKind = (typeof MISSING_BY_BED_KINDS)[number];

/** La case dont chaque donnée dépend : décochée, la donnée ne compte pas (section 3, règle 2). */
const MISSING_FEATURE: Record<MissingKind, FeatureId> = {
  soil: 'sol',
  stage: 'cultures',
  'rain-gauge': 'besoins',
};

/** Les planches montrées d'emblée ; les autres derrière « Voir les n autres » : le seuil de la zone. */
const MISSING_BEDS_SHOWN = RELIABILITY_LINES_SHOWN;
/** Le groupe des planches sans culture en cours ce jour-là. */
export const NO_CULTURE_GROUP = 'Sans culture en cours';
/** L'ancre du dépliant « Par planche » : le lien « Ce qui manque » de la fin de l'accueil (4.4) l'ouvre. */
export const MISSING_BY_BED_ANCHOR = 'donnees-manquantes';

/** L'ancre du besoin de la culture d'une planche, sur la page « Matériel » : son formulaire « Déclarer un stade » (F710). */
export function bedStageAnchor(bedId: string): string {
  return `bed-stage-${bedId}`;
}

/** La planche désignée par l'ancre de son stade ; `null` pour une autre ancre. */
export function bedIdFromStageAnchor(hash: string): string | null {
  const prefix = `#${bedStageAnchor('')}`;
  return hash.startsWith(prefix) && hash.length > prefix.length ? decodeURIComponent(hash.slice(prefix.length)) : null;
}

/** Une planche de la saison, telle que le panneau la lit. */
export type MissingByBedBed = {
  bedId: string;
  bedName: string;
  zoneId: string;
  plotName: string;
  /** Sous abri, la pluie vaut 0 (D-032) : la planche ne dépend pas de la pluie. */
  sheltered: boolean;
  /** Les cultures présentes ce jour-là, dans l'ordre des noms ; vide sans culture en cours. */
  cultures: string[];
};

/** Une planche dont la jauge du sol est inconnue faute d'observation, ou faute de réserve utile (RFU). */
export type UnknownSoilBed = {
  bedId: string;
  plotId: string;
  plotName: string;
  /** La parcelle dont la RFU manque ; `null` : c'est l'observation qui manque. */
  withoutRfu: { zoneId: string; zoneName: string } | null;
};

/** Une culture en cours dont le stade du jour est placé d'après le calendrier, sans déclaration du maraîcher. */
export type GuessedStage = {
  bedId: string;
  seriesId: string;
  seriesName: string;
  plantName: string;
  stageLabel: string;
};

export type MissingByBedInputs = {
  enabled: FeatureSelection;
  /** Le jour de la ferme, `AAAA-MM-JJ`. */
  today: string;
  beds: readonly MissingByBedBed[];
  /** `null` : la jauge du sol n'est pas lue (case décochée). */
  unknownSoilBeds: readonly UnknownSoilBed[] | null;
  /** `null` : le besoin par culture n'est pas lu (case décochée, ou plan de culture absent). */
  guessedStages: readonly GuessedStage[] | null;
  /** Le jour de la dernière pluie mesurée lue, même `0 mm` ; `null` : aucune dans les trente derniers jours. */
  lastMeasuredRainOn: string | null;
};

type MissingLine = {
  kind: MissingKind;
  /** Unique dans le panneau : la donnée, la planche et, pour un stade, la série. */
  key: string;
  text: string;
  /** Toujours un lien vers le formulaire qui corrige la donnée. */
  action: Extract<ReliabilityAction, { kind: 'link' }>;
};

type MissingBed = {
  bedId: string;
  bedName: string;
  plotName: string;
  lines: MissingLine[];
  /** Rangée derrière « Voir les n autres ». */
  hidden: boolean;
};

type MissingGroup = {
  /** Les cultures en cours de ses planches, « Tomate », « Laitue, Radis », ou `NO_CULTURE_GROUP`. */
  culture: string;
  beds: MissingBed[];
};

export type MissingByBed = {
  groups: MissingGroup[];
  /** « 7 planches ont une donnée manquante » ; `null` quand tout est à jour. */
  total: string | null;
  /** La phrase calme quand aucune planche n'a de donnée manquante ; `null` sinon. */
  allClear: string | null;
  /** « Voir l’autre planche », « Voir les 2 autres planches » ; `null` quand tout est montré. */
  moreLabel: string | null;
};

export const MISSING_BY_BED_ALL_CLEAR = 'Tout est à jour : aucune planche n’a de donnée manquante.';

/** Le panneau existe quand au moins une de ses trois données est suivie. */
export function hasMissingByBed(enabled: FeatureSelection): boolean {
  return MISSING_BY_BED_KINDS.some((kind) => enabled.includes(MISSING_FEATURE[kind]));
}

/**
 * Les planches de la saison, chacune avec son jardin et les cultures
 * présentes ce jour-là (une culture semée ou plantée, jusqu'au dimanche de sa
 * dernière récolte). Une série posée sur un jardin entier n'a pas de planche
 * à elle et ne compte pas (D-022, règle 3).
 */
export function missingByBedBeds(snapshot: Pick<IrrigationSnapshot, 'plots' | 'beds' | 'cropPlan'>, season: number, today: string): MissingByBedBed[] {
  const plots = new Map(snapshot.plots.map((plot) => [plot.id, plot]));
  const cultures = new Map<string, string[]>();
  const plan = snapshot.cropPlan;
  for (const series of plan?.series ?? []) {
    if (series.season !== season || series.use !== 'bed') continue;
    const present = series.cultivations
      .map((cultivation) => cultivationPresence(series, cultivation, plan?.implantationTasks ?? []))
      .filter((presence) => presence !== null && isPresentOn(presence, today))
      .map((presence) => presence!.plantName);
    if (present.length === 0) continue;
    for (const place of plan?.places ?? []) {
      if (place.seriesId === series.id) cultures.set(place.bedId, [...(cultures.get(place.bedId) ?? []), ...present]);
    }
  }
  return snapshot.beds
    .filter((bed) => bed.seasons.includes(season))
    .map((bed) => {
      const plot = plots.get(bed.plotId);
      return {
        bedId: bed.id,
        bedName: bed.name,
        zoneId: bed.zoneId,
        plotName: plot?.name ?? '',
        sheltered: plot?.mode === 'greenhouse',
        cultures: sortedNames(cultures.get(bed.id) ?? []),
      };
    });
}

/**
 * Les planches dont la réserve du sol n'est pas saisie : celles, inconnues,
 * des jardins que la zone dit jamais observés ou sans RFU
 * (`neverObservedSoilGardens`, F25, J4), regroupées par planche et plus
 * seulement par jardin (F700).
 */
export function unknownSoilBeds(zones: readonly Pick<SoilGaugeZone, 'zoneId' | 'name' | 'plots'>[]): UnknownSoilBed[] {
  const gardens = new Map(neverObservedSoilGardens(zones).map((garden) => [garden.plotId, garden]));
  return zones.flatMap((zone) => zone.plots.flatMap((plot): UnknownSoilBed[] => {
    const garden = gardens.get(plot.plotId);
    if (!garden) return [];
    return plot.beds
      .filter((bed) => gardenBedUnknown({
        mode: bed.today?.mode ?? null,
        surfaceState: bed.today?.surfaceState ?? null,
        stateMm: bed.today?.startMm ?? null,
        capacityMm: bed.today?.capacityMm ?? null,
      }))
      .map((bed) => ({ bedId: bed.bedId, plotId: plot.plotId, plotName: plot.name, withoutRfu: garden.withoutRfu ?? null }));
  }));
}

/**
 * Les stades devinés du jour : une culture dont le stade et le Kc sont connus
 * (calculée, ou dont seule l'ET0 manque) et qu'aucune déclaration ne place —
 * le module la place d'après la date d'implantation et le calendrier de
 * référence (« stade déduit du calendrier », section 3). Un stade calculé
 * recalé sur une déclaration est un stade déclaré (D-057).
 */
export function guessedStages(beds: readonly { bedId: string; days: readonly BedWaterDay[] }[], today: string): GuessedStage[] {
  return beds.flatMap(({ bedId, days }) => {
    const day = days.find((candidate) => candidate.date === today);
    return (day?.crops ?? []).flatMap((crop): GuessedStage[] => {
      if (crop.status !== 'computed' && crop.status !== 'unknown') return [];
      if (crop.trace.stage.declaration !== null) return [];
      return [{ bedId, seriesId: crop.seriesId, seriesName: crop.seriesName, plantName: crop.plantName, stageLabel: crop.trace.stage.label }];
    });
  });
}

/** Le premier jour de la pluie mesurée qui compte encore : J − 30. */
export function rainGaugeLookbackStart(today: string): string {
  return addDaysToDateKey(today, -RAIN_GAUGE_MAX_AGE_DAYS);
}

const RAIN_GAUGE_CONSEQUENCE = 'La pluie vient de l’estimation météo, qui peut s’écarter du terrain.';
const STAGE_CONSEQUENCE = 'Le besoin proposé suit le calendrier, pas votre constat.';
const SOIL_CONSEQUENCE = 'La jauge de la planche reste inconnue.';

/** Le panneau : les planches qui ont une donnée manquante, rangées par culture puis par planche. */
export function missingByBed(input: MissingByBedInputs): MissingByBed {
  const on = (kind: MissingKind) => input.enabled.includes(MISSING_FEATURE[kind]);
  const soil = new Map((on('soil') ? input.unknownSoilBeds ?? [] : []).map((bed) => [bed.bedId, bed]));
  const stages = on('stage') ? input.guessedStages ?? [] : [];
  const rainLine = on('rain-gauge') ? rainGaugeText(input.lastMeasuredRainOn, input.today) : null;

  const entries = input.beds.flatMap((bed) => {
    const lines: MissingLine[] = [];
    const unknownSoil = soil.get(bed.bedId);
    if (unknownSoil) lines.push(soilLine(bed, unknownSoil));
    const own = stages
      .filter((stage) => stage.bedId === bed.bedId)
      .sort((a, b) => compareNamesNaturally(a.plantName, b.plantName) || compareNamesNaturally(a.seriesName, b.seriesName));
    for (const stage of own) lines.push(stageLine(bed, stage));
    // La pluie ne compte que pour une planche de plein champ qui porte une culture (section 3, règle 1).
    if (rainLine && !bed.sheltered && bed.cultures.length > 0) {
      lines.push({
        kind: 'rain-gauge',
        key: `rain-gauge:${bed.bedId}`,
        text: `${rainLine} ${RAIN_GAUGE_CONSEQUENCE}`,
        action: { kind: 'link', label: 'Saisir une pluie mesurée, même 0 mm', page: 'semaine', anchor: MEASURED_RAIN_ANCHOR },
      });
    }
    if (lines.length === 0) return [];
    return [{ bed, lines, rank: MISSING_BY_BED_KINDS.indexOf(lines[0].kind) }];
  });

  // Par effet sur le plan, puis par ordre naturel des noms (section 3, règle 5).
  entries.sort((a, b) => a.rank - b.rank || compareNamesNaturally(a.bed.bedName, b.bed.bedName));
  const groups = new Map<string, { rank: number; beds: typeof entries }>();
  for (const entry of entries) {
    const culture = entry.bed.cultures.length > 0 ? entry.bed.cultures.join(', ') : NO_CULTURE_GROUP;
    const group = groups.get(culture) ?? { rank: entry.rank, beds: [] };
    group.beds.push(entry);
    groups.set(culture, group);
  }
  const ordered = [...groups.entries()].sort(([nameA, a], [nameB, b]) => a.rank - b.rank
    || Number(nameA === NO_CULTURE_GROUP) - Number(nameB === NO_CULTURE_GROUP)
    || compareNamesNaturally(nameA, nameB));

  let index = 0;
  const result: MissingGroup[] = ordered.map(([culture, group]) => ({
    culture,
    beds: group.beds.map(({ bed, lines }) => ({ bedId: bed.bedId, bedName: bed.bedName, plotName: bed.plotName, lines, hidden: index++ >= MISSING_BEDS_SHOWN })),
  }));
  const hidden = Math.max(0, entries.length - MISSING_BEDS_SHOWN);
  return {
    groups: result,
    total: entries.length === 0 ? null : `${countText(entries.length, 'planche a', 'planches ont')} une donnée manquante`,
    allClear: entries.length === 0 ? MISSING_BY_BED_ALL_CLEAR : null,
    moreLabel: hidden === 0 ? null : hidden === 1 ? 'Voir l’autre planche' : `Voir les ${hidden} autres planches`,
  };
}

function soilLine(bed: MissingByBedBed, soil: UnknownSoilBed): MissingLine {
  const key = `soil:${bed.bedId}`;
  if (soil.withoutRfu) {
    return {
      kind: 'soil',
      key,
      text: `Réserve du sol non saisie : ce que le sol de la parcelle ${soil.withoutRfu.zoneName} retient (sa RFU) manque. ${SOIL_CONSEQUENCE}`,
      action: { kind: 'link', label: `Renseigner la réserve de la parcelle ${soil.withoutRfu.zoneName}`, page: 'sol', anchor: soilParcelAnchor(soil.withoutRfu.zoneId) },
    };
  }
  return {
    kind: 'soil',
    key,
    text: `Réserve du sol non saisie : le sol du jardin ${soil.plotName} n’a jamais été observé. ${SOIL_CONSEQUENCE}`,
    action: { kind: 'link', label: `Observer le sol ${ofName(soil.plotName)}`, page: 'sol', anchor: soilGardenAnchor(soil.plotId) },
  };
}

function stageLine(bed: MissingByBedBed, stage: GuessedStage): MissingLine {
  return {
    kind: 'stage',
    key: `stage:${bed.bedId}:${stage.seriesId}`,
    text: `Stade deviné : ${stage.plantName} (${stage.seriesName}), stade « ${stage.stageLabel} » d’après la date d’implantation et le calendrier. ${STAGE_CONSEQUENCE}`,
    action: { kind: 'link', label: 'Déclarer le stade', page: 'materiel', anchor: bedStageAnchor(bed.bedId), zone: bed.zoneId },
  };
}

/** La phrase du pluviomètre ; `null` quand une pluie mesurée de moins de trente et un jours est notée. */
function rainGaugeText(lastMeasuredRainOn: string | null, today: string): string | null {
  if (lastMeasuredRainOn === null) return 'Pluviomètre absent : aucune pluie mesurée n’est notée depuis plus de 30 jours.';
  const age = daysBetween(lastMeasuredRainOn, today);
  if (age <= RAIN_GAUGE_MAX_AGE_DAYS) return null;
  return `Pluviomètre absent : la dernière pluie mesurée date du ${dateWithYearText(lastMeasuredRainOn)} (${countText(age, 'jour', 'jours')}).`;
}

/** Le jour de la dernière pluie mesurée parmi les lignes lues, `0 mm` compris ; `null` sans aucune. */
export function lastMeasuredRainOn(rows: readonly { date: string; dataKind: string; precipitationMm: number | null }[]): string | null {
  let last: string | null = null;
  for (const row of rows) {
    if (row.dataKind !== 'manual_precipitation' || row.precipitationMm === null) continue;
    if (last === null || row.date > last) last = row.date;
  }
  return last;
}
