import type { WaterReservoir, WaterResource } from './water-resources.ts';

/** Le nom de chaque nature de ressource et de réserve, à l'écran et au journal des modifications (D-288, F722). */
export const RESOURCE_TYPE_LABELS: Readonly<Record<WaterResource['type'], string>> = {
  borehole: 'Forage',
  well: 'Puits',
  spring: 'Source',
  network: 'Réseau d’eau',
  catchment: 'Captage',
  river: 'Rivière',
  other: 'Autre',
};

export const RESERVOIR_TYPE_LABELS: Readonly<Record<WaterReservoir['type'], string>> = {
  buffer: 'Réserve tampon',
  pond: 'Bassin',
  cistern: 'Citerne',
  tank: 'Cuve',
  reservoir: 'Retenue',
  other: 'Autre',
};
