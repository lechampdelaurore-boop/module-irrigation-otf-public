import { celsiusText } from '../crop-alerts/text.ts';
import type { CropAlertsScreen } from '../crop-alerts/view.ts';
import type { FeatureId } from '../features/catalogue.ts';
import type { IrrigationPageId } from '../features/pages.ts';
import type { FeatureSelection } from '../features/selection.ts';
import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import type { StoredProposal, StoredWeeklyPlan } from '../planning/contract.ts';
import { addDaysToDateKey } from '../water-management.ts';
import type { WaterInfrastructure } from '../water-resources.ts';
import {
  evaluateWeatherAlertCriterion,
  weatherAlertCrossingText,
  type WeatherAlertCriterion,
  type WeatherAlertForecastDay,
} from '../weather/weather-alerts.ts';
import { FROST_TEMPLATE, FROST_TEMPLATE_ANCHOR } from '../weather/weather-alert-templates.ts';
import type { SoilGaugeZone } from '../soil-reserve/gauge-view.ts';
import { todayShortage, todayTomorrow, type TodayShortage, type TodayTomorrow } from './ahead.ts';
import { allDone, type AllDone } from './all-done.ts';
import { dayTimeline, lateItems, type DayTimeline, type LateItem } from './day-plan.ts';
import { todayHeadline, type TodayHeadline } from './headline.ts';
import {
  hasReliabilityZone,
  reliabilityChecks,
  reliabilityLines,
  reliabilityZone,
  type ReliabilityCheck,
  type ReliabilityInputs,
  type ReliabilityZone,
} from './reliability.ts';
import { todaySoil, type TodaySoil } from './soil.ts';
import { nowIrrigationLines, type TodayNowLine } from './now-irrigations.ts';
import { todayWeek, type TodayWeek, type TodayWeekInputs } from './week.ts';
import { lateIrrigationLines, NOTHING_LATE, NOTHING_TO_DO, todayTodoLines, type TodayIrrigationLine } from './today-irrigations.ts';
import { countText, farmDateKey, farmHourText, namesText, shortDayText } from './today-text.ts';
import { waterBlock, type TodayWaterBlock } from './water.ts';
import { weatherDays, weatherScale, type DayAnnouncements, type TodayWeatherDay, type TodayWeatherScale } from './weather-days.ts';

/**
 * La page « Aujourd'hui » (audit ergonomique, point 1, 3.8 quater lot 2,
 * docs/audit-ergonomie-lot2-contract.md, section 5, précisions F1 à F4) : la
 * réponse à la question du matin, en cinq blocs, chacun présent seulement si
 * sa case est cochée et jamais caché parce qu'il est vide. La page ne
 * calcule rien de nouveau : elle range ce que le planning, les arrosages,
 * les alertes et les ressources savent déjà. Le jour est celui de la ferme
 * (D-004) ; une donnée inconnue n'est jamais lue comme « tout va bien »
 * (D-003).
 */

/** La saison du jour de la ferme (F2) : « Aujourd'hui » montre toujours le jour du jour, de la saison courante. */
export function todaySeason(now: Date): number {
  return Number(farmDateKey(now).slice(0, 4));
}

/** Les jours du bloc « Gel ou chaleur » : aujourd'hui et les deux suivants. */
export const TODAY_WEATHER_DAYS = 3;

export type TodayWeatherInputs = {
  /** Les prévisions conservées des trois jours, celles que lisent les alertes. */
  forecasts: readonly WeatherAlertForecastDay[];
  /** Le gel par culture des alertes cultures ; `null` quand la case n'est pas cochée. */
  frost: CropAlertsScreen['upcoming']['frost'] | null;
  /** Les critères de l'exploitation ; `null` quand « Alertes météo » n'est pas coché. */
  criteria: readonly WeatherAlertCriterion[] | null;
};

export type TodayWeatherBlock = {
  kind: 'weather';
  /** `alert` : barre rouge et bloc en tête ; `unknown` : une prévision manque ; `calm` : rien d'annoncé. */
  tone: 'alert' | 'unknown' | 'calm';
  lines: string[];
  link: { label: string; page: IrrigationPageId };
  /** Les trois jours dessinés : températures sur l'échelle commune, pluie prévue, ce qui est annoncé. */
  days: TodayWeatherDay[];
  scale: TodayWeatherScale;
  /**
   * Un gel annoncé que ni les cultures ni une alerte de gel active ne disent
   * (J14, F283) ; `null` sinon. À part des lignes : il se lit toujours à
   * l'écran, même quand une autre alerte rend les lignes au seul lecteur
   * d'écran, et le ton du bloc ne change pas (aucune alerte ne se déclenche).
   */
  unposedFrost: TodayUnposedFrost | null;
};

