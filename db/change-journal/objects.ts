import type { ChangeSubject } from '@/lib/domain/change-journal/subjects';

/**
 * La ligne que désigne `object_id` d'une ligne du journal, selon son sujet
 * (amélioration n° 7, §5.2 ; D-285) : la table de l'objet touché, ou `null`
 * quand l'objet n'a pas de ligne propre (un réglage de toute la ferme, un
 * objectif repéré par sa planche et sa semaine, une culture d'Ouvre ta
 * ferme, une culture de référence repérée par sa clé, commune ou de la
 * ferme) ; son repère est alors dans `object_context`.
 *
 * Le contrôle de cohérence des espaces (F380, tests/support/space-coherence.ts)
 * lit cette liste : une ligne du journal qui désignerait l'objet d'une autre
 * ferme fait échouer le test qui l'a écrite. Un sujet ajouté sans être rangé
 * ici ne compile pas.
 */
export const JOURNAL_OBJECT_TABLES: Readonly<Record<ChangeSubject, string | null>> = {
  'objectif-hydrique': null,
  'objectif-adopte': null,
  'seuil-de-besoin': null,
  'decision-de-planche': null,
  'reglages-du-planning': null,
  'creneau-protege': 'irrigation_protected_slots',
  'limite-d-eau-du-jour': null,
  'limite-de-ressource': 'irrigation_water_resources',
  'sol-de-parcelle': null,
  'reglages-du-sol': null,
  'profil-racinaire': null,
  'critere-meteo': 'irrigation_weather_alert_criteria',
  'alertes-de-culture': null,
  'seuil-de-gel': null,
  'jours-de-sechage': null,
  fonctionnalites: null,
  'message-du-matin': null,
  'rappel-du-soir': null,
  'kc-corrige': null,
  'culture-de-reference': null,
  'correspondance-d-espece': null,
  'k-abri': null,
  'paillage-plastique': null,
  'filet-d-ombrage': 'irrigation_crop_shade_nets',
  'options-du-besoin': null,
  'jardin-sous-abri': null,
  'groupe-de-jardins': 'irrigation_garden_groups',
  'lieu-meteo': null,
  materiel: 'irrigation_equipment',
  'reglage-de-materiel': 'irrigation_equipment_settings',
  pompe: 'irrigation_pumps',
  'pompe-par-defaut': 'irrigation_equipment',
  ressource: 'irrigation_water_resources',
  reserve: 'irrigation_water_reservoirs',
  'liaison-ressource-reserve': 'irrigation_water_resource_reservoir_links',
  'liaison-entre-reserves': 'irrigation_water_reservoir_links',
  'alimentation-par-defaut': null,
  pose: 'irrigation_equipment_placements',
};
