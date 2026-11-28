import { shortDayText } from '../today/today-text.ts';
import {
  COMPLETION_FORECAST_MODEL_ID,
  forecastCompletion,
  forecastModel,
  forecastModelSource,
  forecastModelsCovering,
  type SourcedWeatherDay,
} from './forecast-models.ts';
import type { WeatherProviderError } from './weather-provider.ts';

/**
 * Enregistrer le modèle de prévision d'une ferme (docs/weather-models-contract.md,
 * § 3 règles 1, 3, 8 et 13 ; D-346) : ce qui peut s'enregistrer, ce que la
 * lecture faite avant doit prouver, et ce que la personne lit en retour. Le
 * service lit, écrit et appelle ; les règles et les mots sont ici, une fois.
 */

type Place = { latitude: number; longitude: number };

/** Pourquoi un choix n'est pas pris, avant toute lecture. */
export type ForecastModelChoiceRefusal =
  /** Règle 13 : le déploiement ne lit pas les modèles (la démonstration). */
  | 'absent'
  /** Règle 3 : le modèle n'est pas dans la liste du logiciel, ou n'y est plus proposé. */
  | 'not-offered'
  /** Le lieu de la ferme n'est pas encore localisé : rien ne vérifierait le modèle. */
  | 'no-place'
  /** Règle 3 : le modèle ne couvre pas le lieu de la ferme. */
  | 'outside-zone'
  /** Le délai entre deux lectures d'une ferme, celui du contrat météo, n'est pas écoulé. */
  | 'too-soon';

/** Pourquoi la lecture faite avant l'enregistrement n'a pas prouvé le modèle (règle 8). */
export type ForecastModelProofFailure = 'rate-limit' | 'unavailable' | 'refused' | 'invalid-response' | 'no-rain';

/** Ce que devient une demande d'enregistrement. */
export type ForecastModelChoiceOutcome =
  /** Enregistré ; `days` est la lecture qui l'a vérifié, vide quand « Automatique » n'a pas pu être relu. */
  | { kind: 'saved'; modelId: string | null; days: readonly SourcedWeatherDay[] }
  /** La ferme lisait déjà ce modèle : rien n'est lu ni écrit. */
  | { kind: 'unchanged'; modelId: string | null }
  | { kind: 'refused'; reason: ForecastModelChoiceRefusal }
  /** Rien n'est enregistré ; la ferme garde son réglage (règle 8). */
  | { kind: 'not-proved'; reason: ForecastModelProofFailure };

/**
 * Ce qu'une ferme peut enregistrer (règles 1 et 3) : « Automatique » (`null`)
 * toujours ; un modèle de la liste encore proposé, qui couvre son lieu. Sans
 * lieu localisé, aucun modèle : la lecture qui le vérifie n'aurait pas où se
 * faire.
 */
export function forecastModelChoiceRefusal(
  modelId: string | null,
  place: Place | null,
): Extract<ForecastModelChoiceRefusal, 'not-offered' | 'no-place' | 'outside-zone'> | null {
  if (modelId === null) return null;
  const model = forecastModel(modelId);
  if (model === null || !model.offered) return 'not-offered';
  if (place === null) return 'no-place';
  return forecastModelsCovering(place).some((covering) => covering.id === model.id) ? null : 'outside-zone';
}

/**
 * Règle 8 : une lecture prouve un modèle quand elle donne la pluie du modèle
 * lui-même pour au moins un jour. Une réponse dont aucun jour ne porte la
 * pluie du modèle (tous complétés par « Automatique d'Open-Meteo », ou sans
 * pluie du tout) ne le prouve pas : rien n'est enregistré.
 */
export function modelReadingProof(modelId: string, days: readonly SourcedWeatherDay[]): ForecastModelProofFailure | null {
  const own = forecastModelSource(modelId);
  return days.some((day) => day.source === own && day.precipitationMm !== null) ? null : 'no-rain';
}

