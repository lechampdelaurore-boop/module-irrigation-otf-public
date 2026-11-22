import { compareNamesNaturally } from '../bed-order.ts';
import { mmText } from '../figure-origin.ts';
import { pageHref } from '../features/pages.ts';
import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { isWaitingPlannedIrrigation } from '../planned-irrigation.ts';
import type { StoredPlanSuggestion } from '../planning/contract.ts';
import { morningSuggestions } from '../planning/notifications.ts';
import { phoneNoticeAlarmKeys } from './phone-notice-alarm.ts';
import { countText, farmDateKey, farmHourText, namesText } from './today-text.ts';

/**
 * Le message unique du matin (amélioration n° 3,
 * docs/ameliorations-6-2-3-7-contract.md, section 4.2, F703, F712, F713) :
 * après le calcul du matin, une seule notification par jour et par ferme dit,
 * une phrase chacune, les arrosages planifiés d'aujourd'hui, la pluie prévue
 * aujourd'hui, les alertes en cours et les suggestions du planning. Elle
 * remplace la notification des seules suggestions. Rien quand il n'y a ni
 * arrosage, ni alerte, ni suggestion : la pluie seule ne justifie pas un
 * message. Un clic ouvre « Aujourd'hui ».
 */

const MORNING_MESSAGE_TITLE = 'Votre journée';

/**
 * Le message du matin est activé tant que la ferme ne l'a pas coupé (§4.1,
 * F712) : le module ne sait pas quels appareils sont inscrits — le Worker de
 * notification les garde —, et sans appareil le message ne trouve personne.
 */
export const MORNING_MESSAGE_DEFAULT = true;

export type MorningMessageInputs = {
  now: Date;
  /** L'espace de la ferme : il entre dans l'identifiant d'alarme et l'étiquette (§4.4, F744). */
  workspaceId: string;
  /** Les irrigations lues pour le calcul : celles qui attendent leur heure aujourd'hui sont dites. */
  events: readonly IrrigationEventRecord[];
  /** La pluie prévue aujourd'hui à la ferme, celle que lit le plan ; `null` quand elle n'est pas connue (D-003). */
  forecastRainMm: number | null;
  /** Les alertes que le bloc « Gel ou chaleur » de « Aujourd'hui » annonce (F713). */
  alerts: number;
  suggestions: readonly StoredPlanSuggestion[];
};

export type MorningMessage = {
  /** Le jour de Paris du message : un seul par jour et par ferme (§4.2.4). */
  parisDay: string;
  title: string;
  body: string;
  /** L'identifiant d'alarme du Worker : l'espace et le jour, jamais deux messages le même jour pour une ferme, jamais une alarme partagée entre deux fermes (§4.4, F744). */
  alarmId: string;
  tag: string;
  url: string;
  /** Des nombres, pour le journal : jamais un nom. */
  counts: { irrigations: number; alerts: number; suggestions: number };
};

export function morningMessage(input: MorningMessageInputs): MorningMessage | null {
  const parisDay = farmDateKey(input.now);
  const irrigations = plannedToday(input.events, parisDay);
  const suggestions = morningSuggestions(input.suggestions, input.now);
  const alerts = Math.max(0, Math.trunc(input.alerts));
  if (irrigations.length === 0 && alerts === 0 && suggestions === null) return null;

  const sentences = [
    irrigations.length > 0 ? irrigationsSentence(irrigations) : null,
    rainSentence(input.forecastRainMm),
    alerts > 0 ? `${countText(alerts, 'alerte en cours', 'alertes en cours')}.` : null,
    suggestions?.text ?? null,
  ].filter((sentence): sentence is string => sentence !== null);

  return {
    parisDay,
    title: MORNING_MESSAGE_TITLE,
    body: sentences.join(' '),
    ...phoneNoticeAlarmKeys('morning', input.workspaceId, parisDay),
    url: pageHref('aujourdhui'),
    counts: { irrigations: irrigations.length, alerts, suggestions: suggestions?.count ?? 0 },
  };
}

type PlannedIrrigation = { name: string; startAt: string };

/** Les irrigations planifiées d'aujourd'hui qui attendent encore un geste, par heure de début puis par nom (§4.2.7). */
function plannedToday(events: readonly IrrigationEventRecord[], parisDay: string): PlannedIrrigation[] {
  return events
    .filter(isWaitingPlannedIrrigation)
    .map((event) => ({ name: event.equipment.equipmentSnapshot.name, startAt: event.equipment.plannedStartAt ?? '' }))
    .filter((irrigation) => farmDateKey(irrigation.startAt) === parisDay)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || compareNamesNaturally(a.name, b.name));
}

/** « 3 arrosages prévus aujourd'hui : Rampe 1 (6 h 30), Goutte-à-goutte nord (8 h), Tunnel 2 (9 h) et 2 autres. » */
function irrigationsSentence(irrigations: readonly PlannedIrrigation[]): string {
  const lead = countText(irrigations.length, 'arrosage prévu aujourd’hui', 'arrosages prévus aujourd’hui');
  return `${lead} : ${namesText(irrigations.map((irrigation) => `${irrigation.name} (${farmHourText(irrigation.startAt)})`))}.`;
}

/** La pluie prévue, seulement connue et supérieure à 0 une fois arrondie : jamais « 0 mm » inventé (D-003). */
function rainSentence(forecastRainMm: number | null): string | null {
  if (forecastRainMm === null || !Number.isFinite(forecastRainMm) || Math.round(forecastRainMm * 10) <= 0) return null;
  return `Pluie prévue aujourd’hui : ${mmText(forecastRainMm)}.`;
}
