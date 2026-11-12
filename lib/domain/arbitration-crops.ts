import type { CropPlan } from './domain.ts';
import { cultivationDates, daysFromTo, isUnplacedCultivation, type CultivationDates } from './crop-water/crop-calendar.ts';
import type { CropWaterDay } from './crop-water/etm.ts';
import { addDaysToDateKey, weekStartDateKey } from './water-management.ts';

/**
 * Les cultures de chaque planche pour l'écran d'arbitrage façon plan
 * d'assolement (docs/shortage-contract.md, 2 bis, D-083) : la frise et la
 * phrase « Cette semaine ». Les dates sont celles du suivi par série
 * (`cultivationDates`) ; le stade et le Kc du jour, ceux du besoin par
 * culture. Une information pour aider le choix, qui n'entre dans aucun calcul.
 */

/** La frise de l'ordinateur : huit semaines avant la semaine en cours, neuf après. */
export const ARBITRATION_WEEKS_BEFORE = 8;
export const ARBITRATION_WEEKS_AFTER = 9;
/** Le nombre de teintes de la frise : une même espèce garde la sienne d'une planche à l'autre. */
const TONES = 6;

/** Le stade et le Kc du jour d'une culture, tels que le besoin par culture les calcule. */
export type BedStageToday = {
  cultivationId: string;
  plantName: string;
  stage: string | null;
  kc: number | null;
  /** Un engrais vert : l'état de la surface d'une planche nue, sans Kc (5 ter). */
  surfaceState: boolean;
};

export type ArbitrationTimelineCrop = {
  label: string;
  title: string;
  /** En semaines depuis la semaine en cours (0), négatives avant. */
  startWeek: number;
  harvestWeek: number | null;
  /** `null` : fin inconnue, la barre va au bord de la frise. */
  endWeek: number | null;
  /** La culture n'est pas encore sur la planche. */
  planned: boolean;
  tone: number;
};

export type ArbitrationBedCrops = {
  crops: ArbitrationTimelineCrop[];
  /** Les cultures en place aujourd'hui, de la plus ancienne à la plus récente. */
  present: string[];
  week: { main: string; detail: string | null };
};

export type ArbitrationCrops = { weekStart: string; beds: Record<string, ArbitrationBedCrops> };

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const kcNumber = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const day = (dateKey: string) => dayMonth.format(new Date(`${dateKey}T12:00:00Z`));
const weeksFrom = (weekStart: string, dateKey: string) => Math.floor(daysFromTo(weekStart, dateKey) / 7);
const IMPLANTED = ['cette semaine', 'la semaine dernière', 'il y a deux semaines'];

export function arbitrationCrops(input: {
  cropPlan: CropPlan;
  bedIds: readonly string[];
  today: string;
  stagesToday?: ReadonlyMap<string, readonly BedStageToday[]>;
}): ArbitrationCrops {
  const weekStart = weekStartDateKey(input.today);
  const seriesByBed = new Map<string, Set<string>>();
  for (const place of input.cropPlan.places) {
    const series = seriesByBed.get(place.bedId) ?? new Set<string>();
    series.add(place.seriesId);
    seriesByBed.set(place.bedId, series);
  }
  const beds: Record<string, ArbitrationBedCrops> = {};
  for (const bedId of input.bedIds) {
    const onBed = seriesByBed.get(bedId);
    const crops: CultivationDates[] = [];
    for (const series of input.cropPlan.series) {
      if (!onBed?.has(series.id)) continue;
      for (const cultivation of series.cultivations) {
        const dates = cultivationDates(series, cultivation, input.cropPlan.implantationTasks, input.today);
        if (!isUnplacedCultivation(dates)) crops.push(dates);
      }
    }
    crops.sort((a, b) => a.presenceStart.localeCompare(b.presenceStart) || a.plantName.localeCompare(b.plantName, 'fr'));
    beds[bedId] = bedCrops(crops, input.today, weekStart, input.stagesToday?.get(bedId) ?? []);
  }
  return { weekStart, beds };
}

/** Le stade et le Kc du jour de chaque culture présente, depuis les jours du besoin par culture. */
export function stagesToday(crops: readonly CropWaterDay[]): BedStageToday[] {
  return crops.flatMap((crop) => {
    if (crop.status === 'absent') return [];
    const traced = crop.status === 'computed' || crop.status === 'unknown' ? crop.trace : null;
    return [{
      cultivationId: crop.cultivationId, plantName: crop.plantName,
      stage: traced ? traced.stage.label : null, kc: traced ? traced.kc.kc : null,
      surfaceState: crop.status === 'surface-state',
    }];
  });
}