/** La classe d'une lecture en échec, d'après l'erreur du fournisseur : jamais son message, ni l'adresse appelée. */
export function proofFailureOf(kind: WeatherProviderError['kind'] | null): ForecastModelProofFailure {
  if (kind === 'rate-limit') return 'rate-limit';
  if (kind === 'client') return 'refused';
  if (kind === 'invalid-response') return 'invalid-response';
  return 'unavailable';
}

const NOTHING_SAVED = 'rien n’est enregistré, la ferme garde son réglage actuel.';

const REFUSAL_MESSAGES: Readonly<Record<ForecastModelChoiceRefusal, string>> = {
  absent: 'Le choix du modèle de prévision n’existe pas dans la démonstration.',
  'not-offered': `Ce modèle de prévision n’est pas proposé : ${NOTHING_SAVED}`,
  'no-place': 'Choisissez d’abord la commune de la ferme : le modèle se vérifie par une lecture sur son lieu.',
  'outside-zone': `Ce modèle ne couvre pas la commune de la ferme : ${NOTHING_SAVED}`,
  'too-soon': 'La météo de la ferme vient d’être lue : réessayez dans un instant. Rien n’est enregistré.',
};

const PROOF_MESSAGES: Readonly<Record<ForecastModelProofFailure, string>> = {
  'rate-limit': `Open-Meteo limite les lectures pour l’instant, réessayez dans quelques minutes : ${NOTHING_SAVED}`,
  unavailable: `Open-Meteo ne répond pas pour l’instant : ${NOTHING_SAVED}`,
  refused: `Open-Meteo refuse cette lecture : ${NOTHING_SAVED}`,
  'invalid-response': `La réponse d’Open-Meteo est incomplète : ${NOTHING_SAVED}`,
  'no-rain': `Ce modèle ne donne pas la pluie pour la commune de la ferme : ${NOTHING_SAVED}`,
};

/** Le nom d'un modèle dans une phrase ; « Automatique » pour la lecture d'avant ce chantier (règle 1). */
function modelName(modelId: string | null): string {
  if (modelId === null) return '« Automatique »';
  return `« ${forecastModel(modelId)?.label ?? modelId} »`;
}

/**
 * La phrase que la personne lit après sa demande, en clair (règle 8 : le
 * message dit pourquoi). Un modèle enregistré dit, s'il y en a, le dernier
 * jour qu'il donne lui-même : au-delà, les jours viennent d'« Automatique
 * d'Open-Meteo » (règle 6). Aucun mot ne dit qu'un modèle est meilleur
 * (règle 10).
 */
export function forecastModelChoiceMessage(outcome: ForecastModelChoiceOutcome): string {
  switch (outcome.kind) {
    case 'refused':
      return REFUSAL_MESSAGES[outcome.reason];
    case 'not-proved':
      return PROOF_MESSAGES[outcome.reason];
    case 'unchanged':
      return `La ferme lit déjà ${modelName(outcome.modelId)} : rien ne change.`;
    case 'saved': {
      if (outcome.modelId === null) {
        return outcome.days.length > 0
          ? 'La ferme lit de nouveau « Automatique » : ses prévisions à venir sont relues, les jours passés gardent les leurs.'
          : 'La ferme lit de nouveau « Automatique » : ses prévisions à venir seront relues à la prochaine lecture de la météo.';
      }
      const saved = `La ferme lit désormais ${modelName(outcome.modelId)} : ses prévisions à venir sont relues, les jours passés gardent les leurs.`;
      if (outcome.modelId === COMPLETION_FORECAST_MODEL_ID) return saved;
      const { lastModelDate, firstCompletedDate } = forecastCompletion(outcome.modelId, outcome.days);
      return lastModelDate !== null && firstCompletedDate !== null
        ? `${saved} Après le ${shortDayText(lastModelDate)}, les jours viennent d’« Automatique d’Open-Meteo ».`
        : saved;
    }
  }
}