type TodayUnposedFrost = {
  /** « −2,4 °C annoncé le mer. 18 nov. et aucune alerte de gel posée. » */
  text: string;
  /** Le modèle de gel mis en vue sur « Alertes météo », rien d'enregistré (F284) ; ou l'alerte désactivée. */
  link: { label: string; page: 'alertes-meteo'; anchor: string };
};

export const FORECAST_UNAVAILABLE = 'Prévision indisponible : à vérifier.';

function hasForecast(forecasts: readonly WeatherAlertForecastDay[], date: string): boolean {
  return forecasts.some((day) => day.date === date && (day.minimumTemperatureCelsius !== null || day.maximumTemperatureCelsius !== null));
}

/** « le sam. 14 nov. », « le sam. 14 nov. et le dim. 15 nov. ». */
function daysText(dates: readonly string[]): string {
  const days = dates.map((date) => `le ${shortDayText(date)}`);
  return days.length <= 1 ? (days[0] ?? '') : `${days.slice(0, -1).join(', ')} et ${days[days.length - 1]}`;
}

/** Bloc a : le gel des cultures et les alertes de l'exploitation des trois jours, aujourd'hui compris. */
export function weatherBlock(input: TodayWeatherInputs, enabled: FeatureSelection, now: Date): TodayWeatherBlock {
  const today = farmDateKey(now);
  const days = Array.from({ length: TODAY_WEATHER_DAYS }, (_, index) => addDaysToDateKey(today, index));
  const frostOn = enabled.includes('alertes-cultures') && input.frost !== null;
  const criteriaOn = enabled.includes('alertes-meteo') && input.criteria !== null;
  const lines: string[] = [];

  const frostDays = frostOn ? (input.frost ?? []).filter((day) => days.includes(day.date) && day.crops.length > 0) : [];
  const announcements = new Map<string, DayAnnouncements>(days.map((date) => [date, { frost: null, alerts: [] }]));
  const announce = (date: string, change: (day: DayAnnouncements) => DayAnnouncements) => {
    const day = announcements.get(date);
    if (day) announcements.set(date, change(day));
  };
  for (const day of frostDays) announce(day.date, (item) => ({ ...item, frost: { minimumCelsius: day.minimumCelsius, crops: day.crops.map((crop) => crop.name) } }));
  if (frostDays.length > 0) {
    const coldest = [...frostDays].sort((a, b) => a.minimumCelsius - b.minimumCelsius || a.date.localeCompare(b.date))[0];
    const crops = [...new Set([coldest, ...frostDays.filter((day) => day !== coldest)].flatMap((day) => day.crops.map((crop) => crop.name)))];
    lines.push(`Gel annoncé le ${shortDayText(coldest.date)} : ${celsiusText(coldest.minimumCelsius)}. ${countText(crops.length, 'culture', 'cultures')} : ${namesText(crops)}.`);
  }
  const frostAnnounced = lines.length > 0;
  if (criteriaOn) {
    for (const criterion of input.criteria ?? []) {
      const evaluation = evaluateWeatherAlertCriterion({
        criterion: { ...criterion, horizonDays: Math.min(criterion.horizonDays, TODAY_WEATHER_DAYS) },
        forecasts: input.forecasts,
        today,
        alertedDates: new Set(),
      });
      const first = evaluation.crossings[0];
      if (first) lines.push(sentence(`${weatherAlertCrossingText(criterion, first.value)} le ${shortDayText(first.date)}`));
      for (const crossing of evaluation.crossings) {
        announce(crossing.date, (item) => ({ ...item, alerts: [...item.alerts, weatherAlertCrossingText(criterion, crossing.value)] }));
      }
    }
  }

  const criteriaAnnounced = lines.length > (frostAnnounced ? 1 : 0);
  const unposedFrost = criteriaOn && !frostAnnounced ? unposedFrostText(input, days) : null;

  // Un jour sans prévision n'est jamais lu comme un jour calme (D-003, cas 6).
  const missing = days.filter((date) => !hasForecast(input.forecasts, date));
  const tone = lines.length > 0 ? 'alert' : missing.length > 0 ? 'unknown' : 'calm';
  if (missing.length === days.length) lines.push(FORECAST_UNAVAILABLE);
  else if (missing.length > 0) lines.push(`Prévision indisponible ${daysText(missing)} : à vérifier.`);
  // La phrase calme ne se dit pas à côté d'un gel annoncé sans alerte posée (J14) : elle serait vraie et trompeuse.
  if (tone === 'calm' && !unposedFrost) lines.push(calmWeatherText(frostOn, criteriaOn, days[days.length - 1]));
  const forecasts = input.forecasts.filter((day) => days.includes(day.date));
  const scale = weatherScale(forecasts);
  return {
    kind: 'weather',
    tone,
    lines,
    link: { label: 'Voir les alertes', page: weatherLinkPage(enabled, frostAnnounced, criteriaAnnounced) },
    days: weatherDays({ dates: days, today, forecasts, announcements, scale }),
    scale,
    unposedFrost,
  };
}

