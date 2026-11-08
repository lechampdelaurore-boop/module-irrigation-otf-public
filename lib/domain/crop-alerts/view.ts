import type { CropSeries, ImplantationTask } from '../domain.ts';
import { unavailableForecastMessage } from '../weather/weather-alerts.ts';
import { evaluateDrying, type DryingDeadline } from './drying.ts';
import { evaluateFrost, frostSubjects, type FrostForecastDay } from './frost.ts';
import { cultivationPresence, isPresentOn } from './presence.ts';
import { frostMarginsOf, type CropAlertSettings } from './settings.ts';
import { evaluateSprinklers, type SprinklerEvaluation, type SprinklerForecastDay, type SprinklerSlot } from './sprinkler.ts';
import { celsiusText, dayText, listText } from './text.ts';
import {
  frostAlertThresholdCelsius,
  frostMarginCelsius,
  resolveDryingDays,
  resolveFrostThreshold,
  type CropAlertCommonEntry,
  type DryingRevision,
  type FrostLinkRevision,
} from './thresholds.ts';

/**
 * L'encart « Alertes cultures » (docs/weather-crop-alerts-contract.md,
 * « L'écran ») : les seuils de gel des cultures présentes ou à venir de la
 * saison, celles qui n'en ont pas, les délais de séchage, et les prochaines
 * échéances — ce que la prévision actuelle ferait alerter si elle se
 * confirme, les dates d'arrêt d'arrosage à venir, les aspersions qu'elle
 * ferait reconsidérer. Rien n'est envoyé ni enregistré ici.
 */

/** Une entrée du jeu commun telle que l'écran la montre : avec sa confiance et sa source. */
export type CropAlertCommonView = CropAlertCommonEntry & { confidence: string; source: string };

/** Une ligne de la table des seuils : une espèce, ou l'exception d'une de ses séries. */
export type FrostThresholdRow = {
  subjectKey: string;
  plantId: string;
  /** `null` : la ligne de l'espèce ; sinon l'exception de cette série. */
  seriesId: string | null;
  name: string;
  status: 'missing' | 'none' | 'threshold';
  damageCelsius: number | null;
  marginCelsius: number | null;
  /** Dégâts + marge + curseur de microclimat. */
  alertCelsius: number | null;
  source: 'common' | 'farm' | null;
  commonKey: string | null;
  /** L'entrée du jeu commun rattachée, rappelée à côté d'une valeur de la ferme. */
  common: CropAlertCommonView | null;
  presentToday: boolean;
  /** Les séries de l'espèce présentes ou à venir, pour une exception. */
  series: { id: string; name: string }[];
};

/** Le délai de séchage d'une espèce : du jeu commun, corrigé par la ferme, ou retiré par elle. */
export type DryingRow = {
  plantId: string;
  name: string;
  dryingDays: number | null;
  origin: 'common' | 'farm';
};

type FrostUpcomingDay = {
  date: string;
  minimumCelsius: number;
  crops: { name: string; alertCelsius: number; underShelter: boolean; alreadyAlerted: boolean }[];
};

type SprinklerUpcoming = SprinklerEvaluation['flags'][number];

export type CropAlertsScreen = {
  today: string;
  settings: CropAlertSettings;
  common: CropAlertCommonView[];
  frost: FrostThresholdRow[];
  withoutThreshold: FrostThresholdRow[];
  drying: DryingRow[];
  /** Les espèces de la saison sans délai de séchage, auxquelles la ferme peut en donner un. */
  speciesWithoutDrying: { plantId: string; name: string }[];
  upcoming: {
    frost: FrostUpcomingDay[];
    /** « Prévision indisponible pour le mardi 10 novembre. », ou rien. */
    frostUnavailable: string | null;
    drying: DryingDeadline[];
    sprinkler: SprinklerUpcoming[];
    /** « Ensoleillement non prévu pour … », ou rien. */
    sunshineUnavailable: string | null;
    /** La position du lieu météo manque : les aspersions ne sont pas jugées. */
    sprinklerUnjudged: boolean;
  };
};

/** La prévision d'un jour pour l'écran : celle que lit l'évaluation. */
export type CropAlertForecast = FrostForecastDay & SprinklerForecastDay;