function bedCrops(crops: CultivationDates[], today: string, weekStart: string, stages: readonly BedStageToday[]): ArbitrationBedCrops {
  const inPlace = crops.filter((crop) => crop.presenceStart <= today && (crop.lastHarvest === null || crop.lastHarvest >= today));
  return {
    crops: crops.map((crop) => timelineCrop(crop, today, weekStart))
      .filter((crop) => (crop.endWeek === null || crop.endWeek >= -ARBITRATION_WEEKS_BEFORE) && crop.startWeek <= ARBITRATION_WEEKS_AFTER),
    present: inPlace.map((crop) => crop.plantName),
    week: { main: mainPhrase(inPlace[0], crops, today, weekStart), detail: detailPhrase(inPlace, crops, today, stages) },
  };
}

function timelineCrop(crop: CultivationDates, today: string, weekStart: string): ArbitrationTimelineCrop {
  const planned = crop.presenceStart > today;
  const harvest = crop.firstHarvest !== null && crop.lastHarvest !== null
    ? ` · récolte du ${day(crop.firstHarvest)} au ${day(crop.lastHarvest)}`
    : '';
  return {
    label: crop.plantName,
    title: `${crop.plantName} · ${crop.seriesName} · ${planned ? 'prévu à partir du' : 'en place depuis le'} ${day(crop.presenceStart)}${harvest}`,
    startWeek: weeksFrom(weekStart, crop.presenceStart),
    harvestWeek: crop.firstHarvest === null ? null : weeksFrom(weekStart, crop.firstHarvest),
    endWeek: crop.lastHarvest === null ? null : weeksFrom(weekStart, crop.lastHarvest),
    planned,
    tone: toneOf(crop.plantName),
  };
}

/** La phrase de la culture en place la plus ancienne : la première règle qui s'applique (2 bis, point 4). */
function mainPhrase(crop: CultivationDates | undefined, crops: readonly CultivationDates[], today: string, weekStart: string): string {
  if (!crop) {
    const ended = crops.flatMap((item) => item.lastHarvest !== null && item.lastHarvest < today ? [item.lastHarvest] : []).sort().at(-1);
    return ended ? `Planche nue depuis le ${day(addDaysToDateKey(ended, 1))}` : 'Planche nue';
  }
  const weekEnd = addDaysToDateKey(weekStart, 6);
  const { firstHarvest, lastHarvest } = crop;
  if (firstHarvest !== null && firstHarvest <= weekEnd) {
    if (lastHarvest !== null && lastHarvest <= weekEnd) return 'Dernière semaine de récolte';
    if (firstHarvest >= weekStart) return 'Première récolte cette semaine';
    if (firstHarvest >= addDaysToDateKey(weekStart, -7)) return 'Première récolte la semaine dernière';
    return lastHarvest === null ? 'En récolte' : `En récolte jusqu’au ${day(lastHarvest)}`;
  }
  if (firstHarvest === addDaysToDateKey(weekStart, 7)) return 'Première récolte la semaine prochaine';
  const weeksAgo = weeksFrom(crop.dayZero, weekStart);
  if (weeksAgo >= 0 && weeksAgo < IMPLANTED.length) return `${crop.implantationKind === 'direct-sowing' ? 'Semis' : 'Plantation'} ${IMPLANTED[weeksAgo]}`;
  if (firstHarvest !== null) return `Récolte à partir du ${day(firstHarvest)}`;
  return `En place depuis le ${day(crop.presenceStart)}`;
}

/** Le stade et le Kc du jour de chaque culture en place, puis la prochaine culture prévue. */
function detailPhrase(inPlace: readonly CultivationDates[], crops: readonly CultivationDates[], today: string, stages: readonly BedStageToday[]): string | null {
  const named = inPlace.length > 1;
  const stageTexts = inPlace.flatMap((crop) => {
    const stage = stages.find((item) => item.cultivationId === crop.cultivationId);
    const text = !stage ? null
      : stage.surfaceState ? 'engrais vert'
        : stage.stage !== null && stage.kc !== null ? `${stage.stage} · Kc ${kcNumber.format(stage.kc)}` : null;
    return text === null ? [] : [named ? `${crop.plantName} : ${text}` : text];
  });
  const next = crops.find((crop) => crop.presenceStart > today);
  const parts = [
    ...(stageTexts.length ? [stageTexts.join(' ; ')] : []),
    ...(next ? [`${next.plantName} à partir du ${day(next.presenceStart)}`] : []),
  ];
  return parts.length ? parts.join(' · ') : null;
}

function toneOf(name: string): number {
  let hash = 0;
  for (const char of name.normalize('NFC').toLocaleLowerCase('fr')) hash = (hash * 31 + char.codePointAt(0)!) % 100_003;
  return hash % TONES;
}