/**
 * J14 (audit ergonomique final, lot A, F283, F284) : une minimale prévue à
 * 0 °C ou moins, comme le flocon de la carte du jour, sans alerte de gel
 * active (une alerte sur la minimale, vers le bas) ni gel des cultures
 * annoncé. La phrase le dit et mène au modèle de gel, à poser sur « Alertes
 * météo » ; rien ne s'enregistre depuis « Aujourd'hui » (D-028). Une minimale
 * inconnue ne dit rien (D-003). Seule la phrase change : les seuils, les
 * alertes et leurs envois non.
 */
function unposedFrostText(input: TodayWeatherInputs, days: readonly string[]): TodayUnposedFrost | null {
  const frostCriteria = (input.criteria ?? []).filter((criterion) => criterion.field === 'minimum-temperature' && criterion.direction === 'below');
  if (frostCriteria.some((criterion) => criterion.active)) return null;
  const coldest = input.forecasts
    .filter((day) => days.includes(day.date) && day.minimumTemperatureCelsius !== null && day.minimumTemperatureCelsius <= 0)
    .sort((a, b) => (a.minimumTemperatureCelsius ?? 0) - (b.minimumTemperatureCelsius ?? 0) || a.date.localeCompare(b.date))[0];
  if (!coldest || coldest.minimumTemperatureCelsius === null) return null;
  const announced = `${celsiusText(coldest.minimumTemperatureCelsius)} annoncé le ${shortDayText(coldest.date)}`;
  return frostCriteria.length > 0
    ? { text: `${announced} et votre alerte de gel est désactivée.`, link: { label: 'Voir les alertes météo', page: 'alertes-meteo', anchor: 'weather-alerts' } }
    : { text: `${announced} et aucune alerte de gel posée.`, link: { label: `Poser « ${FROST_TEMPLATE.title} »`, page: 'alertes-meteo', anchor: FROST_TEMPLATE_ANCHOR } };
}

/**
 * « Voir les alertes » mène à la page de ce qui est annoncé : le gel des
 * cultures d'abord, sinon les alertes de l'exploitation ; rien d'annoncé, la
 * page des alertes cultures quand elle est cochée.
 */
function weatherLinkPage(enabled: FeatureSelection, frostAnnounced: boolean, criteriaAnnounced: boolean): IrrigationPageId {
  if (frostAnnounced) return 'alertes-cultures';
  if (criteriaAnnounced) return 'alertes-meteo';
  return enabled.includes('alertes-cultures') ? 'alertes-cultures' : 'alertes-meteo';
}

/** F28 : la phrase calme ne dit que ce qui a été regardé. */
function calmWeatherText(frostOn: boolean, criteriaOn: boolean, lastDay: string): string {
  const until = `d’ici le ${shortDayText(lastDay)}`;
  if (frostOn && criteriaOn) return sentence(`Pas de gel annoncé pour vos cultures ni d’alerte météo ${until}`);
  if (frostOn) return sentence(`Pas de gel annoncé pour vos cultures ${until}`);
  return sentence(`Aucune de vos alertes météo ne se déclenche ${until}`);
}

/** Le point final, sans le doubler après une abréviation (« 14 nov. »). */
function sentence(text: string): string {
  return text.endsWith('.') ? text : `${text}.`;
}