export function cropAlertsScreen(input: {
  today: string;
  settings: CropAlertSettings;
  /** La saison affichée : ses espèces font la table des seuils. */
  season: number;
  /** Toutes les séries de l'instantané, comme pour l'envoi. */
  series: readonly CropSeries[];
  tasks: readonly ImplantationTask[];
  shelteredSeriesIds: ReadonlySet<string>;
  bedNamesBySeries: ReadonlyMap<string, readonly string[]>;
  common: readonly CropAlertCommonView[];
  frostRevisions: readonly FrostLinkRevision[];
  dryingRevisions: readonly DryingRevision[];
  forecasts: readonly CropAlertForecast[];
  alertedFrostKeys: ReadonlySet<string>;
  alertedSprinklerKeys: ReadonlySet<string>;
  alertedDryingSeries: ReadonlySet<string>;
  /** Les créneaux d'aspersion du plan de la semaine ; `null` sans plan. */
  sprinklerSlots: readonly SprinklerSlot[] | null;
  location: { latitude: number; longitude: number } | null;
}): CropAlertsScreen {
  const common = new Map(input.common.map((entry) => [entry.key, entry]));
  const species = speciesOfSeason(input.series.filter((series) => series.season === input.season), input.tasks, input.today);
  const rows: FrostThresholdRow[] = [];
  for (const plant of species) {
    rows.push(thresholdRow(plant, null, input, common));
    for (const series of plant.series) {
      const exception = input.frostRevisions.some((revision) => revision.plantId === plant.plantId && revision.seriesId === series.id);
      if (exception) rows.push(thresholdRow(plant, series, input, common));
    }
  }

  const drying: DryingRow[] = [];
  const speciesWithoutDrying: { plantId: string; name: string }[] = [];
  for (const plant of species) {
    const farm = input.dryingRevisions.some((revision) => revision.plantId === plant.plantId);
    const days = resolveDryingDays({
      plantId: plant.plantId,
      seriesId: '',
      frostRevisions: input.frostRevisions.filter((revision) => revision.seriesId === null),
      dryingRevisions: input.dryingRevisions,
      common,
    });
    if (days !== null || farm) drying.push({ plantId: plant.plantId, name: plant.name, dryingDays: days, origin: farm ? 'farm' : 'common' });
    if (days === null) speciesWithoutDrying.push({ plantId: plant.plantId, name: plant.name });
  }

  const { subjects } = frostSubjects({
    series: input.series,
    tasks: input.tasks,
    revisions: input.frostRevisions,
    common,
    shelteredSeriesIds: input.shelteredSeriesIds,
    today: input.today,
  });
  const frost = evaluateFrost({
    subjects,
    forecasts: input.forecasts,
    today: input.today,
    horizonDays: input.settings.horizonDays,
    offsetCelsius: input.settings.frostOffsetCelsius,
    margins: frostMarginsOf(input.settings),
    alertedKeys: input.alertedFrostKeys,
  });
  const dryingEvaluation = evaluateDrying({
    series: input.series,
    bedNamesBySeries: input.bedNamesBySeries,
    frostRevisions: input.frostRevisions,
    dryingRevisions: input.dryingRevisions,
    common,
    today: input.today,
    alertedSeriesIds: input.alertedDryingSeries,
  });
  const sprinkler = input.location && input.sprinklerSlots
    ? evaluateSprinklers({
      slots: input.sprinklerSlots,
      forecasts: input.forecasts,
      thresholds: {
        maxTemperatureCelsius: input.settings.sprinklerMaxTemperatureCelsius,
        radiationWattsPerSquareMeter: input.settings.sprinklerRadiationWattsPerSquareMeter,
      },
      location: input.location,
      alertedKeys: input.alertedSprinklerKeys,
    })
    : null;

  return {
    today: input.today,
    settings: input.settings,
    common: [...input.common],
    frost: rows.filter((row) => row.status === 'threshold'),
    withoutThreshold: rows.filter((row) => row.status !== 'threshold'),
    drying,
    speciesWithoutDrying,
    upcoming: {
      frost: frost.days.map((day) => ({
        date: day.date,
        minimumCelsius: day.minimumCelsius,
        crops: day.crossings.map((crossing) => ({
          name: crossing.name,
          alertCelsius: crossing.alertThresholdCelsius,
          underShelter: crossing.underShelter,
          alreadyAlerted: crossing.alreadyAlerted,
        })),
      })),
      frostUnavailable: unavailableForecastMessage(frost.unavailableDates),
      drying: [...dryingEvaluation.due, ...dryingEvaluation.upcoming],
      sprinkler: sprinkler?.flags ?? [],
      sunshineUnavailable: sprinkler && sprinkler.sunshineUnavailableDates.length > 0
        ? `Ensoleillement non prévu ${listText(sprinkler.sunshineUnavailableDates.map((date) => `le ${dayText(date)}`))} : seule la maximale y est jugée.`
        : null,
      sprinklerUnjudged: input.location === null,
    },
  };
}

