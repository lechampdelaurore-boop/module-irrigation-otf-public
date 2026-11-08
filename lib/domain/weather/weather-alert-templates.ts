import { WEATHER_ALERT_HORIZON_DAYS, type WeatherAlertCriterionSettings } from './weather-alerts.ts';

/**
 * Les trois modèles d'alerte de l'écran vide (audit ergonomique, lot 3,
 * point 10, docs/audit-ergonomie-lot3-contract.md, section 4, cas 11 ;
 * valeurs choisies par le porteur le 8 novembre 2026 à 12 h 07, section 7) :
 * un clic remplit le formulaire, qui reste modifiable ; rien ne s'enregistre
 * sans « Enregistrer l'alerte ». Les mêmes pour toutes les fermes : un
 * réglage par région viendra plus tard (précision F66). Le gel suit la règle
 * du porteur : un seul seuil, sans stade ; 3 °C dans l'air à 2 m laisse la
 * marge du gel au ras du sol.
 */
export type WeatherAlertTemplate = {
  key: 'frost' | 'heat' | 'rain';
  /** Le texte du bouton, « Gel : moins de 3 °C ». */
  title: string;
  settings: WeatherAlertCriterionSettings;
};

const HORIZON_DAYS = WEATHER_ALERT_HORIZON_DAYS.default;

const TEMPLATES: readonly WeatherAlertTemplate[] = [
  {
    key: 'frost',
    title: 'Gel : moins de 3 °C',
    settings: { field: 'minimum-temperature', direction: 'below', threshold: 3, horizonDays: HORIZON_DAYS, active: true, label: 'Gel' },
  },
  {
    key: 'heat',
    title: 'Forte chaleur : plus de 33 °C',
    settings: { field: 'maximum-temperature', direction: 'above', threshold: 33, horizonDays: HORIZON_DAYS, active: true, label: 'Forte chaleur' },
  },
  {
    key: 'rain',
    title: 'Pluie : plus de 15 mm',
    settings: { field: 'precipitation', direction: 'above', threshold: 15, horizonDays: HORIZON_DAYS, active: true, label: 'Pluie' },
  },
];

/** Les modèles ne paraissent que tant que l'exploitation n'a aucune alerte, active ou non. */
export function weatherAlertTemplates(criteriaCount: number): readonly WeatherAlertTemplate[] {
  return criteriaCount === 0 ? TEMPLATES : [];
}