type TodayIrrigationBlock<K extends 'late' | 'todo'> = { kind: K; lines: TodayIrrigationLine[]; empty: string | null };
/** Les retards gardent leurs lignes ; `items` les range pour le tableau de bord, les jours chargés repliés (T2). */
type TodayLateBlock = TodayIrrigationBlock<'late'> & { items: LateItem[] };
type TodayReliabilityBlock = {
  kind: 'reliability';
  zone: ReliabilityZone;
  /** L'anneau : une ligne par donnée suivie, à jour ou à rafraîchir (T6). */
  checks: ReliabilityCheck[];
};
export type TodayBlock = TodayWeatherBlock | TodayLateBlock | TodayIrrigationBlock<'todo'> | TodayWaterBlock | TodayReliabilityBlock;

/**
 * « Votre journée » et « Gel ou chaleur » à l'ordinateur (audit final, lot A,
 * J13, F287) : côte à côte quand la journée a des irrigations ; sans rien à
 * rattraper ni à faire, la journée est courte, et « Gel ou chaleur » passe
 * dessous, sans grand vide à côté de lui.
 */
export function dayRowLayout(lateCount: number, todoCount: number): 'wide' | 'stack' {
  return lateCount + todoCount === 0 ? 'stack' : 'wide';
}

/** La ligne du dernier calcul du plan ; le lien mène au planning quand il n'y en a pas. */
export type TodayPlanLine = { text: string; linkToPlanning: boolean };

export function planLine(computedAt: string | null, now: Date): TodayPlanLine {
  if (computedAt === null) return { text: 'Plan non calculé : ouvrir le planning', linkToPlanning: true };
  const day = farmDateKey(computedAt);
  const when = day === farmDateKey(now) ? 'aujourd’hui' : `le ${shortDayText(day)}`;
  return { text: `Plan calculé ${when} à ${farmHourText(computedAt)}`, linkToPlanning: false };
}

export type TodayInputs = {
  enabled: FeatureSelection;
  now: Date;
  weather: TodayWeatherInputs;
  /** Les irrigations de la saison, comme la page des arrosages les lit. */
  events: readonly IrrigationEventRecord[];
  lateToleranceMinutes: number;
  /** Le dernier plan de la semaine ; `null` quand le planning n'est pas coché ou qu'aucun calcul n'existe. */
  plan: { computedAt: string; proposals: readonly StoredProposal[] } | null;
  /**
   * Le même plan, tel que le planning le lit pour sa phrase de pénurie (lot A,
   * R1, F276) ; `null` quand le planning n'est pas coché ou qu'aucun calcul
   * n'existe.
   */
  shortagePlan: Pick<StoredWeeklyPlan, 'calculation' | 'proposals'> | null;
  bedNames: ReadonlyMap<string, string>;
  /** Le jardin de chaque planche, pour montrer d'abord les jardins arrosés aujourd'hui (lot H, F430 et F431). */
  bedPlots?: ReadonlyMap<string, string>;
  /** `null` quand « Ressources et pompes » n'est pas coché. */
  infrastructure: WaterInfrastructure | null;
  reliability: Omit<ReliabilityInputs, 'enabled' | 'now' | 'planComputedAt' | 'reservoirs'>;
  /** La semaine en cours lue dans le tableau des besoins ; `null` quand « Objectifs et besoins » n'est pas coché ou pas lu (la pastille). */
  week: TodayWeekInputs | null;
  /** La jauge du sol, ou la raison de son absence ; `null` quand « Réserve du sol » n'est pas coché ou pas lu. */
  soil: { zones: readonly Pick<SoilGaugeZone, 'plots'>[] } | { unavailable: string } | null;
};

export type TodayView = {
  today: string;
  /** `null` quand le planning n'est pas coché. */
  plan: TodayPlanLine | null;
  blocks: TodayBlock[];
  /** F12 : les lignes de fiabilité et les irrigations en retard ; `null` à zéro, pas de pastille. */
  badge: number | null;
  /** La date, la phrase de résumé et les pastilles du tableau de bord. */
  headline: TodayHeadline;
  /** Ce qui coule ou attend d'être repris, en tête de « Votre journée » (lot H, n° 2, F433 et F434) ; vide sans planning ni arrosages. */
  current: TodayNowLine[];
  /** La frise des irrigations du jour ; `null` sans irrigation aujourd'hui ou sans planning ni arrosages. */
  timeline: DayTimeline | null;
  /** « Tout est fait » : ce que le bouton enregistrera ; `null` sans rien à couvrir, pas de bouton (section 3.4). */
  allDone: AllDone | null;
  /** « La semaine » et « Eau de la semaine » ; `null` sans « Objectifs et besoins » ou sans planche de la saison. */
  week: TodayWeek | null;
  /** « Réserve du sol » ; `null` sans la case. */
  soil: TodaySoil | null;
  /** Les arrosages de demain à valider (lot A, R1, F274) ; `null` sans « Planning » ou sans proposition demain. */
  tomorrow: TodayTomorrow | null;
  /** L'eau qui manque à la semaine, la phrase du planning (F276) ; `null` sans « Planning » ou sans manque. */
  shortage: TodayShortage | null;
};

