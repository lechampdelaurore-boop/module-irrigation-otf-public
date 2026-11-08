import type { FeatureId } from './catalogue';

/**
 * L'avertissement avant de décocher (docs/feature-selection-contract.md, R2) :
 * il dit que les données restent (R1), ce qui disparaît et ce qui change
 * ailleurs. Une case sans donnée enregistrée se décoche sans fenêtre.
 */

/** Ce que la ferme a enregistré, compté par la persistance ; une case absente vaut zéro. */
export type FeatureDataCounts = Partial<{
  equipment: number;
  irrigationEvents: number;
  goals: number;
  rainMeasures: number;
  plans: number;
  protectedSlots: number;
  resources: number;
  pumps: number;
  soilRecords: number;
  cropSettings: number;
  weatherAlertCriteria: number;
  cropAlertSettings: number;
  settingCalculations: number;
}>;

const count = (value: number | undefined) => (value !== undefined && Number.isFinite(value) && value > 0 ? value : 0);

function quantity(value: number, singular: string, plural: string): string {
  return `${value} ${value > 1 ? plural : singular}`;
}

/** « 2 ressources et 1 pompe », sans les quantités nulles. */
function listOf(parts: [number, string, string][]): string {
  const words = parts.filter(([value]) => value > 0).map(([value, singular, plural]) => quantity(value, singular, plural));
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} et ${words.at(-1)}`;
}

/** Le texte de la fenêtre de confirmation, ou `null` quand la case n'a aucune donnée. */
export function uncheckWarning(id: FeatureId, counts: FeatureDataCounts): string | null {
  switch (id) {
    case 'materiel': {
      const equipment = count(counts.equipment);
      if (equipment === 0) return null;
      return `${quantity(equipment, 'matériel', 'matériels')}, avec ${equipment > 1 ? 'leurs' : 'ses'} réglages et ${equipment > 1 ? 'leurs' : 'ses'} poses, ${equipment > 1 ? 'restent enregistrés' : 'reste enregistré'}. Le plan, la fiche de la planche et la liste du matériel ne s’affichent plus.`;
    }
    case 'arrosages': {
      const events = count(counts.irrigationEvents);
      if (events === 0) return null;
      return `${quantity(events, 'arrosage enregistré reste', 'arrosages enregistrés restent')} dans le module. La page des arrosages et la limite journalière ne s’affichent plus, et la notification de fin d’arrosage ne part plus.`;
    }
    case 'besoins': {
      const goals = count(counts.goals);
      const rain = count(counts.rainMeasures);
      if (goals + rain === 0) return null;
      const verb = goals + rain > 1 ? 'restent enregistrés' : goals === 1 ? 'reste enregistré' : 'reste enregistrée';
      return `${listOf([[goals, 'objectif', 'objectifs'], [rain, 'mesure de pluie', 'mesures de pluie']])} ${verb}. Les besoins par planche ne sont plus calculés ni affichés.`;
    }
    case 'planning': {
      const plans = count(counts.plans);
      const slots = count(counts.protectedSlots);
      if (plans + slots === 0) return null;
      const verb = plans + slots > 1 ? 'restent enregistrés' : 'reste enregistré';
      return `${listOf([[plans, 'plan déjà calculé', 'plans déjà calculés'], [slots, 'créneau protégé', 'créneaux protégés']])} ${verb}. Le plan de la semaine n’est plus calculé chaque matin et la notification du matin ne part plus.`;
    }
    case 'ressources': {
      const resources = count(counts.resources);
      const pumps = count(counts.pumps);
      if (resources + pumps === 0) return null;
      const verb = resources + pumps > 1 ? 'restent enregistrées' : 'reste enregistrée';
      return `${listOf([[resources, 'ressource', 'ressources'], [pumps, 'pompe', 'pompes']])} ${verb}. Le planning ne tiendra plus compte de leurs débits ni de leurs stocks : il se calculera comme pour une ferme sans pompe ni ressource déclarée.`;
    }
    case 'sol': {
      const records = count(counts.soilRecords);
      if (records === 0) return null;
      return `${quantity(records, 'saisie du sol reste enregistrée', 'saisies du sol restent enregistrées')}. La jauge n’est plus tenue chaque matin et les propositions du planning n’ont plus de note sur le sol.`;
    }
    case 'cultures': {
      const settings = count(counts.cropSettings);
      if (settings === 0) return null;
      return `${quantity(settings, 'réglage de culture reste enregistré', 'réglages de culture restent enregistrés')}. L’ETM n’est plus enregistrée chaque matin et la fiche de la planche ne propose plus d’objectif.`;
    }
    case 'alertes-meteo': {
      const criteria = count(counts.weatherAlertCriteria);
      if (criteria === 0) return null;
      return `${quantity(criteria, 'alerte réglée reste enregistrée', 'alertes réglées restent enregistrées')}. Plus aucune alerte météo n’est envoyée.`;
    }
    case 'alertes-cultures': {
      const settings = count(counts.cropAlertSettings);
      if (settings === 0) return null;
      return `${quantity(settings, 'réglage reste enregistré', 'réglages restent enregistrés')}. Plus aucune alerte de gel, d’arrêt d’arrosage avant récolte ni d’aspersion n’est envoyée.`;
    }
    case 'calculateur': {
      const calculations = count(counts.settingCalculations);
      if (calculations === 0) return null;
      return `${quantity(calculations, 'réglage garde sa provenance', 'réglages gardent leur provenance')} (calculé, estimé ou mesuré). Le bouton « Calculer depuis le matériel » et les étiquettes ne s’affichent plus ; les valeurs des réglages ne changent pas.`;
    }
    case 'historique':
      // L'historique est celui des arrosages : il n'a pas de donnée à lui.
      return null;
  }
}
