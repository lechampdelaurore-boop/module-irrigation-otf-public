import { shortDayText } from '../today/today-text.ts';
import { addDaysToDateKey } from '../water-management.ts';
import {
  COMPLETION_FORECAST_MODEL_ID,
  forecastCompletion,
  forecastModel,
  forecastModelsCovering,
} from './forecast-models.ts';

/**
 * Le réglage « Modèle de prévision » de la carte « Lieu de la météo »
 * (docs/weather-models-contract.md, § 3 règles 3, 6, 10 et 12, § 11 point 5 ;
 * D-347) : les choix offerts à un lieu et les phrases que l'écran montre.
 * L'enregistrement et ses messages sont ceux de la PR 2
 * (`forecast-model-choice.ts`) ; ici, seulement ce qui se lit avant le geste.
 * Aucun mot ne dit qu'un modèle est meilleur (règle 10) : fournisseur,
 * maille, portée mesurée, rien d'autre.
 */

/** La valeur du choix « Automatique » dans la liste ; un modèle a son identifiant. */
export const AUTOMATIC_FORECAST_CHOICE = '';

export const FORECAST_MODEL_SETTING_TEXT = {
  title: 'Modèle de prévision',
  /** Règle 12, mot pour mot. */
  lead: 'Les alertes météo et les prévisions de la ferme utiliseront ce modèle.',
  verified: 'Le modèle est vérifié par une lecture avant d’être gardé ; les jours passés gardent leurs prévisions.',
  noPlace: 'Choisissez d’abord la commune : un modèle se vérifie par une lecture sur son lieu.',
  save: 'Enregistrer le modèle',
  saving: 'Vérification…',
} as const;

export type ForecastModelOption = { value: string; label: string };

type Place = { latitude: number; longitude: number };

/**
 * Les choix d'un lieu (règle 3), dans l'ordre de la liste du logiciel :
 * « Automatique » d'abord, le défaut, puis les modèles qui couvrent le lieu.
 */
export function forecastModelOptions(place: Place): ForecastModelOption[] {
  return [
    { value: AUTOMATIC_FORECAST_CHOICE, label: 'Automatique' },
    ...forecastModelsCovering(place).map((model) => ({ value: model.id, label: model.label })),
  ];
}

/**
 * Le choix montré dans la liste : le modèle enregistré s'il est offert à ce
 * lieu ; sinon « Automatique », que la ferme lira de toute façon (règle 9).
 */
export function selectedForecastChoice(savedModelId: string | null, options: readonly ForecastModelOption[]): string {
  return savedModelId !== null && options.some((option) => option.value === savedModelId) ? savedModelId : AUTOMATIC_FORECAST_CHOICE;
}

/**
 * Les faits du choix en cours (règles 6 et 10) : qui fait le modèle, sa
 * maille, sa portée mesurée ; au-delà de la portée, les jours viennent
 * d'« Automatique d'Open-Meteo », et l'écran le dit.
 */
export function forecastModelFacts(choice: string): string {
  if (choice === AUTOMATIC_FORECAST_CHOICE) return 'Le module lit la prévision comme il l’a toujours fait.';
  const model = forecastModel(choice);
  if (model === null) return '';
  const range = `prévoit environ ${model.measuredRangeDays} jours`;
  if (model.id === COMPLETION_FORECAST_MODEL_ID) return `${model.resolution} ; ${range}.`;
  return `${model.provider} · ${model.resolution} ; ${range}, au-delà les jours viennent d’« Automatique d’Open-Meteo ».`;
}

/** Les jours pendant lesquels la carte dit le retour du module à « Automatique » (règle 9 ; D-347). */
const FORECAST_MODEL_RETURN_NOTICE_DAYS = 7;

/** Ce que la carte lit de la base : voir `readForecastModelSettingForUser`. */
export type ForecastModelSettingRecords = {
  forecastDays: readonly { date: string; source: string }[];
  /** `dateKey` : le jour du changement, à la ferme. */
  lastChange: { byModule: boolean; previousModelId: string | null; dateKey: string } | null;
};

export type ForecastModelSettingView = {
  /** Règle 6 : jusqu'à quel jour les prévisions gardées viennent du modèle de la ferme ; `null` sans jour complété. */
  completion: string | null;
  /** Règle 9 : le retour de la ferme à « Automatique » fait par le module, dit la semaine qui suit ; sinon `null`. */
  returnNotice: string | null;
};

/**
 * Les deux phrases de la carte qui dépendent de ce que la ferme a gardé
 * (règles 6 et 9) : le dernier jour du modèle parmi les prévisions à venir,
 * quand des jours suivants sont complétés ; le retour à « Automatique » fait
 * par le module, tant qu'aucun choix ne l'a suivi et pendant
 * `FORECAST_MODEL_RETURN_NOTICE_DAYS` jours. Un modèle sorti de la liste ne
 * se nomme pas (F1019).
 */
export function forecastModelSettingView(
  savedModelId: string | null,
  records: ForecastModelSettingRecords,
  today: string,
): ForecastModelSettingView {
  return { completion: completionText(savedModelId, records.forecastDays), returnNotice: returnNoticeText(savedModelId, records.lastChange, today) };
}

function completionText(savedModelId: string | null, days: ForecastModelSettingRecords['forecastDays']): string | null {
  if (savedModelId === null || savedModelId === COMPLETION_FORECAST_MODEL_ID) return null;
  const { lastModelDate, firstCompletedDate } = forecastCompletion(savedModelId, days);
  if (lastModelDate === null || firstCompletedDate === null) return null;
  return `Prévisions gardées : ce modèle jusqu’au ${shortDayText(lastModelDate)}, puis « Automatique d’Open-Meteo ».`;
}

function returnNoticeText(
  savedModelId: string | null,
  change: ForecastModelSettingRecords['lastChange'],
  today: string,
): string | null {
  if (savedModelId !== null || change === null || !change.byModule || change.previousModelId === null) return null;
  if (change.dateKey < addDaysToDateKey(today, -FORECAST_MODEL_RETURN_NOTICE_DAYS)) return null;
  const since = `depuis le ${shortDayText(change.dateKey)}, la ferme lit de nouveau « Automatique ».`;
  const model = forecastModel(change.previousModelId);
  return model !== null && model.offered
    ? `« ${model.label} » ne couvre pas le lieu de la ferme : ${since}`
    : `Le modèle choisi n’est plus proposé : ${since}`;
}