/** Les jardins d'une irrigation d'aujourd'hui : en cours, reliquat, en retard, planifiée ou à valider (F430). */
function gardensIrrigatedToday(lines: readonly { bedIds: readonly string[] }[], bedPlots: ReadonlyMap<string, string> | undefined): Set<string> {
  return new Set(lines.flatMap((line) => line.bedIds.flatMap((bedId) => {
    const plotId = bedPlots?.get(bedId);
    return plotId ? [plotId] : [];
  })));
}

export function todayView(input: TodayInputs): TodayView {
  const { enabled, now } = input;
  const on = (feature: FeatureId) => enabled.includes(feature);
  const irrigationsOn = on('planning') || on('arrosages');
  const reliabilityInputs: ReliabilityInputs = {
    ...input.reliability,
    enabled,
    now,
    planComputedAt: input.plan?.computedAt ?? null,
    reservoirs: (input.infrastructure?.reservoirs ?? [])
      .filter((reservoir) => reservoir.status === 'active')
      .map((reservoir) => ({ id: reservoir.id, name: reservoir.name, observedAt: reservoir.currentVolumeObservedAt })),
  };
  const reliability = reliabilityLines(reliabilityInputs);
  const late = irrigationsOn ? lateIrrigationLines({ ...input, enabled, now }) : [];
  const current = irrigationsOn ? nowIrrigationLines({ enabled, now, events: input.events, bedNames: input.bedNames }) : [];
  const todo = irrigationsOn ? todayTodoLines({ ...input, enabled, now, proposals: on('planning') ? input.plan?.proposals ?? [] : null }) : [];
  const blocks: TodayBlock[] = [];
  const weather = on('alertes-cultures') || on('alertes-meteo') ? weatherBlock(input.weather, enabled, now) : null;
  if (weather) blocks.push(weather);
  if (irrigationsOn) {
    blocks.push({ kind: 'late', lines: late, empty: late.length === 0 ? NOTHING_LATE : null, items: lateItems(late, now) });
    blocks.push({ kind: 'todo', lines: todo, empty: todo.length === 0 ? NOTHING_TO_DO : null });
  }
  if (on('ressources') && input.infrastructure) blocks.push(waterBlock(input.infrastructure, now));
  const reliabilityOn = hasReliabilityZone(enabled);
  if (reliabilityOn) blocks.push({ kind: 'reliability', zone: reliabilityZone(reliability), checks: reliabilityChecks(reliabilityInputs, reliability) });
  const count = reliability.length + late.length;
  const today = farmDateKey(now);
  const irrigatedToday = gardensIrrigatedToday([...current, ...late, ...todo], input.bedPlots);
  // Ce qui attend après le jour ne se dit que « Planning » coché (lot A, R1) : le plan de la semaine en décide.
  const tomorrow = on('planning') && input.plan ? todayTomorrow(input.plan.proposals, now) : null;
  const shortage = on('planning') && input.shortagePlan ? todayShortage(input.shortagePlan, enabled, input.now) : null;
  return {
    today,
    plan: on('planning') ? planLine(input.plan?.computedAt ?? null, now) : null,
    blocks,
    badge: count === 0 ? null : count,
    headline: todayHeadline({
      today,
      irrigations: irrigationsOn ? { current, late, todo } : null,
      weather: weather ? { tone: weather.tone, days: weather.days, calmText: weather.tone === 'calm' && !weather.unposedFrost ? weather.lines[weather.lines.length - 1] ?? null : null, unposedFrost: weather.unposedFrost } : null,
      reliabilityCount: reliabilityOn ? reliability.length : null,
      tomorrow,
      shortage,
    }),
    current,
    timeline: irrigationsOn ? dayTimeline([...late, ...todo], now) : null,
    allDone: irrigationsOn ? allDone({ lines: [...late, ...todo], events: input.events, now }) : null,
    week: on('besoins') && input.week ? todayWeek(input.week, irrigatedToday) : null,
    soil: on('sol') && input.soil ? todaySoil(input.soil, irrigatedToday) : null,
    tomorrow,
    shortage,
  };
}