type SeasonSpecies = { plantId: string; name: string; presentToday: boolean; series: { id: string; name: string }[] };

/**
 * Les espèces présentes ou à venir de la saison : celles dont une culture est
 * semée ou plantée, sans être passée sa dernière semaine de récolte. Une
 * culture finie ne figure plus dans la table ; une culture sans implantation
 * n'y figure pas (D-003).
 */
function speciesOfSeason(series: readonly CropSeries[], tasks: readonly ImplantationTask[], today: string): SeasonSpecies[] {
  const species = new Map<string, SeasonSpecies>();
  for (const item of series) {
    for (const cultivation of item.cultivations) {
      const presence = cultivationPresence(item, cultivation, tasks);
      if (presence === null || (presence.end !== null && presence.end < today)) continue;
      const found = species.get(cultivation.plantId) ?? { plantId: cultivation.plantId, name: cultivation.plantName, presentToday: false, series: [] };
      found.presentToday ||= isPresentOn(presence, today);
      if (!found.series.some((known) => known.id === item.id)) found.series.push({ id: item.id, name: item.name });
      species.set(cultivation.plantId, found);
    }
  }
  return [...species.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

function thresholdRow(
  plant: SeasonSpecies,
  series: { id: string; name: string } | null,
  input: { frostRevisions: readonly FrostLinkRevision[]; settings: CropAlertSettings },
  common: ReadonlyMap<string, CropAlertCommonView>,
): FrostThresholdRow {
  const resolved = resolveFrostThreshold({
    plantId: plant.plantId,
    seriesId: series?.id ?? '',
    revisions: series ? input.frostRevisions : input.frostRevisions.filter((revision) => revision.seriesId === null),
    common,
  });
  const damage = resolved.damageCelsius;
  return {
    subjectKey: resolved.subjectKey,
    plantId: plant.plantId,
    seriesId: series?.id ?? null,
    name: series ? `${plant.name} (série ${series.name})` : plant.name,
    status: resolved.status,
    damageCelsius: damage,
    marginCelsius: damage === null ? null : frostMarginCelsius(damage, frostMarginsOf(input.settings)),
    alertCelsius: damage === null ? null : frostAlertThresholdCelsius(damage, input.settings.frostOffsetCelsius, frostMarginsOf(input.settings)),
    source: resolved.source,
    commonKey: resolved.commonKey,
    common: resolved.commonKey === null ? null : common.get(resolved.commonKey) ?? null,
    presentToday: plant.presentToday,
    series: plant.series,
  };
}

/**
 * La bulle « d'où vient ce chiffre » du seuil d'alerte de gel d'une culture
 * (3.8, docs/feature-selection-contract.md, section 6) : les dégâts, la
 * marge et le curseur de microclimat que la ligne porte déjà, et leur somme.
 */
export function frostThresholdOrigin(row: Pick<FrostThresholdRow, 'alertCelsius' | 'damageCelsius' | 'marginCelsius' | 'source'>, offsetCelsius: number): string | null {
  if (row.alertCelsius === null || row.damageCelsius === null || row.marginCelsius === null) return null;
  const source = row.source === 'farm' ? 'seuil de la ferme' : 'jeu commun';
  return `Alerte à ${celsiusText(row.alertCelsius)} = dégâts à ${celsiusText(row.damageCelsius)} (${source}) + marge ${celsiusText(row.marginCelsius)} + microclimat ${celsiusText(offsetCelsius, true)}. La marge, réglable, couvre l’écart entre la prévision, prise à 2 m du sol, et le ras du sol ; le microclimat corrige pour toute la ferme.`;
}
